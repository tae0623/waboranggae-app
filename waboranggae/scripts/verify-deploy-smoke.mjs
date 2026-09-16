// Deployment smoke checks: no account mutations and no tourism/routing provider calls.
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';
import assert from 'node:assert/strict';
const config = parse(await readFile('.env.device-validation.local'));
const base = 'https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL, base);
assert.ok(Date.parse(config.EXPIRES_AT) > Date.now(), 'DEVICE_VALIDATION_EXPIRED');
const checks = [];
async function send(path, expected, body, admitted = true) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(admitted ? { 'X-Dev-Access-Key': config.DEVICE_VALIDATION_TOKEN } : {}) },
    body, signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  checks.push({ path, expected, status: response.status, passed: response.status === expected });
  return text;
}
try {
  await send('/livez', 200);
  await send('/readyz', 200);
  await send('/api/recommend', 403, '{}', false);
  await send('/api/user/me', 401);
  // Repeat to avoid declaring success based on a single warm worker response.
  for (let i = 0; i < 3; i++) {
    await send('/auth/refresh', 400, '{"broken":');
    await send('/auth/refresh', 413, JSON.stringify({ refreshToken: 'x'.repeat(132000) }));
  }
  const legal = await send('/legal/attributions', 200);
  checks.push({ check: 'source-notice', passed: legal.includes('출처: ⓒ한국관광공사') && !legal.includes('여행일 예보가 아닙니다') });
  const passed = checks.every(check => check.passed);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), passed, checks }, null, 2));
  if (!passed) process.exitCode = 1;
} catch {
  console.error(JSON.stringify({ passed: false, code: 'DEPLOY_SMOKE_FAILED', checks }));
  process.exitCode = 1;
}
