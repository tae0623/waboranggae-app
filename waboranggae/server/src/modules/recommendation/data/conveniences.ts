import { ConvenienceSpot } from '../../../../../src/types/travel';
import { distanceKm, formatDistanceLabel, projectMapPoints } from '../../../utils/geo';

const apiBaseUrl = (process.env.LOCKER_API_BASE_URL || 'https://apis.data.go.kr/B551982/psl_v2').replace(/\/$/, '');
const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

type LockerRow = {
  stdgCd?: string;
  stlckId?: string;
  stlckRprsPstnNm?: string;
  stlckDtlPstnNm?: string;
  stlckCnt?: number | string;
  ctpvNm?: string;
  sggNm?: string;
  fcltRoadNmAddr?: string;
  fcltLotnoAddr?: string;
  lat?: number | string;
  lot?: number | string;
  wkdyOperBgngTm?: string;
  wkdyOperEndTm?: string;
};

let cachedRows: { expiresAt: number; rows: LockerRow[] } | null = null;
let pending: Promise<LockerRow[]> | null = null;

function decodedKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function parseRows(payload: any): LockerRow[] {
  const rows = payload?.body?.item
    ?? payload?.response?.body?.items?.item
    ?? payload?.response?.body?.item
    ?? [];
  return Array.isArray(rows) ? rows : rows ? [rows] : [];
}

async function fetchAllLockerRows() {
  if (!serviceKey) return [];
  if (cachedRows && cachedRows.expiresAt > Date.now()) return cachedRows.rows;
  if (pending) return pending;

  pending = (async () => {
    const url = new URL(`${apiBaseUrl}/locker_info_v2`);
    url.searchParams.set('serviceKey', decodedKey());
    url.searchParams.set('pageNo', '1');
    url.searchParams.set('numOfRows', '500');
    url.searchParams.set('type', 'json');
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    const payload = JSON.parse(text);
    const resultCode = payload?.header?.resultCode ?? payload?.response?.header?.resultCode;
    if (resultCode && resultCode !== 'K0' && resultCode !== '00') {
      throw new Error(`${resultCode}: ${payload?.header?.resultMsg ?? payload?.response?.header?.resultMsg ?? 'API 오류'}`);
    }
    const rows = parseRows(payload);
    cachedRows = { rows, expiresAt: Date.now() + CACHE_TTL_MS };
    return rows;
  })().catch((error) => {
    console.warn('[lockers]', error instanceof Error ? error.message : error);
    return [];
  }).finally(() => {
    pending = null;
  });

  return pending;
}

function operatingHours(row: LockerRow) {
  const start = String(row.wkdyOperBgngTm || '').trim();
  const end = String(row.wkdyOperEndTm || '').trim();
  return start && end ? `평일 ${start}~${end}` : '운영시간 현장 확인';
}

/** 공공데이터포털 실데이터 중 해당 시·군 코스 반경 안의 공영 물품보관함만 반환합니다. */
export async function fetchLockersNear(
  city: string,
  center: { latitude: number; longitude: number },
  radiusKm = 5,
): Promise<ConvenienceSpot[]> {
  const rows = await fetchAllLockerRows();
  const matches = rows.flatMap((row, index) => {
    const cityText = `${row.sggNm || ''} ${row.fcltRoadNmAddr || ''} ${row.fcltLotnoAddr || ''}`;
    if (!cityText.includes(city)) return [];
    const latitude = Number(row.lat);
    const longitude = Number(row.lot);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const meters = distanceKm(center, { latitude, longitude }) * 1_000;
    if (meters > radiusKm * 1_000) return [];
    const count = Number(row.stlckCnt);
    const name = String(row.stlckRprsPstnNm || row.stlckDtlPstnNm || `${city} 공영 물품보관함`);
    return [{
      spot: {
        id: `locker-${row.stlckId || row.stdgCd || index}`,
        name,
        type: 'locker' as const,
        distanceLabel: formatDistanceLabel(meters),
        availabilityLabel: `${Number.isFinite(count) ? `설치 ${count}칸 · ` : ''}${operatingHours(row)}`,
        mapPoint: { x: 0, y: 0 },
        latitude,
        longitude,
        source: 'live' as const,
      },
      meters,
    }];
  }).sort((a, b) => a.meters - b.meters).slice(0, 8);

  const projected = projectMapPoints([center, ...matches.map(({ spot }) => spot)]);
  return matches.map(({ spot }, index) => ({
    ...spot,
    mapPoint: projected[index + 1] ?? { x: 60 + index * 40, y: 120 },
  }));
}

export function isLockerApiConfigured() {
  return Boolean(serviceKey);
}
