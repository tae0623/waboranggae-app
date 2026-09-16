import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';
import pg from 'pg';
import { loadSupabaseSettings } from './check-supabase.mjs';

// Explicit final-test check. No counter reset, no account mutation, no secret output.
assert.ok(process.argv.includes('--allow-two-public-searches'), 'EXPLICIT_CHECK_REQUIRED');
const ref='drtxexwznmpmiclvrjji';
const base='https://'+ref+'.supabase.co/functions/v1/waboranggae-api';
const config=parse(await readFile('.env.edge.local'));
assert.equal(config.PUBLIC_APP_URL,base);
assert.equal(config.KAKAO_DAILY_REQUEST_LIMIT,'1000');
assert.equal(config.KAKAO_FREE_TIER_CONFIRMED,'true');
const report={checkedAt:new Date().toISOString(),passed:false,limit:1000,searches:[]};
let client;
try {
  const listed=spawnSync('.tools/edge/supabase.exe',['secrets','list','--project-ref',ref,'--output','json'],
    {encoding:'utf8',windowsHide:true,timeout:60000});
  assert.equal(listed.status,0,'REMOTE_CONFIG_READ_FAILED');
  const secrets=JSON.parse(listed.stdout);
  const quota=secrets.find(row=>row.name==='KAKAO_DAILY_REQUEST_LIMIT');
  const quotaDigest=quota?.digest ?? quota?.value; // CLI v2 exposes the SHA-256 under "value".
  report.remoteLimitDigestMatches=quotaDigest===createHash('sha256').update('1000').digest('hex');
  assert.equal(report.remoteLimitDigestMatches,true,'REMOTE_LIMIT_MISMATCH');
  client=new pg.Client({...await loadSupabaseSettings(),connectionTimeoutMillis:10000,query_timeout:10000,
    application_name:'waboranggae-quota-readonly'});
  await client.connect();
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  async function usage(){
    await client.query('BEGIN READ ONLY');
    try {const r=await client.query('SELECT count FROM api_quota_buckets WHERE key=$1',['kakao:total:'+day]);
      return Number(r.rows[0]?.count||0);
    }finally{await client.query('ROLLBACK');}
  }
  report.before=await usage();
  const anonymous=await fetch(base+'/api/places/search?q='+encodeURIComponent('순천역'),{redirect:'error',signal:AbortSignal.timeout(15000)});
  report.anonymousStatus=anonymous.status;
  assert.equal(anonymous.status,403,'PRIVATE_GATE_CHANGED');
  for(const query of ['순천역','목포종합버스터미널']){
    const response=await fetch(base+'/api/places/search?q='+encodeURIComponent(query),{
      redirect:'error',headers:{'X-Waboranggae-Validation':config.EDGE_VALIDATION_KEY},
      signal:AbortSignal.timeout(25000)});
    const body=await response.json();
    const providerConfirmed=response.ok&&body.places?.some(p=>p.source==='kakao');
    report.searches.push({status:response.status,providerConfirmed:Boolean(providerConfirmed),results:body.places?.length||0});
    assert.equal(providerConfirmed,true,'PUBLIC_SEARCH_FAILED');
  }
  report.after=await usage();
  assert.ok(report.after>=report.before,'USAGE_COUNTER_DECREASED');
  report.remaining=Math.max(0,1000-report.after);
  report.passed=true;
}catch(error){report.failure=error instanceof assert.AssertionError?error.message:'QUOTA_CHECK_FAILED';process.exitCode=1;}
finally{
  if(client)await client.end();
  await mkdir('.runtime',{recursive:true});
  await writeFile('.runtime/test-quota-check.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
