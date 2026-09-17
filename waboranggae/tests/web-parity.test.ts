import {describe,it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {defaultCondition} from '../web/src/PlanWizard';
import {conditionToPreferences,preferencesToCondition,rankedToUiCourse} from '../web/src/mappers';
import {availableMeals,normalizeMeals,conditionError,hotPlaceSeed,visibleHomePlaces,acceptedCourses,canPreviewCourse} from '../web/src/parity';
import {forecastWindow} from '../web/src/useWeather';
import type {HotPlace,RankedCourse} from '../web/src/api';
const form=()=>({...defaultCondition(),region:'순천',endDate:'2026-09-20',departure:'선택한 출발지',departureLat:35.18,departureLng:126.9,date:'2026-09-20'});
const festival={id:'festival-123',name:'행사',city:'나주',category:'축제·행사',desc:'테스트 행사',img:'',visitors:0,source:'festival',eventStartDate:'20260921',eventEndDate:'20260925',tags:[]} as HotPlace;
afterEach(()=>{vi.useRealTimers()});
describe('Android / web parity',()=>{
  it('maps pace independently from walking burden',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    for(const [pace,expected] of [['여유롭게','easy'],['적당히','balanced'],['알차게','full']] as const){
      for(const walkLevel of ['보통','적게 걷기']){
        const p=conditionToPreferences({...form(),pace,walkLevel});
        expect(p.pace).toBe(expected);expect(p.lowMobility).toBe(walkLevel==='적게 걷기');
        expect(p.scheduleMode).toBe('course-first');expect(p.timeBudgetMode).toBe('local');
        expect(p.endTime).toBeUndefined();expect(p.preferredTransit).toEqual(['bus']);
        const reverse=preferencesToCondition(p);expect(reverse.pace).toBe(pace);expect(reverse.walkLevel).toBe(walkLevel);
      }
    }
  });
  it('uses the explicit location and never makes up a railway station',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    expect(()=>conditionToPreferences({...form(),departureLat:undefined})).toThrow('검색 결과');
    expect(conditionToPreferences({...form(),region:'고흥'}).startLocation).toBe('선택한 출발지');
    expect(conditionError({...form(),departureLat:Infinity})).toContain('검색 결과');
  });
  it('keeps the full range client-side and applies the end time to its last day',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    const p=conditionToPreferences({...form(),endDate:'2026-09-23',startTime:'12:00',endTime:'18:30',endTimeLimited:true});
    expect(p.travelEndDate).toBe('2026-09-23');expect(p.endTime).toBeUndefined();expect(p.daySchedules?.['2026-09-23']).toEqual({startTime:'09:00',endTime:'18:30'});
    expect(conditionError({...form(),startTime:'18:00',endTime:'12:00',endTimeLimited:true})).toContain('1시간');
  });
  it.each([['08:00','09:00',['아침']],['11:30','12:30',['점심']],['17:30','18:30',['저녁']],['13:31','16:00',[]]])('enables meals for %s-%s',(startTime,endTime,expected)=>{
    expect(availableMeals({startTime,endTime,endTimeLimited:true})).toEqual(expected);
  });
  it('keeps auto exclusive and no selection means no meals',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    expect(normalizeMeals({...form(),meals:['자동','점심']})).toEqual(['자동']);
    expect(conditionToPreferences({...form(),meals:[]}).meals).toEqual([]);
    expect(conditionToPreferences({...form(),meals:[]}).mealPreference).toBe('none');
    expect(conditionToPreferences({...form(),meals:['자동']}).meals).toBeUndefined();
    expect(availableMeals({...form(),endTimeLimited:false})).toEqual(['점심','저녁']);
  });
  it('retains explicit breakfast with the same legacy preference flag as Android',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    const p=conditionToPreferences({...form(),startTime:'08:00',meals:['아침']});
    expect(p.meals).toEqual(['breakfast']);expect(p.mealPreference).toBe('auto');
  });
  it('maps all five purpose buttons, without a duplicate photo/rest option',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    const p=conditionToPreferences({...form(),purpose:['자연 명소','맛집 탐방','카페','역사·문화','시장·골목']});
    expect(p.interests).toEqual(['nature','food','cafe','history','market']);
    expect(()=>conditionToPreferences({...form(),purpose:[]})).toThrow('여행 목적');
  });
  it('keeps a selected home event in the actual API request',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    const seed=hotPlaceSeed(festival,'2026-09-16');expect(seed.date).toBe('2026-09-21');
    const c={...form(),...seed,departure:'출발지',departureLat:35.1,departureLng:126.8};
    const p=conditionToPreferences(c);expect(p.requiredContentId).toBe('123');expect(p.requiredPlaceName).toBe('행사');
    expect(conditionError({...c,region:'순천'})).toContain('같은 여행지');
    expect(conditionError({...c,date:'2026-09-26',endDate:'2026-09-26'})).toContain('행사 기간');
  });
  it('excludes expired, malformed and undated events, but retains future events and destinations',()=>{
    const places=[festival,{...festival,id:'old',eventEndDate:'20260901'},{...festival,id:'bad',eventStartDate:'20260931'}, {...festival,id:'missing',eventEndDate:undefined}, {...festival,id:'tour',source:'tour-api',category:'명소'}] as HotPlace[];
    expect(visibleHomePlaces(places,'2026-09-16').map(p=>p.id)).toEqual(['festival-123','tour']);
  });
  const course={id:'kakao-1',title:'나주 현지 코스',origin:{name:'나주 현지 출발',latitude:35,longitude:126.7},places:[{id:'p1',name:'관광지',latitude:35.02,longitude:126.72,moveLabel:'도보',category:'nature',tags:[]}],durationHours:4,walkMinutes:45,transitMinutes:20,fitScore:80,matchedInterests:[],reason:{summary:'이유'},constraintPassed:true,scoreBreakdown:{walkingEase:70,transitAccess:70,nearbyLinks:80},walkingBreakdown:{walk:81,transit:82,time:83,transfer:84,distance:85,efficiency:86},timeBreakdown:{totalMinutes:265}} as unknown as RankedCourse;
  it('rejects demo / broken coordinates but permits a time-overrun route preview',()=>{
    expect(acceptedCourses('demo',[course])).toEqual([]);
    expect(acceptedCourses('mixed',[course])).toEqual([course]);
    expect(acceptedCourses('tour-api',[{...course,constraintPassed:false}])).toEqual([]);
    expect(canPreviewCourse({...course,constraintPassed:false})).toBe(true);
    expect(canPreviewCourse({...course,origin:undefined})).toBe(false);
  });
  it('uses all six server walking components without inventing scores',()=>{
    const ui=rankedToUiCourse(course);
    expect(ui.walkBreakdown.map(s=>s.value)).toEqual([81,82,83,84,85,86]);
    expect(ui.dataSource).toBe('real');expect(ui.prefScore).toBe(0);expect(ui.timeScore).toBe(0);
  });
  it('requests the selected date at the first destination, excluding intercity origin',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16'));
    const prefs=conditionToPreferences(form());const w=forecastWindow(course,prefs);
    expect(w).toEqual({lat:35.02,lng:126.72,date:'2026-09-20',start:'10:00',end:'14:25'});
    expect(forecastWindow({...course,durationHours:10,timeBreakdown:undefined},{...prefs,startTime:'18:00'})?.end).toBe('23:59');
  });
  it('removes abandoned prototype data and windows alerts; retains theme/dialogs and privacy',()=>{
    const app=readFileSync('web/src/App.tsx','utf8'),wizard=readFileSync('web/src/PlanWizard.tsx','utf8');
    for(const legacy of ['DEMO_HISTORY','NEARBY_POOL','LogoShowcase','window.confirm','window.alert','건너뛰기'])expect(app).not.toContain(legacy);
    for(const legacy of ['COMPANIONS','TRANSIT_MODES','QUICK_DEPARTURES','navigator.geolocation'])expect(wizard).not.toContain(legacy);
    expect(app).toContain('needsPrivacyConsent');expect(app).toContain('coursePrefs');expect(wizard).toContain('aria-label="여행지 선택"');
  });
});
