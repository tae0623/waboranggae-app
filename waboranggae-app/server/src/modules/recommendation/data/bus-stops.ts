import { distanceKm, formatDistanceLabel, transitAccessScore } from '../../../utils/geo';
import { fetchBusRouteDetails } from './bus-routes';

const BUS_API_BASE =
  (process.env.BUS_STOP_API_BASE_URL || 'https://apis.data.go.kr/1613000/BusSttnInfoInqireService').replace(/\/$/, '');
// apis.data.go.kr 계열은 공통 공공데이터포털 서비스키를 사용합니다.
const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const CACHE_TTL_MS = 10 * 60 * 1_000;
const ROUTE_CACHE_TTL_MS = 30 * 60 * 1_000;
const stopCache = new Map<string, { expiresAt: number; value: BusStop[] }>();
const pendingRequests = new Map<string, Promise<BusStop[]>>();
const routeCache = new Map<string, { expiresAt: number; value: BusRoutesAtStop | null }>();
const pendingRouteRequests = new Map<string, Promise<BusRoutesAtStop | null>>();

export interface BusStop {
  id: string;
  cityCode: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export interface BusRouteAtStop {
  id: string;
  number: string;
  type: string;
  startStop: string;
  endStop: string;
}

export interface BusRoutesAtStop {
  uniqueRouteCount: number;
  routes: BusRouteAtStop[];
}

export interface BusAccessProfile {
  stop: BusStop;
  score: number;
  routeCount: number | null;
  sampleRouteNumbers: string[];
  typicalIntervalMinutes: number | null;
  source: 'bus-stop' | 'bus-stop-and-route';
}

function decodedKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function asList(payload: unknown): any[] {
  const root = payload as {
    response?: { body?: { items?: { item?: any | any[] } | '' } };
  };
  const item = typeof root.response?.body?.items === 'object' ? root.response.body.items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

export function parseNearbyBusStops(
  payload: unknown,
  origin: { latitude: number; longitude: number },
): BusStop[] {
  return asList(payload)
    .map((item) => {
      const latitude = Number(item.gpslati ?? item.gpsLati ?? item.latitude);
      const longitude = Number(item.gpslong ?? item.gpsLong ?? item.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      const distanceMeters = distanceKm(origin, { latitude, longitude }) * 1000;
      return {
        id: String(item.nodeid ?? item.nodeId ?? `${latitude}-${longitude}`),
        cityCode: String(item.citycode ?? item.cityCode ?? ''),
        name: String(item.nodenm ?? item.nodeNm ?? '버스정류장'),
        latitude,
        longitude,
        distanceMeters,
      } satisfies BusStop;
    })
    .filter((item): item is BusStop => Boolean(item))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function parseRoutesAtStop(payload: unknown): BusRoutesAtStop {
  const allRoutes = asList(payload).map((item) => ({
    id: String(item.routeid ?? item.routeId ?? ''),
    number: String(item.routeno ?? item.routeNo ?? ''),
    type: String(item.routetp ?? item.routeTp ?? '버스'),
    startStop: String(item.startnodenm ?? item.startNodeNm ?? ''),
    endStop: String(item.endnodenm ?? item.endNodeNm ?? ''),
  })).filter((route) => route.id && route.number);
  const uniqueById = [...new Map(allRoutes.map((route) => [route.id, route])).values()];
  const uniqueRouteNumbers = new Set(uniqueById.map((route) => route.number));
  return { uniqueRouteCount: uniqueRouteNumbers.size, routes: uniqueById };
}

function responseError(payload: any, status: number) {
  const header = payload?.response?.header ?? payload?.OpenAPI_ServiceResponse?.cmmMsgHeader ?? {};
  const code = header.resultCode ?? header.returnReasonCode;
  const message = header.resultMsg ?? header.errMsg ?? header.returnAuthMsg;
  if (status >= 400 || (code && code !== '00')) {
    return `${code || status}: ${message || '버스 정류소 API 오류'}`;
  }
  return null;
}

async function request(operation: string, params: Record<string, string>, numOfRows = '20') {
  const url = new URL(`${BUS_API_BASE}/${operation}`);
  const query = { serviceKey: decodedKey(), pageNo: '1', numOfRows, _type: 'json', ...params };
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const text = await response.text();
  let payload: any = {};
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${response.status}: JSON이 아닌 응답`);
  }
  const error = responseError(payload, response.status);
  if (error) throw new Error(error);
  return payload;
}

/**
 * TAGO 좌표기반 근접정류소 조회 (반경 ~500m)
 * https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList
 */
export async function fetchNearbyBusStops(
  latitude: number,
  longitude: number,
): Promise<BusStop[]> {
  if (!serviceKey) return [];

  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = stopCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending;

  const request = fetchNearbyBusStopsUncached(latitude, longitude)
    .then((value) => {
      stopCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    })
    .finally(() => pendingRequests.delete(cacheKey));
  pendingRequests.set(cacheKey, request);
  return request;
}

async function fetchNearbyBusStopsUncached(
  latitude: number,
  longitude: number,
): Promise<BusStop[]> {
  try {
    const payload = await request('getCrdntPrxmtSttnList', {
      gpsLati: String(latitude),
      gpsLong: String(longitude),
    });
    return parseNearbyBusStops(payload, { latitude, longitude });
  } catch (error) {
    console.warn('[bus-stops]', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function fetchRoutesThroughStop(stop: BusStop): Promise<BusRoutesAtStop | null> {
  if (!serviceKey || !stop.cityCode || !stop.id) return null;
  const cacheKey = `${stop.cityCode}:${stop.id}`;
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = pendingRouteRequests.get(cacheKey);
  if (pending) return pending;

  // TAGO 게이트웨이는 이 오퍼레이션에서 문서 표기와 달리 소문자 nodeid만 필터로 적용합니다.
  const next = request('getSttnThrghRouteList', { cityCode: stop.cityCode, nodeid: stop.id }, '300')
    .then(parseRoutesAtStop)
    .catch((error) => {
      console.warn('[bus-stops:routes]', error instanceof Error ? error.message : error);
      return null;
    })
    .then((value) => {
      routeCache.set(cacheKey, { value, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
      return value;
    })
    .finally(() => pendingRouteRequests.delete(cacheKey));
  pendingRouteRequests.set(cacheKey, next);
  return next;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle] ?? null;
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

/** 정류장 거리와 실제 경유 노선 공급을 결합한 대중교통 접근성 근거를 반환합니다. */
export async function getBusAccessProfile(latitude: number, longitude: number): Promise<BusAccessProfile | null> {
  const stops = await fetchNearbyBusStops(latitude, longitude);
  const stop = stops[0];
  if (!stop) return null;
  const routesAtStop = await fetchRoutesThroughStop(stop);
  if (!routesAtStop) {
    return {
      stop,
      score: transitAccessScore(stop.distanceMeters, null),
      routeCount: null,
      sampleRouteNumbers: [],
      typicalIntervalMinutes: null,
      source: 'bus-stop',
    };
  }

  const routeDetails = await fetchBusRouteDetails(
    stop.cityCode,
    routesAtStop.routes.map((route) => route.id),
  );
  const typicalIntervalMinutes = median(
    routeDetails.map((route) => route.weekdayIntervalMinutes)
      .filter((value): value is number => value != null),
  );
  const sampleRouteNumbers = [...new Set(routesAtStop.routes.map((route) => route.number))].slice(0, 5);
  return {
    stop,
    score: transitAccessScore(stop.distanceMeters, routesAtStop.uniqueRouteCount, typicalIntervalMinutes),
    routeCount: routesAtStop.uniqueRouteCount,
    sampleRouteNumbers,
    typicalIntervalMinutes,
    source: routeDetails.length ? 'bus-stop-and-route' : 'bus-stop',
  };
}

export async function nearestBusStopDistanceMeters(
  latitude: number,
  longitude: number,
): Promise<{ meters: number | null; stop: BusStop | null }> {
  const stops = await fetchNearbyBusStops(latitude, longitude);
  const nearest = stops[0] ?? null;
  return {
    meters: nearest ? nearest.distanceMeters : null,
    stop: nearest,
  };
}

export function describeBusAccess(meters: number | null): string {
  if (meters == null) return '정류장 정보 확인 중';
  return `버스정류장 ${formatDistanceLabel(meters)}`;
}

export function isBusStopApiConfigured() {
  return Boolean(serviceKey);
}
