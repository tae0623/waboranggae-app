import { RankedCourse } from '../types/travel';

/** Public POI metadata only. The URL fragment is never sent to server logs. */
export function mapPayload(course: RankedCourse) {
  return {
    origin: course.origin,
    places: course.places.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map(p => ({ name: p.name, latitude: p.latitude, longitude: p.longitude,
        address: p.address, arrival: p.arrival, description: p.description, imageUrl: p.imageUrl })),
    routeSegments: course.routeSegments,
    accessTrip: course.accessTrip,
    conveniences: course.conveniences,
  };
}

export function mapEmbedUrl(course: RankedCourse, baseUrl?: string, parentOrigin?:string) {
  return baseUrl ? `${baseUrl}/maps/embed#${encodeURIComponent(JSON.stringify({...mapPayload(course),parentOrigin}))}` : undefined;
}

/** A real registered origin also works in native WebViews, unlike srcDoc. */
export function buildKakaoMapHtml(javascriptKey: string) {
  const safeKey = JSON.stringify(javascriptKey).replace(/</g, '\\u003c');
  const sdkUrl = 'https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=' + encodeURIComponent(javascriptKey);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
html,body,#map{height:100%;margin:0;font:13px sans-serif;background:#edf3ea}
#message{position:absolute;z-index:20;top:10px;left:10px;right:10px;padding:10px;border-radius:10px;background:#fff;color:#254738}
#source{position:absolute;z-index:10;top:8px;right:8px;background:white;padding:7px;border-radius:8px;font-size:11px}
.pin{border:2px solid white;border-radius:50%;background:#0D5C45;color:white;width:28px;height:28px;font-weight:bold;cursor:pointer}
.origin{background:#E4572E;border-radius:8px}.locker{background:#A35025}
.popup{background:white;border-radius:12px;padding:12px;width:220px;box-shadow:0 3px 15px #0004;white-space:normal}
.popup img{display:block;width:220px;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px}
.popup strong{display:block;color:#17352c}.popup p{font-size:11px;line-height:1.5;margin:6px 0;color:#596c63}.popup a{color:#096348}
#fallback{padding:68px 12px 12px;display:none}#fallback .popup{margin:0 auto 12px}
#detail{display:none;position:absolute;z-index:30;left:10px;top:40px;max-height:calc(100% - 50px);overflow:auto;border-radius:12px;box-shadow:0 3px 15px #0004;background:white}
#detail img{height:96px}#detail p{max-height:42px;overflow:auto}#detail .popup{box-shadow:none}
</style></head><body><div id="map"></div><div id="source">실선: 조회 경로 · 점선: 연결선</div>
<div id="message">카카오 지도를 불러오는 중입니다.</div><div id="detail"></div><div id="fallback"></div>
<script>
let data={places:[]};
try{data=JSON.parse(decodeURIComponent(location.hash.slice(1)))}catch{}
const valid=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
const places=Array.isArray(data.places)?data.places.filter(valid):[];
const origin=valid(data.origin)?data.origin:null;
let parentOrigin=location.origin;
try{if(data.parentOrigin){const u=new URL(data.parentOrigin);if(u.protocol==='https:'||['localhost','127.0.0.1'].includes(u.hostname))parentOrigin=u.origin;}}catch{}
const sendPoint=p=>{if(data.selectDeparture===true&&valid(p)&&window.parent!==window)window.parent.postMessage({type:'ddubugi:map-point',point:{latitude:p.latitude,longitude:p.longitude,name:p.name}},parentOrigin);};
const safeUrl=v=>{if(typeof v!=='string'||!v)return null;try{const u=new URL(v,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
function card(p,label){
  const box=document.createElement('div');box.className='popup';
  let url=safeUrl(p.imageUrl);
  // TourAPI returns HTTP images too. Use the same authenticated HTTPS proxy as cards.
  if(url&&new URL(url).hostname==='tong.visitkorea.or.kr')url=location.pathname.replace(/\\/maps\\/embed$/,'')+'/api/media/tour-image?url='+encodeURIComponent(url);
  if(url){const img=document.createElement('img');img.src=url;img.alt=p.name+' 관광 이미지';img.loading='eager';
    img.onerror=()=>{img.style.display='none'};box.appendChild(img);}
  const title=document.createElement('strong');title.textContent=label;box.appendChild(title);
  const meta=document.createElement('p');meta.textContent=[p.arrival,p.address,p.description].filter(Boolean).join(' · ');box.appendChild(meta);
  const link=document.createElement('a');link.textContent='카카오맵에서 장소 보기';link.href='https://map.kakao.com/link/map/'+encodeURIComponent(p.name)+','+p.latitude+','+p.longitude;link.target='_blank';link.rel='noopener noreferrer';box.appendChild(link);
  if(data.selectDeparture===true){link.remove();const choose=document.createElement('button');choose.textContent='여기서 출발';choose.onclick=()=>sendPoint(p);box.appendChild(choose);}
  return box;
}
function fallback(text){
  clearTimeout(timer);
  document.getElementById('message').textContent=text;document.getElementById('map').style.display='none';document.getElementById('source').style.display='none';
  const list=document.getElementById('fallback');list.style.display='block';list.replaceChildren();
  if(origin)list.appendChild(card(origin,'출발 · '+origin.name));
  places.forEach((p,i)=>list.appendChild(card(p,(i+1)+'. '+p.name)));
}
let ready=false;
const timer=setTimeout(()=>{if(!ready)fallback('지도를 불러오지 못했습니다. 장소 정보와 카카오맵 바로가기를 이용해 주세요.');},12000);
function init(){
 try{
  if(!origin&&!places.length){fallback('지도에 표시할 장소를 선택해 주세요.');return;}
  document.getElementById('message').style.display='none';
  document.getElementById('fallback').style.display='none';document.getElementById('map').style.display='block';document.getElementById('source').style.display='block';
  const point=p=>new kakao.maps.LatLng(p.latitude,p.longitude);
  const map=new kakao.maps.Map(document.getElementById('map'),{center:point(origin||places[0]),level:5});
  map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);
  const bounds=new kakao.maps.LatLngBounds();
  const detail=document.getElementById('detail');let closeTimer;const openPlace=[];
  const hide=()=>{detail.style.display='none';detail.replaceChildren()};
  detail.addEventListener('mouseenter',()=>clearTimeout(closeTimer));
  detail.addEventListener('mouseleave',()=>{closeTimer=setTimeout(hide,250)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide()});
  function marker(p,label,number,cls){
    bounds.extend(point(p));const button=document.createElement('button');button.className='pin '+cls;button.textContent=number;button.setAttribute('aria-label',label);
    new kakao.maps.CustomOverlay({position:point(p),content:button,map,yAnchor:0.5,zIndex:3});
    const content=card(p,label);
    const closeButton=document.createElement('button');closeButton.textContent='닫기';closeButton.setAttribute('aria-label','관광지 정보 닫기');closeButton.style.cssText='float:right;margin-left:8px';closeButton.onclick=hide;content.appendChild(closeButton);
    const open=()=>{clearTimeout(closeTimer);detail.replaceChildren(content);detail.style.display='block'};
    const close=()=>{closeTimer=setTimeout(hide,250)};
    button.addEventListener('mouseenter',open);button.addEventListener('mouseleave',close);button.addEventListener('click',open);
    return open;
  }
  if(origin)marker(origin,'출발 · '+origin.name,'출','origin');
  places.forEach((p,i)=>openPlace.push(marker(p,(i+1)+'. '+p.name,String(i+1),'')));
  (Array.isArray(data.conveniences)?data.conveniences:[]).filter(valid).forEach(p=>marker(p,'물품보관함 · '+p.name,'짐','locker'));
  const points=[...(origin?[origin]:[]),...places];
  const lines=Array.isArray(data.routeSegments)&&data.routeSegments.length?data.routeSegments:[{source:'estimated',geometry:points}];
  const detailedLines=lines.flatMap(line=>line.source==='kakao'&&line.steps?.some(s=>s.geometry?.length>1)?line.steps.filter(s=>s.geometry?.length>1).map(s=>({...s,source:'kakao'})):[line]);
  detailedLines.forEach(line=>{const coords=(line.geometry||[]).filter(valid);if(coords.length<2)return;
    const live=line.source==='kakao';
    coords.forEach(p=>bounds.extend(point(p)));
    new kakao.maps.Polyline({map,path:coords.map(point),strokeWeight:5,strokeColor:live?(line.mode==='walk'?'#64748b':'#15803d'):'#85968c',strokeOpacity:0.85,strokeStyle:live?'solid':'shortdash'});});
  const access=data.accessTrip;
  if(access&&valid(access.origin)){
    marker(access.origin,'도시 간 출발 · '+access.origin.name,'출','origin');
    const segment=access.segment;
    const parts=segment?.source==='kakao'&&segment.steps?.some(s=>s.geometry?.length>1)?segment.steps.filter(s=>s.geometry?.length>1).map(s=>s.geometry):[segment?.geometry||[access.origin,origin]];
    parts.forEach(part=>{const coords=part.filter(valid);coords.forEach(p=>bounds.extend(point(p)));if(coords.length>1)new kakao.maps.Polyline({map,path:coords.map(point),strokeWeight:4,strokeColor:'#818cf8',strokeOpacity:.75,strokeStyle:segment?.source==='kakao'?'solid':'shortdash'});});
    // Include both intercity access and the local route in the initial bounds.
  }
  if(data.selectDeparture===true)kakao.maps.event.addListener(map,'click',e=>sendPoint({latitude:e.latLng.getLat(),longitude:e.latLng.getLng()}));
  window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==parentOrigin)return;const i=event.data?.index;
    if(event.data?.type==='ddubugi:focus-place'&&Number.isInteger(i)&&i>=0&&i<places.length){map.panTo(point(places[i]));openPlace[i]?.();}});
  // A single departure marker needs a useful street-scale zoom, not empty bounds.
  const fit=()=>{if(points.length>1)map.setBounds(bounds,35,35,35,35);else{map.setCenter(point(points[0]));map.setLevel(4);}};
  fit();ready=true;clearTimeout(timer);
  window.addEventListener('resize',()=>{map.relayout();fit()});
 }catch{fallback('카카오 지도 설정을 확인해 주세요. 카카오맵 바로가기는 계속 사용할 수 있습니다.');}
}
if(!${safeKey}){clearTimeout(timer);fallback('카카오 지도 키 설정 대기 중 · 장소 정보와 바로가기를 이용할 수 있습니다.');}
else{const script=document.createElement('script');script.src=${JSON.stringify(sdkUrl)};script.onload=()=>{if(window.kakao?.maps)kakao.maps.load(init);else fallback('카카오 지도 사용 설정과 등록 도메인을 확인해 주세요.');};script.onerror=()=>fallback('카카오 지도 연결 실패 · 등록 도메인과 키를 확인해 주세요.');document.head.appendChild(script);}
</script></body></html>`;
}
