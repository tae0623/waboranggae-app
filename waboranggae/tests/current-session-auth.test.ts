import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import express from 'express';
import type {Server} from 'node:http';
const state=vi.hoisted(()=>({version:0,revoked:new Set<string>(),failStore:false}));
vi.mock('../server/src/db/client',()=>{
 const db:any={
  user:{
   findUnique:async()=>({id:'synthetic',email:'synthetic@example.invalid',password:'hash',tokenVersion:state.version,consentVersion:'current',consentedAt:new Date()}),
   update:async()=>{state.version++;return{};},
  },
  $queryRaw:async(_sql:unknown,hash:string)=>{if(state.failStore)throw Error('unavailable');return state.revoked.has(hash)?[{session_hash:hash}]:[];},
  $executeRaw:async(sql:TemplateStringsArray,hash:string)=>{if(sql.join('').startsWith('INSERT'))state.revoked.add(hash);return 1;},
 };
 db.$transaction=async(fn:any)=>fn(db);return{prisma:db};
});
vi.mock('../server/src/utils/crypto',()=>({verifyPassword:async(p:string)=>p==='fixture',hashPassword:async()=>'',validatePasswordRequirements:()=>null}));
vi.mock('../server/src/middleware/rateLimiter',()=>({loginLimiter:(_q:any,_r:any,n:any)=>n(),signupLimiter:(_q:any,_r:any,n:any)=>n()}));
import {authRouter} from '../server/src/auth/routes';
import {authenticateToken} from '../server/src/middleware/auth';
import {generateAccessToken,generateRefreshToken,verifyAccessToken,verifyRefreshToken} from '../server/src/auth/jwt';
let server:Server,base:string;
beforeAll(async()=>{
 const app=express();app.use(express.json());app.use('/auth',authRouter);
 app.get('/me',authenticateToken,(_q,r)=>r.json({ok:true}));
 app.use((_e:any,_q:any,r:any,_n:any)=>r.status(503).json({error:'unavailable'}));
 server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 base='http://127.0.0.1:'+((server.address() as any).port);
});
afterAll(async()=>new Promise<void>(r=>server.close(()=>r())));
beforeEach(()=>{state.version=0;state.revoked.clear();state.failStore=false;});
async function send(path:string,body?:unknown,token?:string){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 return{status:r.status,data:await r.json() as any};
}
async function login(){const r=await send('/auth/login',{email:'synthetic@example.invalid',password:'fixture'});expect(r.status).toBe(200);return r.data;}
describe('current login session revocation',()=>{
 it('creates distinct login IDs and retains the same ID through refresh',async()=>{
  const a=await login(),b=await login();
  const id=verifyAccessToken(a.accessToken)?.sessionId;
  expect(id).toMatch(/^[a-f0-9]{64}$/);expect(id===verifyAccessToken(b.accessToken)?.sessionId).toBe(false);
  const refreshed=await send('/auth/refresh',{refreshToken:a.refreshToken});expect(refreshed.status).toBe(200);
  expect(verifyRefreshToken(refreshed.data.refreshToken)?.sessionId===id).toBe(true);
 });
 it('revokes access and every refresh of A but not B or the account version',async()=>{
  const a=await login(),b=await login();
  const next=await send('/auth/refresh',{refreshToken:a.refreshToken});
  const out=await send('/auth/logout/current',{},a.accessToken);
  expect(out.data.scope).toBe('current-session');expect(state.version).toBe(0);
  for(const token of [a.accessToken,next.data.accessToken])expect((await send('/me',undefined,token)).status).toBe(401);
  for(const refreshToken of [a.refreshToken,next.data.refreshToken])expect((await send('/auth/refresh',{refreshToken})).status).toBe(401);
  expect((await send('/me',undefined,b.accessToken)).status).toBe(200);
  expect((await send('/auth/refresh',{refreshToken:b.refreshToken})).status).toBe(200);
 });
 it('upgrades a legacy refresh to a distinct current session',async()=>{
  const legacy=generateRefreshToken({userId:'synthetic',tokenVersion:0});
  const next=await send('/auth/refresh',{refreshToken:legacy});
  expect(next.status).toBe(200);expect(verifyAccessToken(next.data.accessToken)?.sessionId).toMatch(/^[a-f0-9]{64}$/);
 });
 it('refuses current logout on a legacy access instead of logging out all devices',async()=>{
  const legacy=generateAccessToken({userId:'synthetic',email:'synthetic@example.invalid',tokenVersion:0});
  expect((await send('/auth/logout/current',{},legacy)).status).toBe(409);expect(state.version).toBe(0);
 });
 it('does not bypass revocation storage failures',async()=>{
  const a=await login();state.failStore=true;
  expect((await send('/me',undefined,a.accessToken)).status).toBe(503);
 });
 it('requires authentication and rejects malformed signed session IDs',async()=>{
  expect((await send('/auth/logout/current',{})).status).toBe(401);
  const bad=generateAccessToken({userId:'synthetic',email:'synthetic@example.invalid',tokenVersion:0,sessionId:'bad'});
  expect((await send('/me',undefined,bad)).status).toBe(401);
 });
});

