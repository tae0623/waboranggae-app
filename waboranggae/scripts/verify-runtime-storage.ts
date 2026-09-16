import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { parse } from 'dotenv';

async function main() {
  Object.assign(process.env, parse(readFileSync('.env.team.local')), { NODE_ENV:'test' });
  const url = new URL(process.env.DATABASE_URL || '');
  // This integration test must never seed a real cloud/production DB.
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55432'); assert.equal(url.pathname, '/waboranggae_dev');
  const { prisma } = await import('../server/src/db/client');
  const { flowStore } = await import('../server/src/auth/flow-store');
  const { reserveDailyQuota, koreaDay } = await import('../server/src/runtime/quota');
  const mode = process.argv[2], supplied = process.argv[3];
  try {
    if (mode === 'seed' || mode === 'recover') {
      assert.match(supplied || '', /^runtime-test-[a-f0-9-]+$/);
      if (mode === 'seed') await flowStore.create(supplied!, { stage:'pending', fixture:'not-a-real-login' }, new Date(Date.now()+60000));
      else assert.equal((await flowStore.get<{ fixture:string }>(supplied!))?.value.fixture, 'not-a-real-login');
      return;
    }
    const id = 'runtime-test-' + randomUUID(), scope = 'test:' + randomUUID(), quotaKey = scope + ':' + koreaDay();
    const originalUsers = await prisma.user.count();
    try {
      for (const step of ['seed','recover']) {
        const child = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/verify-runtime-storage.ts', step, id],
          { cwd:process.cwd(), env:process.env, windowsHide:true, stdio:'pipe', timeout:15000 });
        assert.equal(child.status, 0, 'Separate process ' + step + ' failed (details redacted).');
      }
      const flow = await flowStore.get<{stage:string}>(id); assert.equal(flow?.revision, 0);
      const writes = await Promise.all(Array.from({length:10}, () => flowStore.update(id, 0, { stage:'complete', fixture:'not-a-real-login' })));
      assert.equal(writes.filter(Boolean).length, 1);
      const claims = await Promise.all(Array.from({length:10}, () => flowStore.remove(id, 1)));
      assert.equal(claims.filter(Boolean).length, 1);
      const reservations = await Promise.all(Array.from({length:20}, () => reserveDailyQuota(scope, 7)));
      assert.equal(reservations.filter(Boolean).length, 7);
      const rows = await prisma.$queryRaw<{count:number}[]>`SELECT count FROM api_quota_buckets WHERE key=${quotaKey}`;
      assert.equal(rows[0]?.count, 7);
      await flowStore.create(id, {fixture:'expired'}, new Date(Date.now()-1000));
      assert.equal(await flowStore.get(id), null);
      assert.equal(await prisma.user.count(), originalUsers);
      const security = await prisma.$queryRaw<{tablename:string;rowsecurity:boolean}[]>`
        SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'
        AND tablename IN ('users','oauth_identities','bookmarks','search_history','oauth_flows','api_quota_buckets','_prisma_migrations')`;
      assert.equal(security.length, 7); assert(security.every(row => row.rowsecurity));
      console.log(JSON.stringify({ database:'local-team-only', separateProcessRecovery:true,
        concurrentUpdateWinners:1, concurrentClaimWinners:1, quotaReserved:7, quotaAttempts:20,
        expiryEnforced:true, rlsProtectedTables:7, userCountUnchanged:true }));
    } finally {
      // Delete only fixtures created in this invocation; no blanket resets/pruning.
      await prisma.$executeRaw`DELETE FROM oauth_flows WHERE id=${id}`;
      await prisma.$executeRaw`DELETE FROM api_quota_buckets WHERE key=${quotaKey}`;
    }
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Runtime storage integration failed (details redacted).'); process.exitCode=1; });
