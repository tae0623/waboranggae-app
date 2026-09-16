import {
  Course,
  CoursePlanningSource,
  Interest,
  Place,
  PlaceCategory,
  TravelPreferences,
  WalkabilityMetrics,
} from '../../../../src/types/travel';
import { distanceKm, projectMapPoints } from '../../utils/geo';
import { nearbyLinksScore, walkingEaseScore } from '../../../../src/domain/walkability';
import { placePreferenceScore } from '../../../../src/domain/recommendScore';
import { placeNameWithoutCity } from '../../utils/placeName';
import {
  mealWindowsFor,
  tripEndClock,
  planningHours,
  skipNightClock,
  unfoldClock,
} from '../../../../src/domain/tripWindow';

export {mealWindowsFor, tripEndClock} from '../../../../src/domain/tripWindow';

export interface PlannedCourseOutline {
  title: string;
  placeIds: string[];
  rationale: string;
}

const INTEREST_LABELS: Record<Interest, string> = {
  nature: '자연',
  food: '미식',
  cafe: '카페',
  photo: '사진',
  market: '시장',
  history: '역사',
};

const PALETTES = [
  { accent: '#0D5C45', softAccent: '#DDF3A7' },
  { accent: '#347D91', softAccent: '#C9E8E8' },
  { accent: '#7A5A3A', softAccent: '#F0D7B3' },
];
const FIRST_MILE_MINUTES = 25;

export function parseClock(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 10 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatClock(totalMinutes: number) {
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function hasCoords(place: Place): place is Place & { latitude: number; longitude: number } {
  return Number.isFinite(place.latitude) && Number.isFinite(place.longitude);
}

export function isRequiredPlace(place:Pick<Place,"id">,preferences:TravelPreferences){
  return Boolean(preferences.requiredContentId && (place.id===preferences.requiredContentId || place.id===`tour-${preferences.requiredContentId}`));
}

export function collectPlanningCandidates(courses: Course[], preferences?: TravelPreferences) {
  const unique = new Map<string, Place>();
  for (const course of courses) {
    for (const place of course.places) {
      if (hasCoords(place) && !unique.has(place.id)) unique.set(place.id, place);
    }
  }
  const places = [...unique.values()];
  if (preferences) {
    places.sort((a, b) => Number(isRequiredPlace(b,preferences))-Number(isRequiredPlace(a,preferences))
      || placePreferenceScore(b, preferences) - placePreferenceScore(a, preferences));
  }
  return places.slice(0, 36);
}

function segmentDistance(a: Place, b: Place) {
  return hasCoords(a) && hasCoords(b) ? distanceKm(a, b) : 2;
}

function segmentMinutes(distance: number) {
  return distance <= 1.2 ? distance / 4.2 * 60 : distance / 18 * 60 + 8;
}

export function minimumStayMinutes(category: PlaceCategory) {
  if (category === 'food') return 60;
  if (category === 'cafe' || category === 'market') return 50;
  return 70;
}

export function maximumStayMinutes(category: PlaceCategory) {
  if (category === 'station') return 10;
  if (category === 'food') return 70;
  if (category === 'cafe') return 90;
  if (category === 'market') return 90;
  return 120;
}

function isMeal(place: Place) {
  return place.category === 'food';
}

function isCafe(place: Place) {
  return place.category === 'cafe';
}

function isSameDiningCategory(a: Place, b: Place) {
  return (isMeal(a) && isMeal(b)) || (isCafe(a) && isCafe(b));
}

function routeDistances(places: Place[]) {
  return places.slice(1).map((place, index) => segmentDistance(places[index] ?? place, place));
}

function schedulePlacesWithStays(
  preferences: TravelPreferences,
  sourcePlaces: Place[],
  stays: number[],
) {
  const distances = routeDistances(sourcePlaces);
  const projected = projectMapPoints(sourcePlaces.filter(hasCoords));
  const mealWindows = mealWindowsFor(preferences);
  let mealWindowIndex = 0;
  const first=sourcePlaces[0];
  const firstMinutes=preferences.scheduleMode==='course-first' && first && hasCoords(first)
    && Number.isFinite(preferences.startLatitude) && Number.isFinite(preferences.startLongitude)
    ? Math.max(1,Math.ceil(segmentMinutes(distanceKm({latitude:preferences.startLatitude!,longitude:preferences.startLongitude!},first)))) : FIRST_MILE_MINUTES;
  let clock = parseClock(preferences.startTime) + firstMinutes;
  const tripStart = parseClock(preferences.startTime);

  const places = sourcePlaces.map((place, index) => {
    const previousDistance = distances[index - 1];
    if (index > 0 && previousDistance !== undefined) clock += segmentMinutes(previousDistance);
    if (preferences.travelEndDate && preferences.travelEndDate !== preferences.travelDate) clock = skipNightClock(clock, tripStart);
    const mealWindow = isMeal(place) ? mealWindows[mealWindowIndex] : undefined;
    if (mealWindow && clock < mealWindow.start) clock = mealWindow.start;
    if (preferences.travelEndDate && preferences.travelEndDate !== preferences.travelDate) clock = skipNightClock(clock, tripStart);
    const arrival = formatClock(clock);
    const stay = stays[index] ?? minimumStayMinutes(place.category);
    clock += stay;
    if (preferences.travelEndDate && preferences.travelEndDate !== preferences.travelDate) clock = skipNightClock(clock, tripStart);
    if (mealWindow) mealWindowIndex += 1;
    return {
      ...place,
      arrival,
      stayMinutes: stay,
      moveLabel: index === 0
        ? `${preferences.startLocation}에서 ${preferences.startTime} 출발 · 첫 장소 이동 약 ${firstMinutes}분`
        : previousDistance !== undefined && previousDistance <= 1.2
          ? `직선거리 약 ${previousDistance.toFixed(1)}km · 도보 권장${mealWindow ? ' · 식사시간 맞춤' : ''}`
          : `직선거리 약 ${(previousDistance ?? 0).toFixed(1)}km · 대중교통 권장${mealWindow ? ' · 식사시간 맞춤' : ''}`,
      mapPoint: projected[index] ?? place.mapPoint,
    };
  });

  return { places, distances, endClock: clock };
}

/**
 * 짧은 고정 체류시간의 합을 그대로 노출하지 않고, 사용자가 고른 시간 예산까지
 * 주요 관광지의 관람·휴식 시간을 현실적인 상한 안에서 늘립니다. 식사 도착시간을
 * 최대한 보존하기 위해 마지막 식사 이후 장소부터 여유 시간을 배분합니다.
 */
function schedulePlaces(preferences: TravelPreferences, sourcePlaces: Place[]) {
  const stays: number[] = sourcePlaces.map((place) => minimumStayMinutes(place.category));
  let scheduled = schedulePlacesWithStays(preferences, sourcePlaces, stays);
  if(preferences.scheduleMode==='course-first')return scheduled;
  const targetEnd = tripEndClock(preferences);
  const lastMealIndex = sourcePlaces.findLastIndex(isMeal);
  const afterMeal = sourcePlaces
    .map((_, index) => index)
    .filter((index) => index >= Math.max(0, lastMealIndex))
    .reverse();
  const beforeMeal = sourcePlaces
    .map((_, index) => index)
    .filter((index) => index < Math.max(0, lastMealIndex))
    .reverse();

  for (const index of [...afterMeal, ...beforeMeal]) {
    const place = sourcePlaces[index];
    if (!place || scheduled.endClock >= targetEnd) break;
    const capacity = maximumStayMinutes(place.category) - (stays[index] ?? 0);
    if (capacity <= 0) continue;
    const extra = Math.min(capacity, Math.ceil(targetEnd - scheduled.endClock));
    stays[index] = (stays[index] ?? 0) + extra;
    scheduled = schedulePlacesWithStays(preferences, sourcePlaces, stays);
  }

  return scheduled;
}

export function minimumCourseDurationMinutes(durationHours: number) {
  const tolerance = durationHours <= 8 ? 30 : 60;
  return Math.max(90, durationHours * 60 - tolerance);
}

/** 도착 시각이 자정을 넘기면 날짜를 이어 붙여 실제 종료 시각을 복원합니다. */
function scheduledEndClock(preferences: TravelPreferences, places: Place[]) {
  let previous = parseClock(preferences.startTime);
  for (const place of places) {
    previous = unfoldClock(previous, parseClock(place.arrival)) + place.stayMinutes;
  }
  return previous;
}

export function validateScheduledPlaces(preferences: TravelPreferences, places: Place[]) {
  const violations: string[] = [];
  if(preferences.requiredContentId && !places.some(p=>isRequiredPlace(p,preferences)))
    violations.push('선택한 필수 방문지가 코스에 포함되지 않았습니다.');
  const seen = new Set<string>();
  for (let index = 0; index < places.length; index += 1) {
    const place = places[index];
    if (!place) continue;
    if (seen.has(place.id)) violations.push('같은 장소가 중복되었습니다.');
    seen.add(place.id);
    if (index > 0 && isMeal(place) && isMeal(places[index - 1]!)) {
      violations.push('음식점이 연속으로 배치되었습니다.');
    }
    if (index > 0 && isCafe(place) && isCafe(places[index - 1]!)) {
      violations.push('카페가 연속으로 배치되었습니다.');
    }
  }

  const mealPlaces = places.filter(isMeal);
  const cafePlaces = places.filter(isCafe);
  const windows = mealWindowsFor(preferences);
  if (!windows.length && mealPlaces.length) {
    violations.push('식사 제외 조건인데 음식점이 포함되었습니다.');
  }
  if (mealPlaces.length > windows.length) {
    violations.push('여행 시간에 필요한 수보다 음식점이 많이 포함되었습니다.');
  }
  const automaticMeals=preferences.scheduleMode==='course-first' && preferences.mealPreference==='auto' && preferences.meals===undefined;
  if (windows.length && mealPlaces.length < windows.length && !automaticMeals) {
    violations.push('선택한 식사 일정이 모두 반영되지 않았습니다.');
  }

  const arrivalClocks = new Map<string,number>();
  let previousClock=parseClock(preferences.startTime);
  for(const place of places){const absolute=unfoldClock(previousClock,parseClock(place.arrival));arrivalClocks.set(place.id,absolute);previousClock=absolute+place.stayMinutes;}
  const usedWindows = new Set<number>();
  for (const place of mealPlaces) {
    const arrival = arrivalClocks.get(place.id)!;
    const window = windows.find((candidate) =>
      !usedWindows.has(candidate.start) && arrival >= candidate.start && arrival <= candidate.end,
    );
    if (!window) {
      violations.push(`${place.name}의 식사 시간이 선택한 시간대와 맞지 않습니다.`);
    } else {
      usedWindows.add(window.start);
    }
  }

  if (mealPlaces.length && cafePlaces.length) {
    const firstCafeIndex = places.findIndex(isCafe);
    if (firstCafeIndex === 0 || !isMeal(places[firstCafeIndex - 1]!)) {
      violations.push('식사가 포함된 코스의 첫 카페는 식사 다음 순서에 배치해야 합니다.');
    }
  }

  const start = parseClock(preferences.startTime);
  const end = scheduledEndClock(preferences, places);
  const targetEnd = tripEndClock(preferences);
  if (end > targetEnd + (preferences.scheduleMode==='course-first'?0:25)) {
    violations.push('전체 일정이 선택한 여행 시간을 초과했습니다.');
  }
  if (preferences.scheduleMode!=='course-first' && end < start + minimumCourseDurationMinutes(planningHours(preferences))) {
    violations.push('전체 일정이 선택한 여행 시간에 비해 너무 짧습니다.');
  }

  const distances = routeDistances(places);
  const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);
  const maxSegment = distances.length ? Math.max(...distances) : 0;
  const budgetHours = planningHours(preferences);
  const maxSegmentKm = preferences.pace === 'easy' || preferences.lowMobility ? 5 : preferences.pace === 'full' ? 12 : 8;
  const maxTotalKm = preferences.pace === 'easy' || preferences.lowMobility
    ? Math.max(8, budgetHours * 2)
    : preferences.pace === 'full'
      ? Math.max(18, budgetHours * 4)
      : Math.max(12, budgetHours * 3);
  if (maxSegment > maxSegmentKm) violations.push('실제 환승 경로가 없는 장거리 단일 구간이 포함되었습니다.');
  if (totalDistance > maxTotalKm) violations.push('선택한 이동 강도에 비해 코스 권역이 너무 넓습니다.');

  return [...new Set(violations)];
}

function themeFor(preferences: TravelPreferences, places: Place[]) {
  const matched = Array.from(new Set(places.flatMap((place) => place.tags)))
    .filter((tag) => preferences.interests.includes(tag));
  return matched.slice(0, 2).map((tag) => INTEREST_LABELS[tag]).join('·') || '관광';
}

function shortPlaceName(name: string, city: string) {
  return placeNameWithoutCity(name, city);
}

/** 실제 방문 장소와 검증된 테마로 최종 목록에서 서로 구분되는 제목을 만듭니다. */
export function assignGroundedCourseTitles(preferences: TravelPreferences, courses: Course[]) {
  const usedTitles = new Set<string>();
  return courses.map((course, index) => {
    const activities = course.places.filter((place) => !isMeal(place) && !isCafe(place));
    const representatives = (activities.length ? activities : course.places).slice(0, 2);
    const placeLabel = representatives
      .map((place) => shortPlaceName(place.name, preferences.city))
      .join('·');
    const theme = themeFor(preferences, course.places);
    const baseTitle = `${preferences.city} ${placeLabel || theme} ${theme}길`;
    let title = baseTitle;
    if (usedTitles.has(title)) {
      const differentiator = course.places
        .map((place) => shortPlaceName(place.name, preferences.city))
        .find((name) => !title.includes(name));
      title = differentiator ? `${baseTitle}·${differentiator}` : `${baseTitle} ${index + 1}안`;
    }
    while (usedTitles.has(title)) title = `${baseTitle} ${index + 1}안`;
    usedTitles.add(title);
    const palette = PALETTES[index % PALETTES.length] ?? PALETTES[0]!;
    return { ...course, title, accent: palette.accent, softAccent: palette.softAccent };
  });
}

function buildCourse(
  preferences: TravelPreferences,
  sourcePlaces: Place[],
  index: number,
  planningSource: CoursePlanningSource,
  suppliedTitle?: string,
  adjusted = false,
) {
  if (sourcePlaces.length < (preferences.scheduleMode==='course-first'?1:2)) return null;
  const scheduled = schedulePlaces(preferences, sourcePlaces);
  const violations = validateScheduledPlaces(preferences, scheduled.places);
  if (violations.length) return null;

  const totalDistance = scheduled.distances.reduce((sum, value) => sum + value, 0);
  const walkingDistance = scheduled.distances.filter((value) => value <= 1.2).reduce((sum, value) => sum + value, 0);
  const transitDistances = scheduled.distances.filter((value) => value > 1.2);
  const walkMinutes = Math.round(walkingDistance / 4.2 * 60);
  const transitMinutes = FIRST_MILE_MINUTES
    + Math.round(transitDistances.reduce((sum, value) => sum + value / 18 * 60 + 8, 0));
  const maxSegment = scheduled.distances.length ? Math.max(...scheduled.distances) : 0;
  const metrics: WalkabilityMetrics = {
    transitAccess: Math.round(Math.max(55, 88 - maxSegment * 2)),
    walkingEase: walkingEaseScore(walkMinutes, planningHours(preferences), preferences.pace),
    nearbyLinks: nearbyLinksScore(totalDistance, Math.max(1, scheduled.distances.length)),
  };
  const start = parseClock(preferences.startTime);
  const durationHours = Math.round((scheduled.endClock - start) / 6) / 10;
  const palette = PALETTES[index % PALETTES.length] ?? PALETTES[0]!;
  const plannerLabel = planningSource === 'ollama' ? 'Ollama 일정 구성' : '시간 규칙 일정 구성';
  const title = suppliedTitle?.trim() || `${preferences.city} ${themeFor(preferences, scheduled.places)} 뚜벅이 코스 ${index + 1}`;

  return {
    id: `planned-${preferences.city}-${index + 1}-${scheduled.places.map((place) => place.id).join('-')}`,
    city: preferences.city,
    title,
    subtitle: `${plannerLabel} · 시간표 검증 완료`,
    accent: palette.accent,
    softAccent: palette.softAccent,
    durationHours,
    distanceKm: Math.round(totalDistance * 10) / 10,
    walkMinutes,
    transitMinutes,
    metrics,
    places: scheduled.places,
    planningSource,
    validationNotes: [
      ...(adjusted ? ['AI 순서 시간표 보정'] : []),
      `출발 거점 ${preferences.startLocation} 반영`,
      '식사 시간 검증',
      '식사 후 카페 순서 검증',
      '동일 식음 장소 연속 배치 방지',
      ...(preferences.scheduleMode==='course-first'?[]:[`선택 시간 ${planningHours(preferences)}시간 충족 검증`]),
    ],
  } satisfies Course;
}

export function desiredStopCount(durationHours: number) {
  return Math.max(2, Math.min(30, Math.round(durationHours / 1.5)));
}

export function stopBudgetHours(preferences: TravelPreferences) {
  return planningHours(preferences);
}

function lodgingPoint(preferences: TravelPreferences) {
  if (!Number.isFinite(preferences.lodgingLatitude) || !Number.isFinite(preferences.lodgingLongitude)) return null;
  return { latitude: preferences.lodgingLatitude!, longitude: preferences.lodgingLongitude! };
}

function mealSlotIndexes(preferences: TravelPreferences, stopCount: number) {
  const start = parseClock(preferences.startTime);
  const span = Math.max(60, planningHours(preferences) * 60);
  const interval = Math.max(70, Math.min(110, span / Math.max(stopCount, 1)));
  const indexes: number[] = [];
  const windows = mealWindowsFor(preferences);
  const reserveCafeAfterMeal = preferences.interests.includes('cafe') && windows.length > 0 && stopCount > 1;
  const maxMealIndex = reserveCafeAfterMeal ? stopCount - 2 : stopCount - 1;
  for (const window of windows) {
    const midpoint = (window.start + window.end) / 2;
    let elapsed=0;
    for(let day=0;day*1440<midpoint;day++)elapsed+=Math.max(0,Math.min(midpoint,day*1440+22*60)-Math.max(start,day*1440+8*60));
    let index = Math.max(0, Math.min(maxMealIndex, Math.round(elapsed / interval)));
    while (indexes.some((value) => Math.abs(value - index) <= 1) && index < maxMealIndex) index += 1;
    while (indexes.some((value) => Math.abs(value - index) <= 1) && index > 0) index -= 1;
    indexes.push(index);
  }
  return indexes;
}

function candidateScore(candidate: Place, previous: Place | undefined, preferences: TravelPreferences, previousCategory: PlaceCategory | undefined) {
  const preferenceBonus = placePreferenceScore(candidate, preferences) / 8;
  const modes = preferences.preferredTransit ?? ['bus'];
  const walkHeavy = modes.length === 1 && modes[0] === 'walk';
  const longOk = modes.includes('express') || modes.includes('train');
  const distanceWeight = walkHeavy ? 5.1 : longOk ? 2.4 : 3.2;
  const distancePenalty = previous ? segmentDistance(previous, candidate) * distanceWeight : 0;
  const lodging = lodgingPoint(preferences);
  const lodgingWeight = previous ? 3.4 : 1.2;
  const lodgingPenalty = lodging && hasCoords(candidate) ? distanceKm(lodging, candidate) * lodgingWeight : 0;
  const repeatPenalty = previousCategory === candidate.category ? 5 : 0;
  const refreshmentPenalty = previous && isSameDiningCategory(previous, candidate) ? 30 : 0;
  const imageBonus = candidate.imageUrl ? 1 : 0;
  return preferenceBonus + imageBonus - distancePenalty - lodgingPenalty - repeatPenalty - refreshmentPenalty;
}

function pickCandidate(
  pool: Place[],
  used: Set<string>,
  previous: Place | undefined,
  preferences: TravelPreferences,
  routeIndex: number,
) {
  const available = pool
    .filter((candidate) => !used.has(candidate.id))
    .sort((a, b) =>
      candidateScore(b, previous, preferences, previous?.category)
      - candidateScore(a, previous, preferences, previous?.category),
    );
  if (!available.length) return undefined;
  return available[Math.min(routeIndex, available.length - 1)] ?? available[0];
}

function buildRuleOutline(preferences: TravelPreferences, candidates: Place[], routeIndex: number) {
  const stopCount = Math.min(desiredStopCount(stopBudgetHours(preferences)), candidates.length);
  const slots: Array<'activity' | 'food' | 'cafe'> = Array.from({ length: stopCount }, () => 'activity');
  const mealIndexes = mealSlotIndexes(preferences, stopCount);
  for (const index of mealIndexes) slots[index] = 'food';

  if (preferences.interests.includes('cafe')) {
    const cafeIndex = mealIndexes
      .map((mealIndex) => mealIndex + 1)
      .find((index) => slots[index] === 'activity')
      ?? slots.findIndex((slot) => slot === 'activity');
    if (cafeIndex >= 0) slots[cafeIndex] = 'cafe';
  }

  const foods = candidates.filter((candidate) => candidate.category === 'food');
  const cafes = candidates.filter((candidate) => candidate.category === 'cafe');
  const activities = candidates.filter((candidate) => candidate.category !== 'food' && candidate.category !== 'cafe');
  const used = new Set<string>();
  const selected: Place[] = [];

  for (const slot of slots) {
    const preferredPool = slot === 'food' ? foods : slot === 'cafe' ? cafes : activities;
    const fallbackPool = slot === 'cafe' ? activities : preferredPool;
    const previous = selected.at(-1);
    const candidate = preferredPool.find(p=>isRequiredPlace(p,preferences) && !used.has(p.id))
      ?? pickCandidate(preferredPool, used, previous, preferences, routeIndex)
      ?? pickCandidate(fallbackPool, used, previous, preferences, routeIndex);
    if (!candidate) continue;
    selected.push(candidate);
    used.add(candidate.id);
  }

  return selected;
}

function buildProximityOutline(preferences: TravelPreferences, candidates: Place[], seedIndex: number) {
  const ranked = [...candidates].sort((a, b) => placePreferenceScore(b, preferences) - placePreferenceScore(a, preferences));
  const seed = ranked.find(p=>isRequiredPlace(p,preferences))
    ?? ranked.filter((place) => place.category !== 'food' && place.category !== 'cafe')[seedIndex]
    ?? ranked[seedIndex];
  if (!seed) return [];
  const used = new Set([seed.id]);
  const selected = [seed];
  const target = Math.min(desiredStopCount(stopBudgetHours(preferences)), candidates.length);
  while (selected.length < target) {
    const previous = selected.at(-1);
    const next = candidates
      .filter((candidate) => !used.has(candidate.id))
      .sort((a, b) =>
        candidateScore(b, previous, preferences, previous?.category)
        - candidateScore(a, previous, preferences, previous?.category),
      )[0];
    if (!next) break;
    selected.push(next);
    used.add(next.id);
  }
  return repairOutlinePlaces(preferences, selected, candidates);
}

export function buildRulePlannedCourses(preferences: TravelPreferences, candidates: Place[]) {
  const courses: Course[] = [];
  const outlines = [
    ...Array.from({ length: 5 }, (_, index) => buildRuleOutline(preferences, candidates, index)),
    ...Array.from({ length: 3 }, (_, index) => buildProximityOutline(preferences, candidates, index)),
  ];
  const variants=preferences.scheduleMode==='course-first'
    ? outlines.flatMap(places=>[places,...Array.from({length:Math.max(0,places.length-1)},(_,i)=>places.slice(0,places.length-i-1))]) : outlines;
  for (const places of variants) {
    const course = buildCourse(preferences, places, courses.length, 'rules');
    if (course && !courses.some((item) => item.places.map((place) => place.id).join('|') === course.places.map((place) => place.id).join('|'))) {
      courses.push(course);
    }
  }
  return courses;
}

function repairOutlinePlaces(preferences: TravelPreferences, selected: Place[], candidates: Place[]) {
  const requiredMeals = mealWindowsFor(preferences).length;
  const selectedMeals = selected.filter(isMeal);
  const additionalMeals = candidates.filter((candidate) =>
    isMeal(candidate) && !selected.some((place) => place.id === candidate.id),
  );
  const meals = [...selectedMeals, ...additionalMeals].slice(0, requiredMeals);
  if (meals.length < requiredMeals) return selected;

  const selectedCafes = preferences.interests.includes('cafe') ? selected.filter(isCafe) : [];
  const additionalCafes = candidates.filter((candidate) =>
    isCafe(candidate) && !selected.some((place) => place.id === candidate.id),
  );
  const cafePool = preferences.interests.includes('cafe') ? [...selectedCafes, ...additionalCafes] : [];

  const selectedActivities = selected.filter((place) => !isMeal(place) && !isCafe(place))
    .sort((a,b)=>Number(isRequiredPlace(b,preferences))-Number(isRequiredPlace(a,preferences)));
  const additionalActivities = candidates
    .filter((candidate) => !isMeal(candidate) && !isCafe(candidate) && !selected.some((place) => place.id === candidate.id))
    .sort((a, b) => {
      const distanceToSelection = (candidate: Place) => selected.length
        ? Math.min(...selected.map((place) => segmentDistance(place, candidate)))
        : 0;
      return distanceToSelection(a) - distanceToSelection(b);
    });
  const activities = [...selectedActivities, ...additionalActivities];
  const totalCount = Math.max(2, Math.min(
    desiredStopCount(stopBudgetHours(preferences)),
    activities.length + meals.length + cafePool.length,
  ));
  const mealIndexes = new Set(mealSlotIndexes(preferences, totalCount));
  const requestedCafeCount = Math.min(
    cafePool.length,
    selectedCafes.length || (cafePool.length ? 1 : 0),
  );
  const cafeIndexes = new Set<number>();
  const orderedCafeIndexes = mealIndexes.size
    ? [
      ...[...mealIndexes].map((mealIndex) => mealIndex + 1),
      ...Array.from({ length: totalCount }, (_, index) => index)
        .filter((index) => index > Math.min(...mealIndexes)),
    ]
    : Array.from({ length: totalCount }, (_, index) => index);
  for (const index of orderedCafeIndexes) {
    if (cafeIndexes.size >= requestedCafeCount) break;
    if (index < totalCount && !mealIndexes.has(index) && !cafeIndexes.has(index - 1) && !cafeIndexes.has(index + 1)) {
      cafeIndexes.add(index);
    }
  }
  const repaired: Place[] = [];
  let activityIndex = 0;
  let mealIndex = 0;
  let cafeIndexInPool = 0;
  for (let index = 0; index < totalCount; index += 1) {
    const next = mealIndexes.has(index)
      ? meals[mealIndex++]
      : cafeIndexes.has(index)
        ? cafePool[cafeIndexInPool++]
      : activities[activityIndex++];
    if (next) repaired.push(next);
  }
  return repaired;
}

export function buildCoursesFromOutlines(
  preferences: TravelPreferences,
  candidates: Place[],
  outlines: PlannedCourseOutline[],
) {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return outlines.flatMap((outline, index) => {
    const ids = [...new Set(outline.placeIds)];
    const places = ids.map((id) => byId.get(id)).filter((place): place is Place => Boolean(place));
    if (places.length < (preferences.scheduleMode==='course-first'?1:2) || places.length !== ids.length) return [];
    const repaired = repairOutlinePlaces(preferences, places, candidates);
    const adjusted = repaired.map((place) => place.id).join('|') !== places.map((place) => place.id).join('|');
    const course = buildCourse(preferences, repaired, index, 'ollama', outline.title, adjusted);
    return course ? [course] : [];
  });
}

export function mergePlannedCourses(
  preferences: TravelPreferences,
  sourceCourses: Course[],
  outlines: PlannedCourseOutline[] | null,
) {
  const candidates = collectPlanningCandidates(sourceCourses, preferences);
  const llmCourses = outlines ? buildCoursesFromOutlines(preferences, candidates, outlines) : [];
  const globalRuleCourses = buildRulePlannedCourses(preferences, candidates);
  // TourAPI가 구성한 근접 권역을 유지해 서로 먼 클러스터를 한 코스에 섞지 않습니다.
  const ruleCourses = sourceCourses.flatMap((sourceCourse) =>
    buildRulePlannedCourses(preferences, collectPlanningCandidates([sourceCourse], preferences)),
  );
  const merged: Course[] = [];
  for (const course of [...llmCourses, ...globalRuleCourses, ...ruleCourses]) {
    const signature = course.places.map((place) => place.id).join('|');
    if (!merged.some((item) => item.places.map((place) => place.id).join('|') === signature)) merged.push(course);
    if (merged.length === 24) break;
  }
  return assignGroundedCourseTitles(preferences, merged);
}
