import { Course, RouteSegment, RoutingPoint, TravelMode } from '../types/travel';

export function isRoutingPoint(point: unknown): point is RoutingPoint {
  const p = point as RoutingPoint | undefined;
  return !!p && typeof p.name === 'string' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
    && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
}

export function kakaoDirectionsUrl(from: RoutingPoint | undefined, to: RoutingPoint, mode: TravelMode) {
  const destinationName = to.name;
  const encodePoint = (p: RoutingPoint) => `${encodeURIComponent(p.name)},${p.latitude},${p.longitude}`;
  if (!isRoutingPoint(to)) return `https://map.kakao.com/link/search/${encodeURIComponent(destinationName)}`;
  if (!isRoutingPoint(from)) return `https://map.kakao.com/link/to/${encodePoint(to)}`;
  return `https://map.kakao.com/link/by/${mode === 'walk' ? 'walk' : 'traffic'}/${encodePoint(from)}/${encodePoint(to)}`;
}

export function courseLeg(course: Course, index: number) {
  const from = index === 0 ? course.origin : course.places[index - 1];
  const to = course.places[index];
  return isRoutingPoint(from) && isRoutingPoint(to) ? { from, to } : null;
}

export const courseLegKey = (course: Course, index: number) => JSON.stringify([course.id, courseLeg(course, index)]);

/** Map-only overlays also work when geocoding failed for the first departure. */
export function withVerifiedMapSegments<T extends Course>(course: T, verified: Record<string, RouteSegment>): T {
  const routeSegments = course.places.flatMap((place, index) => {
    const leg = courseLeg(course, index);
    if (!leg) return [];
    const confirmed = verified[courseLegKey(course, index)];
    if (confirmed) return [confirmed];
    const existing = course.routeSegments?.find(s => s.fromName === leg.from.name && s.toName === leg.to.name);
    return [existing || {
      fromName: leg.from.name, toName: leg.to.name, source: 'estimated' as const,
      totalMinutes: place.moveMinutes || 0, walkMinutes: place.walkMinutesFromPrevious || 0,
      transitMinutes: place.transitMinutesFromPrevious || 0, distanceKm: 0, modeLabel: '예상 이동',
      instruction: '좌표 기반 예상 이동', steps: [],
      geometry: [leg.from, leg.to],
    }];
  });
  return { ...course, routeSegments };
}
