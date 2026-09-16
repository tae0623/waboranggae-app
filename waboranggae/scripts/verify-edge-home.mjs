import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';
const env=parse(await readFile('.env.edge.local'));
const base='https://drtxexwznmpmiclvrjji.supabase.co/functions/v1/waboranggae-api';
if(env.PUBLIC_APP_URL!==base||env.EDGE_VALIDATION_MODE!=='true')throw Error('VALIDATION_TARGET_MISMATCH');
const result=await Promise.all(['/api/hot-places','/api/login-photo','/api/weather/current?lat=34.95&lng=127.49'].map(async route=>{
  const start=Date.now();
  try{
    const response=await fetch(base+route,{redirect:'error',headers:{'X-Waboranggae-Validation':env.EDGE_VALIDATION_KEY},signal:AbortSignal.timeout(60000)});
    const data=await response.json();
    return{route,status:response.status,ms:Date.now()-start,source:data.source,places:data.places?.length,
      festivalCount:data.places?.filter(x=>x.source==='festival').length,hasImage:Boolean(data.img),available:data.available};
  }catch{return{route,status:0,ms:Date.now()-start,error:'REQUEST_FAILED'};}
}));
const report={at:new Date().toISOString(),checks:result,allHttpOk:result.every(x=>x.status===200)};
await writeFile('.runtime/edge-home-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));if(!report.allHttpOk)process.exitCode=1;
