/** Haversine distance in kilometers */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6_371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function projectMapPoints(
  points: Array<{ latitude: number; longitude: number }>,
  width = 320,
  height = 260,
  padding = 36,
): Array<{ x: number; y: number }> {
  if (!points.length) return [];
  const lons = points.map((p) => p.longitude);
  const lats = points.map((p) => p.latitude);
  const minX = Math.min(...lons);
  const maxX = Math.max(...lons);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const xRange = maxX - minX || 0.001;
  const yRange = maxY - minY || 0.001;

  return points.map((point) => ({
    x: padding + ((point.longitude - minX) / xRange) * (width - padding * 2),
    y: height - padding - ((point.latitude - minY) / yRange) * (height - padding * 2),
  }));
}

/** Convert nearest bus-stop distance (meters) to 0–100 transit access score */
export function transitScoreFromMeters(meters: number | null): number {
  if (meters == null || !Number.isFinite(meters)) return 60;
  if (meters <= 100) return 98;
  if (meters <= 200) return 92;
  if (meters <= 350) return 84;
  if (meters <= 500) return 74;
  if (meters <= 800) return 62;
  return Math.max(40, Math.round(55 - (meters - 800) / 50));
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
