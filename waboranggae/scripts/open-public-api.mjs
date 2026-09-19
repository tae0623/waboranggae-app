// Explicitly authorized by the owner. Never changes the database Data API, Pages gate, or paid plans.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse} from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {loadSupabaseSettings} from './check-supabase.mjs';
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
async function main(){
 const open=process.argv.includes('--open-public-api');
 assert.ok(open||process.argv.includes('--check'),'EXPLICIT_FLAG_REQUIRED');
 const file='.env.edge.local',env=parse(await readFile(file));
 assert.equal(env.PUBLIC_APP_URL,base);assert.equal(env.NODE_ENV,'production');assert.equal(env.API_RUNTIME,'supabase-edge');
 assert.equal(env.EDGE_VALIDATION_MODE,'true');assert.equal(env.EDGE_CLIENT_IP_HEADER,'cf-connecting-ip');
 assert.equal(env.SIGNUP_BOT_REQUIRED,'true');assert.equal(env.ALLOW_DEMO_COURSE_FALLBACK,'false');
 for(const key of ['JWT_SECRET','JWT_REFRESH_SECRET','OAUTH_FLOW_ENCRYPTION_KEY'])assert.ok(env[key]?.length>=32);
 assert.notEqual(env.JWT_SECRET,env.JWT_REFRESH_SECRET);
 assert.equal(decodeURIComponent(new URL(env.DATABASE_URL).username),'waboranggae_api.drtxexwznmpmiclvrjji');
 assert.ok(!Object.keys(env).some(k=>k.startsWith('TMAP_')));
 const entry=await readFile('supabase/functions/waboranggae-api/index.ts','utf8');
 const match=entry.match(/app-([a-f0-9]{16})\.mjs/);assert.ok(match);
 const bytes=await readFile('supabase/functions/waboranggae-api/app-'+match[1]+'.mjs');
 assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,16),match[1]);
 assert.ok(!bytes.includes(Buffer.from('/internal/ingress-check')));
 const settings=await loadSupabaseSettings();
 const db=new pg.Client({...settings,connectionTimeoutMillis:10000,query_timeout:10000});
 try{
  await db.connect();await db.query('BEGIN READ ONLY');
  const names=['users','oauth_identities','bookmarks','search_history','oauth_flows','api_quota_buckets','auth_revocations','_prisma_migrations'];
  const rows=await db.query("SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",[names]);
  assert.equal(rows.rows.length,8);assert.ok(rows.rows.every(r=>r.rowsecurity));
  const grants=await db.query("SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name=ANY($1::text[]) AND grantee IN ('anon','authenticated','PUBLIC')",[names]);
  assert.equal(grants.rows[0].n,0);await db.query('ROLLBACK');
 }finally{await db.end();}
 const checks=[];
 const headers={'X-Waboranggae-Validation':env.EDGE_VALIDATION_KEY};
 async function check(path,status,extra={}){
  const response=await fetch(base+path,{headers,...extra,redirect:'manual',signal:AbortSignal.timeout(45000)});
  const text=await response.text();
  for(const key of ['JWT_SECRET','JWT_REFRESH_SECRET','OAUTH_FLOW_ENCRYPTION_KEY','DATABASE_URL','TURNSTILE_SECRET_KEY'])assert.ok(!text.includes(env[key]));
  assert.equal(response.status,status,'API_CHECK_FAILED:'+path);
  checks.push({path,status});try{return JSON.parse(text);}catch{return null;}
 }
 assert.equal((await check('/readyz',200)).ok,true);
 assert.deepEqual(await check('/auth/signup-config',200),{required:true,available:true});
 assert.equal((await check('/legal/config',200)).version,'2026-09-18-consent-v4');
 await check('/api/user/me',401);
 await check('/api/user/me',401,{headers:{...headers,Authorization:'Bearer invalid-fixture'}});
 await check('/internal/ingress-check',404);
 await check('/api/places/search?q=',400);
 assert.equal((await fetch('https://waboranggae-app.pages.dev',{redirect:'manual'})).status,401);
 const report={checkedAt:new Date().toISOString(),edgeRevision:match[1],checks,rlsTables:8,publicDbGrants:0,teamWebPrivate:true,kakaoCalls:0,storeSubmitted:false,publicApiEnabled:false};
 await writeFile('.runtime/public-api-security-check.json',JSON.stringify(report,null,2));
 if(open){
  const result=spawnSync('.tools/edge/supabase.exe',['secrets','set','EDGE_VALIDATION_MODE=false','--project-ref','drtxexwznmpmiclvrjji'],{encoding:'utf8',windowsHide:true,timeout:60000});
  if(result.status!==0)throw Error('PUBLIC_MODE_UPDATE_FAILED');
  env.EDGE_VALIDATION_MODE='false';
  await writeFile(file,Object.entries(env).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n');
  report.publicApiEnabled=true;report.changedAt=new Date().toISOString();
  await writeFile('.runtime/public-api-security-check.json',JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify(report));
}
main().catch(()=>{console.error('PUBLIC_API_CHECK_OR_TRANSITION_FAILED; inspect current mode before retrying. No diagnostic secrets printed.');process.exitCode=1;});
