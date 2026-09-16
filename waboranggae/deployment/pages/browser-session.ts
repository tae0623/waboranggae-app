import type { PagesEnv } from './worker';
export const BROWSER_COOKIE='__Host-ddubugi_login';
export const COOKIE_TOKEN='__httpOnly';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const MAX_SECONDS=7*86400;
type Session={token:string;exp:number;persistent:boolean};
type Fetcher=(url:string,init?:RequestInit)=>Promise<Response>;
function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(env:PagesEnv){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('ddubugi-browser-session-v1|'+env.TEAM_WEB_SESSION_SECRET)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
function aad(env:PagesEnv){return encoder.encode(env.TEAM_WEB_ORIGIN+'|'+env.TEAM_WEB_PASSWORD+'|'+env.TEAM_WEB_API_EXPIRES_AT);}
export async function readBrowserSession(request:Request,env:PagesEnv):Promise<Session|null>{
  const value=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(BROWSER_COOKIE+'='))?.slice(BROWSER_COOKIE.length+1);
  if(!value || value.length>3500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))return null;
  try{
    const [iv,data]=value.split('.');
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv!),additionalData:aad(env)},await key(env),decode(data!));
    const session=JSON.parse(decoder.decode(plain)) as Session;
    if(typeof session.token!=='string'||session.token.length>2048||session.token.length<16||typeof session.persistent!=='boolean'||!Number.isInteger(session.exp)||session.exp<=Date.now()/1000||session.exp>Date.now()/1000+MAX_SECONDS+1)return null;
    return session;
  }catch{return null;}
}
export function clearBrowserCookie(){return BROWSER_COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';}
async function browserCookie(token:string,persistent:boolean,env:PagesEnv){
  if(token.length<16||token.length>2048)throw new Error('Invalid refresh token');
  const exp=Math.min(Math.floor(Date.now()/1000)+MAX_SECONDS,Math.floor(Date.parse(env.TEAM_WEB_API_EXPIRES_AT)/1000));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(env)},await key(env),encoder.encode(JSON.stringify({token,exp,persistent})));
  return BROWSER_COOKIE+'='+encode(iv)+'.'+encode(new Uint8Array(cipher))+'; Path=/; HttpOnly; Secure; SameSite=Strict'+(persistent?'; Max-Age='+Math.max(0,exp-Math.floor(Date.now()/1000)):'');
}
function sessionId(token:string|null|undefined){try{const value=JSON.parse(decoder.decode(decode(token!.split('.')[1]!))).sessionId;return typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:null;}catch{return null;}}
function requestSessionId(request:Request){const value=request.headers.get('x-web-session-id');return value&&/^[a-f0-9]{64}$/.test(value)?value:null;}
function ownsCookie(request:Request,session:Session|null){const expected=requestSessionId(request);return !expected||!session||sessionId(session.token)===expected;}
function json(value:unknown,status=200,cookie?:string){const response=new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});if(cookie)response.headers.append('Set-Cookie',cookie);return response;}
export async function browserSessionCapability(request:Request,env:PagesEnv){
  const session=await readBrowserSession(request,env);
  return json({supported:true,persistent:session?.persistent===true});
}
export async function browserSessionProxy(request:Request,env:PagesEnv,path:string,body:ArrayBuffer|undefined,headers:Headers,upstream:Fetcher,apiBase:string):Promise<Response>{
  const restore=path==='/auth/web-session'&&request.method==='POST';
  const session=await readBrowserSession(request,env);
  if(path==='/auth/web-session'&&request.method==='DELETE')return json({ok:true},200,ownsCookie(request,session)?clearBrowserCookie():undefined);
  if(restore && !session?.persistent)return json({error:'자동 로그인 정보가 없습니다.'},401,clearBrowserCookie());
  const actualPath=restore?'/auth/refresh':path;
  const enabled=restore || request.headers.get('x-web-session')==='cookie';
  if(enabled && actualPath==='/auth/refresh'){
    if(!restore&&!ownsCookie(request,session))return json({error:'다른 탭에서 로그인 정보가 변경되었습니다. 다시 로그인해 주세요.'},401);
    let data:Record<string,unknown>;try{data=body?JSON.parse(decoder.decode(body)):{};}catch{return json({error:'요청 형식이 올바르지 않습니다.'},400);}
    if(restore || data.refreshToken===COOKIE_TOKEN || !data.refreshToken){
      if(!session)return json({error:'다시 로그인해 주세요.'},401,clearBrowserCookie());
      body=encoder.encode(JSON.stringify({...data,refreshToken:session.token})).buffer as ArrayBuffer;
      headers.set('Content-Type','application/json');
    }
  }
  const received=await upstream(apiBase+actualPath+new URL(request.url).search,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(140000)});
  const response=new Response(received.body,{status:received.status,headers:received.headers});
  response.headers.delete('set-cookie');
  if(!enabled)return response;
  if((actualPath==='/auth/logout/current'||(actualPath==='/api/user/me'&&request.method==='DELETE'))&&response.ok){
    const result=new Response(response.body,response);if(ownsCookie(request,session))result.headers.set('Set-Cookie',clearBrowserCookie());return result;
  }
  if(actualPath==='/auth/refresh' && response.status===401)return json({error:'로그인이 만료되었습니다. 다시 로그인해 주세요.'},401,clearBrowserCookie());
  if(!response.ok || !['/auth/login','/auth/signup','/auth/social/result','/auth/refresh'].includes(actualPath))return response;
  const data=await response.json() as Record<string,unknown>;
  if(typeof data.accessToken!=='string'||typeof data.refreshToken!=='string')return json(data);
  const persistent=actualPath==='/auth/refresh'?session?.persistent===true:request.headers.get('x-web-auto-login')==='1';
  const cookie=await browserCookie(data.refreshToken,persistent,env);
  return json({...data,refreshToken:COOKIE_TOKEN},response.status,cookie);
}
