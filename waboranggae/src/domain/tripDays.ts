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

/** Each request is one local day. No previous day's endpoint, duration or meals are carried across. */
export function preferencesForDay(base: TravelPreferences, date:string, localOrigin?:RouteOrigin):TravelPreferences {
  if (!tripDates(date).length) throw new Error('여행 날짜를 확인해 주세요.');
  const later=date!==base.travelDate;
  if(later && !localOrigin) throw new Error('첫날 코스를 먼저 추천받아 현지 출발지를 확인해 주세요.');
  return {...base,travelDate:date,travelEndDate:date,
    ...(later ? {requiredContentId:undefined,requiredPlaceName:undefined,
      startLocation:localOrigin!.name,startAddress:localOrigin!.address,startLatitude:localOrigin!.latitude,startLongitude:localOrigin!.longitude,startType:'custom' as const} : {}),
    summary:[base.city,date,base.startTime+' 시작','대중교통·도보 여행'].join(' · ')};
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
