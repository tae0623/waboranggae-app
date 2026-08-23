import { ConvenienceSpot } from '../../../../../src/types/travel';
import { distanceKm, formatDistanceLabel, projectMapPoints } from '../../../utils/geo';

const LOCKER_API_BASE = (process.env.LOCKER_API_BASE_URL || 'https://apis.data.go.kr/B551982/psl_v2').replace(/\/$/, '');
const BIKE_API_BASE = (process.env.BIKE_API_BASE_URL || 'https://apis.data.go.kr/B551982/pbdo_v2').replace(/\/$/, '');
const lockerServiceKey = (process.env.LOCKER_API_KEY || '').trim();
const bikeServiceKey = (process.env.BIKE_API_KEY || '').trim();

// 전남 주요 시군 법정동 코드 (시군 단위, 끝자리 0)
const JEONNAM_STDG: Record<string, string> = {
  순천: '4615000000',
  여수: '4613000000',
  목포: '4611000000',
  광양: '4623000000',
  나주: '4617000000',
  담양: '4671000000',
  보성: '4678000000',
  해남: '4682000000',
  강진: '4681000000',
  고흥: '4677000000',
  곡성: '4672000000',
  구례: '4673000000',
  무안: '4684000000',
  영광: '4687000000',
  영암: '4683000000',
  완도: '4689000000',
  장성: '4688000000',
  장흥: '4680000000',
  진도: '4690000000',
  함평: '4686000000',
  화순: '4679000000',
  신안: '4691000000',
};

function decodedKey(serviceKey: string) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function asRows(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  const root = payload as any;
  const candidates = [
    root?.response?.body?.items?.item,
    root?.response?.body?.item,
    root?.body?.items?.item,
    root?.data,
    root?.items,
  ];
  for (const value of candidates) {
    if (!value) continue;
    return Array.isArray(value) ? value : [value];
  }
  return [];
}

async function fetchJson(url: URL): Promise<any[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return asRows(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

function pickCoord(row: any): { latitude: number; longitude: number } | null {
  const latitude = Number(row.lat ?? row.latitude ?? row.ycrd ?? row.ycord ?? row.gpsLati ?? row.GPSY);
  const longitude = Number(row.lot ?? row.longitude ?? row.xcrd ?? row.xcord ?? row.gpsLong ?? row.GPSX);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function pickName(row: any, fallback: string) {
  return String(
    row.lockerNm
    ?? row.fcltNm
    ?? row.rntlHldyNm
    ?? row.stationName
    ?? row.name
    ?? fallback,
  );
}

/**
 * 행정안전부 공영 물품보관함 정보
 * GET /locker_info_v2?stdgCd=...
 */
export async function fetchLockersNear(
  city: string,
  center: { latitude: number; longitude: number },
  radiusKm = 3,
): Promise<ConvenienceSpot[]> {
  if (!lockerServiceKey) return demoLockers(city, center);

  const stdgCd = JEONNAM_STDG[city];
  const url = new URL(`${LOCKER_API_BASE}/locker_info_v2`);
  url.searchParams.set('serviceKey', decodedKey(lockerServiceKey));
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '50');
  url.searchParams.set('type', 'json');
  if (stdgCd) url.searchParams.set('stdgCd', stdgCd);

  try {
    const rows = await fetchJson(url);
    const spots = rows
      .map<ConvenienceSpot | null>((row, index) => {
        const coord = pickCoord(row);
        if (!coord) return null;
        const meters = distanceKm(center, coord) * 1000;
        if (meters > radiusKm * 1000) return null;
        const remaining = Number(row.remainCnt ?? row.avblCnt ?? row.emptyCnt);
        return {
          id: `locker-live-${row.lockerId ?? row.fcltId ?? index}`,
          name: pickName(row, `${city} 공영 물품보관함`),
          type: 'locker' as const,
          distanceLabel: formatDistanceLabel(meters),
          availabilityLabel: Number.isFinite(remaining)
            ? `잔여 ${remaining}칸`
            : '잔여 정보 확인',
          mapPoint: { x: 0, y: 0 },
          latitude: coord.latitude,
          longitude: coord.longitude,
          source: 'live' as const,
          remaining: Number.isFinite(remaining) ? remaining : null,
        };
      })
      .filter((item): item is ConvenienceSpot => item !== null)
      .sort((a, b) => parseFloat(a.distanceLabel) - parseFloat(b.distanceLabel))
      .slice(0, 8);

    return spots.length ? withProjectedPoints(spots, center) : demoLockers(city, center);
  } catch (error) {
    console.warn('[lockers]', error instanceof Error ? error.message : error);
    return demoLockers(city, center);
  }
}

/**
 * 전국 공영자전거 대여소 정보
 * GET /inf_101_00010001_v2
 */
export async function fetchBikesNear(
  city: string,
  center: { latitude: number; longitude: number },
  radiusKm = 3,
): Promise<ConvenienceSpot[]> {
  if (!bikeServiceKey) return demoBikes(city, center);

  const url = new URL(`${BIKE_API_BASE}/inf_101_00010001_v2`);
  url.searchParams.set('serviceKey', decodedKey(bikeServiceKey));
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '50');
  url.searchParams.set('type', 'json');

  try {
    const rows = await fetchJson(url);
    const spots = rows
      .map<ConvenienceSpot | null>((row, index) => {
        const coord = pickCoord(row);
        if (!coord) return null;
        const regionText = String(row.ctpvNm ?? row.sggNm ?? row.addr ?? '');
        if (regionText && !regionText.includes(city) && !regionText.includes('전남') && !regionText.includes('전라남')) {
          // keep if within radius even if name mismatch
        }
        const meters = distanceKm(center, coord) * 1000;
        if (meters > radiusKm * 1000) return null;
        const available = Number(row.parkingBikeTotCnt ?? row.avblBikeCnt ?? row.bikeCnt);
        return {
          id: `bike-live-${row.stationId ?? row.rntlHldyId ?? index}`,
          name: pickName(row, `${city} 공영자전거 대여소`),
          type: 'bike' as const,
          distanceLabel: formatDistanceLabel(meters),
          availabilityLabel: Number.isFinite(available)
            ? `대여 가능 ${available}대`
            : '대여 현황 확인',
          mapPoint: { x: 0, y: 0 },
          latitude: coord.latitude,
          longitude: coord.longitude,
          source: 'live' as const,
          remaining: Number.isFinite(available) ? available : null,
        };
      })
      .filter((item): item is ConvenienceSpot => item !== null)
      .sort((a, b) => (b.remaining ?? 0) - (a.remaining ?? 0))
      .slice(0, 8);

    return spots.length ? withProjectedPoints(spots, center) : demoBikes(city, center);
  } catch (error) {
    console.warn('[bikes]', error instanceof Error ? error.message : error);
    return demoBikes(city, center);
  }
}

function withProjectedPoints(spots: ConvenienceSpot[], center: { latitude: number; longitude: number }) {
  const coords = spots.map((spot) => ({
    latitude: spot.latitude ?? center.latitude,
    longitude: spot.longitude ?? center.longitude,
  }));
  const projected = projectMapPoints([center, ...coords]);
  return spots.map((spot, index) => ({
    ...spot,
    mapPoint: projected[index + 1] ?? { x: 60 + index * 40, y: 120 },
  }));
}

function demoLockers(city: string, center: { latitude: number; longitude: number }): ConvenienceSpot[] {
  return withProjectedPoints(
    [
      {
        id: `locker-demo-${city}`,
        name: `${city} 교통거점 물품보관함`,
        type: 'locker',
        distanceLabel: '120m',
        availabilityLabel: '여유 · 데모',
        mapPoint: { x: 0, y: 0 },
        latitude: center.latitude + 0.001,
        longitude: center.longitude - 0.001,
        source: 'demo',
        remaining: 8,
      },
    ],
    center,
  );
}

function demoBikes(city: string, center: { latitude: number; longitude: number }): ConvenienceSpot[] {
  // 공영자전거는 지역별 선택 적용 — 데모는 여수/순천만
  if (!['여수', '순천', '목포'].includes(city)) return [];
  return withProjectedPoints(
    [
      {
        id: `bike-demo-${city}`,
        name: `${city} 공영자전거 대여소`,
        type: 'bike',
        distanceLabel: '200m',
        availabilityLabel: '대여 가능 · 데모',
        mapPoint: { x: 0, y: 0 },
        latitude: center.latitude - 0.0012,
        longitude: center.longitude + 0.0008,
        source: 'demo',
        remaining: 5,
      },
    ],
    center,
  );
}

export async function fetchConveniencesAround(
  city: string,
  center: { latitude: number; longitude: number },
): Promise<ConvenienceSpot[]> {
  const [lockers, bikes] = await Promise.all([
    fetchLockersNear(city, center),
    fetchBikesNear(city, center),
  ]);
  return [...lockers, ...bikes];
}
