import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import { analysisCases,exploratoryCases,evaluateConditions,explanationFlags } from './llm-comparison-cases.mjs';

// Use exactly the application's configured prompt/validator and effective normalization.
// Only this benchmark process overrides the model. Never writes .env or sends secrets to an LLM.
const allowed=['OLLAMA_URL','OLLAMA_TIMEOUT_MS','OLLAMA_NUM_CTX','OLLAMA_KEEP_ALIVE'];
for(const file of ['.env','.env.team.local']){try{const env=parse(await readFile(file));for(const k of allowed)if(env[k])process.env[k]=env[k];}catch{}}
const origin=new URL(process.env.OLLAMA_URL||'http://127.0.0.1:11434');
if(!['127.0.0.1','localhost'].includes(origin.hostname)||origin.username||origin.password)throw new Error('Local Ollama only');
process.env.OLLAMA_ENABLED='true';
const cpu=process.argv.includes('--cpu');
const modelArg=process.argv.find(a=>a.startsWith('--models='));
const models=(modelArg?.slice(9)||'qwen3:8b,qwen3:4b').split(',');
if(models.some(m=>!/^qwen3:(8b|4b)$/.test(m)))throw new Error('Only the two explicitly requested comparison models are allowed.');
const limitArg=process.argv.find(a=>a.startsWith('--limit='));
const limit=limitArg?Math.max(1,Math.min(analysisCases.length,Number(limitArg.slice(8)))):analysisCases.length;
const quick=Boolean(limitArg);
const outputDir=`.runtime/llm-comparison/${new Date().toISOString().replace(/[:.]/g,'-')}${cpu?'-cpu':''}`;
await mkdir(outputDir,{recursive:true});
const originalFetch=globalThis.fetch;
const context=new AsyncLocalStorage();
const reports=[];
globalThis.fetch=async(input,init)=>{
  const row=context.getStore();const url=String(input);
  if(!row||url!==origin.href.replace(/\/$/,'')+'/api/chat')return originalFetch(input,init);
  const body=JSON.parse(init.body);body.model=row.model;if(cpu)body.options.num_gpu=0;
  row.request={think:body.think,options:body.options,format:body.format};
  row.userPrompt=body.messages.at(-1).content;
  row.promptHash=createHash('sha256').update(JSON.stringify(body.messages)).digest('hex');
  try{
    const response=await originalFetch(input,{...init,body:JSON.stringify(body)});
    row.httpStatus=response.status;
    const raw=await response.text();const payload=JSON.parse(raw);
    if(response.ok){
      row.rawContent=payload.message?.content??'';
      row.metrics={loadMs:Math.round((payload.load_duration??0)/1e6),promptMs:Math.round((payload.prompt_eval_duration??0)/1e6),evalMs:Math.round((payload.eval_duration??0)/1e6),promptTokens:payload.prompt_eval_count,outputTokens:payload.eval_count,doneReason:payload.done_reason};
      row.metrics.tokensPerSecond=payload.eval_duration?Math.round(payload.eval_count/(payload.eval_duration/1e9)*10)/10:0;
    } else row.error=/CUDA|0xc0000409/i.test(raw)?'CUDA initialization error':`HTTP ${response.status}`;
    return new Response(raw,{status:response.status,headers:{'Content-Type':'application/json'}});
  }catch(error){row.error=error?.name==='AbortError'?'timeout':'connection/read error';throw error;}
};
const {analyzeWithOllama,explainWithOllama,getOllamaRuntimeConfig}=await import('../server/src/modules/analysis/ollama.ts');
const {applyExplicitTravelSignals,parseTravelText}=await import('../src/domain/parseTravelText.ts');
const {normalizeTravelStart}=await import('../src/domain/startLocation.ts');
const requestFixture=JSON.parse(await readFile('.runtime/native-pilot/recommend-request.json','utf8'));
const courseFixture=JSON.parse(await readFile('.runtime/native-pilot/recommend-response.json','utf8'));
const courses=courseFixture.courses.filter(c=>c.constraintPassed).slice(0,3);
if(courses.length<1)throw new Error('A real TourAPI test fixture is required.');
const report={startedAt:new Date().toISOString(),status:'running',models,mode:cpu?'CPU requested (num_gpu:0)':'default GPU selection',runtime:getOllamaRuntimeConfig(),analysisCount:limit,exploratoryCount:quick?0:exploratoryCases.length,explanationRepetitions:quick?1:2,results:reports,limitations:['Fixed test prompts plus generated combinations and separately reviewed exploratory inputs; not a production reliability guarantee.','Production helper calls are used in a separate benchmark process, not through the live HTTP server.','Explanation flags are triage; human review is required.','Any fallback is counted separately and never counted as model success.']};
try{report.gpu=execFileSync('nvidia-smi',['--query-gpu=name,driver_version,memory.total,memory.used','--format=csv,noheader'],{encoding:'utf8',windowsHide:true}).trim();}catch{}
report.ollamaVersion=await (await originalFetch(new URL('/api/version',origin))).json();
const tags=await (await originalFetch(new URL('/api/tags',origin))).json();
report.installedModels=tags.models?.filter(m=>models.includes(m.name)).map(({name,size,digest,details})=>({name,size,digest,details}));
if(report.installedModels?.length!==models.length)throw new Error('Pull both models before running.');
async function save(){await writeFile(outputDir+'/results.json',JSON.stringify(report,null,2));}
async function memory(){try{return (await (await originalFetch(new URL('/api/ps',origin),{signal:AbortSignal.timeout(3000)})).json()).models?.map(({name,size,size_vram,context_length})=>({name,size,size_vram,context_length}));}catch{return null;}}
async function unload(model){try{await originalFetch(new URL('/api/generate',origin),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0}),signal:AbortSignal.timeout(20000)});}catch{}}
async function analysis(model,c,phase){
  const row={model,id:c.id,task:'analysis',kind:c.kind,phase,query:c.query,reviewFocus:c.reviewFocus};const start=performance.now();
  const value=await context.run(row,()=>analyzeWithOllama(c.query));
  row.elapsedMs=Math.round(performance.now()-start);row.schemaValid=value!==null;row.value=value;
  row.effective=normalizeTravelStart(value?applyExplicitTravelSignals(c.query,value):parseTravelText(c.query));
  if(c.expected){row.rawChecks=evaluateConditions(value,c.expected);row.effectiveChecks=evaluateConditions(row.effective,c.expected);row.rawPass=value!==null&&row.rawChecks.every(x=>x.pass);row.effectivePass=row.effectiveChecks.every(x=>x.pass);}
  row.loadedModels=await memory();reports.push(row);await save();console.log(JSON.stringify({model,id:row.id,ms:row.elapsedMs,valid:row.schemaValid,rawPass:row.rawPass,appPass:row.effectivePass,error:row.error}));return row;
}
async function explain(model,course,index,round){
  const row={model,id:`course-${index}-repeat-${round}`,task:'explanation',phase:'warm',courseId:course.id};const start=performance.now();
  const reason=await context.run(row,()=>explainWithOllama({preferences:requestFixture.preferences,course}));
  row.elapsedMs=Math.round(performance.now()-start);row.schemaValid=reason!==null;row.value=reason;row.flags=explanationFlags(reason,row.userPrompt);row.loadedModels=await memory();reports.push(row);await save();console.log(JSON.stringify({model,id:row.id,ms:row.elapsedMs,valid:row.schemaValid,flags:row.flags,error:row.error}));return row;
}
function pct(values,p){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(sorted.length*p)-1];}
try{
  await save();console.log('RESULTS '+outputDir+'/results.json');
  for(const model of models){
    for(const m of models)await unload(m);
    let infrastructureFailures=0;
    for(const [index,c] of analysisCases.slice(0,limit).entries()){
      const row=await analysis(model,c,index===0?'cold-attempt':'warm');
      infrastructureFailures=row.error?infrastructureFailures+1:0;
      if(infrastructureFailures>=3){report.limitations.push(`${model}: stopped after 3 consecutive infrastructure failures; remaining cases were NOT run.`);break;}
    }
    if(infrastructureFailures<3){
      if(!quick)for(const c of exploratoryCases)await analysis(model,c,'exploratory');
      for(let round=0;round<(quick?1:2);round++)for(const [index,course] of (quick?courses.slice(0,1):courses).entries())await explain(model,course,index,round);
      if(!quick){await analysis(model,{...analysisCases[0],id:'repeat-terminal'},'warm-repeat');await Promise.all(analysisCases.slice(0,2).map((c,i)=>analysis(model,{...c,id:`concurrent-${i}`},'concurrent-2')));}
    }
    await unload(model);
  }
  report.summary=models.map(model=>{
    const rows=reports.filter(r=>r.model===model),scored=rows.filter(r=>r.task==='analysis'&&!['exploratory','concurrent-2','warm-repeat'].includes(r.phase)),warm=rows.filter(r=>r.phase==='warm'&&r.schemaValid);
    return {model,requests:rows.length,validJson:rows.filter(r=>r.schemaValid).length,infrastructureErrors:rows.filter(r=>r.error).length,scoredAnalysis:scored.length,rawCorrect:scored.filter(r=>r.rawPass).length,appCorrect:scored.filter(r=>r.effectivePass).length,warmMedianMs:pct(warm.map(r=>r.elapsedMs),.5),warmP95Ms:pct(warm.map(r=>r.elapsedMs),.95),explanationValid:rows.filter(r=>r.task==='explanation'&&r.schemaValid).length,explanationFlagged:rows.filter(r=>r.task==='explanation'&&r.flags.length).length};
  });
  report.status='complete';report.finishedAt=new Date().toISOString();await save();console.log(JSON.stringify(report.summary,null,2));
}finally{globalThis.fetch=originalFetch;await save();}
