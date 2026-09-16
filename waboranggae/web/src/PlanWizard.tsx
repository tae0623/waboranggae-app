import { useEffect, useRef, useState } from 'react';
import type { Condition } from './App';
import { api, type PlaceSuggestion } from './api';
import { getWebRuntime } from './runtime';
import { Modal } from './Dialogs';
import { availableMeals, conditionError, normalizeMeals, PURPOSES, todayKorea } from './parity';

const CITIES=['강진','고흥','곡성','광양','구례','나주','담양','목포','무안','보성','순천','신안','여수','영광','영암','완도','장성','장흥','진도','함평','해남','화순'];
export function defaultCondition():Condition {return {
  departure:'',region:'',date:todayKorea(),endDate:todayKorea(),startTime:'10:00',endTime:'16:00',endTimeLimited:false,
  duration:6,meal:'자동',meals:['자동'],walkLevel:'보통',companion:'혼자',interests:[],purpose:['자연 명소','맛집 탐방','카페'],
  atmosphere:[],pace:'적당히',isLocal:false,transitOnly:true,transitModes:['bus'],
};}
function clockLabel(time:string){const [h,m]=time.split(':').map(Number);return `${h!>=12?'오후':'오전'} ${h!%12||12}:${String(m).padStart(2,'0')}`;}
export function TimePicker({label,value,onChange}:{label:string;value:string;onChange:(s:string)=>void}){
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(value);
  const [h,m]=draft.split(':').map(Number);
  const change=(hour:number,minute:number)=>setDraft(`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
  return <><button className="field-button" onClick={()=>{setDraft(value);setOpen(true);}} aria-label={label}><span>{label}</span><strong>{clockLabel(value)}</strong></button>
    {open&&<Modal title={label} onClose={()=>setOpen(false)}><div className="segmented" aria-label="오전 오후">{['오전','오후'].map((t,i)=><button key={t} aria-pressed={(h!>=12?1:0)===i} onClick={()=>change(h!%12+i*12,m!)}>{t}</button>)}</div>
      <div className="clock-fields"><label>시<select aria-label="시" value={h!%12||12} onChange={e=>change(Number(e.target.value)%12+(h!>=12?12:0),m!)}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <span>:</span><label>분<select aria-label="분" value={m} onChange={e=>change(h!,Number(e.target.value))}>{Array.from({length:60},(_,i)=>i).map(n=><option key={n} value={n}>{String(n).padStart(2,'0')}</option>)}</select></label></div>
      <div className="dialog-actions"><button onClick={()=>setOpen(false)}>취소</button><button className="primary" onClick={()=>{onChange(draft);setOpen(false);}}>확인</button></div></Modal>}</>;
}
export function DatePicker({value,onChange,label='여행 날짜'}:{value:string;onChange:(s:string)=>void;label?:string}){
  const [open,setOpen]=useState(false),[month,setMonth]=useState(value.slice(0,7)),[draft,setDraft]=useState(value);
  const [year,mon]=month.split('-').map(Number);
  const count=new Date(year!,mon!,0).getDate(),offset=new Date(year!,mon!-1,1).getDay();
  function move(n:number){const date=new Date(year!,mon!-1+n,1);setMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);}
  return <><button className="field-button" aria-label={label} onClick={()=>{setDraft(value);setMonth(value.slice(0,7));setOpen(true);}}><span>{label}</span><strong>{value.replaceAll('-','. ')}</strong></button>
    {open&&<Modal title={label} onClose={()=>setOpen(false)}><div className="calendar-head"><button aria-label="이전 달" onClick={()=>move(-1)}>‹</button><strong>{year}년 {mon}월</strong><button aria-label="다음 달" onClick={()=>move(1)}>›</button></div>
      <div className="calendar-grid">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>i+1).map(day=>{
        const date=month+'-'+String(day).padStart(2,'0');return <button key={date} aria-label={date} aria-pressed={draft===date} disabled={date<todayKorea()} onClick={()=>setDraft(date)}>{day}</button>;
      })}</div><div className="dialog-actions"><button onClick={()=>setOpen(false)}>취소</button><button className="primary" onClick={()=>{onChange(draft);setOpen(false);}}>확인</button></div></Modal>}</>;
}
function DepartureSearch({condition,onChange}:{condition:Condition;onChange:(v:Partial<Condition>)=>void}){
  const [results,setResults]=useState<PlaceSuggestion[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[highlight,setHighlight]=useState(-1);
  const sequence=useRef(0);
  const frame=useRef<HTMLIFrameElement>(null),mapSequence=useRef(0);
  const [mapChoice,setMapChoice]=useState<PlaceSuggestion|null>(null),[mapBusy,setMapBusy]=useState(false);
  const mapOrigin=new URL(getWebRuntime().mapBaseUrl||window.location.origin).origin;
  useEffect(()=>{let active=true;const selectPoint=(event:MessageEvent)=>{
    if(event.source!==frame.current?.contentWindow || event.origin!==mapOrigin || event.data?.type!=='ddubugi:map-point')return;
    const p=event.data.point;if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||p.latitude<32||p.latitude>40||p.longitude<123||p.longitude>133)return;
    const version=++mapSequence.current;setMapChoice(null);setMapBusy(true);setError('');
    api.resolveMapPoint(p.latitude,p.longitude,typeof p.name==='string'?p.name.slice(0,80):undefined).then(r=>{if(active&&version===mapSequence.current)setMapChoice(r.place)}).catch(e=>{if(active&&version===mapSequence.current)setError(e instanceof Error?e.message:'장소를 확인하지 못했어요.')}).finally(()=>{if(active&&version===mapSequence.current)setMapBusy(false)});
  };window.addEventListener('message',selectPoint);return()=>{active=false;++mapSequence.current;window.removeEventListener('message',selectPoint)}},[mapOrigin]);
  const chosen=Number.isFinite(condition.departureLat)&&Number.isFinite(condition.departureLng);
  useEffect(()=>{
    const seq=++sequence.current;setResults([]);setHighlight(-1);setError('');
    const q=condition.departure.trim();
    if(chosen||!q){setBusy(false);return;}
    setBusy(true);
    const timer=setTimeout(()=>{api.searchPlaces(q).then(({places})=>{if(seq===sequence.current)setResults(places.filter(p=>Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)));}).catch(e=>{if(seq===sequence.current)setError(e instanceof Error?e.message:'검색하지 못했어요.');}).finally(()=>{if(seq===sequence.current)setBusy(false);});},300);
    return()=>{++sequence.current;clearTimeout(timer);};
  },[condition.departure,chosen]);
  function select(p:PlaceSuggestion){++sequence.current;setResults([]);onChange({departure:p.name,departureAddress:p.address,departureLat:p.latitude,departureLng:p.longitude});}
  const preview=chosen?{name:condition.departure,address:condition.departureAddress,latitude:condition.departureLat,longitude:condition.departureLng}:results[0];
  // This map receives only the user's explicit search selection, never device location.
  const mapUrl=preview?(getWebRuntime().mapBaseUrl||window.location.origin)+'/maps/embed#'+encodeURIComponent(JSON.stringify({origin:preview,places:[],routeSegments:[],conveniences:[],selectDeparture:true,parentOrigin:window.location.origin})):null;
  return <><label className="field-label" htmlFor="departure">출발지</label><div className="departure-field"><input id="departure" role="combobox" aria-controls="departure-results" aria-expanded={results.length>0} aria-autocomplete="list" aria-activedescendant={highlight>=0?'departure-option-'+highlight:undefined}
    autoComplete="off" placeholder="장소명 또는 주소 검색" value={condition.departure}
    onChange={e=>onChange({departure:e.target.value,departureAddress:undefined,departureLat:undefined,departureLng:undefined})}
    onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setHighlight(v=>Math.min(v+1,results.length-1));}if(e.key==='ArrowUp'){e.preventDefault();setHighlight(v=>Math.max(v-1,0));}if(e.key==='Enter'&&highlight>=0&&results[highlight]){e.preventDefault();select(results[highlight]!);}if(e.key==='Escape'){setResults([]);}}}/>
    {condition.departure&&<button aria-label="출발지 지우기" onClick={()=>onChange({departure:'',departureAddress:undefined,departureLat:undefined,departureLng:undefined})}>×</button>}</div>
    {busy&&<p role="status" className="muted">검색 중…</p>}
    {error&&<p role="alert" className="field-error">{error}</p>}
    <div id="departure-results" role="listbox" aria-label="출발지 검색 결과" className="search-results">{results.map((p,i)=><button key={p.id} id={'departure-option-'+i} role="option" aria-selected={highlight===i} onClick={()=>select(p)}><strong>{p.name}</strong><small>{p.address}</small></button>)}</div>
    {!busy&&!error&&condition.departure.trim()&&!chosen&&!results.length&&<p className="muted">검색 결과가 없어요. 장소명이나 주소를 다시 확인해 주세요.</p>}
    {chosen&&<p className="muted">{condition.departureAddress}</p>}
    {mapUrl?<iframe ref={frame} className="departure-map" title="검색한 출발지 지도" src={mapUrl}/>:<div className="departure-map placeholder">검색한 장소를 지도에서 확인하세요</div>}
    {mapBusy&&<p role="status" className="muted">선택한 위치 확인 중…</p>}
    {mapChoice&&<Modal title="출발 장소" onClose={()=>setMapChoice(null)}><h3>{mapChoice.name}</h3><p>{mapChoice.address}</p><div className="dialog-actions"><button onClick={()=>setMapChoice(null)}>취소</button><button className="primary" onClick={()=>{select(mapChoice);setMapChoice(null)}}>여기서 출발</button></div></Modal>}
  </>;
}
const TITLES=['어디서 출발하세요?','어디로 떠날까요?','어떻게 둘러볼까요?','어떤 여행을 원하세요?'];
const SUBTITLES=['출발할 장소를 검색해 주세요.','여행지와 현지 시작 시간을 골라주세요.','편안한 걷기와 여행 속도를 골라주세요.','가고 싶은 곳과 식사 계획을 골라주세요.'];
export function PlanWizard({initial,onClose,onComplete}:{initial?:Partial<Condition>;onClose:()=>void;onComplete:(c:Condition)=>void}){
  const [cond,setCond]=useState<Condition>(()=>({...defaultCondition(),...initial,endDate:initial?.endDate||initial?.date||todayKorea(),companion:'혼자',transitModes:['bus']}));
  const [multipleDays,setMultipleDays]=useState(Boolean(initial?.endDate&&initial.endDate!==initial.date));
  const [step,setStep]=useState(1),[error,setError]=useState(''),[regionOpen,setRegionOpen]=useState(false);
  const body=useRef<HTMLDivElement>(null);
  function update(p:Partial<Condition>){setCond(old=>{const c={...old,...p};return {...c,endDate:!multipleDays?c.date:c.endDate<c.date?c.date:c.endDate,meals:normalizeMeals(c)};});setError('');}
  function next(){const e=conditionError(cond,step);setError(e);if(e)return;if(step===4)onComplete(cond);else setStep(step+1);}
  useEffect(()=>{body.current?.scrollTo(0,0);},[step]);
  useEffect(()=>{const back=(e:Event)=>{e.stopImmediatePropagation();if(regionOpen)setRegionOpen(false);else if(step>1)setStep(step-1);else onClose();};window.addEventListener('waboranggae:back',back,{capture:true});return()=>window.removeEventListener('waboranggae:back',back,{capture:true});},[step,regionOpen,onClose]);
  return <div className="travel-wizard" role="dialog" aria-modal="true" aria-label="여행 조건">
    <header><button aria-label="이전 단계" onClick={()=>step>1?setStep(step-1):onClose()}>‹</button><span>코스 만들기</span><button aria-label="조건 선택 닫기" onClick={onClose}>×</button></header>
    <div className="wizard-progress" aria-label={step+' / 4단계'}>{[1,2,3,4].map(i=><span key={i} className={i<=step?'active':''}/>)}</div>
    <div className="wizard-body" ref={body}><span className="step-label">STEP 0{step}</span><h1>{TITLES[step-1]}</h1><p className="wizard-subtitle">{SUBTITLES[step-1]}</p>
      {cond.requiredContentId&&<div className="required-place"><div><small>코스에 포함할 장소</small><strong>{cond.requiredPlaceName}</strong>{cond.requiredPlace?.periodLabel&&<small>{cond.requiredPlace.periodLabel}</small>}</div><button aria-label="포함 장소 해제" onClick={()=>update({requiredContentId:undefined,requiredPlaceName:undefined,requiredPlace:undefined})}>×</button></div>}
      {step===1&&<DepartureSearch condition={cond} onChange={update}/>}
      {step===2&&<><button className="destination-card" onClick={()=>setRegionOpen(true)} aria-label="여행지 선택"><small>전라남도</small><strong>{cond.region||'여행지 선택'} <span>⌄</span></strong></button>
        <DatePicker value={cond.date} onChange={date=>update({date})}/>
        <label className="option-row"><span>여러 날 여행</span><input type="checkbox" checked={multipleDays} onChange={e=>{setMultipleDays(e.target.checked);setCond(c=>({...c,endDate:c.date}));setError('')}}/></label>
        {multipleDays&&<><DatePicker label="마지막 여행 날짜" value={cond.endDate} onChange={endDate=>update({endDate})}/><p className="muted">최대 7일 · 같은 지역에서 날짜마다 새 코스를 만들어요.</p></>}
        <TimePicker label={multipleDays?'매일 현지 여행 시작':'현지 여행 시작'} value={cond.startTime} onChange={startTime=>update({startTime})}/>
        <label className="option-row"><span>종료 시각 설정<small>돌아갈 시간이 정해져 있을 때만 선택하세요.</small></span><input type="checkbox" checked={!!cond.endTimeLimited} onChange={e=>update({endTimeLimited:e.target.checked})}/></label>
        {cond.endTimeLimited&&<TimePicker label="현지 여행 종료" value={cond.endTime} onChange={endTime=>update({endTime})}/>}
        <p className="muted">예상 소요 시간은 코스에서 확인하세요 · 도시 간 이동 별도</p>
      </>}
      {step===3&&<><h2>걷기 부담</h2><div className="choice-grid">{[{v:'보통',desc:'걷기와 대중교통을 함께 이용해요'},{v:'적게 걷기',desc:'도보 이동 부담을 줄여요'}].map(o=><button key={o.v} aria-pressed={cond.walkLevel===o.v} onClick={()=>update({walkLevel:o.v})}><strong>{o.v}</strong><small>{o.desc}</small></button>)}</div>
        <h2>여행 속도</h2><div className="choice-grid">{['여유롭게','적당히','알차게'].map(v=><button key={v} aria-pressed={cond.pace===v} onClick={()=>update({pace:v})}><strong>{v}</strong></button>)}</div></>}
      {step===4&&<><h2>여행 목적 <small>복수 선택</small></h2><div className="choice-grid">{PURPOSES.map(v=><button key={v} aria-pressed={cond.purpose.includes(v)} onClick={()=>update({purpose:cond.purpose.includes(v)?cond.purpose.filter(p=>p!==v):[...cond.purpose,v]})}>{v}</button>)}</div>
        <p className="muted">취향에 맞는 코스를 찾아드려요. 이동 거리와 시간에 따라 일부 목적은 포함되지 않을 수 있어요.</p>
        <h2>식사</h2><div className="choice-grid">{['자동','아침','점심','저녁'].map(v=><button key={v} aria-pressed={cond.meals.includes(v)} disabled={v!=='자동'&&!availableMeals(cond).includes(v)}
          onClick={()=>update({meals:v==='자동'?(cond.meals.includes(v)?[]:['자동']):cond.meals.includes(v)?cond.meals.filter(m=>m!==v):[...cond.meals.filter(m=>m!=='자동'),v]})}>{v}</button>)}</div>
        {!cond.meals.length&&<p className="muted">식사 없이 코스를 추천해요.</p>}<p className="muted">방문 전 가게의 영업시간을 확인해 주세요.</p></>}
      {error&&<p role="alert" className="field-error">{error}</p>}
    </div><footer><button className="primary" onClick={next}>{step===4?'코스 추천받기':'다음'}</button></footer>
    {regionOpen&&<Modal title="여행지 선택" onClose={()=>setRegionOpen(false)}><p className="muted">전라남도 · 가나다순</p><div className="city-grid">{CITIES.map(city=><button key={city} aria-pressed={cond.region===city} onClick={()=>{update({region:city});setRegionOpen(false);}}>{city}</button>)}</div><div className="dialog-actions"><button onClick={()=>setRegionOpen(false)}>닫기</button></div></Modal>}
  </div>;
}
