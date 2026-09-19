// Scoped live check: disposable example.invalid account, saved public fixture only.
// No Kakao/TourAPI calls, no existing user's session/data, no credential output.
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL,base);assert.ok(Date.parse(config.EXPIRES_AT)>Date.now(),'DEVICE_KEY_EXPIRED');
const email='bookmark-test-'+randomUUID()+'@example.invalid',password=randomBytes(24).toString('hex')+'!9';
let access,userId;const checks=[];
async function send(path,method='GET',body){
 const response=await fetch(base+path,{method,redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN,...(access?{Authorization:'Bearer '+access}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>({}));
 checks.push({path,method,status:response.status,...(!response.ok?{code:data.code,error:typeof data.error==='string'?data.error.slice(0,180):'request failed'}:{})});
 return {status:response.status,data};
}
try{
 const legal=await send('/legal/config');assert.equal(legal.status,200);
 const created=await send('/auth/signup','POST',{email,password,displayName:'코스 저장 검증',privacyConsent:true,consentVersion:legal.data.version});assert.equal(created.status,201);
 access=created.data.accessToken;userId=created.data.user.id;
 const me=await send('/api/user/me');assert.equal(me.data.id,userId);
 const fixture=JSON.parse(await readFile('android-native/app/src/test/resources/recommend-response.json','utf8'));
 const course={...fixture.courses[0],id:'bookmark-fixture-'+randomUUID()};
 if(process.argv.includes('--check-size-limit')){
  const rejected=await send('/api/user/bookmarks/add','POST',{courseId:course.id,courseName:course.title,city:course.city,snapshot:{...course,oversizeTest:'x'.repeat(135000)}});assert.equal(rejected.status,413);
 }
 const result=await send('/api/user/bookmarks/add','POST',{courseId:course.id,courseName:course.title,city:course.city,snapshot:course});assert.equal(result.status,201);
 const list=await send('/api/user/bookmarks');assert.equal(list.status,200);assert.ok(list.data.some(b=>b.courseId===course.id&&b.snapshot.id===course.id));
 const repeat=await send('/api/user/bookmarks/add','POST',{courseId:course.id,courseName:course.title,city:course.city,snapshot:course});assert.equal(repeat.status,201);
 console.log(JSON.stringify({passed:true,checks,kakaoCalls:0,realUserAccountUsed:false}));
}catch(error){console.log(JSON.stringify({passed:false,checks,reason:error.code||'BOOKMARK_VERIFICATION_FAILED'}));process.exitCode=1;}
finally{
 if(userId&&access){try{const me=await send('/api/user/me');assert.equal(me.data.id,userId);assert.equal(me.data.email,email);const removed=await send('/api/user/me','DELETE');assert.equal(removed.status,200);console.log(JSON.stringify({temporaryAccountDeleted:true}));}catch{console.log(JSON.stringify({temporaryAccountDeleted:false}));process.exitCode=1;}}
}
