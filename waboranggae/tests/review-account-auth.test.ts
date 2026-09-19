import {afterAll,afterEach,beforeAll,beforeEach,describe,it,expect,vi} from 'vitest';
import express from 'express';
import type {Server} from 'node:http';
import {PRIVACY_NOTICE_VERSION} from '../server/src/privacy';
const state=vi.hoisted(()=>({find:vi.fn(),create:vi.fn(),verify:vi.fn(),bot:vi.fn()}));
vi.mock('../server/src/db/client',()=>({prisma:{user:{findUnique:state.find,create:state.create}}}));
vi.mock('../server/src/utils/crypto',()=>({verifyPassword:state.verify,hashPassword:async()=>'hashed-fixture',validatePasswordRequirements:()=>null}));
vi.mock('../server/src/middleware/rateLimiter',()=>({loginLimiter:(_q:any,_r:any,n:any)=>n(),signupLimiter:(_q:any,_r:any,n:any)=>n()}));
vi.mock('../server/src/auth/signup-bot',async()=>({...await vi.importActual('../server/src/auth/signup-bot'),verifySignupBot:state.bot}));
import {authRouter} from '../server/src/auth/routes';
import {SignupBotError} from '../server/src/auth/signup-bot';
let server:Server,base:string;
beforeAll(async()=>{
 const app=express();app.use(express.json());app.use('/auth',authRouter);
 server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 base='http://127.0.0.1:'+((server.address() as any).port);
});
afterAll(async()=>new Promise<void>(r=>server.close(()=>r())));
beforeEach(()=>{vi.clearAllMocks();state.find.mockResolvedValue(null);state.verify.mockResolvedValue(false);state.bot.mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
const user={id:'fixture-review',email:'fixture@example.invalid',loginAlias:'test',displayName:'테스터',password:'hashed-fixture',tokenVersion:0,consentVersion:null,consentedAt:null};
async function send(path:string,body:unknown){
 const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return{status:response.status,body:await response.json() as any};
}
describe('ordinary test-account alias and protected signup',()=>{
 it('requires the real password for an administrator-provisioned alias',async()=>{
  state.find.mockResolvedValue(user);
  expect((await send('/auth/login',{email:'test',password:'incorrect'})).status).toBe(401);
  expect(state.find).toHaveBeenCalledWith({where:{loginAlias:'test'}});
  state.verify.mockResolvedValue(true);
  const result=await send('/auth/login',{email:'test',password:'fixture-only'});
  expect(result.status).toBe(200);expect(result.body.user.loginAlias).toBe('test');
  expect(result.body.user.password).toBeUndefined();expect(result.body.user.consentVersion).toBeNull();
  expect(state.bot).not.toHaveBeenCalled();
 });
 it('does not make arbitrary aliases valid accounts',async()=>{
  expect((await send('/auth/login',{email:'unknown',password:'fixture-only'})).status).toBe(401);
  expect(state.verify).not.toHaveBeenCalled();
 });
 it('retains the existing email lookup',async()=>{
  await send('/auth/login',{email:'fixture@example.invalid',password:'fixture-only'});
  expect(state.find).toHaveBeenCalledWith({where:{email:'fixture@example.invalid'}});
 });
 it('cannot assign an alias or skip bot validation using public signup input',async()=>{
  state.create.mockImplementation(async({data}:any)=>({id:'new-fixture',tokenVersion:0,...data}));
  const input={email:'new@example.invalid',displayName:'여행자',password:'fixture-12345',privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION,botToken:'fixture-token',loginAlias:'test'};
  const result=await send('/auth/signup',input);
  expect(result.status).toBe(201);expect(state.bot).toHaveBeenCalledWith('fixture-token');
  expect(state.create.mock.calls[0]![0].data).not.toHaveProperty('loginAlias');
  expect(result.body.user.password).toBeUndefined();
 });
 it('fails before touching users when the server rejects the bot token',async()=>{
  state.bot.mockRejectedValue(new SignupBotError(400,'확인이 필요합니다.'));
  const result=await send('/auth/signup',{email:'new@example.invalid',displayName:'여행자',password:'fixture-12345',privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION});
  expect(result.status).toBe(400);expect(result.body.code).toBe('SIGNUP_BOT_CHECK');
  expect(state.find).not.toHaveBeenCalled();expect(state.create).not.toHaveBeenCalled();
 });
 it('still requires an email for public signup',async()=>{
  const result=await send('/auth/signup',{email:'test',displayName:'여행자',password:'fixture-12345',privacyConsent:true,ageConfirmed:true,consentVersion:PRIVACY_NOTICE_VERSION});
  expect(result.status).toBe(400);expect(state.create).not.toHaveBeenCalled();
 });
});
