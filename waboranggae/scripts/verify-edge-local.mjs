import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const local=parse(await readFile(path.join(root,'.env.team.local')));
const env={...process.env, NODE_ENV:'test', DATABASE_URL:local.DATABASE_URL,
  JWT_SECRET:randomBytes(32).toString('hex'), JWT_REFRESH_SECRET:randomBytes(32).toString('hex'),
  TEAM_DEV_MODE:'false', TEAM_ACCESS_KEY:'', DEV_ACCESS_KEY:'', EXPO_PUBLIC_DEV_ACCESS_KEY:'',
  OLLAMA_ENABLED:'false', ALLOW_DEMO_COURSE_FALLBACK:'false', API_RUNTIME:'supabase-edge',
  EDGE_VALIDATION_MODE:'true', EDGE_VALIDATION_KEY:randomBytes(32).toString('hex'),
  PUBLIC_APP_URL:'https://abcdefghijklmnopqrst.supabase.co/functions/v1/waboranggae-api'};
const child=spawn(path.join(root,'.tools/edge/deno.exe'),['run','--allow-env','--allow-read','--allow-sys',
  '--allow-net=127.0.0.1:55432,127.0.0.1:8789','deployment/edge/local-entry.ts'],
  {cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let diagnostic='';
child.stdout.on('data',b=>{diagnostic+=b.toString().slice(0,16000);});
child.stderr.on('data',b=>{diagnostic+=b.toString().slice(0,16000);});
const base='http://127.0.0.1:8789/functions/v1/waboranggae-api';
async function send(route,method='GET',body,token) {
  const started=performance.now();
  const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Waboranggae-Validation':env.EDGE_VALIDATION_KEY,...(token?{Authorization:'Bearer '+token}:{})},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const data=await res.json();return{status:res.status,body:data,ms:Math.round(performance.now()-started)};
}
let token;
try {
  let alive=false;
  for(let i=0;i<40;i++){
    if(child.exitCode!==null)throw new Error('EDGE_PROCESS_EXITED');
    try{alive=(await send('/livez')).status===200;}catch{}
    if(alive)break; await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(alive,'Edge API startup');
  assert.equal((await fetch(base+'/auth/social/providers')).status,403,'Public access stays disabled during validation');
  const ready=await send('/readyz');assert.equal(ready.status,200,'Prisma WASM + pg readiness');
  const legal=(await send('/legal/config')).body;
  const email='edge-test-'+randomBytes(12).toString('hex')+'@example.invalid';
  const password=randomBytes(24).toString('hex')+'!A1';
  const created=await send('/auth/signup','POST',{email,password,displayName:'Edge 검증 계정',privacyConsent:true,consentVersion:legal.version});
  assert.equal(created.status,201,'Edge signup');token=created.body.accessToken;
  const login=await send('/auth/login','POST',{email,password});assert.equal(login.status,200,'Edge bcrypt/JWT login');
  assert.equal((await send('/api/user/me','GET',undefined,token)).status,200);
  assert.equal((await send('/api/user/bookmarks/add','POST',{courseId:'edge-test',courseName:'검증용 코스',city:'순천'},token)).status,201);
  const saved=await send('/api/user/bookmarks','GET',undefined,token);assert.ok(saved.body.some(x=>x.courseId==='edge-test'));
  assert.equal((await send('/api/user/me','DELETE',undefined,token)).status,200,'Delete synthetic account');
  assert.equal((await send('/api/user/me','GET',undefined,token)).status,401,'Revoke deleted account token');token=undefined;
  console.log(JSON.stringify({passed:true,runtime:'Deno',prismaWasm:true,accountCrud:true,bcryptSignupMs:created.ms,bcryptLoginMs:login.ms,readinessMs:ready.ms,existingUsersUntouched:true}));
}catch(error){
  // Never dump runtime lines containing bundled code, environment values, or tokens.
  const lines=diagnostic.split(/\r?\n/).filter(x=>x.length<500 && /error|requires|Cannot|not supported|Permission|Denied|ReferenceError|TypeError/i.test(x))
    .map(x=>x.replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED]')).slice(0,8);
  console.error(JSON.stringify({passed:false,reason:error?.message,diagnostic:lines}));process.exitCode=1;
}finally{
  if(token){try{await send('/api/user/me','DELETE',undefined,token);}catch{console.error('Synthetic account cleanup needs verification');}}
  child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});
}
