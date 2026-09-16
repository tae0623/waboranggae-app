import {kakaoDirectionsUrl} from '../../../../src/domain/kakaoLinks';
import {Course, Place, RouteOrigin, TravelPreferences} from '../../../../src/types/travel';
import {clockMinutes, mealWindowsFor} from '../../../../src/domain/tripWindow';
import {isRequiredPlace} from './planner';
import {searchPlaces} from '../places/search';
import {fetchKakaoRoute} from './data/kakao';
import {resolveStartOrigin} from './data/geocoder';

export function belongsToCity(address:string,city:string) {
  const escaped=city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:시|군)?(?:\\s|$)`).test(address);
}

/** The selected start is not replaced silently: the access trip remains a separate response object. */
export async function prepareLocalTrip(preferences:TravelPreferences) {
  if(preferences.timeBudgetMode!=='local')return {preferences};
  const origin=await resolveStartOrigin(preferences);
  if(!origin || belongsToCity(origin.address,preferences.city))return {preferences};
  const queries=preferences.preferredTransit?.includes('train')
    ? [`${preferences.city}역`,`${preferences.city} 버스터미널`]
    : [`${preferences.city} 버스터미널`];
  let arrival:RouteOrigin|undefined;
  for(const query of queries) {
    const candidates=await searchPlaces(query);
    const place=candidates.find(p=>belongsToCity(p.address,preferences.city) && /터미널|역$/.test(p.name));
    if(place){arrival={name:place.name,address:place.address,latitude:place.latitude,longitude:place.longitude,source:'places'};break;}
  }
  if(!arrival) {
    const place=(await searchPlaces(`${preferences.city} 청사`)).find(p=>belongsToCity(p.address,preferences.city));
    if(place)arrival={name:place.name,address:place.address,latitude:place.latitude,longitude:place.longitude,source:'places'};
  }
  if(!arrival)throw Object.assign(new Error('여행 도시의 도착 거점을 찾지 못했습니다. 해당 도시의 터미널·숙소를 출발지로 선택해 주세요.'),{status:503});
  const local:TravelPreferences={...preferences,startLocation:arrival.name,startAddress:arrival.address,
    startLatitude:arrival.latitude,startLongitude:arrival.longitude,startType:/터미널/.test(arrival.name)?'terminal':/역$/.test(arrival.name)?'station':'custom'};
  return {preferences:local,origin,arrival};
}

export async function appendAccessTrip<T extends Course>(context:Awaited<ReturnType<typeof prepareLocalTrip>>,courses:T[]) {
  if(!context.origin || !context.arrival)return courses.map(c=>({...c,timeBudgetMode:context.preferences.timeBudgetMode}));
  if(!courses.length)return courses;
  // One shared lookup for the journey to the city; never counted against the local itinerary or score.
  const segment=await fetchKakaoRoute(context.origin,context.arrival,'transit').catch(()=>null);
  const accessTrip={origin:context.origin,arrival:context.arrival,segment,externalUrl:kakaoDirectionsUrl(context.origin,context.arrival,'transit'),excludedFromBudget:true as const};
  return courses.map(c=>({...c,timeBudgetMode:'local' as const,accessTrip}));
}

export function preferencesForCourse(preferences:TravelPreferences,course:Course):TravelPreferences {
  const start=course.accessTrip?.arrival;
  return preferences.timeBudgetMode==='local' && start ? {...preferences,startLocation:start.name,startAddress:start.address,
    startLatitude:start.latitude,startLongitude:start.longitude,startType:/터미널/.test(start.name)?'terminal':/역$/.test(start.name)?'station':'custom'} : preferences;
}

/** Only explicit removals relax the corresponding visit/meal request, never a recommendation fallback. */
export function preferencesForSelection(preferences:TravelPreferences,course:Course,places:Place[]):TravelPreferences {
  const local=preferencesForCourse(preferences,course);
  if(local.scheduleMode!=='course-first')return local;
  const ids=new Set(places.map(p=>p.id));
  const removed=course.places.filter(p=>!ids.has(p.id));
  const next={...local};
  if(removed.some(p=>isRequiredPlace(p,local))){next.requiredContentId=undefined;next.requiredPlaceName=undefined;}
  if(removed.some(p=>p.category==='food')){
    const windows=mealWindowsFor(local);
    next.meals=[...new Set(places.filter(p=>p.category==='food').flatMap(p=>{
      const minute=clockMinutes(p.arrival);
      const window=windows.find(w=>minute>=w.start&&minute<=w.end);
      return window?[window.kind]:[];
    }))];
    next.mealPreference=next.meals.length?'auto':'none';
  }
  return next;
}
