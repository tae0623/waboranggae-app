import {useEffect,useRef,useState,type RefObject} from 'react';
/** Keep the same iframe mounted when expanding; map camera survives scrolling/resizing. */
export function ExpandableMap({src,title,frame:external,collapseKey}:{src:string;title:string;frame?:RefObject<HTMLIFrameElement|null>;collapseKey?:unknown}){
 const own=useRef<HTMLIFrameElement>(null),frame=external||own;
 const [expanded,setExpanded]=useState(false);const openButton=useRef<HTMLButtonElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setExpanded(false)},[collapseKey]);
 useEffect(()=>{if(!expanded)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();
   const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();setExpanded(false);requestAnimationFrame(()=>openButton.current?.focus())}};
   window.addEventListener('keydown',key,true);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',key,true)}
 },[expanded]);
 return <div className={'expandable-map '+(expanded?'is-expanded':'')} role={expanded?'dialog':undefined} aria-modal={expanded||undefined} aria-label={title}>
  {expanded&&<header><button ref={closeButton} aria-label="지도 확대 닫기" onClick={()=>{setExpanded(false);requestAnimationFrame(()=>openButton.current?.focus())}}>←</button><strong>{title}</strong></header>}
  <iframe ref={frame} src={src} title={title} tabIndex={expanded?0:-1} style={{pointerEvents:expanded?'auto':'none'}}/>
  {!expanded&&<button ref={openButton} className="map-expand-cover" aria-label="지도 크게 보기" onClick={()=>setExpanded(true)}><span>⛶ 지도 확대</span></button>}
 </div>
}
