import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const JEONNAM_CITIES = new Set(
  JSON.parse(
    await readFile(join(dirname(fileURLToPath(import.meta.url)), '../src/domain/jeonnamCities.json'), 'utf8'),
  ),
);

async function readLocalEnv() {
  try {
    const text = await readFile(new URL('../.env', import.meta.url), 'utf8');
    return Object.fromEntries(text
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, '')];
      }));
  } catch {
    return {};
  }
}

function decodeServiceKey(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function itemArray(items) {
  if (!items || typeof items !== 'object' || !items.item) return [];
  return Array.isArray(items.item) ? items.item : [items.item];
}

async function request(baseUrl, serviceKey, operation, params) {
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/${operation}`);
  const allParams = {
    MobileOS: 'ETC',
    MobileApp: 'WA_BO_RANG_GAE',
    _type: 'json',
    serviceKey: decodeServiceKey(serviceKey),
    ...params,
  };
  for (const [key, value] of Object.entries(allParams)) url.searchParams.set(key, value);

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`TourAPI HTTP ${response.status}`);
  const payload = await response.json();
  const header = payload.response?.header;
  if (header?.resultCode !== '0000') {
    throw new Error(`TourAPI ${header?.resultCode || 'UNKNOWN'}: ${header?.resultMsg || '응답 오류'}`);
  }
  return payload.response.body;
}

async function main() {
const localEnv = await readLocalEnv();
const serviceKey = process.env.DATA_GO_KR_KEY || localEnv.DATA_GO_KR_KEY;
const baseUrl = process.env.TOUR_API_BASE_URL || localEnv.TOUR_API_BASE_URL
  || 'https://apis.data.go.kr/B551011/KorService2';
const testCity = process.env.TOUR_API_TEST_CITY || '순천';

if (!serviceKey) {
  throw new Error('DATA_GO_KR_KEY가 없습니다. .env에 공공데이터포털 서비스키를 넣어주세요.');
}

const regionBody = await request(baseUrl, serviceKey, 'ldongCode2', {
  numOfRows: '50', pageNo: '1', lDongListYn: 'N',
});
const regions = itemArray(regionBody.items);
const jeonnamRegion = regions.find((item) => /전남광주통합|광주전남통합/.test(item.name || ''))
  || regions.find((item) => /전라남도|전남/.test(item.name || ''));
if (!jeonnamRegion?.code) throw new Error('전남 법정동 상위 코드를 찾지 못했습니다.');

const cityBody = await request(baseUrl, serviceKey, 'ldongCode2', {
  numOfRows: '100', pageNo: '1', lDongListYn: 'N', lDongRegnCd: jeonnamRegion.code,
});
const cities = itemArray(cityBody.items)
  .map((item) => ({ name: (item.name || '').replace(/시$|군$|구$/, ''), code: item.code || '' }))
  .filter((item) => JEONNAM_CITIES.has(item.name) && item.code);
const city = cities.find((item) => item.name === testCity);
if (!city) throw new Error(`${testCity} 법정동 코드를 찾지 못했습니다.`);

const tourismBody = await request(baseUrl, serviceKey, 'areaBasedList2', {
  numOfRows: '5', pageNo: '1', arrange: 'A',
  lDongRegnCd: jeonnamRegion.code, lDongSignguCd: city.code,
});
const tourismItems = itemArray(tourismBody.items);

console.log(JSON.stringify({
  ok: true,
  region: { name: jeonnamRegion.name, code: jeonnamRegion.code },
  jeonnamCityCount: cities.length,
  testCity: city,
  tourismTotalCount: Number(tourismBody.totalCount || 0),
  samples: tourismItems.slice(0, 5).map((item) => ({
    title: item.title,
    address: item.addr1,
    contentId: item.contentid,
  })),
}, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[TourAPI test failed] ${message}`);
  process.exitCode = 1;
});
