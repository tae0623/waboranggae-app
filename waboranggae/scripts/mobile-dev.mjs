import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { config, parse } from 'dotenv';
config({ quiet: true });
const team = parse(await readFile('.env.team.local'));
const state = JSON.parse(await readFile('.runtime/team-processes.json', 'utf8'));
if (!state.url?.startsWith('https://') || !team.TEAM_ACCESS_KEY) throw new Error('먼저 pnpm team:start로 팀 개발 서버를 실행해 주세요.');
console.log('새 웹 디자인 Android/iOS 개발 앱을 시작합니다. Expo Go와 PC는 같은 Wi-Fi를 사용하세요.');
const child = spawn(process.execPath, ['node_modules/expo/bin/cli', 'start', '--lan', ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env,
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_API_BASE_URL: state.url, EXPO_PUBLIC_DEV_ACCESS_KEY: team.TEAM_ACCESS_KEY,
  },
});
child.on('exit', code => { process.exitCode = code || 0; });
