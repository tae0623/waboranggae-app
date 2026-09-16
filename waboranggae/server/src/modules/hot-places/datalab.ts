import { JEONNAM_CITIES } from '../../../../src/domain/jeonnamCities';

const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const DEMAND_BASE = 'https://apis.data.go.kr/B551011/AreaTarDemDsService';
function demandBase(configured: string | undefined) {
  const base = configured?.trim().replace(/\/$/, '');
  // Accept older example .env files without continuing to call nonexistent services.
  return !base || /^https?:\/\/apis\.data\.go\.kr\/B551011\/Tats(?:Stayng|Cnsmr)Service1$/.test(base) ? DEMAND_BASE : base;
}
const STAY_BASE = demandBase(process.env.DATALAB_DEMAND_STAY_URL);
const CONSUME_BASE = demandBase(process.env.DATALAB_DEMAND_CONSUME_URL);
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
  baseMonth?: string;
  stayScore?: number;
  spendScore?: number;
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
  if (header?.resultCode && !['0000', '00'].includes(header.resultCode)) {
    throw new Error(header.resultMsg || `DataLab 오류 ${header.resultCode}`);
  }
  const item = typeof root.response?.body?.items === 'object' ? root.response.body.items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

async function requestJson(baseUrl: string, operation: string, params: Record<string, string>, signal?: AbortSignal) {
  if (!serviceKey) throw new Error('DATA_GO_KR_KEY 미설정');
  const url = new URL(`${baseUrl}/${operation}`);
  Object.entries({
    serviceKey: decodedServiceKey(),
    MobileOS: 'ETC',
    MobileApp: 'WA_BO_RANG_GAE',
    _type: 'json',
    ...params,
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
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
  const code = String(item.signguCd ?? item.signguCode ?? '');
  if (code === '0' || item.signguNm === '_') return null; // Province total, not a city.
  const mapped = Object.entries(JEONNAM_SIGNGU).find(([, value]) => value === code)?.[0];
  if (mapped) return mapped;
  const raw = item.signguNm || item.signguName || item.areaNm || item.areaName || item.signguCode || item.signguCd;
  const name = normalizeCity(raw);
  return JEONNAM_CITIES.find((city) => city === name || name.includes(city)) ?? null;
}

function nonNegativeNumber(raw: unknown) {
  if ((typeof raw !== 'string' && typeof raw !== 'number') || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function demandMonths(now = new Date()) {
  // Anchor at day 1, avoiding setMonth() overflow on the 29th–31st.
  const koreaDate = new Date(now.getTime() + 9 * 60 * 60 * 1_000);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(koreaDate.getUTCFullYear(), koreaDate.getUTCMonth() - index - 1, 1));
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function recentDayRange() {
  const end = new Date();
  end.setDate(end.getDate() - 10);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const stamp = (value: Date) => value.toISOString().slice(0, 10).replace(/-/g, '');
  return { startYmd: stamp(start), endYmd: stamp(end) };
}

export function combineDemandScores(stay: Array<Record<string, unknown>>, spend: Array<Record<string, unknown>>, baseMonth: string): CityDemand[] {
  const read = (items: Array<Record<string, unknown>>, prefix: 'tarSjrnDs' | 'tarExpDs', metric: string) => {
    const scores = new Map<string, number>();
    for (const item of items) {
      if (String(item.baseYm) !== baseMonth || String(item[`${prefix}IxCd`]) !== metric) continue;
      const city = cityFromItem(item);
      const score = nonNegativeNumber(item[`${prefix}IxVal`]);
      if (!city || score === null || score > 100) continue;
      scores.set(city, score);
    }
    return scores;
  };
  const stayScores = read(stay, 'tarSjrnDs', '21');
  const spendScores = read(spend, 'tarExpDs', '22');
  return [...stayScores.entries()].flatMap(([name, stayScore]) => {
    const spendScore = spendScores.get(name);
    if (spendScore === undefined) return []; // Do not compare a partial score with a complete one.
    return [{ name, score: (stayScore + spendScore) / 2, stayScore, spendScore,
      visitors: null, source: 'demand' as const, baseMonth }];
  });
}

async function fetchDemandScores() {
  const signal = AbortSignal.timeout(20_000);
  for (const baseYm of demandMonths()) {
    const params = { numOfRows: '500', pageNo: '1', baseYm, areaCd: '46' };
    // Explicit aggregate metric codes are essential: omitted codes return zero rows.
    // A failed request stops the scan; only successful empty months are searched backwards.
    const [stay, spend] = await Promise.all([
      requestJson(STAY_BASE, 'areaTarSjrnDsList', { ...params, tarSjrnDsIxCd: '21' }, signal),
      requestJson(CONSUME_BASE, 'areaTarExpDsList', { ...params, tarExpDsIxCd: '22' }, signal),
    ]);
    const scores = combineDemandScores(stay, spend, baseYm);
    if (scores.length) return scores;
  }
  return [];
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
    const visitors = nonNegativeNumber(item.touNum ?? item.visitrCo);
    if (visitors === null) continue;
    totals.set(city, (totals.get(city) ?? 0) + visitors);
  }
  return [...totals.entries()].map(([name, visitors]) => ({
    name,
    score: visitors,
    visitors,
    source: 'visitors' as const,
  }));
}

const FALLBACK_ORDER = ['여수', '순천', '목포', '담양', '보성', '해남', '구례', '완도', '나주', '광양'];

async function loadRankedCities(): Promise<CityDemand[]> {
  for (const loader of [fetchDemandScores, fetchVisitorScores]) {
    try {
      const ranked = (await loader())
        .filter((item) => JEONNAM_CITIES.includes(item.name))
        .sort((a, b) => b.score - a.score);
      if (ranked.length) return ranked;
    } catch (error) {
      // Network errors can contain request URLs. Never log URLs carrying serviceKey.
      console.warn(`[waboranggae] 핫플레이스 지역 순위 조회 실패 (${error instanceof Error ? error.name : 'Error'}); 대체 정보를 확인합니다.`);
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

let rankCache: { expiresAt: number; value: CityDemand[] } | undefined;
let rankPending: Promise<CityDemand[]> | undefined;
export async function rankJeonnamCities(): Promise<CityDemand[]> {
  if (rankCache && rankCache.expiresAt > Date.now()) return rankCache.value;
  if (rankPending) return rankPending;
  rankPending = loadRankedCities().then((value) => {
    // Monthly rankings need no per-visitor refresh; failures retry after five minutes.
    rankCache = { value, expiresAt: Date.now() + (value[0]?.source === 'fallback' ? 5 * 60_000 : 6 * 60 * 60_000) };
    return value;
  }).finally(() => { rankPending = undefined; });
  return rankPending;
}

export function signguCodeFor(city: string) {
  return JEONNAM_SIGNGU[city];
}
