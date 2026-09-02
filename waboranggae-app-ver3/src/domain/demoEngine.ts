import { COURSES } from '../data/courses';
import { INTEREST_LABELS, PACE_LABELS } from './labels';
import { adaptDemoCourseStart, normalizeStartLocation } from './startLocation';
import { weightedWalkabilityScore } from './walkability';
import {
  Course,
  Interest,
  MealPreference,
  Pace,
  RankedCourse,
  RecommendationReason,
  StartLocationType,
  TravelPreferences,
} from '../types/travel';

const CITY_NAMES = [
  '순천', '여수', '목포', '담양', '광양', '나주', '보성', '해남', '강진', '고흥', '곡성',
  '구례', '무안', '영광', '영암', '완도', '장성', '장흥', '진도', '함평', '화순', '신안',
];

const INTEREST_KEYWORDS: Record<Interest, string[]> = {
  nature: ['자연', '정원', '바다', '숲', '풍경', '산책'],
  food: ['맛집', '음식', '먹거리', '미식', '밥', '해산물', '먹고', '먹고 싶'],
  cafe: ['카페', '커피', '디저트', '쉬고'],
  photo: ['사진', '포토', '인생샷', '풍경'],
  market: ['시장', '로컬', '전통시장'],
  history: ['역사', '문화유산', '박물관', '근대'],
};

function inferStartTime(text: string) {
  const match = text.match(/(?:(오전|오후)\s*)?(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분)?(?:부터|에\s*출발|에\s*시작|\s*출발|\s*시작)?/);
  if (!match) return '10:00';
  const period = match[1];
  let hours = Number(match[2]);
  const minutes = Math.min(59, Number(match[3] || 0));
  if (period === '오후' && hours < 12) hours += 12;
  if (period === '오전' && hours === 12) hours = 0;
  if (hours > 23) return '10:00';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function inferMealPreference(text: string): MealPreference {
  if (/밥\s*먹고\s*(?:출발|시작)|식사\s*(?:제외|없이|안\s*해)|맛집\s*(?:제외|없이)/.test(text)) return 'none';
  const lunch = /점심/.test(text);
  const dinner = /저녁|석식/.test(text);
  if (lunch && dinner) return 'both';
  if (lunch) return 'lunch';
  if (dinner) return 'dinner';
  return 'auto';
}

export const DEFAULT_QUERY =
  '순천역에서 시작해서 많이 걷지 않고 정원, 맛집, 카페를 여유롭게 보고 싶어요.';

function withObjectParticle(value: string) {
  const lastCode = value.charCodeAt(value.length - 1);
  const isHangulSyllable = lastCode >= 0xac00 && lastCode <= 0xd7a3;
  const hasBatchim = isHangulSyllable && (lastCode - 0xac00) % 28 !== 0;
  return `${value}${hasBatchim ? '을' : '를'}`;
}

export function parseTravelText(text: string): TravelPreferences {
  const normalized = text.trim();
  const city = CITY_NAMES.find((name) => normalized.includes(name)) ?? '순천';
  const startMatch = normalized.match(/([가-힣A-Za-z0-9]+(?:역|터미널|정류장|선착장|항|숙소))/);
  const durationMatch = normalized.match(/(\d+(?:\.\d+)?)\s*시간/);

  const easyPattern = /많이 걷지|적게 걷|천천히|여유|무릎|아이|부모님/;
  const fullPattern = /많이 보|알차게|빽빽|최대한/;
  const pace: Pace = easyPattern.test(normalized)
    ? 'easy'
    : fullPattern.test(normalized)
      ? 'full'
      : 'balanced';

  const interests = (Object.keys(INTEREST_KEYWORDS) as Interest[]).filter((interest) =>
    INTEREST_KEYWORDS[interest].some((keyword) => normalized.includes(keyword)),
  );

  const mealPreference = inferMealPreference(normalized);
  const resolvedInterests: Interest[] = interests.length ? interests : ['nature', 'food'];
  if (mealPreference !== 'auto' && mealPreference !== 'none' && !resolvedInterests.includes('food')) {
    resolvedInterests.push('food');
  }
  const lowMobility = /무릎|휠체어|유모차|부모님|아이|오르막.*피/.test(normalized);
  const companions = /아이|아기|유모차/.test(normalized)
    ? '아이와 함께'
    : /부모님|어르신/.test(normalized)
      ? '부모님과 함께'
      : /혼자|혼행/.test(normalized)
        ? '혼자'
        : /친구/.test(normalized)
          ? '친구와 함께'
          : '동행 미지정';

  const labels = resolvedInterests.slice(0, 3).map((item) => INTEREST_LABELS[item]);

  const startType: StartLocationType = /터미널/.test(normalized)
    ? 'terminal'
    : /숙소|호텔|펜션/.test(normalized)
      ? 'lodging'
      : /(?:역)(?:에서|\s|$)/.test(startMatch?.[1] || '')
        ? 'station'
        : startMatch
          ? 'custom'
          : 'station';
  const startLocation = normalizeStartLocation(city, startType, startMatch?.[1]);

  return {
    region: '전라남도',
    city,
    startLocation,
    startType,
    travelDate: null,
    startTime: inferStartTime(normalized),
    durationHours: durationMatch ? Math.min(12, Math.max(2, Number(durationMatch[1]))) : 6,
    mealPreference,
    pace,
    preferLocal: /로컬|골목|전통|시장/.test(normalized),
    interests: resolvedInterests,
    companions,
    lowMobility,
    publicTransportOnly: !/자가용|렌터카|렌트카/.test(normalized),
    summary: `${startLocation}에서 ${withObjectParticle(labels.join('·'))} 즐기는 ${PACE_LABELS[pace]} 뚜벅이 여행`,
    confidence: normalized.length > 18 ? 0.91 : 0.76,
  };
}

function rulesReason(
  preferences: TravelPreferences,
  course: Course,
  score: number,
  matchedInterests: Interest[],
): RecommendationReason {
  const interestText = matchedInterests.length
    ? matchedInterests.slice(0, 3).map((item) => INTEREST_LABELS[item]).join('·')
    : '전남 로컬 경험';
  const routeText = `선택한 ${preferences.startLocation}에서 첫 장소까지는 시연용 추정 동선이에요.`;

  return {
    headline: `${preferences.city === course.city ? '원하던 지역에 딱 맞는' : '조건과 잘 맞는'} ${score}점 코스`,
    summary: `${interestText} 관심사를 한 동선에 담고, 총 도보 약 ${course.walkMinutes}분으로 구성했어요. ${routeText}`,
    evidence: [
      `코스 내 대중교통 접근성 ${course.metrics.transitAccess}점 · 선택 출발 거점 ${preferences.startLocation}`,
      `도보 부담도 ${course.metrics.walkingEase}점 · 전체 ${course.distanceKm}km`,
      `주변 관광 연계성 ${course.metrics.nearbyLinks}점 · ${course.places.length}개 장소`,
    ],
    source: 'rules',
  };
}

export function rankCourses(preferences: TravelPreferences, candidates: Course[] = COURSES): RankedCourse[] {
  return candidates.map((candidate) => adaptDemoCourseStart(candidate, preferences)).map((course) => {
    const matchedInterests = Array.from(
      new Set(
        course.places
          .flatMap((place) => place.tags)
          .filter((tag) => preferences.interests.includes(tag)),
      ),
    );
    const fitScore = weightedWalkabilityScore(course.metrics, preferences.pace);

    return {
      ...course,
      fitScore,
      scoreBreakdown: course.metrics,
      matchedInterests,
      reason: rulesReason(preferences, course, fitScore, matchedInterests),
    };
  }).sort((a, b) => {
    const cityPriority = Number(b.city === preferences.city) - Number(a.city === preferences.city);
    return cityPriority || b.fitScore - a.fitScore;
  });
}
