import type {TravelPreferences} from '../types/travel';
type Candidate={id:string;name:string;latitude?:number;longitude?:number};
const normalize=(name:string)=>name.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
/** Provider aliases for the same venue are excluded, not just identical provider IDs. */
export function alreadyVisited(place:Candidate,visited:TravelPreferences['visitedPlaces']=[]) {
  return visited.some(v=>{
    if(place.id.replace(/^tour-/,'')===v.id.replace(/^tour-/,''))return true;
    const a=normalize(place.name),b=normalize(v.name);
    if(a===b)return true;
    if(!a||!b||!(a.includes(b)||b.includes(a)))return false;
    return [place.latitude,place.longitude,v.latitude,v.longitude].every(Number.isFinite)
      && Math.hypot((place.latitude!-v.latitude!)*111,(place.longitude!-v.longitude!)*91)<0.15;
  });
}
