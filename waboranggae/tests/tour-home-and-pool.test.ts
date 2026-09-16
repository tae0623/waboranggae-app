import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {TravelPreferences,PlaceCategory} from '../src/types/travel';
const prefs={region:'전라남도',city:'나주',durationHours:6,startTime:'10:00',endTime:'16:00',mealPreference:'auto',interests:['nature','food','cafe']} as TravelPreferences;
const reply=(items:unknown[])=>new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:items}}}}));
beforeEach(()=>{vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','test-key');vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-15T15:01:00Z'))});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers()});
describe('home provider dates',()=>{
 it('retains ordinary attractions without event dates in keyword results',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(input)=>{const u=new URL(String(input));
   if(u.pathname.endsWith('ldongCode2'))return reply(u.searchParams.has('lDongRegnCd')?[{name:'순천시',code:'150'}]:[{name:'전남광주통합특별시',code:'12'}]);
   return reply([{contentid:'1',contenttypeid:'12',title:'순천 관광지',addr1:'전남 순천시',mapx:'127.5',mapy:'34.9',firstimage:'https://tong.visitkorea.or.kr/test.jpg'}]);
  }));
  const {fetchKeywordHighlights}=await import('../server/src/modules/recommendation/data/tour-api');
  expect((await fetchKeywordHighlights('관광지')).map(p=>p.id)).toEqual(['1']);
 });
 it('filters expired and undated festivals before the result limit',async()=>{
  vi.stubGlobal('fetch',vi.fn(async(input)=>{const u=new URL(String(input));
   if(u.pathname.endsWith('ldongCode2'))return reply([{name:'전남광주통합특별시',code:'12'}]);
   expect(u.searchParams.get('eventStartDate')).toBe('20260916');
   return reply([['past','20260901','20260915'],['unknown','',''],['today','20260915','20260916'],['future','20260920','20260921']].map(([id,a,b])=>({contentid:id,contenttypeid:'15',title:id,addr1:'전남 담양군',eventstartdate:a,eventenddate:b})));
  }));
  const {fetchOngoingFestivals}=await import('../server/src/modules/recommendation/data/tour-api');
  expect((await fetchOngoingFestivals(2)).map(p=>p.id)).toEqual(['today','future']);
 });
});
describe('planning pool keeps categories required for a feasible itinerary',()=>{
 const place=(id:string,category:PlaceCategory,offset:number)=>({id,category,latitude:35+offset,longitude:127});
 it('retains a restaurant even when many cafes and attractions are closer',async()=>{
  const {selectPlanningPool}=await import('../server/src/modules/recommendation/data/tour-api');
  const seed=place('seed','cafe',0),items=[...Array.from({length:12},(_,i)=>place('near'+i,'nature',(i+1)/10000)),place('lunch','food',.01)];
  const pool=selectPlanningPool(seed,items,prefs,7);
  expect(pool).toHaveLength(7);expect(pool.some(p=>p.id==='lunch')).toBe(true);expect(pool.some(p=>p.category==='nature')).toBe(true);
 });
 it('does not force meals when excluded and never duplicates a seed or candidate',async()=>{
  const {selectPlanningPool}=await import('../server/src/modules/recommendation/data/tour-api');
  const seed=place('seed','nature',0),near=place('near','nature',.001),far=place('food','food',.1);
  expect(selectPlanningPool(seed,[seed,near,near,far],{...prefs,mealPreference:'none',interests:['nature']},1).map(p=>p.id)).toEqual(['near']);
 });
});
