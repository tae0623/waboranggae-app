import { Course, ConvenienceSpot, Place } from '../../../../src/types/travel';
import { transitScoreFromMeters } from '../../utils/geo';
import { nearestBusStopDistanceMeters } from './data/bus-stops';
import { fetchConveniencesAround } from './data/conveniences';

function courseCenter(course: Course): { latitude: number; longitude: number } | null {
  const coords = course.places.filter(
    (place): place is Place & { latitude: number; longitude: number } =>
      typeof place.latitude === 'number' && typeof place.longitude === 'number',
  );
  if (!coords.length) return null;
  return {
    latitude: coords.reduce((sum, place) => sum + place.latitude, 0) / coords.length,
    longitude: coords.reduce((sum, place) => sum + place.longitude, 0) / coords.length,
  };
}

/**
 * 버스정류장·물품보관함·자전거 데이터를 붙여 뚜벅이 지표를 보정합니다.
 */
export async function enrichCourses(courses: Course[]): Promise<Course[]> {
  return Promise.all(courses.map(async (course) => {
    const placeTransitScores = await Promise.all(course.places.map(async (place) => {
      if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
        return course.metrics.transitAccess;
      }
      const { meters } = await nearestBusStopDistanceMeters(place.latitude, place.longitude);
      return transitScoreFromMeters(meters);
    }));

    const transitAccess = placeTransitScores.length
      ? Math.round(placeTransitScores.reduce((a, b) => a + b, 0) / placeTransitScores.length)
      : course.metrics.transitAccess;

    const center = courseCenter(course);
    let conveniences: ConvenienceSpot[] = course.conveniences;
    if (center) {
      const live = await fetchConveniencesAround(course.city, center);
      if (live.length) conveniences = live;
    }

    const lockerBonus = conveniences.some((spot) => spot.type === 'locker') ? 12 : 0;
    const bikeBonus = conveniences.some((spot) => spot.type === 'bike') ? 8 : 0;
    const convenience = Math.min(98, Math.round(55 + lockerBonus + bikeBonus));

    return {
      ...course,
      conveniences,
      metrics: {
        ...course.metrics,
        transitAccess,
        convenience,
      },
      subtitle: course.conveniences !== conveniences && conveniences.some((s) => s.source === 'live')
        ? `${course.subtitle} · 편의시설 실데이터`
        : course.subtitle,
    };
  }));
}
