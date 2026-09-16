import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { isTeamWebRoute } from '../../../src/domain/teamWebRoutes';
// Temporary server-only gate for deployment validation. Never embed this key in a
// release APK. Disable only after the release security/availability review.
const deviceRoutes:Record<string,string[]>={
  GET:['/auth/social/providers','/api/regions/jeonnam-cities','/api/hot-places','/api/login-photo','/api/places/search','/api/media/tour-image','/api/weather/current','/api/weather/forecast'],
  POST:['/api/recommend','/api/recommend/edit','/api/recommend/refresh-route','/api/analyze','/api/explain','/api/routes/segment'],
};
const accountRoutes:Record<string,string[]>={
  GET:['/api/user/me','/api/user/bookmarks','/api/user/search-history','/api/user/search-history/frequent-cities'],
  POST:['/auth/signup','/auth/login','/auth/refresh','/auth/logout','/auth/logout/current','/auth/consent','/auth/social/kakao/start','/auth/social/google/start','/auth/social/result','/auth/social/consent','/api/user/bookmarks/add','/api/user/search-history'],
  PATCH:['/api/user/profile'],
  DELETE:['/api/user/me','/api/user/search-history'],
};
function validCredential(prefix:string,token:string,now:number) {
  if(!/^[a-f0-9]{64}$/.test(token))return false;
  const expires=Date.parse(process.env[prefix+'_EXPIRES_AT']||'');
  if(!Number.isFinite(expires)||expires<=now)return false;
  const expected=process.env[prefix+'_HASH']||'';
  if(!/^[a-f0-9]{64}$/.test(expected))return false;
  return timingSafeEqual(Buffer.from(expected,'hex'),createHash('sha256').update(token).digest());
}
export function validDeviceValidation(method:string,path:string,token:string,now=Date.now()) {
  const guestRoute=deviceRoutes[method]?.includes(path);
  if(guestRoute && validCredential('EDGE_DEVICE_VALIDATION',token,now))return true;
  // This outer admission gate never replaces the routes' JWT, ownership or consent checks.
  const accountRoute=accountRoutes[method]?.includes(path)
    || (method==='DELETE' && /^\/api\/user\/(?:bookmarks|search-history)\/[^/]{1,600}$/.test(path))
    || (method==='GET' && /^\/api\/user\/bookmarks\/[^/]{1,600}\/is-bookmarked$/.test(path));
  return Boolean((guestRoute||accountRoute) && validCredential('EDGE_ACCOUNT_VALIDATION',token,now));
}
export function isSocialCallback(method:string,path:string) {
  return method==='GET' && /^\/auth\/social\/(?:kakao|google)\/callback$/.test(path);
}
export function validTeamWebValidation(method: string, path: string, token: string, now = Date.now()) {
  return isTeamWebRoute(method, path) && validCredential('EDGE_TEAM_WEB_VALIDATION', token, now);
}
export const edgeValidation: RequestHandler = (req, res, next) => {
  if (process.env.API_RUNTIME !== 'supabase-edge' || process.env.EDGE_VALIDATION_MODE !== 'true') { next(); return; }
  if (['/livez','/readyz'].includes(req.path) || req.path.startsWith('/legal/')) { next(); return; }
  // Provider browsers cannot attach the device header. The callback handler verifies
  // a random, stored, unexpired, one-use state created by an admitted /start request.
  // It never returns an app token; /result still requires the device key + poll secret.
  if(isSocialCallback(req.method,req.path)){next();return;}
  if(validTeamWebValidation(req.method,req.path,req.get('X-Team-Web-Key')||'')){next();return;}
  if(validDeviceValidation(req.method,req.path,req.get('X-Dev-Access-Key')||'')){next();return;}
  const expected=Buffer.from(process.env.EDGE_VALIDATION_KEY || '');
  const supplied=Buffer.from(req.get('X-Waboranggae-Validation') || '');
  if (expected.length < 32 || expected.length !== supplied.length || !timingSafeEqual(expected,supplied)) {
    res.status(403).set('Cache-Control','no-store').json({error:'현재 서버는 출시 전 비공개 검증 중입니다.'}); return;
  }
  next();
};
