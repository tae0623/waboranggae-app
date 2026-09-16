import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const project=new URL('../../',import.meta.url);
const boundaryFile=new URL('android-native/art/jeonnam-boundary.geojson',project);
const originalUrl='https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/KOR/ADM1/geoBoundaries-KOR-ADM1.geojson';
if(process.argv.includes('--fetch')) {
  const response=await fetch(originalUrl);
  if(!response.ok)throw new Error('Boundary download failed');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!=='6683cd1ad991676d96493fd0aae068215426497ccf82c8b0eb5683cad341cddc')throw new Error('Unexpected boundary source revision');
  const feature=JSON.parse(bytes.toString()).features.find(f=>f.properties.shapeISO==='KR-46');
  if(!feature)throw new Error('Jeonnam not found');
  await mkdir(new URL('android-native/art/',project),{recursive:true});
  await writeFile(boundaryFile,JSON.stringify(feature));
  console.log('Saved public South Jeolla boundary, KR-46.');
}
export async function applyJeonnamArt() {
  const feature=JSON.parse(await readFile(boundaryFile,'utf8'));
  const allPolygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
  const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const next=ring[(i+1)%ring.length];return sum+p[0]*next[1]-next[0]*p[1];},0)/2);
  // Center the mainland only. Keep its exclusion rings; detached islands remain in source data.
  const polygons=[[...allPolygons].sort((a,b)=>area(b[0])-area(a[0]))[0]];
  if(!polygons[0])throw new Error('Mainland polygon missing');
  const points=polygons.flat(2);
  const lonScale=Math.cos(35*Math.PI/180);
  const xs=points.map(p=>p[0]*lonScale),ys=points.map(p=>-p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  function projection(x,y,w,h) {
    const scale=Math.min(w/(maxX-minX),h/(maxY-minY));
    const dx=x+(w-(maxX-minX)*scale)/2,dy=y+(h-(maxY-minY)*scale)/2;
    return p=>[dx+(p[0]*lonScale-minX)*scale,dy+(-p[1]-minY)*scale].map(n=>Number(n.toFixed(2)));
  }
  const path=projectPoint=>polygons.flatMap(poly=>poly.map(ring=>ring.map((p,i)=>(i?'L':'M')+projectPoint(p).join(',')).join('')+'Z')).join('');
  const projectSplash=projection(24,88,272,178);
  const d=path(projectSplash);
  const svgFile=new URL('android-native/app/src/main/assets/web_splash_map.svg',project);
  let svg=await readFile(svgFile,'utf8');
  const firstFoot=svg.indexOf('<g transform="translate(28,420)');
  if(firstFoot<0)throw new Error('Original footprints not found');
  svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 560"><path id="jeonnam-boundary" d="'+d+'" fill="#BBF7D0" fill-rule="evenodd" stroke="#16A34A" stroke-width="1.2" stroke-linejoin="round"/>'+svg.slice(firstFoot);
  // Decorative landmark badges retain the web design; positions follow the same geographic projection.
  const landmarks=[[[148,130],[126.99,35.32]],[[170,210],[127.08,34.77]],[[244,208],[127.66,34.76]],[[66,192],[126.39,34.81]],[[218,168],[127.50,34.89]]];
  for(const [old,coordinate] of landmarks){
    const next=projectSplash(coordinate);
    // Offset the two adjacent eastern badges so both labels remain legible.
    if(old[0]===244){next[0]+=4;next[1]+=8;}
    if(old[0]===218){next[0]-=3;next[1]-=12;}
    svg=svg.replace('translate('+old.join(',')+')','translate('+next.join(',')+')');
    svg=svg.replace('<circle cx="'+old[0]+'" cy="'+old[1]+'" r="3" fill="#16A34A" fill-opacity="1"></circle>','');
  }
  await writeFile(svgFile,svg);
  const iconFile=new URL('android-native/app/src/main/res/drawable/ic_brand.xml',project);
  let icon=await readFile(iconFile,'utf8');
  const map='<group android:name="jeonnamBoundary"><path android:fillColor="#BBF7D0" android:fillType="evenOdd" android:strokeColor="#16A34A" android:strokeWidth="0.55" android:strokeLineJoin="round" android:pathData="'+path(projection(14,31,80,49))+'"/></group>';
  icon=icon.replace(/<group[\s\S]*?<\/group>/,map).replace(/<!--[^]*?-->/,'<!-- Natural Earth / geoBoundaries KR-46, generalized real boundary; original walking silhouette. -->');
  await writeFile(iconFile,icon);
  console.log('Generated native icon and splash from the same real Jeonnam boundary.');
}
if(process.argv.includes('--apply'))await applyJeonnamArt();
