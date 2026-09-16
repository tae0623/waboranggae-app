import { getWebRuntime } from './runtime';
export type SocialProvider = 'kakao' | 'google';
export function validateSocialUrl(provider: SocialProvider, value: string) {
  const url=new URL(value);
  const expected=provider==='kakao'?['kauth.kakao.com','/oauth/authorize']:['accounts.google.com','/o/oauth2/v2/auth'];
  if(url.protocol!=='https:'||url.hostname!==expected[0]||url.pathname!==expected[1]||url.port||url.username||url.password||url.hash)throw new Error('로그인 주소를 확인하지 못했습니다. 다시 시도해 주세요.');
  return url.href;
}
export interface SocialWindow { navigate(url:string):Promise<boolean>; close():void }

/** Called synchronously in the click handler, before the /start request. */
export function reserveSocialWindow(provider: SocialProvider):SocialWindow {
  const nativeOpen=getWebRuntime().openExternal;
  if(nativeOpen)return {navigate:async value=>{await nativeOpen(validateSocialUrl(provider,value));return true;},close(){}};
  let popup:Window|null=null;
  const close=()=>{try{popup?.close();}catch{/* A closed or isolated tab needs no cleanup. */}};
  try {
    // noopener in window.open returns null, preventing later navigation. Open a
    // same-origin blank first and sever its opener before any external content.
    popup=window.open('about:blank','_blank');
    if(popup){
      popup.opener=null;
      const doc=popup.document;
      doc.title='뚜버기 로그인';
      const referrer=doc.createElement('meta');referrer.name='referrer';referrer.content='no-referrer';doc.head.appendChild(referrer);
      const status=doc.createElement('p');status.textContent='로그인 연결 중…';
      status.style.cssText='font:16px system-ui;color:#14532d;text-align:center;margin-top:25vh';doc.body.appendChild(status);
    }
  }catch{close();popup=null;}
  return {close,navigate:async value=>{
    const url=validateSocialUrl(provider,value);
    if(!popup||popup.closed)return false;
    try{popup.location.replace(url);return true;}catch{close();return false;}
  }};
}
