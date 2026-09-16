import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL,base);assert.ok(Date.parse(config.EXPIRES_AT)>Date.now());
const checks=[];
async function call(path,body,admitted=true){
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json',...(admitted?{'X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 const data=await r.json();checks.push({path:path.split('?')[0],status:r.status,code:data.code});return{status:r.status,code:data.code};
}
assert.equal((await call('/livez')).status,200);
assert.equal((await call('/readyz')).status,200);
assert.equal((await call('/api/recommend',{preferences:{}},false)).status,403);
assert.equal((await call('/api/user/me')).status,401);
// This diagnostic is only for an already confirmed exhausted protective cap; it never resets/increases it.
if(process.argv.includes('--quota-exhausted')){
 const preferences={scheduleMode:'course-first',timeBudgetMode:'local',region:'전라남도',city:'나주',startLocation:'순천종합버스터미널',startType:'terminal',startAddress:'전남 순천시 장천3길 13',startLatitude:34.9475959,startLongitude:127.4913557,travelDate:'2026-09-17',startTime:'14:00',mealPreference:'none',meals:[],pace:'balanced',preferLocal:false,interests:['nature'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'지도 서비스 일시 제한 안내 확인',confidence:1};
 const result=await call('/api/recommend',{preferences});assert.equal(result.status,503);assert.equal(result.code,'PLACE_SEARCH_UNAVAILABLE');
}
const report={checkedAt:new Date().toISOString(),passed:true,checks};
await mkdir('.runtime/course-first',{recursive:true});await writeFile('.runtime/course-first/availability.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
