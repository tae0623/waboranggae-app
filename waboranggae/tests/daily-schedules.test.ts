import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {defaultCondition} from '../web/src/PlanWizard';
import {conditionToPreferences} from '../web/src/mappers';
import {conditionError,availableMeals,withTripRange} from '../web/src/parity';
import {preferencesForDay,tripDates,scheduleError} from '../src/domain/tripDays';
import {travelPreferencesSchema} from '../server/src/shared/schemas';
const origin={name:'순천 현지 거점',address:'전남 순천시',latitude:34.95,longitude:127.49,source:'kakao' as const};
const form=()=>({...defaultCondition(),region:'순천',departure:'광주종합버스터미널',departureLat:35.16,departureLng:126.84,date:'2026-10-01',endDate:'2026-10-03',startTime:'17:00',endTime:'12:00',endTimeLimited:true,meals:['점심','저녁'],daySchedules:{'2026-10-01':{startTime:'17:00',endTime:'20:00'},'2026-10-02':{startTime:'10:30',endTime:'18:30'},'2026-10-03':{startTime:'08:30',endTime:'12:00'}}});
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-18'));});
afterEach(()=>vi.useRealTimers());
describe('date-range and independently chosen daily windows',()=>{
 it('accepts a last-day end earlier than the first-day start without making an overnight course',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-18'));
  const c=form();expect(conditionError(c)).toBe('');const base=conditionToPreferences(c);
  const days=tripDates(c.date,c.endDate).map(d=>preferencesForDay(base,d,d===c.date?undefined:origin));
  expect(days.map(d=>[d.startTime,d.endTime,d.durationHours])).toEqual([['17:00','20:00',3],['10:30','18:30',8],['08:30','12:00',3.5]]);
  expect(days.map(d=>d.meals)).toEqual([['dinner'],['lunch','dinner'],[]]);
  expect(days[2]!.mealPreference).toBe('none');
  for(const day of days){expect(day).not.toHaveProperty('daySchedules');expect(day.travelDate).toBe(day.travelEndDate);expect(travelPreferencesSchema.safeParse(day).success).toBe(true);}
 });
 it('uses the union for meal buttons, then filters meals per day',()=>{expect(availableMeals(form())).toEqual(['아침','점심','저녁']);});
 it('validates every intermediate day before any network request',()=>{
  const c=form();c.daySchedules['2026-10-02'].endTime='10:45';expect(conditionError(c)).toContain('2026-10-02');
 });
 it('does not apply the final end to the first day when date windows are not initialized yet',()=>{
  const c={...form(),daySchedules:undefined};const p=conditionToPreferences(c);
  expect(preferencesForDay(p,c.date).endTime).toBeUndefined();expect(preferencesForDay(p,c.endDate,origin).endTime).toBe('12:00');
 });
 it('shrinks a range and synchronizes summary clocks without retaining removed days',()=>{
   const c=withTripRange(form(),'2026-10-02','2026-10-02');
   expect(Object.keys(c.daySchedules!)).toEqual(['2026-10-02']);expect(c.startTime).toBe('10:30');expect(c.endTime).toBe('18:30');expect(c.endTimeLimited).toBe(true);
 });
 it('clears meals that no longer fit after narrowing to the final morning',()=>{
   const c=withTripRange(form(),'2026-10-03','2026-10-03');expect(c.meals).toEqual([]);expect(c.startTime).toBe('08:30');expect(c.endTime).toBe('12:00');
 });
 it('rejects malformed clocks, zero/short windows and overnight same-day windows',()=>{
  for(const [startTime,endTime] of [['24:00','25:00'],['12:60','14:00'],['23:00','01:00'],['10:00','10:59'],['10:00','10:00']] as const)expect(scheduleError({startTime,endTime})).not.toBe('');
  expect(scheduleError({startTime:'23:00'})).toBe('');expect(scheduleError({startTime:'00:00',endTime:'01:00'})).toBe('');
 });
});
