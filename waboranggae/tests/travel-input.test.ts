import {describe,it,expect} from 'vitest';
import {parseTravelText,applyExplicitTravelSignals} from '../src/domain/parseTravelText';
import {explicitTripTiming,koreanToday,travelInputIssues,validTravelDate} from '../src/domain/travelInput';
import {analysisPreferencesSchema,travelPreferencesSchema} from '../server/src/shared/schemas';
import {analysisCases,evaluateConditions} from '../scripts/llm-comparison-cases.mjs';
const now=new Date('2026-09-14T16:00:00Z'); // Tuesday in Korea, Monday in UTC.
const wrongAi={...parseTravelText('순천역에서 6시간 자연 여행',now),city:'순천',startLatitude:0,startLongitude:0,startAddress:'생성된 주소',lodgingName:'가짜 호텔',lodgingAddress:'가짜 주소',lodgingLatitude:0,lodgingLongitude:0,travelDate:'2023-10-07',travelEndDate:'null',endTime:'23:59',meals:['dinner'] as ['dinner'],summary:'접근성과 버스 도착을 보장합니다.'};
describe('명시 입력 회귀 검사',()=>{
  it.each(analysisCases)('$id: 원본 규칙과 잘못된 모델 보정 모두 조건 보존', (c:any)=>{
    expect(evaluateConditions(parseTravelText(c.query,now),c.expected).filter((x:any)=>!x.pass)).toEqual([]);
    expect(evaluateConditions(applyExplicitTravelSignals(c.query,wrongAi,now),c.expected).filter((x:any)=>!x.pass)).toEqual([]);
  });
  it.each([
    ['담양 터미널에서 카페와 시장 1.25시간 식사는 안해',1.25,'none'],
    ['여수역에서 카페 36시간 밥은 패스',36,'none'],
    ['나주역에서 72시간 자연',72,'auto'],
  ])('시간과 부정을 보존: %s',(query,hours,meal)=>{const p=applyExplicitTravelSignals(String(query),wrongAi,now);expect(p.durationHours).toBe(hours);expect(p.mealPreference).toBe(meal);});
  it('문장·쉼표 뒤 식사 제외가 앞의 자연·사진을 지우지 않는다',()=>{expect(parseTravelText('해남 4시간 자연과 사진, 식사 없이',now).interests).toEqual(['nature','photo']);});
  it('관심사만 지정하면 모델이 임의 추가한 관심사를 넣지 않는다',()=>{expect(applyExplicitTravelSignals('담양 2시간 카페만 식사 제외',wrongAi,now).interests).toEqual(['cafe']);});
  it('동시에 제외한 카페와 시장이 다시 추가되지 않는다',()=>{expect(applyExplicitTravelSignals('순천역에서 자연 3시간. 카페와 시장은 제외', {...wrongAi,interests:['cafe','market','nature']},now).interests).toEqual(['nature']);});
  it('선착장·여객터미널 이름을 역/버스터미널로 바꾸지 않는다',()=>{const p=applyExplicitTravelSignals('완도여객터미널에서 3시간 바다',wrongAi,now);expect(p.startType).toBe('custom');expect(p.startLocation).toBe('완도여객터미널');});
  it('식사 제외 후 AI meals가 저녁으로 남지 않는다',()=>{const p=applyExplicitTravelSignals('순천역 3시간 카페, 밥은 빼줘',wrongAi,now);expect(p.meals).toEqual([]);});
  it('하지 않는 식사와 원하지 않는 도시는 덮어쓰지 않는다',()=>{const p=applyExplicitTravelSignals('여수 말고 보성에서 2시간 카페. 식사는 하지 않을래',wrongAi,now);expect(p.city).toBe('보성');expect(p.mealPreference).toBe('none');});
  it('자가용이 없다는 말을 자가용 여행으로 바꾸지 않는다',()=>{expect(parseTravelText('순천역 3시간 자연, 자가용은 없어요').publicTransportOnly).toBe(true);});
  it('모델 좌표·주소·숙소·요약·날짜를 믿지 않는다',()=>{const p=applyExplicitTravelSignals('순천역 3시간 자연',wrongAi,now);for(const k of ['startLatitude','startLongitude','startAddress','lodgingName','lodgingAddress','lodgingLatitude','lodgingLongitude','endTime'])expect(p).not.toHaveProperty(k);expect(p.travelDate).toBeNull();expect(p.travelEndDate).toBeNull();expect(p.summary).not.toContain('보장');});
  it('AI 스키마도 좌표·주소·날짜를 제거하지만 UI 추천 좌표는 보존한다',()=>{const ai=analysisPreferencesSchema.parse(wrongAi);expect(ai).not.toHaveProperty('startLatitude');expect(ai).not.toHaveProperty('travelDate');const ui=travelPreferencesSchema.parse({...wrongAi,travelDate:null,travelEndDate:null});expect(ui.startLatitude).toBe(0);});
});
describe('달력·입력 유효성',()=>{
  it('상대 날짜는 한국 시간 기준',()=>{expect(koreanToday(now)).toBe('2026-09-15');expect(explicitTripTiming('이번 주말 토요일 여수 6시간',now).travelDate).toBe('2026-09-19');expect(explicitTripTiming('다음 주 월요일 순천 3시간',now).travelDate).toBe('2026-09-21');expect(explicitTripTiming('내일 순천 3시간',now).travelDate).toBe('2026-09-16');});
  it('콜론 시각과 자정 넘김을 보존',()=>{expect(explicitTripTiming('2026-10-03 목포역 22:00부터 다음 날 02:00까지',now)).toEqual({travelDate:'2026-10-03',travelEndDate:'2026-10-04',startTime:'22:00',endTime:'02:00',durationHours:4});});
  it('오후 반 시각',()=>{expect(explicitTripTiming('나주역 오후 2시 반 1.5시간',now).startTime).toBe('14:30');});
  it('시간과 분을 합산하고 시각과 불일치하면 확인 요청',()=>{expect(explicitTripTiming('순천 1시간 30분 카페',now).durationHours).toBe(1.5);expect(travelInputIssues('순천 10:00부터 14:00까지 6시간',now)).not.toEqual([]);});
  it.each(['2026-02-30','2026-13-01','null','2026-2-01'])('잘못된 날짜 %s 거부',d=>{expect(validTravelDate(d)).toBe(false);expect(travelPreferencesSchema.safeParse({...parseTravelText('순천 3시간'),travelDate:d}).success).toBe(false);});
  it('윤년 날짜',()=>{expect(validTravelDate('2028-02-29')).toBe(true);});
  it.each(['순천 0시간','순천 -2시간','순천 100시간','순천 25:00 출발','순천 오후 14시 출발','순천 9시 99분 출발','2026년 2월 30일 순천 3시간','서울역 5시간 여행','다음 달 순천 2일 여행','순천 2시간 아니 5시간 여행'])('확인 필요 입력은 LLM 호출 전에 차단: %s',q=>{expect(travelInputIssues(q,now).length).toBeGreaterThan(0);});
});
