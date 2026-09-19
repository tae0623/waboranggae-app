import type { RankedCourse, RouteSegment } from '../../src/types/travel';
import { formatMinutes } from './parity';
import { mediaUrl } from './runtime';

const category:Record<string,[string,string]>={nature:['자연','#059669'],food:['식사','#c2611f'],cafe:['카페','#92400e'],market:['시장','#5b21b6'],history:['역사','#dc2626'],culture:['문화','#0e7490']};
export function Stars({score}:{score:number}) {
  const value=Math.max(0,Math.min(100,Number.isFinite(score)?score:0));
  return <span className="score-stars" role="img" aria-label={`${(value/20).toFixed(1)} / 5점`}><span aria-hidden="true">★★★★★</span><span aria-hidden="true" className="filled" style={{width:value+'%'}}>★★★★★</span></span>;
}
export function TransitLeg({segment,access=false}:{segment?:RouteSegment|null;access?:boolean}){
 const groups:NonNullable<RouteSegment['steps']>[]= [];
 for(const step of segment?.steps||[]){const previous=groups.at(-1);if(step.mode==='walk'&&previous?.[0]?.mode==='walk')previous.push(step);else groups.push([step]);}
 return <div className={'transit-leg '+(access?'access-leg':'')}><div className="transit-leg-heading"><strong>{access?'도시 간 이동':'이동'} {segment?formatMinutes(segment.totalMinutes):'시간 미확인'}</strong><span>{access?'현지 코스 시간 별도':segment?.source==='kakao'?'조회 시점 기준':'추정 구간'}</span></div>
 {!groups.length&&<p>{segment?.instruction||'상세 경로를 확인하지 못했어요.'}</p>}
 {groups.map((steps,index)=><div key={index}>{index>0&&<div className="movement-arrow">↓</div>}{steps[0]?.mode==='walk'?<details className="transit-step mode-walk"><summary className="movement-summary">도보 · 약 {formatMinutes(steps.reduce((sum,s)=>sum+s.minutes,0))}</summary>{steps.map((s,i)=><p key={i}>{s.label}</p>)}</details>:steps.map((s,i)=><div key={i} className={'transit-step mode-'+s.mode}><div><span className="step-label-pill">{s.mode==='other'?'이동·대기':'승차'}</span>{s.fromStop&&<strong>{s.fromStop}</strong>}<div className="step-route">{(s.routes?.length?s.routes:s.route?[s.route]:[]).map(route=><b key={route}>{route}</b>)}<span>{formatMinutes(s.minutes)}</span></div><p>{s.label}</p>{s.toStop&&<strong>↓ 하차 · {s.toStop}</strong>}{(s.stops?.length||0)>2&&<details><summary>경유 정류장 보기</summary><p>{s.stops!.join(' → ')}</p></details>}</div></div>)}</div>)}
 </div>;
}
export function JourneyTimeline({course,images=false,onPlace: _onPlace}:{course:RankedCourse;images?:boolean;onPlace?:(index:number)=>void}) {
  return <div className="journey-timeline">
    {course.accessTrip&&<div className="journey-node access-node"><span className="journey-dot">출</span><div className="journey-content"><div className="journey-place"><small>도시로 이동</small><strong>{course.accessTrip.origin.name}</strong><p>{course.accessTrip.origin.address}</p></div><TransitLeg segment={course.accessTrip.segment} access/></div></div>}
    {course.origin&&<div className="journey-node"><span className="journey-dot">{course.accessTrip?1:'출'}</span><div className="journey-content"><div className="journey-place"><small>{course.accessTrip?'현지 도착':'현지 여행 시작'}</small><strong>{course.origin.name}</strong><p>{course.origin.address}</p></div></div></div>}
    {course.places.map((p,i)=>{const [label,color]=category[p.category]||['방문','#636366'];return <div className="journey-node" key={p.id}>
      <div className="journey-content"><TransitLeg segment={course.routeSegments?.[i]}/><div className="numbered-place"><span className="journey-dot" style={{background:color}}>{i+(course.accessTrip?2:1)}</span>
        <div className="journey-place">{images&&p.imageUrl&&<img src={mediaUrl(p.imageUrl)||undefined} alt={p.name} loading="lazy"/>}
          <div className="place-meta"><span>{p.arrival}</span><span style={{color,background:color+'14'}}>{label}</span><small>{p.stayMinutes}분 체류</small></div>
          <strong>{p.name}</strong>
          <p>{p.address}</p><p className="place-description">{p.description}</p>
        </div></div></div></div>;})}
  </div>;
}
