import { Course, TravelPreferences } from '../../../src/types/travel';
import { COURSES } from '../../../data/courses';
import { DataProvider } from './provider';

export class DemoProvider implements DataProvider {
  name = 'demo';

  async fetchCourses(preferences: TravelPreferences): Promise<Course[]> {
    // 데모 데이터는 모든 코스를 반환합니다.
    // 실제로는 preferences에 맞게 필터링할 수도 있습니다.
    return COURSES;
  }
}
