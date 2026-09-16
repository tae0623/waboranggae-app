import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'dotenv';
import assert from 'node:assert/strict';
const project = new URL('../../', import.meta.url);
const team = parse(await readFile(new URL('.env.team.local', project)));
const state = JSON.parse(await readFile(new URL('.runtime/team-processes.json', project), 'utf8'));
const base = state.url;
const headers = {'Content-Type':'application/json','X-Dev-Access-Key':team.TEAM_ACCESS_KEY};
async function api(path, body) {
  const r = await fetch(base+path, {method:body?'POST':'GET', headers, body:body?JSON.stringify(body):undefined, signal:AbortSignal.timeout(135000), redirect:'error'});
  assert.equal(r.status,200, 'API status for '+path);
  return r.json();
}
const cities = await api('/api/regions/jeonnam-cities');
const places = await api('/api/places/search?q='+encodeURIComponent('순천 종합버스터미널'));
const start = places.places.find(p=>/터미널/.test(p.name)); assert.ok(start);
const preferences={region:'전라남도',city:'순천',startLocation:start.name,startType:'terminal',startAddress:start.address,startLatitude:start.latitude,startLongitude:start.longitude,travelDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),startTime:'10:00',endTime:'16:00',durationHours:6,mealPreference:'auto',pace:'balanced',preferLocal:false,interests:['cafe','food','nature'],companions:'혼자',lowMobility:false,publicTransportOnly:true,preferredTransit:['bus'],summary:`순천 ${start.name} 출발 6시간 대중교통·도보 여행`,confidence:1};
const started=Date.now(); const result = await api('/api/recommend',{preferences});
assert.equal(result.source,'tour-api'); assert.ok(result.courses.length>1);
for(const c of result.courses) {
  assert.equal(c.constraintPassed,true);
  assert.ok(Math.abs(c.origin.latitude-start.latitude)<.002 && Math.abs(c.origin.longitude-start.longitude)<.002);
}
const out = new URL('.runtime/native-pilot/', project); await mkdir(out,{recursive:true});
await writeFile(new URL('recommend-response.json',out),JSON.stringify(result,null,2));
await writeFile(new URL('recommend-request.json',out),JSON.stringify({preferences},null,2));
const report={checkedAt:new Date().toISOString(),apiOrigin:base,cityCount:cities.cities.length,departure:start.name,source:result.source,count:result.courses.length,elapsedMs:Date.now()-started,courses:result.courses.map(c=>({id:c.id,title:c.title,origin:c.origin.name,hours:c.durationHours,walkMinutes:c.walkMinutes,transitMinutes:c.transitMinutes,routeSource:c.routeSource,places:c.places.length}))};
await writeFile(new URL('api-smoke.json',out),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
