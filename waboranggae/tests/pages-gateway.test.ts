import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import worker, { API_BASE, handlePagesRequest, type PagesEnv } from '../deployment/pages/worker';
import { isTeamWebRoute } from '../src/domain/teamWebRoutes';
import { edgeValidation, validDeviceValidation, validTeamWebValidation } from '../server/src/runtime/edge-validation';

const origin = 'https://test-team.pages.dev';
const secret = 'a'.repeat(64);
function setup() {
  const assets = vi.fn(async (_request: Request) => new Response('<html>test</html>', { headers: { 'Content-Type': 'text/html' } }));
  const env: PagesEnv = {
    ASSETS: { fetch: assets }, TEAM_WEB_ORIGIN: origin,
    TEAM_WEB_PASSWORD: 'b'.repeat(48), TEAM_WEB_SESSION_SECRET: 'c'.repeat(64),
    TEAM_WEB_API_KEY: secret, TEAM_WEB_API_EXPIRES_AT: new Date(Date.now() + 86400_000).toISOString(),
  };
  const upstream = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }));
  const request = (path = '/', init: RequestInit = {}) => new Request(origin + path, {
    ...init, headers: { Authorization: 'Basic ' + btoa('team:' + env.TEAM_WEB_PASSWORD), ...Object.fromEntries(new Headers(init.headers)) },
  });
  return { assets, env, upstream, request };
}
async function session(env: PagesEnv) {
  const response = await handlePagesRequest(new Request(origin, { headers: { Authorization: 'Basic ' + btoa('team:' + env.TEAM_WEB_PASSWORD) } }), env);
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('private Pages gateway', () => {
  it('publishes only the isolated signup widget without widening team access', async () => {
    const {env,assets,upstream}=setup();
    env.TEAM_WEB_ORIGIN='https://waboranggae-app.pages.dev';
    env.TURNSTILE_SITE_KEY='fixture-site-key';
    const widget=await handlePagesRequest(new Request(env.TEAM_WEB_ORIGIN+'/auth/bot-check'),env,upstream);
    expect(widget.status).toBe(200);
    expect(widget.headers.get('set-cookie')).toBeNull();
    expect(await widget.text()).not.toContain(env.TEAM_WEB_API_KEY);
    for(const path of ['/', '/auth/signup-config','/api/user/me']){
      expect((await handlePagesRequest(new Request(env.TEAM_WEB_ORIGIN+path),env,upstream)).status).toBe(401);
    }
    expect((await handlePagesRequest(new Request(env.TEAM_WEB_ORIGIN+'/auth/bot-check',{method:'POST'}),env,upstream)).status).toBe(401);
    expect((await handlePagesRequest(new Request('https://preview.waboranggae-app.pages.dev/auth/bot-check'),env,upstream)).status).toBe(403);
    expect(assets).not.toHaveBeenCalled();expect(upstream).not.toHaveBeenCalled();
  });
  it.each(['TEAM_WEB_PASSWORD', 'TEAM_WEB_SESSION_SECRET', 'TEAM_WEB_API_KEY', 'TEAM_WEB_API_EXPIRES_AT', 'TEAM_WEB_ORIGIN'] as const)('fails closed when %s is absent', async field => {
    const { env, request, assets, upstream } = setup(); env[field] = '';
    expect((await handlePagesRequest(request(), env, upstream)).status).toBe(503);
    expect(assets).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects expired keys and reused credentials', async () => {
    const { env, request, upstream } = setup();
    env.TEAM_WEB_API_EXPIRES_AT = '2020-01-01T00:00:00Z';
    expect((await handlePagesRequest(request(), env, upstream)).status).toBe(503);
    env.TEAM_WEB_API_EXPIRES_AT = new Date(Date.now() + 10000).toISOString();
    env.TEAM_WEB_SESSION_SECRET = env.TEAM_WEB_API_KEY;
    expect((await handlePagesRequest(request(), env, upstream)).status).toBe(503);
  });
  it('rejects preview hosts even with production secrets', async () => {
    const { env, upstream, assets } = setup();
    expect((await handlePagesRequest(new Request('https://hash.test-team.pages.dev/'), env, upstream)).status).toBe(403);
    expect(assets).not.toHaveBeenCalled(); expect(upstream).not.toHaveBeenCalled();
  });
  it.each(['/', '/assets/index.js', '/api/hot-places', '/maps/embed', '/api/media/tour-image', '/legal/privacy'])('gates %s before fetching anything', async path => {
    const { env, upstream, assets } = setup();
    const res = await handlePagesRequest(new Request(origin + path), env, upstream);
    expect(res.status).toBe(401); expect(res.headers.get('www-authenticate')).toContain('Basic');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(upstream).not.toHaveBeenCalled(); expect(assets).not.toHaveBeenCalled();
  });
  it('issues a secure cookie without passing credentials to static assets', async () => {
    const { env, request, assets, upstream } = setup();
    const res = await handlePagesRequest(request(), env, upstream);
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/^__Host-ddubugi_team=/);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=43200']) expect(res.headers.get('set-cookie')).toContain(flag);
    expect([...assets.mock.calls[0]![0].headers]).toEqual([]);
    expect(await res.text()).not.toContain(env.TEAM_WEB_PASSWORD);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('allows same-origin cookie requests, rejects tampering and password rotation', async () => {
    const { env, upstream } = setup(); const cookie = await session(env);
    const req = (value = cookie) => new Request(origin + '/api/hot-places', { headers: { cookie: value } });
    expect((await handlePagesRequest(req(), env, upstream)).status).toBe(200);
    expect((await handlePagesRequest(req(cookie + 'x'), env, upstream)).status).toBe(401);
    env.TEAM_WEB_PASSWORD = 'd'.repeat(48);
    expect((await handlePagesRequest(req(), env, upstream)).status).toBe(401);
  });
  it('expires the browser session after twelve hours', async () => {
    vi.useFakeTimers(); const { env, upstream } = setup(); const cookie = await session(env);
    vi.setSystemTime(Date.now() + 12 * 3600_000 + 1000);
    expect((await handlePagesRequest(new Request(origin + '/', { headers: { cookie } }), env, upstream)).status).toBe(401);
  });
  it('forwards only the dedicated server key and app bearer token', async () => {
    const { env, upstream } = setup(); const cookie = await session(env);
    const res = await handlePagesRequest(new Request(origin + '/api/user/me', { headers: {
      cookie, Authorization: 'Bearer app-jwt', 'X-Dev-Access-Key': 'client-injected', 'X-Team-Web-Key': 'client-injected',
      'X-Waboranggae-Validation': 'client-injected', 'X-Forwarded-For': '1.2.3.4', Origin: origin,
    } }), env, upstream);
    expect(res.status).toBe(200);
    const [url, init] = upstream.mock.calls[0]!;
    expect(url).toBe(API_BASE + '/api/user/me');
    expect(Object.fromEntries(new Headers(init!.headers))).toEqual({ accept: 'application/json', authorization: 'Bearer app-jwt', 'x-team-web-key': secret });
    expect(init!.redirect).toBe('manual');
  });
  it('does not forward basic authorization upstream', async () => {
    const { env, request, upstream } = setup();
    await handlePagesRequest(request('/api/hot-places'), env, upstream);
    expect(new Headers(upstream.mock.calls[0]![1]!.headers).has('Authorization')).toBe(false);
  });
  it('requires a team cookie even if the caller has an app JWT', async () => {
    const { env, upstream } = setup();
    expect((await handlePagesRequest(new Request(origin + '/api/user/me', { headers: { Authorization: 'Bearer app-jwt' } }), env, upstream)).status).toBe(401);
  });
  it.each([undefined, 'https://attacker.example'])('rejects an unsafe request with origin %s', async source => {
    const { env, request, upstream } = setup();
    expect((await handlePagesRequest(request('/auth/login', { method: 'POST', headers: source ? { Origin: source } : {} }), env, upstream)).status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('passes JSON with a valid same-origin request', async () => {
    const { env, request, upstream } = setup(); const body = '{"test":true}';
    expect((await handlePagesRequest(request('/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body }), env, upstream)).status).toBe(200);
    expect(new TextDecoder().decode(upstream.mock.calls[0]![1]!.body as ArrayBuffer)).toBe(body);
  });
  it('allows a shared link navigation but denies cross-site API requests', async () => {
    const { env, request, upstream } = setup();
    expect((await handlePagesRequest(request('/', { headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } }), env, upstream)).status).toBe(200);
    expect((await handlePagesRequest(request('/api/hot-places', { headers: { 'Sec-Fetch-Site': 'cross-site' } }), env, upstream)).status).toBe(403);
  });
  it.each(['/.env', '/assets/app.js.map', '/_worker.js', '/_routes.json', '/package.json', '/%2ehidden'])('blocks internal asset %s', async path => {
    const { env, request, assets, upstream } = setup();
    expect((await handlePagesRequest(request(path), env, upstream)).status).toBe(404); expect(assets).not.toHaveBeenCalled();
  });
  it.each(['/api/admin', '/auth/social/google/callback', '/api//hot-places', '/api/user/bookmarks/a%2fb', '/api/user/bookmarks/%252e', '/api/user/bookmarks/%00'])('rejects unapproved API path %s', async path => {
    const { env, request, upstream } = setup();
    expect((await handlePagesRequest(request(path, { method: 'DELETE', headers: { Origin: origin } }), env, upstream)).status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('keeps a query parameter inside the fixed upstream origin', async () => {
    const { env, request, upstream } = setup();
    await handlePagesRequest(request('/api/places/search?url=https://attacker.example'), env, upstream);
    expect(upstream.mock.calls[0]![0]).toBe(API_BASE + '/api/places/search?url=https://attacker.example');
  });
  it.each(['text/plain', 'application/x-www-form-urlencoded'])('rejects %s request bodies', async type => {
    const { env, request, upstream } = setup();
    expect((await handlePagesRequest(request('/api/analyze', { method: 'POST', headers: { Origin: origin, 'Content-Type': type }, body: '{}' }), env, upstream)).status).toBe(415);
  });
  it('rejects compressed and oversized bodies, including undeclared lengths', async () => {
    const { env, request, upstream } = setup();
    const base = { method: 'POST', body: '{}', headers: { Origin: origin, 'Content-Type': 'application/json' } };
    expect((await handlePagesRequest(request('/api/analyze', { ...base, headers: { ...base.headers, 'Content-Encoding': 'gzip' } }), env, upstream)).status).toBe(415);
    expect((await handlePagesRequest(request('/api/analyze', { ...base, headers: { ...base.headers, 'Content-Length': '131073' } }), env, upstream)).status).toBe(413);
    expect((await handlePagesRequest(request('/api/analyze', { ...base, body: 'x'.repeat(131073) }), env, upstream)).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects redirects and masks internal connection errors', async () => {
    const { env, request, upstream } = setup();
    upstream.mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'https://attacker.example' } }));
    expect((await handlePagesRequest(request('/api/hot-places'), env, upstream)).status).toBe(502);
    upstream.mockRejectedValueOnce(new Error(secret));
    const res = await handlePagesRequest(request('/api/hot-places'), env, upstream);
    expect(res.status).toBe(502); expect(await res.text()).not.toContain(secret);
  });
  it.each([401, 403, 429, 503])('preserves upstream status %s without cookies or CORS', async status => {
    const { env, request, upstream } = setup();
    upstream.mockResolvedValueOnce(new Response('{}', { status, headers: { 'Set-Cookie': 'upstream=secret', 'Access-Control-Allow-Origin': '*', 'Retry-After': '60' } }));
    const res = await handlePagesRequest(request('/api/hot-places'), env, upstream);
    expect(res.status).toBe(status); expect(res.headers.get('retry-after')).toBe('60');
    expect(res.headers.get('set-cookie')).not.toContain('upstream'); expect(res.headers.has('access-control-allow-origin')).toBe(false);
  });
  it.each([
    ['/maps/embed', 'text/plain', 'text/html; charset=utf-8'],
    ['/legal/privacy', 'text/plain', 'text/plain'],
    ['/legal/config', 'application/json', 'application/json'],
    ['/api/media/tour-image', 'image/jpeg', 'image/jpeg'],
  ])('preserves correct content types for %s', async (path, type, expected) => {
    const { env, request, upstream } = setup();
    upstream.mockResolvedValueOnce(new Response('body', { headers: { 'Content-Type': type } }));
    const res = await handlePagesRequest(request(path), env, upstream);
    expect(res.headers.get('content-type')).toBe(expected);
    if (path === '/maps/embed') {
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('content-security-policy')).toContain('https://*.kakao.com');
    }
  });
  it('uses fetch rather than the Cloudflare execution context at the default entry', async () => {
    const { env, request, upstream } = setup(); vi.stubGlobal('fetch', upstream);
    const entry = worker.fetch as (req: Request, env: PagesEnv, context: unknown) => Promise<Response>;
    expect((await entry(request('/api/hot-places'), env, { waitUntil: vi.fn() })).status).toBe(200);
    expect(upstream).toHaveBeenCalledOnce();
  });
});

describe('Supabase team gateway credential scope', () => {
  function gate() {
    vi.stubEnv('API_RUNTIME', 'supabase-edge'); vi.stubEnv('EDGE_VALIDATION_MODE', 'true');
    vi.stubEnv('EDGE_TEAM_WEB_VALIDATION_HASH', createHash('sha256').update(secret).digest('hex'));
    vi.stubEnv('EDGE_TEAM_WEB_VALIDATION_EXPIRES_AT', new Date(Date.now() + 60000).toISOString());
  }
  it('permits only known routes with the dedicated unexpired credential', () => {
    gate();
    expect(validTeamWebValidation('GET', '/maps/embed', secret)).toBe(true);
    expect(validTeamWebValidation('POST', '/auth/login', secret)).toBe(true);
    expect(validTeamWebValidation('GET', '/api/admin', secret)).toBe(false);
    expect(validTeamWebValidation('POST', '/auth/login', 'd'.repeat(64))).toBe(false);
    expect(validTeamWebValidation('POST', '/auth/login', secret, Date.now() + 60001)).toBe(false);
    expect(validDeviceValidation('GET', '/maps/embed', secret)).toBe(false);
  });
  it('admits the dedicated header but leaves account authorization to the downstream handler', () => {
    gate(); const next = vi.fn();
    const req = { method: 'GET', path: '/api/user/me', get: (name: string) => name === 'X-Team-Web-Key' ? secret : undefined };
    edgeValidation(req as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });
  it.each(['/api/user/bookmarks/%2e%2e', '/api/user/bookmarks/a%2fb', '/api/user/bookmarks/%25', '/api/user/bookmarks/a\\b', '/api/user/bookmarks/%ZZ'])('rejects ambiguous dynamic path %s', path => {
    expect(isTeamWebRoute('DELETE', path)).toBe(false);
  });
  it('allows valid owner-scoped dynamic IDs but not arbitrary suffixes', () => {
    expect(isTeamWebRoute('DELETE', '/api/user/bookmarks/course-123')).toBe(true);
    expect(isTeamWebRoute('GET', '/api/user/bookmarks/course-123/is-bookmarked')).toBe(true);
    expect(isTeamWebRoute('GET', '/api/user/bookmarks/course-123/admin')).toBe(false);
  });
});
