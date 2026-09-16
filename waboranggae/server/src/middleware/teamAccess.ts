import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';

function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function validTeamAccess(header: string | undefined, basic: string | undefined, secret: string) {
  if (header && equal(header, secret)) return true;
  if (!basic?.startsWith('Basic ')) return false;
  const value = Buffer.from(basic.slice(6), 'base64').toString('utf8');
  return equal(value, `team:${secret}`);
}

export const teamAccess: RequestHandler = (request, response, next) => {
  if (process.env.TEAM_DEV_MODE !== 'true') { next(); return; }
  const secret = process.env.TEAM_ACCESS_KEY || '';
  if (secret.length < 24) { response.status(503).json({ error: '팀 개발 서버 접속 암호가 설정되지 않았습니다.' }); return; }
  if (request.path === '/dev/health' || request.path === '/maps/embed'
    || /^\/auth\/social\/(kakao|google)\/callback$/.test(request.path)
    || request.path === '/api/media/tour-image' || request.method === 'OPTIONS') { next(); return; }
  const cookieValue = createHash('sha256').update('team-cookie:' + secret).digest('hex');
  const cookie = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('waboranggae_team='))?.slice('waboranggae_team='.length);
  if (cookie && equal(cookie, cookieValue)) { next(); return; }
  if (validTeamAccess(request.get('X-Dev-Access-Key'), request.get('Authorization'), secret)) {
    response.cookie('waboranggae_team', cookieValue, {
      httpOnly: true, secure: request.secure, sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000, path: '/',
    });
    next(); return;
  }
  response.setHeader('WWW-Authenticate', 'Basic realm="Waboranggae team development", charset="UTF-8"');
  response.setHeader('Cache-Control', 'no-store');
  response.status(401).json({ error: '팀 개발 서버 접속 암호가 필요합니다. 사용자 이름: team' });
};
