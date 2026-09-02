import { Pace, WalkabilityMetrics } from '../types/travel';

export const WALKABILITY_WEIGHTS: Record<Pace, WalkabilityMetrics> = {
  easy: { transitAccess: 0.35, walkingEase: 0.5, nearbyLinks: 0.15 },
  balanced: { transitAccess: 0.4, walkingEase: 0.3, nearbyLinks: 0.3 },
  full: { transitAccess: 0.35, walkingEase: 0.2, nearbyLinks: 0.45 },
};

export function clampScore(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

/** 여행시간당 도보 분을 40~100점으로 표준화합니다. */
export function walkingEaseScore(walkMinutes: number, durationHours: number, pace: Pace) {
  const minutesPerHour = walkMinutes / Math.max(1, durationHours);
  const range = pace === 'easy'
    ? { ideal: 4, poor: 16 }
    : pace === 'full'
      ? { ideal: 8, poor: 26 }
      : { ideal: 6, poor: 20 };
  if (minutesPerHour <= range.ideal) return 100;
  if (minutesPerHour >= range.poor) return 40;
  return clampScore(100 - (minutesPerHour - range.ideal) / (range.poor - range.ideal) * 60);
}

/** 실제 구간당 평균 이동거리를 40~100점으로 표준화합니다. */
export function nearbyLinksScore(distanceKm: number, segmentCount: number) {
  const averageSegmentKm = distanceKm / Math.max(1, segmentCount);
  if (averageSegmentKm <= 1) return 100;
  if (averageSegmentKm >= 6) return 40;
  return clampScore(100 - (averageSegmentKm - 1) / 5 * 60);
}

/** 세 표준화 점수와 합계 100% 가중치만 사용합니다. */
export function weightedWalkabilityScore(metrics: WalkabilityMetrics, pace: Pace) {
  const weights = WALKABILITY_WEIGHTS[pace];
  return clampScore(
    metrics.transitAccess * weights.transitAccess
      + metrics.walkingEase * weights.walkingEase
      + metrics.nearbyLinks * weights.nearbyLinks,
  );
}
