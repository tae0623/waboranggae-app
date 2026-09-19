import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { createHash } from 'node:crypto';
import { edgeValidation } from '../server/src/runtime/edge-validation';
vi.mock('../server/src/auth/flow-store', async () => ({ flowStore: (await import('./helpers/flowStoreMock')).createFlowStoreMock() }));
const state=vi.hoisted(()=>({user:null as any,existing:false,updates:0,creates:0}));
vi.mock('../server/src/db/client',()=>{
  const user={findUnique:vi.fn(async()=>state.user),findUniqueOrThrow:vi.fn(async()=>state.user),update:vi.fn(async({data}:any)=>{state.updates++;state.user={...state.user,...data};return state.user;}),updateMany:vi.fn(async({data}:any)=>{state.user={...state.user,...data};return {count:1};})};
  const oAuthIdentity={findUnique:vi.fn(async()=>state.existing?{userId:'fixture',user:state.user}:null),upsert:vi.fn(async({create}:any)=>{state.creates++;state.user={id:'fixture',tokenVersion:0,...create.user.create};return {userId:'fixture'};})};
  const db={user,oAuthIdentity};return {prisma:{...db,$transaction:async(fn:any)=>fn(db)}};
});
vi.mock('../server/src/auth/jwt',()=>({generateTokenPair:()=>({accessToken:'fixture-access',refreshToken:'fixture-refresh'}),verifyAccessToken:()=>({userId:'fixture',tokenVersion:0}),verifyRefreshToken:()=>null}));
vi.mock('../server/src/utils/crypto',()=>({verifyPassword:async(p:string)=>p==='correct',hashPassword:async()=>'',validatePasswordRequirements:()=>null}));
vi.mock('../server/src/middleware/rateLimiter',()=>({loginLimiter:(_q:any,_s:any,n:any)=>n(),signupLimiter:(_q:any,_s:any,n:any)=>n()}));
import { authRouter } from '../server/src/auth/routes';
import { socialRouter,createSocialFlow } from '../server/src/auth/social';
import { PRIVACY_NOTICE_VERSION } from '../src/domain/privacyNotice';
let server:Server,base:string;const httpFetch=globalThis.fetch;
beforeAll(async()=>{
  const app=express();app.use(edgeValidation);app.use(express.json());app.use('/auth/social',socialRouter);app.use('/auth',authRouter);app.use((err:any,_q:any,r:any,_n:any)=>r.status(err.issues?400:500).json({error:'test-error'}));
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>{
  vi.stubEnv('API_RUNTIME','node');vi.stubEnv('EDGE_VALIDATION_MODE','false');
  state.user={id:'fixture',email:'fixture@example.invalid',password:'hash',tokenVersion:0,consentVersion:null,consentedAt:null};state.existing=false;state.creates=0;state.updates=0;
  vi.stubEnv('PUBLIC_APP_URL','https://api.example.org');vi.stubEnv('GOOGLE_LOGIN_ENABLED','true');vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','fixture-client');vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','fixture-secret');
  vi.stubGlobal('fetch',vi.fn(async(url:any)=>new Response(JSON.stringify(String(url).includes('/token')?{access_token:'fixture-provider-token'}:{sub:'fixture-subject',name:'가상 계정'}),{status:200})));
});
async function send(path:string,body?:any,auth=false){const r=await httpFetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer fixture-access'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
async function socialCallback(flowId:string){return httpFetch(base+'/auth/social/google/callback?state='+flowId+'&code=fixture-code',{redirect:'manual'});}
describe('이메일·소셜 최초 동의 API 계약',()=>{
  it('비공개 계정 테스트도 JWT를 대체하지 않고 콜백은 일회성 state로 검증한다',async()=>{
    vi.stubEnv('API_RUNTIME','supabase-edge');vi.stubEnv('EDGE_VALIDATION_MODE','true');
    const token='e'.repeat(64);
    vi.stubEnv('EDGE_ACCOUNT_VALIDATION_HASH',createHash('sha256').update(token).digest('hex'));
    vi.stubEnv('EDGE_ACCOUNT_VALIDATION_EXPIRES_AT',new Date(Date.now()+60000).toISOString());
    const headers={'Content-Type':'application/json','X-Dev-Access-Key':token};
    expect((await httpFetch(base+'/auth/consent',{method:'POST',headers,body:'{}'})).status).toBe(401);
    expect((await httpFetch(base+'/auth/social/google/start',{method:'POST'})).status).toBe(403);
    const unknown=await httpFetch(base+'/auth/social/google/callback?state='+('f'.repeat(64))+'&code=fixture',{redirect:'manual'});
    expect(unknown.status).toBe(303);expect(unknown.headers.get('location')).toContain('result=expired');
    const started=await httpFetch(base+'/auth/social/google/start',{method:'POST',headers,body:'{}'});expect(started.status).toBe(200);
    const flow=await started.json() as {flowId:string;pollSecret:string};
    const mismatch=await httpFetch(base+'/auth/social/kakao/callback?state='+flow.flowId+'&code=fixture',{redirect:'manual'});
    expect(mismatch.status).toBe(303);expect(mismatch.headers.get('location')).toContain('result=expired');
    expect((await socialCallback(flow.flowId)).headers.get('location')).toContain('result=ready');
    expect((await socialCallback(flow.flowId)).headers.get('location')).toContain('result=expired');
    expect((await httpFetch(base+'/auth/social/result',{method:'POST',headers,body:JSON.stringify({flowId:flow.flowId,pollSecret:'x'.repeat(64)})})).status).toBe(400);
    const poll=await httpFetch(base+'/auth/social/result',{method:'POST',headers,body:JSON.stringify(flow)});
    expect(poll.status).toBe(200);expect((await poll.json() as {status:string}).status).toBe('consent_required');expect(state.creates).toBe(0);
  });
  it('기존 이메일 계정은 인증만으로 동의 기록을 만들지 않는다',async()=>{const r=await send('/auth/login',{email:state.user.email,password:'correct'});expect(r.status).toBe(200);expect(r.body.user.consentVersion).toBeNull();expect(r.body.user.password).toBeUndefined();expect(state.updates).toBe(0);});
  it('명시적 동의를 저장하고 같은 버전은 다음 로그인/재동의에서 유지한다',async()=>{
    expect((await send('/auth/consent',{privacyConsent:false,consentVersion:PRIVACY_NOTICE_VERSION},true)).status).toBe(400);expect(state.updates).toBe(0);
    const accepted=await send('/auth/consent',{privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION},true);expect(accepted.status).toBe(200);expect(state.updates).toBe(1);
    const login=await send('/auth/login',{email:state.user.email,password:'correct'});expect(login.body.user.consentedAt).toBe(accepted.body.consentedAt);
    const again=await send('/auth/consent',{privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION},true);expect(again.body.consentedAt).toBe(accepted.body.consentedAt);expect(state.updates).toBe(1);
  });
  it('신규 소셜 계정은 동의 전 DB 등록/토큰 발급이 없고 동의 후 한 번만 결과를 받는다',async()=>{
    const flow=await createSocialFlow('google');expect((await socialCallback(flow.flowId)).status).toBe(303);
    const identity={flowId:flow.flowId,pollSecret:flow.pollSecret};const pending=await send('/auth/social/result',identity);expect(pending.body.status).toBe('consent_required');expect(pending.body.accessToken).toBeUndefined();expect(state.creates).toBe(0);
    expect((await send('/auth/social/consent',identity)).status).toBe(400);expect(state.creates).toBe(0);
    expect((await send('/auth/social/consent',{...identity,pollSecret:'x'.repeat(64),privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION})).status).toBe(400);
    expect((await send('/auth/social/consent',{...identity,privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION})).status).toBe(200);
    const claimed=await send('/auth/social/result',identity);expect(claimed.body.status).toBe('complete');expect(claimed.body.user.consentVersion).toBe(PRIVACY_NOTICE_VERSION);expect(state.creates).toBe(1);
    expect((await send('/auth/social/result',identity)).status).toBe(400);
  });
  it('동의한 소셜 재로그인은 새 동의를 만들지 않고 바로 완료한다',async()=>{
    state.existing=true;state.user.consentVersion=PRIVACY_NOTICE_VERSION;state.user.consentedAt='first-consent-time';
    const flow=await createSocialFlow('google');await socialCallback(flow.flowId);const r=await send('/auth/social/result',{flowId:flow.flowId,pollSecret:flow.pollSecret});expect(r.body.status).toBe('complete');expect(r.body.user.consentedAt).toBe('first-consent-time');expect(state.creates).toBe(0);expect(state.updates).toBe(0);
  });
  it('동시 결과 수령 요청 중 하나만 로그인 토큰을 받는다',async()=>{
    state.existing=true; const flow=await createSocialFlow('google'); await socialCallback(flow.flowId);
    const requests=await Promise.all(Array.from({length:5},()=>send('/auth/social/result',{flowId:flow.flowId,pollSecret:flow.pollSecret})));
    expect(requests.filter(r=>r.status===200 && r.body.accessToken).length).toBe(1);
    expect(requests.filter(r=>r.status===400).length).toBe(4);
  });
  it('동시 신규 가입 동의가 들어와도 사용자 계정은 한 번만 만든다',async()=>{
    const flow=await createSocialFlow('google'); await socialCallback(flow.flowId);
    const body={flowId:flow.flowId,pollSecret:flow.pollSecret,privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION};
    const requests=await Promise.all([send('/auth/social/consent',body),send('/auth/social/consent',body)]);
    expect(requests.filter(r=>r.status===200).length).toBe(1);expect(state.creates).toBe(1);
  });
  it('동의가 오래된 소셜 계정도 계정 삭제를 위한 인증은 허용한다',async()=>{
    state.existing=true;const flow=await createSocialFlow('google');await socialCallback(flow.flowId);const r=await send('/auth/social/result',{flowId:flow.flowId,pollSecret:flow.pollSecret});expect(r.body.status).toBe('complete');expect(r.body.user.consentVersion).toBeNull();expect(state.updates).toBe(0);
  });
  it.each(['web','android'] as const)('returns %s to the fixed branded page without credentials',async client=>{
    const flow=await createSocialFlow('google',client);const r=await socialCallback(flow.flowId);
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('https://waboranggae-app.pages.dev/auth/complete?client='+client+'&result=ready');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');expect(r.headers.get('cache-control')).toBe('no-store');
    const output=r.headers.get('location')!+await r.text();
    for(const secret of [flow.flowId,flow.pollSecret,'fixture-code','fixture-provider-token'])expect(output).not.toContain(secret);
    expect(state.creates).toBe(0);
    expect((await send('/auth/social/result',{flowId:flow.flowId,pollSecret:'wrong'.repeat(13).slice(0,64)})).status).toBe(400);
  });
  it('cancellation uses a branded failure state, never creates an account or calls the provider',async()=>{
    const flow=await createSocialFlow('google','web');
    const r=await httpFetch(base+'/auth/social/google/callback?state='+flow.flowId+'&error=access_denied',{redirect:'manual'});
    expect(r.headers.get('location')).toContain('result=cancelled');expect(state.creates).toBe(0);expect(globalThis.fetch).not.toHaveBeenCalled();
    expect((await send('/auth/social/result',{flowId:flow.flowId,pollSecret:flow.pollSecret})).status).toBe(400);
  });
  it('rejects caller-selected redirect addresses and invalid client types',async()=>{
    for(const body of [{client:'web',returnUrl:'https://attacker.example'},{client:'https://attacker.example'}]){
      expect((await send('/auth/social/google/start',body)).status).toBe(400);
    }
  });
});
