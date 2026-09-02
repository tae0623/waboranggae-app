import 'dotenv/config';

const rawKey = (process.env.DATA_GO_KR_KEY || '').trim();
if (!rawKey) throw new Error('DATA_GO_KR_KEY가 설정되지 않았습니다.');

let serviceKey = rawKey;
try {
  serviceKey = decodeURIComponent(rawKey);
} catch {
  // 이미 디코딩된 키는 그대로 사용합니다.
}

const baseUrl = process.env.LOCKER_API_BASE_URL || 'https://apis.data.go.kr/B551982/psl_v2';
const url = new URL(`${baseUrl.replace(/\/$/, '')}/locker_info_v2`);
url.searchParams.set('serviceKey', serviceKey);
url.searchParams.set('pageNo', '1');
url.searchParams.set('numOfRows', '500');
url.searchParams.set('type', 'json');

const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
const contentType = response.headers.get('content-type') || '';
const text = await response.text();
if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);

let payload;
try {
  payload = JSON.parse(text);
} catch {
  throw new Error(`JSON이 아닌 응답입니다 (${contentType}): ${text.slice(0, 300)}`);
}

function collectArrays(value, path = '$', depth = 0) {
  if (depth > 8 || value == null) return [];
  if (Array.isArray(value)) return [{ path, value }];
  if (typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => collectArrays(child, `${path}.${key}`, depth + 1));
}

const arrays = collectArrays(payload);
const rowCollection = arrays.find((entry) => entry.value.some((item) => item && typeof item === 'object'));
const normalizedRows = rowCollection?.value ?? [];
const resultCode = payload?.response?.header?.resultCode ?? payload?.header?.resultCode ?? null;
const resultMessage = payload?.response?.header?.resultMsg ?? payload?.header?.resultMsg ?? null;
const jeonnamRows = normalizedRows.filter((row) => /전라남|전남|전남광주/.test(String(row.ctpvNm ?? row.fcltRoadNmAddr ?? row.fcltLotnoAddr ?? '')));

console.log(JSON.stringify({
  ok: true,
  endpoint: url.origin + url.pathname,
  status: response.status,
  contentType,
  resultCode,
  resultMessage,
  rowCount: normalizedRows.length,
  totalCount: payload?.response?.body?.totalCount ?? payload?.body?.totalCount ?? null,
  rowPath: rowCollection?.path ?? null,
  arrayPaths: arrays.map((entry) => `${entry.path}(${entry.value.length})`),
  sampleFields: normalizedRows[0] ? Object.keys(normalizedRows[0]).slice(0, 30) : [],
  jeonnamCount: jeonnamRows.length,
  jeonnamCities: [...new Set(jeonnamRows.map((row) => row.sggNm).filter(Boolean))].sort(),
}, null, 2));
