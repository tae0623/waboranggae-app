import { Course, Interest, RankedCourse, RecommendationReason, TravelPreferences } from '../../../../src/types/travel';
import { INTEREST_LABELS } from '../../../../src/domain/labels';
import { weightedWalkabilityScore } from '../../../../src/domain/walkability';

function rulesReason(
  preferences: TravelPreferences,
  course: Course,
  score: number,
  matchedInterests: Interest[],
): RecommendationReason {
  const interestText = matchedInterests.length
    ? matchedInterests.slice(0, 3).map((item) => INTEREST_LABELS[item]).join('·')
    : '전남 로컬 경험';
  const routeText = course.routeSource === 'tmap-transit'
    ? `${course.origin?.name ?? preferences.startLocation}부터 TMAP 대중교통 길찾기를 반영했어요.`
    : course.routeSource === 'mixed'
      ? `${course.origin?.name ?? preferences.startLocation}부터 일부 구간은 TMAP 경로, 나머지는 좌표 추정으로 계산했어요.`
      : `${course.origin?.name ?? preferences.startLocation}의 실제 출발 좌표를 반영했으며, 이동시간은 좌표 기반 추정치예요.`;
  const meals = course.places.filter((place) => place.category === 'food');
  const accessEvidence = course.transitAccessEvidence ?? [];
  const averageStopDistance = accessEvidence.length
    ? Math.round(accessEvidence.reduce((sum, item) => sum + item.distanceMeters, 0) / accessEvidence.length)
    : null;
  const measuredRouteCounts = accessEvidence
    .map((item) => item.routeCount)
    .filter((value): value is number => value != null);
  const averageRouteCount = measuredRouteCounts.length
    ? Math.round(measuredRouteCounts.reduce((sum, value) => sum + value, 0) / measuredRouteCounts.length)
    : null;
  const transitEvidence = averageStopDistance == null
    ? `코스 내 대중교통 접근성 ${course.metrics.transitAccess}점 · 선택 출발 거점 ${preferences.startLocation}`
    : `최근접 정류장 평균 ${averageStopDistance}m${averageRouteCount == null ? '' : ` · 정류장당 평균 ${averageRouteCount}개 노선`} · 접근성 ${course.metrics.transitAccess}점`;
  const mealEvidence = meals.length
    ? `식사 일정 ${meals.map((place) => `${place.arrival} ${place.name}`).join(' · ')}`
    : '선택한 여행 시간에는 식사 장소를 배치하지 않음';

  return {
    headline: `${preferences.city === course.city ? '원하던 지역에 딱 맞는' : '조건과 잘 맞는'} ${score}점 코스`,
    summary: `${interestText} 관심사를 한 동선에 담고, 총 도보 약 ${course.walkMinutes}분으로 구성했어요. ${routeText}`,
    evidence: [
      transitEvidence,
      `도보 부담도 ${course.metrics.walkingEase}점 · 전체 ${course.distanceKm}km`,
      `주변 관광 연계성 ${course.metrics.nearbyLinks}점 · ${course.places.length}개 장소`,
      mealEvidence,
    ],
    source: 'rules',
  };
}

export function rankCourses(preferences: TravelPreferences, candidates: Course[]): RankedCourse[] {
  return candidates.map((course) => {
    const matchedInterests = Array.from(
      new Set(
        course.places
          .flatMap((place) => place.tags)
          .filter((tag) => preferences.interests.includes(tag)),
      ),
    );
    // 지역·시간·관심사는 코스 생성/검증의 필수조건으로 처리하고 점수를 부풀리는
    // 보너스로 다시 더하지 않습니다. 세 개 0~100 지표의 가중합만 최종 점수입니다.
    const fitScore = weightedWalkabilityScore(course.metrics, preferences.pace);

    return {
      ...course,
      fitScore,
      scoreBreakdown: course.metrics,
      matchedInterests,
      reason: rulesReason(preferences, course, fitScore, matchedInterests),
    };
  }).sort((a, b) => b.fitScore - a.fitScore || b.matchedInterests.length - a.matchedInterests.length);
}
