import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseTravelText} from '../src/domain/demoEngine';
import {buildRulePlannedCourses,collectPlanningCandidates,validateScheduledPlaces} from '../server/src/modules/recommendation/planner';
import {validateRequiredTourItem} from '../server/src/modules/recommendation/data/tour-api';
import {analysisPreferencesSchema,travelPreferencesSchema} from '../server/src/shared/schemas';
import type {Place,TravelPreferences} from '../src/types/travel';
const base={...parseTravelText('순천 6시간 자연 카페'),travelDate:'2026-09-20',requiredContentId:'1234'} as TravelPreferences;
const record={contentid:'1234',contenttypeid:'12',title:'선택한 공원',addr1:'전남 순천시 관광로',mapx:'127.5',mapy:'34.95'};
const make=(id:string,category:Place['category'],i:number):Place=>({id,name:id,category,address:'전남 순천시',stayMinutes:70,arrival:'10:00',moveLabel:'',description:'',tags:category==='food'?['food']:category==='cafe'?['cafe']:['nature'],mapPoint:{x:0,y:0},latitude:34.95+i*.001,longitude:127.5});
const places=[make('tour-1234','culture',0),make('garden','nature',1),make('museum','history',2),make('lunch','food',3),make('coffee','cafe',4),make('market','market',5)];
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
describe('explicit home-card destination',()=>{
 it('uses current KorService2 common fields for the home detail too',async()=>{
  vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','fixture');
  const calls:URL[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input)=>{
   const url=new URL(String(input));calls.push(url);
   const item=url.pathname.endsWith('detailCommon2')?{...record,overview:'검증 설명'}:{eventstartdate:'20260919',eventenddate:'20260921'};
   return new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:[item]}}}}));
  }));
  const {fetchTourPlaceDetail}=await import('../server/src/modules/recommendation/data/tour-api');
  expect((await fetchTourPlaceDetail('1234',15))?.overview).toBe('검증 설명');
  expect(calls.find(c=>c.pathname.endsWith('detailCommon2'))?.searchParams.has('defaultYN')).toBe(false);
 });
 it('does not misread gateway errors with HTTP 200 as a missing place',async()=>{
  vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','fixture');
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({resultCode:'10',resultMsg:'INVALID_REQUEST_PARAMETER_ERROR'}))));
  const {TourApiProvider}=await import('../server/src/modules/recommendation/data/tour-api');
  await expect(new TourApiProvider().fetchCourses(base)).rejects.toMatchObject({code:'REQUIRED_VISIT',status:503});
 });
 it('accepts only numeric provider IDs and excludes them from AI extraction',()=>{
  expect(travelPreferencesSchema.parse(base).requiredContentId).toBe('1234');
  expect(travelPreferencesSchema.safeParse({...base,requiredContentId:'https://example.org'}).success).toBe(false);
  expect(analysisPreferencesSchema.parse(base)).not.toHaveProperty('requiredContentId');
 });
 it('validates provider identity, city and real coordinates',()=>{
  expect(validateRequiredTourItem(record,base).title).toBe('선택한 공원');
  for(const item of [undefined,{...record,contentid:'2'},{...record,addr1:'전남 여수시'},{...record,mapx:''},{...record,mapx:'0'},{...record,mapy:'NaN'}])
   expect(()=>validateRequiredTourItem(item,base)).toThrow();
 });
 it('does not replace an out-of-period or unknown festival with other attractions',()=>{
  const festival={...record,contenttypeid:'15',eventstartdate:'20260919',eventenddate:'20260921'};
  expect(validateRequiredTourItem(festival,base).contentid).toBe('1234');
  expect(()=>validateRequiredTourItem(festival,{...base,travelDate:'2026-09-22'})).toThrow('행사 기간');
  expect(()=>validateRequiredTourItem({...festival,eventenddate:''},base)).toThrow('행사 기간');
  expect(()=>validateRequiredTourItem({...festival,eventenddate:'20260231'},base)).toThrow('행사 기간');
 });
 it('keeps the selected place even when its category does not match preferences',()=>{
  const courses=buildRulePlannedCourses(base,places);
  expect(courses.length).toBeGreaterThan(0);
  for(const course of courses)expect(course.places.some(p=>p.id==='tour-1234')).toBe(true);
 });
 it('never emits a successful plan without the required place',()=>{
  expect(buildRulePlannedCourses(base,places.filter(p=>p.id!=='tour-1234'))).toEqual([]);
  expect(validateScheduledPlaces(base,places.slice(1))).toContain('선택한 필수 방문지가 코스에 포함되지 않았습니다.');
 });
 it('keeps the required place before the 36-candidate limit',()=>{
  const many=Array.from({length:45},(_,i)=>make(String(i),'nature',i));
  expect(collectPlanningCandidates([{places:[...many,places[0]!]} as any],base)[0]?.id).toBe('tour-1234');
 });
 it('loads the exact selected record and uses it as the neighbourhood seed',async()=>{
  vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','fixture');
  const response=(items:unknown[])=>new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:items}}}}));
  const calls:URL[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input)=>{const url=new URL(String(input));calls.push(url);
   if(url.pathname.endsWith('detailCommon2'))return response([record]);
   if(url.pathname.endsWith('ldongCode2'))return response(url.searchParams.has('lDongRegnCd')?[{name:'순천시',code:'150'}]:[{name:'전남광주통합특별시',code:'12'}]);
   return response(places.slice(1).map((p,i)=>({contentid:p.id,contenttypeid:p.category==='food'||p.category==='cafe'?'39':'12',cat1:'A01',title:p.category==='cafe'?'검증 카페':p.name,addr1:p.address,mapx:String(p.longitude),mapy:String(p.latitude)})));
  }));
  const {TourApiProvider}=await import('../server/src/modules/recommendation/data/tour-api');
  const courses=await new TourApiProvider().fetchCourses(base);
  expect(courses).toHaveLength(1);expect(courses[0]?.places[0]?.id).toBe('tour-1234');
  expect(calls.some(c=>c.pathname.endsWith('detailCommon2')&&c.searchParams.get('contentId')==='1234')).toBe(true);
  expect(calls.filter(c=>c.pathname.endsWith('detailCommon2')).every(c=>!c.searchParams.has('defaultYN')&&!c.searchParams.has('mapinfoYN'))).toBe(true);
  expect(calls.filter(c=>c.pathname.endsWith('locationBasedList2')).every(c=>c.searchParams.get('mapX')==='127.5')).toBe(true);
 });
});
