import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({search:vi.fn(),route:vi.fn(),origin:vi.fn()}));
vi.mock('../server/src/modules/places/search',()=>({searchPlaces:mocks.search}));
vi.mock('../server/src/modules/recommendation/data/kakao',()=>({fetchKakaoRoute:mocks.route}));
vi.mock('../server/src/modules/recommendation/data/geocoder',()=>({resolveStartOrigin:mocks.origin}));
import {prepareLocalTrip,appendAccessTrip,preferencesForCourse,belongsToCity} from '../server/src/modules/recommendation/local-trip';
import {parseTravelText} from '../src/domain/parseTravelText';
import {Course,TravelPreferences} from '../src/types/travel';
const preferences=():TravelPreferences=>({...parseTravelText('나주에서 8시간 자연 여행'),city:'나주',timeBudgetMode:'local',startLocation:'광주종합버스터미널',startAddress:'광주 서구 무진대로',startLatitude:35.16,startLongitude:126.88});
beforeEach(()=>{vi.clearAllMocks();mocks.origin.mockResolvedValue({name:'광주종합버스터미널',address:'광주 서구 무진대로',latitude:35.16,longitude:126.88,source:'places'});mocks.search.mockResolvedValue([{name:'나주시외버스터미널',address:'전남 나주시 중앙동',latitude:35.0,longitude:126.72}]);mocks.route.mockResolvedValue({totalMinutes:100,source:'kakao'});});
describe('local duration excludes only the separate access trip',()=>{
 it('keeps all eight hours and uses a verified destination hub for planning',async()=>{
  const original=preferences(),context=await prepareLocalTrip(original);
  expect(context.preferences).toMatchObject({city:'나주',durationHours:8,startLocation:'나주시외버스터미널',startLatitude:35});
  expect(original.startLocation).toBe('광주종합버스터미널');
  const course={id:'c',durationHours:8,walkMinutes:30,transitMinutes:40,timeBreakdown:{totalMinutes:480}} as Course;
  const [out]=await appendAccessTrip(context,[course]);
  expect(out).toMatchObject({durationHours:8,walkMinutes:30,transitMinutes:40,timeBreakdown:{totalMinutes:480},accessTrip:{excludedFromBudget:true,segment:{totalMinutes:100}}});
  expect(mocks.route).toHaveBeenCalledTimes(1);
  expect(preferencesForCourse(original,out!)).toMatchObject({startLocation:'나주시외버스터미널',durationHours:8});
 });
 it('does not exclude ordinary travel within the destination city',async()=>{
  mocks.origin.mockResolvedValue({name:'나주역',address:'전남 나주시 송월동',latitude:35,longitude:126.7});
  const context=await prepareLocalTrip(preferences());expect(context.preferences.startLocation).toBe('광주종합버스터미널');expect(context.origin).toBeUndefined();expect(mocks.search).not.toHaveBeenCalled();
 });
 it('preserves legacy door-to-door requests',async()=>{
  const p={...preferences(),timeBudgetMode:'door-to-door' as const};expect(await prepareLocalTrip(p)).toEqual({preferences:p});expect(mocks.origin).not.toHaveBeenCalled();
 });
 it('tries a terminal when a region has no station',async()=>{
  mocks.search.mockResolvedValueOnce([]);
  await prepareLocalTrip({...preferences(),preferredTransit:['train']});
  expect(mocks.search.mock.calls.map(c=>c[0])).toEqual(['나주역','나주 버스터미널']);
 });
 it('keeps access time unknown rather than inventing one on supplier failure',async()=>{
  const context=await prepareLocalTrip(preferences());mocks.route.mockRejectedValue(new Error('unavailable'));
  expect((await appendAccessTrip(context,[{durationHours:8} as Course]))[0]?.accessTrip?.segment).toBeNull();
 });
 it('does not substitute a similarly named hub in another city',async()=>{
  mocks.search.mockResolvedValue([{name:'나주 버스',address:'서울 강남구',latitude:37,longitude:127}]);
  await expect(prepareLocalTrip(preferences())).rejects.toThrow('도착 거점');
 });
 it.each(['목포','여수','순천','나주','광양','담양','곡성','구례','고흥','보성','화순','장흥','강진','해남','영암','무안','함평','영광','장성','완도','진도','신안'])('%s address boundaries are not Naju-specific',city=>{
  expect(belongsToCity(`전남 ${city}군 중심로`,city)).toBe(true);
  expect(belongsToCity(`전남 ${city}시 중심로`,city)).toBe(true);
  expect(belongsToCity(`서울 종로구 ${city}로`,city)).toBe(false);
 });
});
