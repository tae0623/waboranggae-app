import { useEffect, useRef, useState } from 'react';
import { api, type AuthResponse } from './api';
import { openExternal } from './runtime';
import { PrivacyConsent } from './PrivacyConsent';
import googleLogo from '../../android-native/app/src/main/res/drawable-nodpi/google_signin_logo.png';
import kakaoButton from '../../android-native/app/src/main/res/drawable-nodpi/kakao_login_official.png';
export function SocialLoginButtons({ onAuthenticated }: { onAuthenticated: (result: AuthResponse) => Promise<void> }) {
  const authenticated=useRef(onAuthenticated);authenticated.current=onAuthenticated;
  const [providers, setProviders] = useState<Array<{id: string; enabled: boolean; reason: string}>>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsConsent,setNeedsConsent]=useState(false);
  const [flow, setFlow] = useState<{flowId: string; pollSecret: string; authorizationUrl: string} | null>(null);
  useEffect(() => { let active = true; api.socialProviders().then(result => { if (active) setProviders(result.providers); }).catch(() => { if (active) setMessage('소셜 로그인 설정을 확인할 수 없습니다.'); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!flow || needsConsent) return;
    let active = true, running = false;
    const deadline = Date.now() + 5 * 60_000;
    const timer = setInterval(async () => {
      if (running || !active) return;
      if (Date.now() > deadline) { setFlow(null); setMessage('로그인 시간이 만료되었습니다. 다시 시작해 주세요.'); return; }
      running = true;
      try {
        const result = await api.socialResult(flow.flowId, flow.pollSecret);
        if(active && result.status==='consent_required'){setNeedsConsent(true);return;}
        if (active && result.status === 'complete') { clearInterval(timer); setFlow(null); await authenticated.current(result); }
      } catch (error) { if (active) { setFlow(null); setMessage(error instanceof Error ? error.message : '로그인 실패'); } }
      finally { running = false; }
    }, 3000);
    return () => { active = false; clearInterval(timer); };
  }, [flow, needsConsent]);
  async function start(id: 'kakao' | 'google') {
    const config = providers.find(item => item.id === id);
    if (!config?.enabled) { setMessage(config?.reason || '서버의 소셜 로그인 설정 확인이 필요합니다.'); return; }
    setBusy(true); setMessage('');
    try { setFlow(await api.socialStart(id)); setMessage('인증 창에서 로그인한 뒤 이 앱으로 돌아오세요.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '로그인 시작 실패'); }
    finally { setBusy(false); }
  }
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    {needsConsent && flow && <PrivacyConsent onAgree={async()=>{await api.socialConsent(flow.flowId,flow.pollSecret);const result=await api.socialResult(flow.flowId,flow.pollSecret);if(result.status!=='complete')throw new Error('로그인 상태를 확인해 주세요.');setFlow(null);setNeedsConsent(false);await authenticated.current(result);}} onDecline={()=>{setFlow(null);setNeedsConsent(false);setMessage('동의하지 않았습니다. 게스트로 이용할 수 있습니다.');}}/>}
    {([{id:'kakao',label:'카카오 로그인',bg:'#FEE500'},{id:'google',label:'Google 로그인',bg:'#fff'}] as const).map(provider=>
      <button key={provider.id} disabled={busy||Boolean(flow)||!providers.find(item=>item.id===provider.id)?.enabled} onClick={()=>void start(provider.id)}
        style={{height:50,padding:'0 18px',borderRadius:12,background:provider.bg,color:'#1c1c1e',border:'1px solid transparent',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',position:'relative',cursor:'pointer'}}>
        {provider.id==='google'?<img src={googleLogo} alt="" style={{width:20,height:20}}/>:<span aria-hidden="true" style={{width:22,height:22,display:'block',overflow:'hidden',position:'relative'}}><img src={kakaoButton} alt="" style={{position:'absolute',width:300,height:45,maxWidth:'none',left:-12,top:-11}}/></span>}
        <span style={{flex:1,textAlign:'center',paddingRight:20}}>{provider.label}</span>
      </button>)}
    {flow && <><button onClick={()=>void openExternal(flow.authorizationUrl)} style={{padding:12,borderRadius:12}}>인증 창 열기 ↗</button><button onClick={()=>{setFlow(null);setMessage('로그인을 취소했습니다.');}}>로그인 취소</button></>}
    {message && <p role="status" style={{color:'white',fontSize:12,lineHeight:1.6}}>{message}</p>}
  </div>;
}
