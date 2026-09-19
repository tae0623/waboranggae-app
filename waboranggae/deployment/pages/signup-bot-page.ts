const parents=['https://waboranggae-app.pages.dev','http://127.0.0.1:5173','http://localhost:5173'];
export function signupBotPage(request:Request,siteKey:string|undefined){
  const supplied=new URL(request.url).searchParams.get('parent')||parents[0]!;
  const parent=parents.includes(supplied)?supplied:parents[0]!;
  const ready=/^[A-Za-z0-9_-]{10,100}$/.test(siteKey||'');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(18)),n=>n.toString(16).padStart(2,'0')).join('');
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>뚜버기 · 자동 가입 방지</title><style>body{margin:0;background:white;color:#191b1a;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:140px;padding:16px;box-sizing:border-box}p{font-size:14px;color:#657166;text-align:center}</style></head><body><main><div id="bot"></div><p id="status">${ready?'확인 중입니다.':'회원가입 보호 설정을 준비 중입니다.'}</p></main>
<script nonce="${nonce}">function completed(token){if(typeof token!=='string'||token.length>2048)return;document.getElementById('status').textContent='확인됐어요.';if(window.DdubugiBot)window.DdubugiBot.complete(token);else if(window.parent!==window)window.parent.postMessage({type:'ddubugi-signup-bot',token},${JSON.stringify(parent)});}
function expired(){document.getElementById('status').textContent='다시 확인해 주세요.';if(window.DdubugiBot)window.DdubugiBot.complete('');else window.parent.postMessage({type:'ddubugi-signup-bot',token:''},${JSON.stringify(parent)});}
function start(){turnstile.render('#bot',{sitekey:${JSON.stringify(ready?siteKey:'')},action:'signup',size:window.innerWidth<330?'compact':'normal',theme:'light',language:'ko',callback:completed,'expired-callback':expired,'error-callback':expired});}</script>
${ready?'<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=start&amp;render=explicit" async defer></script>':''}</body></html>`;
  return new Response(request.method==='HEAD'?null:html,{status:ready?200:503,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
    'Permissions-Policy':'geolocation=(), camera=(), microphone=()',
    'Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors "+parents.join(' ')+"; script-src 'nonce-"+nonce+"' https://challenges.cloudflare.com; connect-src https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'unsafe-inline';",
  }});
}
