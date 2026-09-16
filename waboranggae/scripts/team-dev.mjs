import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, open, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, parse } from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
config({ path: '.env', quiet: true });
const runtime = path.join(root, '.runtime');
await mkdir(runtime, { recursive: true });
const stateFile = path.join(runtime, 'team-processes.json');
const secretsFile = path.join(root, '.env.team.local');
const command = process.argv[2] || 'status';
const exists = async file => access(file).then(() => true, () => false);
async function loadSettings() {
  if (!await exists(secretsFile)) {
    const dbPassword = randomBytes(24).toString('hex');
    await writeFile(secretsFile, [
      '# Generated once for this PC. Do not commit or share the DB/JWT secrets.',
      'TEAM_DB_PASSWORD=' + dbPassword,
      'TEAM_ACCESS_KEY=' + randomBytes(24).toString('hex'),
      'JWT_SECRET=' + randomBytes(32).toString('hex'),
      'JWT_REFRESH_SECRET=' + randomBytes(32).toString('hex'),
      'DATABASE_URL=postgresql://waboranggae_dev:' + dbPassword + '@127.0.0.1:55432/waboranggae_dev',
      '',
    ].join('\n'), { mode: 0o600 });
  }
  const settings = parse(await readFile(secretsFile));
  Object.assign(process.env, settings, {
    TEAM_DEV_MODE: 'true', HOST: '127.0.0.1', PORT: '8788', NODE_ENV: 'development',
    OLLAMA_COURSE_PLANNER_ENABLED: 'false',
    ALLOW_DEMO_COURSE_FALLBACK: 'false',
  });
  return settings;
}
const settings = await loadSettings();
async function dockerPath() {
  const candidates = [process.env.DOCKER_PATH,
    path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
    'C:/Program Files/Docker/Docker/resources/bin/docker.exe'];
  for (const candidate of candidates) if (candidate && await exists(candidate)) return candidate;
  return 'docker';
}
function run(file, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(path.basename(file) + ' exited ' + code)));
  });
}
async function cloudflaredPath() {
  if (process.env.CLOUDFLARED_PATH) return process.env.CLOUDFLARED_PATH;
  const file = path.join(root, '.tools', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  if (await exists(file)) return file;
  if (process.platform !== 'win32') throw new Error('Install cloudflared and set CLOUDFLARED_PATH.');
  const release = await fetch('https://api.github.com/repos/cloudflare/cloudflared/releases/latest', {
    headers: { 'User-Agent': 'waboranggae-team-dev' },
  });
  if (!release.ok) throw new Error('cloudflared release metadata HTTP ' + release.status);
  const info = await release.json();
  const asset = info.assets?.find(a => a.name === 'cloudflared-windows-amd64.exe');
  if (!asset?.digest?.startsWith('sha256:')) throw new Error('Verified cloudflared checksum unavailable.');
  const response = await fetch(asset.browser_download_url);
  if (!response.ok) throw new Error('cloudflared download HTTP ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  if ('sha256:' + createHash('sha256').update(bytes).digest('hex') !== asset.digest) throw new Error('cloudflared checksum mismatch.');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  console.log('cloudflared installed locally with verified SHA-256: ' + info.tag_name);
  return file;
}
async function setup() {
  await run(await dockerPath(), ['compose', '--env-file', '.env.team.local', '-f', 'docker-compose.team.yml', 'up', '-d', '--wait', 'db']);
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  await cloudflaredPath();
}
async function build() {
  await run(process.execPath, ['web/node_modules/vite/bin/vite.js', 'build', 'web']);
}
async function background(file, args, logName) {
  const log = await open(path.join(runtime, logName), 'w');
  const child = spawn(file, args, { cwd: root, env: process.env, detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd] });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  await log.close();
  return child.pid;
}
const live = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function state() { try { return JSON.parse(await readFile(stateFile, 'utf8')); } catch { return {}; } }
async function saveState(value) { await writeFile(stateFile, JSON.stringify(value, null, 2)); }
async function health() {
  try {
    const r = await fetch('http://127.0.0.1:8788/dev/health', { signal: AbortSignal.timeout(1500) });
    return r.ok && (await r.json()).service === 'waboranggae-team';
  } catch { return false; }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function status() {
  const s = await state();
  if (s.url) await writeFile(path.join(runtime, 'TEAM_ACCESS.md'), [
    '# 와보랑께 팀 개발 서버 접속 (팀원에게만 전달)', '',
    '웹 테스트: ' + s.url, '사용자 이름: team', '접속 암호: ' + settings.TEAM_ACCESS_KEY, '',
    '최신 작업 폴더: ' + root, '',
    '웹 실행: pnpm web', 'Android/iOS 새 디자인 실행: pnpm app:dev', '',
    '카카오 JavaScript SDK 등록 도메인: ' + s.url,
    'API 변경 시 pnpm team:restart, 웹 변경 공유 시 pnpm team:build.',
    'PC가 켜져 있어야 하며 터널 주소가 변경되면 카카오 SDK/OAuth 도메인도 갱신해야 합니다.',
    '이 파일과 .env.team.local은 GitHub에 올리지 마세요.', '',
  ].join('\n'), { mode: 0o600 });
  console.log(JSON.stringify({ apiRunning: s.apiPid ? live(s.apiPid) && await health() : false,
    tunnelRunning: s.tunnelPid ? live(s.tunnelPid) : false, localUrl: 'http://127.0.0.1:8788',
    sharedUrl: s.url || null, accessFile: path.join(runtime, 'TEAM_ACCESS.md') }, null, 2));
}
async function start() {
  let s = await state();
  if (s.apiPid && live(s.apiPid) && await health() && s.tunnelPid && live(s.tunnelPid)) { await status(); return; }
  await setup();
  if (!await exists(path.join(root, 'web/dist/index.html'))) await build();
  if (!s.apiPid || !live(s.apiPid) || !await health()) {
    if (await health()) throw new Error('Port 8788 is already owned by another team server. Stop it explicitly first.');
    s = { apiPid: await background(process.execPath, ['--import', 'tsx', path.join(root, 'server/index.ts')], 'api.log') };
    await saveState(s);
    for (let i = 0; i < 40 && !await health(); i++) await pause(500);
    if (!await health()) throw new Error('API startup failed; see .runtime/api.log');
  }
  if (s.tunnelPid && live(s.tunnelPid)) { await status(); return; }
  s.tunnelPid = await background(process.env.CLOUDFLARED_PATH || await cloudflaredPath(),
    ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:8788'], 'tunnel.log');
  await saveState(s);
  for (let i = 0; i < 90; i++) {
    const log = await readFile(path.join(runtime, 'tunnel.log'), 'utf8').catch(() => '');
    s.url = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
    if (s.url) break;
    if (!live(s.tunnelPid)) throw new Error('Tunnel exited; see .runtime/tunnel.log');
    await pause(500);
  }
  if (!s.url) throw new Error('Tunnel URL not ready; see .runtime/tunnel.log');
  await saveState(s);
  await writeFile(path.join(runtime, 'TEAM_ACCESS.md'), [
    '# 팀 개발 서버 접속 (팀원에게만 전달)', '',
    '- 웹 테스트 주소: ' + s.url,
    '- 브라우저 접속 이름: team',
    '- 브라우저 접속 암호: ' + settings.TEAM_ACCESS_KEY,
    '', '팀원이 별도 로컬 앱에서 호출할 경우 개인 .env에만 입력:', '',
    'EXPO_PUBLIC_API_BASE_URL=' + s.url,
    'EXPO_PUBLIC_DEV_ACCESS_KEY=' + settings.TEAM_ACCESS_KEY,
    '', 'Expo 기존 화면 비교: ' + s.url + '/native/',
    '', '카카오 JavaScript SDK 도메인에 등록할 주소: ' + s.url,
    '', 'PC 또는 Tunnel 종료 시 접속이 중단됩니다. 다시 시작하면 공유 주소가 바뀔 수 있습니다.',
    '카카오 도메인도 바뀐 주소로 다시 등록하세요. 이 파일과 접속 키를 GitHub에 올리지 마세요.',
    '',
  ].join('\n'), { mode: 0o600 });
  await status();
}
async function stop(onlyApi = false) {
  const s = await state();
  const remaining = { ...s };
  // Revalidate the command line: Windows can reuse a stale PID after a reboot.
  for (const name of onlyApi ? ['apiPid'] : ['tunnelPid', 'apiPid']) {
    const pid = Number(s[name]);
    if (!Number.isInteger(pid) || pid <= 0 || !live(pid)) { delete remaining[name]; continue; }
    let commandLine = '';
    try {
      if (process.platform === 'win32') {
        const result = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}').CommandLine`], { windowsHide: true });
        commandLine = result.stdout;
      } else commandLine = await readFile('/proc/' + pid + '/cmdline', 'utf8');
    } catch { /* Fail closed if ownership cannot be checked. */ }
    const normalize = value => value.replace(/\\/g, '/').toLowerCase();
    const expected = name === 'apiPid' ? path.join(root, 'server/index.ts') : process.env.CLOUDFLARED_PATH || path.join(root, '.tools/cloudflared.exe');
    if (!normalize(commandLine).includes(normalize(expected))) {
      console.warn('Refusing to stop unverified process ' + pid + '; no process was terminated.');
      continue;
    }
    process.kill(pid);
    delete remaining[name];
  }
  if (!remaining.tunnelPid) delete remaining.url;
  await saveState(remaining);
  if (!onlyApi) console.log('Verified team processes stopped. Development DB volume is preserved.');
}
async function restart() {
  await stop(true);
  const s = await state();
  if (s.apiPid) throw new Error('API process ownership could not be verified; restart was cancelled.');
  s.apiPid = await background(process.execPath, ['--import', 'tsx', path.join(root, 'server/index.ts')], 'api.log');
  await saveState(s);
  for (let i = 0; i < 40 && !await health(); i++) await pause(500);
  if (!await health()) throw new Error('API startup failed; see .runtime/api.log');
  await status();
}
try {
  if (command === 'setup') await setup();
  else if (command === 'build') await build();
  else if (command === 'start') await start();
  else if (command === 'stop') await stop();
  else if (command === 'stop-api') await stop(true);
  else if (command === 'restart') await restart();
  else if (command === 'status') await status();
  else throw new Error('Use setup, start, restart, stop, build, or status.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
