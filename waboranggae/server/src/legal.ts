import { Router } from 'express';
import { privacyHtml, attributionHtml, SUPPORT_EMAIL, privacyOperatorName } from './legalContent';
import { PRIVACY_NOTICE_VERSION } from './privacy';
export const legalRouter = Router();
const html = (title: string, body: string) => '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title></head><body><main><h1>' + title + '</h1>' + body + '</main></body></html>';
// Free Supabase domains rewrite HTML responses to plain text. Send readable
// policy text deliberately; do not pretend the browser deletion form works there.
export function legalPlainText(title:string, body:string) {
  const base=process.env.PUBLIC_APP_URL?.replace(/\/$/,'') || '';
  return title+'\n\n'+body.replace(/<a href="([^"]+)">([^<]*)<\/a>/g,(_all,url:string,label:string)=>label+' ('+(url.startsWith('/')?base+url:url)+')')
    .replace(/<\/(?:p|h2|li|ul)>/g,'\n\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
legalRouter.get('/privacy', (_req, res) => {
  if(process.env.API_RUNTIME==='supabase-edge'){res.type('text').send(legalPlainText('뚜버기 개인정보 처리 안내',privacyHtml()));return;}
  res.type('html').send(html('뚜버기 개인정보 처리 안내', privacyHtml()));
});
legalRouter.get('/attributions',(_req,res)=>{
  if(process.env.API_RUNTIME==='supabase-edge'){res.type('text').send(legalPlainText('뚜버기 데이터·오픈소스 출처',attributionHtml));return;}
  res.type('html').send(html('뚜버기 데이터·오픈소스 출처',attributionHtml));
});
legalRouter.get('/config',(_req,res)=>res.json({version:PRIVACY_NOTICE_VERSION,supportEmail:SUPPORT_EMAIL,operator:privacyOperatorName(),releaseReady:false}));
legalRouter.get('/delete-account', (_req, res) => {
  if(process.env.API_RUNTIME==='supabase-edge'){
    res.type('text').send('뚜버기 계정 삭제\n\n앱의 내 여행 → 계정 삭제에서 계정과 저장 정보를 삭제할 수 있습니다.\n앱 이용이 어려우면 '+SUPPORT_EMAIL+'로 계정 삭제를 요청해 주세요. 비밀번호나 로그인 토큰은 이메일로 보내지 마세요. 운영자가 필요한 본인 확인 절차를 안내합니다.\n\n웹 브라우저에서 직접 삭제하는 화면은 별도 무료 웹 호스팅 연결 전이며 출시 준비 완료 상태가 아닙니다.');return;
  }
  res.type('html').send(html('뚜버기 계정 삭제', '<p>이메일 계정은 아래에서 본인 확인 후 삭제할 수 있습니다. 소셜 계정은 뚜버기 웹 화면에서 소셜 로그인 후 내 여행 → 계정 삭제를 사용하세요. 앱 설치가 필요하지 않습니다.</p><p><a href="/">뚜버기 웹으로 이동</a></p><p>계정, 북마크, 검색 이력과 앱 내 소셜 연결 정보는 삭제되며 복구할 수 없습니다.</p><form id="delete-form"><label>이메일 <input name="email" type="email" autocomplete="username" required></label><br><label>비밀번호 <input name="password" type="password" autocomplete="current-password" required></label><br><label><input name="confirm" type="checkbox" required> 영구 삭제에 동의합니다.</label><br><button>본인 확인 후 영구 삭제</button></form><p id="result" role="status"></p><script src="/legal/account.js"></script>'));
});
legalRouter.get('/account.js', (_req, res) => {
  res.type('application/javascript').send(`document.getElementById('delete-form').addEventListener('submit', async event => {
    event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button'), result=document.getElementById('result');
    if(!form.reportValidity())return; button.disabled=true; result.textContent='처리 중입니다.';
    try {
      const login=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.email.value,password:form.password.value})});
      const auth=await login.json(); form.password.value='';
      if(!login.ok)throw new Error('본인 확인에 실패했습니다. 이메일과 비밀번호를 확인하세요.');
      const deleted=await fetch('/api/user/me',{method:'DELETE',headers:{Authorization:'Bearer '+auth.accessToken}});
      if(!deleted.ok)throw new Error('삭제에 실패했습니다. 잠시 후 다시 시도하세요.');
      form.remove(); result.textContent='계정과 연결된 앱 데이터가 삭제되었습니다.';
    } catch(error) { result.textContent=error.message; } finally { button.disabled=false; }
  });`);
});
