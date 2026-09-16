import { useEffect,useState } from 'react';
import { api,type HotPlace } from './api';
import { Modal } from './Dialogs';
export function AppInfo() {
  const [open,setOpen]=useState(false),[photos,setPhotos]=useState<HotPlace[]>([]);
  useEffect(()=>{if(!open)return;let active=true;api.hotPlaces().then(r=>{if(active)setPhotos(r.places)}).catch(()=>{});return()=>{active=false}},[open]);
  return <><button className="app-info-button" onClick={()=>setOpen(true)}>앱 정보 <span>›</span></button>{open&&<Modal title="뚜버기 · 앱 정보" onClose={()=>setOpen(false)}>
    <p>뚜버기 Team (administrator: Taeyoung Ko)<br/>waboranggae.help@gmail.com</p>
    <h3>데이터·이미지 출처</h3><p>관광정보·관광사진 © 한국관광공사(TourAPI·포토코리아)<br/>지역 수요: 한국관광공사 관광 데이터랩<br/>장소 검색·지도·길찾기 © Kakao<br/>여행일 예보: 기상청<br/>정류장·노선: 공공데이터포털<br/>홈·로그인 배경 사진: Unsplash</p>
    {photos.some(p=>p.imageCredit)&&<details><summary>홈 사진별 출처</summary>{photos.filter(p=>p.imageCredit).map(p=><p key={p.id}>{p.name} — {p.imageCredit}</p>)}</details>}
    <p>글꼴: Pretendard · SIL OFL 1.1<br/>지도·발자국 일러스트: 기존 웹 프로젝트 자산</p>
    <p><a href="/legal/attributions" target="_blank" rel="noreferrer">출처·이용 조건 전문</a></p><p><a href="/legal/privacy" target="_blank" rel="noreferrer">개인정보처리방침</a></p>
    <button onClick={()=>setOpen(false)}>닫기</button></Modal>}</>;
}
