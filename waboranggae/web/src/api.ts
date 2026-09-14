const TOKEN_KEY = 'waboranggae.accessToken';
const REFRESH_KEY = 'waboranggae.refreshToken';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  getAccess: () => sessionStorage.getItem(TOKEN_KEY),
  getRefresh: () => sessionStorage.getItem(REFRESH_KEY),
  set(access: string, refresh: string) {
    sessionStorage.setItem(TOKEN_KEY, access);
    sessionStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  },
};

async function request<T>(path: string, options: {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
} = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const access = tokenStore.getAccess();
  if (options.auth !== false && access) headers.Authorization = `Bearer ${access}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (response.status === 401 && options.auth !== false && tokenStore.getRefresh()) {
      const refreshed = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokenStore.getRefresh() }),
      });
      if (refreshed.ok) {
        const tokens = await refreshed.json() as { accessToken: string; refreshToken: string };
        tokenStore.set(tokens.accessToken, tokens.refreshToken);
        headers.Authorization = `Bearer ${tokens.accessToken}`;
        const retry = await fetch(path, {
          method: options.method ?? 'GET',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({})) as { error?: string };
          throw new ApiError(retry.status, err.error || `API error ${retry.status}`);
        }
        return await retry.json() as T;
      }
      tokenStore.clear();
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: string };
      throw new ApiError(response.status, err.error || `API error ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new Error('서버에 연결할 수 없습니다. API가 켜져 있는지 확인해주세요.');
  } finally {
    clearTimeout(timeout);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface TravelPreferences {
  region: string;
  city: string;
  startLocation: string;
  startType: 'station' | 'terminal' | 'current' | 'lodging' | 'custom';
  startAddress?: string;
  startLatitude?: number;
  startLongitude?: number;
  travelDate: string | null;
  travelEndDate?: string | null;
  startTime: string;
  endTime?: string;
  durationHours: number;
  mealPreference: 'auto' | 'none' | 'lunch' | 'dinner' | 'both';
  meals?: Array<'breakfast' | 'lunch' | 'dinner'>;
  pace: 'easy' | 'balanced' | 'full';
  preferLocal: boolean;
  interests: Array<'nature' | 'food' | 'cafe' | 'photo' | 'market' | 'history'>;
  companions: string;
  lowMobility: boolean;
  publicTransportOnly: boolean;
  preferredTransit?: string[];
  lodgingName?: string;
  lodgingAddress?: string;
  lodgingLatitude?: number;
  lodgingLongitude?: number;
  summary: string;
  confidence: number;
}

export interface RankedCourse {
  id: string;
  city: string;
  title: string;
  subtitle: string;
  durationHours: number;
  distanceKm: number;
  walkMinutes: number;
  transitMinutes: number;
  places: Array<{
    id: string;
    name: string;
    category: string;
    address: string;
    stayMinutes: number;
    arrival: string;
    moveLabel: string;
    description: string;
    tags: string[];
    imageUrl?: string;
    walkMinutesFromPrevious?: number;
    transitMinutesFromPrevious?: number;
    transitSteps?: Array<{
      mode: 'walk' | 'bus' | 'subway' | 'train' | 'expressbus' | 'ferry' | 'other';
      route?: string;
      label: string;
      minutes: number;
      fromStop?: string;
      toStop?: string;
    }>;
  }>;
  conveniences?: Array<{
    id: string;
    name: string;
    distanceLabel: string;
    availabilityLabel: string;
  }>;
  transitAccessEvidence?: Array<{
    placeName: string;
    stopName: string;
    distanceMeters: number;
    routeCount: number | null;
    typicalIntervalMinutes: number | null;
  }>;
  origin?: { name: string; address: string };
  routeSource?: 'tmap-transit' | 'mixed' | 'estimated';
  planningSource?: 'ollama' | 'rules';
  validationNotes?: string[];
  fitScore: number;
  walkingScore?: number;
  preferenceScore?: number;
  timeFitScore?: number;
  courseQualityScore?: number;
  scoreBreakdown: { transitAccess: number; walkingEase: number; nearbyLinks: number };
  walkingBreakdown?: {
    walk: number; transit: number; time: number; transfer: number; distance: number; efficiency: number;
  };
  scoreFacts?: {
    walkMinutes: number;
    transitMinutes: number;
    transferCount: number;
    averageMoveMinutes: number;
    stayRatio: number;
    distanceKm: number;
    averageStopDistanceMeters: number | null;
  };
  matchedInterests: string[];
  reason: { headline: string; summary: string; evidence: string[]; source: 'ollama' | 'rules' };
}

export interface RecommendResponse {
  courses: RankedCourse[];
  source: 'tour-api' | 'demo';
  planningSource?: 'ollama' | 'rules';
  fallbackReason?: string | null;
}

export interface BookmarkItem {
  id: string;
  courseId: string;
  courseName: string;
  city: string;
  createdAt: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  city?: string | null;
  pace?: string | null;
  createdAt?: string;
  preferences?: TravelPreferences;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  address: string;
  city?: string;
  category?: string;
  latitude: number;
  longitude: number;
  source: 'kakao' | 'kakao-address' | 'tmap' | 'tmap-address' | 'nominatim' | 'tour-api';
}

export interface HotPlace {
  id: string;
  name: string;
  city: string;
  category: string;
  desc: string;
  story?: string;
  img: string;
  visitors: number;
  metricLabel?: string;
  tags: string[];
  isNew?: boolean;
  isTrending?: boolean;
  source?: 'demand' | 'visitors' | 'festival' | 'tour-api';
  address?: string;
  periodLabel?: string;
  periodShort?: string;
  statusLabel?: string;
  fee?: string;
  hours?: string;
  eventPlace?: string;
  sponsor?: string;
  ageLimit?: string;
  tel?: string;
  spendTime?: string;
  program?: string;
  restDate?: string;
  homepage?: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  signup: (email: string, displayName: string, password: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: { email, displayName, password }, auth: false }),
  logout: () => request('/auth/logout', { method: 'POST' }).catch(() => undefined),
  me: () => request<AuthUser>('/api/user/me'),
  updateProfile: (displayName: string) =>
    request<AuthUser>('/api/user/profile', { method: 'PATCH', body: { displayName } }),
  deleteAccount: () => request('/api/user/me', { method: 'DELETE' }),
  recommend: (preferences: TravelPreferences) =>
    request<RecommendResponse>('/api/recommend', { method: 'POST', body: { preferences }, timeoutMs: 130_000 }),
  explain: (preferences: TravelPreferences, course: RankedCourse) =>
    request<{ reason: RankedCourse['reason'] }>('/api/explain', { method: 'POST', body: { preferences, course }, timeoutMs: 90_000 }),
  cities: () => request<{ region: string; cities: Array<{ name: string; code: string }> }>('/api/regions/jeonnam-cities'),
  hotPlaces: () => request<{ places: HotPlace[]; source?: string; fetchedAt?: string }>('/api/hot-places', { auth: false, timeoutMs: 40_000 }),
  loginPhoto: () => request<{ img: string | null; title?: string | null; location?: string | null; source?: string }>('/api/login-photo', { auth: false, timeoutMs: 20_000 }),
  searchPlaces: (q: string, nearby?: { lat?: number; lng?: number }) => {
    const params = new URLSearchParams({ q });
    if (Number.isFinite(nearby?.lat) && Number.isFinite(nearby?.lng)) {
      params.set('lat', String(nearby?.lat));
      params.set('lng', String(nearby?.lng));
    }
    return request<{ places: PlaceSuggestion[] }>(`/api/places/search?${params}`, { auth: false, timeoutMs: 12_000 });
  },
  bookmarks: {
    list: () => request<BookmarkItem[] | { bookmarks: BookmarkItem[] }>('/api/user/bookmarks'),
    add: (data: { courseId: string; courseName: string; city: string }) =>
      request('/api/user/bookmarks/add', { method: 'POST', body: data }),
    remove: (courseId: string) => request(`/api/user/bookmarks/${courseId}`, { method: 'DELETE' }),
  },
  history: {
    record: (query: string, preferences: TravelPreferences) =>
      request('/api/user/search-history', { method: 'POST', body: { query, preferences } }),
    list: (limit = 8) => request<HistoryItem[] | { history: HistoryItem[] }>(`/api/user/search-history?limit=${limit}`),
    frequentCities: () => request<Array<{ city: string; count: number }> | { cities: Array<{ city: string; count: number }> }>('/api/user/search-history/frequent-cities?limit=5'),
    delete: (id?: string) => request(id ? `/api/user/search-history/${id}` : '/api/user/search-history', { method: 'DELETE' }),
  },
};

export function unwrapList<T>(value: T[] | Record<string, T[]> | undefined, key: string): T[] {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray((value as Record<string, T[]>)[key])) return (value as Record<string, T[]>)[key] ?? [];
  return [];
}
