import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
assert.equal(config.API_BASE_URL,base);assert.equal(config.VALIDATION_SCOPE,'account-test');
const report={checkedAt:new Date().toISOString(),checks:[],passed:false,deviceLocationUsed:false};
async function send(path,body){
 const started=Date.now();
 const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(145000)});
 const data=await r.json();report.checks.push({path:path.split('?')[0],status:r.status,elapsedMs:Date.now()-started});return{status:r.status,data};
}
try{
 const home=await send('/api/hot-places');assert.equal(home.status,200);
 const places=home.data.places.filter(p=>/^\d{1,20}$/.test(p.id.replace(/^festival-/,'')));
 if(process.argv.includes('--list')){
  console.log(JSON.stringify(places.map(p=>({id:p.id,name:p.name,city:p.city,source:p.source,from:p.eventStartDate,to:p.eventEndDate})),null,2));
 }else{
  const chosenId=process.argv.find(a=>a.startsWith('--id='))?.slice(5);
  const place=places.find(p=>p.id===chosenId)||places.find(p=>p.source!=='festival'&&p.category!=='축제·행사');assert.ok(place);
  const start=await send('/api/places/search?q='+encodeURIComponent(place.city+' 버스터미널'));assert.equal(start.status,200);
  const departure=start.data.places.find(p=>p.address.includes(place.city)&&/터미널/.test(p.name));assert.ok(departure);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
  const from=place.eventStartDate?.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  const date=from&&from>today?from:today;
  const preferences={requiredContentId:place.id.replace(/^festival-/,''),requiredPlaceName:place.name.slice(0,160),timeBudgetMode:'local',region:'전라남도',city:place.city,startLocation:departure.name,startAddress:departure.address,startLatitude:departure.latitude,startLongitude:departure.longitude,startType:'terminal',travelDate:date,travelEndDate:date,startTime:'09:00',endTime:'17:00',durationHours:8,mealPreference:'auto',pace:'balanced',interests:['nature','history','cafe'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus','train'],summary:place.city+' 필수 방문지 검증',confidence:1};
  const result=await send('/api/recommend',{preferences});if(result.data.code==='REQUIRED_VISIT')report.validationMessage=result.data.error;assert.equal(result.status,200);
  const courses=result.data.courses.filter(c=>c.constraintPassed);
  report.venue={id:place.id,name:place.name,city:place.city,travelDate:date};report.source=result.data.source;report.passingCourses=courses.length;
  report.allPassingCoursesContainSelected=courses.length>0&&courses.every(c=>c.places.some(p=>p.id==='tour-'+preferences.requiredContentId));
  report.courses=courses.map(c=>({title:c.title,selectedIncluded:c.places.some(p=>p.id==='tour-'+preferences.requiredContentId),routeSource:c.routeSource}));
  if(!courses.length)report.noFitReason=result.data.fallbackReason;
  assert.equal(result.data.source,'tour-api');
  const expectNoFit=process.argv.includes('--expect-no-fit');
  report.expectedOutcome=expectNoFit?'explicit-no-fit':'selected-venue-in-every-passing-course';
  if(expectNoFit){assert.equal(courses.length,0);assert.ok(report.noFitReason?.includes('선택한 장소'));}else assert.equal(report.allPassingCoursesContainSelected,true);
  if(place.source==='festival'||place.category==='축제·행사'){
   const end=place.eventEndDate.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
   const outside=new Date(Date.parse(end+'T00:00:00Z')+86400000).toISOString().slice(0,10);
   const wrong=await send('/api/recommend',{preferences:{...preferences,travelDate:outside,travelEndDate:outside}});
   assert.equal(wrong.status,422);assert.equal(wrong.data.code,'REQUIRED_VISIT');report.outOfPeriodRejected=true;
  }
  const unauth=await fetch(base+'/api/hot-places',{redirect:'error',signal:AbortSignal.timeout(15000)});report.privateGateStatus=unauth.status;assert.equal(unauth.status,403);
  report.passed=true;
 }
}catch(e){report.failure=e.name==='AssertionError'?'ASSERTION_FAILED':'REQUEST_FAILED';process.exitCode=1;}
if(!process.argv.includes('--list')){
 await mkdir('.runtime/required-visit',{recursive:true});
 await writeFile('.runtime/required-visit/cloud-'+(report.venue?.id||'failed')+'.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}
