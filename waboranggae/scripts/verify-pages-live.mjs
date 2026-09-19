// Approved live verification: fixed Pages origin only, no key/password output.
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { parse } from 'dotenv';
import { root, pagesTarget } from './lib/cloudflare-pages-client.mjs';

async function main() {
  if (process.argv.slice(2).join(' ') !== '--verify-approved-access') throw Error('EXPLICIT_VERIFICATION_FLAG_REQUIRED');
  const target = await pagesTarget(), values = parse(await readFile(path.join(root, '.env.pages.local')));
  if (values.TEAM_WEB_ORIGIN !== target.origin || !/^[a-f0-9]{48}$/.test(values.TEAM_WEB_PASSWORD)) throw Error('PAGES_TARGET_MISMATCH');
  const secrets = [values.TEAM_WEB_PASSWORD, values.TEAM_WEB_SESSION_SECRET, values.TEAM_WEB_API_KEY];
  const report = { checkedAt: new Date().toISOString(), origin: target.origin, passed: false, checks: [],
    notTested: ['real_user_social_login', 'browser_map_rendering', 'recommendation_kakao_daily_quota_exhausted', 'cloudflare_free_plan'] };
  let cookie, token;
  function check(name, condition) {
    report.checks.push({ name, passed: Boolean(condition) });
    if (!condition) throw Error(name.toUpperCase());
  }
  async function send(route, { method = 'GET', headers = {}, body, anonymous = false, basic = false } = {}) {
    if (!route.startsWith('/') || route.startsWith('//')) throw Error('ROUTE_NOT_ALLOWED');
    const started = Date.now();
    const response = await fetch(target.origin + route, { method, redirect: 'error', signal: AbortSignal.timeout(55000),
      headers: { ...(cookie && !anonymous ? { Cookie: cookie } : {}),
        ...(basic ? { Authorization: 'Basic ' + Buffer.from('team:' + values.TEAM_WEB_PASSWORD).toString('base64') } : {}),
        'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get('content-type') || '';
    const text = /json|text|javascript/.test(type) ? new TextDecoder().decode(bytes) : '';
    let json;
    if (type.includes('application/json')) { try { json = JSON.parse(text); } catch { throw Error('INVALID_JSON_RESPONSE'); } }
    report.checks.push({ route: route.split('?')[0], method, status: response.status, ms: Date.now() - started, bytes: bytes.length });
    if (secrets.some(secret => text.includes(secret))) throw Error('SECRET_EXPOSED_IN_RESPONSE');
    return { status: response.status, headers: response.headers, text, json, bytes: bytes.length };
  }
  try {
    check('unauthenticated_home_denied', (await send('/', { anonymous: true })).status === 401);
    check('wrong_password_denied', (await send('/', { anonymous: true, headers: { Authorization: 'Basic ' + Buffer.from('team:invalid-test-password').toString('base64') } })).status === 401);
    const home = await send('/', { basic: true });
    check('authenticated_home_html', home.status === 200 && home.headers.get('content-type')?.includes('text/html') && home.text.includes('id="root"'));
    const setCookie = home.headers.get('set-cookie') || '';
    check('secure_session_cookie', ['__Host-ddubugi_team=', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=43200'].every(flag => setCookie.includes(flag)));
    cookie = setCookie.split(';')[0];
    check('private_no_store', home.headers.get('cache-control') === 'private, no-store');
    check('cookie_authentication', (await send('/')).status === 200);
    check('tampered_cookie_denied', (await send('/', { anonymous: true, headers: { Cookie: cookie + 'x' } })).status === 401);
    const assets = [...home.text.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1]);
    check('bundled_assets_found', assets.length >= 2);
    for (const asset of new Set(assets)) {
      check('anonymous_asset_denied', (await send(asset, { anonymous: true })).status === 401);
      check('authenticated_asset_available', (await send(asset)).status === 200);
    }
    check('hidden_env_denied', (await send('/.env')).status === 404);
    check('worker_source_denied', (await send('/_worker.js')).status === 404);
    check('unknown_api_denied', (await send('/api/admin')).status === 404);
    check('missing_origin_denied', (await send('/auth/login', { method: 'POST', body: {} })).status === 403);
    check('wrong_origin_denied', (await send('/auth/login', { method: 'POST', body: {}, headers: { Origin: 'https://example.invalid' } })).status === 403);
    check('anonymous_api_denied', (await send('/api/regions/jeonnam-cities', { anonymous: true })).status === 401);
    check('server_live', (await send('/livez')).status === 200);
    check('server_database_ready', (await send('/readyz')).status === 200);
    check('cities_api_connected', (await send('/api/regions/jeonnam-cities')).status === 200);
    const providers = await send('/auth/social/providers');
    check('social_provider_metadata', providers.status === 200 && Array.isArray(providers.json?.providers));
    report.socialProviders = providers.json.providers.map(({ id, enabled }) => ({ id, enabled }));
    check('account_requires_separate_login', (await send('/api/user/me')).status === 401);
    const legal = await send('/legal/config');
    check('legal_config_json', legal.status === 200 && typeof legal.json?.version === 'string');
    const map = await send('/maps/embed');
    check('map_html_proxy', map.status === 200 && map.headers.get('content-type')?.includes('text/html') && map.text.includes('kakao'));
    check('map_origin_referrer_policy', map.headers.get('referrer-policy') === 'strict-origin-when-cross-origin');
    const photo = await send('/api/login-photo');
    check('login_photo_api', photo.status === 200);
    if (photo.json?.img) {
      const imagePath = photo.json.img.startsWith('/api/media/tour-image?')
        ? photo.json.img : '/api/media/tour-image?url=' + encodeURIComponent(photo.json.img);
      const image = await send(imagePath);
      check('tour_image_proxy', image.status === 200 && image.headers.get('content-type')?.startsWith('image/') && image.bytes > 100);
    }
    // Synthetic data only. Never log the generated account, password, JWT or cookie.
    const email = 'pages-test-' + randomBytes(12).toString('hex') + '@example.invalid';
    const password = randomBytes(24).toString('hex') + '!A1';
    const headers = { Origin: target.origin };
    const created = await send('/auth/signup', { method: 'POST', headers, body: {
      email, password, displayName: '팀 웹 연결 검증', privacyConsent: true, consentVersion: legal.json.version,
    } });
    token = created.json?.accessToken;
    check('synthetic_signup', created.status === 201 && typeof token === 'string');
    const login = await send('/auth/login', { method: 'POST', headers, body: { email, password } });
    check('synthetic_login', login.status === 200 && typeof login.json?.accessToken === 'string');
    const me = await send('/api/user/me', { headers: { Authorization: 'Bearer ' + token } });
    check('authenticated_account_api', me.status === 200 && me.json?.password === undefined && me.json?.passwordHash === undefined);
    check('synthetic_account_deleted', (await send('/api/user/me', { method: 'DELETE', headers: { ...headers, Authorization: 'Bearer ' + token } })).status === 200);
    check('deleted_account_token_revoked', (await send('/api/user/me', { headers: { Authorization: 'Bearer ' + token } })).status === 401);
    token = undefined;
    report.passed = true;
  } catch (error) {
    report.failure = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'LIVE_VERIFICATION_FAILED';
    process.exitCode = 1;
  } finally {
    if (token) {
      try { report.cleanup = (await send('/api/user/me', { method: 'DELETE', headers: { Origin: target.origin, Authorization: 'Bearer ' + token } })).status === 200; }
      catch { report.cleanup = false; }
    }
    await writeFile(path.join(root, '.runtime/pages-live-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}
main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PAGES_VERIFICATION_FAILED'); process.exitCode = 1; });
