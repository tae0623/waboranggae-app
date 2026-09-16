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
