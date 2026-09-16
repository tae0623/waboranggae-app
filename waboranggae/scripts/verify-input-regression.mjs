import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
import {applyExplicitTravelSignals,parseTravelText} from '../src/domain/parseTravelText.ts';
import {travelInputIssues} from '../src/domain/travelInput.ts';
import {travelPreferencesSchema} from '../server/src/shared/schemas.ts';
import {analysisCases,evaluateConditions} from './llm-comparison-cases.mjs';
const original=JSON.parse(await readFile('.runtime/llm-comparison/2026-09-14T22-43-00-993Z/results.json','utf8'));
const replay=original.models.map(model=>{
  const rows=analysisCases.map(c=>{const old=original.results.find(r=>r.model===model&&r.id===c.id);const p=applyExplicitTravelSignals(c.query,old.value);const checks=evaluateConditions(p,c.expected);const valid=travelPreferencesSchema.safeParse(p).success;return {id:c.id,pass:valid&&checks.every(c=>c.pass),failures:checks.filter(c=>!c.pass),valid};});
  assert.ok(rows.every(x=>x.pass));return {model,total:rows.length,passed:rows.filter(x=>x.pass).length};
});
const team=parse(await readFile('.env.team.local'));const headers={'Content-Type':'application/json','X-Dev-Access-Key':team.TEAM_ACCESS_KEY};
const cases=[
  {query:'보성 터미널에서 1시간 카페만, 식사는 안 해.',expected:{city:'보성',durationHours:1,mealPreference:'none',interests:['cafe'],absentInterests:['food','nature']}},
  {query:'신안 압해선착장 오후 1시 출발 3시간 바다 사진',expected:{city:'신안',startType:'custom',startTime:'13:00',durationHours:3,interests:['nature','photo']}},
  {query:'장흥 터미널 1.5시간 카페, 밥은 빼줘',expected:{city:'장흥',durationHours:1.5,mealPreference:'none'}},
  {query:'이번 주말 토요일 여수 6시간 바다',expected:{city:'여수',travelDate:parseTravelText('이번 주말 토요일 여수 6시간 바다').travelDate}},
  {query:'목포역 자연은 빼고 2시간 카페만. 식사 제외.',expected:{city:'목포',interests:['cafe'],absentInterests:['nature','food']}},
  {query:'2026년 10월 3일 22:00부터 다음 날 02:00까지 목포역 역사 여행',expected:{travelDate:'2026-10-03',travelEndDate:'2026-10-04',durationHours:4,startTime:'22:00'}},
  {query:'서울역 5시간 여행',status:400},{query:'2026년 2월 30일 순천 3시간',status:400},{query:'순천 0시간',status:400},
];
const live=[];
for(const c of cases){const start=performance.now();const r=await fetch('http://127.0.0.1:8788/api/analyze',{method:'POST',headers,body:JSON.stringify({query:c.query}),signal:AbortSignal.timeout(100000)});const data=await r.json();const ms=Math.round(performance.now()-start);assert.equal(r.status,c.status??200);if(c.expected){assert.deepEqual(evaluateConditions(data.preferences,c.expected).filter(c=>!c.pass),[]);assert.ok(!('startLatitude' in data.preferences));assert.ok(!('lodgingLatitude' in data.preferences));travelPreferencesSchema.parse(data.preferences);}const row={query:c.query,status:r.status,source:data.source,ms,preferences:data.preferences,error:data.error};live.push(row);console.log(JSON.stringify({query:c.query,status:r.status,source:data.source,ms}));}
const result={at:new Date().toISOString(),note:'Stored old-model replay is NOT a fresh model-quality benchmark. Live rows use the actual current HTTP API.',replay,live};
await mkdir('.runtime/input-regression',{recursive:true});await writeFile('.runtime/input-regression/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({replay,liveCount:live.length,passed:true}));
