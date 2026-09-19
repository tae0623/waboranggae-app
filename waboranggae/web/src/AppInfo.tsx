import { useState } from 'react';
import { Modal } from './Dialogs';
import {apiUrl,openExternal} from './runtime';
import {version} from '../../package.json';
export function AppInfo() {
  const [open,setOpen]=useState(false);
  return <><button className="app-info-button" onClick={()=>setOpen(true)}>앱 정보 <span>›</span></button>{open&&<Modal title="뚜버기" onClose={()=>setOpen(false)}>
    <p data-testid="app-version">앱 버전 v{version}</p>
    <p>대중교통과 도보로 떠나는 전남 여행</p><p>뚜버기 Team (administrator: Taeyoung Ko)<br/>waboranggae.help@gmail.com</p>
    <button onClick={()=>setOpen(false)}>닫기</button></Modal>}</>;
}
export function LegalLinks(){
 return <section className="settings-card"><h3>개인정보·데이터·오픈소스 안내</h3><p>관광정보·사진: 한국관광공사 · 지도: 카카오 · 날씨: 기상청</p>
 <button className="settings-row" onClick={()=>void openExternal(new URL(apiUrl('/legal/privacy'),window.location.origin).href)}>개인정보처리방침 <span>↗</span></button>
 <button className="settings-row" onClick={()=>void openExternal(new URL(apiUrl('/legal/attributions'),window.location.origin).href)}>데이터·이미지·오픈소스 출처 <span>↗</span></button></section>;
}
