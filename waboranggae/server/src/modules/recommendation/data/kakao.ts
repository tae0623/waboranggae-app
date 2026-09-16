import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { reserveDailyQuota } from '../../../runtime/quota';
import { RouteOrigin, RouteSegment, RoutingPoint, TravelMode, TravelPreferences } from '../../../../../src/types/travel';

type Step = { properties?: { type?: string; time?: number; guidance?: string; vehicles?: {name?: string}[]; stops?: {name?: string}[] }; path?: { points?: number[][] } };
type Route = { properties?: { totalTime?: number; totalDistance?: number }; steps?: Step[]; legs?: { steps?: Step[] }[] };
type Payload = { status?: string; routes?: Route[]; route?: Route };
const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let quotaQueue = Promise.resolve();
const apiKey = () => (process.env.KAKAO_REST_API_KEY || '').trim();

export function kakaoStatus() {
  // Aggregate guard: each routing API has a 1,000/day free quota (checked 2026-09-16).
  // Keep this combined cap even during final testing; never enable paid overage here.
  const requestedLimit = Number(process.env.KAKAO_DAILY_REQUEST_LIMIT || 200);
  return {
    restKeyConfigured: Boolean(apiKey()),
    mapKeyConfigured: Boolean(process.env.KAKAO_MAP_JS_KEY?.trim()),
    freeTierConfirmed: process.env.KAKAO_FREE_TIER_CONFIRMED === 'true',
    dailyProtectiveLimit: Number.isFinite(requestedLimit)
      ? Math.max(0, Math.min(1000, Math.floor(requestedLimit))) : 0,
    routingMode: 'on-demand',
  };
}

/** Production uses atomic DB reservations; single-process development uses a local file. */
async function reserveQuota() {
  if (process.env.NODE_ENV === 'production' || process.env.QUOTA_STORE === 'database') {
    const status = kakaoStatus();
    return status.freeTierConfirmed && Boolean(apiKey()) && reserveDailyQuota('kakao:total', status.dailyProtectiveLimit);
  }
  let granted = false;
  const action = quotaQueue.then(async () => {
    const status = kakaoStatus();
    if (!status.freeTierConfirmed || !apiKey() || !status.dailyProtectiveLimit) return;
    const file = path.resolve('.runtime/kakao-usage.json');
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    let previous: { date: string; count: number } = { date, count: 0 };
    try { previous = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (previous.date !== date) previous = { date, count: 0 };
    if (!Number.isInteger(previous.count) || previous.count < 0) throw new Error('Invalid quota state');
    if (previous.count >= status.dailyProtectiveLimit) return;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file + '.tmp', JSON.stringify({ date, count: previous.count + 1 }), { mode: 0o600 });
    await rename(file + '.tmp', file);
    granted = true;
  });
  quotaQueue = action.catch(() => undefined);
  try { await action; } catch { console.warn('[kakao] 호출량 보호 기록 실패: 외부 요청을 중단합니다.'); }
  return granted;
}

export async function kakaoRequest(endpoint: string, params: Record<string, string>): Promise<unknown | null> {
  if (!['/v2/local/search/keyword.json', '/v2/local/search/address.json', '/v2/local/geo/coord2address.json', '/v2/routing/walk', '/v2/routing/publictraffic'].includes(endpoint)) return null;
  if (!apiKey() || !kakaoStatus().freeTierConfirmed) return null;
  const url = new URL(endpoint, 'https://dapi.kakao.com');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const cacheKey = url.href;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const running = pending.get(cacheKey);
  if (running) return running;
  const request = (async () => {
    if (!await reserveQuota()) return null;
    let value: unknown = null;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey()}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      value = await response.json();
    } catch (error) { console.warn('[kakao]', error instanceof Error ? error.message : '연결 실패'); }
    // Short-lived cache only; do not build a permanent third-party route database.
    if (cache.size > 500) cache.clear();
    cache.set(cacheKey, { value, expires: Date.now() + (value ? 5 * 60000 : 30000) });
    return value;
  })().finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, request);
  return request;
}

export function parseKakaoRoute(payload: unknown, from: RoutingPoint, to: RoutingPoint, mode: TravelMode): RouteSegment | null {
  const body = payload as Payload | null;
  if (!body || body.status !== 'OK') return null;
  const route = mode === 'transit' ? body.routes?.[0] : body.route;
  if (!route) return null;
  const seconds = Number(route.properties?.totalTime);
  const meters = Number(route.properties?.totalDistance);
  if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(meters) || meters < 0) return null;
  const steps = mode === 'transit' ? route.steps || [] : route.legs?.flatMap(leg => leg.steps || []) || [];
  const walkSeconds = mode === 'walk' ? seconds : Math.min(seconds, steps
    .filter(step => step.properties?.type === 'WALKING')
    .reduce((sum, step) => sum + Math.max(0, Number(step.properties?.time) || 0), 0));
  const geometry = steps.flatMap(step => step.path?.points || [])
    .filter(pair => pair.length >= 2 && pair.every(Number.isFinite))
    .map(pair => ({ longitude: pair[0]!, latitude: pair[1]! }));
  // Missing geometry must not be presented as a verified route line.
  if (geometry.length < 2) return null;
  const totalMinutes = Math.ceil(seconds / 60);
  const walkMinutes = Math.min(totalMinutes, Math.ceil(walkSeconds / 60));
  const transitSteps = steps.map(step => ({
    mode: mode === 'walk' || step.properties?.type === 'WALKING' ? 'walk' as const : step.properties?.type === 'BUS' ? 'bus' as const : step.properties?.type === 'SUBWAY' ? 'subway' as const : 'other' as const,
    minutes: Math.max(0, Math.ceil((step.properties?.time || 0) / 60)),
    label: step.properties?.guidance || (mode === 'walk' ? '도보 이동' : '구간 이동'),
    route: step.properties?.vehicles?.[0]?.name,
    fromStop: step.properties?.stops?.[0]?.name, toStop: step.properties?.stops?.at(-1)?.name,
    geometry: (step.path?.points || []).filter(p=>p.length>=2&&p.every(Number.isFinite)&&Math.abs(p[0]!)<=180&&Math.abs(p[1]!)<=90).map(p=>({longitude:p[0]!,latitude:p[1]!})),
    stops: step.properties?.stops?.flatMap(s=>s.name?[s.name]:[]) || [],
    routes: step.properties?.vehicles?.flatMap(v=>v.name?[v.name]:[]) || [],
  }));
  // Live responses can contain only BUS steps while totalTime includes extra time.
  // Keep the provider total, but do not claim the residual is all riding or walking.
  const unclassifiedMinutes = mode === 'transit'
    ? Math.max(0, totalMinutes - transitSteps.reduce((sum, step) => sum + step.minutes, 0)) : 0;
  if(unclassifiedMinutes)transitSteps.push({mode:'other',minutes:unclassifiedMinutes,
    label:`추가 이동·대기 ${unclassifiedMinutes}분 (세부 구분 미제공)`,route:undefined,fromStop:undefined,toStop:undefined,geometry:[],stops:[],routes:[]});
  return {
    fromName: from.name, toName: to.name, source: 'kakao',
    distanceKm: Math.round(meters / 100) / 10, totalMinutes, walkMinutes,
    transitMinutes: totalMinutes - walkMinutes, unclassifiedMinutes,
    modeLabel: mode === 'walk' ? '도보' : '대중교통·도보',
    instruction: transitSteps.map(step => step.label).join(' → '), steps: transitSteps,
    geometry,
  };
}

export async function fetchKakaoRoute(from: RoutingPoint, to: RoutingPoint, mode: TravelMode) {
  const payload = await kakaoRequest(`/v2/routing/${mode === 'walk' ? 'walk' : 'publictraffic'}`, {
    start_x: String(from.longitude), start_y: String(from.latitude),
    end_x: String(to.longitude), end_y: String(to.latitude),
    input_coord: 'WGS84', output_coord: 'WGS84',
  });
  return parseKakaoRoute(payload, from, to, mode);
}

export async function fetchKakaoOrigin(preferences: TravelPreferences): Promise<RouteOrigin | null> {
  const query = preferences.startLocation.includes(preferences.city)
    ? preferences.startLocation : `${preferences.city} ${preferences.startLocation}`;
  const payload = await kakaoRequest('/v2/local/search/keyword.json', { query, size: '5' }) as {
    documents?: { x: string; y: string; place_name: string; road_address_name: string; address_name: string }[];
  } | null;
  const item = payload?.documents?.find(p => p.address_name?.includes(preferences.city));
  if (!item || !Number.isFinite(Number(item.y)) || !Number.isFinite(Number(item.x))) return null;
  return {
    name: preferences.startLocation, address: `${item.place_name} · ${item.road_address_name || item.address_name}`,
    latitude: Number(item.y), longitude: Number(item.x), source: 'kakao',
  };
}
