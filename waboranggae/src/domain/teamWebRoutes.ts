// Shared by the Pages gateway and the Supabase admission gate. This only admits
// requests; account routes must still validate the app JWT, owner and consent.
const routes: Record<string, readonly string[]> = {
  GET: [
    '/auth/social/providers', '/api/regions/jeonnam-cities', '/api/hot-places',
    '/api/login-photo', '/api/places/search', '/api/media/tour-image',
    '/api/weather/current', '/api/weather/forecast', '/api/user/me',
    '/api/user/bookmarks', '/api/user/search-history',
    '/api/user/search-history/frequent-cities', '/maps/embed',
    '/legal/privacy', '/legal/config', '/legal/attributions', '/legal/delete-account',
    '/livez', '/readyz',
  ],
  POST: [
    '/api/recommend', '/api/recommend/edit', '/api/recommend/refresh-route',
    '/api/analyze', '/api/explain', '/api/routes/segment',
    '/api/places/resolve',
    '/auth/signup', '/auth/login', '/auth/refresh', '/auth/logout',
    '/auth/logout/current', '/auth/consent', '/auth/social/kakao/start',
    '/auth/social/google/start', '/auth/social/result', '/auth/social/consent',
    '/api/user/bookmarks/add', '/api/user/search-history',
  ],
  PATCH: ['/api/user/profile'],
  DELETE: ['/api/user/me', '/api/user/search-history'],
};

export function isTeamWebRoute(method: string, path: string) {
  if (path.length > 1024 || !path.startsWith('/') || /[\\?#\x00-\x20]/.test(path)) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return false; }
  if (/[\\?#\x00-\x20]/.test(decoded) || /%|\/\//.test(decoded)
      || decoded.split('/').some(p => p === '.' || p === '..')
      || decoded.split('/').length !== path.split('/').length) return false;
  if (routes[method]?.includes(path)) return true;
  if (method === 'DELETE' && /^\/api\/user\/(bookmarks|search-history)\/[^/]{1,600}$/.test(path)) return true;
  return method === 'GET' && /^\/api\/user\/bookmarks\/[^/]{1,600}\/is-bookmarked$/.test(path);
}
