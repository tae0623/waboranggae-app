import type { Course, CourseDataSource } from '../types/travel';

/** Read provenance from actual result places, not the provider class or ID prefix. */
export function courseDataSource(courses: Pick<Course, 'places'>[]): Exclude<CourseDataSource, 'demo'> {
  const sources = new Set(courses.flatMap(course => course.places.map(place => place.dataSource ?? 'tour-api')));
  return sources.size > 1 ? 'mixed' : sources.has('kakao') ? 'kakao' : 'tour-api';
}
