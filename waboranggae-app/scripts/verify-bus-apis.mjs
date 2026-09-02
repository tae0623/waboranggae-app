import 'dotenv/config';

const rawKey = (process.env.DATA_GO_KR_KEY || '').trim();
if (!rawKey) throw new Error('DATA_GO_KR_KEY가 설정되지 않았습니다.');
let serviceKey = rawKey;
try {
  serviceKey = decodeURIComponent(rawKey);
} catch {
  // 이미 디코딩된 키는 그대로 사용합니다.
}

async function probe(name, baseUrl, operation, params = {}) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/${operation}`);
  const query = { serviceKey, pageNo: '1', numOfRows: '10', _type: 'json', ...params };
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    return { name, ok: false, status: response.status, resultCode: null, resultMessage: 'JSON이 아닌 응답' };
  }
  const header = payload?.response?.header ?? payload?.OpenAPI_ServiceResponse?.cmmMsgHeader ?? {};
  const resultCode = header.resultCode ?? header.returnReasonCode ?? null;
  const resultMessage = header.resultMsg ?? header.errMsg ?? header.returnAuthMsg ?? null;
  return {
    name,
    ok: response.ok && resultCode === '00',
    status: response.status,
    resultCode,
    resultMessage,
    totalCount: payload?.response?.body?.totalCount ?? null,
  };
}

const busStopBase = process.env.BUS_STOP_API_BASE_URL || 'https://apis.data.go.kr/1613000/BusSttnInfoInqireService';
const busRouteBase = process.env.BUS_ROUTE_API_BASE_URL || 'https://apis.data.go.kr/1613000/BusRouteInfoInqireService';
const results = await Promise.all([
  probe('bus-stops', busStopBase, 'getCrdntPrxmtSttnList', { gpsLati: '34.7604', gpsLong: '127.6622' }),
  probe('bus-routes', busRouteBase, 'getCtyCodeList'),
]);

console.log(JSON.stringify({ ok: results.every((result) => result.ok), results }, null, 2));
if (results.some((result) => !result.ok)) process.exitCode = 1;
