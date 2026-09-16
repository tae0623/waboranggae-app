// Add only the reviewed current-session revocation table; never reset or copy user data.
import {spawnSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import pg from 'pg';
import {loadSupabaseSettings} from './check-supabase.mjs';
const expected='20260916010000_current_session_logout';
const project='drtxexwznmpmiclvrjji';
try {
 const settings=await loadSupabaseSettings();
 const url=new URL(settings.connectionString);
 if(!decodeURIComponent(url.username).endsWith('.'+project)||!settings.ssl.ca)throw Error('TARGET_MISMATCH');
 const client=new pg.Client({connectionString:settings.connectionString,ssl:settings.ssl,connectionTimeoutMillis:10000});
 await client.connect();
 try {
  const applied=await client.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  const names=applied.rows.map(r=>r.migration_name);
  if(!names.includes('20260915160000_restrict_public_data_api'))throw Error('BASELINE_NOT_APPLIED');
  const pending=(await readdir('prisma/migrations',{withFileTypes:true})).filter(e=>e.isDirectory()&&!names.includes(e.name)).map(e=>e.name);
  if(pending.some(name=>name!==expected))throw Error('UNEXPECTED_PENDING_MIGRATION');
  if(!process.argv.includes('--apply')){console.log(JSON.stringify({target:project,migration:expected,alreadyApplied:names.includes(expected),changed:false}));}
  else {
   url.searchParams.set('sslmode','require');url.searchParams.set('sslaccept','strict');
   url.searchParams.set('sslcert',settings.certPath.replaceAll('\\','/'));
   url.searchParams.set('connection_limit','2');url.searchParams.set('connect_timeout','10');url.searchParams.set('schema','public');
   const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',timeout:120000,windowsHide:true});
   if(result.status!==0)throw Error('MIGRATION_FAILED');
   const safe=await client.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.auth_revocations'::regclass");
   const privileges=await client.query("SELECT has_table_privilege('anon','auth_revocations','SELECT') AS anon,has_table_privilege('authenticated','auth_revocations','SELECT') AS authenticated,has_table_privilege('waboranggae_api','auth_revocations','SELECT,INSERT,UPDATE,DELETE') AS runtime");
   if(!safe.rows[0]?.relrowsecurity || privileges.rows[0].anon || privileges.rows[0].authenticated || !privileges.rows[0].runtime)throw Error('PERMISSIONS_CHECK_FAILED');
   console.log(JSON.stringify({migrationApplied:true,rlsEnabled:true,publicAccess:false,runtimeAccess:true,existingUsersUnchanged:true}));
  }
 }finally{await client.end();}
}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'SESSION_MIGRATION_CHECK_FAILED');process.exitCode=1;}
