import assert from 'node:assert/strict';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{parse}from'dotenv';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(config.API_BASE_URL!==base||config.VALIDATION_SCOPE!=='account-test')throw Error('TARGET_MISMATCH');
const report={checkedAt:new Date().toISOString(),passed:false,realSocialIdentityTested:false,checks:[]};
async function send(path,method='GET',body,admitted=true){
  const began=Date.now();const r=await fetch(base+path,{method,redirect:'error',headers:{'Content-Type':'application/json',...(admitted?{'X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(130000)});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={};}
  report.checks.push({path:path.split('?')[0],method,status:r.status,ms:Date.now()-began});return{status:r.status,data};
}
try{
  assert.equal((await send('/auth/social/providers','GET',undefined,false)).status,403);
  assert.equal((await send('/api/user/me')).status,401);
  const providers=await send('/auth/social/providers');assert.equal(providers.status,200);
  report.providers=providers.data.providers;assert.ok(report.providers.every(p=>p.enabled));
  for(const provider of ['kakao','google']){
    const started=await send('/auth/social/'+provider+'/start','POST',{});assert.equal(started.status,200);
    const flow=started.data;const auth=new URL(flow.authorizationUrl);
    assert.equal(auth.hostname,provider==='kakao'?'kauth.kakao.com':'accounts.google.com');
    assert.equal(auth.searchParams.get('redirect_uri'),base+'/auth/social/'+provider+'/callback');
    const polling={flowId:flow.flowId,pollSecret:flow.pollSecret};
    assert.equal((await send('/auth/social/result','POST',polling)).data.status,'pending');
    assert.equal((await send('/auth/social/result','POST',{...polling,pollSecret:'0'.repeat(64)})).status,400);
    // Simulated cancellation only: no provider identity/real account is authorized or created.
    assert.equal((await send('/auth/social/'+provider+'/callback?state='+flow.flowId+'&error=access_denied','GET',undefined,false)).status,400);
    assert.equal((await send('/auth/social/result','POST',polling)).status,400);
  }
  const date=new Date(Date.now()+9*3600_000+86400_000).toISOString().slice(0,10);
  const weather=await send('/api/weather/forecast?lat=34.95&lng=127.49&date='+date+'&startTime=10:00&endTime=16:00');
  report.forecast=weather.data;assert.equal(weather.status,200);assert.equal(weather.data.requestedDate,date);assert.equal(weather.data.available,true);
  const future=await send('/api/weather/forecast?lat=34.95&lng=127.49&date=2099-01-01');assert.equal(future.data.available,false);assert.equal(future.data.code,'NOT_PUBLISHED');
  const preferences={region:'전라남도',city:'순천',startLocation:'순천 터미널',startType:'terminal',travelDate:date,startTime:'10:00',durationHours:6,mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'친구',lowMobility:false,publicTransportOnly:true,summary:'순천 터미널 출발 6시간 여행',confidence:1};
  const recommendation=await send('/api/recommend','POST',{preferences});assert.equal(recommendation.status,200);assert.equal(recommendation.data.source,'tour-api');
  const original=recommendation.data.courses[0];assert.ok(original);
  const routed=await send('/api/recommend/refresh-route','POST',{preferences,courseId:original.id,placeIds:original.places.map(p=>p.id)});assert.equal(routed.status,200);
  const c=routed.data.course;assert.ok(['kakao','mixed'].includes(c.routeSource));
  assert.equal(c.walkMinutes,c.routeSegments.reduce((s,x)=>s+x.walkMinutes,0));assert.equal(c.transitMinutes,c.routeSegments.reduce((s,x)=>s+x.transitMinutes,0));
  assert.ok(c.origin.name.includes('터미널'));
  report.route={source:c.routeSource,beforeWalk:original.walkMinutes,afterWalk:c.walkMinutes,beforeTransit:original.transitMinutes,afterTransit:c.transitMinutes,durationHours:c.durationHours,constraintPassed:c.constraintPassed,constraintViolations:c.constraintViolations,segments:c.routeSegments.map(s=>({from:s.fromName,to:s.toName,source:s.source,minutes:s.totalMinutes})),arrivals:c.places.map(p=>({name:p.name,arrival:p.arrival,stayMinutes:p.stayMinutes}))};
  report.passed=true;
}catch(error){report.failure=error?.name==='AssertionError'?error.message:'CLOUD_CHECK_FAILED';process.exitCode=1;}
await mkdir('.runtime/phone-account-test',{recursive:true});await writeFile('.runtime/phone-account-test/cloud-readiness.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
