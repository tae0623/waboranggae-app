import {afterEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({route:vi.fn()}));
vi.mock('../server/src/modules/recommendation/data/kakao',()=>({fetchKakaoRoute:mocks.route}));
vi.mock('../server/src/modules/recommendation/data/geocoder',()=>({resolveStartOrigin:async()=>({name:'터미널',address:'순천',latitude:34.94,longitude:127.49,source:'user'})}));
import {attachRoutingToCourses,routingTestUtils} from '../server/src/modules/recommendation/routing';
import {parseTravelText,rankCourses as demoCourses} from '../src/domain/demoEngine';
import {rankCourses} from '../src/domain/rankCourses';
import {validateScheduledPlaces,parseClock} from '../server/src/modules/recommendation/planner';
import {normalizeTravelStart} from '../src/domain/startLocation';
afterEach(()=>vi.clearAllMocks());
function input(){const preferences={...parseTravelText('순천 터미널에서 2시간 자연 여행'),mealPreference:'none' as const};const course=demoCourses(preferences)[0]!;course.places=course.places.slice(0,2).map((p,i)=>({...p,category:'nature' as const,latitude:34.95+i*.03,longitude:127.50,stayMinutes:30}));return{preferences,course};}
describe('선택 코스 카카오 시간 반영',()=>{
  it('현지 코스는 30분 초과를 허용하지 않고 현실적인 체류 범위 안에서 맞춘다',async()=>{
    const {course}=input();
    const preferences={...input().preferences,timeBudgetMode:'local' as const,durationHours:6,startTime:'10:00',endTime:'16:00',mealPreference:'lunch' as const,interests:['nature','food','cafe'] as ('nature'|'food'|'cafe')[]};
    const categories=['nature','food','cafe','nature'] as const;
    course.places=categories.map((category,i)=>({...course.places[0]!,id:'local-'+i,name:String(i),category,latitude:34.95+i*.01,longitude:127.5,stayMinutes:category==='food'?60:category==='cafe'?50:70}));
    mocks.route.mockImplementation(async(from,to)=>({fromName:from.name,toName:to.name,source:'kakao',distanceKm:2,totalMinutes:[45,18,18,37][Number(to.name)],walkMinutes:5,transitMinutes:[40,13,13,32][Number(to.name)],modeLabel:'대중교통',instruction:'이동',steps:[],geometry:[from,to]}));
    const updated=(await attachRoutingToCourses(preferences,[course],{live:true}))[0]!;
    expect(updated.timeBreakdown?.totalMinutes).toBe(360);
    expect(updated.places.find(p=>p.category==='food')!.stayMinutes).toBeGreaterThanOrEqual(45);
    expect(updated.places.find(p=>p.category==='cafe')!.stayMinutes).toBeGreaterThanOrEqual(40);
    const over={...updated,timeBreakdown:{...updated.timeBreakdown!,totalMinutes:361,overBudgetMinutes:1}};
    expect(rankCourses(preferences,[over])[0]?.constraintPassed).toBe(false);
  });
  it('짧은 구간에서 실제 도보와 대중교통 시간을 비교한다',async()=>{
    const from={name:'출발',latitude:35,longitude:127},to={name:'도착',latitude:35.01,longitude:127};
    mocks.route.mockImplementation(async(a,b,mode)=>({fromName:a.name,toName:b.name,source:'kakao',distanceKm:1.2,totalMinutes:mode==='walk'?18:30,walkMinutes:mode==='walk'?18:4,transitMinutes:mode==='walk'?0:26,modeLabel:mode,instruction:mode,steps:[],geometry:[a,b]}));
    const result=await routingTestUtils.routeBetween(from,to,true,input().preferences);
    expect(result.totalMinutes).toBe(18);expect(result.transitMinutes).toBe(0);
    expect(mocks.route.mock.calls.map(c=>c[2]).sort()).toEqual(['transit','walk']);
  });
  it('여러 후보의 같은 구간은 한 번만 조회하며 한 묶음 조회를 24개로 제한한다',async()=>{
    mocks.route.mockImplementation(async(a,b)=>({fromName:a.name,toName:b.name,source:'kakao',distanceKm:1,totalMinutes:10,walkMinutes:10,transitMinutes:0,modeLabel:'도보',instruction:'도보',steps:[],geometry:[a,b]}));
    const {preferences,course}=input();
    await attachRoutingToCourses(preferences,[course,{...course,id:'same-route'}],{live:true});
    expect(mocks.route.mock.calls.length).toBe(3);
    mocks.route.mockClear();
    const many=Array.from({length:20},(_,i)=>({...course,id:'many-'+i,places:course.places.map((p,n)=>({...p,id:`place-${i}-${n}`,latitude:34+i*.1+n*.02,longitude:128}))}));
    const results=await attachRoutingToCourses(preferences,many,{live:true});
    expect(mocks.route.mock.calls.length).toBeLessThanOrEqual(24);expect(results.some(c=>c.routeSource!=='kakao')).toBe(true);
  });
  it('도시 간 첫 이동을 포함하고 늦은 점심과 카페를 함께 앞당긴다',async()=>{
    mocks.route.mockImplementation(async(from,to)=>{
      const minutes=from.name==='터미널'?126:12;
      return {fromName:from.name,toName:to.name,source:'kakao',distanceKm:1,totalMinutes:minutes,walkMinutes:from.name==='터미널'?6:12,transitMinutes:from.name==='터미널'?120:0,modeLabel:'이동',instruction:'이동',steps:[],geometry:[from,to]};
    });
    const {course}=input();const preferences={...input().preferences,durationHours:8,startTime:'10:00',endTime:'18:00',mealPreference:'lunch' as const,interests:['nature','food','cafe'] as const};
    const categories=['market','nature','food','cafe','history'] as const;
    course.places=categories.map((category,i)=>({...course.places[0]!,id:'repair-'+i,name:'장소'+i,category,latitude:34.95+i*.001,longitude:127.50,stayMinutes:category==='food'?60:category==='market'||category==='cafe'?50:70}));
    const prefs={...preferences,interests:[...preferences.interests]};
    const updated=(await attachRoutingToCourses(prefs,[course],{live:true}))[0]!;
    expect(validateScheduledPlaces(prefs,updated.places)).toEqual([]);
    expect(updated.places.map(p=>p.id).sort()).toEqual(course.places.map(p=>p.id).sort());
    const meal=updated.places.findIndex(p=>p.category==='food');
    expect(meal).toBeLessThan(2);expect(updated.places[meal+1]?.category).toBe('cafe');
    expect(parseClock(updated.places[meal]!.arrival)).toBeLessThanOrEqual(810);
    expect(updated.timeBreakdown?.originToFirstMinutes).toBe(126);
    expect(updated.timeBreakdown?.totalMinutes).toBe(480);
    const time=updated.timeBreakdown!;
    expect(time.originToFirstMinutes+time.betweenPlacesMinutes+time.stayMinutes+time.waitAndRestMinutes).toBe(time.totalMinutes);
    expect(updated.validationNotes).toContain('식사 시간에 맞춰 방문 순서 조정');
    expect(mocks.route.mock.calls.length).toBeLessThanOrEqual(10);
  });
  it('첫 장소가 식사일 때 도착 전 대기를 총시간에서 누락하지 않는다',async()=>{
    mocks.route.mockImplementation(async(from,to)=>({fromName:from.name,toName:to.name,source:'kakao',distanceKm:1,totalMinutes:10,walkMinutes:10,transitMinutes:0,modeLabel:'도보',instruction:'도보',steps:[],geometry:[from,to]}));
    const {course,preferences}=input();const p={...preferences,durationHours:4,startTime:'10:00',mealPreference:'lunch' as const};
    course.places=course.places.map((place,i)=>({...place,category:i===0?'food':'cafe',stayMinutes:60}));
    const result=(await attachRoutingToCourses(p,[course],{live:true}))[0]!;
    expect(result.timeBreakdown?.waitAndRestMinutes).toBe(80);
    expect(rankCourses(p,[result])[0]?.scoreFacts.tripMinutes).toBe(result.timeBreakdown?.totalMinutes);
  });
  it('선택한 다른 도시의 주소를 목적지 도시 터미널로 바꾸지 않는다',()=>{
    const {preferences}=input();const selected={...preferences,city:'나주',startLocation:'광주에서 고른 장소',startType:'terminal' as const,startLatitude:35.18,startLongitude:126.91};
    expect(normalizeTravelStart(selected).startLocation).toBe('광주에서 고른 장소');
  });
  it('전체 구간 합계와 각 장소 도착시간을 다시 계산한다',async()=>{
    mocks.route.mockImplementation(async(from,to)=>({fromName:from.name,toName:to.name,source:'kakao',distanceKm:1,totalMinutes:15,walkMinutes:5,transitMinutes:10,modeLabel:'도보·버스',instruction:'버스 이동',steps:[{mode:'walk',minutes:5,label:'도보'},{mode:'bus',minutes:10,label:'버스'}],geometry:[from,to]}));
    const {preferences,course}=input();const result=(await attachRoutingToCourses(preferences,[course],{live:true}))[0]!;
    expect(result.routeSource).toBe('kakao');expect(result.walkMinutes).toBe(10);expect(result.transitMinutes).toBe(20);
    expect(result.places.every(p=>p.moveMinutes===15&&p.routeSource==='kakao')).toBe(true);expect(result.origin?.name).toBe('터미널');expect(mocks.route).toHaveBeenCalledTimes(3);
    expect(rankCourses(preferences,[result])[0]?.scoreFacts.moveMinutes).toBe(30);
  });
  it('조회 실패 구간은 추정으로 명시하고 실제 시간으로 꾸미지 않는다',async()=>{
    mocks.route.mockResolvedValue(null);const {preferences,course}=input();const result=(await attachRoutingToCourses(preferences,[course],{live:true}))[0]!;
    expect(result.routeSource).toBe('estimated');expect(result.routeSegments?.every(s=>s.source==='estimated')).toBe(true);
  });
  it('실제 이동이 예산을 넘으면 점수 검증에서 탈락한다',async()=>{
    mocks.route.mockImplementation(async(from,to)=>({fromName:from.name,toName:to.name,source:'kakao',distanceKm:8,totalMinutes:90,walkMinutes:10,transitMinutes:80,modeLabel:'버스',instruction:'버스',steps:[],geometry:[from,to]}));
    const {preferences,course}=input();const result=await attachRoutingToCourses(preferences,[course],{live:true});
    expect(rankCourses(preferences,result)[0]?.constraintPassed).toBe(false);
  });
});
