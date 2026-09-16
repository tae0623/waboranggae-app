import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';
import { loadSupabaseSettings } from './check-supabase.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=path.join(root,'.env.edge.local');
const role='waboranggae_api';
const tables=['users','bookmarks','search_history','oauth_identities','oauth_flows','api_quota_buckets','auth_revocations'];
async function main(){
  if(!process.argv.includes('--prepare-runtime'))throw Error('EXPLICIT_PREPARE_FLAG_REQUIRED');
  const settings=await loadSupabaseSettings(), adminUrl=new URL(settings.connectionString);
  const ref=decodeURIComponent(adminUrl.username).split('.').at(-1);
  if(!/^[a-z]{20}$/.test(ref)||!settings.ssl.ca)throw Error('PROJECT_OR_CA_INVALID');
  let existing;try{existing=parse(await readFile(file));}catch(error){if(error.code!=='ENOENT')throw error;}
  const apiUrl=new URL(adminUrl);apiUrl.username=role+'.'+ref;apiUrl.port='6543';
  if(existing){
    const saved=new URL(existing.DATABASE_URL);
    if(saved.hostname!==apiUrl.hostname || saved.username!==apiUrl.username || saved.port!=='6543' || saved.pathname!=='/postgres')throw Error('EXISTING_RUNTIME_TARGET_MISMATCH');
    apiUrl.password=saved.password;
  }else apiUrl.password=randomBytes(32).toString('hex');
  const client=new pg.Client({...settings,connectionTimeoutMillis:10000,query_timeout:15000});
  let created=false;
  try{
    await client.connect();
    const found=await client.query('SELECT rolname FROM pg_roles WHERE rolname=$1',[role]);
    if(found.rowCount&&!existing)throw Error('EXISTING_ROLE_WITHOUT_LOCAL_CONFIG');
    if(!existing){
      const source=parse(await readFile(path.join(root,'.env')));
      const safe={DATABASE_URL:apiUrl.toString(),DB_CA_CERT_BASE64:Buffer.from(settings.ssl.ca).toString('base64'),
        PUBLIC_APP_URL:'https://'+ref+'.supabase.co/functions/v1/waboranggae-api',
        NODE_ENV:'production',API_RUNTIME:'supabase-edge',ALLOW_DEMO_COURSE_FALLBACK:'false',QUOTA_STORE:'database',
        JWT_SECRET:randomBytes(32).toString('hex'),JWT_REFRESH_SECRET:randomBytes(32).toString('hex'),
        OAUTH_FLOW_ENCRYPTION_KEY:randomBytes(32).toString('hex'),EDGE_VALIDATION_MODE:'true',EDGE_VALIDATION_KEY:randomBytes(32).toString('hex'),
        OLLAMA_ENABLED:'false',OLLAMA_COURSE_PLANNER_ENABLED:'false',
        KAKAO_LOGIN_ENABLED:'false',GOOGLE_LOGIN_ENABLED:'false',
        KAKAO_DAILY_REQUEST_LIMIT:'100'};
      // Explicit allowlist: never upload team access secrets, the administrator DB
      // password, Supabase account token, or unrelated environment variables.
      for(const name of ['DATA_GO_KR_KEY','KAKAO_MAP_JS_KEY','KAKAO_REST_API_KEY','KAKAO_FREE_TIER_CONFIRMED',
        'PRIVACY_OPERATOR_NAME']){
        if(source[name])safe[name]=source[name];
      }
      if(!safe.DATA_GO_KR_KEY)throw Error('TOUR_API_KEY_MISSING');
      if(Object.values(safe).some(v=>/[\r\n]/.test(v)))throw Error('MULTILINE_SECRET_NOT_SUPPORTED');
      const lines=Object.entries(safe).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n');
      await writeFile(file,'# Generated private cloud validation settings. Never commit or share.\n'+lines+'\n',{flag:'wx',mode:0o600});
    }
    await client.query('BEGIN');
    if(!found.rowCount){
      // Generated password is strictly hex, never accepts SQL from a user.
      const password=decodeURIComponent(apiUrl.password);if(!/^[a-f0-9]{64}$/.test(password))throw Error('PASSWORD_FORMAT_INVALID');
      await client.query("CREATE ROLE waboranggae_api LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10 PASSWORD '"+password+"'");
      created=true;
    }
    await client.query('GRANT CONNECT ON DATABASE postgres TO waboranggae_api');
    await client.query('GRANT USAGE ON SCHEMA public TO waboranggae_api');
    for(const table of tables){
      await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.'+table+' TO waboranggae_api');
      const policy=await client.query('SELECT policyname FROM pg_policies WHERE schemaname=$1 AND tablename=$2 AND policyname=$3',['public',table,'waboranggae_api_access']);
      if(!policy.rowCount)await client.query('CREATE POLICY waboranggae_api_access ON public.'+table+' TO waboranggae_api USING (true) WITH CHECK (true)');
    }
    await client.query('COMMIT');
  }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{await client.end();}
  const runtime=new pg.Client({connectionString:apiUrl.toString(),ssl:settings.ssl,connectionTimeoutMillis:15000,query_timeout:10000});
  try{
    await runtime.connect();
    await runtime.query('BEGIN');
    const testKey='edge-permission-test:'+randomBytes(8).toString('hex');
    await runtime.query("INSERT INTO api_quota_buckets(key,count,expires_at) VALUES($1,1,now()+interval '1 minute')",[testKey]);
    await runtime.query('SELECT id FROM users LIMIT 0');
    const checks=await runtime.query("SELECT has_schema_privilege(current_user,'public','CREATE') AS ddl, has_table_privilege(current_user,'public._prisma_migrations','SELECT') AS migrations, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user");
    if(Object.values(checks.rows[0]).some(Boolean))throw Error('EXCESSIVE_RUNTIME_PRIVILEGES');
    await runtime.query('ROLLBACK');
    console.log(JSON.stringify({runtimeRoleReady:true,roleCreated:created,tlsVerified:true,transactionPooler:true,tableScope:tables.length,noDdl:true,noRlsBypass:true,localUsersCopied:false,validationOnly:true}));
  }finally{await runtime.end();}
}
main().catch(error=>{console.error(JSON.stringify({prepared:false,code:/^[A-Z0-9_]{3,80}$/.test(error?.message||'')?error.message:error?.code||'RUNTIME_PREPARATION_FAILED'}));process.exitCode=1;});
