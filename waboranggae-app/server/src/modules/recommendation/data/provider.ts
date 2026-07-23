import { Course, TravelPreferences } from '../../../../../src/types/travel';

/**
 * 여행 코스 데이터를 제공하는 provider 인터페이스
 * 새로운 데이터 소스를 추가할 때 이 인터페이스를 구현하면 됩니다.
 */
export interface DataProvider {
  /**
   * 여행 선호도에 맞는 코스를 조회합니다.
   * @param preferences 사용자 여행 선호도
   * @returns 코스 배열 (정규화된 Course 형식)
   */
  fetchCourses(preferences: TravelPreferences): Promise<Course[]>;

  /**
   * Provider의 이름 (로깅/디버깅용)
   */
  name: string;
}
