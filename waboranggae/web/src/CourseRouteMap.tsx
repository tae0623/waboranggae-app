import { useState } from 'react';
import type { RankedCourse, RouteSegment, TravelMode } from '../../src/types/travel';
import { courseLeg, courseLegKey, kakaoDirectionsUrl, withVerifiedMapSegments } from '../../src/domain/kakaoLinks';
import { mapEmbedUrl } from '../../src/domain/kakaoMapHtml';
import { api } from './api';
import { getWebRuntime, openExternal } from './runtime';

export function CourseRouteMap({ course }: { course?: RankedCourse }) {
  const [verified, setVerified] = useState<Record<string, RouteSegment>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<TravelMode>('transit');
  if (!course) return <p>지도에 표시할 실제 코스 정보가 없습니다. 조건으로 다시 추천받아 주세요.</p>;
  const base = getWebRuntime().mapBaseUrl || window.location.origin;
  const mapCourse = withVerifiedMapSegments(course, verified);
  const src = mapEmbedUrl(mapCourse, base);
  async function lookup(index: number) {
    const leg = courseLeg(course!, index);
    if (!leg || busy) return;
    const key = courseLegKey(course!, index);
    setBusy(true);
    try {
      const result = await api.routeSegment(leg.from, leg.to, mode);
      setNotice(result.notice);
      setVerified(previous => { const next = {...previous}; if (result.segment) next[key] = result.segment; else delete next[key]; return next; });
    } catch (error) { setNotice(error instanceof Error ? error.message : '구간 조회 실패'); }
    finally { setBusy(false); }
  }
  return <section style={{background:'white', borderRadius:18, overflow:'hidden'}}>
    <iframe key={src} src={src} title={`${course.title} 카카오 지도`} style={{width:'100%',height:300,border:0}} />
    <div style={{padding:12,fontSize:12,lineHeight:1.6}}>
      <p>출발: {course.origin?.name || '출발 좌표 미확인'} · 점선은 예상 구간, 실선은 조회한 경로입니다.</p>
      <label>길찾기 방식 <select aria-label="길찾기 방식" value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as TravelMode);setVerified({});setNotice('');}}>
        <option value="transit">대중교통</option><option value="walk">도보</option>
      </select></label>
      {course.places.map((place,index)=>{
        const leg=courseLeg(course,index); if(!leg)return null;
        const result=verified[courseLegKey(course,index)];
        return <div key={courseLegKey(course,index)} style={{borderTop:'1px solid #eee',paddingTop:8,marginTop:8}}>
          <div>{leg.from.name} → {leg.to.name}</div>
          <button onClick={() => void openExternal(kakaoDirectionsUrl(leg.from,leg.to,mode))}>카카오맵 길찾기 ↗</button>
          <button disabled={busy} onClick={()=>void lookup(index)} style={{marginLeft:10,padding:'5px 8px'}}>구간 조회</button>
          {result&&<div>{result.totalMinutes}분 · 도보 {result.walkMinutes}분 / 대중교통 {result.transitMinutes}분<br/>{result.instruction}</div>}
        </div>;
      })}
      {notice&&<p role="status">{notice}</p>}
      <p>전체 여행 시간표는 예상값입니다. 출발 전에 실제 배차와 경로를 다시 확인하세요.</p>
    </div>
  </section>;
}
