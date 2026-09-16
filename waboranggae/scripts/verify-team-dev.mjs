import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'dotenv';

// Intentionally local-only: never send the team secret to a caller-supplied URL.
const base = 'http://127.0.0.1:8788';
const settings = parse(await readFile('.env.team.local'));
const headers = { 'X-Dev-Access-Key': settings.TEAM_ACCESS_KEY, 'Content-Type': 'application/json' };
async function request(endpoint, body) {
  const response = await fetch(base + endpoint, {
    method: body ? 'POST' : 'GET', headers,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(120000),
  });
  assert.equal(response.status, 200, endpoint + ' HTTP ' + response.status);
  return response.json();
}
assert.equal((await fetch(base + '/')).status, 401);
const health = await request('/health');
assert.equal(health.tourApiConfigured, true, 'A real TourAPI key is required for this smoke test.');
const preferences = {
  region: '전라남도', city: '순천', startLocation: '순천 터미널', startType: 'terminal',
  travelDate: null, startTime: '10:00', durationHours: 6, mealPreference: 'auto',
  pace: 'balanced', preferLocal: false, interests: ['nature', 'food', 'cafe'],
  companions: '친구', lowMobility: false, publicTransportOnly: true,
  summary: '순천 터미널 출발 6시간 자연·맛집·카페 여행', confidence: 1,
};
const started = Date.now();
const result = await request('/api/recommend', { preferences });
assert.equal(result.source, 'tour-api', 'Demo fallback is not a successful live integration test.');
assert.ok(result.courses?.length > 0);
assert.equal(new Set(result.courses.map(c => c.title)).size, result.courses.length);
for (const course of result.courses) {
  assert.equal(course.routeSource, 'estimated');
  assert.ok(course.origin?.name.includes('터미널'), 'Wrong departure origin');
  assert.ok(course.durationHours >= 5.5 && course.durationHours <= 6.4);
}
const course = result.courses[0];
const place = course.places.find(p => p.imageUrl && Number.isFinite(p.latitude));
assert.ok(place, 'TourAPI image is missing');
const imageUrl = base + '/api/media/tour-image?url=' + encodeURIComponent(place.imageUrl);
const image = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
assert.equal(image.status, 200);
assert.ok(image.headers.get('content-type')?.startsWith('image/'));
const segment = await request('/api/routes/segment', { from: course.origin,
  to: { name: place.name, latitude: place.latitude, longitude: place.longitude }, mode: 'transit' });
assert.ok(segment.externalUrl.startsWith('https://map.kakao.com/link/by/traffic/'));
if (!health.kakao.restKeyConfigured || !health.kakao.freeTierConfirmed) assert.equal(segment.segment, null);

const report = {
  checkedAt: new Date().toISOString(), recommendationMs: Date.now() - started,
  source: result.source, courses: result.courses.map(c => ({ title: c.title, durationHours: c.durationHours, origin: c.origin?.name })),
  imageStatus: image.status, imagePlace: place.name, segmentNotice: segment.notice,
};
await writeFile('.runtime/team-smoke.json', JSON.stringify({ report, course: { ...course,
  places: course.places.map(p => ({ ...p, imageUrl: p.imageUrl ? base + '/api/media/tour-image?url=' + encodeURIComponent(p.imageUrl) : undefined })) } }, null, 2));
console.log(JSON.stringify(report, null, 2));

