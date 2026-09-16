import type { Condition, Course, Place, PlaceCat, TransitStep } from './App';
import type { RankedCourse, TravelPreferences } from './api';
import { conditionError, normalizeMeals } from './parity';
import { mediaUrl } from './runtime';

const PURPOSE_TO_INTEREST: Record<string, TravelPreferences['interests'][number]> = {
  '자연·풍경': 'nature',
  '자연 명소': 'nature',
  '맛집 탐방': 'food',
  '맛집': 'food',
  '카페': 'cafe',
  '역사·문화': 'history',
  '시장·골목': 'market',
  '휴식': 'nature',
};

const INTEREST_TO_PURPOSE: Record<TravelPreferences['interests'][number], string> = {
  nature: '자연 명소',
  food: '맛집 탐방',
  cafe: '카페',
  photo: '자연 명소',
  market: '시장·골목',
  history: '역사·문화',
};

const MEAL_KO_TO_API: Record<string, 'breakfast' | 'lunch' | 'dinner'> = {
  '아침': 'breakfast',
  '점심': 'lunch',
  '저녁': 'dinner',
};

const MEAL_API_TO_KO: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
};

const PLACE_CAT: Record<string, PlaceCat> = {
  station: 'transit',
  nature: 'nature',
  food: 'meal',
  cafe: 'cafe',
  market: 'market',
  history: 'history',
  culture: 'culture',
};

function inferStartType(startLocation: string): TravelPreferences['startType'] {
  if (/터미널/.test(startLocation)) return 'terminal';
  if (/숙소|호텔|펜션/.test(startLocation)) return 'lodging';
  if (/역/.test(startLocation)) return 'station';
  return 'custom';
}

function localISODate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function wallClockHours(cond: Condition) {
  const start = new Date(`${cond.date}T${cond.startTime}:00`).getTime();
  const end = new Date(`${cond.endDate}T${cond.endTime}:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return Math.max(1, cond.duration || 6);
  return Math.min(72, Math.max(1, Math.round((end - start) / 36e5 * 10) / 10));
}

function mealsFromCondition(meals: string[]) {
  return [...new Set(meals.map((meal) => MEAL_KO_TO_API[meal]).filter(Boolean))] as Array<'breakfast' | 'lunch' | 'dinner'>;
}

function mealPreferenceFromMeals(meals: Array<'breakfast' | 'lunch' | 'dinner'>): TravelPreferences['mealPreference'] {
  const hasLunch = meals.includes('lunch');
  const hasDinner = meals.includes('dinner');
  if (!meals.length) return 'none';
  if (hasLunch && hasDinner) return 'both';
  if (hasLunch) return 'lunch';
  if (hasDinner) return 'dinner';
  return 'auto';
}

function interestsFromCondition(cond: Condition): TravelPreferences['interests'] {
  const fromPurpose = cond.purpose.map((item) => PURPOSE_TO_INTEREST[item]).filter(Boolean);
  return [...new Set(fromPurpose.length ? fromPurpose : ['nature'])] as TravelPreferences['interests'];
}

export function conditionToPreferences(cond: Condition): TravelPreferences {
  const invalid = conditionError(cond); if (invalid) throw new Error(invalid);
  const automaticMeals=cond.meals.includes('자동');
  const meals = mealsFromCondition(normalizeMeals(cond));
  const interests = interestsFromCondition(cond);
  const pace: TravelPreferences['pace'] = cond.pace === '여유롭게' ? 'easy' : cond.pace === '알차게' ? 'full' : 'balanced';
  const companions = '혼자';
  const durationHours = cond.endTimeLimited ? wallClockHours({...cond,endDate:cond.date}) : 6;
  const dateLabel = `${cond.date} ${cond.startTime} 시작${cond.endTimeLimited ? ` · ${cond.endTime}까지` : ''}`;
  const summary = [
    cond.region,
    dateLabel,
    cond.departure,
    cond.walkLevel,
    cond.pace,
    cond.purpose.slice(0, 3).join('·'),
    meals.map((meal) => MEAL_API_TO_KO[meal]).join('·'),

  ].filter(Boolean).join(' · ');

  return {
    scheduleMode: 'course-first',
    requiredContentId: cond.requiredContentId,
    requiredPlaceName: cond.requiredPlaceName,
    timeBudgetMode: 'local',
    region: '전라남도',
    city: cond.region || '순천',
    startLocation: cond.departure,
    startType: inferStartType(cond.departure),
    startAddress: cond.departureAddress,
    startLatitude: cond.departureLat,
    startLongitude: cond.departureLng,
    travelDate: cond.date || null,
    travelEndDate: cond.date || null,
    startTime: cond.startTime,
    endTime: cond.endTimeLimited ? cond.endTime : undefined,
    durationHours,
    mealPreference: automaticMeals ? 'auto' : mealPreferenceFromMeals(meals),
    meals: automaticMeals ? undefined : meals,
    pace,
    preferLocal: cond.isLocal || cond.purpose.includes('시장·골목'),
    interests,
    companions,
    lowMobility: cond.walkLevel === '적게 걷기',
    publicTransportOnly: true,
    preferredTransit: ['bus'],
    summary: summary.slice(0, 120),
    confidence: 0.8,
  };
}

export function preferencesToCondition(prefs: TravelPreferences, fallback?: Condition): Condition {
  const walkLevel = prefs.lowMobility ? '적게 걷기' : '보통';
  const meals: string[] = (prefs.meals?.length
    ? prefs.meals
    : prefs.mealPreference === 'none'
      ? []
      : prefs.mealPreference === 'dinner'
        ? ['dinner' as const]
        : prefs.mealPreference === 'both'
          ? ['lunch' as const, 'dinner' as const]
          : ['lunch' as const]
  ).map((meal) => MEAL_API_TO_KO[meal]);
  const purpose = [...new Set((prefs.interests ?? []).map((item) => INTEREST_TO_PURPOSE[item]).filter(Boolean))];
  return {
    departure: prefs.startLocation,
    departureAddress: prefs.startAddress,
    departureLat: prefs.startLatitude,
    departureLng: prefs.startLongitude,
    region: prefs.city,
    date: prefs.travelDate ?? localISODate(),
    endDate: prefs.travelDate ?? localISODate(),
    requiredContentId: prefs.requiredContentId,
    requiredPlaceName: prefs.requiredPlaceName,
    startTime: prefs.startTime,
    endTime: prefs.endTime ?? '16:00',
    endTimeLimited: Boolean(prefs.endTime),
    duration: prefs.durationHours,
    meal: prefs.mealPreference==='auto'&&prefs.meals===undefined ? '자동' : meals.length ? meals.join('+') : '식사 제외',
    meals: prefs.mealPreference==='auto'&&prefs.meals===undefined ? ['자동'] : meals,
    walkLevel,
    companion: '혼자',
    interests: fallback?.interests ?? [],
    purpose: purpose.length ? purpose : fallback?.purpose ?? [],
    atmosphere: fallback?.atmosphere ?? [],
    pace: prefs.pace === 'easy' ? '여유롭게' : prefs.pace === 'full' ? '알차게' : '적당히',
    isLocal: prefs.preferLocal,
    transitOnly: prefs.publicTransportOnly,
    transitModes: prefs.preferredTransit?.length ? prefs.preferredTransit : fallback?.transitModes ?? ['bus'],
  };
}

function parseDistanceMeters(label: string) {
  const match = label.match(/(\d+(?:\.\d+)?)\s*m/i);
  return match ? Number(match[1]) : 0;
}

function starsFromScore(value: number) {
  return Math.max(1, Math.min(5, Math.round(value / 20)));
}

function compactMoveLabel(label: string) {
  return label.replace(/^.*?출발\s*·\s*/, '').trim();
}

function uiModeFromSteps(steps?: TransitStep[]): Place['transitMode'] {
  const ride = steps?.find((step) => step.mode !== 'walk');
  if (ride?.mode === 'bus' || ride?.mode === 'expressbus') return 'bus';
  if (!ride && steps?.some((step) => step.mode === 'walk')) return 'walk';
  return ride ? 'bus' : undefined;
}

function hopFromPlace(place: RankedCourse['places'][number]) {
  const steps = place.transitSteps ?? [];
  const transitMin = (place.walkMinutesFromPrevious ?? 0) + (place.transitMinutesFromPrevious ?? 0)
    || steps.reduce((sum, step) => sum + step.minutes, 0)
    || undefined;
  return {
    transitTo: compactMoveLabel(place.moveLabel),
    transitMin: transitMin || undefined,
    transitMode: uiModeFromSteps(steps) ?? ((place.walkMinutesFromPrevious ?? 0) >= (place.transitMinutesFromPrevious ?? 0) ? 'walk' as const : 'bus' as const),
    transitSteps: steps.length ? steps : undefined,
  };
}

export function rankedToUiCourse(course: RankedCourse): Course {
  const cover = course.places.find((place) => place.imageUrl)?.imageUrl
    || '';
  const transferCount = course.scoreFacts?.transferCount
    ?? Math.max(0, course.places.filter((place) => (place.transitMinutesFromPrevious ?? 0) > 0).length - 1);
  const walking = course.walkingScore ?? course.scoreBreakdown.walkingEase;
  const preference = course.preferenceScore ?? 0;
  const timeFit = course.timeFitScore ?? 0;
  const quality = course.courseQualityScore ?? course.scoreBreakdown.nearbyLinks;
  const walkMinutes = course.scoreFacts?.walkMinutes ?? course.walkMinutes;
  const stayRatio = course.scoreFacts?.stayRatio ?? 0;
  const stopDistance = course.scoreFacts?.averageStopDistanceMeters;
  return {
    id: course.id,
    apiCourse: course,
    city: course.city,
    title: course.title,
    subtitle: course.subtitle,
    score: course.fitScore,
    walkFitScore: walking,
    prefScore: preference,
    timeScore: timeFit,
    completionScore: quality,
    hours: course.durationHours,
    distanceKm: course.distanceKm,
    placeCount: course.places.length,
    walkMin: course.walkMinutes,
    transitMin: Math.max(0,course.transitMinutes-(course.unclassifiedMinutes||0)),
    unclassifiedMin: course.unclassifiedMinutes || 0,
    transferCount,
    imageUrl: cover,
    tags: [
      ...course.matchedInterests.map((item) => ({
        nature: '자연', food: '맛집', cafe: '카페', photo: '사진', market: '시장', history: '역사',
      }[item] ?? item)),
      (walking >= 80 || walkMinutes <= 60) && !course.unclassifiedMinutes ? '적게 걷기' : '',
    ].filter(Boolean),
    reason: course.reason.summary,
    dataSource: 'real',
    routeSource: course.routeSource === 'kakao' ? 'kakao' : course.routeSource === 'mixed' ? 'mixed' : 'estimated',
    places: (() => {
      const mapped = course.places.map((place) => ({
        id: place.id,
        category: PLACE_CAT[place.category] ?? 'culture',
        name: place.name,
        address: place.address,
        imageUrl: mediaUrl(place.imageUrl) || undefined,
        arriveAt: place.arrival,
        stayMin: place.stayMinutes,
        description: place.description,
        interests: place.tags as string[],
      }));
      const withOrigin = course.origin ? [{
        id: `origin-${course.id}`,
        category: 'transit' as PlaceCat,
        name: course.origin.name,
        address: course.origin.address,
        arriveAt: course.places[0]?.moveLabel.match(/\d{2}:\d{2}/)?.[0] || '출발',
        stayMin: 0,
        description: '선택한 출발 거점',
        interests: [] as string[],
      }, ...mapped] : mapped;
      return withOrigin.map((place, index) => {
        const inbound = course.origin ? course.places[index] : course.places[index + 1];
        if (!inbound) return place;
        return { ...place, ...hopFromPlace(inbound) };
      });
    })(),
    locker: (course.conveniences ?? []).map((spot) => ({
      name: spot.name,
      distanceM: parseDistanceMeters(spot.distanceLabel),
      available: !/불가|없음/.test(spot.availabilityLabel),
    })),
    scoreBreakdown: [
      { label: '취향 적합도', value: preference, weight: 40 },
      { label: '뚜벅이 적합도', value: walking, weight: 35 },
      { label: '시간 적합도', value: timeFit, weight: 15 },
      { label: '코스 완성도', value: quality, weight: 10 },
    ],
    walkBreakdown: ([
      ['walk','도보 부담',`${course.unclassifiedMinutes?'확인된':'총'} 도보 ${walkMinutes}분${course.unclassifiedMinutes?` · 미분류 ${course.unclassifiedMinutes}분 포함해 보수적으로 평가`:''}`],
      ['transit','대중교통 접근성',stopDistance==null?'정류장 거리 미확인':`정류장 평균 ${stopDistance}m`],
      ['time','시간 적합도','현지 일정 기준'],
      ['transfer','환승 편의성',`환승 ${transferCount}회`],
      ['distance','이동 거리',`${course.distanceKm}km`],
      ['efficiency','이동 효율',`체류 ${Math.round(stayRatio*100)}%`],
    ] as const).map(([key,label,detail])=>({label,detail,value:course.walkingBreakdown?.[key] ?? 0,stars:starsFromScore(course.walkingBreakdown?.[key] ?? 0)})),
  };
}
