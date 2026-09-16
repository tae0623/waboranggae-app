import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {parse} from 'dotenv';
const config=parse(await readFile('.env.edge.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(config.PUBLIC_APP_URL!==base||config.EDGE_VALIDATION_MODE!=='true')throw Error('VALIDATION_TARGET_MISMATCH');
const report={checkedAt:new Date().toISOString(),passed:false,checks:[]};
async function send(route,method='GET',body,token){
  const start=Date.now();
  const res=await fetch(base+route,{method,redirect:'error',headers:{'Content-Type':'application/json','X-Waboranggae-Validation':config.EDGE_VALIDATION_KEY,
    ...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)});
  const data=await res.json();
  report.checks.push({route,method,status:res.status,ms:Date.now()-start});
  if(res.status>=500&&data.code)console.error(JSON.stringify({startupCode:data.code,detail:data.detail}));
  return{status:res.status,body:data};
}
let token;
try{
  assert.equal((await send('/livez')).status,200,'Cloud startup');
  assert.equal((await send('/readyz')).status,200,'Cloud DB readiness');
  assert.equal((await fetch(base+'/auth/social/providers',{redirect:'error'})).status,403,'Public validation gate');
  const legal=(await send('/legal/config')).body;
  const email='edge-cloud-test-'+randomBytes(12).toString('hex')+'@example.invalid',password=randomBytes(24).toString('hex')+'!A1';
  const created=await send('/auth/signup','POST',{email,password,displayName:'클라우드 검증 계정',privacyConsent:true,consentVersion:legal.version});
  assert.equal(created.status,201,'Cloud signup');token=created.body.accessToken;
  assert.equal((await send('/auth/login','POST',{email,password})).status,200,'Cloud bcrypt login');
  const me=await send('/api/user/me','GET',undefined,token);assert.equal(me.status,200);assert.equal(me.body.password,undefined);
  assert.equal((await send('/api/user/bookmarks/add','POST',{courseId:'cloud-validation',courseName:'검증 코스',city:'순천'},token)).status,201);
  const saved=await send('/api/user/bookmarks','GET',undefined,token);assert.ok(saved.body.some(x=>x.courseId==='cloud-validation'));
  assert.equal((await send('/api/user/me','DELETE',undefined,token)).status,200,'Synthetic account cleanup');
  assert.equal((await send('/api/user/me','GET',undefined,token)).status,401,'Deleted token revoked');token=undefined;
  const preferences={region:'전라남도',city:'순천',startLocation:'순천 터미널',startType:'terminal',travelDate:null,startTime:'10:00',durationHours:6,
    mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'친구',lowMobility:false,publicTransportOnly:true,
    summary:'순천 터미널 출발 6시간 자연·맛집·카페 여행',confidence:1};
  const result=await send('/api/recommend','POST',{preferences});
  assert.equal(result.status,200,'Live TourAPI recommendation');assert.equal(result.body.source,'tour-api');assert.ok(result.body.courses?.length);
  assert.equal(new Set(result.body.courses.map(c=>c.title)).size,result.body.courses.length);
  for(const c of result.body.courses){assert.ok(c.origin?.name.includes('터미널'));assert.equal(c.routeSource,'estimated');}
  report.recommendation={source:result.body.source,courses:result.body.courses.map(c=>({title:c.title,durationHours:c.durationHours,origin:c.origin.name}))};
  const course=result.body.courses[0],place=course.places.find(p=>p.imageUrl&&Number.isFinite(p.latitude));
  assert.ok(place,'Real tourism photo');
  const image=await fetch(base+'/api/media/tour-image?url='+encodeURIComponent(place.imageUrl),{redirect:'error',headers:{'X-Waboranggae-Validation':config.EDGE_VALIDATION_KEY},signal:AbortSignal.timeout(25000)});
  assert.equal(image.status,200);assert.ok(image.headers.get('Content-Type')?.startsWith('image/'));await image.arrayBuffer();report.image=true;
  const route=await send('/api/routes/segment','POST',{from:course.origin,to:{name:place.name,latitude:place.latitude,longitude:place.longitude},mode:'transit'});
  assert.equal(route.status,200);assert.ok(route.body.externalUrl.startsWith('https://map.kakao.com/link/by/traffic/'));
  report.directions={kakaoLink:true,actualRoute:Boolean(route.body.segment)};
  report.passed=true;
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{
  if(token){try{report.cleanup=(await send('/api/user/me','DELETE',undefined,token)).status===200;}catch{report.cleanup=false;}}
  await mkdir('.runtime',{recursive:true});await writeFile('.runtime/edge-cloud-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}
