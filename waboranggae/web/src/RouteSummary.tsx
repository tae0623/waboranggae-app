import type { RankedCourse, TravelPreferences } from './api';
import { formatMinutes } from './parity';
import { useWeather } from './useWeather';
export function SourceFooter({home=false}:{home?:boolean}){
  return <div className="source-footer">관광정보·사진 © 한국관광공사 · 장소·지도·길찾기 © Kakao{home?' · 배경 사진: Unsplash':''}<br/><a href="/legal/attributions" target="_blank" rel="noreferrer">출처·이용 안내</a> · <a href="/legal/privacy" target="_blank" rel="noreferrer">개인정보 처리 안내</a></div>;
}
export function RouteSummary({course,preferences,busy,error,onRefresh,hideWeather=false}:{course?:RankedCourse;preferences:TravelPreferences|null;busy:boolean;error:string;onRefresh:()=>void;hideWeather?:boolean}){
  const weather=useWeather(hideWeather?undefined:course,preferences);
  if(!course)return null;
  const time=course.timeBreakdown,access=course.accessTrip;
  return <section className="route-status">
    <strong>현지 코스 예상 {formatMinutes(time?.totalMinutes??course.durationHours*60)}</strong>
    {access&&<details><summary>도시 간 이동 별도 {access.segment?'· 약 '+formatMinutes(access.segment.totalMinutes):'· 시간 미확인'}</summary><p>{access.origin.name} → {access.arrival.name}</p>{access.externalUrl&&<a href={access.externalUrl} target="_blank" rel="noreferrer">카카오맵에서 길찾기 ↗</a>}</details>}
    {time&&<details><summary>시간 구성</summary><dl>{[['현지 출발 → 첫 장소',time.originToFirstMinutes],['장소 간 이동',time.betweenPlacesMinutes],['장소 체류',time.stayMinutes],['대기·휴식',time.waitAndRestMinutes]].map(([k,v])=><div key={k} style={{display:'contents'}}><dt>{k}</dt><dd>{formatMinutes(Number(v))}</dd></div>)}</dl></details>}
    <p>{course.routeSource==='kakao'?'카카오 길찾기 반영':course.routeSource==='mixed'?'카카오 길찾기·추정 구간 포함':'거리 기반 예상 · 실제 경로 미확인'}{course.routingCheckedAt?' · '+new Date(course.routingCheckedAt).toLocaleString('ko-KR'):''}</p>
    {!!course.unclassifiedMinutes&&<p>이동·대기 {course.unclassifiedMinutes}분은 세부 구분이 제공되지 않았어요. 총시간에 포함되어 있으며 도보가 추가될 수 있어요.</p>}
    {!course.constraintPassed&&<p role="status">이동 정보를 반영하니 일부 조건을 벗어났어요. 동선을 확인하고 장소를 조정할 수 있어요.</p>}
    {error&&<p role="status">{error}</p>}
    <button disabled={busy||!preferences} onClick={onRefresh}>{busy?'길찾기 반영 중…':'이동 시간 다시 확인'}</button>
    {!hideWeather&&<details><summary>{weather.icon} {weather.condition}</summary><p>{weather.msg}</p></details>}
  </section>;
}
