import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import express from 'express';
import { fetchKakaoCandidates } from '../server/src/modules/recommendation/data/kakao-candidates';
import { TourApiProvider } from '../server/src/modules/recommendation/data/tour-api';
import { kakaoStatus } from '../server/src/modules/recommendation/data/kakao';
import { collectPlanningCandidates, mergePlannedCourses } from '../server/src/modules/recommendation/planner';
import { courseDataSource } from '../src/domain/courseDataSource';
import { recommendationRouter } from '../server/src/modules/recommendation/routes';
import { parseTravelText } from '../src/domain/demoEngine';
import type { TravelPreferences } from '../src/types/travel';

async function main() {
  const status=kakaoStatus();
  if(!status.restKeyConfigured || !status.freeTierConfirmed) throw Error('KAKAO_CONFIGURATION_REQUIRED');
  const results=[];
  for(const city of ['나주','순천','강진']) {
    const preferences:TravelPreferences={...parseTravelText(`${city} 자연 맛집 6시간`),city,
      startTime:'10:00',endTime:'16:00',durationHours:6,mealPreference:'auto',interests:['nature','food','history'],
      timeBudgetMode:'local',travelDate:new Date(Date.now()+9*3600000).toISOString().slice(0,10)};
    const began=Date.now();
    const supplement=await fetchKakaoCandidates(preferences);
    const courses=await new TourApiProvider().fetchCourses(preferences);
    const pool=collectPlanningCandidates(courses,preferences);
    const planned=mergePlannedCourses(preferences,courses,null);
    const result={city,elapsedMs:Date.now()-began,supplement:{attractions:supplement.filter(p=>p.category!=='food').length,
      food:supplement.filter(p=>p.category==='food').length,sample:supplement.slice(0,4).map(p=>({name:p.name,category:p.category})),
      foodSample:supplement.filter(p=>p.category==='food').slice(0,4).map(p=>p.name)},
      pool:{total:pool.length,kakao:pool.filter(p=>p.dataSource==='kakao').length,tour:pool.filter(p=>p.dataSource==='tour-api').length},
      plans:planned.map(c=>({source:courseDataSource([c]),places:c.places.map(p=>({id:p.id,name:p.name,category:p.category,source:p.dataSource}))}))};
    results.push(result);console.log(JSON.stringify({...result,plans:result.plans.slice(0,2),planCount:result.plans.length}));
  }
  let recommendation:unknown;
  if(process.argv.includes('--recommend')) {
    // Loopback-only test instance, public terminal coordinates, no phone GPS or account required.
    const app=express();app.use(express.json());app.use('/api',recommendationRouter);
    app.use((_error:unknown,_request:express.Request,response:express.Response,_next:express.NextFunction)=>response.status(500).json({error:'RECOMMEND_TEST_FAILED'}));
    const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
    try {
      const address=server.address();if(!address||typeof address==='string')throw Error('TEST_SERVER_UNAVAILABLE');
      const preferences:TravelPreferences={...parseTravelText('순천 자연 맛집 6시간'),city:'순천',timeBudgetMode:'local',
        startLocation:'순천종합버스터미널',startType:'terminal',startAddress:'전남 순천시 장천3길 13',
        startLatitude:34.9475959,startLongitude:127.4913557,travelDate:new Date(Date.now()+9*3600000).toISOString().slice(0,10),
        startTime:'10:00',endTime:'16:00',durationHours:6,mealPreference:'auto',interests:['nature','food','history']};
      const began=Date.now();
      const response=await fetch(`http://127.0.0.1:${address.port}/api/recommend`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences}),signal:AbortSignal.timeout(180000)});
      if(!response.ok)throw Error('RECOMMEND_HTTP_'+response.status);
      const payload=await response.json();
      recommendation={elapsedMs:Date.now()-began,source:payload.source,courses:payload.courses.map((c:any)=>({
        title:c.title,passed:c.constraintPassed,violations:c.constraintViolations,minutes:c.timeBreakdown?.totalMinutes,
        routeSource:c.routeSource,places:c.places.map((p:any)=>({name:p.name,category:p.category,source:p.dataSource,arrival:p.arrival}))}))};
      console.log(JSON.stringify({recommendation}));
    } finally {server.closeAllConnections();server.close();}
  }
  await mkdir('.runtime/kakao-supplement',{recursive:true});
  await writeFile('.runtime/kakao-supplement/latest.json',JSON.stringify({checkedAt:new Date().toISOString(),results,recommendation},null,2));
  if(results.some(result=>result.supplement.attractions===0||result.supplement.food===0||result.pool.kakao===0))throw Error('SUPPLEMENT_EMPTY_IN_A_TEST_CITY');
}
main().catch(error=>{console.error(/^[A-Z_0-9]+$/.test(error?.message||'')?error.message:'SUPPLEMENT_CHECK_FAILED');process.exitCode=1;});
