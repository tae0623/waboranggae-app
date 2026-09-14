import { RouteOrigin, TravelPreferences } from '../../../../../src/types/travel';

const baseUrl = (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const userAgent = process.env.NOMINATIM_USER_AGENT
  || 'waboranggae-app/1.0 (https://github.com/tae0623/waboranggae-app)';
const contactEmail = process.env.NOMINATIM_CONTACT_EMAIL?.trim();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MIN_REQUEST_INTERVAL_MS = 1_050;

type GeocodeEntry = { expiresAt: number; value: RouteOrigin | null };
type NominatimItem = { lat?: string; lon?: string; display_name?: string };

const cache = new Map<string, GeocodeEntry>();
const pending = new Map<string, Promise<RouteOrigin | null>>();
let geocodeQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function configuredOrigins(): Record<string, Omit<RouteOrigin, 'name' | 'source'>> {
  const raw = process.env.START_LOCATION_OVERRIDES_JSON?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Omit<RouteOrigin, 'name' | 'source'>>;
  } catch {
    console.warn('[geocoder] START_LOCATION_OVERRIDES_JSON 형식이 올바르지 않습니다.');
    return {};
  }
}

function queryFor(preferences: TravelPreferences) {
  if (preferences.startType === 'current') return null;
  if (preferences.startType === 'lodging' && new RegExp(`^${preferences.city}\\s*숙소$`).test(preferences.startLocation)) {
    return null;
  }
  if (preferences.startType === 'terminal') {
    return `${preferences.city}종합버스터미널, ${preferences.region}, 대한민국`;
  }
  if (preferences.startType === 'station') {
    return `${preferences.city}역, ${preferences.region}, 대한민국`;
  }
  return `${preferences.startLocation}, ${preferences.city}, ${preferences.region}, 대한민국`;
}

async function respectPublicRateLimit() {
  const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());
  if (waitMs) await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

async function fetchOrigin(preferences: TravelPreferences, query: string): Promise<RouteOrigin | null> {
  await respectPublicRateLimit();
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'kr');
  url.searchParams.set('accept-language', 'ko');
  if (contactEmail) url.searchParams.set('email', contactEmail);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'ko',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const [item] = await response.json() as NominatimItem[];
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      name: preferences.startLocation,
      address: item?.display_name || query,
      latitude,
      longitude,
      source: 'nominatim',
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** 선택한 역·터미널 이름을 실제 지도 좌표로 해석합니다. */
export function resolveStartOrigin(preferences: TravelPreferences): Promise<RouteOrigin | null> {
  if (
    Number.isFinite(preferences.startLatitude)
    && Number.isFinite(preferences.startLongitude)
  ) {
    return Promise.resolve({
      name: preferences.startLocation,
      address: preferences.startAddress || preferences.startLocation,
      latitude: preferences.startLatitude as number,
      longitude: preferences.startLongitude as number,
      source: 'places',
    });
  }

  const configured = configuredOrigins()[preferences.startLocation];
  if (configured && Number.isFinite(configured.latitude) && Number.isFinite(configured.longitude)) {
    return Promise.resolve({ ...configured, name: preferences.startLocation, source: 'configured' });
  }

  const query = queryFor(preferences);
  if (!query) return Promise.resolve(null);
  const cacheKey = query.toLocaleLowerCase('ko-KR');
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  const existing = pending.get(cacheKey);
  if (existing) return existing;

  const request = new Promise<RouteOrigin | null>((resolve) => {
    geocodeQueue = geocodeQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          resolve(await fetchOrigin(preferences, query));
        } catch (error) {
          console.warn('[geocoder]', error instanceof Error ? error.message : error);
          resolve(null);
        }
      });
  }).then((value) => {
    cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }).finally(() => pending.delete(cacheKey));

  pending.set(cacheKey, request);
  return request;
}
