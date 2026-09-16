import { prisma } from '../db/client';

export function koreaDay(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}
/** Reserve BEFORE upstream I/O; failures count too. No automatic paid overage. */
export async function reserveDailyQuota(scope: string, limit: number) {
  if (!/^[a-z0-9:_-]{1,100}$/i.test(scope) || !Number.isSafeInteger(limit) || limit < 1) return false;
  const key = scope + ':' + koreaDay();
  try {
    const result = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO api_quota_buckets (key, count, expires_at) VALUES (${key}, 1, now() + interval '3 days')
      ON CONFLICT (key) DO UPDATE SET count = api_quota_buckets.count + 1
      WHERE api_quota_buckets.count < ${limit} RETURNING count`;
    return result.length === 1;
  } catch { console.warn('[quota] Shared usage store unavailable; external request blocked.'); return false; }
}
