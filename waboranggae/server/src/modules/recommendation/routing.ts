import {
  Course,
  Place,
  RouteOrigin,
  RouteSegment,
  RoutingSource,
  TravelPreferences,
} from '../../../../src/types/travel';
import { distanceKm } from '../../utils/geo';
import { nearbyLinksScore, walkingEaseScore } from '../../../../src/domain/walkability';
import { resolveStartOrigin } from './data/geocoder';
import {
  fetchTmapTransitRoute,
  isTmapTransitConfigured,
  RoutingPoint,
} from './data/tmap-transit';
import { stepsFromEstimate } from './transit-instruction';
import {
  formatClock,
  maximumStayMinutes,
  mealWindowsFor,
  minimumStayMinutes,
  parseClock,
  tripEndClock,
} from './planner';
import { skipNightClock, planningHours } from '../../../../src/domain/tripWindow';

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

function searchDateTime(preferences: TravelPreferences) {
  if (!preferences.travelDate) return undefined;
  const date = preferences.travelDate.replace(/-/g, '').slice(0, 8);
  const time = preferences.startTime.replace(':', '');
  return /^\d{12}$/.test(`${date}${time}`) ? `${date}${time}` : undefined;
}

async function routeBetween(
  from: RoutingPoint,
  to: RoutingPoint,
  preferences: TravelPreferences,
  allowLive: boolean,
) {
  const live = allowLive
    ? await fetchTmapTransitRoute(from, to, searchDateTime(preferences))
    : null;
  return live ?? estimateRoute(from, to);
}

function routingSource(segments: RouteSegment[]): RoutingSource {
  const liveCount = segments.filter((segment) => segment.source === 'tmap-transit').length;
  if (!liveCount) return 'estimated';
  return liveCount === segments.length ? 'tmap-transit' : 'mixed';
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
    clock = skipNightClock(clock, tripStart);
    const mealWindow = place.category === 'food' ? windows[mealIndex] : undefined;
    if (mealWindow && clock < mealWindow.start) clock = mealWindow.start;
    clock = skipNightClock(clock, tripStart);
    const arrival = formatClock(clock);
    const stayMinutes = stays[index] ?? minimumStayMinutes(place.category);
    clock += stayMinutes;
    clock = skipNightClock(clock, tripStart);
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
  const stays = places.map((place) => Math.max(minimumStayMinutes(place.category), place.stayMinutes));
  const targetEnd = tripEndClock(preferences);
  let scheduled = buildSchedule(preferences, places, segments, stays);

  if (scheduled.endClock > targetEnd) {
    for (let index = stays.length - 1; index >= 0 && scheduled.endClock > targetEnd; index -= 1) {
      const place = places[index];
      if (!place) continue;
      const floor = minimumStayMinutes(place.category);
      const reduction = Math.min((stays[index] ?? floor) - floor, scheduled.endClock - targetEnd);
      stays[index] = (stays[index] ?? floor) - Math.max(0, reduction);
      scheduled = buildSchedule(preferences, places, segments, stays);
    }
  } else if (scheduled.endClock < targetEnd) {
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
      stays[index] = (stays[index] ?? 0) + extra;
      scheduled = buildSchedule(preferences, places, segments, stays);
    }
  }

  return scheduled;
}

async function routeCourse(
  preferences: TravelPreferences,
  course: Course,
  origin: RouteOrigin,
  allowLive: boolean,
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
  const segments = await Promise.all(
    routablePlaces.map((_, index) => routeBetween(points[index]!, points[index + 1]!, preferences, allowLive)),
  );
  const source = routingSource(segments);
  const scheduled = balanceSchedule(preferences, course.places, segments);
  const walkMinutes = segments.reduce((sum, segment) => sum + segment.walkMinutes, 0);
  const transitMinutes = segments.reduce((sum, segment) => sum + segment.transitMinutes, 0);
  const distance = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  const start = parseClock(preferences.startTime);
  const durationHours = Math.round((scheduled.endClock - start) / 6) / 10;
  const routingNote = source === 'tmap-transit'
    ? 'TMAP 대중교통 실제 경로 반영'
    : source === 'mixed'
      ? '일부 구간 TMAP 실제 경로 반영'
      : `출발 거점 실좌표 반영 · ${isTmapTransitConfigured()
        ? allowLive ? '길찾기 실패 또는 호출 보호 한도로 좌표 추정' : '무료 호출 보호를 위해 예비 코스는 좌표 추정'
        : 'TMAP 키 미설정으로 이동시간 추정'}`;

  return {
    ...course,
    durationHours,
    distanceKm: Math.round(distance * 10) / 10,
    walkMinutes,
    transitMinutes,
    metrics: {
      ...course.metrics,
      walkingEase: walkingEaseScore(walkMinutes, planningHours(preferences), preferences.pace),
      nearbyLinks: nearbyLinksScore(distance, segments.length),
    },
    places: scheduled.places,
    origin,
    routeSource: source,
    routeSegments: segments,
    validationNotes: [...new Set([...(course.validationNotes || []), routingNote])],
  };
}

/** 추천 시간표와 지도에 같은 출발 거점 및 구간 경로를 주입합니다. */
export async function attachRoutingToCourses(
  preferences: TravelPreferences,
  courses: Course[],
): Promise<Course[]> {
  const origin = await resolveStartOrigin(preferences);
  if (!origin) return courses;
  const liveCourseLimit = Math.max(0, Number(process.env.TMAP_LIVE_COURSE_LIMIT || 1));
  return Promise.all(courses.map((course, index) => routeCourse(
    preferences,
    course,
    origin,
    index < liveCourseLimit,
  )));
}

export const routingTestUtils = { estimateRoute };
