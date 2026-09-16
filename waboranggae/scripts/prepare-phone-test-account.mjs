import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {parse} from 'dotenv';
if(!process.argv.includes('--create-test-account'))throw Error('EXPLICIT_TEST_ACCOUNT_FLAG_REQUIRED');
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
const device=parse(await readFile('.env.device-validation.local'));
if(device.API_BASE_URL!==base||device.VALIDATION_SCOPE!=='account-test'||Date.parse(device.EXPIRES_AT)<=Date.now())throw Error('ACCOUNT_TEST_CREDENTIAL_REQUIRED');
const file='.env.phone-test-account.local';
let account;
try{account=parse(await readFile(file));}catch(e){if(e.code!=='ENOENT')throw e;}
if(!account){
  account={API_BASE_URL:base,TEST_EMAIL:'s20-review-'+randomBytes(8).toString('hex')+'@example.invalid',TEST_PASSWORD:randomBytes(18).toString('base64url')+'Aa1!',TEST_DISPLAY_NAME:'휴대폰 테스트 계정'};
  await writeFile(file,'# Private synthetic test account. Not a real mailbox. Never commit or put into an APK.\n'+Object.entries(account).map(([k,v])=>k+'='+JSON.stringify(v)).join('\n')+'\n',{mode:0o600,flag:'wx'});
}
if(account.API_BASE_URL!==base||!/^s20-review-[a-f0-9]{16}@example\.invalid$/.test(account.TEST_EMAIL)||!account.TEST_PASSWORD)throw Error('UNEXPECTED_TEST_ACCOUNT_FILE');
const report={checkedAt:new Date().toISOString(),passed:false,syntheticAccountRetained:true,checks:[]};
async function send(route,method='GET',body,token){
  const start=Date.now();
  const r=await fetch(base+route,{method,redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':device.DEVICE_VALIDATION_TOKEN,...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(40000)});
  const data=await r.json();report.checks.push({route,method,status:r.status,ms:Date.now()-start});return{status:r.status,data};
}
try{
  assert.equal((await send('/api/user/me')).status,401,'Device admission must not replace user JWT');
  const legal=(await send('/legal/config')).data;
  const credentials={email:account.TEST_EMAIL,password:account.TEST_PASSWORD};
  let login=await send('/auth/login','POST',credentials);
  if(login.status===401){
    const signup={...credentials,displayName:account.TEST_DISPLAY_NAME};
    assert.equal((await send('/auth/signup','POST',signup)).status,400,'Signup requires explicit consent');
    assert.equal((await send('/auth/signup','POST',{...signup,privacyConsent:true,consentVersion:legal.version})).status,201,'Synthetic test account signup');
    login=await send('/auth/login','POST',credentials);
  }
  assert.equal(login.status,200,'Reusable test account login');
  const token=login.data.accessToken;
  const me=await send('/api/user/me','GET',undefined,token);
  assert.equal(me.status,200);assert.equal(me.data.email,account.TEST_EMAIL);assert.equal(me.data.password,undefined);
  assert.equal((await send('/api/user/bookmarks','GET',undefined,token)).status,200);
  assert.equal((await send('/auth/logout','POST',undefined,token)).status,200);
  assert.equal((await send('/api/user/me','GET',undefined,token)).status,401,'Logged-out token rejected');
  report.passed=true;
}catch{report.failure='TEST_ACCOUNT_CHECK_FAILED';process.exitCode=1;}
await mkdir('.runtime/phone-account-test',{recursive:true});
await writeFile('.runtime/phone-account-test/account-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,credentialsFile:file,secretValuesPrinted:false}));
