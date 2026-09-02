import { Course, Interest, Place, PlaceCategory, TravelPreferences, WalkabilityMetrics } from '../../../../../src/types/travel';
import { distanceKm as haversineKm, projectMapPoints } from '../../../utils/geo';
import { DataProvider } from './provider';
import { desiredStopCount } from '../planner';

const apiBaseUrl = (process.env.TOUR_API_BASE_URL || 'https://apis.data.go.kr/B551011/KorService2').replace(/\/$/, '');
// apis.data.go.kr 계열은 API 종류와 관계없이 공통 공공데이터포털 키만 사용합니다.
const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const CACHE_TTL_MS = 30 * 60 * 1_000;

export interface TourApiItem {
  addr1?: string;
  contentid?: string;
  contenttypeid?: string;
  firstimage?: string;
  firstimage2?: string;
  lDongRegnCd?: string;
  lDongRegnNm?: string;
  lDongSignguCd?: string;
  lDongSignguNm?: string;
  mapx?: string;
  mapy?: string;
  name?: string;
  code?: string;
  title?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
}

interface Candidate {
  item: TourApiItem;
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  category: PlaceCategory;
  tags: Interest[];
  imageUrl?: string;
}

interface CacheEntry {
  expiresAt: number;
  value: TourApiItem[];
}

const responseCache = new Map<string, CacheEntry>();

export const JEONNAM_CITIES = [
  '목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성',
  '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안',
];

function decodedServiceKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function asItems(payload: unknown): TourApiItem[] {
  const root = payload as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: { items?: { item?: TourApiItem | TourApiItem[] } | '' };
    };
  };
  const header = root.response?.header;
  if (header?.resultCode && header.resultCode !== '0000') {
    throw new Error(header.resultMsg || `TourAPI 오류 ${header.resultCode}`);
  }
  const item = typeof root.response?.body?.items === 'object'
    ? root.response.body.items.item
    : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function requestItems(operation: string, params: Record<string, string>, ttlMs = CACHE_TTL_MS) {
  const cacheKey = `${operation}:${JSON.stringify(params)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(`${apiBaseUrl}/${operation}`);
  const commonParams = {
    MobileOS: 'ETC',
    MobileApp: 'WA_BO_RANG_GAE',
    _type: 'json',
    serviceKey: decodedServiceKey(),
    ...params,
  };
  Object.entries(commonParams).forEach(([key, value]) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = asItems(await response.json());
    responseCache.set(cacheKey, { value: items, expiresAt: Date.now() + ttlMs });
    return items;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAreaName(value: string) {
  return value
    .replace(/\s/g, '')
    .replace(/특별자치도|특별자치시|광역시|도|시|군|구/g, '');
}

function findArea(items: TourApiItem[], target: string) {
  const normalizedTarget = normalizeAreaName(target);
  return items.find((item) => {
    const name = item.name || item.lDongRegnNm || item.lDongSignguNm || '';
    const normalizedName = normalizeAreaName(name);
    return normalizedName === normalizedTarget || normalizedName.includes(normalizedTarget);
  });
}

function isJeonnamRequest(value: string) {
  const compact = value.replace(/\s/g, '');
  return compact === '전남' || compact.startsWith('전라남');
}

/**
 * 2026-07-01부터 광주광역시와 전라남도 법정동 코드가
 * 전남광주통합특별시(12)로 통합되었다. 앱의 전남 요청은 새 코드를 사용한다.
 */
export function findRequestedTourRegion(items: TourApiItem[], requestedRegion: string) {
  const direct = findArea(items, requestedRegion);
  if (direct) return direct;
  if (!isJeonnamRequest(requestedRegion)) return undefined;

  return items.find((item) => {
    const name = (item.name || item.lDongRegnNm || '').replace(/\s/g, '');
    return name.includes('전남광주통합') || name.includes('광주전남통합');
  }) || findArea(items, '전남');
}

export function filterJeonnamCityItems(items: TourApiItem[]) {
  const allowed = new Set(JEONNAM_CITIES);
  return items
    .map((item) => ({
      name: (item.name || item.lDongSignguNm || '').replace(/시$|군$|구$/, ''),
      code: item.code || item.lDongSignguCd || '',
    }))
    .filter((item) => allowed.has(item.name) && item.code);
}

export async function listJeonnamCities(): Promise<Array<{ name: string; code: string }>> {
  if (!serviceKey) {
    return JEONNAM_CITIES.map((name) => ({ name, code: name }));
  }
  try {
    const regions = await requestItems('ldongCode2', {
      numOfRows: '50',
      pageNo: '1',
      lDongListYn: 'N',
    }, 24 * 60 * 60 * 1_000);
    const regionItem = findRequestedTourRegion(regions, '전라남도');
    const regionCode = regionItem?.code || regionItem?.lDongRegnCd;
    if (!regionCode) return JEONNAM_CITIES.map((name) => ({ name, code: name }));

    const cities = await requestItems('ldongCode2', {
      numOfRows: '100',
      pageNo: '1',
      lDongListYn: 'N',
      lDongRegnCd: regionCode,
    }, 24 * 60 * 60 * 1_000);

    const mapped = filterJeonnamCityItems(cities);

    return mapped.length ? mapped : JEONNAM_CITIES.map((name) => ({ name, code: name }));
  } catch {
    return JEONNAM_CITIES.map((name) => ({ name, code: name }));
  }
}

async function resolveLegalArea(region: string, city: string) {
  const regions = await requestItems('ldongCode2', {
    numOfRows: '50',
    pageNo: '1',
    lDongListYn: 'N',
  }, 24 * 60 * 60 * 1_000);
  const regionItem = findRequestedTourRegion(regions, region);
  const regionCode = regionItem?.code || regionItem?.lDongRegnCd;
  if (!regionCode) throw new Error(`${region} 법정동 코드를 찾지 못했습니다.`);

  const cities = await requestItems('ldongCode2', {
    numOfRows: '100',
    pageNo: '1',
    lDongListYn: 'N',
    lDongRegnCd: regionCode,
  }, 24 * 60 * 60 * 1_000);
  const cityItem = findArea(cities, city);
  const cityCode = cityItem?.code || cityItem?.lDongSignguCd;
  if (!cityCode) throw new Error(`${city} 법정동 코드를 찾지 못했습니다.`);

  return { regionCode, cityCode };
}

function contentType(item: TourApiItem): number {
  return Number(item.contenttypeid || 0);
}

const CAFE_NAME_PATTERN = /카페|커피|베이커리|디저트|다방|로스터리|로스팅|브런치|티룸|찻집|제과|빵집|브루웍스|브루어리|커피공방|커피하우스/i;

export function classifyTourItemCategory(item: TourApiItem): PlaceCategory {
  switch (contentType(item)) {
    case 14: return 'history';
    case 38: return 'market';
    case 39: return CAFE_NAME_PATTERN.test(item.title || '') ? 'cafe' : 'food';
    case 15:
    case 25: return 'culture';
    default: return 'nature';
  }
}

export function classifyTourItemTags(item: TourApiItem): Interest[] {
  switch (contentType(item)) {
    case 14: return ['history', 'photo'];
    case 38: return ['market', 'food'];
    case 39: return classifyTourItemCategory(item) === 'cafe' ? ['cafe', 'food'] : ['food'];
    case 15: return ['photo'];
    case 25: return ['nature', 'history'];
    case 28: return ['nature'];
    default: return ['nature', 'photo'];
  }
}

function interestToContentTypes(interests: Interest[]): number[] {
  const types = new Set<number>();
  for (const interest of interests) {
    if (interest === 'nature') [12, 28].forEach((t) => types.add(t));
    if (interest === 'history') [14, 25].forEach((t) => types.add(t));
    if (interest === 'food') types.add(39);
    if (interest === 'market') types.add(38);
    if (interest === 'photo') [12, 14, 15].forEach((t) => types.add(t));
    if (interest === 'cafe') types.add(39);
  }
  if (!types.size) [12, 14, 38, 39].forEach((t) => types.add(t));
  return [...types];
}

function contentTypesFor(preferences: TravelPreferences) {
  const types = new Set(interestToContentTypes(preferences.interests));
  // 식사 후보는 관심사와 별개로 필요합니다. 최종 포함 여부와 시간은 planner가 검증합니다.
  if (preferences.mealPreference !== 'none') types.add(39);
  return [...types];
}

/** 원본 URL은 서버 이미지 프록시가 가져오므로 프로토콜을 임의로 바꾸지 않습니다. */
export function normalizeTourImageUrl(value?: string) {
  const url = value?.trim();
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function toCandidates(items: TourApiItem[]) {
  const supportedTypes = new Set([12, 14, 15, 25, 28, 38, 39]);
  return items.flatMap<Candidate>((item) => {
    const longitude = Number(item.mapx);
    const latitude = Number(item.mapy);
    const name = item.title?.trim();
    if (!name || !Number.isFinite(longitude) || !Number.isFinite(latitude) || !supportedTypes.has(contentType(item))) {
      return [];
    }
    return [{
      item,
      id: item.contentid || `${longitude}-${latitude}`,
      name,
      longitude,
      latitude,
      category: classifyTourItemCategory(item),
      tags: classifyTourItemTags(item),
      imageUrl: normalizeTourImageUrl(item.firstimage || item.firstimage2),
    }];
  });
}

export function distanceKm(a: Pick<Candidate, 'latitude' | 'longitude'>, b: Pick<Candidate, 'latitude' | 'longitude'>) {
  return haversineKm(a, b);
}

function matchScore(candidate: Candidate, preferences: TravelPreferences) {
  let score = candidate.tags.filter((tag) => preferences.interests.includes(tag)).length;
  if (preferences.preferLocal && (candidate.category === 'market' || candidate.category === 'food' || candidate.category === 'cafe')) {
    score += 1.5;
  }
  return score;
}

async function fetchNearbyLinked(
  seed: Candidate,
  preferences: TravelPreferences,
): Promise<Candidate[]> {
  const contentTypes = contentTypesFor(preferences);
  const radius = preferences.pace === 'easy' || preferences.lowMobility ? '3000' : preferences.pace === 'full' ? '7000' : '5000';
  const pages = await Promise.all([
    // 관심사 분류가 부족한 지역에서도 긴 코스를 채울 수 있도록 주변 일반 관광지를 함께 조회합니다.
    requestItems('locationBasedList2', {
      numOfRows: '40',
      pageNo: '1',
      mapX: String(seed.longitude),
      mapY: String(seed.latitude),
      radius,
      arrange: 'E',
    }).catch(() => [] as TourApiItem[]),
    ...contentTypes.slice(0, 4).map((contentTypeId) =>
      requestItems('locationBasedList2', {
        numOfRows: '20',
        pageNo: '1',
        mapX: String(seed.longitude),
        mapY: String(seed.latitude),
        radius,
        arrange: 'E',
        contentTypeId: String(contentTypeId),
      }).catch(() => [] as TourApiItem[]),
    ),
  ]);
  const merged = toCandidates(pages.flat());
  const unique = new Map<string, Candidate>();
  for (const candidate of merged) {
    if (candidate.id === seed.id) continue;
    if (!unique.has(candidate.id)) unique.set(candidate.id, candidate);
  }
  return [...unique.values()]
    .sort((a, b) => distanceKm(seed, a) - distanceKm(seed, b))
    .slice(0, 6);
}

async function makeClusters(candidates: Candidate[], preferences: TravelPreferences) {
  const remaining = [...candidates].sort((a, b) => matchScore(b, preferences) - matchScore(a, preferences));
  const clusters: Candidate[][] = [];
  const targetSize = desiredStopCount(preferences.durationHours);

  while (remaining.length >= 1 && clusters.length < 3) {
    const seed = remaining.shift();
    if (!seed) break;

    const nearbyById = new Map(
      (await fetchNearbyLinked(seed, preferences)).map((candidate) => [candidate.id, candidate]),
    );
    if (nearbyById.size < targetSize - 1) {
      for (const candidate of [...remaining].sort((a, b) => distanceKm(seed, a) - distanceKm(seed, b))) {
        if (nearbyById.size >= targetSize - 1) break;
        if (candidate.id !== seed.id && !nearbyById.has(candidate.id)) nearbyById.set(candidate.id, candidate);
      }
    }

    const cluster = [seed, ...[...nearbyById.values()].slice(0, targetSize - 1)];
    clusters.push(cluster);
    const used = new Set(cluster.map((candidate) => candidate.id));
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index];
      if (candidate && used.has(candidate.id)) remaining.splice(index, 1);
    }
  }

  if (!clusters.length && candidates.length) clusters.push(candidates.slice(0, 4));
  return clusters;
}

function categoryLabel(category: PlaceCategory) {
  const labels: Record<PlaceCategory, string> = {
    station: '교통거점',
    nature: '자연 관광',
    food: '음식',
    cafe: '카페',
    market: '시장·쇼핑',
    history: '역사·문화',
    culture: '문화 관광',
  };
  return labels[category];
}

function stayMinutes(category: PlaceCategory) {
  if (category === 'food') return 60;
  if (category === 'market' || category === 'cafe') return 50;
  return 70;
}

function formatTime(minutesFromMidnight: number) {
  const rounded = Math.round(minutesFromMidnight);
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function routeDistances(cluster: Candidate[]) {
  return cluster.slice(1).map((candidate, index) => distanceKm(cluster[index] ?? candidate, candidate));
}

function buildCourse(cluster: Candidate[], preferences: TravelPreferences, index: number): Course {
  const distances = routeDistances(cluster);
  const totalDistanceKm = distances.reduce((sum, distance) => sum + distance, 0);
  const walkingDistanceKm = distances.filter((distance) => distance <= 1.2).reduce((sum, distance) => sum + distance, 0);
  const transitSegments = distances.filter((distance) => distance > 1.2);
  const walkMinutes = Math.round(walkingDistanceKm / 4.2 * 60);
  const transitMinutes = Math.round(transitSegments.reduce((sum, distance) => sum + distance / 18 * 60 + 8, 0));
  const projected = projectMapPoints(cluster);
  let clock = 10 * 60;

  const places: Place[] = cluster.map((candidate, placeIndex) => {
    const previousDistance = distances[placeIndex - 1];
    if (placeIndex > 0 && previousDistance !== undefined) {
      clock += previousDistance <= 1.2
        ? previousDistance / 4.2 * 60
        : previousDistance / 18 * 60 + 8;
    }
    const arrival = formatTime(clock);
    const stay = stayMinutes(candidate.category);
    clock += stay;

    return {
      id: `tour-${candidate.id}`,
      name: candidate.name,
      category: candidate.category,
      address: candidate.item.addr1 || `${preferences.city} · 상세 주소 확인`,
      stayMinutes: stay,
      arrival,
      moveLabel: placeIndex === 0
        ? `${preferences.startLocation}에서 시작`
        : previousDistance !== undefined && previousDistance <= 1.2
          ? `직선거리 약 ${previousDistance.toFixed(1)}km · 도보 권장`
          : `직선거리 약 ${(previousDistance ?? 0).toFixed(1)}km · 대중교통 권장`,
      description: `한국관광공사 관광정보에 등록된 ${categoryLabel(candidate.category)} 장소예요.`,
      tags: candidate.tags,
      mapPoint: projected[placeIndex] ?? { x: 60 + placeIndex * 60, y: 220 - placeIndex * 35 },
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      imageUrl: candidate.imageUrl,
    };
  });

  const matched = Array.from(new Set(cluster.flatMap((candidate) => candidate.tags)))
    .filter((tag) => preferences.interests.includes(tag));
  const interestLabels: Record<Interest, string> = {
    nature: '자연', food: '미식', cafe: '카페', photo: '사진', market: '시장', history: '역사',
  };
  const theme = matched.slice(0, 2).map((tag) => interestLabels[tag]).join('·') || '관광';
  const durationHours = Math.max(2, Math.min(12, Math.round((clock - 10 * 60) / 6) / 10));
  const maxSegment = distances.length ? Math.max(...distances) : 0;
  const metrics: WalkabilityMetrics = {
    transitAccess: Math.round(Math.max(55, 88 - maxSegment * 2)),
    walkingEase: Math.round(Math.max(45, 96 - walkingDistanceKm * 12)),
    nearbyLinks: Math.round(Math.max(55, 95 - totalDistanceKm * 2)),
  };
  const palettes = [
    { accent: '#0D5C45', softAccent: '#DDF3A7' },
    { accent: '#347D91', softAccent: '#C9E8E8' },
    { accent: '#7A5A3A', softAccent: '#F0D7B3' },
  ];
  const palette = palettes[index % palettes.length] ?? palettes[0]!;

  return {
    id: `tour-${preferences.city}-${index + 1}-${cluster.map((candidate) => candidate.id).join('-')}`,
    city: preferences.city,
    title: `${preferences.city} ${theme} 뚜벅이 코스 ${index + 1}`,
    subtitle: `한국관광공사 기반 · ${places.length}곳 연계 · 좌표 기반 동선`,
    accent: palette.accent,
    softAccent: palette.softAccent,
    durationHours,
    distanceKm: Math.round(totalDistanceKm * 10) / 10,
    walkMinutes,
    transitMinutes,
    metrics,
    places,
  };
}

export class TourApiProvider implements DataProvider {
  name = 'tour-api';

  isConfigured() {
    return Boolean(serviceKey);
  }

  async fetchCourses(preferences: TravelPreferences): Promise<Course[]> {
    if (!this.isConfigured()) return [];

    try {
      const { regionCode, cityCode } = await resolveLegalArea(preferences.region, preferences.city);
      const items = await requestItems('areaBasedList2', {
        numOfRows: '80',
        pageNo: '1',
        arrange: 'A',
        lDongRegnCd: regionCode,
        lDongSignguCd: cityCode,
      });
      const candidates = toCandidates(items)
        .filter((candidate) => {
          if (!preferences.interests.length) return true;
          if (preferences.mealPreference !== 'none' && candidate.category === 'food') return true;
          return candidate.tags.some((tag) => preferences.interests.includes(tag))
            || matchScore(candidate, preferences) > 0;
        });
      const pool = candidates.length >= 3 ? candidates : toCandidates(items);
      const clusters = await makeClusters(pool, preferences);
      return clusters.map((cluster, index) => buildCourse(cluster, preferences, index));
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      console.warn(`[waboranggae] TourAPI 요청 실패, 시연 데이터로 전환합니다: ${message}`);
      return [];
    }
  }
}
