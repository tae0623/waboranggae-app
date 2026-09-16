import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
const team=parse(await readFile('.env.team.local'));
const request=JSON.parse(await readFile('.runtime/native-pilot/recommend-request.json','utf8'));
const response=await fetch('http://127.0.0.1:8788/api/recommend',{method:'POST',headers:{'Content-Type':'application/json','X-Dev-Access-Key':team.TEAM_ACCESS_KEY},body:JSON.stringify(request),signal:AbortSignal.timeout(140000)});
assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.source,'tour-api');assert.ok(payload.courses.length);
const rows=payload.courses.map(c=>{
  const b=c.walkingBreakdown;for(const n of Object.values(b))assert.ok(Number.isFinite(n)&&n>=0&&n<=100);
  const recalculated=Math.round(b.walk*.35+b.transit*.25+b.time*.15+b.transfer*.1+b.distance*.05+b.efficiency*.1);
  assert.equal(c.walkingScore,recalculated);
  const f=c.recommendationBreakdown;assert.equal(c.fitScore,Math.round(f.preference*.4+f.walking*.35+f.timeFit*.15+f.courseQuality*.1));
  return {id:c.id,title:c.title,walkingScore:c.walkingScore,parts:b,recalculated,fitScore:c.fitScore,finalParts:f};
});
await mkdir('.runtime/home-audit',{recursive:true});await writeFile('.runtime/home-audit/walking-scores.json',JSON.stringify({at:new Date().toISOString(),source:payload.source,rows},null,2));console.log(JSON.stringify({courses:rows.length,allMatch:true,example:rows[0]},null,2));
