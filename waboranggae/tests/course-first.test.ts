import {describe,it,expect,vi} from 'vitest';
vi.mock('../server/src/modules/recommendation/data/geocoder',()=>({resolveStartOrigin:async(p:any)=>({name:p.startLocation,address:p.startAddress,latitude:p.startLatitude,longitude:p.startLongitude,source:'user'})}));
vi.mock('../server/src/modules/recommendation/data/kakao',()=>({fetchKakaoRoute:async(a:any,b:any)=>({fromName:a.name,toName:b.name,source:'kakao',distanceKm:0.4,totalMinutes:6,walkMinutes:6,transitMinutes:0,modeLabel:'도보',instruction:'도보 6분',steps:[],geometry:[a,b]})}));
import {parseTravelText} from '../src/domain/parseTravelText';
import {TravelPreferences,Place} from '../src/types/travel';
import {travelPreferencesSchema} from '../server/src/shared/schemas';
import {buildRulePlannedCourses,validateScheduledPlaces,minimumStayMinutes} from '../server/src/modules/recommendation/planner';
import {attachRoutingToCourses} from '../server/src/modules/recommendation/routing';
import {preferencesForSelection} from '../server/src/modules/recommendation/local-trip';
import {rankValidatedCourses,verifyTopCourses} from '../server/src/modules/recommendation/verification';
import {wallLimitMinutes} from '../src/domain/tripWindow';

function prefs(extra:Partial<TravelPreferences>={}):TravelPreferences{
 return {...parseTravelText('순천 6시간 자연 여행'),scheduleMode:'course-first',timeBudgetMode:'local',travelDate:'2026-09-18',travelEndDate:'2026-09-18',startTime:'10:00',endTime:undefined,startLocation:'순천종합버스터미널',startAddress:'전남 순천시',startLatitude:34.95,startLongitude:127.49,mealPreference:'auto',meals:undefined,interests:['nature','food','cafe'],...extra};
}
function place(id:string,category:Place['category'],index=0):Place{
 return{id,name:id,category,address:'전남 순천시',arrival:'10:00',stayMinutes:70,moveLabel:'',description:'',tags:category==='food'?['food']:category==='cafe'?['cafe']:['nature'],latitude:34.951+index*.001,longitude:127.49,mapPoint:{x:0,y:0}};
}
const pool=[place('tour-123','nature'),place('food','food',1),place('cafe','cafe',2),place('park','nature',3),place('museum','history',4)];
describe('course-first recommendations and editing',()=>{
 it('accepts no duration or end time and keeps old clients fixed',()=>{
   const {durationHours,...p}=prefs();const parsed=travelPreferencesSchema.parse(p);
   expect(parsed.endTime).toBeUndefined();expect(parsed.durationHours).toBe(6);
   expect(wallLimitMinutes(parsed)).toBe(839);
   expect(wallLimitMinutes({...parsed,scheduleMode:undefined})).toBe(360);
 });
 it('validates an explicit same-day deadline without wrapping backward or accepting multi-day',()=>{
   expect(travelPreferencesSchema.safeParse(prefs({endTime:'09:00'})).success).toBe(false);
   expect(travelPreferencesSchema.safeParse(prefs({endTime:'10:30'})).success).toBe(false);
   expect(travelPreferencesSchema.safeParse(prefs({endTime:'11:00'})).success).toBe(true);
   expect(travelPreferencesSchema.safeParse(prefs({travelEndDate:'2026-09-19'})).success).toBe(false);
 });
 it('does not secretly use the old duration field as a limit or stop count',()=>{
   const signature=(hours:number)=>buildRulePlannedCourses(prefs({durationHours:hours}),pool).map(c=>({places:c.places.map(p=>p.id),duration:c.durationHours}));
   expect(signature(2)).toEqual(signature(8));
 });
 it('does not pad stays to a hidden six-hour target',async()=>{
   const p=prefs();const plans=buildRulePlannedCourses(p,pool);expect(plans.length).toBeGreaterThan(0);
   expect(plans.every(c=>c.places.every(x=>x.stayMinutes===minimumStayMinutes(x.category)))).toBe(true);
   const courses=await verifyTopCourses(p,await attachRoutingToCourses(p,plans));
   expect(courses.some(c=>c.constraintPassed&&c.places.length>=3)).toBe(true);
   expect(courses.every(c=>c.timeBreakdown?.requestedMinutes===undefined)).toBe(true);
   expect(courses.every(c=>c.durationHours<6)).toBe(true);
 });
 it('supports a sparse one-place course without meal padding',async()=>{
   const p=prefs();const courses=buildRulePlannedCourses(p,[pool[0]!]);
   expect(courses).toHaveLength(1);
   const [c]=rankValidatedCourses(p,await attachRoutingToCourses(p,courses,{live:true}));
   expect(c?.constraintPassed).toBe(true);expect(c?.timeBreakdown?.totalMinutes).toBe(76);
 });
 it('keeps explicit meals and required visits in initial recommendations',()=>{
   const p=prefs({requiredContentId:'123',mealPreference:'lunch',meals:['lunch']});
   const courses=buildRulePlannedCourses(p,pool);expect(courses.length).toBeGreaterThan(0);
   expect(courses.every(c=>c.places.some(x=>x.id==='tour-123')&&c.places.some(x=>x.category==='food'))).toBe(true);
   expect(buildRulePlannedCourses(p,[pool[0]!])).toHaveLength(0);
 });
 it('honors explicit removal of food and the required attraction and recalculates a single cafe',async()=>{
   const p=prefs({requiredContentId:'123',mealPreference:'lunch',meals:['lunch']});
   const original=buildRulePlannedCourses(p,pool).find(c=>c.places.some(x=>x.category==='cafe'))!;
   const places=original.places.filter(x=>x.category==='cafe');expect(places).toHaveLength(1);
   const editedPreferences=preferencesForSelection(p,original,places);
   expect(editedPreferences.mealPreference).toBe('none');expect(editedPreferences.requiredContentId).toBeUndefined();
   expect(p.requiredContentId).toBe('123');expect(p.meals).toEqual(['lunch']);
   const [c]=rankValidatedCourses(editedPreferences,await attachRoutingToCourses(editedPreferences,[{...original,places}],{live:true}));
   expect(c?.constraintPassed).toBe(true);expect(c?.places).toHaveLength(1);expect(c?.timeBreakdown?.totalMinutes).toBe(56);
   expect(preferencesForSelection(p,original,original.places).meals).toEqual(['lunch']);
 });
 it('never accepts a deadline overrun just because course-first is enabled',async()=>{
   const p=prefs({endTime:'11:00',mealPreference:'none',meals:[],interests:['cafe']});
   const [c]=buildRulePlannedCourses(p,[pool[2]!]);expect(c).toBeDefined();
   const [routed]=await attachRoutingToCourses(p,[c!],{live:true});
   expect(routed?.timeBreakdown?.totalMinutes).toBe(56);expect(routed?.timeBreakdown?.requestedMinutes).toBe(60);
   expect(rankValidatedCourses(p,[{...routed!,timeBreakdown:{...routed!.timeBreakdown!,totalMinutes:61}}])[0]?.constraintPassed).toBe(false);
 });
 it('rejects a late night visit past the same-day boundary',()=>{
   expect(validateScheduledPlaces(prefs({startTime:'23:30',mealPreference:'none'}),[{...pool[0]!,arrival:'23:45',stayMinutes:70}]).some(v=>v.includes('초과'))).toBe(true);
 });
});
