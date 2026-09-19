import {readFile} from 'node:fs/promises';
import {parse} from 'dotenv';
const env=parse(await readFile('.env'));
const raw=(env.DATA_GO_KR_KEY||'').trim();if(!raw)throw Error('DATA_KEY_MISSING');
const url=new URL('https://apis.data.go.kr/1613000/ArvlInfoInqireService/getCtyCodeList');
url.searchParams.set('serviceKey',decodeURIComponent(raw));url.searchParams.set('_type','json');
try{
 const res=await fetch(url,{signal:AbortSignal.timeout(15000)}),text=await res.text();
 let body;try{body=JSON.parse(text)}catch{}
 const h=body?.response?.header;const items=body?.response?.body?.items?.item;
 const list=Array.isArray(items)?items:items?[items]:[];
 console.log(JSON.stringify({requests:1,kakaoRequests:0,status:res.status,resultCode:h?.resultCode||null,authorized:h?.resultCode==='00',cities:list.filter(x=>/목포|순천|여수|광양|나주|무안/.test(x.cityname||'')).map(x=>({name:x.cityname,code:x.citycode})),credentialsPrinted:false}));
}catch{console.log(JSON.stringify({requests:1,kakaoRequests:0,authorized:false,error:'ARRIVAL_PROBE_UNAVAILABLE'}));}
