import {readFile} from 'node:fs/promises';
import {parse} from 'dotenv';
async function main(){
 const env=parse(await readFile('.env.edge.local'));
 for(const name of ['DATA_GO_KR_KEY','TOUR_API_BASE_URL'])if(env[name])process.env[name]=env[name];
 const base=process.env.TOUR_API_BASE_URL||'https://apis.data.go.kr/B551011/KorService2';
 if(!base.startsWith('https://apis.data.go.kr/'))throw Error('UNEXPECTED_PROVIDER');
 const original=globalThis.fetch;
 const requests:Array<{operation:string;items:number;status:number}>=[];
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input));if(u.origin!=='https://apis.data.go.kr')throw Error('UNEXPECTED_DESTINATION');
  const res=await original(input,init);const body=await res.clone().json().catch(()=>({}));
  const item=body.response?.body?.items?.item;
  requests.push({operation:u.pathname.split('/').at(-1)!,items:Array.isArray(item)?item.length:item?1:0,status:res.status});return res;
 };
 console.warn=()=>{}; // Provider diagnostics must not expose keys or full request URLs.
 const {TourApiProvider}=await import('../server/src/modules/recommendation/data/tour-api');
 const {mergePlannedCourses,collectPlanningCandidates}=await import('../server/src/modules/recommendation/planner');
 for(const hours of [6,8]){
  const p={region:'전라남도',city:'나주',timeBudgetMode:'local',startLocation:'나주버스터미널',startType:'terminal',travelDate:'2026-09-16',startTime:'10:00',endTime:hours===6?'16:00':'18:00',durationHours:hours,mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['nature','food','cafe'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:'검증',confidence:1} as import('../src/types/travel').TravelPreferences;
  const raw=await new TourApiProvider().fetchCourses(p),candidates=collectPlanningCandidates(raw,p),planned=mergePlannedCourses(p,raw,null);
  console.log(JSON.stringify({hours,raw:raw.length,planned:planned.length,candidates:candidates.map(c=>({name:c.name,category:c.category})),requests}));
 }
}
main().catch(()=>{console.error('LOCAL_DIAGNOSIS_FAILED');process.exitCode=1});
