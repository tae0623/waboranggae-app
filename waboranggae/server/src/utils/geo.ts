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

/** 정류장을 지나는 고유 노선 수와 대표 평일 배차간격을 0~100점으로 표준화합니다. */
export function busServiceScore(routeCount: number, typicalIntervalMinutes: number | null = null): number {
  const count = Math.max(0, Math.floor(routeCount));
  const countScore = count === 0 ? 25
    : count === 1 ? 45
      : count === 2 ? 55
        : count <= 4 ? 68
          : count <= 7 ? 78
            : count <= 12 ? 88
              : count <= 20 ? 95
                : 100;

  if (typicalIntervalMinutes == null || !Number.isFinite(typicalIntervalMinutes)) return countScore;
  const interval = Math.max(0, typicalIntervalMinutes);
  const intervalScore = interval <= 10 ? 100
    : interval <= 15 ? 92
      : interval <= 20 ? 84
        : interval <= 30 ? 72
          : interval <= 45 ? 58
            : interval <= 60 ? 45
              : 35;
  return Math.round(countScore * 0.65 + intervalScore * 0.35);
}

/** 정류장까지 거리 70%, 실제 노선 공급 30%로 대중교통 접근성을 계산합니다. */
export function transitAccessScore(
  meters: number,
  routeCount: number | null,
  typicalIntervalMinutes: number | null = null,
): number {
  const distanceScore = transitScoreFromMeters(meters);
  if (routeCount == null) return distanceScore;
  return Math.round(distanceScore * 0.7 + busServiceScore(routeCount, typicalIntervalMinutes) * 0.3);
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
