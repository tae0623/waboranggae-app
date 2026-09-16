import { Course, StartLocationType, TravelPreferences } from '../types/travel';

const DEMO_HUB_COORDS: Record<string, { latitude: number; longitude: number }> = {
  '순천:station': { latitude: 34.9456, longitude: 127.5042 },
  '순천:terminal': { latitude: 34.9475959, longitude: 127.4913557 },
  '여수:station': { latitude: 34.7520, longitude: 127.7465 },
  '여수:terminal': { latitude: 34.7585181, longitude: 127.7170572 },
  '목포:station': { latitude: 34.7915, longitude: 126.3870 },
  '목포:terminal': { latitude: 34.8128572, longitude: 126.4176347 },
};

export function defaultStartLocation(city: string, type: StartLocationType) {
  if (type === 'terminal') return `${city} 터미널`;
  if (type === 'lodging') return `${city} 숙소`;
  if (type === 'current') return '현재 위치';
  if (type === 'custom') return `${city} 중심지`;
  return `${city}역`;
}

function matchesStartType(value: string, type: StartLocationType) {
  if (type === 'terminal') return /터미널/.test(value);
  if (type === 'lodging') return /숙소|호텔|펜션/.test(value);
  if (type === 'current') return /현재\s*위치/.test(value);
  if (type === 'custom') return Boolean(value.trim());
  return /역(?:$|\s|에서)/.test(value) && !/터미널/.test(value);
}

export function normalizeStartLocation(city: string, type: StartLocationType, value?: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || !matchesStartType(trimmed, type) || ['역', '터미널', '숙소'].includes(trimmed)) {
    return defaultStartLocation(city, type);
  }
  return trimmed;
}

export function normalizeTravelStart<T extends TravelPreferences>(preferences: T): T {
  return {
    ...preferences,
    // An explicitly selected nationwide place outranks the destination-city hub shortcut.
    startLocation: Number.isFinite(preferences.startLatitude)&&Number.isFinite(preferences.startLongitude)&&preferences.startLocation.trim()
      ? preferences.startLocation.trim()
      : normalizeStartLocation(preferences.city, preferences.startType, preferences.startLocation),
  };
}

export function adaptDemoCourseStart(course: Course, preferences: TravelPreferences): Course {
  const originalHub = course.places.find((place) => place.category === 'station')?.name;
  if (!originalHub) return course;
  const startLocation = normalizeStartLocation(
    preferences.city,
    preferences.startType,
    preferences.startLocation,
  );
  const coordinates = DEMO_HUB_COORDS[`${preferences.city}:${preferences.startType}`];
  return {
    ...course,
    subtitle: course.subtitle.replace(originalHub, startLocation),
    // 출발 거점을 관광 장소 목록에 이름만 바꿔 넣으면 역의 좌표가 남습니다.
    // 별도 origin으로 분리해 지도와 방문 순서가 같은 출발점을 사용하게 합니다.
    places: course.places.filter((place) => place.category !== 'station'),
    origin: coordinates ? {
      name: startLocation,
      address: `${preferences.city} 선택 출발 거점 (오프라인 시연 좌표)`,
      ...coordinates,
      source: 'demo',
    } : course.origin,
  };
}
