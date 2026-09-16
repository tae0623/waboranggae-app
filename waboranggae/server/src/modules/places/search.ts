import { kakaoRequest, kakaoStatus } from '../recommendation/data/kakao';
import { JEONNAM_CITIES } from '../../../../src/domain/jeonnamCities';

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
  source: 'kakao' | 'kakao-address' | 'nominatim' | 'tour-api';
}

export function isAddressQuery(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 4) return false;
  return ADDRESS_HINT.test(trimmed) || /\d{1,4}(?:번지|호)?$/.test(trimmed);
}

export function cityFromAddress(address: string, fallback?: string) {
  const haystack = `${fallback ?? ''} ${address}`;
  // A province/metro prefix must not hide the actual destination city.
  const local=JEONNAM_CITIES.find(city=>new RegExp(`(?:^|\\s)${city}(?:시|군)?(?=\\s|$)`).test(haystack));
  if(local)return local;
  const match = haystack.match(/([가-힣]{1,6}(?:특별시|광역시|특별자치시|시|군))/);
  return match?.[1]?.replace(/특별시$|광역시$|특별자치시$|시$|군$/, '') || fallback?.replace(/시$|군$/, '');
}

function kakaoConfigured() {
  return kakaoStatus().restKeyConfigured && kakaoStatus().freeTierConfirmed;
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

export class PlaceSearchUnavailable extends Error {}

async function kakaoGet(path: string, params: Record<string, string>) {
  const payload=await kakaoRequest(path, params);
  if(!payload)throw new PlaceSearchUnavailable('PLACE_SEARCH_UNAVAILABLE');
  return payload as { documents?: unknown };
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

async function searchKakaoKeyword(query: string) {
  const params: Record<string, string> = { query, size: '15', page: '1' };
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

function dedupe(items: PlaceSuggestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}|${item.latitude.toFixed(4)}|${item.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchPlaces(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  // Current device location is never accepted by this search service.
  for (const [key,item] of cache) if(item.expiresAt<=Date.now()) cache.delete(key);
  const cacheKey = trimmed;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const looksAddress = isAddressQuery(trimmed);
  const results: PlaceSuggestion[] = [];

  if (kakaoConfigured()) {
    const jobs = [searchKakaoKeyword(trimmed)];
    if (looksAddress) jobs.push(searchKakaoAddress(trimmed));
    const settled = await Promise.allSettled(jobs);
    for (const job of settled) {
      if (job.status === 'fulfilled') results.push(...job.value);
      else console.warn('[places]', job.reason instanceof Error ? job.reason.message : job.reason);
    }
    if(!results.length && settled.some(job=>job.status==='rejected'))throw new PlaceSearchUnavailable('PLACE_SEARCH_UNAVAILABLE');
  } else {
    throw new PlaceSearchUnavailable('PLACE_SEARCH_UNAVAILABLE');
  }


  // 공개 Nominatim을 입력 자동완성의 폴백으로 호출하지 않습니다.

  const ranked = dedupe(results).sort((a,b) =>
    Number(b.source==='kakao-address')-Number(a.source==='kakao-address')).slice(0,15);

  if (cache.size > 500) cache.clear();
  if (ranked.length) cache.set(cacheKey, { value: ranked, expiresAt: Date.now() + CACHE_TTL_MS });
  return ranked;
}
