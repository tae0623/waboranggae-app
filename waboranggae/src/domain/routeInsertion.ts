type Point={latitude?:number;longitude?:number};
export function routeDistance(a:Point,b:Point){
 if(!Number.isFinite(a.latitude)||!Number.isFinite(a.longitude)||!Number.isFinite(b.latitude)||!Number.isFinite(b.longitude))return Infinity;
 const rad=Math.PI/180,dy=(b.latitude!-a.latitude!)*rad,dx=(b.longitude!-a.longitude!)*rad;
 const v=Math.sin(dy/2)**2+Math.cos(a.latitude!*rad)*Math.cos(b.latitude!*rad)*Math.sin(dx/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
}
/** Public place coordinates only. Straight-line detour ranking, not verified travel time. */
export function bestInsertion(route:Point[],candidate:Point,origin?:Point){
 let index=route.length,detourKm=Infinity;
 for(let i=0;i<=route.length;i++){
  const before=i?route[i-1]:origin,after=route[i];
  const extra=(before?routeDistance(before,candidate):0)+(after?routeDistance(candidate,after):0)-(before&&after?routeDistance(before,after):0);
  if(Number.isFinite(extra)&&extra<detourKm){index=i;detourKm=Math.max(0,extra);}
 }
 return {index,detourKm};
}
export function nearbyAdditions<T extends Point&{id:string;name:string}>(route:T[],pool:T[],origin?:Point,excluded:string[]=[]){
 const used=new Set([...route.map(p=>p.id),...excluded]),names=new Set(route.map(p=>p.name.replace(/\s/g,'')));
 return [...new Map(pool.map(p=>[p.id,p])).values()].filter(p=>!used.has(p.id)&&!names.has(p.name.replace(/\s/g,'')))
  .map(place=>({place,...bestInsertion(route,place,origin)})).filter(p=>Number.isFinite(p.detourKm)).sort((a,b)=>a.detourKm-b.detourKm||a.place.name.localeCompare(b.place.name,'ko'));
}
