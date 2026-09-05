import { INTEREST_LABELS } from './labels';
import { weightedWalkabilityScore } from './walkability';
import {
  Course,
  Interest,
  RankedCourse,
  RecommendationReason,
  TravelPreferences,
} from '../types/travel';

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
      : course.origin
        ? `${course.origin.name}의 실제 출발 좌표를 반영했으며, 이동시간은 좌표 기반 추정치예요.`
        : `선택한 ${preferences.startLocation}에서 첫 장소까지는 시연용 추정 동선이에요.`;
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
    : null;

  return {
    headline: `${preferences.city === course.city ? '원하던 지역에 딱 맞는' : '조건과 잘 맞는'} ${score}점 코스`,
    summary: `${interestText} 관심사를 한 동선에 담고, 총 도보 약 ${course.walkMinutes}분으로 구성했어요. ${routeText}`,
    evidence: [
      transitEvidence,
      `도보 부담도 ${course.metrics.walkingEase}점 · 전체 ${course.distanceKm}km`,
      `주변 관광 연계성 ${course.metrics.nearbyLinks}점 · ${course.places.length}개 장소`,
      ...(mealEvidence ? [mealEvidence] : []),
    ],
    source: 'rules',
  };
}

/**
 * 적합도 점수·정렬 (클라이언트 시연 폴백 · 서버 추천 공통)
 * 지역·시간·관심사는 코스 생성 단계에서 필수조건으로 두고, 점수는 보행 지표 가중합만 사용합니다.
 */
export function rankCourses(preferences: TravelPreferences, candidates: Course[]): RankedCourse[] {
  return candidates.map((course) => {
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
    if (cityPriority) return cityPriority;
    return b.fitScore - a.fitScore || b.matchedInterests.length - a.matchedInterests.length;
  });
}
