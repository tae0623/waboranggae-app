import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWebRuntime } from '../web/src/runtime';
import { tokenStore } from '../web/src/api';
const values = new Map<string,string>();
vi.stubGlobal('sessionStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)});
afterEach(()=>{configureWebRuntime({apiBaseUrl:'',mapBaseUrl:''});values.clear();vi.restoreAllMocks();});
describe('휴대폰 세션 저장',()=>{
  it('저장 중 로그아웃하면 늦은 갱신 응답으로 로그인 상태가 살아나지 않음',async()=>{
    let finish!:()=>void;
    const persistSession=vi.fn((tokens:unknown)=>tokens?new Promise<void>(resolve=>{finish=resolve;}):Promise.resolve());
    configureWebRuntime({apiBaseUrl:'https://api.example.com',mapBaseUrl:'',persistSession});
    tokenStore.restoreNative({access:'a',refresh:'r'});
    const writing=tokenStore.set('new','new-refresh',true);
    const rejected=expect(writing).rejects.toThrow('로그인 상태가 변경');
    await tokenStore.clear(); finish(); await rejected;
    expect(tokenStore.getAccess()).toBeNull();
  });
  it('native에서는 DOM storage 대신 암호화 저장 bridge 사용',async()=>{
    const persistSession=vi.fn().mockResolvedValue(undefined);
    configureWebRuntime({apiBaseUrl:'https://api.example.com',mapBaseUrl:'',persistSession});
    tokenStore.restoreNative(null);
    await tokenStore.set('access-test','refresh-test');
    expect(values.size).toBe(0);expect(tokenStore.getAccess()).toBe('access-test');
    expect(persistSession).toHaveBeenCalledWith({access:'access-test',refresh:'refresh-test'});
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(()=>{throw new Error('Opaque DOM storage unavailable');});
    await tokenStore.clear();expect(tokenStore.getAccess()).toBeNull();expect(persistSession).toHaveBeenLastCalledWith(null);
  });
  it('토큰 갱신과 다른 계정 로그인을 구분',async()=>{
    const initial=tokenStore.version();await tokenStore.set('a','r');expect(tokenStore.version()).toBe(initial+1);
    await tokenStore.set('a2','r2',true);expect(tokenStore.version()).toBe(initial+1);
    await tokenStore.clear();expect(tokenStore.version()).toBe(initial+2);
  });
});
