import { useEffect,useRef } from 'react';
import type { RankedCourse } from '../../src/types/travel';
import { mapEmbedUrl } from '../../src/domain/kakaoMapHtml';
import { getWebRuntime } from './runtime';
export function CourseRouteMap({course,focusIndex}:{course?:RankedCourse;focusIndex?:number|null}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const origin=new URL(getWebRuntime().mapBaseUrl||window.location.origin).origin;
  useEffect(()=>{if(focusIndex!=null)frame.current?.contentWindow?.postMessage({type:'ddubugi:focus-place',index:focusIndex},origin)},[focusIndex,origin]);
  if(!course)return null;
  const src=mapEmbedUrl(course,getWebRuntime().mapBaseUrl||window.location.origin,window.location.origin);
  return <section className="journey-map"><iframe ref={frame} key={course.id} src={src} title={course.title+' 전체 길찾기'} style={{width:'100%',height:350,border:0}}/></section>;
}
