import { Course, TravelPreferences } from '../../../../../src/types/travel';
import { COURSES } from '../../../../../src/data/courses';
import { DataProvider } from './provider';

/** 데모 코스에 대략적인 GPS를 붙여 지도·정류장 연동이 동작하도록 함 */
const DEMO_COORDS: Record<string, Array<{ latitude: number; longitude: number }>> = {
  'suncheon-garden-day': [
    { latitude: 34.9456, longitude: 127.5042 },
    { latitude: 34.9289, longitude: 127.5095 },
    { latitude: 34.9508, longitude: 127.4876 },
    { latitude: 34.9482, longitude: 127.4821 },
    { latitude: 34.9541, longitude: 127.4855 },
  ],
  'yeosu-sea-evening': [
    { latitude: 34.7520, longitude: 127.7465 },
    { latitude: 34.7512, longitude: 127.7488 },
    { latitude: 34.7398, longitude: 127.7450 },
    { latitude: 34.7415, longitude: 127.7392 },
  ],
  'mokpo-history-taste': [
    { latitude: 34.7915, longitude: 126.3870 },
    { latitude: 34.7890, longitude: 126.3840 },
    { latitude: 34.7845, longitude: 126.3805 },
    { latitude: 34.7830, longitude: 126.3780 },
    { latitude: 34.7865, longitude: 126.3815 },
  ],
};

function withCoords(course: Course): Course {
  const coords = DEMO_COORDS[course.id];
  if (!coords) return course;
  return {
    ...course,
    places: course.places.map((place, index) => ({
      ...place,
      latitude: coords[index]?.latitude ?? place.latitude,
      longitude: coords[index]?.longitude ?? place.longitude,
    })),
    conveniences: course.conveniences.map((spot, index) => ({
      ...spot,
      latitude: coords[Math.min(index, coords.length - 1)]?.latitude,
      longitude: coords[Math.min(index, coords.length - 1)]?.longitude,
      source: 'demo' as const,
    })),
  };
}

export class DemoProvider implements DataProvider {
  name = 'demo';

  async fetchCourses(preferences: TravelPreferences): Promise<Course[]> {
    const matched = COURSES.filter((course) => course.city === preferences.city);
    const pool = matched.length ? matched : COURSES;
    return pool.map(withCoords);
  }
}
