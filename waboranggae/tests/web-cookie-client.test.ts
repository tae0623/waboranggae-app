import {describe,it,expect,vi,afterEach} from 'vitest';
function storage(){const map=new Map<string,string>();return{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)};}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('web cookie session after page reload',()=>{
 it('renews an existing sessionStorage access token with the HttpOnly marker even before capability detection',async()=>{
  vi.resetModules();const s=storage();vi.stubGlobal('sessionStorage',s);
  s.setItem('waboranggae.accessToken','expired');s.setItem('waboranggae.refreshToken','__httpOnly');
  let attempts=0;const mock=vi.fn(async(path:string,init?:RequestInit)=>{
   if(path==='/auth/refresh'){expect(new Headers(init?.headers).get('x-web-session')).toBe('cookie');return Response.json({accessToken:'renewed',refreshToken:'__httpOnly'});}
   if(path==='/api/user/me'){if(attempts++===0)return Response.json({error:'expired'},{status:401});return Response.json({id:'test-id'});}
   throw Error('unexpected route');
  });vi.stubGlobal('fetch',mock);
  const {api,tokenStore}=await import('../web/src/api');
  expect((await api.me()).id).toBe('test-id');expect(tokenStore.getAccess()).toBe('renewed');
  expect(s.getItem('waboranggae.refreshToken')).toBe('__httpOnly');
 });
 it('clears the browser cookie when forgetting an already restored marker',async()=>{
  vi.resetModules();const s=storage();vi.stubGlobal('sessionStorage',s);s.setItem('waboranggae.refreshToken','__httpOnly');
  const mock=vi.fn(async(_path:string,_init?:RequestInit)=>Response.json({ok:true}));vi.stubGlobal('fetch',mock);
  const {tokenStore}=await import('../web/src/api');await tokenStore.clear();
  expect(s.getItem('waboranggae.refreshToken')).toBeNull();
  expect(mock.mock.calls[0]?.[0]).toBe('/auth/web-session');
 });
});
