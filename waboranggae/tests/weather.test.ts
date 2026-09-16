import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentWeather, kmaBaseTime, kmaGrid, parseObservation } from '../server/src/modules/weather/service';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const payload = (values: Record<string, number | string>) => ({ response: { header: { resultCode: '00' }, body: { items: { item:
  Object.entries(values).map(([category, obsrValue]) => ({ category, obsrValue, baseDate: '20260915', baseTime: '1000' })),
} } } });
describe('기상청 현재 날씨', () => {
  it('공식 격자 변환 기준점 서울(60,127)', () => expect(kmaGrid(37.5665,126.978)).toEqual({nx:60,ny:127}));
  it('UTC 서버와 자정 경계에서도 KST 이전 관측 시각 사용', () => expect(kmaBaseTime(new Date('2026-09-14T15:20:00Z'))).toEqual({date:'20260914',time:'2300'}));
  it('실측이 없으면 맑음으로 꾸미지 않음', () => expect(parseObservation(payload({PTY:0})).available).toBe(false));
  it('API 인증 오류를 실제 날씨로 표시하지 않음', () => expect(parseObservation({response:{header:{resultCode:'30'}}}).available).toBe(false));
  it('관측 기온과 강수, 출처, 시각 사용', () => expect(parseObservation(payload({T1H:28,PTY:1,RN1:2,WSD:3}))).toMatchObject({available:true,temperature:28,condition:'비',source:'kma',observedAt:'2026-09-15 10:00 KST'}));
  it('키가 없으면 외부 호출하지 않음', async () => { vi.stubEnv('DATA_GO_KR_KEY',''); const fetcher=vi.fn(); vi.stubGlobal('fetch',fetcher); expect((await currentWeather(34.95,127.48)).available).toBe(false); expect(fetcher).not.toHaveBeenCalled(); });
});
