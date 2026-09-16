import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function supabaseConnection(values) {
  if (!values.DATABASE_URL?.trim()) throw new Error('DATABASE_URL_MISSING');
  let url;
  try { url = new URL(values.DATABASE_URL.trim()); } catch { throw new Error('DATABASE_URL_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com$/i.test(url.hostname)
      || url.port !== '5432' || url.pathname !== '/postgres'
      || !url.username || url.hash) throw new Error('USE_SUPABASE_SESSION_POOLER_5432');
  if (values.SUPABASE_DB_PASSWORD) url.password = encodeURIComponent(values.SUPABASE_DB_PASSWORD);
  if (!url.password || /YOUR-PASSWORD|YOUR_PASSWORD/i.test(decodeURIComponent(url.password))) throw new Error('DB_PASSWORD_MISSING');
  // TLS/timeouts are supplied explicitly. pg accepts query-string host/user overrides;
  // discard them so credentials cannot be redirected after hostname validation.
  url.search = '';
  return url.toString();
}

export async function loadSupabaseSettings() {
  const values = parse(await readFile(path.join(root, '.env.supabase.local')));
  const connectionString = supabaseConnection(values);
  const certPath = values.SUPABASE_SSL_ROOT_CERT ? path.resolve(root, values.SUPABASE_SSL_ROOT_CERT) : undefined;
  const ca = certPath ? await readFile(certPath) : undefined;
  return { connectionString, certPath, ssl: { rejectUnauthorized:true, ...(ca ? {ca} : {}) } };
}

async function main() {
  // Deliberately do NOT merge the local development .env or copy real users.
  const { connectionString, ssl } = await loadSupabaseSettings();
  const client = new pg.Client({ connectionString,
    ssl,
    connectionTimeoutMillis: 10000, query_timeout: 10000,
    application_name: 'waboranggae-readonly-readiness',
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query(`SELECT tablename, rowsecurity FROM pg_tables
      WHERE schemaname='public' AND tablename = ANY($1::text[]) ORDER BY tablename`,
    [['users','oauth_identities','bookmarks','search_history','oauth_flows','api_quota_buckets','auth_revocations','_prisma_migrations']]);
    const exposure = await client.query(`SELECT count(*)::int AS count
      FROM pg_tables t CROSS JOIN pg_roles r
      WHERE t.schemaname='public' AND t.tablename=ANY($1::text[])
        AND r.rolname IN ('anon','authenticated')
        AND (has_table_privilege(r.oid, quote_ident(t.schemaname)||'.'||quote_ident(t.tablename), 'SELECT')
          OR has_table_privilege(r.oid, quote_ident(t.schemaname)||'.'||quote_ident(t.tablename), 'INSERT')
          OR has_table_privilege(r.oid, quote_ident(t.schemaname)||'.'||quote_ident(t.tablename), 'UPDATE')
          OR has_table_privilege(r.oid, quote_ident(t.schemaname)||'.'||quote_ident(t.tablename), 'DELETE'))`,
    [['users','oauth_identities','bookmarks','search_history','oauth_flows','api_quota_buckets','auth_revocations','_prisma_migrations']]);
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ connected: true, tlsVerified: true, readOnly: true,
      appTablesFound: result.rows.length, appTablesExpected: 8,
      appTablesWithoutRls: result.rows.filter(row => !row.rowsecurity).length,
      publicClientTableGrants: exposure.rows[0].count,
      nextStep: result.rows.length === 0 ? 'Review fresh schema migration; no local users copied.' : 'Review migration status and permissions before switching the API.',
    }, null, 2));
  } finally { await client.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const known = ['DATABASE_URL_MISSING','DATABASE_URL_INVALID','USE_SUPABASE_SESSION_POOLER_5432','DB_PASSWORD_MISSING'];
    // Never echo pg errors, URLs, connection options or passwords.
    const code = known.includes(error?.message) ? error.message : typeof error?.code === 'string' && /^[A-Z0-9_]{2,60}$/.test(error.code) ? error.code : 'CONNECTION_CHECK_FAILED';
    console.error('Supabase read-only check: ' + code);
    console.error('기존 .env는 변경하지 않았습니다. 인증서 오류이면 Supabase CA 인증서를 지정하세요.');
    process.exitCode = 1;
  });
}
