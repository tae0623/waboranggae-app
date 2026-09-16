import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL,base);
assert.ok(Date.parse(config.EXPIRES_AT)>Date.now(),'Device validation expired');
async function send(path,body){
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(140000)});
 if(!r.ok)throw Error('HTTP_'+r.status);return r.json();
}
// Fixed public terminal, never the phone's current position or user's home address.
const found=await send('/api/places/search?q='+encodeURIComponent('순천종합버스터미널'));
const origin=found.places.find(p=>p.name.includes('순천')&&p.name.includes('터미널'));assert.ok(origin);
const common={timeBudgetMode:'local',region:'전라남도',city:'순천',startLocation:origin.name,startAddress:origin.address,startLatitude:origin.latitude,startLongitude:origin.longitude,startType:'terminal',
 travelDate:'2026-09-19',travelEndDate:'2026-09-19',startTime:'09:15',endTime:'15:40',durationHours:385/60,
 mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'현지 일정 검증',confidence:1};
const cases=[
 {name:'same-day-exact-minutes',preferences:common},
 {name:'two-day',preferences:{...common,travelEndDate:'2026-09-20',startTime:'10:00',endTime:'16:00',durationHours:30,interests:['nature','history','food','cafe']}},
];
const report={checkedAt:new Date().toISOString(),anonymousStatus:(await fetch(base+'/api/regions/jeonnam-cities',{redirect:'error'})).status,cases:[]};
assert.equal(report.anonymousStatus,403);
for(const item of (process.argv.includes('--same-day-only')?cases.slice(0,1):cases)){
 const start=Date.now();
 try{
  const data=await send('/api/recommend',{preferences:item.preferences});
  const result={name:item.name,elapsedMs:Date.now()-start,source:data.source,fallbackReason:data.fallbackReason,
   courses:data.courses.map(c=>({title:c.title,passed:c.constraintPassed,routeSource:c.routeSource,minutes:c.timeBreakdown?.totalMinutes,requestedMinutes:c.timeBreakdown?.requestedMinutes,
    placeIds:c.places.map(p=>p.id).sort(),places:c.places.map(p=>({name:p.name,category:p.category,arrival:p.arrival,stay:p.stayMinutes})),violations:c.constraintViolations}))};
  report.cases.push(result);console.log(JSON.stringify(result));
 }catch(e){const result={name:item.name,error:/^HTTP_\d+$/.test(e.message)?e.message:'REQUEST_FAILED'};report.cases.push(result);console.log(JSON.stringify(result));}
}
await mkdir('.runtime',{recursive:true});await writeFile('.runtime/clock-window-live.json',JSON.stringify(report,null,2));
assert.ok(report.cases[0].courses?.some(c=>c.passed&&c.requestedMinutes===385&&c.minutes<=385),'Exact-window recommendation unavailable');
