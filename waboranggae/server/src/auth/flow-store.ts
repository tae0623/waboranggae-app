import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db/client';

export type StoredFlow = { payload: string; revision: number; expires_at: Date };
function key() {
  const secret = process.env.OAUTH_FLOW_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('OAuth storage encryption key is not configured');
  return createHash('sha256').update('waboranggae-oauth-flow-v1:' + secret).digest();
}
export function sealFlow(value: unknown, id: string): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(id));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function openFlow<T>(value: string, id: string): T {
  const data = Buffer.from(value, 'base64');
  if (data.length < 29) throw new Error('Invalid OAuth storage');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAAD(Buffer.from(id)); decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8')) as T;
}
export const flowStore = {
  async prune() { await prisma.$executeRaw`DELETE FROM oauth_flows WHERE expires_at <= now()`; },
  async create(id: string, value: unknown, expires: Date) {
    const payload = sealFlow(value, id);
    await prisma.$transaction(async tx => {
      // Serialize the small admission check across all API replicas.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(7620260915::bigint)`;
      await tx.$executeRaw`DELETE FROM oauth_flows WHERE expires_at <= now()`;
      const rows = await tx.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM oauth_flows`;
      if (Number(rows[0]?.count) >= 500) throw new Error('Too many active OAuth requests');
      await tx.$executeRaw`INSERT INTO oauth_flows (id, payload, expires_at) VALUES (${id}, ${payload}, ${expires})`;
    });
  },
  async get<T>(id: string): Promise<{ value: T; revision: number } | null> {
    const rows = await prisma.$queryRaw<StoredFlow[]>`SELECT payload, revision, expires_at FROM oauth_flows WHERE id = ${id} AND expires_at > now()`;
    const row = rows[0];
    return row ? { value: openFlow<T>(row.payload, id), revision: row.revision } : null;
  },
  async update(id: string, revision: number, value: unknown): Promise<boolean> {
    const payload = sealFlow(value, id);
    const count = await prisma.$executeRaw`UPDATE oauth_flows SET payload = ${payload}, revision = revision + 1 WHERE id = ${id} AND revision = ${revision} AND expires_at > now()`;
    return count === 1;
  },
  async remove(id: string, revision: number): Promise<boolean> {
    return await prisma.$executeRaw`DELETE FROM oauth_flows WHERE id = ${id} AND revision = ${revision} AND expires_at > now()` === 1;
  },
};
