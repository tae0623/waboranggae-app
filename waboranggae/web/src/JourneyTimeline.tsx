import type { RankedCourse, RouteSegment } from '../../src/types/travel';
import { formatMinutes } from './parity';
import { mediaUrl } from './runtime';

const category:Record<string,[string,string]>={nature:['자연','#059669'],food:['식사','#c2611f'],cafe:['카페','#92400e'],market:['시장','#5b21b6'],history:['역사','#dc2626'],culture:['문화','#0e7490']};
export function Stars({score}:{score:number}) {
  const value=Math.max(0,Math.min(100,Number.isFinite(score)?score:0));
  return <span className="score-stars" role="img" aria-label={`${(value/20).toFixed(1)} / 5점`}><span aria-hidden="true">★★★★★</span><span aria-hidden="true" className="filled" style={{width:value+'%'}}>★★★★★</span></span>;
}
export function TransitLeg({segment,access=false}:{segment?:RouteSegment|null;access?:boolean}) {
  return <div className={'transit-leg '+(access?'access-leg':'')}>
    <div className="transit-leg-heading"><strong>{access?'도시 간 이동':'이동'} {segment?formatMinutes(segment.totalMinutes):'시간 미확인'}</strong><span>{access?'현지 코스 시간 별도':segment?.source==='kakao'?'경로 조회':'추정 구간'}</span></div>
    {segment?.steps?.length ? segment.steps.map((s,i)=><div key={i} className={'transit-step mode-'+s.mode}>
      <span className="step-symbol" aria-hidden="true">{s.mode==='walk'?'↗':s.mode==='other'?'·':'▣'}</span><div>
        {s.fromStop&&<strong>{s.fromStop} {s.mode==='walk'?'출발':'승차'}</strong>}
        <div className="step-route">{(s.routes?.length?s.routes:s.route?[s.route]:[]).map(route=><b key={route}>{route}</b>)}<span>{formatMinutes(s.minutes)}</span></div>
        <p>{s.label}</p>{s.toStop&&<strong>{s.toStop} {s.mode==='walk'?'도착':'하차'}</strong>}
        {(s.stops?.length||0)>2&&<details><summary>경유 정류장 보기</summary><p>{s.stops!.join(' → ')}</p></details>}
      </div></div>) : segment?.instruction ? <p>{segment.instruction}</p> : <p>이 구간의 상세 경로를 확인하지 못했어요.</p>}
  </div>;
}
export function JourneyTimeline({course,images=false,onPlace}:{course:RankedCourse;images?:boolean;onPlace?:(index:number)=>void}) {
  return <div className="journey-timeline">
    {course.accessTrip&&<div className="journey-node access-node"><span className="journey-dot">출</span><div className="journey-content"><div className="journey-place"><small>도시로 이동</small><strong>{course.accessTrip.origin.name}</strong><p>{course.accessTrip.origin.address}</p></div><TransitLeg segment={course.accessTrip.segment} access/></div></div>}
    {course.origin&&<div className="journey-node"><span className="journey-dot">출</span><div className="journey-content"><div className="journey-place"><small>현지 여행 시작</small><strong>{course.origin.name}</strong><p>{course.origin.address}</p></div></div></div>}
    {course.places.map((p,i)=>{const [label,color]=category[p.category]||['방문','#636366'];return <div className="journey-node" key={p.id}>
      <span className="journey-dot" style={{background:color}}>{i+1}</span><div className="journey-content"><TransitLeg segment={course.routeSegments?.[i]}/>
        <div className="journey-place">{images&&p.imageUrl&&<img src={mediaUrl(p.imageUrl)||undefined} alt={p.name} loading="lazy"/>}
          <div className="place-meta"><span>{p.arrival}</span><span style={{color,background:color+'14'}}>{label}</span><small>{p.stayMinutes}분 체류</small></div>
          {onPlace?<button className="place-title" onClick={()=>onPlace(i)}>{p.name} <span>지도에서 보기 ↗</span></button>:<strong>{p.name}</strong>}
          <p>{p.address}</p><p className="place-description">{p.description}</p>
        </div></div></div>;})}
  </div>;
}
