// 기상청 단기예보 조회서비스: 무료 / 공공누리 제1유형 (출처 표시).
// https://www.data.go.kr/data/15084084/openapi.do
import type { WeatherResult } from '../../../../src/types/weather';
export type { WeatherResult } from '../../../../src/types/weather';
const cache = new Map<string, { expires: number; value: WeatherResult }>();
const pending = new Map<string, Promise<WeatherResult>>();
export function kmaGrid(latitude: number, longitude: number) {
  const rad = Math.PI / 180, re = 6371.00877 / 5;
  const slat1 = 30 * rad, slat2 = 60 * rad;
  const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) /
    Math.log(Math.tan(Math.PI / 4 + slat2 / 2) / Math.tan(Math.PI / 4 + slat1 / 2));
  const sf = Math.pow(Math.tan(Math.PI / 4 + slat1 / 2), sn) * Math.cos(slat1) / sn;
  const ro = re * sf / Math.pow(Math.tan(Math.PI / 4 + 38 * rad / 2), sn);
  const ra = re * sf / Math.pow(Math.tan(Math.PI / 4 + latitude * rad / 2), sn);
  const theta = (longitude - 126) * rad * sn;
  return { nx: Math.floor(ra * Math.sin(theta) + 43.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136.5) };
}
export function kmaBaseTime(now = new Date()) {
  // 정시 관측값 제공 지연을 고려한 40분 여유. 서버 OS 시간대와 무관하게 KST 사용.
  const kst = new Date(now.getTime() + 9 * 3600_000 - 40 * 60_000);
  return { date: kst.toISOString().slice(0, 10).replace(/-/g, ''), time: kst.toISOString().slice(11, 13) + '00' };
}
export function parseObservation(payload: any): WeatherResult {
  if (String(payload?.response?.header?.resultCode) !== '00') return { available: false, source: 'kma', reason: '기상청 응답을 받지 못했습니다. 서비스 활용 신청·승인 상태를 확인해 주세요.' };
  const raw = payload?.response?.body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const number = (category: string) => {
    const value = items.find((item: any) => item.category === category)?.obsrValue;
    return value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  };
  const temperature = number('T1H'), pty = number('PTY');
  if (temperature == null || temperature < -80 || temperature > 65 || pty == null) return { available: false, source: 'kma', reason: '현재 관측 자료가 없습니다. 잠시 후 확인해 주세요.' };
  const conditions: Record<number, string> = { 0: '강수 없음', 1: '비', 2: '비/눈', 3: '눈', 5: '빗방울', 6: '빗방울/눈날림', 7: '눈날림' };
  const date = String(items[0]?.baseDate || ''), time = String(items[0]?.baseTime || '');
  if (!/^\d{8}$/.test(date) || !/^\d{4}$/.test(time)) return { available: false, source: 'kma', reason: '관측 시각을 확인할 수 없습니다.' };
  return { available: true, source: 'kma', observedAt: date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6) + ' ' + time.slice(0, 2) + ':' + time.slice(2) + ' KST',
    temperature, precipitation: number('RN1'), wind: number('WSD'), condition: conditions[pty] || '강수 형태 확인 필요',
    advice: pty !== 0 ? '우산과 미끄럼 방지 신발을 준비하고 실내 일정도 함께 고려하세요.' : temperature >= 30 ? '물과 모자를 준비하고 한낮의 긴 도보 이동은 쉬어 가세요.' : temperature <= 5 ? '따뜻한 겉옷을 준비하세요.' : '출발 전에 최신 예보와 대중교통 운행 상황을 확인하세요.' };
}
export async function currentWeather(latitude: number, longitude: number): Promise<WeatherResult> {
  const key = process.env.DATA_GO_KR_KEY?.trim();
  if (!key) return { available: false, source: 'kma', reason: '기상청 무료 API 연결 준비 중입니다.' };
  const grid = kmaGrid(latitude, longitude), base = kmaBaseTime();
  const cacheKey = [grid.nx, grid.ny, base.date, base.time].join(':');
  const hit = cache.get(cacheKey); if (hit && hit.expires > Date.now()) return hit.value;
  const inflight = pending.get(cacheKey); if (inflight) return inflight;
  const task = (async (): Promise<WeatherResult> => {
    try {
      let decoded = key; try { decoded = decodeURIComponent(key); } catch { /* raw key */ }
      const url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst');
      url.search = new URLSearchParams({ serviceKey: decoded, pageNo: '1', numOfRows: '20', dataType: 'JSON', base_date: base.date, base_time: base.time, nx: String(grid.nx), ny: String(grid.ny) }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const value = response.ok ? parseObservation(await response.json()) : { available: false as const, source: 'kma' as const, reason: '기상청 API 인증·승인 상태를 확인해 주세요.' };
      if (cache.size >= 300) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { expires: Date.now() + (value.available ? 600_000 : 60_000), value });
      return value;
    } catch {
      const value = { available: false as const, source: 'kma' as const, reason: '기상청 연결이 지연되고 있습니다. 잠시 후 확인해 주세요.' };
      cache.set(cacheKey, { expires: Date.now() + 60_000, value });
      return value;
    }
  })().finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, task);
  return task;
}
