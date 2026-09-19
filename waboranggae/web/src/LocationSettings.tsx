import {useEffect,useState} from 'react';
import {Modal} from './Dialogs';
import type {PlaceSuggestion} from './api';
const KEY='ddubugi.location-consent';
function enabled(){try{return localStorage.getItem(KEY)==='allowed';}catch{return false;}}
function choose(value:boolean){try{localStorage.setItem(KEY,value?'allowed':'declined');}catch{}window.dispatchEvent(new Event('ddubugi:location-choice'));}
export function LocationSetting(){
 const [active,setActive]=useState(enabled),[notice,setNotice]=useState(false);
 return <section className="settings-card"><h2>위치 기반 서비스</h2><p>검색 결과가 비슷할 때 가까운 장소부터 보여드려요.</p><button className="settings-row" onClick={()=>{if(active){choose(false);setActive(false);}else setNotice(true);}}>{active?'위치 기반 서비스 해제':'위치 기반 서비스 이용'}<span>{active?'켜짐':'꺼짐'}</span></button>
 {notice&&<Modal title="위치 기반 서비스" onClose={()=>setNotice(false)}><p>[선택] 위치는 이 화면에서 검색 결과를 정렬할 때만 사용하며 앱 서버나 지도에 보내지 않습니다. 화면을 닫으면 위치를 지웁니다. 브라우저의 위치 권한도 허용해야 합니다.</p><div className="dialog-actions"><button onClick={()=>setNotice(false)}>취소</button><button className="primary" onClick={()=>{choose(true);setActive(true);setNotice(false);}}>동의</button></div></Modal>}</section>;
}
/** Coordinates remain in this component's memory; never serialized, cached or sent to a map. */
export function useLocalDepartureOrder(places:PlaceSuggestion[],query:string){
 const [allowed,setAllowed]=useState(enabled),[point,setPoint]=useState<{lat:number;lng:number}|null>(null);
 useEffect(()=>{const change=()=>{setAllowed(enabled());setPoint(null);};window.addEventListener('ddubugi:location-choice',change);return()=>window.removeEventListener('ddubugi:location-choice',change);},[]);
 useEffect(()=>{let active=true;if(!allowed||!navigator.geolocation){setPoint(null);return;}
 navigator.geolocation.getCurrentPosition(p=>{if(active)setPoint({lat:p.coords.latitude,lng:p.coords.longitude});},()=>{if(active)setPoint(null);},{enableHighAccuracy:false,timeout:4500,maximumAge:120000});
 return()=>{active=false;};},[allowed]);
 if(!allowed||!point)return places;
 const normal=(s:string)=>s.replace(/\s/g,'').toLowerCase(),q=normal(query);
 const relevance=(p:PlaceSuggestion)=>normal(p.name)===q?0:normal(p.name).startsWith(q)?1:normal(p.name).includes(q)?2:3;
 const distance=(p:PlaceSuggestion)=>(p.latitude-point.lat)**2+((p.longitude-point.lng)*Math.cos(point.lat*Math.PI/180))**2;
 return [...places].sort((a,b)=>relevance(a)-relevance(b)||distance(a)-distance(b));
}
