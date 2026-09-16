import { isIP } from 'node:net';
import { EDGE_PUBLIC_PATH } from './edge-path';

export function permanentApiBase(value: string | undefined, runtime?: string) {
  if (permanentHttps(value)) return true;
  if (runtime !== 'supabase-edge') return false;
  try {
    const url = new URL(value || '');
    return permanentHttps(url.origin) && !url.username && !url.password && !url.search && !url.hash
      && /^[a-z0-9]+\.supabase\.co$/.test(url.hostname)
      && url.pathname.replace(/\/$/,'') === EDGE_PUBLIC_PATH;
  } catch { return false; }
}

export function permanentHttps(value: string | undefined) {
  try {
    const u = new URL(value || '');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash
      && u.pathname === '/' && !isIP(host) && !u.port
      && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host)
      && !/(^|\.)(localhost|local|internal|test|invalid|trycloudflare\.com|ngrok-free\.app|ngrok-free\.dev|example\.(com|org|net))$/.test(host);
  } catch { return false; }
}
export function productionProblems(env: Record<string, string | undefined>) {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  if (!permanentApiBase(env.PUBLIC_APP_URL, env.API_RUNTIME)) problems.push('PUBLIC_APP_URL: stable public HTTPS API base required');
  if (env.TEAM_DEV_MODE === 'true' || env.TEAM_ACCESS_KEY || env.DEV_ACCESS_KEY || env.EXPO_PUBLIC_DEV_ACCESS_KEY) problems.push('Development access must not be enabled in production');
  if (env.ALLOW_DEMO_COURSE_FALLBACK !== 'false') problems.push('ALLOW_DEMO_COURSE_FALLBACK must be false');
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is required');
  if ((env.OAUTH_FLOW_ENCRYPTION_KEY || env.JWT_SECRET || '').length < 32) problems.push('OAuth storage encryption requires a strong secret');
  if ((env.TRUST_PROXY || '').split(',').some(v => ['true','1','0.0.0.0/0','::/0'].includes(v.trim()))) problems.push('TRUST_PROXY must name trusted proxy addresses, not trust everyone');
  return problems;
}
