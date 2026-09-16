// One-time, schema-only initialization. Never imports local user data or changes .env.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadSupabaseSettings } from './check-supabase.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function main() {
  const deploy = process.argv.includes('--initialize-empty-project');
  if (deploy && !process.argv.includes('--data-api-disabled')) throw new Error('CONFIRM_DATA_API_DISABLED_FIRST');
  const { connectionString, ssl, certPath } = await loadSupabaseSettings();
  const client = new pg.Client({connectionString,ssl,connectionTimeoutMillis:10000,query_timeout:10000,
    application_name:'waboranggae-schema-initializer'});
  let tables;
  try {
    await client.connect();
    const result = await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
    tables = result.rows[0].count;
  } finally { await client.end(); }
  if (!deploy) { console.log(JSON.stringify({tlsVerified:true,publicTables:tables,empty:tables===0,changed:false})); return; }
  if (tables !== 0) throw new Error('PROJECT_NOT_EMPTY_STOP_AND_REVIEW');

  const prismaUrl = new URL(connectionString);
  prismaUrl.searchParams.set('sslmode','require'); prismaUrl.searchParams.set('sslaccept','strict');
  if (certPath) prismaUrl.searchParams.set('sslcert',certPath.replace(/\\/g,'/'));
  prismaUrl.searchParams.set('connection_limit','2'); prismaUrl.searchParams.set('connect_timeout','10');
  prismaUrl.searchParams.set('schema','public');
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','deploy'], {
    cwd:root,env:{...process.env,DATABASE_URL:prismaUrl.toString()},windowsHide:true,encoding:'utf8',timeout:120000,
  });
  if (result.status !== 0) {
    const code = (String(result.stdout)+String(result.stderr)).match(/\bP\d{4}\b/)?.[0] || 'MIGRATION_FAILED';
    throw new Error(code); // Do not expose URL, SQL or database errors.
  }
  console.log(JSON.stringify({schemaInitialized:true,localUsersCopied:false,localEnvChanged:false}));
  const verification = spawnSync(process.execPath,['scripts/check-supabase.mjs'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000});
  console.log(verification.stdout);
  if (verification.status !== 0) throw new Error('POST_MIGRATION_VERIFICATION_FAILED');
}
main().catch(error => {
  const safe = typeof error?.message === 'string' && /^[A-Z0-9_]{2,80}$/.test(error.message) ? error.message : 'SUPABASE_INITIALIZATION_FAILED';
  console.error(safe + ': no reset or data copy was attempted.'); process.exitCode=1;
});
