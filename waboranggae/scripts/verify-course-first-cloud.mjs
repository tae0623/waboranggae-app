import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL,base);assert.ok(Date.parse(config.EXPIRES_AT)>Date.now());
const report={checkedAt:new Date().toISOString(),passed:false,deviceLocationUsed:false,cases:[]};
async function send(path,body){
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(150000)});
 const data=await r.json();
 if(r.status!==200)console.log(JSON.stringify({path,status:r.status,error:typeof data.error==='string'?data.error:undefined,issues:data.issues?.map(i=>({path:i.path,message:i.message}))}));
 assert.equal(r.status,200,`HTTP_${r.status}_${path}`);return data;
}
const common={scheduleMode:'course-first',timeBudgetMode:'local',region:'전라남도',city:'순천',
 startLocation:'순천종합버스터미널',startType:'terminal',startAddress:'전남 순천시 장천3길 13',startLatitude:34.9475959,startLongitude:127.4913557,
 travelDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),startTime:'10:00',mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'코스 먼저 추천 검증',confidence:1};
const scenarios=[
 {name:'순천 오전 자동식사',change:{}},
 {name:'나주 오후 식사제외·도시 간 이동 별도',change:{city:'나주',startTime:'14:00',mealPreference:'none',meals:[],interests:['nature','history']}},
 {name:'강진 정오 점심',change:{city:'강진',startTime:'12:00',mealPreference:'lunch',meals:['lunch'],interests:['nature','food']}},
 {name:'순천 저녁 자동식사',change:{startTime:'18:00',interests:['food','cafe','history']}},
 {name:'순천 3시간 종료 제한',change:{endTime:'13:00',mealPreference:'none',meals:[],interests:['nature','cafe']}},
 {name:'나주 8시간 종료 제한·도시 간 이동 별도',change:{city:'나주',endTime:'18:00',interests:['nature','history','food']}},
];
const selected=process.argv.find(x=>x.startsWith('--case='))?.slice(7);
let failed=false;
for(const [index,s] of scenarios.entries()){
 if(selected!==undefined && Number(selected)!==index)continue;
 const began=Date.now(),entry={name:s.name,passed:false};report.cases.push(entry);
 try{
  const preferences={...common,...s.change,...(process.argv.includes('--legacy-duration-probe')?{durationHours:6}:{})};const data=await send('/api/recommend',{preferences});
  assert.ok(['tour-api','kakao','mixed'].includes(data.source));
  const courses=data.courses.filter(c=>c.constraintPassed);entry.returned=data.courses.length;
  entry.actualKakaoRoutes=courses.filter(c=>c.routeSource==='kakao').length;
  entry.courses=courses.map(c=>({id:c.id,title:c.title,minutes:c.timeBreakdown?.totalMinutes,source:c.routeSource,places:c.places.map(p=>({name:p.name,category:p.category,arrival:p.arrival,stay:p.stayMinutes}))}));
  assert.ok(courses.length>0,'NO_PASSING_COURSE');
  assert.ok(entry.actualKakaoRoutes>0,'ACTUAL_KAKAO_ROUTING_UNAVAILABLE');
  for(const c of courses){
   const t=c.timeBreakdown;assert.ok(t&&t.totalMinutes>0);
   assert.equal(t.totalMinutes,t.originToFirstMinutes+t.betweenPlacesMinutes+t.stayMinutes+t.waitAndRestMinutes);
   assert.equal(c.routeSegments.length,c.places.length);
   if(preferences.endTime){const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));assert.ok(t.totalMinutes<=minutes(preferences.endTime)-minutes(preferences.startTime));}else assert.equal(t.requestedMinutes,undefined);
   if(preferences.mealPreference==='none')assert.ok(c.places.every(p=>p.category!=='food'));
   if(preferences.mealPreference==='lunch')assert.ok(c.places.some(p=>p.category==='food'));
   if(preferences.city!=='순천')assert.equal(c.accessTrip?.excludedFromBudget,true);
  }
  if(index===0){
   const original=courses.find(c=>c.places.some(p=>p.category==='food'))??courses[0];
   const stop=original.places.find(p=>p.category==='cafe')??original.places.find(p=>p.category!=='food');
   assert.ok(stop);assert.ok(original.places.length>1);
   const body={preferences,courseId:original.id,placeIds:[stop.id]};
   const edited=(await send('/api/recommend/edit',body)).course;
   assert.equal(edited.constraintPassed,true);assert.equal(edited.places.length,1);assert.equal(edited.places[0].id,stop.id);
   assert.ok(edited.timeBreakdown.totalMinutes<original.timeBreakdown.totalMinutes);
   assert.equal(edited.timeBreakdown.requestedMinutes,undefined);
   const refreshed=(await send('/api/recommend/refresh-route',body)).course;
   assert.equal(refreshed.constraintPassed,true);assert.equal(refreshed.places.length,1);
   entry.edit={beforeMinutes:original.timeBreakdown.totalMinutes,afterMinutes:edited.timeBreakdown.totalMinutes,source:edited.routeSource,remaining:stop.name,refreshPassed:true};
  }
  entry.passed=true;
 }catch(e){failed=true;entry.failure=e?.code==='ERR_ASSERTION'?String(e.message).slice(0,200):'REQUEST_FAILED';}
 entry.elapsedMs=Date.now()-began;console.log(JSON.stringify(entry));
}
report.passed=!failed;
await mkdir('.runtime/course-first',{recursive:true});
await writeFile(`.runtime/course-first/cloud${selected===undefined?'':'-'+selected}.json`,JSON.stringify(report,null,2));
await writeFile(`.runtime/course-first/cloud-${report.checkedAt.replace(/[:.]/g,'-')}.json`,JSON.stringify(report,null,2));
if(failed)process.exitCode=1;
