import { useEffect, useState } from 'react';
import { Modal } from './Dialogs';
import { api, type AuthUser } from './api';
import { apiUrl, openExternal } from './runtime';
export function AccountActions({ onDeleted,user,onProfile }: { onDeleted: () => void;user:AuthUser|null;onProfile:(user:AuthUser)=>void }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [nickname,setNickname]=useState(user?.displayName||''),[message,setMessage]=useState('');
  useEffect(()=>setNickname(user?.displayName||''),[user?.displayName]);
  async function rename(){
    if(busy)return;setBusy(true);setError('');setMessage('');
    try {onProfile(await api.updateProfile(nickname.trim()));setMessage('닉네임을 수정했어요.');}
    catch(e){setError(e instanceof Error?e.message:'닉네임을 수정하지 못했어요.');}finally{setBusy(false);}
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api.deleteAccount(); onDeleted(); }
    catch (e) { setError(e instanceof Error ? e.message : '삭제 요청 실패'); }
    finally { setBusy(false); }
  }
  return <section style={{marginTop:24,fontSize:12,color:'#636366'}}>
    <label className="field-label" htmlFor="nickname">닉네임</label><input id="nickname" value={nickname} maxLength={50} onChange={e=>setNickname(e.target.value)} disabled={busy}/><button disabled={busy||nickname.trim().length<2} onClick={()=>void rename()}>닉네임 수정</button>{message&&<p role="status">{message}</p>}
    <button onClick={()=>void openExternal(new URL(apiUrl('/legal/privacy'), window.location.origin).href)}>개인정보 처리 안내 ↗</button>
    <button onClick={()=>setConfirming(true)} style={{marginLeft:14,color:'#b91c1c'}}>계정 삭제</button>
    {confirming && <Modal title="계정 삭제" onClose={()=>{if(!busy)setConfirming(false)}}>
      <p>계정, 북마크, 검색 이력, 앱 내 소셜 로그인 연결 정보가 삭제되며 복구할 수 없습니다. 카카오·구글 계정 자체는 삭제되지 않습니다.</p>
      <div className="dialog-actions"><button disabled={busy} onClick={()=>setConfirming(false)}>취소</button>
      <button disabled={busy} onClick={()=>void remove()} style={{marginLeft:12,color:'#b91c1c'}}>{busy?'삭제 중…':'확인하고 영구 삭제'}</button>
      </div>{error&&<p role="alert">{error}</p>}
    </Modal>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
