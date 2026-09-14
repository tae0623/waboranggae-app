import { JEONNAM_CITIES } from '../../../../src/domain/jeonnamCities';

const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const STAY_BASE = (process.env.DATALAB_DEMAND_STAY_URL || 'https://apis.data.go.kr/B551011/TatsStayngService1').replace(/\/$/, '');
const CONSUME_BASE = (process.env.DATALAB_DEMAND_CONSUME_URL || 'https://apis.data.go.kr/B551011/TatsCnsmrService1').replace(/\/$/, '');
const VISITOR_BASE = (process.env.DATALAB_VISITOR_URL || 'https://apis.data.go.kr/B551011/DataLabService').replace(/\/$/, '');

const JEONNAM_SIGNGU: Record<string, string> = {
  목포: '46110', 여수: '46130', 순천: '46150', 나주: '46170', 광양: '46230',
  담양: '46710', 곡성: '46720', 구례: '46730', 고흥: '46770', 보성: '46780',
  화순: '46790', 장흥: '46800', 강진: '46810', 해남: '46820', 영암: '46830',
  무안: '46840', 함평: '46860', 영광: '46870', 장성: '46880', 완도: '46890',
  진도: '46900', 신안: '46910',
};

export interface CityDemand {
  name: string;
  score: number;
  visitors: number | null;
  source: 'demand' | 'visitors' | 'fallback';
}

function decodedServiceKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function itemArray(payload: unknown): Array<Record<string, unknown>> {
  const root = payload as {
    response?: {
      header?: { resultCode?: string; resultMsg?: string };
      body?: { items?: { item?: Record<string, unknown> | Record<string, unknown>[] } | '' };
    };
    OpenAPI_ServiceResponse?: { cmmMsgHeader?: { returnAuthMsg?: string; errMsg?: string } };
  };
  const denied = root.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (denied?.returnAuthMsg || denied?.errMsg) {
    throw new Error(denied.returnAuthMsg || denied.errMsg || '공공데이터 권한 오류');
  }
  const header = root.response?.header;
  if (header?.resultCode && header.resultCode !== '0000') {
    throw new Error(header.resultMsg || `DataLab 오류 ${header.resultCode}`);
  }
  const item = typeof root.response?.body?.items === 'object' ? root.response.body.items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function requestJson(baseUrl: string, operation: string, params: Record<string, string>) {
  if (!serviceKey) throw new Error('DATA_GO_KR_KEY 미설정');
  const url = new URL(`${baseUrl}/${operation}`);
  Object.entries({
    serviceKey: decodedServiceKey(),
    MobileOS: 'ETC',
    MobileApp: 'WA_BO_RANG_GAE',
    _type: 'json',
    ...params,
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`DataLab 비JSON 응답 HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`DataLab HTTP ${response.status}`);
  return itemArray(payload);
}

function normalizeCity(value: unknown) {
  return String(value || '')
    .replace(/\s/g, '')
    .replace(/전남광주통합특별시|전라남도|전남|광주광역시/, '')
    .replace(/시$|군$|구$/, '');
}

export function cityFromItem(item: Record<string, unknown>) {
  const raw = item.signguNm || item.signguName || item.areaNm || item.areaName || item.signguCode || item.signguCd;
  const name = normalizeCity(raw);
  return JEONNAM_CITIES.find((city) => city === name || name.includes(city)) ?? null;
}

function numericScore(item: Record<string, unknown>) {
  const keys = ['stayngStrngth', 'cnsmrStrngth', 'tatsScore', 'score', 'index', 'touNum', 'visitrCo', 'dmandValue'];
  for (const key of keys) {
    const value = Number(item[key]);
    if (Number.isFinite(value)) return value;
  }
  const fallback = Object.values(item)
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value) && value > 0);
  return fallback ?? 0;
}

function recentMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 2);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function recentDayRange() {
  const end = new Date();
  end.setDate(end.getDate() - 10);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const stamp = (value: Date) => value.toISOString().slice(0, 10).replace(/-/g, '');
  return { startYmd: stamp(start), endYmd: stamp(end) };
}

async function fetchDemandScores() {
  const baseYm = recentMonth();
  const pages = await Promise.allSettled([
    requestJson(STAY_BASE, 'areaBasedList1', { numOfRows: '50', pageNo: '1', baseYm, areaCd: '46' }),
    requestJson(CONSUME_BASE, 'areaBasedList1', { numOfRows: '50', pageNo: '1', baseYm, areaCd: '46' }),
  ]);
  const scores = new Map<string, number[]>();
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue;
    for (const item of page.value) {
      const city = cityFromItem(item);
      if (!city) continue;
      const list = scores.get(city) ?? [];
      list.push(numericScore(item));
      scores.set(city, list);
    }
  }
  return [...scores.entries()].map(([name, values]) => ({
    name,
    score: values.reduce((sum, value) => sum + value, 0) / values.length,
    visitors: null as number | null,
    source: 'demand' as const,
  }));
}

async function fetchVisitorScores() {
  const { startYmd, endYmd } = recentDayRange();
  const items = await requestJson(VISITOR_BASE, 'locgoRegnVisitrDDList', {
    numOfRows: '1000',
    pageNo: '1',
    startYmd,
    endYmd,
  });
  const totals = new Map<string, number>();
  for (const item of items) {
    const city = cityFromItem(item);
    if (!city) continue;
    totals.set(city, (totals.get(city) ?? 0) + numericScore(item));
  }
  return [...totals.entries()].map(([name, visitors]) => ({
    name,
    score: visitors,
    visitors,
    source: 'visitors' as const,
  }));
}

const FALLBACK_ORDER = ['여수', '순천', '목포', '담양', '보성', '해남', '구례', '완도', '나주', '광양'];

export async function rankJeonnamCities(): Promise<CityDemand[]> {
  for (const loader of [fetchDemandScores, fetchVisitorScores]) {
    try {
      const ranked = (await loader())
        .filter((item) => JEONNAM_CITIES.includes(item.name))
        .sort((a, b) => b.score - a.score);
      if (ranked.length) return ranked;
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      console.warn(`[waboranggae] 핫플레이스 지역 순위 조회 실패: ${message}`);
    }
  }
  return FALLBACK_ORDER
    .filter((name) => JEONNAM_CITIES.includes(name))
    .map((name, index) => ({
      name,
      score: 100 - index * 6,
      visitors: null,
      source: 'fallback' as const,
    }));
}

export function signguCodeFor(city: string) {
  return JEONNAM_SIGNGU[city];
}
