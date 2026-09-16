import type { RankedCourse } from './api';
import { formatMinutes } from './parity';
export function RouteSummary({course,busy,error,compact=false}:{course?:RankedCourse;busy:boolean;error:string;compact?:boolean}){
  if(!course)return null;
  if(compact&&!busy&&!error&&course.constraintPassed)return null;
  return <section className="route-status">
    {!compact&&<><strong>현지 코스 예상 {formatMinutes(course.timeBreakdown?.totalMinutes??course.durationHours*60)}</strong>
    <span className="route-accuracy">{course.routeSource==='kakao'?'경로 확인':course.routeSource==='mixed'?'일부 구간 추정':'이동 시간 추정'}</span></>}
    {busy&&<p role="status">길찾기 반영 중…</p>}
    {!course.constraintPassed&&<p role="status">설정한 조건을 벗어난 구간이 있어요. 장소나 시간을 조정해 주세요.</p>}
    {error&&<p role="status">{error}</p>}
  </section>;
}
