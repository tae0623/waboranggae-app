import { Course, Place } from '../../../../src/types/travel';
import { getBusAccessProfile } from './data/bus-stops';
import { fetchLockersNear } from './data/conveniences';

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
 * 장소별 최근접 버스정류장 거리로 대중교통 접근성 지표를 보정합니다.
 */
export async function enrichCourses(courses: Course[]): Promise<Course[]> {
  return Promise.all(courses.map(async (course) => {
    const placeTransitResults = await Promise.all(course.places.map(async (place) => {
      if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') {
        return { score: course.metrics.transitAccess, evidence: null };
      }
      const profile = await getBusAccessProfile(place.latitude, place.longitude);
      if (!profile) return { score: course.metrics.transitAccess, evidence: null };
      return {
        score: profile.score,
        evidence: {
          placeId: place.id,
          placeName: place.name,
          stopName: profile.stop.name,
          distanceMeters: Math.round(profile.stop.distanceMeters),
          routeCount: profile.routeCount,
          sampleRouteNumbers: profile.sampleRouteNumbers,
          typicalIntervalMinutes: profile.typicalIntervalMinutes,
          source: profile.source,
        },
      };
    }));

    const transitAccess = placeTransitResults.length
      ? Math.round(placeTransitResults.reduce((sum, item) => sum + item.score, 0) / placeTransitResults.length)
      : course.metrics.transitAccess;
    const transitAccessEvidence = placeTransitResults
      .map((item) => item.evidence)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const center = courseCenter(course);
    const conveniences = center ? await fetchLockersNear(course.city, center) : [];

    return {
      ...course,
      conveniences,
      transitAccessEvidence,
      metrics: {
        ...course.metrics,
        transitAccess,
      },
    };
  }));
}
