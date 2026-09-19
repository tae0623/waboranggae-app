export class SignupBotError extends Error {
  constructor(public status:number,message:string){super(message);}
}
export function signupBotConfig(){
  const required=process.env.SIGNUP_BOT_REQUIRED==='true';
  const ready=/^[A-Za-z0-9_-]{10,100}$/.test(process.env.TURNSTILE_SITE_KEY||'')&&(process.env.TURNSTILE_SECRET_KEY||'').length>=20;
  return {required,available:!required||ready};
}
export async function verifySignupBot(token:unknown){
  const config=signupBotConfig();
  if(!config.required)return;
  if(!config.available)throw new SignupBotError(503,'회원가입 보호 설정을 확인 중입니다. 잠시 후 다시 시도해 주세요.');
  if(typeof token!=='string'||!token||token.length>2048)throw new SignupBotError(400,'자동 가입 방지 확인을 완료해 주세요.');
  let data:Record<string,unknown>;
  try{
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({secret:process.env.TURNSTILE_SECRET_KEY,response:token}),
      signal:AbortSignal.timeout(10000),redirect:'error',
    });
    if(!response.ok)throw Error('provider');
    const parsed:unknown=await response.json();
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('provider');
    data=parsed as Record<string,unknown>;
  }catch{throw new SignupBotError(503,'자동 가입 방지 확인이 지연되고 있어요. 다시 시도해 주세요.');}
  // Cloudflare validates expiry and single use. Never trust a UI-only success.
  if(data.success!==true||data.hostname!=='waboranggae-app.pages.dev'||data.action!=='signup')
    throw new SignupBotError(400,'자동 가입 방지 확인이 만료됐어요. 다시 확인해 주세요.');
}
