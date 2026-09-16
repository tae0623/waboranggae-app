import { useState } from 'react';
import type { RankedCourse, TravelMode } from '../../src/types/travel';
import { courseLeg, kakaoDirectionsUrl } from '../../src/domain/kakaoLinks';
import { mapEmbedUrl } from '../../src/domain/kakaoMapHtml';
import { getWebRuntime, openExternal } from './runtime';

export function CourseRouteMap({ course }: { course?: RankedCourse }) {
  const [mode,setMode]=useState<TravelMode>('transit');
  if(!course)return <p>지도에 표시할 코스를 선택해 주세요.</p>;
  const src=mapEmbedUrl(course,getWebRuntime().mapBaseUrl||window.location.origin);
  return <section style={{background:'white',borderRadius:18,overflow:'hidden'}}>
    <iframe key={src} src={src} title={course.title+' 카카오 지도'} style={{width:'100%',height:300,border:0}}/>
    <div style={{padding:16,fontSize:12,lineHeight:1.6,color:'#1c1c1e'}}>
      <p>출발: {course.origin?.name||'출발 좌표 미확인'}</p>
      <label>카카오맵 길찾기 <select aria-label="길찾기 방식" value={mode} onChange={e=>setMode(e.target.value as TravelMode)} style={{border:'1px solid #e4e4e9',borderRadius:10,padding:8,marginLeft:8}}>
        <option value="transit">대중교통</option><option value="walk">도보</option>
      </select></label>
      {course.places.map((place,index)=>{
        const leg=courseLeg(course,index);if(!leg)return null;
        return <div key={place.id} style={{borderTop:'1px solid #eee',paddingTop:12,marginTop:12}}>
          <div>{leg.from.name} → {leg.to.name}</div>
          <button onClick={()=>void openExternal(kakaoDirectionsUrl(leg.from,leg.to,mode))} style={{border:'1px solid #e4e4e9',background:'#f2f4f8',color:'#1c1c1e',borderRadius:10,padding:'10px 14px',marginTop:8,cursor:'pointer'}}>카카오맵에서 길찾기 ↗</button>
        </div>;
      })}
      <p className="source-footer">점선은 예상 구간, 실선은 조회한 경로입니다. 실제 배차에 따라 달라질 수 있어요.</p>
    </div>
  </section>;
}
