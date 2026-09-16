import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parse} from 'dotenv';
import assert from 'node:assert/strict';
const env=parse(await readFile('.env')),team=parse(await readFile('.env.team.local'));
for(const [k,v] of Object.entries({...env,...team}))if(/^(DATA_GO_KR_KEY|DATALAB_.*_URL|TOUR_API_BASE_URL|PHOTO_KOREA_BASE_URL)$/.test(k))process.env[k]=v;
const original=globalThis.fetch,traces=[];
globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));
  const response=await original(input,init);
  if(url.hostname==='apis.data.go.kr'){
    const row={path:url.pathname,status:response.status,baseMonth:url.searchParams.get('baseYm')||undefined};
    try{const p=await response.clone().json();row.code=p.response?.header?.resultCode;const items=p.response?.body?.items?.item;row.count=Array.isArray(items)?items.length:items?1:0;row.fields=Object.keys((Array.isArray(items)?items[0]:items)||{});row.auth=p.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg;}catch{row.nonJson=true;}
    traces.push(row);
  }
  return response;
};
const headers={'X-Dev-Access-Key':team.TEAM_ACCESS_KEY};
const timings=[];
const get=async path=>{const start=performance.now();const r=await fetch('http://127.0.0.1:8788'+path,{headers,signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error('Local API HTTP '+r.status);const body=await r.json();timings.push({path,ms:Math.round(performance.now()-start)});return body;};
const [hot,hero]=await Promise.all([get('/api/hot-places'),get('/api/login-photo')]);
const {rankJeonnamCities}=await import('../server/src/modules/hot-places/datalab.ts');
const {searchPhotoKoreaDetails}=await import('../server/src/modules/hot-places/photokorea.ts');
const {fetchOngoingFestivals}=await import('../server/src/modules/recommendation/data/tour-api.ts');
const [ranked,photo,festivals]=await Promise.all([rankJeonnamCities(),searchPhotoKoreaDetails('담양 죽녹원'),fetchOngoingFestivals(3)]);
const images=[];
for(const path of [...new Set([hero.img,...hot.places.map(p=>p.img)].filter(p=>p?.startsWith('/api/media/')))]){
  const r=await fetch('http://127.0.0.1:8788'+path,{headers,signal:AbortSignal.timeout(30000)});const bytes=await r.arrayBuffer();images.push({status:r.status,type:r.headers.get('content-type'),bytes:bytes.byteLength});
}
const result={at:new Date().toISOString(),timings,hot:{source:hot.source,fetchedAt:hot.fetchedAt,places:hot.places.map(p=>({id:p.id,name:p.name,source:p.source,metricLabel:p.metricLabel,metricNote:p.metricNote,demand:p.demand,visitors:p.visitors,hasImage:Boolean(p.img),period:p.periodLabel,credit:p.imageCredit}))},hero:{source:hero.source,title:hero.title,hasImage:Boolean(hero.img)},direct:{rankedCount:ranked.length,ranked:ranked.slice(0,4),photo:photo?{title:photo.title,contentId:photo.contentId}:null,festivals:festivals.map(p=>({id:p.id,name:p.name,city:p.city}))},images,traces};
await mkdir('.runtime/home-audit',{recursive:true});await writeFile('.runtime/home-audit/integrations.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--assert-live')){
  assert.equal(hot.source,'demand','Home must use real demand data');
  assert.equal(hero.source,'photokorea','Backdrop must use Photo Korea');
  assert.ok(photo?.contentId,'Photo search must return a photo');
  assert.ok(ranked.length>0 && ranked.every(c=>c.source==='demand'));
  assert.ok(hot.places.some(p=>p.source==='festival'));
  for(const p of hot.places.filter(p=>p.source==='demand')){
    assert.ok(p.demand?.baseMonth && p.metricNote?.includes('실시간 인기 순위가 아닙니다'));
    const expected=(p.demand.stayScore+p.demand.spendScore)/2;
    assert.ok(Math.abs(p.demand.score-expected)<1e-8);
    assert.equal(p.visitors,Math.round(expected));
  }
  assert.equal(images.length,hot.places.length+1,'Check every displayed image and backdrop');
  assert.ok(images.every(i=>i.status===200 && i.type?.startsWith('image/') && i.bytes>0));
  assert.ok(traces.every(t=>t.status===200 && ['0000','00'].includes(t.code)));
  console.log('PASS: live demand, ver4 average, festivals, Photo Korea, and all displayed image responses');
}
