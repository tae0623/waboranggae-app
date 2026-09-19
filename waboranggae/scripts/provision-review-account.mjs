// Administrator-only provisioning. Public signup can never assign a login alias.
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcrypt';
import {parse} from 'dotenv';
import {loadSupabaseSettings} from './check-supabase.mjs';
const project='drtxexwznmpmiclvrjji',expected='20260918070000_review_login_alias';
async function main(){
 const action=process.argv[2];
 if(!['--check','--apply-and-create'].includes(action)||process.argv.length!==3)throw Error('EXPLICIT_ACTION_REQUIRED');
 const settings=await loadSupabaseSettings(),url=new URL(settings.connectionString);
 if(!decodeURIComponent(url.username).endsWith('.'+project)||!settings.ssl.ca)throw Error('TARGET_MISMATCH');
 const client=new pg.Client({connectionString:settings.connectionString,ssl:settings.ssl,connectionTimeoutMillis:10000,query_timeout:15000});
 await client.connect();
 try{
  const applied=await client.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  const names=applied.rows.map(r=>r.migration_name);
  if(!names.includes('20260916010000_current_session_logout'))throw Error('BASELINE_NOT_APPLIED');
  const pending=(await readdir('prisma/migrations',{withFileTypes:true})).filter(e=>e.isDirectory()&&!names.includes(e.name)).map(e=>e.name);
  if(pending.some(n=>n!==expected))throw Error('UNEXPECTED_PENDING_MIGRATION');
  if(action==='--check'){console.log(JSON.stringify({project,migration:expected,alreadyApplied:names.includes(expected),changed:false}));return;}
  const values=parse(await readFile('.env.review-account.local'));
  if(values.LOGIN_ALIAS!=='test'||values.DISPLAY_NAME!=='테스터'||(values.PASSWORD||'').length<12)throw Error('REVIEW_ACCOUNT_SETTINGS_INVALID');
  url.searchParams.set('sslmode','require');url.searchParams.set('sslaccept','strict');url.searchParams.set('sslcert',settings.certPath.replaceAll('\\','/'));
  url.searchParams.set('connection_limit','2');url.searchParams.set('connect_timeout','10');url.searchParams.set('schema','public');
  if(pending.length){
   const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8',timeout:120000,windowsHide:true});
   if(result.status!==0)throw Error('MIGRATION_FAILED');
  }
  const permissions=await client.query("SELECT relrowsecurity AS rls,has_table_privilege('anon','users','SELECT') AS anon,has_table_privilege('authenticated','users','SELECT') AS authenticated,has_table_privilege('waboranggae_api','users','SELECT,INSERT,UPDATE,DELETE') AS runtime FROM pg_class WHERE oid='public.users'::regclass");
  const safe=permissions.rows[0];
  if(!safe?.rls||safe.anon||safe.authenticated||!safe.runtime)throw Error('PERMISSIONS_CHECK_FAILED');
  const found=await client.query('SELECT password,"displayName" FROM users WHERE "loginAlias"=$1',[values.LOGIN_ALIAS]);
  if(found.rowCount){
   if(found.rows[0].displayName!==values.DISPLAY_NAME||!await bcrypt.compare(values.PASSWORD,found.rows[0].password||''))throw Error('EXISTING_ALIAS_REQUIRES_REVIEW');
   console.log(JSON.stringify({alreadyCreated:true,alias:'test',ordinaryPermissions:true,existingAccountUnchanged:true}));return;
  }
  const hash=await bcrypt.hash(values.PASSWORD,12),id='review-'+randomUUID();
  await client.query('INSERT INTO users(id,email,"displayName",password,"loginAlias","tokenVersion","updatedAt") VALUES($1,$2,$3,$4,$5,0,NOW())',
   [id,'review-'+randomUUID()+'@example.invalid',values.DISPLAY_NAME,hash,values.LOGIN_ALIAS]);
  console.log(JSON.stringify({created:true,alias:'test',nickname:'테스터',ordinaryPermissions:true,passwordStoredAsHash:true,firstLoginConsentRequired:true,existingUsersUnchanged:true}));
 }finally{await client.end();}
}
main().catch(e=>{console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'REVIEW_ACCOUNT_PROVISION_FAILED');process.exitCode=1;});
