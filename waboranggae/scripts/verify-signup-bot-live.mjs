// Minimal live checks: no tourism APIs and no new account creation.
import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const origin='https://waboranggae-app.pages.dev',base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
const device=parse(await readFile('.env.device-validation.local'));
const team=parse(await readFile('.env.pages.local'));
const review=parse(await readFile('.env.review-account.local'));
const secrets=parse(await readFile('.env.signup-bot.local'));
assert.equal(device.API_BASE_URL,base);assert.equal(team.TEAM_WEB_ORIGIN,origin);assert.ok(Date.parse(device.EXPIRES_AT)>Date.now());
const checks=[];let access;
async function request(url,options={}){
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000),...options});
 const text=await response.text();
 for(const secret of [secrets.TURNSTILE_SECRET_KEY,team.TEAM_WEB_PASSWORD,team.TEAM_WEB_API_KEY,device.DEVICE_VALIDATION_TOKEN,review.PASSWORD])assert.ok(!text.includes(secret),'SECRET_IN_RESPONSE');
 let data;try{data=JSON.parse(text)}catch{}
 checks.push({path:new URL(url).pathname,status:response.status});
 return{response,text,data};
}
const headers=()=>({'Content-Type':'application/json','X-Dev-Access-Key':device.DEVICE_VALIDATION_TOKEN,...(access?{Authorization:'Bearer '+access}:{})});
try{
 const widget=await request(origin+'/auth/bot-check');assert.equal(widget.response.status,200);assert.ok(widget.text.includes(secrets.TURNSTILE_SITE_KEY));assert.ok(widget.response.headers.get('content-security-policy')?.includes('frame-ancestors'));
 assert.equal((await request(origin)).response.status,401);
 const page=await request(origin,{headers:{Authorization:'Basic '+Buffer.from('team:'+team.TEAM_WEB_PASSWORD).toString('base64')}});
 assert.equal(page.response.status,200);const cookie=page.response.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const config=await request(origin+'/auth/signup-config',{headers:{Cookie:cookie}});
 assert.deepEqual(config.data,{required:true,available:true});
 assert.equal((await request(base+'/auth/signup-config')).response.status,403);
 assert.deepEqual((await request(base+'/auth/signup-config',{headers:headers()})).data,{required:true,available:true});
 const login=await request(base+'/auth/login',{method:'POST',headers:headers(),body:JSON.stringify({email:review.LOGIN_ALIAS,password:review.PASSWORD})});
 assert.equal(login.response.status,200);assert.equal(login.data.user.loginAlias,'test');assert.equal(login.data.user.displayName,'테스터');assert.equal(login.data.user.password,undefined);
 access=login.data.accessToken;assert.equal(typeof access,'string');
 const me=await request(base+'/api/user/me',{headers:headers()});assert.equal(me.response.status,200);assert.equal(me.data.loginAlias,'test');assert.equal(me.data.password,undefined);
 // Use the already existing synthetic email: even a broken bot gate cannot create another account.
 const legal=await request(base+'/legal/config',{headers:headers()});assert.equal(legal.response.status,200);
 const blocked=await request(base+'/auth/signup',{method:'POST',headers:headers(),body:JSON.stringify({
  email:login.data.user.email,password:review.PASSWORD,displayName:'테스터',privacyConsent:true,ageConfirmed:true,consentVersion:legal.data.version,
 })});
 assert.equal(blocked.response.status,400);assert.equal(blocked.data.code,'SIGNUP_BOT_CHECK');
 assert.equal((await request(base+'/auth/logout/current',{method:'POST',headers:headers(),body:'{}'})).response.status,200);
 assert.equal((await request(base+'/api/user/me',{headers:headers()})).response.status,401);access=undefined;
 const report={passed:true,checks,testAccountLogin:true,missingBotTokenRejected:true,newAccountCreated:false,privateAccessMaintained:true,mailSent:false,kakaoCalls:0,checkedAt:new Date().toISOString()};
 await writeFile('.runtime/signup-bot-live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){console.log(JSON.stringify({passed:false,checks,reason:e.code||'LIVE_CHECK_FAILED'}));process.exitCode=1;}
