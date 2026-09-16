import {describe,it,expect,vi,afterEach} from 'vitest';
import {handlePagesRequest,type PagesEnv} from '../deployment/pages/worker';
const origin='https://test-team.pages.dev';
function setup(){
 const env:PagesEnv={ASSETS:{fetch:async()=>new Response('asset')},TEAM_WEB_ORIGIN:origin,TEAM_WEB_PASSWORD:'b'.repeat(48),TEAM_WEB_SESSION_SECRET:'c'.repeat(64),TEAM_WEB_API_KEY:'a'.repeat(64),TEAM_WEB_API_EXPIRES_AT:new Date(Date.now()+30*86400000).toISOString()};
 const req=(path:string,init:RequestInit={})=>new Request(origin+path,{...init,headers:{Authorization:'Basic '+btoa('team:'+env.TEAM_WEB_PASSWORD),Origin:origin,'Content-Type':'application/json','X-Web-Session':'cookie',...Object.fromEntries(new Headers(init.headers))}});
 const upstream=vi.fn(async(_url:string,_init?:RequestInit)=>new Response(JSON.stringify({accessToken:'access-test',refreshToken:'private-refresh-token-123456789'}),{headers:{'Content-Type':'application/json'}}));
 return{env,req,upstream};
}
function cookie(res:Response){return res.headers.getSetCookie().find(c=>c.startsWith('__Host-ddubugi_login='))!;}
afterEach(()=>vi.useRealTimers());
describe('secure browser auto login',()=>{
 it('stores only encrypted refresh tokens in HttpOnly cookies, never in the response',async()=>{
   const {env,req,upstream}=setup();
   const res=await handlePagesRequest(req('/auth/login',{method:'POST',headers:{'X-Web-Auto-Login':'1'},body:'{}'}),env,upstream);
   expect(await res.json()).toEqual({accessToken:'access-test',refreshToken:'__httpOnly'});
   const c=cookie(res);for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=604800'])expect(c).toContain(flag);
   expect(c).not.toContain('private-refresh');expect(c).not.toContain(env.TEAM_WEB_SESSION_SECRET);
   expect(new Headers(upstream.mock.calls[0]![1]!.headers).has('x-web-auto-login')).toBe(false);
 });
 it('keeps unchecked logins session-only and does not auto restore them',async()=>{
   const {env,req,upstream}=setup();const login=await handlePagesRequest(req('/auth/login',{method:'POST',body:'{}'}),env,upstream);
   const c=cookie(login);expect(c).not.toContain('Max-Age');
   const restore=await handlePagesRequest(req('/auth/web-session',{method:'POST',headers:{Cookie:c.split(';')[0]!},body:'{}'}),env,upstream);
   expect(restore.status).toBe(401);expect(upstream).toHaveBeenCalledTimes(1);
 });
 it('restores and rotates a remembered token without sending team cookie upstream',async()=>{
   const {env,req,upstream}=setup();const login=await handlePagesRequest(req('/auth/login',{method:'POST',headers:{'X-Web-Auto-Login':'1'},body:'{}'}),env,upstream);
   const c=cookie(login).split(';')[0]!;
   const status=await handlePagesRequest(req('/auth/web-session',{headers:{Cookie:c}}),env,upstream);expect(await status.json()).toEqual({supported:true,persistent:true});
   const restore=await handlePagesRequest(req('/auth/web-session',{method:'POST',headers:{Cookie:c},body:'{}'}),env,upstream);
   expect(restore.status).toBe(200);expect(cookie(restore)).not.toContain(c);
   const [url,init]=upstream.mock.calls[1]!;expect(url).toContain('/auth/refresh');
   expect(JSON.parse(new TextDecoder().decode(init!.body as ArrayBuffer)).refreshToken).toBe('private-refresh-token-123456789');
   expect(new Headers(init!.headers).has('cookie')).toBe(false);
 });
 it('uses the same cookie for access-token renewal and current-session logout only',async()=>{
   const {env,req,upstream}=setup();const login=await handlePagesRequest(req('/auth/login',{method:'POST',headers:{'X-Web-Auto-Login':'1'},body:'{}'}),env,upstream);
   const c=cookie(login).split(';')[0]!;
   const res=await handlePagesRequest(req('/auth/logout/current',{method:'POST',headers:{Cookie:c},body:JSON.stringify({refreshToken:'__httpOnly'})}),env,upstream);
   expect(cookie(res)).toContain('Max-Age=0');expect(upstream.mock.calls[1]![0]).toContain('/auth/logout/current');
 });
 it('rejects cookie tampering, expiry and changed team credentials',async()=>{
   vi.useFakeTimers();const {env,req,upstream}=setup();
   const login=await handlePagesRequest(req('/auth/login',{method:'POST',headers:{'X-Web-Auto-Login':'1'},body:'{}'}),env,upstream);
   const c=cookie(login).split(';')[0]!;
   for(const invalid of [c+'a',c.replace('=', '=x')])expect((await handlePagesRequest(req('/auth/web-session',{method:'POST',headers:{Cookie:invalid},body:'{}'}),env,upstream)).status).toBe(401);
   env.TEAM_WEB_SESSION_SECRET='d'.repeat(64);
   expect((await handlePagesRequest(req('/auth/web-session',{method:'POST',headers:{Cookie:c},body:'{}'}),env,upstream)).status).toBe(401);
   env.TEAM_WEB_SESSION_SECRET='c'.repeat(64);vi.setSystemTime(Date.now()+8*86400000);
   expect((await handlePagesRequest(req('/auth/web-session',{method:'POST',headers:{Cookie:c},body:'{}'}),env,upstream)).status).toBe(401);
   expect(upstream).toHaveBeenCalledTimes(1);
 });
 it('requires team admission and same-origin protections even for cookie restore',async()=>{
   const {env,req,upstream}=setup();
   expect((await handlePagesRequest(new Request(origin+'/auth/web-session'),env,upstream)).status).toBe(401);
   expect((await handlePagesRequest(req('/auth/web-session',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}),env,upstream)).status).toBe(403);
   expect(upstream).not.toHaveBeenCalled();
 });
 it('does not persist tokens in ordinary native/CLI API calls',async()=>{
   const {env,req,upstream}=setup();const res=await handlePagesRequest(req('/auth/login',{method:'POST',headers:{'X-Web-Session':''},body:'{}'}),env,upstream);
   expect((await res.json()).refreshToken).toBe('private-refresh-token-123456789');expect(cookie(res)).toBeUndefined();
 });
 it('never copies upstream cookies onto unrelated gateway responses',async()=>{
   const {env,req}=setup();const upstream=async()=>new Response('{}',{headers:{'set-cookie':'malicious=1'}});
   const res=await handlePagesRequest(req('/api/hot-places'),env,upstream);expect(res.headers.get('set-cookie')).not.toContain('malicious');
 });
});
