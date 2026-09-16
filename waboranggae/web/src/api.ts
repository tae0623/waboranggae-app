const TOKEN_KEY = 'waboranggae.accessToken';
import { PRIVACY_NOTICE_VERSION } from '../../src/domain/privacyNotice';
import { apiFetch, getWebRuntime, mediaUrl } from './runtime';
import type { RoutingPoint, TravelMode, SegmentResponse } from '../../src/types/travel';
const REFRESH_KEY = 'waboranggae.refreshToken';
let nativeTokens: { access: string; refresh: string } | null = null;
let sessionVersion = 0;
let refreshInFlight: Promise<string | null> | null = null;
let browserSessionSupported=false;
let autoLogin=false;
let browserRestoreInFlight:Promise<boolean>|null=null;
function currentSessionId(){try{const raw=tokenStore.getAccess()?.split('.')[1];if(!raw)return '';const id=JSON.parse(atob(raw.replace(/-/g,'+').replace(/_/g,'/'))).sessionId;return typeof id==='string'&&/^[a-f0-9]{64}$/.test(id)?id:'';}catch{return '';}}
export function setAutoLogin(value:boolean){autoLogin=value;}
export async function browserSessionStatus(){
  if(getWebRuntime().nativeRequest || getWebRuntime().apiBaseUrl)return {supported:false,persistent:false};
  try{const response=await apiFetch('/auth/web-session',{method:'GET',signal:AbortSignal.timeout(10000)},10000);const result=await response.json();browserSessionSupported=response.ok&&result.supported===true;return {supported:browserSessionSupported,persistent:result.persistent===true};}catch{return {supported:false,persistent:false};}
}
export function restoreBrowserLogin(){
  if(browserRestoreInFlight)return browserRestoreInFlight;
  const version=tokenStore.version();
  browserRestoreInFlight=(async()=>{const status=await browserSessionStatus();if(!status.supported||!status.persistent||version!==tokenStore.version())return false;
    const result=await request<{accessToken:string;refreshToken:string}>('/auth/web-session',{method:'POST',body:{},auth:false});
    if(version!==tokenStore.version())return false;await tokenStore.set(result.accessToken,result.refreshToken);return true;
  })().finally(()=>{browserRestoreInFlight=null;});return browserRestoreInFlight;
}

function refreshSession(headers: Record<string, string>, signal: AbortSignal): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const version = tokenStore.version(), previous = tokenStore.getRefresh();
  refreshInFlight = (async () => {
    const response = await apiFetch('/auth/refresh', { method: 'POST', headers: { ...headers, Authorization: '' },
      body: JSON.stringify({ refreshToken: previous }), signal }, 15000);
    if (version !== tokenStore.version() || previous !== tokenStore.getRefresh()) return null;
    if (response.ok) {
      const tokens = await response.json() as { accessToken: string; refreshToken: string };
      await tokenStore.set(tokens.accessToken, tokens.refreshToken, true);
      return version === tokenStore.version() ? tokens.accessToken : null;
    }
    if (response.status === 401) { await tokenStore.clear(); return null; }
    throw new ApiError(response.status, '로그인 정보를 갱신하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStore = {
  version: () => sessionVersion,
  restoreNative(tokens: typeof nativeTokens) { nativeTokens = tokens; },
  getAccess: () => getWebRuntime().persistSession ? nativeTokens?.access ?? null : sessionStorage.getItem(TOKEN_KEY),
  getRefresh: () => getWebRuntime().persistSession ? nativeTokens?.refresh ?? null : sessionStorage.getItem(REFRESH_KEY),
  async set(access: string, refresh: string, refreshOnly = false) {
    const version = sessionVersion;
    if (getWebRuntime().persistSession) {
      await getWebRuntime().persistSession!({ access, refresh });
      if (version !== sessionVersion) throw new ApiError(401, '로그인 상태가 변경되었습니다. 다시 로그인해 주세요.');
      nativeTokens = { access, refresh };
    } else {
      sessionStorage.setItem(TOKEN_KEY, access);
      sessionStorage.setItem(REFRESH_KEY, refresh);
    }
    if (!refreshOnly) sessionVersion++;
  },
  async clear() {
    const previousSessionId=currentSessionId();
    const clearCookie=browserSessionSupported||tokenStore.getRefresh()==='__httpOnly';
    sessionVersion++;
    nativeTokens = null;
    if (!getWebRuntime().persistSession) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
    }
    if(typeof window!=='undefined')window.dispatchEvent(new Event('ddubugi:session-cleared'));
    await getWebRuntime().persistSession?.(null);
    if(clearCookie)await apiFetch('/auth/web-session',{method:'DELETE',headers:{'X-Web-Session':'cookie','X-Web-Session-ID':previousSessionId},signal:AbortSignal.timeout(5000)},5000).catch(()=>undefined);
  },
};

async function request<T>(path: string, options: {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
} = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if(browserSessionSupported||tokenStore.getRefresh()==='__httpOnly'){headers['X-Web-Session']='cookie';headers['X-Web-Auto-Login']=autoLogin?'1':'0';headers['X-Web-Session-ID']=currentSessionId();}
  if (getWebRuntime().devAccessKey) headers['X-Dev-Access-Key'] = getWebRuntime().devAccessKey!;
  const access = tokenStore.getAccess();
  if (options.auth !== false && access) headers.Authorization = `Bearer ${access}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const response = await apiFetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    }, options.timeoutMs ?? 45_000);

    if (response.status === 401 && options.auth !== false && tokenStore.getRefresh()) {
      const accessToken = await refreshSession(headers, controller.signal);
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
        const retry = await apiFetch(path, {
          method: options.method ?? 'GET',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        }, options.timeoutMs ?? 45_000);
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({})) as { error?: string };
          throw new ApiError(retry.status, err.error || `API error ${retry.status}`);
        }
        return await retry.json() as T;
      }
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
  consentVersion?: string | null;
  consentedAt?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface TravelPreferences {
  scheduleMode?: 'fixed' | 'course-first';
  requiredContentId?: string;
  requiredPlaceName?: string;
  timeBudgetMode?: 'local' | 'door-to-door';
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

export type { RankedCourse } from '../../src/types/travel';
import type { RankedCourse } from '../../src/types/travel';

export interface RecommendResponse {
  courses: RankedCourse[];
  source: 'tour-api' | 'kakao' | 'mixed' | 'demo';
  planningSource?: 'ollama' | 'rules';
  fallbackReason?: string | null;
}

export interface BookmarkItem {
  snapshot?: RankedCourse | null;
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
  source: 'kakao' | 'kakao-address' | 'nominatim' | 'tour-api';
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
  metricNote?: string;
  demand?: { baseMonth: string; stayScore: number; spendScore: number; score: number };
  tags: string[];
  isNew?: boolean;
  isTrending?: boolean;
  source?: 'demand' | 'visitors' | 'festival' | 'tour-api';
  address?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  imageCredit?: string;
  imageContentId?: string;
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

export type ForecastResult = {available:false;source:'kma';requestedDate:string;reason:string;code:string}
  | {available:true;source:'kma';requestedDate:string;issuedAt:string;condition:string;minTemperature:number;maxTemperature:number;maxRainProbability:number|null;hours:{time:string;temperature:number;condition:string;rainProbability:number|null}[]};

export const api = {
  refreshRoute: (preferences: TravelPreferences, course: RankedCourse) => request<{course:RankedCourse}>('/api/recommend/refresh-route', {method:'POST',body:{preferences,courseId:course.id,placeIds:course.places.map(p=>p.id)},timeoutMs:130000}),
  forecast: (lat:number,lng:number,date:string,startTime:string,endTime:string) => request<ForecastResult>('/api/weather/forecast?' + new URLSearchParams({lat:String(lat),lng:String(lng),date,startTime,endTime}),{auth:false,timeoutMs:15000}),
  editCourse: (preferences: TravelPreferences, courseId: string, placeIds: string[]) =>
    request<{ course: RankedCourse }>('/api/recommend/edit', { method: 'POST', body: { preferences, courseId, placeIds }, timeoutMs: 130000 }),
  socialProviders: () => request<{ providers: Array<{ id: string; enabled: boolean; reason: string }> }>('/auth/social/providers', { auth: false }),
  socialStart: (provider: 'kakao' | 'google') => request<{ flowId: string; pollSecret: string; authorizationUrl: string }>(`/auth/social/${provider}/start`, { method: 'POST', auth: false, body: {} }),
  socialResult: (flowId: string, pollSecret: string) => request<({ status: 'pending' | 'consent_required' } | (AuthResponse & { status: 'complete' }))>('/auth/social/result', { method: 'POST', auth: false, body: { flowId, pollSecret } }),
  socialConsent: (flowId: string, pollSecret: string) => request('/auth/social/consent', { method: 'POST', auth: false, body: { flowId, pollSecret, privacyConsent: true, consentVersion: PRIVACY_NOTICE_VERSION } }),
  acceptPrivacy: () => request<AuthUser>('/auth/consent', { method: 'POST', body: { privacyConsent: true, consentVersion: PRIVACY_NOTICE_VERSION } }),
  weather: (lat: number, lng: number) =>
    request<import('../../src/types/weather').WeatherResult>(`/api/weather/current?lat=${lat}&lng=${lng}`, { auth: false, timeoutMs: 10000 }),
  routeSegment: (from: RoutingPoint, to: RoutingPoint, mode: TravelMode) =>
    request<SegmentResponse>('/api/routes/segment', { method: 'POST', body: {from, to, mode}, timeoutMs: 15000 }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  signup: (email: string, displayName: string, password: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: { email, displayName, password, privacyConsent: true, consentVersion: PRIVACY_NOTICE_VERSION }, auth: false }),
  logout: () => request('/auth/logout/current', { method: 'POST', body: {} }),
  me: () => request<AuthUser>('/api/user/me'),
  updateProfile: (displayName: string) =>
    request<AuthUser>('/api/user/profile', { method: 'PATCH', body: { displayName } }),
  deleteAccount: () => request('/api/user/me', { method: 'DELETE' }),
  recommend: (preferences: TravelPreferences) =>
    request<RecommendResponse>('/api/recommend', { method: 'POST', body: { preferences }, timeoutMs: 130_000 }).then(result => ({
      ...result, courses: result.courses.map(course => ({ ...course, places: course.places.map(place => ({ ...place, imageUrl: mediaUrl(place.imageUrl) || undefined })) })),
    })),
  explain: (preferences: TravelPreferences, course: RankedCourse) =>
    request<{ reason: RankedCourse['reason'] }>('/api/explain', { method: 'POST', body: { preferences, course }, timeoutMs: 90_000 }),
  cities: () => request<{ region: string; cities: Array<{ name: string; code: string }> }>('/api/regions/jeonnam-cities'),
  hotPlaces: () => request<{ places: HotPlace[]; source?: string; fetchedAt?: string }>('/api/hot-places', { auth: false, timeoutMs: 40_000 }).then(result => ({ ...result, places: result.places.map(place => ({ ...place, img: mediaUrl(place.img) || '' })) })),
  loginPhoto: () => request<{ img: string | null; title?: string | null; location?: string | null; source?: string }>('/api/login-photo', { auth: false, timeoutMs: 20_000 }).then(result => ({ ...result, img: mediaUrl(result.img) || null })),
  searchPlaces: (q: string) => {
    const params = new URLSearchParams({ q });
    return request<{ places: PlaceSuggestion[] }>(`/api/places/search?${params}`, { auth: false, timeoutMs: 12_000 });
  },
  bookmarks: {
    list: () => request<BookmarkItem[] | { bookmarks: BookmarkItem[] }>('/api/user/bookmarks'),
    add: (data: { courseId: string; courseName: string; city: string; snapshot?: RankedCourse }) =>
      request('/api/user/bookmarks/add', { method: 'POST', body: data }),
    remove: (courseId: string) => request(`/api/user/bookmarks/${courseId}`, { method: 'DELETE' }),
  },
  history: {
    record: (query: string, preferences: TravelPreferences) =>
      request('/api/user/search-history', { method: 'POST', body: { query, preferences, saveConsent: true } }),
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
