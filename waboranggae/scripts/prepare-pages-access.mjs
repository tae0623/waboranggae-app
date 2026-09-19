// Local secret preparation only, after approval of the named 30-day team gateway.
import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { parse } from 'dotenv';
import { pagesTarget, root } from './lib/cloudflare-pages-client.mjs';
async function main() {
  if (process.argv.slice(2).join(' ') !== '--prepare-30-day-access') throw Error('EXPLICIT_PREPARE_FLAG_REQUIRED');
  const target = await pagesTarget();
  const localFile = path.join(root, '.env.pages.local');
  if (await access(localFile).then(() => true, () => false)) throw Error('PAGES_CREDENTIALS_ALREADY_EXIST');
  const edgeFile = path.join(root, '.env.edge.local');
  const previous = await readFile(edgeFile, 'utf8'), edge = parse(previous);
  if (edge.PUBLIC_APP_URL !== `https://${target.supabaseProject}.supabase.co/functions/v1/waboranggae-api` || edge.EDGE_VALIDATION_MODE !== 'true') throw Error('SUPABASE_PRIVATE_TARGET_MISMATCH');
  if (edge.EDGE_TEAM_WEB_VALIDATION_HASH) throw Error('EXISTING_TEAM_GATE_REQUIRES_ROTATION_REVIEW');
  const expiry = new Date(Date.now() + 30 * 86400_000).toISOString();
  const values = { TEAM_WEB_ORIGIN: target.origin, TEAM_WEB_PASSWORD: randomBytes(24).toString('hex'),
    TEAM_WEB_SESSION_SECRET: randomBytes(32).toString('hex'), TEAM_WEB_API_KEY: randomBytes(32).toString('hex'), TEAM_WEB_API_EXPIRES_AT: expiry };
  const gate = { EDGE_TEAM_WEB_VALIDATION_HASH: createHash('sha256').update(values.TEAM_WEB_API_KEY).digest('hex'), EDGE_TEAM_WEB_VALIDATION_EXPIRES_AT: expiry };
  const encode = object => Object.entries(object).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n';
  await writeFile(localFile, encode(values), { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(root, '.env.pages-supabase.local'), encode(gate), { flag: 'wx', mode: 0o600 });
  await writeFile(edgeFile, previous.trimEnd() + '\n' + encode(gate), { mode: 0o600 });
  await writeFile(path.join(root, '.runtime/PAGES_TEAM_ACCESS.md'), [
    '# 뚜버기 팀 개발 웹 접속 정보', '', '아직 배포 검증 전입니다. 검증 완료 안내를 받은 후 사용하세요.',
    '', '주소: ' + target.origin, '팀 아이디: team', '팀 암호: ' + values.TEAM_WEB_PASSWORD,
    '연결 권한 만료(UTC): ' + expiry, '', '팀원에게는 이 접속 정보만 안전한 채널로 공유하세요.',
    '이 문서/암호를 GitHub에 올리지 마세요. 앱 회원 로그인은 별도입니다.',
    '서버 API 키, DB 암호, OAuth Secret은 팀원에게 공유할 필요가 없습니다.',
  ].join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ prepared: true, uploaded: false, origin: target.origin, expiresAt: expiry, secretValuesPrinted: false }));
}
main().catch(error => { console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PAGES_PREPARATION_FAILED'); process.exitCode = 1; });
