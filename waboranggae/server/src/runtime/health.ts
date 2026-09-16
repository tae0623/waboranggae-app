import type { RequestHandler } from 'express';
import { prisma } from '../db/client';

let shuttingDown = false;
let pending: Promise<boolean> | undefined;
let cached: { expires: number; ok: boolean } | undefined;
export function beginShutdown() { shuttingDown = true; }
export async function databaseReady(timeoutMs = 2000): Promise<boolean> {
  if (shuttingDown) return false;
  if (cached && cached.expires > Date.now()) return cached.ok;
  if (!pending) {
    pending = prisma.$queryRaw<{ flows: string | null; quotas: string | null; users: string | null }[]>`
      SELECT to_regclass('public.oauth_flows')::text AS flows,
             to_regclass('public.api_quota_buckets')::text AS quotas,
             to_regclass('public.users')::text AS users`
      .then(rows => Boolean(rows[0]?.flows && rows[0]?.quotas && rows[0]?.users))
      .catch(() => false)
      .then(ok => { cached = { ok, expires: Date.now() + 2000 }; return ok; })
      .finally(() => { pending = undefined; });
  }
  let timer: ReturnType<typeof setTimeout>;
  const expired = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); });
  try { return await Promise.race([pending, expired]); } finally { clearTimeout(timer!); }
}
export const readiness: RequestHandler = async (_req, res) => {
  const ok = await databaseReady();
  res.setHeader('Cache-Control', 'no-store');
  res.status(ok ? 200 : 503).json({ ok, status: ok ? 'ready' : 'temporarily_unavailable' });
};
