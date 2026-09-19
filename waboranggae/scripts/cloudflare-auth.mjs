// Interactive account approval is performed by the user in their browser.
// This helper does not upload app secrets, deploy code or change project settings.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, '.tools/cloudflare');
const cli = path.join(local, 'node_modules/wrangler/bin/wrangler.js');
const action = process.argv[2] || 'status';
if (!['login', 'status', 'help'].includes(action) || process.argv.length > 3) throw Error('Use: node scripts/cloudflare-auth.mjs login|status|help');
if (!existsSync(cli)) throw Error('LOCAL_CLOUDFLARE_TOOL_NOT_INSTALLED');
// Wrangler prioritizes a legacy home directory over XDG_CONFIG_HOME.
// Refuse to accidentally modify another installation's credentials.
if (existsSync(path.join(homedir(), '.wrangler'))) throw Error('LEGACY_WRANGLER_CONFIG_REQUIRES_SEPARATE_REVIEW');
const env = { ...process.env, XDG_CONFIG_HOME: path.join(local, 'config'),
  WRANGLER_LOG_PATH: path.join(local, 'logs'), WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false',
  CLOUDFLARE_AUTH_USE_KEYRING: 'true', npm_config_cache: path.join(local, 'npm-cache') };
// Always use the explicit profile, never an ambient API token or other account.
for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_EMAIL', 'CLOUDFLARE_ACCOUNT_ID', 'CF_API_TOKEN', 'CF_API_KEY', 'CF_EMAIL', 'CF_ACCOUNT_ID']) delete env[name];
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: local, env, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) { console.error('CLOUDFLARE_AUTH_TOOL_FAILED'); return 1; }
  return result.status ?? 1;
}
if (action === 'login') {
  // login/whoami do not accept --profile in this pinned Wrangler version.
  const result = run(['auth', 'create', 'ddubugi-pages', '--scopes', 'account:read', 'user:read', 'pages:write']);
  process.exitCode = result === 0 ? run(['auth', 'activate', 'ddubugi-pages']) : result;
} else {
  process.exitCode = run(action === 'help' ? ['auth', 'create', '--help'] : ['whoami', '--json']);
}
