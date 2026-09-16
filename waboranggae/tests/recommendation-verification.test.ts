import {describe,it,expect,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({attach:vi.fn()}));
vi.mock('../server/src/modules/recommendation/routing',()=>({attachRoutingToCourses:mocks.attach}));
import {verifyTopCourses,rankValidatedCourses} from '../server/src/modules/recommendation/verification';
import {parseTravelText,rankCourses} from '../src/domain/demoEngine';
import {Course} from '../src/types/travel';
afterEach(()=>vi.clearAllMocks());
function fixture(){
 const preferences={...parseTravelText('순천 터미널에서 4시간 자연 여행'),startTime:'10:00',endTime:'14:00',mealPreference:'none' as const,interests:['nature' as const]};
 const base=rankCourses(preferences)[0]!;
 const courses=Array.from({length:6},(_,i):Course=>({...base,id:'candidate-'+i,durationHours:4,walkMinutes:20,transitMinutes:0,distanceKm:1,
   places:base.places.slice(0,2).map((p,n)=>({...p,id:`p-${i}-${n}`,category:'nature',arrival:n===0?'10:10':'12:10',stayMinutes:110,moveMinutes:10,walkMinutesFromPrevious:10,transitMinutesFromPrevious:0})),
   timeBreakdown:{originToFirstMinutes:10,betweenPlacesMinutes:10,stayMinutes:220,waitAndRestMinutes:0,totalMinutes:240,requestedMinutes:240,overBudgetMinutes:0}}));
 return{preferences,courses};
}
describe('recommendation list routing verification',()=>{
 it('waits for live routing of only the top three, then re-evaluates actual time constraints',async()=>{
  const {preferences,courses}=fixture();expect(rankValidatedCourses(preferences,courses).every(c=>c.constraintPassed)).toBe(true);
  mocks.attach.mockImplementation(async(_p,selected)=>selected.map((c:Course,i:number)=>({...c,routeSource:'kakao',routingCheckedAt:new Date().toISOString(),...(i===0?{timeBreakdown:{...c.timeBreakdown!,totalMinutes:700,overBudgetMinutes:460}}:{})})));
  const result=await verifyTopCourses(preferences,courses);
  expect(mocks.attach).toHaveBeenCalledTimes(1);expect(mocks.attach.mock.calls[0]![1]).toHaveLength(3);
  expect(mocks.attach.mock.calls[0]![2]).toEqual({live:true});expect(result).toHaveLength(2);
  expect(result.every(c=>c.constraintPassed)).toBe(true);expect(result.some(c=>c.id==='candidate-0')).toBe(false);
 });
 it('retains provider-failure provenance instead of labelling estimates as verified',async()=>{
  const {preferences,courses}=fixture();mocks.attach.mockImplementation(async(_p,selected)=>selected.map((c:Course)=>({...c,routeSource:'estimated'})));
  const result=await verifyTopCourses(preferences,courses);expect(result.every(c=>c.routeSource==='estimated')).toBe(true);
 });
 it('does not query when there are no plausible candidates',async()=>{
  const {preferences}=fixture();expect(await verifyTopCourses(preferences,[])).toEqual([]);expect(mocks.attach).not.toHaveBeenCalled();
 });
});
