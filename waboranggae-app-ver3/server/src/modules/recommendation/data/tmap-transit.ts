import { RouteCoordinate, RouteSegment } from '../../../../../src/types/travel';

const apiKey = (process.env.TMAP_TRANSIT_API_KEY || process.env.TMAP_API_KEY || '').trim();
const apiUrl = process.env.TMAP_TRANSIT_API_URL || 'https://apis.openapi.sk.com/transit/routes';
const CACHE_TTL_MS = 15 * 60 * 1_000;
const requestedDailyLimit = Number(process.env.TMAP_DAILY_REQUEST_LIMIT || 10);
const dailyRequestLimit = Number.isFinite(requestedDailyLimit) && requestedDailyLimit > 0
  ? Math.floor(requestedDailyLimit)
  : 10;

export interface RoutingPoint extends RouteCoordinate {
  name: string;
}

type TmapLeg = {
  mode?: string;
  route?: string;
  sectionTime?: number;
  distance?: number;
  start?: { name?: string; lat?: number; lon?: number };
  end?: { name?: string; lat?: number; lon?: number };
  steps?: Array<{ linestring?: string }>;
  passShape?: { linestring?: string };
};

type TmapPayload = {
  metaData?: {
    plan?: {
      itineraries?: Array<{
        totalTime?: number;
        totalWalkTime?: number;
        totalWalkDistance?: number;
        totalDistance?: number;
        legs?: TmapLeg[];
      }>;
    };
  };
};

const cache = new Map<string, { expiresAt: number; value: RouteSegment | null }>();
const pending = new Map<string, Promise<RouteSegment | null>>();
let requestUsage = { date: '', count: 0 };
let quotaWarningDate = '';

export function isTmapTransitConfigured() {
  return Boolean(apiKey);
}

function koreaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function currentRequestUsage() {
  const date = koreaDate();
  if (requestUsage.date !== date) requestUsage = { date, count: 0 };
  return requestUsage;
}

function reserveRequest() {
  const usage = currentRequestUsage();
  if (usage.count >= dailyRequestLimit) {
    if (quotaWarningDate !== usage.date) {
      console.warn(`[tmap-transit] 일일 보호 한도 ${dailyRequestLimit}회에 도달해 예상 경로로 전환합니다.`);
      quotaWarningDate = usage.date;
    }
    return false;
  }
  usage.count += 1;
  return true;
}

export function getTmapTransitStatus() {
  const usage = currentRequestUsage();
  return {
    configured: isTmapTransitConfigured(),
    dailyRequestLimit,
    requestsReservedToday: usage.count,
    remainingProtectedRequests: Math.max(0, dailyRequestLimit - usage.count),
  };
}

export function parseTmapLineString(value?: string): RouteCoordinate[] {
  if (!value) return [];
  return [...value.matchAll(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g)].flatMap((match) => {
    const longitude = Number(match[1]);
    const latitude = Number(match[2]);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ latitude, longitude }] : [];
  });
}

function sameCoordinate(a: RouteCoordinate, b: RouteCoordinate) {
  return Math.abs(a.latitude - b.latitude) < 0.000001
    && Math.abs(a.longitude - b.longitude) < 0.000001;
}

function compactGeometry(points: RouteCoordinate[], maxPoints = 320) {
  const unique = points.filter((point, index) => index === 0 || !sameCoordinate(point, points[index - 1]!));
  if (unique.length <= maxPoints) return unique;
  const step = (unique.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => unique[Math.round(index * step)]!).filter(Boolean);
}

function modeName(mode?: string) {
  const labels: Record<string, string> = {
    WALK: '도보',
    BUS: '버스',
    SUBWAY: '지하철',
    EXPRESSBUS: '시외·고속버스',
    TRAIN: '기차',
    AIRPLANE: '항공',
    FERRY: '여객선',
  };
  return labels[mode || ''] || mode || '대중교통';
}

export function parseTmapTransitResponse(
  payload: unknown,
  from: RoutingPoint,
  to: RoutingPoint,
): RouteSegment | null {
  const itinerary = (payload as TmapPayload).metaData?.plan?.itineraries?.[0];
  if (!itinerary) return null;
  const legs = itinerary.legs || [];
  const totalSeconds = Number(itinerary.totalTime || legs.reduce((sum, leg) => sum + Number(leg.sectionTime || 0), 0));
  const walkSeconds = Number(itinerary.totalWalkTime || legs
    .filter((leg) => leg.mode === 'WALK')
    .reduce((sum, leg) => sum + Number(leg.sectionTime || 0), 0));
  const geometry = compactGeometry([
    { latitude: from.latitude, longitude: from.longitude },
    ...legs.flatMap((leg) => {
      const lines = leg.mode === 'WALK'
        ? leg.steps?.flatMap((step) => parseTmapLineString(step.linestring)) || []
        : parseTmapLineString(leg.passShape?.linestring);
      if (lines.length) return lines;
      return [leg.start, leg.end].flatMap((point) => {
        const latitude = Number(point?.lat);
        const longitude = Number(point?.lon);
        return Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ latitude, longitude }] : [];
      });
    }),
    { latitude: to.latitude, longitude: to.longitude },
  ]);
  const modes = [...new Set(legs.map((leg) => leg.mode).filter(Boolean))]
    .map((mode) => modeName(mode));

  return {
    fromName: from.name,
    toName: to.name,
    distanceKm: Math.round(Number(itinerary.totalDistance || legs.reduce((sum, leg) => sum + Number(leg.distance || 0), 0)) / 100) / 10,
    totalMinutes: Math.max(1, Math.ceil(totalSeconds / 60)),
    walkMinutes: Math.max(0, Math.ceil(walkSeconds / 60)),
    transitMinutes: Math.max(0, Math.ceil((totalSeconds - walkSeconds) / 60)),
    modeLabel: modes.join('·') || '대중교통',
    source: 'tmap-transit',
    geometry,
  };
}

export async function fetchTmapTransitRoute(
  from: RoutingPoint,
  to: RoutingPoint,
  searchDttm?: string,
): Promise<RouteSegment | null> {
  if (!isTmapTransitConfigured()) return null;
  const cacheKey = [from.longitude, from.latitude, to.longitude, to.latitude, searchDttm || 'now']
    .map((value) => typeof value === 'number' ? value.toFixed(5) : value)
    .join('|');
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const existing = pending.get(cacheKey);
  if (existing) return existing;
  if (!reserveRequest()) return null;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          appKey: apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startX: String(from.longitude),
          startY: String(from.latitude),
          endX: String(to.longitude),
          endY: String(to.latitude),
          count: 1,
          lang: 0,
          format: 'json',
          ...(searchDttm ? { searchDttm } : {}),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return parseTmapTransitResponse(await response.json(), from, to);
    } catch (error) {
      console.warn('[tmap-transit]', error instanceof Error ? error.message : error);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })().then((value) => {
    cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }).finally(() => pending.delete(cacheKey));

  pending.set(cacheKey, request);
  return request;
}
