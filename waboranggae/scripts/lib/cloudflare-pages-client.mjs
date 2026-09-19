import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function pagesTarget() {
  const target = JSON.parse(await readFile(path.join(root, '.runtime/pages-target.json'), 'utf8'));
  if (!/^[a-f0-9]{32}$/.test(target.accountId) || target.projectName !== 'waboranggae-app'
      || target.origin !== 'https://waboranggae-app.pages.dev' || target.repository !== 'tae0623/waboranggae-app'
      || target.branch !== 'ver5' || target.supabaseProject !== 'drtxexwznmpmiclvrjji') throw Error('PAGES_TARGET_MISMATCH');
  return target;
}
export async function cloudflareClient({ allowWrite = false } = {}) {
  const local = path.join(root, '.tools/cloudflare');
  if (existsSync(path.join(homedir(), '.wrangler'))) throw Error('LEGACY_WRANGLER_CONFIG_REQUIRES_SEPARATE_REVIEW');
  const env = { ...process.env, XDG_CONFIG_HOME: path.join(local, 'config'), WRANGLER_SEND_METRICS: 'false',
    WRANGLER_WRITE_LOGS: 'false', CLOUDFLARE_AUTH_USE_KEYRING: 'true' };
  for (const name of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CLOUDFLARE_ACCOUNT_ID','CF_API_TOKEN','CF_API_KEY','CF_EMAIL','CF_ACCOUNT_ID']) delete env[name];
  // Capture official CLI output in memory. Never log the token or subprocess output.
  const result = spawnSync(process.execPath, [path.join(local, 'node_modules/wrangler/bin/wrangler.js'),
    'auth', 'token', '--json', '--profile', 'ddubugi-pages'], { cwd: local, env, encoding: 'utf8', windowsHide: true, timeout: 45000 });
  if (result.status !== 0) throw Error('CLOUDFLARE_LOGIN_REQUIRED');
  let credentials;
  try { credentials = JSON.parse(result.stdout); } catch { throw Error('CLOUDFLARE_AUTH_OUTPUT_INVALID'); }
  if (credentials.type !== 'oauth' || typeof credentials.token !== 'string' || credentials.token.length < 20) throw Error('CLOUDFLARE_OAUTH_REQUIRED');
  const target = await pagesTarget();
  const base = `https://api.cloudflare.com/client/v4/accounts/${target.accountId}`;
  const projectPath = `/pages/projects/${target.projectName}`;
  async function request(method, suffix, body) {
    const deploymentPath = new RegExp('^' + projectPath + '/deployments/[a-f0-9-]{36}$');
    const retryPath = new RegExp('^' + projectPath + '/deployments/[a-f0-9-]{36}/retry$');
    const readAllowed = method === 'GET' && ([projectPath, '/subscriptions'].includes(suffix) || deploymentPath.test(suffix));
    const writeAllowed = allowWrite && ((method === 'PATCH' && suffix === projectPath) || (method === 'POST' && retryPath.test(suffix)));
    if (!readAllowed && !writeAllowed) throw Error('CLOUDFLARE_PATH_NOT_ALLOWED');
    const response = await fetch(base + suffix, { method, headers: { Authorization: 'Bearer ' + credentials.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(45000) });
    let payload;
    try { payload = await response.json(); } catch { throw Error('CLOUDFLARE_RESPONSE_INVALID'); }
    if (!response.ok || !payload.success) throw Error('CLOUDFLARE_REQUEST_FAILED_' + response.status);
    return payload.result;
  }
  return { target, get: suffix => request('GET', suffix), patch: body => request('PATCH', projectPath, body),
    retry: id => request('POST', `${projectPath}/deployments/${id}/retry`) };
}
