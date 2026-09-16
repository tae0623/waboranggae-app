import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { fetchKakaoRoute, parseKakaoRoute, kakaoStatus } from '../server/src/modules/recommendation/data/kakao';
import { segmentRequestSchema } from '../server/src/modules/maps/routes';
import { teamAccess, validTeamAccess } from '../server/src/middleware/teamAccess';
import { courseLegKey, kakaoDirectionsUrl, withVerifiedMapSegments } from '../src/domain/kakaoLinks';
import { buildKakaoMapHtml } from '../src/domain/kakaoMapHtml';
import { attachRoutingToCourses } from '../server/src/modules/recommendation/routing';
import { parseTravelText, rankCourses } from '../src/domain/demoEngine';

const from = { name: '순천 터미널', latitude: 34.9475959, longitude: 127.4913557 };
const to = { name: '순천만국가정원', latitude: 34.9289, longitude: 127.5095 };
const geometry = [[127.4913557, 34.9475959], [127.5095, 34.9289]];
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Kakao routing', () => {
  it.each([
    ['1000', 1000], ['999999', 1000], ['300', 300], ['-1', 0],
    ['0', 0], ['1.9', 1], ['Infinity', 0], ['not-a-number', 0],
    ['', 200],
  ])('bounds the aggregate daily guard for %s', (value, expected) => {
    vi.stubEnv('KAKAO_DAILY_REQUEST_LIMIT', value);
    expect(kakaoStatus().dailyProtectiveLimit).toBe(expected);
  });
  it('converts public transit seconds/meters and longitude-first coordinates', () => {
    const result = parseKakaoRoute({ status: 'OK', routes: [{
      properties: { totalTime: 1260, totalDistance: 4100 },
      steps: [{ properties: { type: 'WALKING', time: 300 }, path: { points: geometry } },
        { properties: { type: 'BUS', time: 960 } }],
    }] }, from, to, 'transit');
    expect(result).toMatchObject({ source: 'kakao', totalMinutes: 21, walkMinutes: 5, transitMinutes: 16, distanceKm: 4.1 });
    expect(result?.geometry[0]).toEqual({ latitude: from.latitude, longitude: from.longitude });
  });
  it('parses walking separately and rejects no-route or missing geometry', () => {
    const payload = { status: 'OK', route: { properties: { totalTime: 600, totalDistance: 700 },
      legs: [{ steps: [{ path: { points: geometry } }] }] } };
    expect(parseKakaoRoute(payload, from, to, 'walk')).toMatchObject({ walkMinutes: 10, transitMinutes: 0 });
    expect(parseKakaoRoute({ status: 'NO_RESULTS' }, from, to, 'transit')).toBeNull();
    expect(parseKakaoRoute({ status: 'OK', route: { properties: { totalTime: 600, totalDistance: 700 } } }, from, to, 'walk')).toBeNull();
  });
  it('makes zero external calls until the free tier has been confirmed', async () => {
    vi.stubEnv('KAKAO_REST_API_KEY', 'test-key'); vi.stubEnv('KAKAO_FREE_TIER_CONFIRMED', 'false');
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect(await fetchKakaoRoute(from, to, 'transit')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not call a routing API when attaching recommendation previews', async () => {
    const preferences = parseTravelText('순천 터미널에서 6시간 여행');
    vi.stubEnv('START_LOCATION_OVERRIDES_JSON', JSON.stringify({ [preferences.startLocation]: { ...from, address: '순천' } }));
    const fetch = vi.spyOn(globalThis, 'fetch');
    const courses = rankCourses(preferences);
    // Demo coordinates are assigned explicitly to exercise multiple route legs.
    courses[0]!.places = courses[0]!.places.slice(0, 2).map((p, i) => ({ ...p, latitude: to.latitude + i * .001, longitude: to.longitude }));
    const result = await attachRoutingToCourses(preferences, [courses[0]!]);
    expect(result[0]?.routeSource).toBe('estimated');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('validates input and creates an exact per-leg public-transit link', () => {
    expect(segmentRequestSchema.safeParse({ from, to, mode: 'car' }).success).toBe(false);
    expect(segmentRequestSchema.safeParse({ from, to: { ...to, latitude: 999 }, mode: 'walk' }).success).toBe(false);
    const url = kakaoDirectionsUrl(from, to, 'transit');
    expect(url).toContain('/link/by/traffic/');
    expect(decodeURIComponent(url)).toContain('순천 터미널,34.9475959,127.4913557');
    expect(url).not.toContain('appkey');
  });
  it('generates runnable map script without embedding arbitrary key HTML', () => {
    const html = buildKakaoMapHtml('test-key');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
    expect(html).toContain('mouseenter');
    expect(html).toContain('관광 이미지');
    expect(buildKakaoMapHtml('</script><img onerror=alert(1)>')).not.toContain('</script><img');
  });
  it('keeps verified segments separate by course and handles a missing first origin', () => {
    const course = rankCourses(parseTravelText('순천 여행'))[0]!;
    course.origin = undefined; course.routeSegments = undefined;
    course.places = course.places.slice(0, 2).map((place, i) => ({ ...place,
      latitude: to.latitude + i * .001, longitude: to.longitude }));
    const segment = { fromName: course.places[0]!.name, toName: course.places[1]!.name,
      source: 'kakao' as const, totalMinutes: 5, walkMinutes: 5, transitMinutes: 0,
      distanceKm: .3, modeLabel: '도보', instruction: '도보', steps: [], geometry: [from, to] };
    const verified = { [courseLegKey(course, 1)]: segment };
    expect(withVerifiedMapSegments(course, verified).routeSegments).toEqual([segment]);
    expect(withVerifiedMapSegments({ ...course, id: 'different-course' }, verified).routeSegments?.[0]?.source).toBe('estimated');
  });
});

describe('Team development access', () => {
  const key = 'test-development-key-at-least-24-characters';
  it('checks both team headers and browser Basic credentials', () => {
    expect(validTeamAccess(key, undefined, key)).toBe(true);
    expect(validTeamAccess(undefined, 'Basic ' + Buffer.from('team:' + key).toString('base64'), key)).toBe(true);
    expect(validTeamAccess('wrong', undefined, key)).toBe(false);
  });
  it('blocks anonymous API requests and keeps a session when JWT replaces Basic', async () => {
    vi.stubEnv('TEAM_DEV_MODE', 'true'); vi.stubEnv('TEAM_ACCESS_KEY', key);
    const app = express(); app.use(teamAccess); app.get('/api/test', (_, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const url = 'http://127.0.0.1:' + port + '/api/test';
      expect((await fetch(url)).status).toBe(401);
      const login = await fetch(url, { headers: { 'X-Dev-Access-Key': key } });
      expect(login.status).toBe(200);
      const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
      expect((await fetch(url, { headers: { Cookie: cookie, Authorization: 'Bearer user-token' } })).status).toBe(200);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});
