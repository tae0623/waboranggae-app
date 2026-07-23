import { distanceKm, formatDistanceLabel } from '../../../utils/geo';

const BUS_API_BASE =
  (process.env.BUS_STOP_API_BASE_URL || 'https://apis.data.go.kr/1613000/BusSttnInfoInqireService').replace(/\/$/, '');
const serviceKey = (process.env.TOUR_API_KEY || process.env.DATA_GO_KR_KEY || process.env.BUS_STOP_API_KEY || '').trim();

export interface BusStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

function decodedKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function asList(payload: unknown): any[] {
  const root = payload as {
    response?: { body?: { items?: { item?: any | any[] } | '' } };
  };
  const item = typeof root.response?.body?.items === 'object' ? root.response.body.items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

/**
 * TAGO 좌표기반 근접정류소 조회 (반경 ~500m)
 * https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList
 */
export async function fetchNearbyBusStops(
  latitude: number,
  longitude: number,
): Promise<BusStop[]> {
  if (!serviceKey) return [];

  const url = new URL(`${BUS_API_BASE}/getCrdntPrxmtSttnList`);
  url.searchParams.set('serviceKey', decodedKey());
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '20');
  url.searchParams.set('_type', 'json');
  url.searchParams.set('gpsLati', String(latitude));
  url.searchParams.set('gpsLong', String(longitude));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = asList(await response.json());
    return items
      .map((item) => {
        const lat = Number(item.gpslati ?? item.gpsLati ?? item.latitude);
        const lon = Number(item.gpslong ?? item.gpsLong ?? item.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const meters = distanceKm({ latitude, longitude }, { latitude: lat, longitude: lon }) * 1000;
        return {
          id: String(item.nodeid ?? item.nodeId ?? `${lat}-${lon}`),
          name: String(item.nodenm ?? item.nodeNm ?? '버스정류장'),
          latitude: lat,
          longitude: lon,
          distanceMeters: meters,
        } satisfies BusStop;
      })
      .filter((item): item is BusStop => Boolean(item))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  } catch (error) {
    console.warn('[bus-stops]', error instanceof Error ? error.message : error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function nearestBusStopDistanceMeters(
  latitude: number,
  longitude: number,
): Promise<{ meters: number | null; stop: BusStop | null }> {
  const stops = await fetchNearbyBusStops(latitude, longitude);
  const nearest = stops[0] ?? null;
  return {
    meters: nearest ? nearest.distanceMeters : null,
    stop: nearest,
  };
}

export function describeBusAccess(meters: number | null): string {
  if (meters == null) return '정류장 정보 확인 중';
  return `버스정류장 ${formatDistanceLabel(meters)}`;
}
