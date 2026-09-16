import {describe,it,expect} from 'vitest';
import {parseTravelText,rankCourses} from '../src/domain/demoEngine';
import {mealWindowsFor,validateScheduledPlaces} from '../server/src/modules/recommendation/planner';
import {diverseCourses} from '../server/src/modules/recommendation/verification';
import {planningHours,touringMinutes,wallLimitMinutes} from '../src/domain/tripWindow';
import {travelPreferencesSchema} from '../server/src/shared/schemas';
import {userPreferenceVector,placePreferenceScore,hardConstraintViolations,collectCourseFacts} from '../src/domain/recommendScore';

const base={...parseTravelText('순천 자연 6시간'),travelDate:'2026-10-01',travelEndDate:'2026-10-01',startTime:'10:00',endTime:'16:00',durationHours:6,timeBudgetMode:'local' as const};
describe('exact clock windows and meal choices',()=>{
 it('preserves minute precision rather than rounding to hours or quarter-hours',()=>{
  const p={...base,startTime:'09:15',endTime:'15:40',durationHours:385/60};
  expect(planningHours(p)).toBe(385/60);expect(wallLimitMinutes(p)).toBe(385);
  expect(touringMinutes('2026-10-01','21:50','2026-10-02','08:07')).toBe(17);
  expect(planningHours({...base,startTime:'20:00',endTime:'23:00',durationHours:3})).toBe(3);
 });
 it('rejects negative, short and over-72-hour explicit windows',()=>{
  for(const p of [{...base,endTime:'09:00'},{...base,endTime:'10:30'},{...base,travelEndDate:'2026-10-05'}]) expect(travelPreferencesSchema.safeParse(p).success).toBe(false);
  expect(travelPreferencesSchema.safeParse({...base,endTime:'16:25',durationHours:385/60}).success).toBe(true);
 });
 it('auto includes breakfast and manual/empty lists override auto',()=>{
  const p={...base,startTime:'08:00',endTime:'19:00',durationHours:11};
  expect(mealWindowsFor(p).map(w=>w.kind)).toEqual(['breakfast','lunch','dinner']);
  expect(mealWindowsFor({...p,meals:[]})).toEqual([]);
  expect(mealWindowsFor({...p,meals:['breakfast','dinner']}).map(w=>w.kind)).toEqual(['breakfast','dinner']);
  expect(mealWindowsFor({...base,startTime:'13:20',endTime:'14:00'})).toEqual([]);
  expect(mealWindowsFor({...base,startTime:'09:15',endTime:'15:40'}).map(w=>w.kind)).toEqual(['lunch']);
  expect(mealWindowsFor({...base,startTime:'09:15',endTime:'15:40',meals:['breakfast']}).map(w=>w.kind)).toEqual(['breakfast']);
 });
 it('requires second-day meals instead of silently accepting missing selections',()=>{
  const p={...base,travelEndDate:'2026-10-02',durationHours:30,meals:['lunch' as const]};
  const course=rankCourses(p)[0]!;
  expect(validateScheduledPlaces(p,course.places.filter(x=>x.category!=='food'))).toContain('선택한 식사 일정이 모두 반영되지 않았습니다.');
 });
});
describe('genuine recommendation diversity',()=>{
 it('keeps one best-ranked order for the same places',()=>{
  const a=rankCourses(base)[0]!;
  const b={...a,id:'reordered',title:'different title',places:[...a.places].reverse()};
  expect(diverseCourses([a,b])).toEqual([a]);
 });
 it('does not count a restaurant-only swap as a new sightseeing course',()=>{
  const a=rankCourses(base)[0]!;
  const b={...a,id:'food-swap',places:a.places.map(p=>p.category==='food'?{...p,id:'new-restaurant'}:p)};
  expect(diverseCourses([a,b])).toHaveLength(1);
 });
 it('does not pad the list with a three-of-four place repeat',()=>{
  const baseCourse=rankCourses(base)[0]!;
  const place=baseCourse.places[0]!;
  const a={...baseCourse,places:['a','b','c','d'].map(id=>({...place,id,category:'nature' as const}))};
  const b={...a,id:'repeat',places:a.places.map((p,i)=>i===3?{...p,id:'e'}:p)};
  expect(diverseCourses([a,b])).toHaveLength(1);
 });
 it('allows genuinely different food/cafe-only routes',()=>{
  const a=rankCourses(base)[0]!;
  const food=a.places[0]!;
  const first={...a,places:[{...food,id:'food-a',category:'food' as const},{...food,id:'cafe-a',category:'cafe' as const}]};
  const second={...first,id:'second',places:first.places.map(p=>({...p,id:p.id+'2'}))};
  expect(diverseCourses([first,second])).toHaveLength(2);
 });
});
describe('preference controls influence scores and admissibility',()=>{
 it('each primary category prioritizes its own category and photo remains supplementary',()=>{
  for(const category of ['nature','food','cafe','history','market'] as const) {
   const p={...base,interests:[category]};
   const own=placePreferenceScore({category,tags:[category]},p);
   const other=placePreferenceScore({category:category==='nature'?'food':'nature',tags:[]},p);
   expect(own).toBeGreaterThan(other);
  }
  expect(userPreferenceVector({...base,interests:['nature','photo']}).photo).toBe(0.35);
  expect(userPreferenceVector({...base,interests:['photo']}).photo).toBe(1);
 });
 it('walking burden and pace change hard limits',()=>{
  const facts={...collectCourseFacts(rankCourses(base)[0]!),walkMinutes:90,transferCount:0,tripMinutes:360};
  expect(hardConstraintViolations({...base,pace:'balanced',lowMobility:false},facts)).toEqual([]);
  expect(hardConstraintViolations({...base,pace:'easy'},facts).some(x=>x.includes('도보'))).toBe(true);
  expect(hardConstraintViolations({...base,lowMobility:true},facts).some(x=>x.includes('도보'))).toBe(true);
  expect(hardConstraintViolations({...base,pace:'full'}, {...facts,walkMinutes:120})).toEqual([]);
 });
 it('companion bonuses are soft, not fabricated accessibility guarantees',()=>{
  expect(userPreferenceVector({...base,interests:['nature'],companions:'아이와 함께'}).cafe).toBeGreaterThan(userPreferenceVector({...base,interests:['nature'],companions:'혼자'}).cafe);
  expect(userPreferenceVector({...base,interests:['nature'],companions:'연인과 함께'}).photo).toBeGreaterThan(0);
  expect(userPreferenceVector({...base,companions:'혼자'})).toEqual(userPreferenceVector({...base,companions:'친구와 함께'}));
 });
});
