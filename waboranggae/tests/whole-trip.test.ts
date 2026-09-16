import {describe,it,expect,vi} from 'vitest';
import {recommendTrip} from '../src/domain/tripDays';
import {alreadyVisited} from '../src/domain/visitedPlaces';
import {timeUsePriority} from '../server/src/modules/recommendation/verification';
import {travelPreferencesSchema,analysisPreferencesSchema} from '../server/src/shared/schemas';
import {defaultCondition} from '../web/src/PlanWizard';
import {conditionToPreferences} from '../web/src/mappers';
const base=()=>conditionToPreferences({...defaultCondition(),region:'나주',departure:'공개 터미널',departureLat:35.16,departureLng:126.84,date:'2026-10-01',endDate:'2026-10-03'});
const make=(date:string)=>({id:date,origin:{name:'나주 현지 거점',latitude:35.03,longitude:126.71,address:'전남 나주'},places:[{id:date,name:date+' 관광지',latitude:35.04,longitude:126.72}],durationHours:4}) as any;
describe('whole-trip planning',()=>{
 it('requests every day at once and excludes prior venues without using previous endpoints',async()=>{
   const request=vi.fn(async(p:any)=>({courses:[make(p.travelDate)]}));
   const days=await recommendTrip(base(),['2026-10-01','2026-10-02','2026-10-03'],request);
   expect(days).toHaveLength(3);expect(days.every(d=>d.courses.length===1)).toBe(true);
   expect(request.mock.calls[1]![0]).toMatchObject({startLocation:'나주 현지 거점',startLatitude:35.03,travelDate:'2026-10-02',travelEndDate:'2026-10-02',visitedPlaces:[{id:'2026-10-01'}]});
   expect(request.mock.calls[2]![0].visitedPlaces).toHaveLength(2);
 });
 it('does not quietly repeat a venue when no fresh course is returned',async()=>{
   const days=await recommendTrip(base(),['2026-10-01','2026-10-02'],async()=>({courses:[make('same')]}));
   expect(days[0]!.courses).toHaveLength(1);expect(days[1]!.courses).toEqual([]);expect(days[1]!.error).toBeTruthy();
 });
 it('retains successful days and reports a failed day',async()=>{
   const days=await recommendTrip(base(),['2026-10-01','2026-10-02','2026-10-03'],async p=>{if(p.travelDate==='2026-10-02')throw Error('일시 오류');return{courses:[make(p.travelDate!)]}});
   expect(days.map(d=>d.courses.length)).toEqual([1,0,1]);expect(days[1]!.error).toBe('일시 오류');
 });
 it('recognizes aliases across providers without excluding every nearby different place',()=>{
   const visited=[{id:'tour-123',name:'금성관',latitude:35.03,longitude:126.71}];
   expect(alreadyVisited({id:'123',name:'다른 표기'},visited)).toBe(true);
   expect(alreadyVisited({id:'kakao-9',name:'나주 금성관',latitude:35.0302,longitude:126.7101},visited)).toBe(true);
   expect(alreadyVisited({id:'kakao-8',name:'다른 식당',latitude:35.03,longitude:126.71},visited)).toBe(false);
 });
 it('bounds input and keeps visited venues out of the LLM extraction schema',()=>{
   expect(travelPreferencesSchema.safeParse({...base(),visitedPlaces:Array.from({length:121},()=>({id:'x',name:'x'}))}).success).toBe(false);
   expect(analysisPreferencesSchema.shape).not.toHaveProperty('visitedPlaces');
 });
 it('only prioritizes fuller feasible plans when the user set an end time',()=>{
   const p={...base(),startTime:'10:00',endTime:'18:00'};const short={durationHours:3} as any,long={durationHours:7} as any;
   expect(timeUsePriority(p,long)).toBeGreaterThan(timeUsePriority(p,short));
   expect(timeUsePriority({...p,endTime:undefined},long)).toBe(0);
   expect(timeUsePriority(p,{durationHours:9} as any)).toBe(0);
 });
});
