/**
 * 백엔드 API 클라이언트
 * JWT 기반 인증을 지원합니다.
 */

import {
  AnalyzeResponse,
  ExplainRequest,
  RecommendResponse,
  RecommendationReason,
  RegionCity,
  TravelPreferences,
  RoutingPoint,
  TravelMode,
  SegmentResponse,
} from '../types/travel';

const configuredBase = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
export const API_BASE_URL = configuredBase === 'same-origin'
  ? (typeof window !== 'undefined' ? window.location.origin : undefined)
  : configuredBase;

export function devAccessHeaders(): Record<string, string> {
  const key = process.env.EXPO_PUBLIC_DEV_ACCESS_KEY;
  return key ? { 'X-Dev-Access-Key': key } : {};
}

export function resolveTourImageUrl(value?: string, apiBaseUrl = API_BASE_URL) {
  if (!value || !apiBaseUrl) return value;
  try {
    const url = new URL(value);
    if (url.hostname !== 'tong.visitkorea.or.kr') return value;
    return `${apiBaseUrl}/api/media/tour-image?url=${encodeURIComponent(value)}`;
  } catch {
    return value;
  }
}

function resolveRecommendationImages(response: RecommendResponse): RecommendResponse {
  return {
    ...response,
    courses: response.courses.map((course) => ({
      ...course,
      places: course.places.map((place) => ({
        ...place,
        imageUrl: resolveTourImageUrl(place.imageUrl),
      })),
    })),
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// 토큰 저장 (메모리 기반, 프로덕션에서는 AsyncStorage 사용)
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokenManager = {
  setTokens: (access: string, refresh: string) => {
    accessToken = access;
    refreshToken = refresh;
  },

  getAccessToken: () => accessToken,

  getRefreshToken: () => refreshToken,

  clearTokens: () => {
    accessToken = null;
    refreshToken = null;
  },
};

async function fetchJson<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
    body?: unknown;
    headers?: Record<string, string>;
    isAuth?: boolean; // 인증 엔드포인트는 토큰이 필요 없음
    timeoutMs?: number;
  } = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('API server is not configured (EXPO_PUBLIC_API_BASE_URL)');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...devAccessHeaders(),
      ...options.headers,
    };

    // 인증 필요한 API는 Authorization 헤더에 토큰 추가
    if (!options.isAuth && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'POST',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    // 토큰 만료시 refresh 시도
    if (response.status === 401 && !options.isAuth && refreshToken) {
      try {
        const refreshResponse = await fetchJson<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          {
            method: 'POST',
            body: { refreshToken },
            isAuth: true,
          }
        );

        tokenManager.setTokens(refreshResponse.accessToken, refreshResponse.refreshToken);

        // 새 토큰으로 원래 요청 재시도
        headers['Authorization'] = `Bearer ${refreshResponse.accessToken}`;

        const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
          method: options.method || 'POST',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({})) as { error?: string };
          throw new ApiError(retryResponse.status, errorData.error || `API error: ${retryResponse.status}`);
        }

        return (await retryResponse.json()) as T;
      } catch (error) {
        // Refresh 실패시 로그아웃
        tokenManager.clearTokens();
        throw error;
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string };
      throw new ApiError(response.status, errorData.error || `API error: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('추천 서버의 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new Error('추천 서버에 연결할 수 없습니다. 네트워크와 서버 상태를 확인해주세요.');
  } finally {
    clearTimeout(timeout);
  }
}

export const apiClient = {
  routeSegment: (from: RoutingPoint, to: RoutingPoint, mode: TravelMode) =>
    fetchJson<SegmentResponse>('/api/routes/segment', { body: { from, to, mode }, timeoutMs: 15000 }),
  /**
   * 인증 관련 API
   */
  auth: {
    login: (body: { email: string; password: string }) =>
      fetchJson('/auth/login', { method: 'POST', body, isAuth: true }),

    signup: (body: { email: string; displayName: string; password: string }) =>
      fetchJson('/auth/signup', { method: 'POST', body, isAuth: true }),

    refresh: (body: { refreshToken: string }) =>
      fetchJson('/auth/refresh', { method: 'POST', body, isAuth: true }),

    logout: () =>
      fetchJson('/auth/logout', { method: 'POST', isAuth: false }),
  },

  /**
   * 사용자 관련 API
   */
  user: {
    updateProfile: (body: { displayName: string }) =>
      fetchJson('/api/user/profile', { method: 'PATCH', body }),

    me: () =>
      fetchJson('/api/user/me', { method: 'GET' }),

    deleteAccount: () =>
      fetchJson('/api/user/me', { method: 'DELETE' }),
  },

  /**
   * 북마크 관련 API
   */
  bookmarks: {
    add: (data: { courseId: string; courseName: string; city: string }) =>
      fetchJson('/api/user/bookmarks/add', { method: 'POST', body: data }),

    remove: (courseId: string) =>
      fetchJson(`/api/user/bookmarks/${courseId}`, { method: 'DELETE' }),

    list: (options?: { city?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (options?.city) params.append('city', options.city);
      if (options?.limit) params.append('limit', String(options.limit));
      const query = params.toString();
      return fetchJson(`/api/user/bookmarks${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    isBookmarked: (courseId: string) =>
      fetchJson(`/api/user/bookmarks/${courseId}/is-bookmarked`, { method: 'GET' }),
  },

  /**
   * 검색 이력 관련 API
   */
  searchHistory: {
    record: (data: { query: string; preferences: any }) =>
      fetchJson('/api/user/search-history', { method: 'POST', body: data }),

    list: (limit?: number) => {
      const params = new URLSearchParams();
      if (limit) params.append('limit', String(limit));
      const query = params.toString();
      return fetchJson(`/api/user/search-history${query ? `?${query}` : ''}`, { method: 'GET' });
    },

    frequentCities: (limit?: number) => {
      const params = new URLSearchParams();
      if (limit) params.append('limit', String(limit));
      const query = params.toString();
      return fetchJson(
        `/api/user/search-history/frequent-cities${query ? `?${query}` : ''}`,
        { method: 'GET' },
      );
    },

    delete: (historyId?: string) => {
      const path = historyId ? `/api/user/search-history/${historyId}` : '/api/user/search-history';
      return fetchJson(path, { method: 'DELETE' });
    },
  },

  /**
   * 분석 API
   */
  analyze: (body: { query: string }) =>
    fetchJson<AnalyzeResponse>('/api/analyze', { method: 'POST', body, timeoutMs: 90_000 }),

  /**
   * 추천 API
   */
  recommend: async (body: { preferences: TravelPreferences }) =>
    resolveRecommendationImages(await fetchJson<RecommendResponse>(
      '/api/recommend',
      { method: 'POST', body, timeoutMs: 130_000 },
    )),

  /**
   * 전남 시군구 목록 (TourAPI ldongCode2)
   */
  regions: {
    jeonnamCities: () =>
      fetchJson<{ region: string; cities: RegionCity[] }>('/api/regions/jeonnam-cities', { method: 'GET' }),
  },

  /**
   * 설명 API
   */
  explain: (body: ExplainRequest) =>
    fetchJson<{ reason: RecommendationReason }>('/api/explain', { method: 'POST', body, timeoutMs: 90_000 }),
};
