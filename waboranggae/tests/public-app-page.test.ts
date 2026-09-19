import {describe,it,expect,vi} from 'vitest';
import {handlePagesRequest,type PagesEnv} from '../deployment/pages/worker';
import {ACCOUNT_CONSENT_TEXT} from '../src/domain/privacyNotice';
import {readFileSync} from 'node:fs';
describe('public app documents without opening team web',()=>{
  const origin='https://waboranggae-app.pages.dev';
  const env={ASSETS:{fetch:vi.fn()},TEAM_WEB_ORIGIN:origin,TEAM_WEB_PASSWORD:'b'.repeat(48),TEAM_WEB_SESSION_SECRET:'c'.repeat(64),TEAM_WEB_API_KEY:'a'.repeat(64),TEAM_WEB_API_EXPIRES_AT:new Date(Date.now()+86400_000).toISOString()} as PagesEnv;
  it.each(['/app','/app/privacy','/app/terms','/app/delete-account'])('serves %s without team credentials, scripts or upstream calls',async path=>{
    const upstream=vi.fn();const r=await handlePagesRequest(new Request(origin+path),env,upstream);
    expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toBeNull();
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
    const body=await r.text();expect(body).toContain('waboranggae.help@gmail.com');expect(body).not.toContain('<script');
    expect(body).not.toContain(env.TEAM_WEB_API_KEY);expect(upstream).not.toHaveBeenCalled();
  });
  it('serves terms with account, pricing, privacy and statutory rights rather than inferring consent',async()=>{
    const r=await handlePagesRequest(new Request(origin+'/app/terms'),env);
    const html=await r.text();
    for(const text of ['서비스 이용약관','만 14세 이상','기본 기능은 무료','개인정보나 위치 이용에 동의한 것으로 처리하지 않습니다','법적 책임을 일률적으로 배제하지 않습니다','2026-09-18-terms-v1'])expect(html).toContain(text);
    const home=await handlePagesRequest(new Request(origin+'/app'),env);
    expect(await home.text()).toContain('href="/app/terms"');
    const head=await handlePagesRequest(new Request(origin+'/app/terms',{method:'HEAD'}),env);
    expect(head.status).toBe(200);expect(await head.text()).toBe('');
    expect((await handlePagesRequest(new Request(origin+'/app/terms',{method:'POST'}),env)).status).toBe(401);
  });
  it('still gates the team app, APIs, previews and non-GET requests',async()=>{
    for(const path of ['/','/api/user/me','/app/private'])expect((await handlePagesRequest(new Request(origin+path),env)).status).toBe(401);
    expect((await handlePagesRequest(new Request(origin+'/app',{method:'POST'}),env)).status).toBe(401);
    expect((await handlePagesRequest(new Request('https://preview.pages.dev/app'),env)).status).toBe(403);
  });
  it('native and shared account text are identical',()=>{
    const native=readFileSync('android-native/app/src/main/java/kr/co/waboranggae/nativepilot/ui/AccountScreens.kt','utf8');
    expect(native).toContain('const val ACCOUNT_CONSENT_TEXT="'+ACCOUNT_CONSENT_TEXT+'"');
  });
});
