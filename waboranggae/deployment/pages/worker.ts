import { browserSessionCapability, browserSessionProxy } from './browser-session';
import { isTeamWebRoute } from '../../src/domain/teamWebRoutes';
import { SOCIAL_RETURN_ORIGIN, SOCIAL_RETURN_PATH } from '../../src/domain/socialReturn';
import { socialCompletionPage } from './social-completion';
import {signupBotPage} from './signup-bot-page';
import {publicAppPage} from './public-app-page';

export const API_BASE = 'https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
const COOKIE = '__Host-ddubugi_team';
const BODY_LIMIT = 128 * 1024;
const SESSION_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();
export interface PagesEnv {
  TURNSTILE_SITE_KEY?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
  TEAM_WEB_ORIGIN: string;
  TEAM_WEB_PASSWORD: string;
  TEAM_WEB_SESSION_SECRET: string;
  TEAM_WEB_API_KEY: string;
  TEAM_WEB_API_EXPIRES_AT: string;
}
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
async function equal(a: string, b: string) {
  const aa = await digest(a), bb = await digest(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i]! ^ bb[i]!;
  return diff === 0;
}
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
function settingsValid(env: PagesEnv) {
  return /^https:\/\/[a-z0-9][a-z0-9-]*\.pages\.dev$/.test(env.TEAM_WEB_ORIGIN || '')
    && /^[a-f0-9]{48,128}$/.test(env.TEAM_WEB_PASSWORD || '')
    && /^[a-f0-9]{64}$/.test(env.TEAM_WEB_SESSION_SECRET || '')
    && /^[a-f0-9]{64}$/.test(env.TEAM_WEB_API_KEY || '')
    && new Set([env.TEAM_WEB_PASSWORD, env.TEAM_WEB_SESSION_SECRET, env.TEAM_WEB_API_KEY]).size === 3
    && Date.parse(env.TEAM_WEB_API_EXPIRES_AT || '') > Date.now();
}
function decorate(response: Response, map = false, cookie?: string, browserCookie?: string) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  // Kakao checks the registered SDK origin. Cross-origin requests receive only
  // that public origin, never the map fragment or a user's selected places.
  headers.set('Referrer-Policy', map ? 'strict-origin-when-cross-origin' : 'no-referrer');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  headers.set('Content-Security-Policy', "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; frame-src 'self'; "
    + (map ? "script-src 'self' 'unsafe-inline' https://*.kakao.com https://*.daumcdn.net; connect-src 'self' https://*.kakao.com https://*.daumcdn.net; " : "script-src 'self'; connect-src 'self'; ")
    + "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' https: data:;");
  for (const name of ['access-control-allow-origin', 'access-control-allow-credentials', 'server', 'x-powered-by', 'set-cookie']) headers.delete(name);
  if (cookie) headers.set('Set-Cookie', `${COOKIE}=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`);
  if (browserCookie) headers.append('Set-Cookie',browserCookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function error(status: number, message: string, challenge = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
  if (challenge) headers['WWW-Authenticate'] = 'Basic realm="Ddubugi Team", charset="UTF-8"';
  return decorate(new Response(JSON.stringify({ error: message }), { status, headers }));
}
async function cookieMessage(env: PagesEnv, expiry: number) {
  return `${env.TEAM_WEB_ORIGIN}|${expiry}|${base64url(await digest(env.TEAM_WEB_PASSWORD))}`;
}
async function admit(request: Request, env: PagesEnv) {
  const raw = request.headers.get('cookie') || '';
  const token = raw.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1) || '';
  const match = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  const now = Math.floor(Date.now() / 1000);
  if (match) {
    const expiry = Number(match[1]);
    if (expiry > now && expiry <= now + SESSION_SECONDS
        && await equal(match[2]!, await sign(await cookieMessage(env, expiry), env.TEAM_WEB_SESSION_SECRET))) return { allowed: true };
  }
  const basic = request.headers.get('authorization') || '';
  if (!basic.startsWith('Basic ') || basic.length > 512) return { allowed: false };
  let supplied = '';
  try { supplied = atob(basic.slice(6)); } catch { return { allowed: false }; }
  if (!await equal(supplied, 'team:' + env.TEAM_WEB_PASSWORD)) return { allowed: false };
  const expiry = now + SESSION_SECONDS;
  return { allowed: true, cookie: `${expiry}.${await sign(await cookieMessage(env, expiry), env.TEAM_WEB_SESSION_SECRET)}` };
}
async function readBoundedBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT)) throw new Error('BODY_LIMIT');
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > BODY_LIMIT) { await reader.cancel(); throw new Error('BODY_LIMIT'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes.buffer;
}
export async function handlePagesRequest(request: Request, env: PagesEnv, upstream: Fetcher = fetch) {
  const url = new URL(request.url);
  if (request.url.length > 16384) return error(414, '요청 주소가 너무 깁니다.');
  // Only explicit public documents and isolated auth helper pages are public on the canonical host.
  // It never reaches ASSETS/upstream or grants a team/account session.
  if (url.origin === SOCIAL_RETURN_ORIGIN && url.pathname === SOCIAL_RETURN_PATH && ['GET','HEAD'].includes(request.method)) return socialCompletionPage(request);
  if(url.origin===SOCIAL_RETURN_ORIGIN&&url.pathname==='/auth/bot-check'&&['GET','HEAD'].includes(request.method))return signupBotPage(request,env.TURNSTILE_SITE_KEY);
  if(url.origin===SOCIAL_RETURN_ORIGIN&&['/app','/app/privacy','/app/terms','/app/delete-account'].includes(url.pathname)&&['GET','HEAD'].includes(request.method))return publicAppPage(request);
  if (!settingsValid(env)) return error(503, '팀 웹 접속 설정을 준비 중입니다.');
  // Preview deployments cannot use production bindings on another hostname.
  if (url.origin !== env.TEAM_WEB_ORIGIN) return error(403, '등록된 팀 웹 주소로 접속해 주세요.');
  const topNavigation = request.method === 'GET' && request.headers.get('sec-fetch-mode') === 'navigate'
    && request.headers.get('sec-fetch-dest') === 'document';
  if (request.headers.get('sec-fetch-site') === 'cross-site' && !topNavigation) return error(403, '다른 사이트에서의 요청은 허용하지 않습니다.');
  const admission = await admit(request, env);
  if (!admission.allowed) return error(401, '팀 접속 아이디와 암호를 입력해 주세요.', true);
  const unsafe = !['GET', 'HEAD'].includes(request.method);
  const origin = request.headers.get('origin');
  if (origin && origin !== env.TEAM_WEB_ORIGIN) return error(403, '요청 출처가 올바르지 않습니다.');
  if (unsafe && !origin) return error(403, '요청 출처를 확인할 수 없습니다.');
  const api = /^\/(api|auth|maps|legal)(\/|$)/.test(url.pathname) || ['/livez', '/readyz'].includes(url.pathname);
  if (!api) {
    if (!['GET', 'HEAD'].includes(request.method)) return error(405, '허용되지 않은 요청 방식입니다.');
    if (url.pathname.includes('%') || /(?:^|\/)\./.test(url.pathname) || /\.map$/.test(url.pathname)
        || /_worker|_routes|wrangler|package\.json/i.test(url.pathname)) return error(404, '페이지를 찾을 수 없습니다.');
    // Never forward the team password/cookie to the static asset binding.
    const response = await env.ASSETS.fetch(new Request(url.href, { method: request.method }));
    return decorate(response, false, admission.cookie);
  }
  const browserSession = url.pathname === '/auth/web-session' && ['GET','POST','DELETE'].includes(request.method);
  if (browserSession && request.method === 'GET') return decorate(await browserSessionCapability(request,env),false,admission.cookie);
  if (!browserSession && !isTeamWebRoute(request.method, url.pathname)) return error(404, '허용되지 않은 API 경로입니다.');
  const contentType = request.headers.get('content-type') || '';
  if (request.body && !/^application\/json(?:\s*;|$)/i.test(contentType)) return error(415, 'JSON 요청만 지원합니다.');
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') return error(415, '압축된 요청은 지원하지 않습니다.');
  let body: ArrayBuffer | undefined;
  try { body = await readBoundedBody(request); } catch { return error(413, '요청 데이터가 너무 큽니다.'); }
  const headers = new Headers({ 'X-Team-Web-Key': env.TEAM_WEB_API_KEY, Accept: 'application/json' });
  // Only Cloudflare's incoming client address, never a browser-selected forwarding header.
  const clientIp=request.headers.get('cf-connecting-ip');
  if(clientIp)headers.set('X-Team-Client-IP',clientIp);
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && auth.length <= 16384) headers.set('Authorization', auth);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  try {
    const response = await browserSessionProxy(request,env,url.pathname,body,headers,upstream,API_BASE);
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel(); return error(502, '서버의 예상하지 못한 이동 응답을 차단했습니다.');
    }
    const outputHeaders = new Headers();
    const type = response.headers.get('content-type') || 'application/json';
    // Only the map response is HTML rewritten to text by the Supabase gateway.
    // Legal pages are deliberately plain text; /legal/config must remain JSON.
    const html = url.pathname === '/maps/embed';
    outputHeaders.set('Content-Type', html && response.ok ? 'text/html; charset=utf-8' : type);
    for (const name of ['retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset']) {
      const value = response.headers.get(name); if (value) outputHeaders.set(name, value);
    }
    return decorate(new Response(response.body, { status: response.status, headers: outputHeaders }), url.pathname === '/maps/embed', admission.cookie, request.headers.get('x-web-session')==='cookie'||browserSession ? response.headers.get('set-cookie')||undefined : undefined);
  } catch { return error(502, '서버 연결이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'); }
}
// Cloudflare supplies an ExecutionContext as its third argument, not a fetcher.
export default { fetch(request: Request, env: PagesEnv) { return handlePagesRequest(request, env); } };
