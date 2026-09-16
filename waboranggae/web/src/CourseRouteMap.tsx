import { useMemo } from 'react';
import { ExpandableMap } from './ExpandableMap';
import type { RankedCourse } from '../../src/types/travel';
import { mapEmbedUrl } from '../../src/domain/kakaoMapHtml';
import { getWebRuntime } from './runtime';
export function CourseRouteMap({course,focusIndex: _focusIndex}:{course?:RankedCourse;focusIndex?:number|null}) {
  const src=useMemo(()=>course?mapEmbedUrl(course,getWebRuntime().mapBaseUrl||window.location.origin,window.location.origin):undefined,[course]);
  if(!course||!src)return null;
  return <section className="journey-map"><ExpandableMap src={src} title={course.title+" 전체 길찾기"}/></section>;
}
