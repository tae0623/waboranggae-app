import { INTEREST_LABELS } from './labels';
import { clampScore } from './walkability';
import { distanceKmBetween, lodgingProximityScore, mealWindowsFor, planningHours, unfoldClock, wallLimitMinutes } from './tripWindow';
import {
  Course,
  CourseScoreFacts,
  Interest,
  Place,
  PlaceCategory,
  RankedCourse,
  RecommendationReason,
  RecommendationScoreBreakdown,
  TravelPreferences,
  WalkingScoreBreakdown,
} from '../types/travel';

export const FINAL_SCORE_WEIGHTS = {
  preference: 0.4,
  walking: 0.35,
  timeFit: 0.15,
  courseQuality: 0.1,
} as const;

export const WALKING_SCORE_WEIGHTS = {
  walk: 0.35,
  transit: 0.25,
  time: 0.15,
  transfer: 0.1,
  distance: 0.05,
  efficiency: 0.1,
} as const;

export const MAX_WALKING_MINUTES = {
  easy: 60,
  balanced: 100,
  full: 150,
} as const;

export const MAX_TRANSFERS = {
  easy: 3,
  balanced: 4,
  full: 5,
} as const;

const INTERESTS: Interest[] = ['nature', 'food', 'cafe', 'photo', 'market', 'history'];

const CATEGORY_TAG_VECTOR: Record<PlaceCategory, Record<Interest, number>> = {
  nature: { nature: 1, food: 0, cafe: 0, photo: 0.9, market: 0, history: 0.1 },
  food: { nature: 0, food: 1, cafe: 0.15, photo: 0.25, market: 0.3, history: 0 },
  cafe: { nature: 0, food: 0.1, cafe: 1, photo: 0.8, market: 0, history: 0 },
  market: { nature: 0, food: 0.65, cafe: 0.2, photo: 0.5, market: 1, history: 0.25 },
  history: { nature: 0.2, food: 0, cafe: 0, photo: 0.7, market: 0, history: 1 },
  culture: { nature: 0.1, food: 0, cafe: 0.2, photo: 0.65, market: 0.1, history: 0.7 },
  station: { nature: 0, food: 0, cafe: 0, photo: 0.15, market: 0, history: 0.1 },
};

function parseClock(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function walkingLimit(preferences: TravelPreferences) {
  if (preferences.lowMobility) return MAX_WALKING_MINUTES.easy;
  return MAX_WALKING_MINUTES[preferences.pace];
}

function transferLimit(preferences: TravelPreferences) {
  if (preferences.lowMobility) return MAX_TRANSFERS.easy;
  return MAX_TRANSFERS[preferences.pace];
}

function maxDistanceKm(preferences: TravelPreferences) {
  const hours = planningHours(preferences);
  if (preferences.pace === 'easy' || preferences.lowMobility) {
    return Math.max(8, hours * 2);
  }
  if (preferences.pace === 'full') return Math.max(18, hours * 4);
  return Math.max(12, hours * 3);
}

export function countTransfers(course: Course) {
  if (course.routeSegments?.length) {
    const innerTransfers = course.routeSegments.reduce((sum, segment) => {
      const rides = (segment.steps || []).filter((step) => step.mode !== 'walk').length;
      return sum + Math.max(0, rides - 1);
    }, 0);
    const transitHops = course.routeSegments.filter((segment) => segment.transitMinutes > 0).length;
    return innerTransfers + Math.max(0, transitHops - 1);
  }
  const timedHops = course.places.filter((place) => (place.transitMinutesFromPrevious ?? 0) > 0);
  if (timedHops.length) return Math.max(0, timedHops.length - 1);
  const labeledHops = course.places.filter((place) => /버스|지하철|대중교통|환승/.test(place.moveLabel));
  return Math.max(0, labeledHops.length - 1);
}

export function collectCourseFacts(course: Course): CourseScoreFacts {
  const stayMinutes = course.places.reduce((sum, place) => sum + place.stayMinutes, 0);
  const walkMinutes = course.walkMinutes;
  const transitMinutes = course.transitMinutes;
  const moveMinutes = walkMinutes + transitMinutes;
  const first = course.places[0];
  let scheduledMinutes = 0;
  if (first) {
    let previous = parseClock(first.arrival);
    let end = previous + first.stayMinutes;
    for (const place of course.places.slice(1)) {
      const arrival = unfoldClock(end, parseClock(place.arrival));
      end = arrival + place.stayMinutes;
    }
    scheduledMinutes = end - parseClock(first.arrival)
      + (first.walkMinutesFromPrevious ?? 0)
      + (first.transitMinutesFromPrevious ?? 0);
  }
  const tripMinutes = course.timeBreakdown?.totalMinutes ?? (scheduledMinutes > 0
    ? scheduledMinutes
    : Math.max(Math.round(course.durationHours * 60), stayMinutes + moveMinutes));
  const hopCount = Math.max(1, course.routeSegments?.length ?? Math.max(1, course.places.length - (course.origin ? 0 : 1)));
  const evidence = course.transitAccessEvidence ?? [];
  const averageStopDistanceMeters = evidence.length
    ? Math.round(evidence.reduce((sum, item) => sum + item.distanceMeters, 0) / evidence.length)
    : null;

  return {
    walkMinutes,
    transitMinutes,
    moveMinutes,
    stayMinutes,
    tripMinutes,
    transferCount: countTransfers(course),
    distanceKm: course.distanceKm,
    averageMoveMinutes: Math.round(moveMinutes / hopCount),
    stayRatio: stayMinutes / Math.max(1, tripMinutes),
    averageStopDistanceMeters,
  };
}

export function hardConstraintViolations(preferences: TravelPreferences, facts: CourseScoreFacts) {
  const violations: string[] = [];
  if (facts.walkMinutes > walkingLimit(preferences)) {
    violations.push(`총 도보 ${facts.walkMinutes}분이 허용 ${walkingLimit(preferences)}분을 넘습니다.`);
  }
  if (facts.transferCount > transferLimit(preferences)) {
    violations.push(`환승 ${facts.transferCount}회가 허용 ${transferLimit(preferences)}회를 넘습니다.`);
  }
  if (facts.tripMinutes > wallLimitMinutes(preferences) + (preferences.scheduleMode==='course-first'||preferences.timeBudgetMode==='local'?0:30)) {
    violations.push(`총 소요 ${facts.tripMinutes}분이 선택한 여행 시간을 넘습니다.`);
  }
  return violations;
}

export function userPreferenceVector(preferences: TravelPreferences): Record<Interest, number> {
  const selected = new Set(preferences.interests);
  const vector = Object.fromEntries(INTERESTS.map((key) => [key, selected.has(key) ? 1 : 0])) as Record<Interest, number>;

  // Photo is a cross-category preference, not a second competing destination category.
  if (selected.has('photo') && selected.size>1) vector.photo=0.35;
  if (preferences.preferLocal) {
    vector.market = Math.min(1, vector.market + 0.35);
    vector.food = Math.min(1, vector.food + 0.2);
  }
  if (/아이|부모|가족/.test(preferences.companions)) {
    vector.cafe = Math.min(1, vector.cafe + 0.15);
    vector.market = Math.min(1, vector.market + 0.15);
  } else if (/연인/.test(preferences.companions)) {
    vector.cafe = Math.min(1, vector.cafe + 0.2);
    vector.photo = Math.min(1, vector.photo + 0.15);
  }

  if (INTERESTS.every((key) => vector[key] === 0)) vector.nature = 1;
  return vector;
}

export function placeTagVector(place: { category: PlaceCategory; tags: readonly Interest[] }): Record<Interest, number> {
  const vector = { ...CATEGORY_TAG_VECTOR[place.category] };
  for (const tag of place.tags) {
    vector[tag] = Math.max(vector[tag], 1);
  }
  return vector;
}

export function placePreferenceScore(place: { category: PlaceCategory; tags: readonly Interest[] }, preferences: TravelPreferences) {
  const user = userPreferenceVector(preferences);
  const tags = placeTagVector(place);
  const weightSum = INTERESTS.reduce((sum, key) => sum + user[key], 0);
  if (!weightSum) return 0;
  const weighted = INTERESTS.reduce((sum, key) => sum + user[key] * tags[key], 0);
  return clampScore((weighted / weightSum) * 100);
}

function cosineSimilarity(a: Record<Interest, number>, b: Record<Interest, number>) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const key of INTERESTS) {
    dot += a[key] * b[key];
    magA += a[key] * a[key];
    magB += b[key] * b[key];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function preferenceScore(preferences: TravelPreferences, course: Course) {
  const user = userPreferenceVector(preferences);
  const visits = course.places.filter((place) => place.category !== 'station');
  const targets = visits.length ? visits : course.places;
  const placeFits = targets.map((place) => placePreferenceScore(place, preferences));
  const averagePlaceFit = placeFits.reduce((sum, value) => sum + value, 0) / Math.max(1, placeFits.length);

  const selected = preferences.interests.length ? preferences.interests : (['nature'] as Interest[]);
  const purposeFit = selected.reduce((sum, interest) => {
    const best = Math.max(...targets.map((place) => placeTagVector(place)[interest]));
    return sum + best;
  }, 0) / selected.length;

  const courseVector = Object.fromEntries(INTERESTS.map((key) => [
    key,
    targets.reduce((sum, place) => sum + placeTagVector(place)[key], 0) / Math.max(1, targets.length),
  ])) as Record<Interest, number>;
  const similarity = cosineSimilarity(user, courseVector);

  return clampScore(averagePlaceFit * 0.55 + purposeFit * 100 * 0.3 + similarity * 100 * 0.15);
}

function walkComponent(walkMinutes: number, maxWalk: number) {
  if (maxWalk <= 0) return 0;
  return clampScore(100 * (1 - walkMinutes / maxWalk));
}

function transferComponent(transfers: number) {
  if (transfers <= 0) return 100;
  if (transfers === 1) return 90;
  if (transfers === 2) return 75;
  if (transfers === 3) return 50;
  if (transfers === 4) return 25;
  return 0;
}

function accessFromDistance(meters: number) {
  if (meters <= 80) return 100;
  if (meters >= 1500) return 0;
  return clampScore(100 - (meters - 80) / 1420 * 100);
}

function frequencyScore(intervalMinutes: number | null, routeCount: number | null) {
  const interval = intervalMinutes == null
    ? 55
    : intervalMinutes <= 8
      ? 100
      : intervalMinutes >= 60
        ? 20
        : clampScore(100 - (intervalMinutes - 8) / 52 * 80);
  const supply = routeCount == null
    ? 60
    : routeCount >= 5
      ? 100
      : routeCount <= 0
        ? 15
        : clampScore(40 + routeCount * 12);
  return clampScore(interval * 0.55 + supply * 0.45);
}

function transitComponent(course: Course, facts: CourseScoreFacts, preferences: TravelPreferences) {
  const evidence = course.transitAccessEvidence ?? [];
  const access = evidence.length
    ? evidence.reduce((sum, item) => sum + accessFromDistance(item.distanceMeters), 0) / evidence.length
    : course.metrics.transitAccess;
  const frequency = evidence.length
    ? evidence.reduce((sum, item) => sum + frequencyScore(item.typicalIntervalMinutes, item.routeCount), 0) / evidence.length
    : course.metrics.transitAccess * 0.7;
  const maxMove = Math.max(30, planningHours(preferences) * 60 * 0.4);
  const transitTime = clampScore(100 * (1 - facts.transitMinutes / maxMove));
  return clampScore(access * 0.45 + frequency * 0.25 + transitTime * 0.2 + transferComponent(facts.transferCount) * 0.1);
}

function moveTimeComponent(facts: CourseScoreFacts) {
  return clampScore(100 * (1 - facts.moveMinutes / Math.max(1, facts.tripMinutes)));
}

function distanceComponent(facts: CourseScoreFacts, preferences: TravelPreferences) {
  return clampScore(100 * (1 - facts.distanceKm / maxDistanceKm(preferences)));
}

function lodgingComponent(course: Course, preferences: TravelPreferences) {
  const latitude = preferences.lodgingLatitude;
  const longitude = preferences.lodgingLongitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const points = course.places.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  if (!points.length) return null;
  const averageKm = points.reduce((sum, place) => sum + distanceKmBetween(
    { latitude: latitude!, longitude: longitude! },
    { latitude: place.latitude!, longitude: place.longitude! },
  ), 0) / points.length;
  return lodgingProximityScore(averageKm);
}

function distanceWithLodging(
  facts: CourseScoreFacts,
  preferences: TravelPreferences,
  course: Course,
) {
  const spread = distanceComponent(facts, preferences);
  const lodging = lodgingComponent(course, preferences);
  if (lodging == null) return spread;
  return clampScore(spread * 0.45 + lodging * 0.55);
}

function efficiencyComponent(facts: CourseScoreFacts) {
  return clampScore((facts.stayRatio / 0.8) * 100);
}

export function walkingScoreBreakdown(
  preferences: TravelPreferences,
  course: Course,
  facts: CourseScoreFacts,
): WalkingScoreBreakdown {
  return {
    walk: walkComponent(facts.walkMinutes, walkingLimit(preferences)),
    transit: transitComponent(course, facts, preferences),
    time: moveTimeComponent(facts),
    transfer: transferComponent(facts.transferCount),
    distance: distanceWithLodging(facts, preferences, course),
    efficiency: efficiencyComponent(facts),
  };
}

export function walkingScore(breakdown: WalkingScoreBreakdown) {
  return clampScore(
    breakdown.walk * WALKING_SCORE_WEIGHTS.walk
    + breakdown.transit * WALKING_SCORE_WEIGHTS.transit
    + breakdown.time * WALKING_SCORE_WEIGHTS.time
    + breakdown.transfer * WALKING_SCORE_WEIGHTS.transfer
    + breakdown.distance * WALKING_SCORE_WEIGHTS.distance
    + breakdown.efficiency * WALKING_SCORE_WEIGHTS.efficiency,
  );
}

export function timeFitScore(preferences: TravelPreferences, facts: CourseScoreFacts) {
  if(preferences.scheduleMode==='course-first'){
    // No reward for padding stays to a hidden six-hour target. Prefer usable time over waiting.
    const waiting=Math.max(0,facts.tripMinutes-facts.stayMinutes-facts.moveMinutes);
    return clampScore(100-waiting/Math.max(1,facts.tripMinutes)*100
      -Math.max(0,facts.tripMinutes-wallLimitMinutes(preferences)));
  }
  const requested = planningHours(preferences) * 60;
  const actual = facts.stayMinutes + facts.moveMinutes;
  const delta = Math.abs(actual - requested);
  return clampScore(100 * (1 - delta / Math.max(45, requested * 0.35)));
}

function isMeal(place: Place) {
  return place.category === 'food';
}

function isCafe(place: Place) {
  return place.category === 'cafe';
}

function requestedMealCount(preferences: TravelPreferences) {
  return mealWindowsFor(preferences).length;
}

export function courseQualityScore(preferences: TravelPreferences, course: Course) {
  const places = course.places;
  const hours = planningHours(preferences);
  const desiredStops = Math.max(2, Math.min(10, Math.round(hours / 1.5)));
  const countFit = 100 - Math.min(50, Math.abs(places.length - desiredStops) * 18);

  const categories = new Set(places.map((place) => place.category));
  const diversity = clampScore((categories.size / Math.min(5, places.length)) * 100);

  let consecutivePenalty = 0;
  for (let index = 1; index < places.length; index += 1) {
    const previous = places[index - 1];
    const current = places[index];
    if (!previous || !current) continue;
    if ((isMeal(previous) && isMeal(current)) || (isCafe(previous) && isCafe(current))) {
      consecutivePenalty += 25;
    }
  }

  const meals = places.filter(isMeal);
  const mealTarget = requestedMealCount(preferences);
  const mealFit = mealTarget === 0
    ? meals.length === 0 ? 100 : 70
    : meals.length === mealTarget
      ? 100
      : meals.length > 0
        ? 60
        : 20;

  let cafeFit = 100;
  if (preferences.interests.includes('cafe') && meals.length) {
    const firstCafe = places.findIndex(isCafe);
    cafeFit = firstCafe > 0 && isMeal(places[firstCafe - 1]!) ? 100 : 45;
  }

  const lockerBonus = course.conveniences?.length ? 8 : 0;
  return clampScore(
    countFit * 0.25
    + diversity * 0.2
    + mealFit * 0.25
    + cafeFit * 0.15
    + (100 - consecutivePenalty) * 0.15
    + lockerBonus,
  );
}

export function finalRecommendationScore(breakdown: RecommendationScoreBreakdown) {
  return clampScore(
    breakdown.preference * FINAL_SCORE_WEIGHTS.preference
    + breakdown.walking * FINAL_SCORE_WEIGHTS.walking
    + breakdown.timeFit * FINAL_SCORE_WEIGHTS.timeFit
    + breakdown.courseQuality * FINAL_SCORE_WEIGHTS.courseQuality,
  );
}

function matchedInterestsFor(preferences: TravelPreferences, course: Course) {
  return Array.from(new Set(
    course.places.flatMap((place) => place.tags).filter((tag) => preferences.interests.includes(tag)),
  ));
}

function scoreReason(
  preferences: TravelPreferences,
  course: Course,
  facts: CourseScoreFacts,
  scores: RecommendationScoreBreakdown,
  finalScore: number,
  matched: Interest[],
): RecommendationReason {
  const interestText = matched.length
    ? matched.slice(0, 3).map((item) => INTEREST_LABELS[item]).join('·')
    : '전남 로컬 경험';
  const routeText = course.routeSource === 'kakao'
    ? `${course.origin?.name ?? preferences.startLocation}부터 조회한 카카오 구간 경로를 반영했어요.`
    : course.origin
      ? `${course.origin.name}의 출발 좌표를 반영한 이동 추정이에요.`
      : `선택한 ${preferences.startLocation}에서 시작하는 동선이에요.`;

  return {
    headline: `${preferences.city === course.city ? '취향과 뚜벅이 동선이 맞는' : '조건과 잘 맞는'} ${finalScore}점 코스`,
    summary: `${interestText} 취향을 반영했고, 총 도보 ${facts.walkMinutes}분 · 환승 ${facts.transferCount}회 · 평균 이동 ${facts.averageMoveMinutes}분으로 구성했어요. ${routeText}`,
    evidence: [
      `취향 적합도 ${scores.preference}점 · 뚜벅이 적합도 ${scores.walking}점`,
      `총 도보 ${facts.walkMinutes}분 · 환승 ${facts.transferCount}회 · 평균 이동 ${facts.averageMoveMinutes}분`,
      facts.averageStopDistanceMeters == null
        ? `이동 효율 ${Math.round(facts.stayRatio * 100)}% · 거리 ${facts.distanceKm}km`
        : `최근접 정류장 평균 ${facts.averageStopDistanceMeters}m · 이동 효율 ${Math.round(facts.stayRatio * 100)}%`,
      `시간 적합도 ${scores.timeFit}점 · 코스 완성도 ${scores.courseQuality}점`,
    ],
    source: 'rules',
  };
}

export function evaluateCourse(preferences: TravelPreferences, course: Course): RankedCourse {
  const facts = collectCourseFacts(course);
  const violations = hardConstraintViolations(preferences, facts);
  const walkingBreakdown = walkingScoreBreakdown(preferences, course, facts);
  const walking = walkingScore(walkingBreakdown);
  const preference = preferenceScore(preferences, course);
  const timeFit = timeFitScore(preferences, facts);
  const quality = courseQualityScore(preferences, course);
  const recommendationBreakdown = {
    preference,
    walking,
    timeFit,
    courseQuality: quality,
  };
  const fitScore = finalRecommendationScore(recommendationBreakdown);
  const matched = matchedInterestsFor(preferences, course);

  return {
    ...course,
    fitScore,
    walkingScore: walking,
    preferenceScore: preference,
    timeFitScore: timeFit,
    courseQualityScore: quality,
    scoreBreakdown: {
      transitAccess: walkingBreakdown.transit,
      walkingEase: walkingBreakdown.walk,
      nearbyLinks: walkingBreakdown.efficiency,
    },
    walkingBreakdown,
    recommendationBreakdown,
    scoreFacts: facts,
    constraintPassed: violations.length === 0,
    constraintViolations: violations,
    matchedInterests: matched,
    reason: scoreReason(preferences, course, facts, recommendationBreakdown, fitScore, matched),
  };
}

export function rankScoredCourses(preferences: TravelPreferences, candidates: RankedCourse[]) {
  const passed = candidates.filter((course) => course.constraintPassed);
  const pool = passed.length ? passed : candidates;
  return [...pool].sort((a, b) => {
    const cityPriority = Number(b.city === preferences.city) - Number(a.city === preferences.city);
    if (cityPriority) return cityPriority;
    if (a.constraintPassed !== b.constraintPassed) return Number(b.constraintPassed) - Number(a.constraintPassed);
    return b.fitScore - a.fitScore || b.walkingScore - a.walkingScore || b.preferenceScore - a.preferenceScore;
  });
}
