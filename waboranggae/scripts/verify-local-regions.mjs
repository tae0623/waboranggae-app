import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const args=process.argv.slice(2),arg=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
const query=arg('--query');if(!query)throw Error('EXPLICIT_PUBLIC_DEPARTURE_REQUIRED');
const cities=arg('--cities','목포,여수,담양').split(',').slice(0,4);
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(config.API_BASE_URL!==base||Date.parse(config.EXPIRES_AT)<=Date.now())throw Error('VALIDATION_CONFIG_UNAVAILABLE');
async function send(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(140000)});if(!r.ok)throw Error('API_STATUS_'+r.status);return r.json();}
async function main(){
 const places=(await send('/api/places/search?q='+encodeURIComponent(query))).places;
 const start=places[0];if(!start)throw Error('NO_DEPARTURE');
 const results=[];
 for(const city of cities){
  const began=Date.now();
  try{
   const hours=Number(arg('--hours','6'));
   const preferences={timeBudgetMode:'local',region:'전라남도',city,startLocation:start.name,startAddress:start.address,startLatitude:start.latitude,startLongitude:start.longitude,startType:'custom',travelDate:new Date(Date.now()+9*3600000).toISOString().slice(0,10),startTime:'10:00',endTime:String(10+hours).padStart(2,'0')+':00',durationHours:hours,mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'현지 여행 검증',confidence:1};
   const data=await send('/api/recommend',{preferences});
   const result={city,elapsedMs:Date.now()-began,source:data.source,courses:data.courses.map(c=>({title:c.title,mode:c.timeBudgetMode,passed:c.constraintPassed,violations:c.constraintViolations,localMinutes:c.timeBreakdown?.totalMinutes,requestedMinutes:c.timeBreakdown?.requestedMinutes,arrivalHub:c.origin?.name,accessMinutes:c.accessTrip?.segment?.totalMinutes??null,accessExcluded:c.accessTrip?.excludedFromBudget,source:c.routeSource,places:c.places.map(p=>({name:p.name,category:p.category,arrival:p.arrival,stay:p.stayMinutes})),segments:c.routeSegments?.map(s=>({source:s.source,minutes:s.totalMinutes}))}))};
   results.push(result);console.log(JSON.stringify(result));
  }catch(e){const result={city,error:/^[A-Z_0-9]+$/.test(e.message)?e.message:'CHECK_FAILED'};results.push(result);console.log(JSON.stringify(result));}
 }
 const hot=await send('/api/hot-places');const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10).replaceAll('-','');
 const events=(hot.places??[]).filter(p=>p.source==='festival'||p.category==='축제·행사').map(p=>({name:p.name,start:p.eventStartDate,end:p.eventEndDate,valid:!!p.eventEndDate && p.eventEndDate.replaceAll('-','')>=today}));
 const report={checkedAt:new Date().toISOString(),results,homeEvents:events};
 await mkdir('.runtime/local-regions',{recursive:true});await writeFile('.runtime/local-regions/latest.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({homeEventCheck:events,allPassed:results.every(r=>r.courses?.some(c=>c.passed&&c.accessExcluded&&c.mode==='local'))}));
}
main().catch(e=>{console.error(/^[A-Z_0-9]+$/.test(e.message)?e.message:'CHECK_FAILED');process.exitCode=1});
