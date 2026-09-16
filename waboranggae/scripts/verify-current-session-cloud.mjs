import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(config.API_BASE_URL!==base||config.VALIDATION_SCOPE!=='account-test')throw Error('TARGET_MISMATCH');
const report={checkedAt:new Date().toISOString(),checks:[],passed:false,existingUsersUntouched:true};
async function send(path,body,token,method=body?'POST':'GET'){
 const r=await fetch(base+path,{method,redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN,...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});
 const data=await r.json();report.checks.push({path,method,status:r.status});return{status:r.status,data};
}
const marker=randomBytes(12).toString('hex');
const credentials={email:'session-test-'+marker+'@example.invalid',password:randomBytes(24).toString('hex')+'!Aa1'};
let created=false;
try{
 const legal=await send('/legal/config');
 const first=await send('/auth/signup',{...credentials,displayName:'세션 검증',privacyConsent:true,consentVersion:legal.data.version});
 assert.equal(first.status,201);created=true;
 const a=first.data;
 const second=await send('/auth/login',credentials);assert.equal(second.status,200);const b=second.data;
 const renewed=await send('/auth/refresh',{refreshToken:a.refreshToken});assert.equal(renewed.status,200);
 const out=await send('/auth/logout/current',{},renewed.data.accessToken);assert.equal(out.status,200);assert.equal(out.data.scope,'current-session');
 assert.equal((await send('/api/user/me',undefined,a.accessToken)).status,401);
 assert.equal((await send('/api/user/me',undefined,renewed.data.accessToken)).status,401);
 assert.equal((await send('/auth/refresh',{refreshToken:a.refreshToken})).status,401);
 assert.equal((await send('/auth/refresh',{refreshToken:renewed.data.refreshToken})).status,401);
 assert.equal((await send('/api/user/me',undefined,b.accessToken)).status,200);
 assert.equal((await send('/auth/refresh',{refreshToken:b.refreshToken})).status,200);
 report.passed=true;
}catch(error){report.failure=error.name==='AssertionError'?'ASSERTION_FAILED':'REQUEST_FAILED';process.exitCode=1;}
finally{
 if(created){
  try{const auth=await send('/auth/login',credentials);assert.equal(auth.status,200);assert.equal((await send('/api/user/me',undefined,auth.data.accessToken,'DELETE')).status,200);report.syntheticAccountRemoved=true;}
  catch{report.cleanupFailed=true;process.exitCode=1;}
 }
}
await mkdir('.runtime/phone-account-test',{recursive:true});
await writeFile('.runtime/phone-account-test/current-session-cloud.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

