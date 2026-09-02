const API_BASE =
  (process.env.BUS_ROUTE_API_BASE_URL || 'https://apis.data.go.kr/1613000/BusRouteInfoInqireService').replace(/\/$/, '');
const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

export interface BusRouteDetail {
  id: string;
  number: string;
  type: string;
  startStop: string;
  endStop: string;
  weekdayIntervalMinutes: number | null;
  firstBusTime: string | null;
  lastBusTime: string | null;
}

type Availability = 'unknown' | 'available' | 'unavailable';
let availability: Availability = serviceKey ? 'unknown' : 'unavailable';
let lastCheckedAt: string | null = null;
let lastError: string | null = serviceKey ? null : 'DATA_GO_KR_KEY 미설정';
let availabilityExpiresAt = 0;
let availabilityPending: Promise<boolean> | null = null;
const detailCache = new Map<string, { expiresAt: number; value: BusRouteDetail | null }>();
const detailPending = new Map<string, Promise<BusRouteDetail | null>>();
const warnedErrors = new Set<string>();

function decodedKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function listItems(payload: any): any[] {
  const item = payload?.response?.body?.items?.item ?? payload?.response?.body?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function valueOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseBusRouteDetail(payload: unknown): BusRouteDetail | null {
  const item = listItems(payload)[0];
  if (!item) return null;
  return {
    id: String(item.routeid ?? item.routeId ?? ''),
    number: String(item.routeno ?? item.routeNo ?? ''),
    type: String(item.routetp ?? item.routeTp ?? '버스'),
    startStop: String(item.startnodenm ?? item.startNodeNm ?? ''),
    endStop: String(item.endnodenm ?? item.endNodeNm ?? ''),
    weekdayIntervalMinutes: positiveNumber(item.intervaltime ?? item.intervalTime),
    firstBusTime: valueOrNull(item.startvehicletime ?? item.startVehicleTime),
    lastBusTime: valueOrNull(item.endvehicletime ?? item.endVehicleTime),
  };
}

function responseError(payload: any, status: number) {
  const header = payload?.response?.header ?? payload?.OpenAPI_ServiceResponse?.cmmMsgHeader ?? {};
  const code = header.resultCode ?? header.returnReasonCode;
  const message = header.resultMsg ?? header.errMsg ?? header.returnAuthMsg;
  if (status >= 400 || (code && code !== '00')) {
    return `${code || status}: ${message || '버스 노선 API 오류'}`;
  }
  return null;
}

async function request(operation: string, params: Record<string, string>) {
  const url = new URL(`${API_BASE}/${operation}`);
  const query = { serviceKey: decodedKey(), pageNo: '1', numOfRows: '10', _type: 'json', ...params };
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
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

async function ensureAvailable() {
  if (!serviceKey) return false;
  if (Date.now() < availabilityExpiresAt && availability !== 'unknown') return availability === 'available';
  if (availabilityPending) return availabilityPending;

  availabilityPending = request('getCtyCodeList', {})
    .then(() => {
      availability = 'available';
      lastError = null;
      availabilityExpiresAt = Date.now() + CACHE_TTL_MS;
      return true;
    })
    .catch((error) => {
      availability = 'unavailable';
      lastError = error instanceof Error ? error.message : '노선 API 연결 실패';
      // 신규 활용신청 직후 승인 전파를 다시 확인할 수 있도록 10분만 차단합니다.
      availabilityExpiresAt = Date.now() + 10 * 60 * 1_000;
      if (!warnedErrors.has(lastError)) {
        warnedErrors.add(lastError);
        console.warn(`[bus-routes] ${lastError} · 정류소 기반 점수만 사용합니다.`);
      }
      return false;
    })
    .finally(() => {
      lastCheckedAt = new Date().toISOString();
      availabilityPending = null;
    });
  return availabilityPending;
}

async function fetchOneRouteDetail(cityCode: string, routeId: string) {
  const cacheKey = `${cityCode}:${routeId}`;
  const cached = detailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = detailPending.get(cacheKey);
  if (pending) return pending;

  const next = request('getRouteInfoIem', { cityCode, routeId })
    .then(parseBusRouteDetail)
    .catch(() => null)
    .then((value) => {
      detailCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    })
    .finally(() => detailPending.delete(cacheKey));
  detailPending.set(cacheKey, next);
  return next;
}

/** 가까운 정류장의 대표 노선만 조회해 배차 품질을 보강합니다. */
export async function fetchBusRouteDetails(cityCode: string, routeIds: string[], limit = 3) {
  if (!await ensureAvailable()) return [];
  const uniqueIds = [...new Set(routeIds.filter(Boolean))].slice(0, limit);
  return (await Promise.all(uniqueIds.map((routeId) => fetchOneRouteDetail(cityCode, routeId))))
    .filter((detail): detail is BusRouteDetail => Boolean(detail));
}

export function getBusRouteApiStatus() {
  return {
    configured: Boolean(serviceKey),
    availability,
    lastCheckedAt,
    lastError,
  };
}
