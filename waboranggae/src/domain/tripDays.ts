import {alreadyVisited} from './visitedPlaces';
import type { RouteOrigin, TravelPreferences } from '../types/travel';

export const MAX_TRIP_DAYS = 7;
export function tripDates(start: string, end = start): string[] {
  const parse = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  if (!parse(start) || !parse(end)) return [];
  const count = (Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000+1;
  if (count<1 || count>MAX_TRIP_DAYS) return [];
  return Array.from({length:count},(_,i)=>new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
}

export interface DaySchedule { startTime:string; endTime?:string; }
export function scheduleForDate(base: Pick<TravelPreferences,'travelDate'|'travelEndDate'|'startTime'|'endTime'|'daySchedules'>, date:string):DaySchedule {
  return base.daySchedules?.[date] ?? {
    startTime:date===base.travelDate?base.startTime:'09:00',
    endTime:date===(base.travelEndDate||base.travelDate)?base.endTime:undefined,
  };
}
export function clockMinutes(value:string) {
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return NaN;
  const [h,m]=value.split(':').map(Number);return h!*60+m!;
}
export function scheduleError(schedule:DaySchedule) {
  if(!Number.isFinite(clockMinutes(schedule.startTime)))return '시작 시각을 확인해 주세요.';
  if(schedule.endTime!==undefined && (!Number.isFinite(clockMinutes(schedule.endTime))||clockMinutes(schedule.endTime)-clockMinutes(schedule.startTime)<60))return '종료 시각은 같은 날 시작보다 1시간 이상 뒤로 선택해 주세요.';
  return '';
}
export function mealsForSchedule(schedule:DaySchedule) {
  const start=clockMinutes(schedule.startTime),end=schedule.endTime?clockMinutes(schedule.endTime):1439;
  return ([['breakfast',480,570],['lunch',690,810],['dinner',1050,1170]] as const)
    .filter(([,from,to])=>Math.max(start,from)<=to && Math.max(start,from)+60<=end).map(([name])=>name);
}

/** Each request is one local day. No previous day's endpoint, duration or meals are carried across. */
export function preferencesForDay(base: TravelPreferences, date:string, localOrigin?:RouteOrigin):TravelPreferences {
  if (!tripDates(base.travelDate||'',base.travelEndDate||base.travelDate||'').includes(date)) throw new Error('여행 날짜를 확인해 주세요.');
  const later=date!==base.travelDate;
  if(later && !localOrigin) throw new Error('첫날 코스를 먼저 추천받아 현지 출발지를 확인해 주세요.');
  const {daySchedules:_,...single}=base;
  const schedule=scheduleForDate(base,date),error=scheduleError(schedule);if(error)throw new Error(date+' · '+error);
  const meals=base.meals?.filter(meal=>mealsForSchedule(schedule).includes(meal));
  return {...single,travelDate:date,travelEndDate:date,...schedule,endTime:schedule.endTime,
    durationHours:schedule.endTime?(clockMinutes(schedule.endTime)-clockMinutes(schedule.startTime))/60:6,
    meals,mealPreference:meals?.length===0?'none':base.mealPreference,
    ...(later ? {requiredContentId:undefined,requiredPlaceName:undefined,
      startLocation:localOrigin!.name,startAddress:localOrigin!.address,startLatitude:localOrigin!.latitude,startLongitude:localOrigin!.longitude,startType:'custom' as const} : {}),
    summary:[base.city,date,schedule.startTime+' 시작','대중교통·도보 여행'].join(' · ')};
}

export async function recommendTrip(
 base:TravelPreferences,dates:string[],
 request:(preferences:TravelPreferences)=>Promise<{courses:import('../types/travel').RankedCourse[];fallbackReason?:string|null}>,
 onProgress:(date:string,index:number)=>void=()=>{},cancelled:()=>boolean=()=>false,
) {
 const days:Array<{date:string;preferences:TravelPreferences;courses:import('../types/travel').RankedCourse[];error?:string}>=[];
 let origin:RouteOrigin|undefined;
 const visited:NonNullable<TravelPreferences['visitedPlaces']>=[];
 for(const [index,date] of dates.entries()){
   if(cancelled())break;
   onProgress(date,index);
   let preferences:TravelPreferences={...base,travelDate:date,travelEndDate:date};
   try{
     preferences={...preferencesForDay(base,date,origin),visitedPlaces:[...visited]};
     const response=await request(preferences);if(cancelled())break;
     const eligible=response.courses.filter(c=>!c.places.some(place=>alreadyVisited(place,visited)));
     const courses=dates.length>1?eligible.slice(0,1):eligible;
     if(!courses.length)throw Error(response.fallbackReason||'이 날짜의 새 코스를 찾지 못했어요.');
     if(index===0)origin=courses[0]!.origin;
     days.push({date,preferences,courses});
     for(const place of courses[0]!.places)visited.push({id:place.id,name:place.name,latitude:place.latitude,longitude:place.longitude});
   }catch(error){days.push({date,preferences,courses:[],error:error instanceof Error?error.message:'코스를 불러오지 못했어요.'});}
 }
 return days;
}
