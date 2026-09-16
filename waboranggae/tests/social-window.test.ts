import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureWebRuntime } from '../web/src/runtime';
import { reserveSocialWindow, validateSocialUrl } from '../web/src/socialWindow';
afterEach(()=>{vi.unstubAllGlobals();configureWebRuntime({apiBaseUrl:'',mapBaseUrl:''});});
function setup(blocked=false){
  const createElement=vi.fn(()=>({style:{},name:'',content:'',textContent:''}));
  const popup={opener:{} as unknown,closed:false,close:vi.fn(),location:{replace:vi.fn()},document:{title:'',createElement,head:{appendChild:vi.fn()},body:{appendChild:vi.fn()}}};
  const open=vi.fn(()=>blocked?null:popup);vi.stubGlobal('window',{open});return{popup,open};
}
describe('one-click social authentication window',()=>{
  it.each(['kakao','google'] as const)('reserves %s synchronously, severs opener, then navigates after async API',async provider=>{
    const {popup,open}=setup();const reserved=reserveSocialWindow(provider);
    expect(open).toHaveBeenCalledExactlyOnceWith('about:blank','_blank');expect(popup.opener).toBeNull();
    expect(popup.document.head.appendChild).toHaveBeenCalledWith(expect.objectContaining({name:'referrer',content:'no-referrer'}));
    expect(popup.location.replace).not.toHaveBeenCalled();await Promise.resolve();
    const url=provider==='kakao'?'https://kauth.kakao.com/oauth/authorize?state=fixture':'https://accounts.google.com/o/oauth2/v2/auth?state=fixture';
    expect(await reserved.navigate(url)).toBe(true);expect(popup.location.replace).toHaveBeenCalledWith(url);expect(open).toHaveBeenCalledOnce();
  });
  it('does not fake success or retry a blocked popup without a new gesture',async()=>{
    const {open}=setup(true);const reserved=reserveSocialWindow('kakao');expect(await reserved.navigate('https://kauth.kakao.com/oauth/authorize')).toBe(false);expect(open).toHaveBeenCalledOnce();
  });
  it('handles a closed tab and explicit cancellation',async()=>{
    const {popup}=setup();const reserved=reserveSocialWindow('kakao');popup.closed=true;
    expect(await reserved.navigate('https://kauth.kakao.com/oauth/authorize')).toBe(false);expect(popup.location.replace).not.toHaveBeenCalled();reserved.close();expect(popup.close).toHaveBeenCalledOnce();
  });
  it('closes a window when opener isolation cannot be established',()=>{
    const {popup}=setup();Object.defineProperty(popup,'opener',{set(){throw Error('blocked');}});
    reserveSocialWindow('kakao');expect(popup.close).toHaveBeenCalledOnce();expect(popup.location.replace).not.toHaveBeenCalled();
  });
  it.each(['javascript:alert(1)','https://kauth.kakao.com.evil.example/oauth/authorize','https://kauth.kakao.com@evil.example/oauth/authorize','http://kauth.kakao.com/oauth/authorize','https://kauth.kakao.com:8443/oauth/authorize','https://kauth.kakao.com/other','https://kauth.kakao.com/oauth/authorize#token','https://accounts.google.com/o/oauth2/v2/auth'])('rejects a non-provider authorization URL %s',url=>{
    expect(()=>validateSocialUrl('kakao',url)).toThrow();
  });
  it('uses the native browser bridge without opening an extra web popup',async()=>{
    const {open}=setup(),nativeOpen=vi.fn(async()=>{});configureWebRuntime({apiBaseUrl:'',mapBaseUrl:'',openExternal:nativeOpen});
    const reserved=reserveSocialWindow('google');expect(await reserved.navigate('https://accounts.google.com/o/oauth2/v2/auth')).toBe(true);expect(open).not.toHaveBeenCalled();expect(nativeOpen).toHaveBeenCalledOnce();
  });
});
