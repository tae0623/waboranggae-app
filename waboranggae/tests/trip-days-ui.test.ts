import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {tripDates,preferencesForDay} from '../src/domain/tripDays';
import {defaultCondition} from '../web/src/PlanWizard';
import {conditionToPreferences} from '../web/src/mappers';
import {hotPlaceSeed,conditionError} from '../web/src/parity';
import {Stars,TransitLeg} from '../web/src/JourneyTimeline';
import {mapPointSchema} from '../server/src/modules/places/routes';
import {parseKakaoRoute} from '../server/src/modules/recommendation/data/kakao';
const origin={name:'나주 현지 출발',address:'전남 나주시',latitude:35.03,longitude:126.71,source:'kakao' as const};
const ui='android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/';
afterEach(()=>vi.useRealTimers());
describe('independent travel days',()=>{
 it.each([['2026-09-20','2026-09-20',1],['2026-09-20','2026-09-26',7],['2026-09-30','2026-10-02',3],['2026-09-20','2026-09-27',0],['2026-09-20','2026-09-19',0],['2026-02-30','2026-03-01',0]])('validates %s through %s',(start,end,count)=>expect(tripDates(start,end)).toHaveLength(count));
 it('starts with an empty destination and requires an explicit choice',()=>{
  expect(defaultCondition().region).toBe('');
  expect(conditionError({...defaultCondition(),departure:'출발',departureLat:35,departureLng:127})).toContain('여행지');
 });
 it('keeps region, daily times and preferences, but never carries the previous endpoint',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-17T00:00:00Z'));
  const base=conditionToPreferences({...defaultCondition(),region:'나주',date:'2026-09-20',endDate:'2026-09-22',departure:'광주 출발',departureLat:35.16,departureLng:126.84,endTimeLimited:true,endTime:'16:30',requiredContentId:'123',requiredPlaceName:'첫날 축제'});
  const first=preferencesForDay(base,'2026-09-20');
  expect(first.startLocation).toBe('광주 출발');expect(first.requiredContentId).toBe('123');
  for(const day of ['2026-09-21','2026-09-22']){
   const p=preferencesForDay(base,day,origin);
   expect(p).toMatchObject({city:'나주',travelDate:day,travelEndDate:day,durationHours:day==='2026-09-22'?7.5:6,startTime:'09:00',endTime:day==='2026-09-22'?'16:30':undefined,startLocation:origin.name,startLatitude:origin.latitude});
   expect(p.requiredContentId).toBeUndefined();expect(p.interests).toEqual(base.interests);expect(p.preferredTransit).toEqual(['bus']);
  }
  expect(()=>preferencesForDay(base,'2026-09-21')).toThrow('첫날');
 });
 it('resets both dates when a future event seeds a plan',()=>{
  const seed=hotPlaceSeed({id:'123',name:'축제',city:'나주',source:'festival',eventStartDate:'20260924'} as any,'2026-09-17');
  expect(seed.date).toBe('2026-09-24');expect(seed.endDate).toBe(seed.date);
 });
});
describe('embedded routing and score presentation',()=>{
 it('preserves actual step geometry, bus alternatives and stops without inventing live arrivals',()=>{
  const result=parseKakaoRoute({status:'OK',routes:[{properties:{totalTime:600,totalDistance:1000},steps:[{properties:{type:'BUS',time:600,vehicles:[{name:'100'},{name:'101'}],stops:[{name:'가 정류장'},{name:'나 정류장'},{name:'다 정류장'}]},path:{points:[[126.71,35.03],[126.72,35.04],[999,999]]}}]}]},origin,{...origin,name:'도착'},'transit')!;
  expect(result.steps[0]).toMatchObject({routes:['100','101'],stops:['가 정류장','나 정류장','다 정류장'],fromStop:'가 정류장',toStop:'다 정류장'});
  expect(result.steps[0]!.geometry).toHaveLength(2);
  const html=renderToStaticMarkup(createElement(TransitLeg,{segment:result}));
  expect(html).toContain('가 정류장');expect(html).toContain('하차');expect(html).toContain('경유 정류장 보기');expect(html).not.toContain('여유');
 });
 it('shows fractional five-star ratings alongside the 100-point scale',()=>{
  const html=renderToStaticMarkup(createElement(Stars,{score:81}));
  expect(html).toContain('4.0 / 5점');expect(html).toContain('★★★★★');expect(html).toContain('width:81%');
  expect(renderToStaticMarkup(createElement(Stars,{score:200}))).toContain('width:100%');
 });
 it('accepts only explicit map taps, not location permission/GPS payloads',()=>{
  const valid={selectionSource:'map-tap',latitude:35,longitude:127,name:'선택 장소'};
  expect(mapPointSchema.safeParse(valid).success).toBe(true);
  for(const bad of [{...valid,selectionSource:'gps'},{...valid,accuracy:50},{...valid,latitude:Infinity},{...valid,longitude:180},{...valid,name:'a'.repeat(81)}])expect(mapPointSchema.safeParse(bad).success).toBe(false);
 });
 it('keeps route controls and credits in their intended screens on both platforms',()=>{
  const web=readFileSync('web/src/App.tsx','utf8'),native=readFileSync(ui+'CourseDetail.kt','utf8'),map=readFileSync(ui+'TravelApp.kt','utf8');
  for(const code of [web,native]){expect(code).toContain('이 코스로 여행하기');expect(code).not.toContain('최근 여행에 조건 저장');expect(code).not.toContain('이동시간 다시 확인');}
  expect(native).not.toContain('TravelWeatherCard');expect(map).toContain('TravelWeatherCard');expect(map).not.toContain('map-course-');
  expect(readFileSync('web/src/AppInfo.tsx','utf8')).toContain('한국관광공사');expect(readFileSync(ui+'AccountScreens.kt','utf8')).toContain('앱 정보');
  expect(web).not.toContain('지표 기준');expect(web).toContain('onRelated(r)');
 });
});
