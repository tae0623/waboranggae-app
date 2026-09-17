// Read-only release access probes. Never authorizes a social identity or prints credentials.
import {readFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
const config=parse(await readFile('.env.device-validation.local'));
assert.equal(config.API_BASE_URL,base);assert.ok(Date.parse(config.EXPIRES_AT)>Date.now());
const checks=[];
try{
 for(const path of ['/legal/privacy','/legal/delete-account','/legal/attributions']){
  const r=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
  checks.push({path,status:r.status,contentType:r.headers.get('content-type')});assert.equal(r.status,200);await r.body?.cancel();
 }
 const r=await fetch(base+'/auth/social/providers',{headers:{'X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(r.status,200);const data=await r.json();
 for(const id of ['kakao','google']){const enabled=data.providers?.find(p=>p.id===id)?.enabled===true;checks.push({provider:id,enabled});assert.ok(enabled);}
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),passed:true,readOnly:true,checks,realSocialIdentityTested:false,secretsPrinted:false},null,2));
}catch{console.error(JSON.stringify({passed:false,checks,error:'RELEASE_ACCESS_CHECK_FAILED'}));process.exitCode=1;}
