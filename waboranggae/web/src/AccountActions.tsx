import { useState } from 'react';
import { api } from './api';
import { apiUrl, openExternal } from './runtime';
export function AccountActions({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function remove() {
    setBusy(true); setError('');
    try { await api.deleteAccount(); onDeleted(); }
    catch (e) { setError(e instanceof Error ? e.message : '삭제 요청 실패'); }
    finally { setBusy(false); }
  }
  return <section style={{marginTop:24,fontSize:12,color:'#636366'}}>
    <button onClick={()=>void openExternal(new URL(apiUrl('/legal/privacy'), window.location.origin).href)}>개인정보 처리 안내 ↗</button>
    <button onClick={()=>setConfirming(true)} style={{marginLeft:14,color:'#b91c1c'}}>계정 삭제</button>
    {confirming && <div role="alertdialog" aria-label="계정 삭제 확인" style={{background:'white',padding:16,marginTop:12,borderRadius:14}}>
      <p>계정, 북마크, 검색 이력, 앱 내 소셜 로그인 연결 정보가 삭제되며 복구할 수 없습니다. 카카오·구글 계정 자체는 삭제되지 않습니다.</p>
      <button disabled={busy} onClick={()=>setConfirming(false)}>취소</button>
      <button disabled={busy} onClick={()=>void remove()} style={{marginLeft:12,color:'#b91c1c'}}>{busy?'삭제 중…':'확인하고 영구 삭제'}</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
