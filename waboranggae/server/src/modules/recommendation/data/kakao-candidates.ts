import type { Interest, PlaceCategory, TravelPreferences } from '../../../../../src/types/travel';
import { JEONNAM_CITY_SET } from '../../../../../src/domain/jeonnamCities';
import { distanceKm } from '../../../utils/geo';
import { belongsToCity } from '../local-trip';
import { mealWindowsFor } from '../planner';
import { kakaoRequest } from './kakao';
import { placeNameWithoutCity } from '../../../utils/placeName';

export interface KakaoPlaceDocument {
  id?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  category_name?: string;
  category_group_code?: string;
  x?: string;
  y?: string;
}

export interface KakaoCandidate {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
  tags: Interest[];
  source: 'kakao';
  placeUrl: string;
}

type SearchKind = 'attraction' | 'food';
type SearchPayload = { documents?: KakaoPlaceDocument[]; meta?: { is_end?: boolean } };

/** Search relevance is not a rating, visit count, certification or proof of opening hours. */
export function kakaoCandidate(document: KakaoPlaceDocument, city: string, kind: SearchKind): KakaoCandidate | null {
  const name = document.place_name?.trim();
  const address = document.road_address_name?.trim() || document.address_name?.trim() || '';
  const location = document.address_name?.trim() || address;
  const latitude = Number(document.y), longitude = Number(document.x);
  if (!name || !/^\d{1,30}$/.test(document.id || '') || !JEONNAM_CITY_SET.has(city)
    || !/^(?:전남|전라남도|전남광주통합특별시|광주전남통합특별시)\s/.test(location)
    || !belongsToCity(location, city) || !document.x?.trim() || !document.y?.trim()
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 33 || latitude > 36 || longitude < 124 || longitude > 129) return null;

  const categoryName = document.category_name || '';
  const group = document.category_group_code || '';
  let category: PlaceCategory;
  if (kind === 'food') {
    if (!(group === 'FD6' || categoryName.startsWith('음식점 >'))
      || group === 'CE7' || /카페|커피|제과|베이커리|디저트|술집|주점|호프|(?:^|>\s*)(?:바|와인바|칵테일바)(?:\s*>|\s*$)|유흥/.test(categoryName)) return null;
    category = 'food';
  } else {
    // Some real attractions have no AT4 group code: use the provider's full category too.
    if (['FD6', 'CE7', 'AD5'].includes(group)
      || /음식점|숙박|펜션|호텔|리조트|모텔|민박|캠핑|야영|골프|주차장|여행사|관광안내소/.test(categoryName)) return null;
    if (!['AT4', 'CT1'].includes(group)
      && !/관광|여행|문화유적|문화시설|박물관|미술관|전시관|공원|정원|수목원|자연|해수욕장|해변|산책로|둘레길|시장/.test(categoryName)) return null;
    category = /문화유적|유적|문화재|고궁|고택|사찰|박물관|기념관|향교|서원|민속촌/.test(categoryName) ? 'history'
      : /공원|정원|수목원|자연|해수욕장|해변|산책로|둘레길|도보여행|수목|계곡|생태보존|서식지|저수지|호수|하천|섬|> 산(?:\s|,|$)/.test(categoryName) ? 'nature'
      : /시장/.test(categoryName) ? 'market' : 'culture';
  }
  const tags: Interest[] = category === 'food' ? ['food'] : category === 'nature' ? ['nature', 'photo']
    : category === 'history' ? ['history', 'photo'] : category === 'market' ? ['market', 'food'] : ['photo'];
  return { id: `kakao-${document.id}`, name, address, latitude, longitude, category, tags, source: 'kakao',
    placeUrl: `https://place.map.kakao.com/${document.id}` };
}

/** A bounded search, city text only: never send device location or a private departure address. */
export async function fetchKakaoCandidates(preferences: TravelPreferences): Promise<KakaoCandidate[]> {
  if (!JEONNAM_CITY_SET.has(preferences.city)) return [];
  const kinds: SearchKind[] = ['attraction'];
  if (mealWindowsFor(preferences).length > 0) kinds.push('food');
  const groups = await Promise.all(kinds.map(async kind => {
    const candidates: KakaoCandidate[] = [];
    for (let page = 1; page <= 3; page++) {
      const payload = await kakaoRequest('/v2/local/search/keyword.json', {
        query: `${preferences.city} ${kind === 'food' ? '맛집' : '가볼만한곳'}`,
        sort: 'accuracy', size: '15', page: String(page),
        ...(kind === 'food' ? { category_group_code: 'FD6' } : {}),
      }).catch(() => null) as SearchPayload | null;
      if (!Array.isArray(payload?.documents) || !payload.documents.length) break;
      for (const document of payload.documents) {
        const candidate = kakaoCandidate(document, preferences.city, kind);
        if (candidate) candidates.push(candidate);
      }
      if (payload.meta?.is_end !== false) break;
    }
    return candidates;
  }));
  return mergePlaceCandidates([], groups.flat());
}

type LocatedCandidate = { id: string; name: string; category: PlaceCategory; latitude: number; longitude: number };
const normalizedName = (name: string) => name.normalize('NFKC').replace(/\[(?:백년가게|착한가격업소)\]/g, '')
  .replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();

/** Keep the primary record (and its licensed photo/required-visit ID). Never merge by name alone. */
export function mergePlaceCandidates<T extends LocatedCandidate>(primary: T[], additions: T[], city?: string): T[] {
  const merged: T[] = [];
  for (const candidate of [...primary, ...additions]) {
    const same = merged.some(existing => existing.id === candidate.id || (
      normalizedName(city ? placeNameWithoutCity(existing.name, city) : existing.name)
        === normalizedName(city ? placeNameWithoutCity(candidate.name, city) : candidate.name)
      && (existing.category === candidate.category || !['food', 'cafe', 'station'].includes(existing.category)
        && !['food', 'cafe', 'station'].includes(candidate.category))
      && distanceKm(existing, candidate) <= 0.15
    ));
    if (!same) merged.push(candidate);
  }
  return merged;
}
