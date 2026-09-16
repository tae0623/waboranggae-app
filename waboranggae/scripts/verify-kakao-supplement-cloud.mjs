import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL,base);
assert.ok(Date.parse(config.EXPIRES_AT)>Date.now());
const report={checkedAt:new Date().toISOString(),passed:false,deviceLocationUsed:false,checks:[]};
async function send(path,body,admitted=true){
  const began=Date.now();
  const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json',
    ...(admitted?{'X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(150000)});
  const data=await response.json();report.checks.push({path:path.split('?')[0],status:response.status,elapsedMs:Date.now()-began});
  return{status:response.status,data};
}
try{
  assert.equal((await send('/livez')).status,200);
  assert.equal((await send('/readyz')).status,200);
  assert.equal((await send('/api/recommend',{preferences:{}},false)).status,403);
  assert.equal((await send('/api/user/me')).status,401);
  const providers=await send('/auth/social/providers');assert.equal(providers.status,200);
  report.socialProviders=providers.data.providers?.map(p=>({id:p.id,enabled:p.enabled}));
  const preferences={region:'전라남도',city:'순천',timeBudgetMode:'local',
    startLocation:'순천종합버스터미널',startType:'terminal',startAddress:'전남 순천시 장천3길 13',
    startLatitude:34.9475959,startLongitude:127.4913557,
    travelDate:new Date(Date.now()+9*3600000).toISOString().slice(0,10),startTime:'10:00',endTime:'16:00',durationHours:6,
    mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','history'],companions:'혼자',
    lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'순천 터미널 출발 현지 6시간 검증',confidence:1};
  const result=await send('/api/recommend',{preferences});assert.equal(result.status,200);
  assert.ok(['mixed','kakao'].includes(result.data.source));
  const courses=result.data.courses.filter(c=>c.constraintPassed);assert.ok(courses.length>0);
  assert.ok(courses.some(c=>c.places.some(p=>p.dataSource==='kakao'&&p.category!=='food')));
  report.source=result.data.source;
  report.courses=courses.map(c=>({title:c.title,source:c.routeSource,passed:c.constraintPassed,
    minutes:c.timeBreakdown?.totalMinutes,places:c.places.map(p=>({name:p.name,category:p.category,source:p.dataSource,arrival:p.arrival}))}));
  for(const c of courses){
    assert.ok(c.origin.name.includes('터미널'));
    assert.ok(c.timeBreakdown.totalMinutes<=360);
    assert.ok(c.routeSegments.length>0);
    assert.ok(c.places.every(p=>['kakao','tour-api'].includes(p.dataSource)));
  }
  report.actualKakaoRoutes=courses.filter(c=>c.routeSource==='kakao').length;
  assert.ok(report.actualKakaoRoutes>0);
  report.kakaoRestaurantIncluded=courses.some(c=>c.places.some(p=>p.category==='food'&&p.dataSource==='kakao'));
  const photo=courses.flatMap(c=>c.places).find(p=>p.imageUrl);
  if(photo){
    const response=await fetch(base+'/api/media/tour-image?url='+encodeURIComponent(photo.imageUrl),{redirect:'error',
      headers:{'X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},signal:AbortSignal.timeout(25000)});
    assert.equal(response.status,200);assert.ok(response.headers.get('content-type')?.startsWith('image/'));await response.arrayBuffer();
    report.tourPhotoProxy=true;
  }
  report.passed=true;
}catch(error){report.failure=error?.name==='AssertionError'?'ASSERTION_FAILED':'CLOUD_REQUEST_FAILED';process.exitCode=1;}
await mkdir('.runtime/kakao-supplement',{recursive:true});
await writeFile('.runtime/kakao-supplement/cloud.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
