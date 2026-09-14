import { evaluateCourse, rankScoredCourses } from './recommendScore';
import { Course, RankedCourse, TravelPreferences } from '../types/travel';

/**
 * Hard constraint → 취향/뚜벅이/시간/완성도 가중합.
 * 탈락한 코스는 생존 후보가 있을 때 제외하고, 전부 탈락하면 차선으로 돌려줍니다.
 */
export function rankCourses(preferences: TravelPreferences, candidates: Course[]): RankedCourse[] {
  return rankScoredCourses(preferences, candidates.map((course) => evaluateCourse(preferences, course)));
}
