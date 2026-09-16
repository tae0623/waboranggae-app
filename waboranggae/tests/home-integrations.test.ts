import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { combineDemandScores, demandMonths, cityFromItem } from '../server/src/modules/hot-places/datalab';

const row = (kind: 'stay' | 'spend', value: unknown, baseYm = '202607', extra = {}) => ({
  baseYm, signguNm: '여수시', signguCd: '46130',
  ...(kind === 'stay' ? { tarSjrnDsIxCd: '21', tarSjrnDsIxVal: value } : { tarExpDsIxCd: '22', tarExpDsIxVal: value }),
  ...extra,
});
const response = (items: unknown[], code = '0000') => new Response(JSON.stringify({
  response: { header: { resultCode: code }, body: { items: items.length ? { item: items } : '', totalCount: items.length } },
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('DATA_GO_KR_KEY', 'test%2Bkey%3D');
  vi.stubEnv('DATALAB_DEMAND_STAY_URL', '');
  vi.stubEnv('DATALAB_DEMAND_CONSUME_URL', '');
  vi.stubEnv('DATALAB_VISITOR_URL', '');
  vi.stubEnv('PHOTO_KOREA_BASE_URL', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('ver4 demand average with official fields', () => {
  it('keeps the stay/consumption arithmetic mean and records its month', () => {
    expect(combineDemandScores([row('stay', '82.9')], [row('spend', '63.54')], '202607')[0])
      .toMatchObject({ name: '여수', score: 73.22, stayScore: 82.9, spendScore: 63.54, baseMonth: '202607', visitors: null });
  });
  it('never treats year, regional code, missing value or a sub-index as a score', () => {
    for (const value of [undefined, null, '', 'NaN', '-1', '101', true]) {
      expect(combineDemandScores([row('stay', value)], [row('spend', '60')], '202607')).toEqual([]);
    }
    expect(combineDemandScores([row('stay', '60', '202607', { tarSjrnDsIxCd: '2101' })], [row('spend', '60')], '202607')).toEqual([]);
  });
  it('keeps legitimate zero and excludes incomplete or different-month pairs', () => {
    expect(combineDemandScores([row('stay', '0')], [row('spend', '0')], '202607')[0]?.score).toBe(0);
    expect(combineDemandScores([row('stay', '80')], [], '202607')).toEqual([]);
    expect(combineDemandScores([row('stay', '80')], [row('spend', '60', '202606')], '202607')).toEqual([]);
  });
  it('excludes province totals and maps explicit city codes', () => {
    expect(cityFromItem({ signguCd: '0', signguNm: '_', areaNm: '전라남도' })).toBeNull();
    expect(cityFromItem({ signguCd: '46130' })).toBe('여수');
  });
  it('handles month-end, leap year, year rollover and Korea time', () => {
    expect(demandMonths(new Date('2026-03-31T10:00:00Z')).slice(0, 3)).toEqual(['202602', '202601', '202512']);
    expect(demandMonths(new Date('2024-03-31T10:00:00Z'))[0]).toBe('202402');
    expect(demandMonths(new Date('2026-12-31T16:00:00Z'))[0]).toBe('202612');
    expect(demandMonths()).toHaveLength(12);
  });
});

describe('official demand requests, empty-month recovery and quota protection', () => {
  it('uses aggregate codes, scans empty months, shares concurrent calls and caches the result', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    vi.stubEnv('DATALAB_DEMAND_STAY_URL', 'https://apis.data.go.kr/B551011/TatsStayngService1');
    vi.stubEnv('DATALAB_DEMAND_CONSUME_URL', 'https://apis.data.go.kr/B551011/TatsCnsmrService1');
    const fetchMock = vi.fn(async (input: string) => {
      const u = new URL(input);
      expect(u.pathname).toMatch(/^\/B551011\/AreaTarDemDsService\/areaTar(Sjrn|Exp)DsList$/);
      expect(u.searchParams.get('serviceKey')).toBe('test+key=');
      expect(u.searchParams.get('areaCd')).toBe('46');
      const stay = u.pathname.endsWith('areaTarSjrnDsList');
      expect(u.searchParams.get(stay ? 'tarSjrnDsIxCd' : 'tarExpDsIxCd')).toBe(stay ? '21' : '22');
      return response(u.searchParams.get('baseYm') === '202607' ? [row(stay ? 'stay' : 'spend', stay ? '80' : '60')] : []);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { rankJeonnamCities } = await import('../server/src/modules/hot-places/datalab');
    const [first, second] = await Promise.all([rankJeonnamCities(), rankJeonnamCities()]);
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({ name: '여수', score: 70, baseMonth: '202607', source: 'demand' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await rankJeonnamCities();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('does not scan more months after authorization failure or fabricate a demand score', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response('{}', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const { rankJeonnamCities } = await import('../server/src/modules/hot-places/datalab');
    const result = await rankJeonnamCities();
    expect(result.every(item => item.source === 'fallback' && !item.baseMonth)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3); // Two demand requests, one existing visitor fallback.
    await rankJeonnamCities();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('bounds empty-month lookback to twelve months', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([])));
    const { rankJeonnamCities } = await import('../server/src/modules/hot-places/datalab');
    expect((await rankJeonnamCities())[0]?.source).toBe('fallback');
    expect(fetch).toHaveBeenCalledTimes(25);
  });
});

describe('Photo Korea official endpoint', () => {
  it('repairs the older example URL and retains photo attribution', async () => {
    vi.stubEnv('PHOTO_KOREA_BASE_URL', 'https://apis.data.go.kr/B551011/PhotoGalleryService2');
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const u = new URL(input);
      expect(u.pathname).toBe('/B551011/PhotoGalleryService1/gallerySearchList1');
      expect(u.searchParams.get('keyword')).toBe('담양 죽녹원');
      return response([{ galWebImageUrl: 'https://tong.visitkorea.or.kr/photo.jpg', galTitle: '죽녹원', galPhotographer: '작가', galContentId: '123' }]);
    }));
    const { searchPhotoKoreaDetails } = await import('../server/src/modules/hot-places/photokorea');
    expect(await searchPhotoKoreaDetails('담양 죽녹원')).toMatchObject({ title: '죽녹원', photographer: '작가', contentId: '123' });
  });
  it('handles gateway errors without leaking a URL or key to logs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('https://example.invalid/?serviceKey=secret'); }));
    const { searchPhotoKoreaDetails } = await import('../server/src/modules/hot-places/photokorea');
    expect(await searchPhotoKoreaDetails('죽녹원')).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });
  it('shares a forest pool across concurrent requests and caches it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response([{ galTitle: '죽녹원 대나무숲', galWebImageUrl: 'https://tong.visitkorea.or.kr/forest.jpg' }])));
    const { pickForestPhotoKorea } = await import('../server/src/modules/hot-places/photokorea');
    const results = await Promise.all([pickForestPhotoKorea(), pickForestPhotoKorea()]);
    expect(results.every(item => item?.title === '죽녹원 대나무숲')).toBe(true);
    await pickForestPhotoKorea();
    expect(fetch).toHaveBeenCalledTimes(5);
  });
});
