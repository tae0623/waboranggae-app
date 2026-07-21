import { Course, Interest, Pace, RankedCourse, RecommendationReason, TravelPreferences, WalkabilityMetrics } from '../../../src/types/travel';
import { INTEREST_LABELS } from '../../../src/domain/labels';

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

export function rankCourses(preferences: TravelPreferences, candidates: Course[]): RankedCourse[] {
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
    const durationPenalty = Math.abs(course.durationHours - preferences.durationHours) * 1.5;
    const metricScore =
      course.metrics.transitAccess * weights.transitAccess +
      course.metrics.walkingEase * weights.walkingEase +
      course.metrics.nearbyLinks * weights.nearbyLinks +
      course.metrics.convenience * weights.convenience;
    const fitScore = Math.round(Math.min(99, metricScore + cityBonus + interestBonus - durationPenalty));

    return {
      ...course,
      fitScore,
      scoreBreakdown: course.metrics,
      matchedInterests,
      reason: rulesReason(preferences, course, fitScore, matchedInterests),
    };
  }).sort((a, b) => b.fitScore - a.fitScore);
}
