import { Course, TravelPreferences } from '../../../../src/types/travel';
import { evaluateCourse, rankScoredCourses } from '../../../../src/domain/recommendScore';
import { assignGroundedCourseTitles, isRequiredPlace, validateScheduledPlaces } from './planner';
import { attachRoutingToCourses } from './routing';

export function rankValidatedCourses(preferences: TravelPreferences, courses: Course[]) {
  return rankScoredCourses(preferences, courses.map(input => {
    const course = evaluateCourse(preferences, input);
    const violations = [...new Set([...course.constraintViolations, ...validateScheduledPlaces(preferences, course.places)])];
    return { ...course, constraintViolations: violations, constraintPassed: violations.length === 0 };
  }));
}

/** Keep the highest ranked order, not another title for the same places.
 * No invented attractions or forced three-card padding in sparse regions. */
export function diverseCourses(courses: Course[], limit=3): Course[] {
  const selected: Course[] = [];
  const ids=(c:Course)=>new Set(c.places.filter(p=>p.category!=='station').map(p=>p.id));
  const main=(c:Course)=>c.places.filter(p=>!['station','food','cafe'].includes(p.category)).map(p=>p.id).sort().join('|');
  for (const course of courses) {
    const a=ids(course);
    if (!a.size) continue;
    const duplicate=selected.some(other=>{
      const b=ids(other);
      const shared=[...a].filter(id=>b.has(id)).length;
      const union=new Set([...a,...b]).size;
      return shared/union>=0.8 || shared/Math.min(a.size,b.size)>=0.75 || (main(course)!=='' && main(course)===main(other));
    });
    if (!duplicate) selected.push(course);
    if (selected.length>=limit) break;
  }
  return selected;
}

/** Query only the three best plausible candidates, then rank the actual schedules again. */
export async function verifyTopCourses(preferences: TravelPreferences, courses: Course[]) {
  const plausible=rankValidatedCourses(preferences, courses).filter(c => c.constraintPassed);
  // Start with a useful small itinerary; shorter variants are fallbacks, not a hidden time minimum.
  if(preferences.scheduleMode==='course-first')plausible.sort((a,b)=>Math.min(3,b.places.length)-Math.min(3,a.places.length));
  const candidates = diverseCourses(plausible);
  if (!candidates.length) return [];
  const routed = await attachRoutingToCourses(preferences, candidates, { live: true });
  // Failed actual constraints stay failed. Provider failures remain explicitly estimated/mixed.
  let checked=routed.map(c=>rankValidatedCourses(preferences,[c])[0]!);
  if(preferences.scheduleMode==='course-first'){
    // Bounded retries. Never drop a user-required place or an explicitly requested meal.
    for(let round=0;round<4;round++){
      const retry=checked.filter(c=>!c.constraintPassed&&c.places.length>1).flatMap(c=>{
        const explicitMeal=!(preferences.mealPreference==='auto'&&preferences.meals===undefined);
        const at=c.places.findLastIndex(p=>!isRequiredPlace(p,preferences)&&!(explicitMeal&&p.category==='food'));
        return at<0?[]:[{...c,places:c.places.filter((_,i)=>i!==at),routeSegments:undefined}];
      });
      if(!retry.length)break;
      const repaired=await attachRoutingToCourses(preferences,retry,{live:true});
      const byId=new Map(repaired.map(c=>[c.id,rankValidatedCourses(preferences,[c])[0]!]));
      checked=checked.map(c=>byId.get(c.id)??c);
    }
  }
  const ranked = rankValidatedCourses(preferences,assignGroundedCourseTitles(preferences,checked));
  return ranked.sort((a, b) => Number(b.constraintPassed) - Number(a.constraintPassed)
    || Number(b.routeSource === 'kakao') - Number(a.routeSource === 'kakao')
    || (preferences.scheduleMode==='course-first' ? Math.min(3,b.places.length)-Math.min(3,a.places.length) : 0));
}
