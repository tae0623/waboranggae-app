import 'dotenv/config';
import { app } from './app';
import { beginShutdown } from './src/runtime/health';
import { flowStore } from './src/auth/flow-store';
import { prisma } from './src/db/client';

const port = Number(process.env.PORT || 8787);
export const server = app.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`[waboranggae] server listening on http://localhost:${port}`);
});
const cleanup = setInterval(() => {
  void flowStore.prune().catch(() => console.warn('[runtime] Expired OAuth cleanup deferred.'));
  void prisma.$executeRaw`DELETE FROM api_quota_buckets WHERE expires_at <= now()`.catch(() => undefined);
}, 60_000);
cleanup.unref();
function shutdown() {
  beginShutdown(); clearInterval(cleanup);
  const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 10_000);
  deadline.unref();
  server.close(() => { void prisma.$disconnect().finally(() => { clearTimeout(deadline); process.exit(0); }); });
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
