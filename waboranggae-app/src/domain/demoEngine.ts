import { COURSES } from '../data/courses';
import { INTEREST_LABELS, PACE_LABELS } from './labels';
import {
  Course,
  Interest,
  Pace,
  RankedCourse,
  RecommendationReason,
  TravelPreferences,
  WalkabilityMetrics,
} from '../types/travel';

const CITY_NAMES = [
  '순천', '여수', '목포', '담양', '광양', '나주', '보성', '해남', '강진', '고흥', '곡성',
  '구례', '무안', '영광', '영암', '완도', '장성', '장흥', '진도', '함평', '화순', '신안',
];

const INTEREST_KEYWORDS: Record<Interest, string[]> = {
  nature: ['자연', '정원', '바다', '숲', '풍경', '산책'],
  food: ['맛집', '음식', '먹거리', '미식', '밥', '해산물'],
  cafe: ['카페', '커피', '디저트', '쉬고'],
  photo: ['사진', '포토', '인생샷', '풍경'],
  market: ['시장', '로컬', '전통시장'],
  history: ['역사', '문화유산', '박물관', '근대'],
};

export const DEFAULT_QUERY =
  '순천역에서 시작해서 많이 걷지 않고 정원, 맛집, 카페를 여유롭게 보고 싶어요. 캐리어도 맡겨야 해요.';

function withObjectParticle(value: string) {
  const lastCode = value.charCodeAt(value.length - 1);
  const isHangulSyllable = lastCode >= 0xac00 && lastCode <= 0xd7a3;
  const hasBatchim = isHangulSyllable && (lastCode - 0xac00) % 28 !== 0;
  return `${value}${hasBatchim ? '을' : '를'}`;
}

export function parseTravelText(text: string): TravelPreferences {
  const normalized = text.trim();
  const city = CITY_NAMES.find((name) => normalized.includes(name)) ?? '순천';
  const startMatch = normalized.match(/([가-힣A-Za-z0-9]+(?:역|터미널|항|숙소))/);
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

  const resolvedInterests: Interest[] = interests.length ? interests : ['nature', 'food'];
  const lowMobility = /무릎|휠체어|유모차|부모님|아이|오르막.*피/.test(normalized);
  const wantsLuggageStorage = /캐리어|짐|물품.*보관|보관함/.test(normalized);
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

  return {
    region: '전라남도',
    city,
    startLocation: startMatch?.[1] ?? `${city}역`,
    startType: /터미널/.test(normalized) ? 'terminal' : /숙소|호텔|펜션/.test(normalized) ? 'lodging' : 'station',
    travelDate: null,
    durationHours: durationMatch ? Math.min(12, Math.max(2, Number(durationMatch[1]))) : 6,
    pace,
    preferLocal: /로컬|골목|전통|시장/.test(normalized),
    interests: resolvedInterests,
    companions,
    lowMobility,
    wantsLuggageStorage,
    publicTransportOnly: !/자가용|렌터카|렌트카/.test(normalized),
    summary: `${city}에서 ${withObjectParticle(labels.join('·'))} 즐기는 ${PACE_LABELS[pace]} 뚜벅이 여행`,
    confidence: normalized.length > 18 ? 0.91 : 0.76,
  };
}

function getWeights(pace: Pace): WalkabilityMetrics {
  if (pace === 'easy') {
    return { transitAccess: 0.3, walkingEase: 0.45, nearbyLinks: 0.15, convenience: 0.1 };
  }
  if (pace === 'full') {
    return { transitAccess: 0.3, walkingEase: 0.2, nearbyLinks: 0.4, convenience: 0.1 };
  }
  return { transitAccess: 0.3, walkingEase: 0.3, nearbyLinks: 0.3, convenience: 0.1 };
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
  const lockerText = preferences.wantsLuggageStorage && course.conveniences.some((item) => item.type === 'locker')
    ? '출발지 주변 물품보관함도 함께 확인할 수 있어 짐 부담을 줄일 수 있어요.'
    : '교통거점부터 장소가 자연스럽게 이어져 길 찾기가 단순해요.';

  return {
    headline: `${preferences.city === course.city ? '원하던 지역에 딱 맞는' : '조건과 잘 맞는'} ${score}점 코스`,
    summary: `${interestText} 관심사를 한 동선에 담고, 총 도보 약 ${course.walkMinutes}분으로 구성했어요. ${lockerText}`,
    evidence: [
      `대중교통 접근성 ${course.metrics.transitAccess}점 · 출발 거점 ${course.places[0]?.name ?? course.city}`,
      `도보 부담도 ${course.metrics.walkingEase}점 · 전체 ${course.distanceKm}km`,
      `주변 관광 연계성 ${course.metrics.nearbyLinks}점 · ${course.places.length}개 장소`,
    ],
    source: 'rules',
  };
}

export function rankCourses(preferences: TravelPreferences, candidates: Course[] = COURSES): RankedCourse[] {
  const weights = getWeights(preferences.pace);

  return candidates.map((course) => {
    const matchedInterests = Array.from(
      new Set(
        course.places
          .flatMap((place) => place.tags)
          .filter((tag) => preferences.interests.includes(tag)),
      ),
    );
    const cityBonus = course.city === preferences.city ? 10 : 0;
    const interestBonus = Math.min(5, matchedInterests.length * 1.4);
    const localBonus = preferences.preferLocal
      && course.places.some((place) => place.category === 'market' || place.category === 'food' || place.category === 'cafe')
      ? 4
      : 0;
    const durationPenalty = Math.abs(course.durationHours - preferences.durationHours) * 1.5;
    const metricScore =
      course.metrics.transitAccess * weights.transitAccess +
      course.metrics.walkingEase * weights.walkingEase +
      course.metrics.nearbyLinks * weights.nearbyLinks +
      course.metrics.convenience * weights.convenience;
    const fitScore = Math.round(Math.min(99, metricScore + cityBonus + interestBonus + localBonus - durationPenalty));

    return {
      ...course,
      fitScore,
      scoreBreakdown: course.metrics,
      matchedInterests,
      reason: rulesReason(preferences, course, fitScore, matchedInterests),
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
}
