import {readFile} from 'node:fs/promises';
import {analysisCases,evaluateConditions,auditUnrequestedData} from './llm-comparison-cases.mjs';
import {parseTravelText} from '../src/domain/parseTravelText.ts';
import {normalizeTravelStart} from '../src/domain/startLocation.ts';
const report=JSON.parse(await readFile(process.argv[2],'utf8'));
for(const row of report.results)if(row.task==='analysis')row.inputIntegrityFlags=auditUnrequestedData(row.value,row.query);
const pct=(values,p)=>{const v=[...values].sort((a,b)=>a-b);return v.length?v[Math.ceil(v.length*p)-1]:null;};
const baseline=analysisCases.map(c=>({id:c.id,checks:evaluateConditions(normalizeTravelStart(parseTravelText(c.query)),c.expected)}));
const summary=report.models.map(model=>{
  const rows=report.results.filter(r=>r.model===model),scored=rows.filter(r=>r.rawChecks&&!['warm-repeat','concurrent-2'].includes(r.phase));
  const timing=task=>{const set=rows.filter(r=>r.task===task&&r.phase==='warm'&&r.schemaValid);return {count:set.length,medianMs:pct(set.map(r=>r.elapsedMs),.5),p95Ms:pct(set.map(r=>r.elapsedMs),.95),tokensPerSecondMedian:pct(set.map(r=>r.metrics?.tokensPerSecond).filter(Boolean),.5)};};
  return {model,requests:rows.length,jsonValid:rows.filter(r=>r.schemaValid).length,errors:rows.filter(r=>r.error).map(r=>({id:r.id,error:r.error})),scored:scored.length,rawCorrect:scored.filter(r=>r.rawPass).length,appCorrect:scored.filter(r=>r.effectivePass).length,ruleImproved:scored.filter(r=>!r.rawPass&&r.effectivePass).map(r=>r.id),ruleRegressed:scored.filter(r=>r.rawPass&&!r.effectivePass).map(r=>r.id),cold:rows.filter(r=>r.phase==='cold-attempt').map(r=>({ms:r.elapsedMs,loadMs:r.metrics?.loadMs,valid:r.schemaValid})),analysisTiming:timing('analysis'),explanationTiming:timing('explanation'),concurrent:rows.filter(r=>r.phase==='concurrent-2').map(r=>({ms:r.elapsedMs,valid:r.schemaValid,pass:r.effectivePass})),failures:scored.filter(r=>!r.rawPass||!r.effectivePass).map(r=>({id:r.id,raw:r.rawChecks.filter(c=>!c.pass),app:r.effectiveChecks.filter(c=>!c.pass)}))};
});
console.log(JSON.stringify({status:report.status,ruleBaseline:{passed:baseline.filter(r=>r.checks.every(c=>c.pass)).length,total:baseline.length,failures:baseline.filter(r=>r.checks.some(c=>!c.pass)).map(r=>({id:r.id,checks:r.checks.filter(c=>!c.pass)}))},summary,integrity:report.models.map(model=>({model,rows:report.results.filter(r=>r.model===model&&r.inputIntegrityFlags?.length).map(r=>({id:r.id,flags:r.inputIntegrityFlags}))}))},null,2));
if(process.argv.includes('--prose'))for(const r of report.results.filter(r=>r.task==='explanation'||r.kind==='exploratory'))console.log(JSON.stringify({model:r.model,id:r.id,query:r.query,value:r.value,flags:r.flags,raw:r.value?undefined:r.rawContent}));
