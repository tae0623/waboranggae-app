import { Course, Interest, Place, PlaceCategory, TravelPreferences, WalkabilityMetrics } from '../../../src/types/travel';
import { DataProvider } from './provider';

const apiBaseUrl = (process.env.TOUR_API_BASE_URL || 'https://apis.data.go.kr/B551011/KorService2').replace(/\/$/, '');
const serviceKey = (process.env.TOUR_API_KEY || process.env.DATA_GO_KR_KEY || '').trim();
const CACHE_TTL_MS = 30 * 60 * 1_000;

export interface TourApiItem {
  addr1?: string;
  contentid?: string;
  contenttypeid?: string;
  firstimage?: string;
  lDongRegnCd?: string;
  lDongSignguCd?: string;
  mapx?: string;
  mapy?: string;
  name?: string;
  code?: string;
  title?: string;
}

interface Candidate {
  item: TourApiItem;
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  category: PlaceCategory;
  tags: Interest[];
}

interface CacheEntry {
  expiresAt: number;
  value: TourApiItem[];
}

const responseCache = new Map<string, CacheEntry>();

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
  const timeout = setTimeout(() => controller.abort(), 10_000);
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
    const name = item.name || '';
    const normalizedName = normalizeAreaName(name);
    return normalizedName === normalizedTarget || normalizedName.includes(normalizedTarget);
  });
}

async function resolveLegalArea(region: string, city: string) {
  const regions = await requestItems('ldongCode2', {
    numOfRows: '50',
    pageNo: '1',
    lDongListYn: 'N',
  }, 24 * 60 * 60 * 1_000);
  const regionItem = findArea(regions, region);
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

function categoryFor(item: TourApiItem): PlaceCategory {
  switch (contentType(item)) {
    case 14: return 'history';
    case 38: return 'market';
    case 39: return 'food';
    case 15:
    case 25: return 'culture';
    default: return 'nature';
  }
}

function tagsFor(item: TourApiItem): Interest[] {
  switch (contentType(item)) {
    case 14: return ['history', 'photo'];
    case 38: return ['market', 'food'];
    case 39: return ['food'];
    case 15: return ['photo'];
    case 25: return ['nature', 'history'];
    case 28: return ['nature'];
    default: return ['nature', 'photo'];
  }
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
      category: categoryFor(item),
      tags: tagsFor(item),
    }];
  });
}

function radians(value: number) {
  return value * Math.PI / 180;
}

export function distanceKm(a: Pick<Candidate, 'latitude' | 'longitude'>, b: Pick<Candidate, 'latitude' | 'longitude'>) {
  const earthRadiusKm = 6_371;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const sinLatitude = Math.sin(latitudeDelta / 2);
  const sinLongitude = Math.sin(longitudeDelta / 2);
  const h = sinLatitude ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * sinLongitude ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function matchScore(candidate: Candidate, preferences: TravelPreferences) {
  return candidate.tags.filter((tag) => preferences.interests.includes(tag)).length;
}

function makeClusters(candidates: Candidate[], preferences: TravelPreferences) {
  const remaining = [...candidates].sort((a, b) => matchScore(b, preferences) - matchScore(a, preferences));
  const clusters: Candidate[][] = [];

  while (remaining.length >= 3 && clusters.length < 3) {
    const seed = remaining.shift();
    if (!seed) break;
    const nearest = [...remaining]
      .sort((a, b) => distanceKm(seed, a) - distanceKm(seed, b))
      .slice(0, Math.min(3, remaining.length));
    const cluster = [seed, ...nearest];
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

function mapPoints(cluster: Candidate[]) {
  const longitudes = cluster.map((candidate) => candidate.longitude);
  const latitudes = cluster.map((candidate) => candidate.latitude);
  const minX = Math.min(...longitudes);
  const maxX = Math.max(...longitudes);
  const minY = Math.min(...latitudes);
  const maxY = Math.max(...latitudes);
  const xRange = maxX - minX;
  const yRange = maxY - minY;

  return cluster.map((candidate, index) => ({
    x: xRange ? 40 + ((candidate.longitude - minX) / xRange) * 245 : 70 + index * 58,
    y: yRange ? 225 - ((candidate.latitude - minY) / yRange) * 160 : 220 - index * 42,
  }));
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
  const points = mapPoints(cluster);
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
        ? '코스 시작'
        : previousDistance !== undefined && previousDistance <= 1.2
          ? `직선거리 약 ${previousDistance.toFixed(1)}km · 도보 경로 확인`
          : `직선거리 약 ${(previousDistance ?? 0).toFixed(1)}km · 대중교통 경로 확인`,
      description: `한국관광공사 관광정보에 등록된 ${categoryLabel(candidate.category)} 장소예요. 방문 전 운영정보를 확인하세요.`,
      tags: candidate.tags,
      mapPoint: points[placeIndex] ?? { x: 60 + placeIndex * 60, y: 220 - placeIndex * 35 },
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
    convenience: 60,
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
    subtitle: `한국관광공사 관광정보 ${places.length}곳 · 거리와 시간은 좌표 기반 추정`,
    accent: palette.accent,
    softAccent: palette.softAccent,
    durationHours,
    distanceKm: Math.round(totalDistanceKm * 10) / 10,
    walkMinutes,
    transitMinutes,
    metrics,
    places,
    conveniences: [],
  };
}

function tourItemsToCourses(items: TourApiItem[], preferences: TravelPreferences) {
  const candidates = toCandidates(items);
  return makeClusters(candidates, preferences).map((cluster, index) => buildCourse(cluster, preferences, index));
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
        numOfRows: '60',
        pageNo: '1',
        arrange: 'A',
        lDongRegnCd: regionCode,
        lDongSignguCd: cityCode,
      });
      return tourItemsToCourses(items, preferences);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      console.warn(`[waboranggae] TourAPI 요청 실패, 시연 데이터로 전환합니다: ${message}`);
      return [];
    }
  }
}
