// Three signup attempts maximum. No mail, tourism API, new account, or quota reset.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';
import pg from 'pg';
import { loadSupabaseSettings } from './check-supabase.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
const checks = [];
let access;
let review;
let db;
async function request(route, body, authenticated = false) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: 'Bearer ' + access } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (review?.PASSWORD) assert.ok(!text.includes(review.PASSWORD), 'CREDENTIAL_ECHO');
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  checks.push({ route, status: response.status, ...(typeof data.code === 'string' && /^[A-Z_]+$/.test(data.code) ? { code: data.code } : {}) });
  return { status: response.status, data };
}
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--verify-public') throw Error('EXPLICIT_VERIFY_FLAG_REQUIRED');
  const config = parse(await readFile(path.join(root, '.env.edge.local')));
  assert.equal(config.PUBLIC_APP_URL, base);
  assert.equal(config.EDGE_VALIDATION_MODE, 'false');
  const settings = await loadSupabaseSettings();
  assert.ok(decodeURIComponent(new URL(settings.connectionString).username).endsWith('.drtxexwznmpmiclvrjji'));
  assert.ok(settings.ssl.ca);
  review = parse(await readFile(path.join(root, '.env.review-account.local')));
  assert.equal(review.LOGIN_ALIAS, 'test'); assert.ok(review.PASSWORD?.length >= 12);
  assert.equal((await request('/readyz')).data.ok, true);
  assert.deepEqual((await request('/auth/signup-config')).data, { required: true, available: true });
  const legal = await request('/legal/config');
  assert.equal(legal.status, 200); assert.equal(typeof legal.data.version, 'string');
  assert.equal((await request('/api/user/me')).status, 401);

  const marker = 'ddubugi-check-' + randomUUID();
  const emails = [marker + '@mailinator.com', marker + '@Sub.MAILINATOR.COM', marker + '@gmail.com'];
  db = new pg.Client({ connectionString: settings.connectionString, ssl: settings.ssl, connectionTimeoutMillis: 10000, query_timeout: 10000 });
  await db.connect(); await db.query('BEGIN READ ONLY');
  async function countProbeAccounts() {
    const result = await db.query('SELECT count(*)::int AS n FROM users WHERE lower(email) = ANY($1::text[])', [emails.map(email => email.toLowerCase())]);
    return result.rows[0].n;
  }
  assert.equal(await countProbeAccounts(), 0);
  // Passes schema length but fails password policy even if bot protection regresses.
  const signup = email => ({ email, displayName: '가입차단검증', password: 'onlylowercase',
    privacyConsent: true, ageConfirmed: true, consentVersion: legal.data.version });
  for (const email of emails.slice(0, 2)) {
    const result = await request('/auth/signup', signup(email));
    assert.equal(result.status, 400); assert.equal(result.data.code, 'DISPOSABLE_EMAIL_DOMAIN');
    assert.match(result.data.error, /일회용 이메일/);
  }
  const normal = await request('/auth/signup', signup(emails[2]));
  assert.equal(normal.status, 400); assert.equal(normal.data.code, 'SIGNUP_BOT_CHECK');
  assert.equal(await countProbeAccounts(), 0);
  await db.query('ROLLBACK'); await db.end(); db = undefined;

  const login = await request('/auth/login', { email: review.LOGIN_ALIAS, password: review.PASSWORD });
  assert.equal(login.status, 200); assert.equal(login.data.user.loginAlias, 'test');
  assert.equal(login.data.user.password, undefined);
  access = login.data.accessToken; assert.equal(typeof access, 'string');
  assert.equal((await request('/api/user/me', undefined, true)).status, 200);
  assert.equal((await request('/auth/logout/current', {}, true)).status, 200);
  assert.equal((await request('/api/user/me', undefined, true)).status, 401); access = undefined;
  const team = await fetch('https://waboranggae-app.pages.dev/', { redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert.equal(team.status, 401);
  const report = { checkedAt: new Date().toISOString(), passed: true, checks, publicApi: true,
    disposableRejected: true, mixedCaseSubdomainRejected: true, normalDomainReachesBotCheck: true,
    signupAttempts: 3, probeAccountsCreated: 0, testAliasLogin: true, logoutRevoked: true,
    teamWebPrivate: true, kakaoCalls: 0, mailSent: false, quotasReset: false };
  await mkdir(path.join(root, '.runtime'), { recursive: true });
  await writeFile(path.join(root, '.runtime/disposable-email-live-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
main().catch(error => {
  console.error(JSON.stringify({ passed: false, checks, reason: /^[A-Z_]{3,80}$/.test(error?.message || '') ? error.message : 'LIVE_VERIFICATION_FAILED' }));
  process.exitCode = 1;
}).finally(async () => {
  if (access) await request('/auth/logout/current', {}, true).catch(() => {});
  if (db) await db.end().catch(() => {});
});
