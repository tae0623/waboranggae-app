import {
  Course,
  Place,
  RouteOrigin,
  RouteSegment,
  RoutingSource,
  TravelPreferences,
  RoutingPoint,
} from '../../../../src/types/travel';
import { distanceKm } from '../../utils/geo';
import { nearbyLinksScore, walkingEaseScore } from '../../../../src/domain/walkability';
import { resolveStartOrigin } from './data/geocoder';
import { stepsFromEstimate } from './transit-instruction';
import {
  formatClock,
  maximumStayMinutes,
  mealWindowsFor,
  minimumStayMinutes,
  parseClock,
  tripEndClock,
  validateScheduledPlaces,
} from './planner';
import { skipNightClock, planningHours } from '../../../../src/domain/tripWindow';
import {fetchKakaoRoute} from './data/kakao';

function hasCoordinates(place: Place): place is Place & { latitude: number; longitude: number } {
  return Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

function estimateRoute(from: RoutingPoint, to: RoutingPoint): RouteSegment {
  const directDistance = distanceKm(from, to);
  const walkingOnly = directDistance <= 1.2;
  const walkMinutes = walkingOnly
    ? Math.max(1, Math.ceil(directDistance / 4.2 * 60))
    : Math.min(12, Math.max(6, Math.ceil(directDistance * 1.5)));
  const transitMinutes = walkingOnly ? 0 : Math.max(8, Math.ceil(directDistance / 18 * 60) + 5);
  const estimated = stepsFromEstimate({
    walkMinutes,
    transitMinutes,
    fromName: from.name,
    toName: to.name,
  });
  return {
    fromName: from.name,
    toName: to.name,
    distanceKm: Math.round(directDistance * 10) / 10,
    totalMinutes: walkMinutes + transitMinutes,
    walkMinutes,
    transitMinutes,
    modeLabel: estimated.modeLabel,
    instruction: estimated.instruction,
    steps: estimated.steps,
    source: 'estimated',
    geometry: [
      { latitude: from.latitude, longitude: from.longitude },
      { latitude: to.latitude, longitude: to.longitude },
    ],
  };
}

type RoutingLookup = { remaining:number; pending:Map<string,Promise<RouteSegment|null>> };

async function routeBetween(
  from: RoutingPoint,
  to: RoutingPoint,
  live=false,
  preferences?:TravelPreferences,
  lookup?:RoutingLookup,
) {
  if(live){
    const get=(mode:'walk'|'transit')=>{
      const key=`${from.latitude},${from.longitude}|${to.latitude},${to.longitude}|${mode}`;
      const pending=lookup?.pending.get(key);if(pending)return pending;
      if(lookup && lookup.remaining<=0)return Promise.resolve(null);
      if(lookup)lookup.remaining--;
      const request=fetchKakaoRoute(from,to,mode).then(segment=>segment?{...segment,fromName:from.name,toName:to.name}:null);
      lookup?.pending.set(key,request);return request;
    };
    const distance=distanceKm(from,to);
    if(distance>=0.6 && distance<=2){
      const [walk,transit]=await Promise.all([get('walk'),get('transit')]);
      const walkLimit=preferences?.lowMobility || preferences?.pace==='easy'?15:25;
      if(walk && walk.totalMinutes<=walkLimit && (!transit || walk.totalMinutes<=transit.totalMinutes+3))return walk;
      if(transit)return transit;
      if(walk)return walk;
    } else {
      const route=await get(distance<0.6?'walk':'transit');if(route)return route;
    }
  }
  return estimateRoute(from, to);
}

function routingSource(segments: RouteSegment[]): RoutingSource {
  const liveCount = segments.filter((segment) => segment.source === 'kakao').length;
  if (!liveCount) return 'estimated';
  return liveCount === segments.length ? 'kakao' : 'mixed';
}

function routingStayFloor(preferences:TravelPreferences,category:Place['category']) {
  if(preferences.timeBudgetMode!=='local')return minimumStayMinutes(category);
  return category==='food'?45:category==='cafe'||category==='market'?40:category==='station'?0:60;
}

function buildSchedule(
  preferences: TravelPreferences,
  places: Place[],
  segments: RouteSegment[],
  stays: number[],
) {
  const windows = mealWindowsFor(preferences);
  let mealIndex = 0;
  let clock = parseClock(preferences.startTime);
  const tripStart = clock;
  const scheduled = places.map((place, index) => {
    const segment = segments[index];
    if (segment) clock += segment.totalMinutes;
    if (preferences.travelEndDate && preferences.travelEndDate !== preferences.travelDate) clock = skipNightClock(clock, tripStart);
    const mealWindow = place.category === 'food' ? windows[mealIndex] : undefined;
    if (mealWindow && clock < mealWindow.start) clock = mealWindow.start;
    if (preferences.travelEndDate && preferences.travelEndDate !== preferences.travelDate) clock = skipNightClock(clock, tripStart);
    const arrival = formatClock(clock);
    const stayMinutes = stays[index] ?? routingStayFloor(preferences,place.category);
    clock += stayMinutes;
    if (preferences.travelEndDate && preferences.travelEndDate !== preferences.travelDate) clock = skipNightClock(clock, tripStart);
    if (mealWindow) mealIndex += 1;
    const routeText = segment?.instruction
      || (segment
        ? `${segment.modeLabel} ${segment.totalMinutes}분`
        : '이동');
    return {
      ...place,
      arrival,
      stayMinutes,
      moveMinutes: segment?.totalMinutes,
      walkMinutesFromPrevious: segment?.walkMinutes,
      transitMinutesFromPrevious: segment?.transitMinutes,
      routeSource: segment?.source,
      transitSteps: segment?.steps,
      moveLabel: index === 0
        ? `${segment?.fromName ?? preferences.startLocation}에서 ${preferences.startTime} 출발 · ${routeText}`
        : `${routeText}${mealWindow ? ' · 식사시간 맞춤' : ''}`,
    };
  });
  return { places: scheduled, endClock: clock };
}

function balanceSchedule(
  preferences: TravelPreferences,
  places: Place[],
  segments: RouteSegment[],
) {
  const stays = places.map((place) => Math.max(routingStayFloor(preferences,place.category), place.stayMinutes));
  const targetEnd = tripEndClock(preferences);
  let scheduled = buildSchedule(preferences, places, segments, stays);

  // A longer first leg can make lunch late even when the whole day still fits.
  // Reduce optional time BEFORE that meal, never shorten below category minimums.
  const windows=mealWindowsFor(preferences);
  let meal=0;
  for(let index=0;index<places.length;index++){
    if(places[index]?.category!=='food')continue;
    const window=windows[meal++];if(!window)continue;
    for(let earlier=index-1;earlier>=0;earlier--){
      const arrival=parseClock(scheduled.places[index]!.arrival)+Math.floor(window.start/1440)*1440;
      const late=arrival-window.end;if(late<=0)break;
      const floor=routingStayFloor(preferences,places[earlier]!.category);
      stays[earlier]=Math.max(floor,stays[earlier]!-late);
      scheduled=buildSchedule(preferences,places,segments,stays);
    }
  }

  if (scheduled.endClock > targetEnd) {
    for (let index = stays.length - 1; index >= 0 && scheduled.endClock > targetEnd; index -= 1) {
      const place = places[index];
      if (!place) continue;
      const floor = routingStayFloor(preferences,place.category);
      const reduction = Math.min((stays[index] ?? floor) - floor, scheduled.endClock - targetEnd);
      stays[index] = (stays[index] ?? floor) - Math.max(0, reduction);
      scheduled = buildSchedule(preferences, places, segments, stays);
    }
  } else if (scheduled.endClock < targetEnd && preferences.scheduleMode!=='course-first') {
    const lastMealIndex = places.findLastIndex((place) => place.category === 'food');
    const indexes = places
      .map((_, index) => index)
      .sort((a, b) => {
        const aAfterMeal = a >= Math.max(0, lastMealIndex) ? 1 : 0;
        const bAfterMeal = b >= Math.max(0, lastMealIndex) ? 1 : 0;
        return bAfterMeal - aAfterMeal || b - a;
      });
    for (const index of indexes) {
      const place = places[index];
      if (!place || scheduled.endClock >= targetEnd) break;
      const capacity = maximumStayMinutes(place.category) - (stays[index] ?? 0);
      const extra = Math.min(Math.max(0, capacity), targetEnd - scheduled.endClock);
      // Filling a day must not push a later meal beyond its arrival window.
      const old=stays[index]!;
      let low=0,high=extra;
      while(low<high){
        const add=Math.ceil((low+high)/2);stays[index]=old+add;
        const attempt=buildSchedule(preferences,places,segments,stays);
        const lateMeal=validateScheduledPlaces(preferences,attempt.places).some(v=>v.includes('식사 시간이'));
        if(attempt.endClock<=targetEnd&&!lateMeal)low=add;else high=add-1;
      }
      stays[index]=old+low;
      scheduled=buildSchedule(preferences,places,segments,stays);
    }
  }

  return scheduled;
}

async function routeCourse(
  preferences: TravelPreferences,
  course: Course,
  origin: RouteOrigin,
  live=false,
  lookup?:RoutingLookup,
): Promise<Course> {
  const routablePlaces = course.places.filter(hasCoordinates);
  if (routablePlaces.length !== course.places.length) return course;
  const points: RoutingPoint[] = [
    origin,
    ...routablePlaces.map((place) => ({
      name: place.name,
      latitude: place.latitude,
      longitude: place.longitude,
    })),
  ];
  let segments = await Promise.all(
    routablePlaces.map((_, index) => routeBetween(points[index]!, points[index + 1]!,live,preferences,lookup)),
  );
  let ordered=course.places;
  let scheduled = balanceSchedule(preferences, ordered, segments);
  // Keep all selected places. Move an overdue meal and its following cafe together.
  // Compare candidates locally; query at most one repaired order against the free API quota.
  if(validateScheduledPlaces(preferences,scheduled.places).some(v=>v.includes('식사 시간이'))){
    const known=new Map(segments.map((s,i)=>[`${i===0?'origin':ordered[i-1]!.id}|${ordered[i]!.id}`,s]));
    const variants:Place[][]=[];
    ordered.forEach((p,index)=>{
      if(p.category!=='food'||index===0||variants.length>=12)return;
      const length=ordered[index+1]?.category==='cafe'?2:1;
      const block=ordered.slice(index,index+length);
      const rest=ordered.filter((_,i)=>i<index||i>=index+length);
      for(let at=index-1;at>=0&&variants.length<12;at--)variants.push([...rest.slice(0,at),...block,...rest.slice(at)]);
    });
    const estimated=variants.map(places=>{
      const route=places.map((p,i)=>{
        const previous=i===0?origin:places[i-1]!;
        return known.get(`${i===0?'origin':places[i-1]!.id}|${p.id}`)??estimateRoute(previous as RoutingPoint,p as RoutingPoint);
      });
      const plan=balanceSchedule(preferences,places,route);
      return{places,route,plan,violations:validateScheduledPlaces(preferences,plan.places)};
    }).filter(v=>v.violations.length===0).sort((a,b)=>a.route.reduce((s,r)=>s+r.totalMinutes,0)-b.route.reduce((s,r)=>s+r.totalMinutes,0));
    const best=estimated[0];
    if(best){
      const route=live?await Promise.all(best.places.map((p,i)=>{
        const previous=i===0?origin:best.places[i-1]!;
        const existing=known.get(`${i===0?'origin':best.places[i-1]!.id}|${p.id}`);
        return existing?Promise.resolve(existing):routeBetween(previous as RoutingPoint,p as RoutingPoint,true,preferences,lookup);
      })):best.route;
      const plan=balanceSchedule(preferences,best.places,route);
      if(validateScheduledPlaces(preferences,plan.places).length===0){ordered=best.places;segments=route;scheduled=plan;}
    }
  }
  const source = routingSource(segments);
  const walkMinutes = segments.reduce((sum, segment) => sum + segment.walkMinutes, 0);
  const transitMinutes = segments.reduce((sum, segment) => sum + segment.transitMinutes, 0);
  const unclassifiedMinutes = segments.reduce((sum, segment) => sum + (segment.unclassifiedMinutes || 0), 0);
  const distance = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const start = parseClock(preferences.startTime);
  const durationHours = Math.round((scheduled.endClock - start) / 6) / 10;
  const totalMinutes=Math.round(scheduled.endClock-start);
  const stayMinutes=scheduled.places.reduce((sum,p)=>sum+p.stayMinutes,0);
  const originToFirstMinutes=segments[0]?.totalMinutes??0;
  const betweenPlacesMinutes=segments.slice(1).reduce((sum,s)=>sum+s.totalMinutes,0);
  const routingNote = source==='kakao'?'카카오 구간 시간 반영 · 조회 시점 기준':source==='mixed'?'카카오 시간 반영 · 일부 구간 추정':'이동 시간 추정';

  return {
    ...course,
    durationHours,
    distanceKm: Math.round(distance * 10) / 10,
    walkMinutes,
    transitMinutes,
    unclassifiedMinutes,
    metrics: {
      ...course.metrics,
      walkingEase: walkingEaseScore(walkMinutes, planningHours(preferences), preferences.pace),
      nearbyLinks: nearbyLinksScore(distance, segments.length),
    },
    places: scheduled.places,
    origin,
    routeSource: source,
    routingCheckedAt: live ? new Date().toISOString() : undefined,
    routeSegments: segments,
    timeBreakdown:{originToFirstMinutes,betweenPlacesMinutes,stayMinutes,waitAndRestMinutes:Math.max(0,totalMinutes-originToFirstMinutes-betweenPlacesMinutes-stayMinutes),totalMinutes,
      requestedMinutes:preferences.scheduleMode==='course-first'&&!preferences.endTime?undefined:tripEndClock(preferences)-start,
      overBudgetMinutes:Math.max(0,totalMinutes-(tripEndClock(preferences)-start))},
    validationNotes: [...new Set([...(course.validationNotes || []).filter(n=>!n.startsWith('출발 거점 실좌표')&&!n.startsWith('카카오 ')&&!n.startsWith('도보·대기 세부 시간')&&n!=='이동 시간 추정'), routingNote,
      ...(unclassifiedMinutes?[`도보·대기 세부 시간 ${unclassifiedMinutes}분 미제공 · 총 이동 시간에는 포함`]:[]),
      ...(ordered!==course.places?['식사 시간에 맞춰 방문 순서 조정']:[])])],
  };
}

/** 추천 시간표와 지도에 같은 출발 거점 및 구간 경로를 주입합니다. */
export async function attachRoutingToCourses(
  preferences: TravelPreferences,
  courses: Course[],
  options:{live?:boolean}={},
): Promise<Course[]> {
  const origin = await resolveStartOrigin(preferences);
  if (!origin) return courses;
  const lookup:RoutingLookup={remaining:24,pending:new Map()};
  return Promise.all(courses.map((course) => routeCourse(
    preferences,
    course,
    origin,
    options.live===true,
    lookup,
  )));
}

export const routingTestUtils = { estimateRoute, routeBetween };
