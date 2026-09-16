// Offline checks only. No credentials or build artifacts are transmitted.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'dotenv';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web/dist');
const routes = JSON.parse(await readFile(path.join(dist, '_routes.json'), 'utf8'));
assert.deepEqual(routes, { version: 1, include: ['/*'], exclude: [] });
const module = await import(pathToFileURL(path.join(dist, '_worker.js')).href);
assert.deepEqual(Object.keys(module), ['default']);
const request = new Request('https://test-team.pages.dev/');
const missing = await module.default.fetch(request, {});
assert.equal(missing.status, 503);
let assetsFetched = false;
const env = {
  ASSETS: { fetch: async () => { assetsFetched = true; return new Response('<html>test</html>'); } },
  TEAM_WEB_ORIGIN: request.url.slice(0, -1), TEAM_WEB_PASSWORD: 'b'.repeat(48),
  TEAM_WEB_SESSION_SECRET: 'c'.repeat(64), TEAM_WEB_API_KEY: 'a'.repeat(64),
  TEAM_WEB_API_EXPIRES_AT: new Date(Date.now() + 60000).toISOString(),
};
assert.equal((await module.default.fetch(request, env)).status, 401);
assert.equal(assetsFetched, false);
const admitted = await module.default.fetch(new Request(request, { headers: { Authorization: 'Basic ' + btoa('team:' + env.TEAM_WEB_PASSWORD) } }), env);
assert.equal(admitted.status, 200);
assert.match(admitted.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
const secrets = new Set();
for (const file of ['.env', '.env.edge.local', '.env.supabase.local', '.env.team.local', '.env.device-validation.local', '.env.pages.local', '.dev.vars']) {
  try {
    for (const [key, value] of Object.entries(parse(await readFile(path.join(root, file))))) {
      if (/^(?:VITE_|EXPO_PUBLIC_)|KAKAO_(?:MAP_JS|NATIVE_APP)_KEY/.test(key)) continue;
      if (/(?:SECRET|PASSWORD|TOKEN|ACCESS_KEY|API_KEY|DATA_GO_KR_KEY|VALIDATION_KEY|DATABASE_URL)/.test(key) && value.length >= 16) secrets.add(value);
      if (key === 'DATABASE_URL') { try { const password = decodeURIComponent(new URL(value).password); if (password.length >= 16) secrets.add(password); } catch {} }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw Error('LOCAL_CONFIG_READ_FAILED'); }
}
let checked = 0;
async function scan(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    assert.equal(item.isSymbolicLink(), false, 'BUILD_SYMLINK');
    const file = path.join(directory, item.name);
    if (item.isDirectory()) { await scan(file); continue; }
    assert(!item.name.startsWith('.') && !/\.map$|\.env|\.pem$|\.key$|\.jks$|\.keystore$/.test(item.name), 'PRIVATE_BUILD_FILE');
    const text = await readFile(file, 'utf8'); checked++;
    for (const value of secrets) assert(!text.includes(value), 'KNOWN_SECRET_IN_BUILD');
    if (item.name !== '_worker.js') {
      assert(!/TEAM_WEB_(?:PASSWORD|SESSION_SECRET|API_KEY)|X-Team-Web-Key|X-Waboranggae-Validation/.test(text), 'SERVER_GATE_IN_BROWSER');
      assert(!/127\.0\.0\.1:8788|trycloudflare\.com|drtxexwznmpmiclvrjji\.supabase\.co/.test(text), 'BROWSER_BYPASSES_GATEWAY');
    }
  }
}
await scan(dist);
console.log(JSON.stringify({ offline: true, compiledGatewayChecks: 'passed', filesScanned: checked, knownSecretMatches: 0, browserGatewayBypasses: 0,
  notVerified: ['Cloudflare runtime/account configuration', 'Supabase live gateway key', 'Kakao SDK domain', 'real social login'] }, null, 2));
