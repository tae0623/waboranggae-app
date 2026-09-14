import { COURSES } from '../data/courses';
import { adaptDemoCourseStart } from './startLocation';
import { rankCourses as rankShared } from './rankCourses';
import { Course, RankedCourse, TravelPreferences } from '../types/travel';

export { DEFAULT_QUERY, parseTravelText, applyExplicitTravelSignals } from './parseTravelText';
export { rankCourses as rankLiveCourses } from './rankCourses';

/** 시연 코스 출발지 보정 후 공통 랭커 적용 */
export function rankCourses(
  preferences: TravelPreferences,
  candidates: Course[] = COURSES,
): RankedCourse[] {
  const adapted = candidates.map((candidate) => adaptDemoCourseStart(candidate, preferences));
  return rankShared(preferences, adapted);
}
