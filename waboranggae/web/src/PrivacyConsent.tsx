import { useState } from 'react';
import { ACCOUNT_CONSENT_TEXT, PRIVACY_NOTICE_VERSION, PRIVACY_OPERATOR_NAME, SUPPORT_EMAIL } from '../../src/domain/privacyNotice';
export function PrivacyConsent({ onAgree, onDecline, onDelete }: { onAgree: () => Promise<void>; onDecline: () => void; onDelete?: () => Promise<void> }) {
  const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function act(action:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'요청 실패');}finally{setBusy(false);}}
  return <section role="dialog" aria-modal="true" aria-label="개인정보 수집 이용 동의" style={{position:'absolute',inset:0,zIndex:1000,overflowY:'auto',background:'#fff',color:'#1C1C1E',padding:24,lineHeight:1.7}}>
    <h2>처음 이용 전 확인해 주세요</h2>
    <p>최초 이용이거나 새 동의가 필요한 계정입니다. 같은 버전에 동의하면 다음 로그인에서는 다시 묻지 않습니다.</p>
    <p>운영자: {PRIVACY_OPERATOR_NAME}<br/>문의: {SUPPORT_EMAIL}<br/>안내 버전: {PRIVACY_NOTICE_VERSION}</p>
    <p>{ACCOUNT_CONSENT_TEXT}</p>
    <p>동의 전 신규 계정은 만들지 않습니다. 소셜 인증 정보는 임시 DB에 암호화하여 저장하고 5분 뒤 만료·정리합니다. 서버 중단 시 삭제는 재개 후 수행됩니다.</p>
    <p><a href="/legal/privacy" target="_blank" rel="noreferrer">전체 개인정보 수집·이용 안내</a></p>
    <label><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/> 위 개인정보 수집·이용에 동의합니다.</label>
    <p><button disabled={!checked||busy} onClick={()=>void act(onAgree)}>동의하고 계속하기</button></p>
    <p><button disabled={busy} onClick={onDecline}>동의하지 않고 게스트로 이용</button></p>
    {onDelete&&<><p>게스트 전환은 기존 계정 삭제가 아닙니다. 기존 계정 삭제는 새 동의 없이 가능합니다.</p><button disabled={busy} onClick={()=>{if(window.confirm('계정과 저장한 여행 정보를 영구 삭제할까요? 복구할 수 없습니다.'))void act(onDelete);}}>기존 계정 삭제</button></>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
