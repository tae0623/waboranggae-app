import { useEffect, useRef, useState } from 'react';
import { api, type AuthResponse } from './api';
import { reserveSocialWindow, type SocialWindow, type SocialProvider } from './socialWindow';
import { PrivacyConsent } from './PrivacyConsent';
import googleLogo from '../../android-native/app/src/main/res/drawable-nodpi/google_signin_logo.png';
import kakaoButton from '../../android-native/app/src/main/res/drawable-nodpi/kakao_login_official.png';
export function SocialLoginButtons({ onAuthenticated }: { onAuthenticated: (result: AuthResponse) => Promise<void> }) {
  const authenticated=useRef(onAuthenticated);authenticated.current=onAuthenticated;
  const [providers, setProviders] = useState<Array<{id: string; enabled: boolean; reason: string}>>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsConsent,setNeedsConsent]=useState(false);
  const [flow, setFlow] = useState<{flowId: string; pollSecret: string; authorizationUrl: string; provider:SocialProvider} | null>(null);
  const [popupBlocked,setPopupBlocked]=useState(false);
  const popup=useRef<SocialWindow|null>(null),startSequence=useRef(0);
  useEffect(()=>()=>{startSequence.current++;popup.current?.close();},[]);
  function cancel(){startSequence.current++;popup.current?.close();popup.current=null;setBusy(false);setFlow(null);setPopupBlocked(false);setMessage('로그인을 취소했습니다.');}
  useEffect(() => { let active = true; api.socialProviders().then(result => { if (active) setProviders(result.providers); }).catch(() => { if (active) setMessage('소셜 로그인 설정을 확인할 수 없습니다.'); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!flow || needsConsent) return;
    let active = true, running = false;
    const deadline = Date.now() + 5 * 60_000;
    const poll = async () => {
      if (running || !active) return;
      if (Date.now() > deadline) { popup.current?.close();setFlow(null); setMessage('로그인 시간이 만료되었습니다. 다시 시작해 주세요.'); return; }
      running = true;
      try {
        const result = await api.socialResult(flow.flowId, flow.pollSecret);
        if(active && result.status==='consent_required'){popup.current?.close();setNeedsConsent(true);return;}
        if (active && result.status === 'complete') { clearInterval(timer); popup.current?.close();setFlow(null); await authenticated.current(result); }
      } catch (error) { if (active) { popup.current?.close();setFlow(null); setMessage(error instanceof Error ? error.message : '로그인 실패'); } }
      finally { running = false; }
    };
    const timer = setInterval(() => void poll(), 3000);
    const onReturn = () => void poll();
    window.addEventListener('focus', onReturn);
    let channel: BroadcastChannel | undefined;
    try { channel = new BroadcastChannel('ddubugi-social-return');
      // This is only a wake-up signal. The polling secret and server response
      // remain mandatory; a completion page cannot sign the browser in.
      channel.onmessage = event => { if (event.data === 'check-pending-login') void poll(); };
    } catch { /* Polling also works without BroadcastChannel. */ }
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', onReturn); channel?.close(); };
  }, [flow, needsConsent]);
  async function start(id: 'kakao' | 'google') {
    if(busy||flow)return;
    const config = providers.find(item => item.id === id);
    if (!config?.enabled) { setMessage(config?.reason || '서버의 소셜 로그인 설정 확인이 필요합니다.'); return; }
    const sequence=++startSequence.current;
    popup.current?.close();const reserved=reserveSocialWindow(id);popup.current=reserved;
    setBusy(true); setMessage('');setPopupBlocked(false);
    try {
      const next=await api.socialStart(id);
      if(sequence!==startSequence.current){reserved.close();return;}
      const opened=await reserved.navigate(next.authorizationUrl);
      if(sequence!==startSequence.current){reserved.close();return;}
      setFlow({...next,provider:id});setPopupBlocked(!opened);
      setMessage(opened?'인증 창에서 로그인을 진행해 주세요.':'팝업이 차단됐어요. 아래 버튼으로 인증 창을 열어 주세요.');
    }
    catch (error) { reserved.close();if(sequence===startSequence.current)setMessage(error instanceof Error ? error.message : '로그인 시작 실패'); }
    finally { if(sequence===startSequence.current)setBusy(false); }
  }
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    {needsConsent && flow && <PrivacyConsent onAgree={async()=>{await api.socialConsent(flow.flowId,flow.pollSecret);const result=await api.socialResult(flow.flowId,flow.pollSecret);if(result.status!=='complete')throw new Error('로그인 상태를 확인해 주세요.');setFlow(null);setNeedsConsent(false);await authenticated.current(result);}} onDecline={()=>{setFlow(null);setNeedsConsent(false);setMessage('동의하지 않았습니다. 게스트로 이용할 수 있습니다.');}}/>}
    {([{id:'kakao',label:'카카오 로그인',bg:'#FEE500'},{id:'google',label:'Google 로그인',bg:'#fff'}] as const).map(provider=>
      <button key={provider.id} disabled={busy||Boolean(flow)||!providers.find(item=>item.id===provider.id)?.enabled} onClick={()=>void start(provider.id)}
        style={{height:50,padding:'0 18px',borderRadius:12,background:provider.bg,color:'#1c1c1e',border:'1px solid transparent',fontSize:15,fontWeight:600,display:'flex',alignItems:'center',position:'relative',cursor:'pointer'}}>
        {provider.id==='google'?<img src={googleLogo} alt="" style={{width:20,height:20}}/>:<span aria-hidden="true" style={{width:22,height:22,display:'block',overflow:'hidden',position:'relative'}}><img src={kakaoButton} alt="" style={{position:'absolute',width:300,height:45,maxWidth:'none',left:-12,top:-11}}/></span>}
        <span style={{flex:1,textAlign:'center',paddingRight:20}}>{provider.label}</span>
      </button>)}
    {flow&&popupBlocked&&<button onClick={()=>{popup.current?.close();const reserved=reserveSocialWindow(flow.provider);popup.current=reserved;void reserved.navigate(flow.authorizationUrl).then(opened=>{setPopupBlocked(!opened);if(opened)setMessage('인증 창에서 로그인을 진행해 주세요.');}).catch(()=>setMessage('인증 창을 열지 못했어요. 다시 로그인해 주세요.'));}} style={{padding:12,borderRadius:12}}>인증 창 다시 열기 ↗</button>}
    {(flow||busy)&&<button onClick={cancel}>로그인 취소</button>}
    {message && <p role="status" style={{color:'white',fontSize:12,lineHeight:1.6}}>{message}</p>}
  </div>;
}
