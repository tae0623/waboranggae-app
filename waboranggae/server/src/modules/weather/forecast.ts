import {kmaGrid} from './service';
export type ForecastResult = {available:false;source:'kma';requestedDate:string;reason:string;code:string}
  | {available:true;source:'kma';requestedDate:string;issuedAt:string;condition:string;minTemperature:number;maxTemperature:number;maxRainProbability:number|null;hours:{time:string;temperature:number;condition:string;rainProbability:number|null}[]};
const cache=new Map<string,{expires:number;value:ForecastResult}>();
const pending=new Map<string,Promise<ForecastResult>>();
const unavailable=(date:string,code:string,reason:string):ForecastResult=>({available:false,source:'kma',requestedDate:date,code,reason});
export function forecastBaseTime(now=new Date()) {
  // KST publications 02/05/08/11/14/17/20/23; leave 20 minutes for publication delay.
  const kst=new Date(now.getTime()+9*3600_000-20*60_000);
  const hour=[23,20,17,14,11,8,5,2].find(h=>h<=kst.getUTCHours());
  if(hour===undefined)kst.setUTCDate(kst.getUTCDate()-1);
  return{date:kst.toISOString().slice(0,10).replaceAll('-',''),time:String(hour??23).padStart(2,'0')+'00'};
}
export function forecastDateAvailability(date:string,now=new Date()):ForecastResult|null {
  const parsed=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==date)return unavailable(date,'INVALID_DATE','여행 날짜를 확인해 주세요.');
  const today=new Date(now.getTime()+9*3600_000).toISOString().slice(0,10);
  const diff=(Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400_000;
  if(!Number.isInteger(diff)||!/^\d{4}-\d{2}-\d{2}$/.test(date))return unavailable(date,'INVALID_DATE','여행 날짜를 확인해 주세요.');
  if(diff<0)return unavailable(date,'PAST_DATE','지난 날짜의 예보는 제공하지 않습니다.');
  if(diff>3)return unavailable(date,'NOT_PUBLISHED','아직 예보가 발표되지 않았습니다. 여행일이 가까워지면 확인해 주세요.');
  return null;
}
type Item={category?:string;fcstDate?:string;fcstTime?:string;fcstValue?:string|number;baseDate?:string;baseTime?:string};
export function parseForecast(payload:any,date:string,startTime='00:00',endTime='23:59'):ForecastResult {
  if(String(payload?.response?.header?.resultCode)!=='00')return unavailable(date,'UPSTREAM_ERROR','예보를 불러오지 못했습니다.');
  const raw=payload?.response?.body?.items?.item;
  const rows:Item[]=Array.isArray(raw)?raw:raw?[raw]:[];
  const target=date.replaceAll('-','');
  const grouped=new Map<string,Map<string,number>>();
  for(const row of rows){
    const t=String(row.fcstTime||'');
    if(row.fcstDate!==target||!/^([01]\d|2[0-3])[0-5]\d$/.test(t))continue;
    const clock=t.slice(0,2)+':'+t.slice(2);
    if(clock<startTime||clock>endTime)continue;
    const value=row.fcstValue;
    if(value==null||value===''||!Number.isFinite(Number(value)))continue;
    if(!grouped.has(clock))grouped.set(clock,new Map());
    grouped.get(clock)!.set(row.category||'',Number(value));
  }
  const sky:Record<number,string>={1:'맑음',3:'구름 많음',4:'흐림'};
  const precipitation:Record<number,string>={1:'비',2:'비/눈',3:'눈',4:'소나기'};
  const hours=[...grouped.entries()].sort(([a],[b])=>a.localeCompare(b)).flatMap(([time,data])=>{
    const temperature=data.get('TMP'),pty=data.get('PTY'),cloud=data.get('SKY'),pop=data.get('POP');
    if(temperature==null||temperature< -80||temperature>65||pty==null||!(pty===0?sky[cloud??-1]:precipitation[pty]))return [];
    return[{time,temperature,condition:pty===0?sky[cloud!]!:precipitation[pty]!,rainProbability:pop!=null&&pop>=0&&pop<=100?pop:null}];
  });
  if(!hours.length)return unavailable(date,'NO_FORECAST','선택한 날짜·시간의 예보가 아직 없거나 제공 기간이 지났습니다.');
  const issued=rows.find(row=>row.fcstDate===target&&/^\d{8}$/.test(row.baseDate||'')&&/^\d{4}$/.test(row.baseTime||''));
  if(!issued)return unavailable(date,'INVALID_ISSUE_TIME','예보 발표 시각을 확인하지 못했습니다.');
  const conditions=[...new Set(hours.map(h=>h.condition))];
  const pops=hours.flatMap(h=>h.rainProbability==null?[]:[h.rainProbability]);
  const b=issued.baseDate!,t=issued.baseTime!;
  return{available:true,source:'kma',requestedDate:date,issuedAt:`${b.slice(0,4)}-${b.slice(4,6)}-${b.slice(6)} ${t.slice(0,2)}:${t.slice(2)} KST`,
    condition:conditions.join(' / '),minTemperature:Math.min(...hours.map(h=>h.temperature)),maxTemperature:Math.max(...hours.map(h=>h.temperature)),maxRainProbability:pops.length?Math.max(...pops):null,hours};
}
export async function travelForecast(lat:number,lng:number,date:string,startTime='00:00',endTime='23:59'):Promise<ForecastResult>{
  const unavailableDate=forecastDateAvailability(date);if(unavailableDate)return unavailableDate;
  const key=process.env.DATA_GO_KR_KEY?.trim();if(!key)return unavailable(date,'NOT_CONFIGURED','날씨 서비스 준비 중입니다.');
  const grid=kmaGrid(lat,lng),base=forecastBaseTime();
  const id=[grid.nx,grid.ny,base.date,base.time,date,startTime,endTime].join(':');
  const hit=cache.get(id);if(hit&&hit.expires>Date.now())return hit.value;
  const active=pending.get(id);if(active)return active;
  const task=(async()=>{
    let result:ForecastResult;
    try{
      let decoded=key;try{decoded=decodeURIComponent(key);}catch{}
      const url=new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
      url.search=new URLSearchParams({serviceKey:decoded,pageNo:'1',numOfRows:'1500',dataType:'JSON',base_date:base.date,base_time:base.time,nx:String(grid.nx),ny:String(grid.ny)}).toString();
      const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(12000)});
      result=response.ok?parseForecast(await response.json(),date,startTime,endTime):unavailable(date,'UPSTREAM_ERROR','예보를 불러오지 못했습니다.');
    }catch{result=unavailable(date,'UNAVAILABLE','날씨 서비스 연결이 지연되고 있습니다.');}
    if(cache.size>=200)cache.delete(cache.keys().next().value!);
    cache.set(id,{expires:Date.now()+(result.available?600_000:60000),value:result});return result;
  })().finally(()=>pending.delete(id));
  pending.set(id,task);return task;
}
