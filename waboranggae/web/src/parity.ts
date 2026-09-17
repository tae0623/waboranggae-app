import type { Condition } from './App';
import type { HotPlace, RankedCourse } from './api';
import { tripDates, scheduleForDate, mealsForSchedule, scheduleError } from '../../src/domain/tripDays';

export const HOME_SCENERY_URL = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=700&fit=crop&auto=format';
export const PURPOSES = ['자연 명소', '맛집 탐방', '카페', '역사·문화', '시장·골목'];
export function todayKorea(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
}
export function normalizeDate(value?: string) {
  const raw = value?.replace(/-/g, '') || '';
  if (!/^\d{8}$/.test(raw)) return '';
  const date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6)}`;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : '';
}
export function visibleHomePlaces(places: HotPlace[], today = todayKorea()) {
  return places.filter(p => {
    if (p.source !== 'festival' && p.category !== '축제·행사') return true;
    const from = normalizeDate(p.eventStartDate), to = normalizeDate(p.eventEndDate);
    return Boolean(from && to && to >= from && to >= today);
  });
}
export function hotPlaceSeed(place: HotPlace, today = todayKorea()): Partial<Condition> {
  const contentId = place.id.replace(/^festival-/, '');
  const date = normalizeDate(place.eventStartDate);
  return { region: place.city, departure: '', departureAddress: undefined, departureLat: undefined, departureLng: undefined,
    date: date > today ? date : today, endDate: date > today ? date : today,
    requiredPlace: /^\d{1,20}$/.test(contentId) ? place : undefined,
    requiredContentId: /^\d{1,20}$/.test(contentId) ? contentId : undefined,
    requiredPlaceName: /^\d{1,20}$/.test(contentId) ? place.name : undefined };
}
export function minutes(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [h,m] = time.split(':').map(Number); return h! * 60 + m!;
}
export function conditionSchedule(cond:Pick<Condition,'date'|'endDate'|'startTime'|'endTime'|'endTimeLimited'|'daySchedules'>,date:string) {
  return scheduleForDate({travelDate:cond.date,travelEndDate:cond.endDate,startTime:cond.startTime,endTime:cond.endTimeLimited?cond.endTime:undefined,daySchedules:cond.daySchedules},date);
}
export function withTripRange(old:Condition,date:string,endDate:string):Condition {
  const daySchedules=Object.fromEntries(tripDates(date,endDate).map((day,i)=>[day,old.daySchedules?.[day]??{startTime:i===0?old.startTime:'09:00',endTime:day===endDate&&old.endTimeLimited?old.endTime:undefined}]));
  const next={...old,date,endDate,daySchedules,startTime:daySchedules[date]?.startTime||old.startTime,endTime:daySchedules[endDate]?.endTime||old.endTime,endTimeLimited:!!daySchedules[endDate]?.endTime};
  return {...next,meals:normalizeMeals(next)};
}
type MealCondition=Pick<Condition,'startTime'|'endTime'|'endTimeLimited'> & Partial<Pick<Condition,'date'|'endDate'|'daySchedules'>>;
export function availableMeals(cond:MealCondition) {
  const days=cond.date?tripDates(cond.date,cond.endDate||cond.date):[];
  const windows=days.length?days.map(date=>conditionSchedule({...cond,date:cond.date!,endDate:cond.endDate||cond.date!},date)):[{startTime:cond.startTime,endTime:cond.endTimeLimited?cond.endTime:undefined}];
  const kinds=new Set(windows.flatMap(mealsForSchedule));
  return [['아침','breakfast'],['점심','lunch'],['저녁','dinner']].filter(([,id])=>kinds.has(id as 'breakfast'|'lunch'|'dinner')).map(([label])=>label!);
}
export function normalizeMeals(cond:MealCondition & Pick<Condition,'meals'>) {
  return cond.meals.includes('자동') ? ['자동'] : [...new Set(cond.meals)].filter(m=>availableMeals(cond).includes(m));
}
export function conditionError(cond: Condition, step = 4) {
  if (!cond.departure.trim() || !Number.isFinite(cond.departureLat) || !Number.isFinite(cond.departureLng)
    || Math.abs(cond.departureLat!)>90 || Math.abs(cond.departureLng!)>180) return '검색 결과에서 출발지를 선택해 주세요.';
  if (step < 2) return '';
  if (!cond.region) return '여행지를 선택해 주세요.';
  if (!normalizeDate(cond.date) || cond.date < todayKorea()) return '오늘 이후의 여행 날짜를 선택해 주세요.';
  if (!tripDates(cond.date,cond.endDate||cond.date).length) return '여행 기간은 시작일부터 최대 7일로 선택해 주세요.';
  for(const date of tripDates(cond.date,cond.endDate||cond.date)){const error=scheduleError(conditionSchedule(cond,date));if(error)return date+' · '+error;}
  if (cond.requiredPlace) {
    if (cond.region !== cond.requiredPlace.city) return '선택한 장소와 같은 여행지를 선택하거나 포함 장소를 해제해 주세요.';
    if (cond.requiredPlace.source === 'festival' || cond.requiredPlace.category === '축제·행사') {
      const from=normalizeDate(cond.requiredPlace.eventStartDate),to=normalizeDate(cond.requiredPlace.eventEndDate);
      if (!from || !to || cond.date<from || cond.date>to) return '행사 기간 안에서 여행 날짜를 선택해 주세요.';
    }
  }
  return step>=4 && !cond.purpose.length ? '여행 목적을 하나 이상 선택해 주세요.' : '';
}
export function canPreviewCourse(course: RankedCourse) {
  const valid=(p?: {latitude?:number;longitude?:number})=>Boolean(p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude!)<=90 && Math.abs(p.longitude!)<=180);
  return valid(course.origin) && course.places.length>0 && course.places.every(valid);
}
export function acceptedCourses(source:string, courses:RankedCourse[]) {
  return ['tour-api','kakao','mixed'].includes(source) ? courses.filter(c=>c.constraintPassed && canPreviewCourse(c)) : [];
}
export function formatMinutes(value:number) { const n=Math.round(value); return `${Math.floor(n/60) ? `${Math.floor(n/60)}시간 ` : ''}${n%60 ? `${n%60}분` : n ? '' : '0분'}`.trim(); }
