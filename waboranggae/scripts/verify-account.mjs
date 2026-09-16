import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
const base = 'http://127.0.0.1:8788';
const settings = parse(await readFile('.env.team.local'));
const headers = { 'Content-Type': 'application/json', 'X-Dev-Access-Key': settings.TEAM_ACCESS_KEY };
const marker = randomBytes(12).toString('hex');
async function send(path, method = 'GET', body, token) {
  const res = await fetch(base + path, { method, headers: { ...headers, ...(token ? {Authorization: 'Bearer ' + token} : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  return { status: res.status, body: await res.json() };
}
const signup = { email: 'ver4-test-' + marker + '@example.invalid', displayName: '개발 검증 계정', password: randomBytes(24).toString('hex') + '!A1' };
const legal=(await send('/legal/config')).body;
assert.equal(legal.operator,'뚜버기 Team (administrator: Taeyoung Ko)');
assert.equal((await send('/auth/signup','POST',signup)).status,400,'Consent is required');
const created = await send('/auth/signup', 'POST', {...signup, privacyConsent:true, consentVersion:legal.version});
assert.equal(created.status, 201, 'Test account signup');
const token = created.body.accessToken;
try {
  assert.equal((await send('/api/user/bookmarks/add', 'POST', { courseId: 'test-' + marker, courseName: '검증용 순천 코스', city: '순천' }, token)).status, 201);
  const me = await send('/api/user/me', 'GET', undefined, token);
  assert.equal(me.status, 200);
  assert.equal(me.body.password, undefined, 'Do not expose password hash');
  assert.equal(me.body.consentVersion,legal.version);
  assert.ok(me.body.consentedAt,'Consent date must be recorded');
  const repeated=await send('/auth/login','POST',{email:signup.email,password:signup.password});
  assert.equal(repeated.status,200,'Previously consented login needs no checkbox');
  assert.equal(repeated.body.user.consentedAt,me.body.consentedAt,'Login must preserve actual first consent time');
  const consentAgain=await send('/auth/consent','POST',{privacyConsent:true,consentVersion:legal.version},token);
  assert.equal(consentAgain.body.consentedAt,me.body.consentedAt,'Same-version consent is idempotent');
  const bookmarks = await send('/api/user/bookmarks', 'GET', undefined, token);
  assert.ok(bookmarks.body.some(item => item.courseId === 'test-' + marker));
} finally {
  // Delete ONLY the temporary synthetic account just created by this test.
  assert.equal((await send('/api/user/me', 'DELETE', undefined, token)).status, 200);
}
assert.equal((await send('/api/user/me', 'GET', undefined, token)).status, 401, 'Deleted account must invalidate access');
console.log('PASS: synthetic signup, bookmark, profile privacy, account deletion, old-token rejection. Existing users untouched.');
