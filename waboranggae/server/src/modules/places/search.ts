const kakaoKey = (process.env.KAKAO_REST_API_KEY || '').trim();
const tmapKey = (process.env.TMAP_TRANSIT_API_KEY || process.env.TMAP_API_KEY || '').trim();
const nominatimBase = (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const nominatimAgent = process.env.NOMINATIM_USER_AGENT
  || 'waboranggae-app/1.0 (https://github.com/tae0623/waboranggae-app)';

const ADDRESS_HINT = /(?:특별시|광역시|특별자치시|특별자치도|전라남도|전남|경기도|충청|경상|강원|제주|[가-힣]{1,6}(?:시|군|구|읍|면|동|리|로|길))\s*\d/;
const CACHE_TTL_MS = 10 * 60 * 1_000;
const cache = new Map<string, { expiresAt: number; value: PlaceSuggestion[] }>();

export interface PlaceSuggestion {
  id: string;
  name: string;
  address: string;
  city?: string;
  category?: string;
  latitude: number;
  longitude: number;
  source: 'kakao' | 'kakao-address' | 'tmap' | 'tmap-address' | 'nominatim' | 'tour-api';
}

type TmapPoi = {
  id?: string;
  name?: string;
  frontLat?: string;
  frontLon?: string;
  noorLat?: string;
  noorLon?: string;
  upperAddrName?: string;
  middleAddrName?: string;
  lowerAddrName?: string;
  detailAddrName?: string;
  upperBizName?: string;
  middleBizName?: string;
  lowerBizName?: string;
  radius?: string;
};

type TmapCoordinate = {
  lat?: string;
  lon?: string;
  newLat?: string;
  newLon?: string;
  buildingName?: string;
  fullAddr?: string;
  city_do?: string;
  gu_gun?: string;
  legalDong?: string;
  adminDong?: string;
};

export function isAddressQuery(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 4) return false;
  return ADDRESS_HINT.test(trimmed) || /\d{1,4}(?:번지|호)?$/.test(trimmed);
}

export function formatTmapAddress(poi: Pick<TmapPoi, 'upperAddrName' | 'middleAddrName' | 'lowerAddrName' | 'detailAddrName'>) {
  return [poi.upperAddrName, poi.middleAddrName, poi.lowerAddrName, poi.detailAddrName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

function cityFromAddress(address: string, fallback?: string) {
  const haystack = `${fallback ?? ''} ${address}`;
  const match = haystack.match(/([가-힣]{1,6}(?:특별시|광역시|특별자치시|시|군))/);
  return match?.[1]?.replace(/특별시$|광역시$|특별자치시$|시$|군$/, '') || fallback?.replace(/시$|군$/, '');
}

function kakaoConfigured() {
  return Boolean(kakaoKey);
}

function tmapConfigured() {
  return Boolean(tmapKey);
}

type KakaoKeywordDoc = {
  id?: string;
  place_name?: string;
  category_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

type KakaoAddressDoc = {
  address_name?: string;
  x?: string;
  y?: string;
  address?: { region_2depth_name?: string };
  road_address?: { building_name?: string; address_name?: string };
};

async function kakaoGet(path: string, params: Record<string, string>) {
  const url = new URL(`https://dapi.kakao.com${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${kakaoKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  const payload = await response.json() as { documents?: unknown; errorType?: string; message?: string };
  if (!response.ok) {
    throw new Error(`Kakao HTTP ${response.status}${payload.errorType ? ` ${payload.errorType}` : ''}${payload.message ? `: ${payload.message}` : ''}`);
  }
  return payload;
}

export function categoryFromKakao(categoryName?: string) {
  const parts = (categoryName || '').split('>').map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] || parts[0];
}

function toKakaoPlace(doc: KakaoKeywordDoc): PlaceSuggestion | null {
  const latitude = Number(doc.y);
  const longitude = Number(doc.x);
  const name = doc.place_name?.trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = doc.road_address_name?.trim() || doc.address_name?.trim() || '';
  return {
    id: `kakao:${doc.id || `${latitude},${longitude}`}`,
    name,
    address,
    city: cityFromAddress(address),
    category: categoryFromKakao(doc.category_name),
    latitude,
    longitude,
    source: 'kakao',
  };
}

function toKakaoAddress(doc: KakaoAddressDoc, query: string): PlaceSuggestion | null {
  const latitude = Number(doc.y);
  const longitude = Number(doc.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const building = doc.road_address?.building_name?.trim();
  const address = doc.road_address?.address_name?.trim() || doc.address_name?.trim() || query;
  return {
    id: `kakao-addr:${latitude.toFixed(5)},${longitude.toFixed(5)}:${building || address}`,
    name: building || address,
    address,
    city: cityFromAddress(address, doc.address?.region_2depth_name),
    category: building ? '장소' : '주소',
    latitude,
    longitude,
    source: 'kakao-address',
  };
}

async function searchKakaoKeyword(query: string, center?: { latitude: number; longitude: number }) {
  const params: Record<string, string> = { query, size: '15', page: '1' };
  if (center) {
    params.y = String(center.latitude);
    params.x = String(center.longitude);
    params.radius = '20000';
    params.sort = 'distance';
  }
  const payload = await kakaoGet('/v2/local/search/keyword.json', params);
  const docs = Array.isArray(payload.documents) ? payload.documents as KakaoKeywordDoc[] : [];
  return docs.flatMap((doc) => {
    const suggestion = toKakaoPlace(doc);
    return suggestion ? [suggestion] : [];
  });
}

async function searchKakaoAddress(query: string) {
  const payload = await kakaoGet('/v2/local/search/address.json', { query, size: '10' });
  const docs = Array.isArray(payload.documents) ? payload.documents as KakaoAddressDoc[] : [];
  return docs.flatMap((doc) => {
    const suggestion = toKakaoAddress(doc, query);
    return suggestion ? [suggestion] : [];
  });
}

async function tmapGet(path: string, params: Record<string, string>) {
  const url = new URL(`https://apis.openapi.sk.com${path}`);
  Object.entries({ version: '1', ...params }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { appKey: tmapKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`TMAP HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

function toPoiSuggestion(poi: TmapPoi): PlaceSuggestion | null {
  const latitude = Number(poi.frontLat || poi.noorLat);
  const longitude = Number(poi.frontLon || poi.noorLon);
  const name = poi.name?.trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = formatTmapAddress(poi);
  const category = [poi.lowerBizName, poi.middleBizName, poi.upperBizName].find((item) => item?.trim());
  return {
    id: `tmap:${poi.id || `${latitude},${longitude}`}`,
    name,
    address,
    city: cityFromAddress(address, poi.middleAddrName),
    category: category?.trim(),
    latitude,
    longitude,
    source: 'tmap',
  };
}

function toAddressSuggestion(item: TmapCoordinate, query: string): PlaceSuggestion | null {
  const latitude = Number(item.newLat || item.lat);
  const longitude = Number(item.newLon || item.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const building = item.buildingName?.trim();
  const address = [item.fullAddr, item.city_do, item.gu_gun, item.legalDong || item.adminDong]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ') || query;
  return {
    id: `addr:${latitude.toFixed(5)},${longitude.toFixed(5)}:${building || address}`,
    name: building || address,
    address,
    city: cityFromAddress(address, item.gu_gun),
    category: building ? '장소' : '주소',
    latitude,
    longitude,
    source: 'tmap-address',
  };
}

async function searchTmapPois(query: string, center?: { latitude: number; longitude: number }) {
  const params: Record<string, string> = {
    searchKeyword: query,
    searchType: 'all',
    page: '1',
    count: '15',
    reqCoordType: 'WGS84GEO',
    resCoordType: 'WGS84GEO',
    searchtypCd: center ? 'R' : 'A',
    radius: center ? '20' : '0',
  };
  if (center) {
    params.centerLat = String(center.latitude);
    params.centerLon = String(center.longitude);
  }
  const payload = await tmapGet('/tmap/pois', params);
  const info = payload.searchPoiInfo as { pois?: { poi?: TmapPoi | TmapPoi[] } } | undefined;
  const items = info?.pois?.poi;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  return list.flatMap((item) => {
    const suggestion = toPoiSuggestion(item);
    return suggestion ? [suggestion] : [];
  });
}

async function searchTmapAddress(query: string) {
  const payload = await tmapGet('/tmap/geo/fullAddrGeo', {
    coordType: 'WGS84GEO',
    fullAddr: query,
    addressFlag: 'F00',
  });
  const info = payload.coordinateInfo as { coordinate?: TmapCoordinate | TmapCoordinate[] } & TmapCoordinate | undefined;
  const items = info?.coordinate;
  const list = Array.isArray(items) ? items : items ? [items] : info ? [info] : [];
  return list.flatMap((item) => {
    const suggestion = toAddressSuggestion(item, query);
    return suggestion ? [suggestion] : [];
  });
}

async function searchNominatim(query: string) {
  const url = new URL(`${nominatimBase}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '12');
  url.searchParams.set('countrycodes', 'kr');
  url.searchParams.set('accept-language', 'ko');
  const response = await fetch(url, {
    headers: { 'User-Agent': nominatimAgent, 'Accept-Language': 'ko' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return [];
  const items = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string; name?: string }>;
  return items.flatMap<PlaceSuggestion>((item) => {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const address = item.display_name?.trim() || query;
    return [{
      id: `nominatim:${latitude.toFixed(5)},${longitude.toFixed(5)}`,
      name: item.name?.trim() || address.split(',')[0] || query,
      address,
      city: cityFromAddress(address),
      category: '장소',
      latitude,
      longitude,
      source: 'nominatim',
    }];
  });
}

function dedupe(items: PlaceSuggestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}|${item.latitude.toFixed(4)}|${item.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveCenter(lat?: number, lng?: number) {
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat as number, longitude: lng as number };
  return undefined;
}

export async function searchPlaces(query: string, nearby?: { latitude?: number; longitude?: number }) {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const cacheKey = `${trimmed}|${nearby?.latitude ?? ''}|${nearby?.longitude ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const center = resolveCenter(nearby?.latitude, nearby?.longitude);
  const looksAddress = isAddressQuery(trimmed);
  const results: PlaceSuggestion[] = [];

  if (kakaoConfigured()) {
    const jobs = [searchKakaoKeyword(trimmed, center)];
    if (looksAddress) jobs.push(searchKakaoAddress(trimmed));
    const settled = await Promise.allSettled(jobs);
    for (const job of settled) {
      if (job.status === 'fulfilled') results.push(...job.value);
      else console.warn('[places]', job.reason instanceof Error ? job.reason.message : job.reason);
    }
  }

  if (tmapConfigured()) {
    const jobs = [searchTmapPois(trimmed, center)];
    if (looksAddress) jobs.push(searchTmapAddress(trimmed));
    const settled = await Promise.allSettled(jobs);
    for (const job of settled) {
      if (job.status === 'fulfilled') results.push(...job.value);
      else console.warn('[places]', job.reason instanceof Error ? job.reason.message : job.reason);
    }
  }

  if (!results.length) {
    results.push(...await searchNominatim(trimmed).catch(() => []));
  }

  const ranked = dedupe(results).sort((a, b) => {
    const rank = (item: PlaceSuggestion) => item.source === 'kakao-address' || item.source === 'tmap-address' ? 0 : 1;
    return rank(a) - rank(b);
  }).slice(0, 15);

  cache.set(cacheKey, { value: ranked, expiresAt: Date.now() + CACHE_TTL_MS });
  return ranked;
}
