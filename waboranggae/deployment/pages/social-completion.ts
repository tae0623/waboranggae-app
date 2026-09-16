import brand from '../../web/src/assets/brand-mark.svg?raw';
import { ANDROID_AUTH_RETURN } from '../../src/domain/socialReturn';

/** Public presentation only: no cookies, API access, secrets or account state. */
export function socialCompletionPage(request: Request) {
  const url = new URL(request.url);
  const client = ['web', 'android'].includes(url.searchParams.get('client') || '') ? url.searchParams.get('client')! : 'legacy';
  const result = url.searchParams.get('result');
  const ready = result === 'ready';
  const title = ready ? '인증이 완료됐어요' : result === 'cancelled' ? '로그인을 취소했어요' : '다시 로그인해 주세요';
  const subtitle = ready ? '뚜버기에서 계속할게요.' : '뚜버기로 돌아가 다시 시작할 수 있어요.';
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(18)), n => n.toString(16).padStart(2, '0')).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>뚜버기 · 로그인</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f0;color:#1c1c1e;font-family:system-ui,-apple-system,"Malgun Gothic",sans-serif;min-height:100svh;display:grid;place-items:center;padding:28px 20px}
main{width:100%;max-width:420px;text-align:center;background:#fff;border:1px solid #e6e8e1;border-radius:30px;padding:36px 28px 28px;box-shadow:0 18px 70px #17352c09}
.brand{width:108px;height:108px;border-radius:30px;background:#eff8ee;margin:0 auto 15px}.brand svg{width:100%;height:100%}.wordmark{font-size:19px;letter-spacing:-.8px;font-weight:800}
.rule{width:28px;height:3px;border-radius:4px;background:#16a34a;margin:26px auto}h1{font-size:25px;letter-spacing:-1px;margin:0 0 12px}p{font-size:15px;line-height:1.7;color:#6b706d;margin:0}
button,.primary{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:15px;font-weight:700;cursor:pointer;text-decoration:none;background:#1c1c1e;color:#fff;margin-top:28px;font-size:15px;font-family:inherit}
.secondary{display:inline-block;color:#6b706d;font-size:13px;text-underline-offset:4px;margin-top:19px}.hint{font-size:12px;line-height:1.6;margin-top:18px;min-height:38px}button:focus-visible,a:focus-visible{outline:3px solid #16a34a;outline-offset:4px}
@media(max-width:380px){main{padding:30px 22px 22px}h1{font-size:23px}}
</style></head><body><main><div class="brand" aria-hidden="true">${brand}</div><div class="wordmark">뚜버기</div><div class="rule"></div>
<h1>${title}</h1><p>${subtitle}</p><a id="return-app" class="primary" href="${ANDROID_AUTH_RETURN}" hidden style="display:none">뚜버기 앱으로 돌아가기</a>
<button id="return-web" type="button">뚜버기로 돌아가기</button><p id="hint" class="hint" role="status">로그인을 시작했던 화면에서 이어서 이용해 주세요.</p>
<a class="secondary" href="/" rel="noreferrer">뚜버기 웹 열기</a>
<noscript><p class="hint">로그인을 시작했던 앱이나 탭으로 돌아가 주세요.</p></noscript></main>
<script nonce="${nonce}">
(()=>{
  const client=${JSON.stringify(client)},ready=${ready};
  const android=client==='android'||(client==='legacy'&&/Android/i.test(navigator.userAgent));
  history.replaceState(null,'',location.pathname);
  const hint=document.getElementById('hint'),app=document.getElementById('return-app'),web=document.getElementById('return-web');
  function notify(){try{const channel=new BroadcastChannel('ddubugi-social-return');channel.postMessage('check-pending-login');channel.close();}catch{}}
  function closeTab(){notify();window.close();hint.textContent='창이 닫히지 않으면, 로그인을 시작한 뚜버기 탭으로 돌아가 주세요.';}
  web.addEventListener('click',closeTab);
  if(android){
    app.hidden=false;app.style.display='flex';web.hidden=true;web.style.display='none';
    hint.textContent='앱이 열리지 않으면 위 버튼을 눌러 주세요.';
    if(ready)setTimeout(()=>{location.replace(${JSON.stringify(ANDROID_AUTH_RETURN)});},450);
  }else{
    notify();
    if(ready)setTimeout(closeTab,450);
  }
})();
</script></body></html>`;
  return new Response(request.method === 'HEAD' ? null : html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000', 'X-Robots-Tag': 'noindex, nofollow',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'`,
  } });
}
