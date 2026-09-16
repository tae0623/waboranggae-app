import type { Condition, Course, Place, PlaceCat, TransitStep } from './App';
import type { RankedCourse, TravelPreferences } from './api';

const WALK_TO_PACE: Record<string, TravelPreferences['pace']> = {
  '적게 걷기': 'easy',
  '보통': 'balanced',
  '많이 걷기': 'full',
};

const COMPANION_TO_API: Record<string, string> = {
  '혼자': '혼자',
  '친구와': '친구와 함께',
  '연인과': '연인과 함께',
  '가족과': '가족과 함께',
  '부모님과': '부모님과 함께',
  '아이와': '아이와 함께',
};

const PURPOSE_TO_INTEREST: Record<string, TravelPreferences['interests'][number]> = {
  '자연·풍경': 'nature',
  '맛집': 'food',
  '카페': 'cafe',
  '역사·문화': 'history',
  '시장·골목': 'market',
  '휴식': 'nature',
};

const INTEREST_TO_PURPOSE: Record<TravelPreferences['interests'][number], string> = {
  nature: '자연·풍경',
  food: '맛집',
  cafe: '카페',
  photo: '자연·풍경',
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
  return 'none';
}

function interestsFromCondition(cond: Condition): TravelPreferences['interests'] {
  const fromPurpose = cond.purpose.map((item) => PURPOSE_TO_INTEREST[item]).filter(Boolean);
  return [...new Set(fromPurpose.length ? fromPurpose : ['nature'])] as TravelPreferences['interests'];
}

export function conditionToPreferences(cond: Condition): TravelPreferences {
  const automaticMeals=cond.meals.includes('자동');
  const meals = mealsFromCondition(cond.meals);
  const interests = interestsFromCondition(cond);
  const pace = WALK_TO_PACE[cond.walkLevel] ?? 'balanced';
  const companions = COMPANION_TO_API[cond.companion] ?? cond.companion;
  const durationHours = cond.endTimeLimited ? wallClockHours({...cond,endDate:cond.date}) : 6;
  const dateLabel = `${cond.date} ${cond.startTime} 시작${cond.endTimeLimited ? ` · ${cond.endTime}까지` : ''}`;
  const summary = [
    cond.region,
    dateLabel,
    cond.departure,
    cond.walkLevel,
    companions,
    cond.purpose.slice(0, 3).join('·'),
    meals.map((meal) => MEAL_API_TO_KO[meal]).join('·'),
    cond.lodging ? `숙소 ${cond.lodging}` : '',
    cond.transitModes.length ? cond.transitModes.join('/') : '',
  ].filter(Boolean).join(' · ');

  return {
    scheduleMode: 'course-first',
    timeBudgetMode: 'local',
    region: '전라남도',
    city: cond.region || '순천',
    startLocation: cond.departure || `${cond.region || '순천'}역`,
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
    preferredTransit: cond.transitModes.length ? cond.transitModes : ['bus'],
    lodgingName: cond.lodging || undefined,
    lodgingAddress: cond.lodgingAddress,
    lodgingLatitude: cond.lodgingLat,
    lodgingLongitude: cond.lodgingLng,
    summary: summary.slice(0, 120),
    confidence: 0.8,
  };
}

export function preferencesToCondition(prefs: TravelPreferences, fallback?: Condition): Condition {
  const walkLevel = prefs.pace === 'easy' ? '적게 걷기' : prefs.pace === 'full' ? '많이 걷기' : '보통';
  const companion = Object.entries(COMPANION_TO_API).find(([, value]) => value === prefs.companions)?.[0] ?? prefs.companions;
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
    endDate: prefs.travelEndDate ?? prefs.travelDate ?? localISODate(),
    startTime: prefs.startTime,
    endTime: prefs.endTime ?? '16:00',
    endTimeLimited: Boolean(prefs.endTime),
    duration: prefs.durationHours,
    meal: prefs.mealPreference==='auto'&&prefs.meals===undefined ? '자동' : meals.length ? meals.join('+') : '식사 제외',
    meals: prefs.mealPreference==='auto'&&prefs.meals===undefined ? ['자동'] : meals,
    walkLevel,
    companion,
    interests: fallback?.interests ?? [],
    purpose: purpose.length ? purpose : fallback?.purpose ?? [],
    atmosphere: fallback?.atmosphere ?? [],
    pace: fallback?.pace ?? '적당히',
    isLocal: prefs.preferLocal,
    transitOnly: prefs.publicTransportOnly,
    transitModes: prefs.preferredTransit?.length ? prefs.preferredTransit : fallback?.transitModes ?? ['bus'],
    lodging: prefs.lodgingName,
    lodgingAddress: prefs.lodgingAddress,
    lodgingLat: prefs.lodgingLatitude,
    lodgingLng: prefs.lodgingLongitude,
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
  const preference = course.preferenceScore
    ?? Math.round((course.matchedInterests.length / Math.max(course.places.length, 1)) * 100)
    ?? course.fitScore;
  const timeFit = course.timeFitScore ?? Math.min(100, Math.round(100 - Math.abs(course.durationHours - 6) * 6));
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
    transitMin: course.transitMinutes,
    transferCount,
    imageUrl: cover,
    tags: [
      ...course.matchedInterests.map((item) => ({
        nature: '자연', food: '맛집', cafe: '카페', photo: '사진', market: '시장', history: '역사',
      }[item] ?? item)),
      walking >= 80 || walkMinutes <= 60 ? '적게 걷기' : '',
    ].filter(Boolean),
    reason: course.reason.summary,
    dataSource: course.id.startsWith('tour-') || course.id.startsWith('planned-') ? 'real' : 'demo',
    routeSource: course.routeSource === 'kakao' ? 'kakao' : course.routeSource === 'mixed' ? 'mixed' : 'estimated',
    places: (() => {
      const mapped = course.places.map((place) => ({
        id: place.id,
        category: PLACE_CAT[place.category] ?? 'culture',
        name: place.name,
        address: place.address,
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
    walkBreakdown: [
      { label: '도보 부담', stars: starsFromScore(course.walkingBreakdown?.walk ?? course.scoreBreakdown.walkingEase), detail: `총 도보 ${walkMinutes}분` },
      { label: '대중교통 접근성', stars: starsFromScore(course.walkingBreakdown?.transit ?? course.scoreBreakdown.transitAccess), detail: stopDistance == null ? `대중교통 ${course.transitMinutes}분` : `정류장 평균 ${stopDistance}m` },
      { label: '환승 편의성', stars: starsFromScore(course.walkingBreakdown?.transfer ?? Math.max(20, 100 - transferCount * 20)), detail: `환승 ${transferCount}회` },
      { label: '이동 효율', stars: starsFromScore(course.walkingBreakdown?.efficiency ?? Math.round(stayRatio * 125)), detail: `체류 ${Math.round(stayRatio * 100)}% · 평균 이동 ${course.scoreFacts?.averageMoveMinutes ?? course.transitMinutes}분` },
    ],
  };
}
