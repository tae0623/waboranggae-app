import { describe, expect, it, vi } from 'vitest';
import { handlePagesRequest, type PagesEnv } from '../deployment/pages/worker';
import { socialReturnUrl, SOCIAL_RETURN_ORIGIN, SOCIAL_RETURN_PATH } from '../src/domain/socialReturn';

describe('credential-free social return landing',()=>{
  it.each(['GET','HEAD'])('serves only the presentation page through %s without team secrets',async method=>{
    const upstream=vi.fn(),assets=vi.fn();
    const env:PagesEnv={ASSETS:{fetch:assets},TEAM_WEB_ORIGIN:'',TEAM_WEB_PASSWORD:'',TEAM_WEB_SESSION_SECRET:'',TEAM_WEB_API_KEY:'',TEAM_WEB_API_EXPIRES_AT:''};
    const response=await handlePagesRequest(new Request(socialReturnUrl('android'),{method}),env,upstream);
    expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.has('set-cookie')).toBe(false);expect(response.headers.has('www-authenticate')).toBe(false);
    expect(upstream).not.toHaveBeenCalled();expect(assets).not.toHaveBeenCalled();
    const html=await response.text();
    if(method==='HEAD')expect(html).toBe('');
    else{expect(html).toContain('인증이 완료됐어요');expect(html).toContain('<svg');expect(html).toContain('package=kr.co.waboranggae.nativepilot');
      const nonce=html.match(/<script nonce="([a-f0-9]+)">/)?.[1];expect(nonce).toHaveLength(36);
      expect(response.headers.get('content-security-policy')).toContain("script-src 'nonce-"+nonce+"'");
      const script=html.match(/<script nonce="[^"]+">([\s\S]+?)<\/script>/)?.[1];expect(()=>new Function(script!)).not.toThrow();
      expect(html).not.toContain('accessToken');expect(html).not.toContain('pollSecret');
    }
  });
  it('does not reflect arbitrary query input or fetch external content',async()=>{
    const malicious='</script><script>alert(1)</script>';
    const url=SOCIAL_RETURN_ORIGIN+SOCIAL_RETURN_PATH+'?client='+encodeURIComponent(malicious)+'&result='+encodeURIComponent(malicious)+'&returnUrl=https://attacker.example&code=secret-code';
    const r=await handlePagesRequest(new Request(url),{} as PagesEnv,vi.fn());const html=await r.text();
    expect(html).toContain('다시 로그인해 주세요');
    for(const value of [malicious,'https://attacker.example','secret-code'])expect(html).not.toContain(value);
  });
  it.each(['/','/assets/brand-mark.svg','/auth/complete/','/auth/complete/../result','/auth/social/result','/maps/embed'])('does not make %s public',async path=>{
    expect((await handlePagesRequest(new Request(SOCIAL_RETURN_ORIGIN+path),{} as PagesEnv,vi.fn())).status).toBe(503);
  });
  it('does not admit a preview host or POST request',async()=>{
    expect((await handlePagesRequest(new Request('https://preview.waboranggae-app.pages.dev/auth/complete'),{} as PagesEnv,vi.fn())).status).toBe(503);
    expect((await handlePagesRequest(new Request(socialReturnUrl(),{method:'POST'}),{} as PagesEnv,vi.fn())).status).toBe(503);
  });
});
