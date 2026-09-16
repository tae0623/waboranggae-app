import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const args=process.argv.slice(2);const arg=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const query=arg('--query');if(!query)throw Error('Explicit --query required');
const config=parse(await readFile('.env.device-validation.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(config.API_BASE_URL!==base||Date.parse(config.EXPIRES_AT)<=Date.now())throw Error('VALIDATION_CONFIG_UNAVAILABLE');
async function send(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',headers:{'Content-Type':'application/json','X-Dev-Access-Key':config.DEVICE_VALIDATION_TOKEN},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(140000)});if(!r.ok)throw Error('API_STATUS_'+r.status);return r.json();}
const places=(await send('/api/places/search?q='+encodeURIComponent(query))).places;
if(!places.length)throw Error('NO_SEARCH_RESULT');
const start=places[0],hours=Number(arg('--hours','8')),city=arg('--city','나주');
const date=arg('--date',new Date(Date.now()+9*3600000).toISOString().slice(0,10));
const preferences={region:'전라남도',city,startLocation:start.name,startAddress:start.address,startLatitude:start.latitude,startLongitude:start.longitude,startType:'custom',travelDate:date,startTime:'10:00',endTime:String(10+hours).padStart(2,'0')+':00',durationHours:hours,mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'출발지부터 여행',confidence:1};
const rec=await send('/api/recommend',{preferences});
const pick=(c)=>({id:c.id,title:c.title,durationHours:c.durationHours,walkMinutes:c.walkMinutes,transitMinutes:c.transitMinutes,passed:c.constraintPassed,violations:c.constraintViolations,scoreFacts:c.scoreFacts,timeBreakdown:c.timeBreakdown,places:c.places.map(p=>({name:p.name,category:p.category,arrival:p.arrival,stay:p.stayMinutes,move:p.moveMinutes})),segments:c.routeSegments?.map((s,i)=>({from:i===0?'selected-origin':s.fromName,to:s.toName,total:s.totalMinutes,walk:s.walkMinutes,transit:s.transitMinutes,source:s.source}))});
const report={checkedAt:new Date().toISOString(),city,hours,searchResults:places.length,originSource:start.source,source:rec.source,before:rec.courses.map(pick),after:[]};
const count=Math.min(2,Math.max(1,Number(arg('--count','1'))));
for(const c of rec.courses.slice(0,count)){const result=await send('/api/recommend/refresh-route',{preferences,courseId:c.id,placeIds:c.places.map(p=>p.id)});report.after.push(pick(result.course));}
await mkdir('.runtime/route-refresh',{recursive:true});
await writeFile('.runtime/route-refresh/latest.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
