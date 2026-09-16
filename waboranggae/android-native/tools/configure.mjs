import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
const pilot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.dirname(pilot);
const workspace = path.resolve(project, '../../..');
const target = path.join(pilot, 'local.properties');
const previous = await readFile(target, 'utf8').catch(() => '');
const props = Object.fromEntries(previous.split(/\r?\n/).filter(l => /^[A-Z_]+|^sdk\.dir/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0,i),l.slice(i+1)]; }));
const team = parse(await readFile(path.join(project, '.env.team.local')));
const state = JSON.parse(await readFile(path.join(project, '.runtime/team-processes.json'), 'utf8'));
const env = parse(await readFile(path.join(project, '.env')));
const cloud=process.argv.includes('--cloud-device')?parse(await readFile(path.join(project,'.env.device-validation.local'))):null;
if(cloud){
  const expiresAt=Date.parse(cloud.EXPIRES_AT);
  if(cloud.API_BASE_URL!=='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api'||!Number.isFinite(expiresAt)||expiresAt<=Date.now()||!/^[a-f0-9]{64}$/.test(cloud.DEVICE_VALIDATION_TOKEN))throw new Error('Invalid or expired device validation settings');
}else if (!state.url?.startsWith('https://') || !team.TEAM_ACCESS_KEY) throw new Error('Run team:start first.');
const settings = {
  'sdk.dir': path.join(workspace, '.tools/android-sdk').replaceAll('\\','/').replace(':', '\\:'),
  API_BASE_URL: cloud?.API_BASE_URL || state.url.replace(/\/$/, ''),
  DEV_ACCESS_KEY: cloud?.DEVICE_VALIDATION_TOKEN || team.TEAM_ACCESS_KEY,
  KAKAO_NATIVE_APP_KEY: env.KAKAO_NATIVE_APP_KEY || props.KAKAO_NATIVE_APP_KEY || '',
};
await writeFile(target, '# Local-only debug configuration. Do not commit or share.\n' + Object.entries(settings).map(([k,v]) => `${k}=${v}`).join('\n') + '\n');
console.log(JSON.stringify({ config: target, api: settings.API_BASE_URL, kakaoNativeKeyPresent: !!settings.KAKAO_NATIVE_APP_KEY, secretsPrinted: false }));
