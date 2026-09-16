import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTravelText } from '../src/domain/demoEngine';
import { courseDataSource } from '../src/domain/courseDataSource';
import { buildRulePlannedCourses, collectPlanningCandidates } from '../server/src/modules/recommendation/planner';
import type { TravelPreferences } from '../src/types/travel';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../server/src/modules/recommendation/data/kakao', () => ({ kakaoRequest: request }));
import { fetchKakaoCandidates, kakaoCandidate, mergePlaceCandidates, type KakaoPlaceDocument } from '../server/src/modules/recommendation/data/kakao-candidates';

const preferences: TravelPreferences = { ...parseTravelText('나주 자연 맛집 6시간'), city: '나주', startTime: '10:00',
  endTime: '16:00', durationHours: 6, mealPreference: 'auto', interests: ['nature', 'food'] };
const doc = (overrides: Partial<KakaoPlaceDocument> = {}): KakaoPlaceDocument => ({ id: '100', place_name: '금성관',
  address_name: '전남 나주시 과원동 109', road_address_name: '전남 나주시 금성관길 8',
  x: '126.718', y: '35.033', category_name: '여행 > 관광,명소 > 문화유적', category_group_code: 'AT4', ...overrides });

beforeEach(() => { request.mockReset(); request.mockResolvedValue(null); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Kakao supplemental place normalization', () => {
  it('uses actual place IDs and metadata without inventing photos, scores or opening hours', () => {
    const place = kakaoCandidate(doc(), '나주', 'attraction');
    expect(place).toMatchObject({ id: 'kakao-100', category: 'history', source: 'kakao', placeUrl: 'https://place.map.kakao.com/100' });
    expect(place).not.toHaveProperty('imageUrl'); expect(place).not.toHaveProperty('rating');
    expect(kakaoCandidate(doc({category_group_code:'',category_name:'여행 > 관광,명소 > 공원'}),'나주','attraction')?.category).toBe('nature');
    for(const category_name of ['여행 > 관광,명소 > 생태보존,서식지','여행 > 관광,명소 > 섬 > 섬(내륙)','여행 > 관광,명소 > 산','여행 > 관광,명소 > 도보여행 > 남파랑길'])
      expect(kakaoCandidate(doc({category_name}),'나주','attraction')?.category).toBe('nature');
  });
  it('rejects wrong cities/provinces, spoofed name matches and invalid coordinates', () => {
    for (const change of [{address_name:'전남 목포시 나주로'}, {address_name:'경기 광주시'},
      {address_name:'전남 나주시외곽'}, {x:''}, {x:'0'}, {y:'NaN'}, {id:'javascript:123'}]) {
      expect(kakaoCandidate(doc(change),'나주','attraction')).toBeNull();
    }
    expect(kakaoCandidate(doc(),'서울','attraction')).toBeNull();
  });
  it('keeps eateries but excludes cafes, bars and accommodation from meals', () => {
    const food=doc({category_group_code:'FD6',category_name:'음식점 > 한식 > 곰탕'});
    expect(kakaoCandidate(food,'나주','food')?.category).toBe('food');
    expect(kakaoCandidate({...food,category_name:'음식점 > 일식 > 소바'},'나주','food')?.category).toBe('food');
    for (const category_name of ['음식점 > 카페','음식점 > 술집 > 호프','음식점 > 베이커리','음식점 > 주점'])
      expect(kakaoCandidate({...food,category_name},'나주','food')).toBeNull();
    expect(kakaoCandidate(doc({category_group_code:'AD5',category_name:'여행 > 숙박 > 호텔'}),'나주','food')).toBeNull();
    for(const category_name of ['여행 > 숙박 > 호텔','여행 > 관광,명소 > 주차장','여행 > 숙박 > 캠핑장','여행 > 관광,명소 > 관광안내소'])
      expect(kakaoCandidate(doc({category_name}),'나주','attraction')).toBeNull();
  });
  it('deduplicates cross-provider names only near the same coordinates, retaining TourAPI identity and photo', () => {
    const original={id:'tour-1',name:'금성관',latitude:35.033,longitude:126.718,category:'history' as const,imageUrl:'https://tong.visitkorea.or.kr/photo.jpg' as string | undefined};
    const addition={...original,id:'kakao-100',name:'금성 관',latitude:35.0331,imageUrl:undefined};
    expect(mergePlaceCandidates([original],[addition])).toEqual([original]);
    expect(mergePlaceCandidates([original],[{...addition,latitude:35.05}])).toHaveLength(2);
    expect(mergePlaceCandidates([original],[{...addition,name:'금성관 별관'}])).toHaveLength(2);
    expect(mergePlaceCandidates([{...original,name:'[백년가게]식당',category:'food'}],[{...addition,name:'식당',category:'food'}])).toHaveLength(1);
  });
});

describe('bounded city-keyword requests', () => {
  it('requests both exact keywords by relevance, max 3 pages each, without any departure or GPS parameters', async () => {
    request.mockResolvedValue({documents:[doc()],meta:{is_end:false}});
    await fetchKakaoCandidates({...preferences,startAddress:'개인 출발지',startLatitude:35.1,startLongitude:126.8});
    expect(request).toHaveBeenCalledTimes(6);
    const params=request.mock.calls.map(call=>call[1]);
    expect(new Set(params.map(p=>p.query))).toEqual(new Set(['나주 가볼만한곳','나주 맛집']));
    expect(params.every(p=>p.sort==='accuracy'&&p.size==='15')).toBe(true);
    expect(params.every(p=>!('x' in p)&&!('y' in p)&&!('radius' in p))).toBe(true);
    expect(params.filter(p=>p.query.endsWith('맛집')).every(p=>p.category_group_code==='FD6')).toBe(true);
    expect(Math.max(...params.map(p=>Number(p.page)))).toBe(3);
  });
  it('skips food requests when meals are excluded, even with a food interest', async () => {
    request.mockResolvedValue({documents:[doc()],meta:{is_end:true}});
    expect(await fetchKakaoCandidates({...preferences,mealPreference:'none',meals:[]})).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1); expect(request.mock.calls[0]?.[1].query).toBe('나주 가볼만한곳');
  });
  it('returns partial data on an independent search failure; empty and unsupported city queries are safe', async () => {
    request.mockImplementation(async(_endpoint,params)=>params.query.endsWith('맛집')?Promise.reject(new Error('offline')):{documents:[doc()],meta:{is_end:true}});
    expect(await fetchKakaoCandidates(preferences)).toHaveLength(1);
    request.mockClear(); expect(await fetchKakaoCandidates({...preferences,city:'서울'})).toEqual([]);expect(request).not.toHaveBeenCalled();
    request.mockResolvedValue(null); expect(await fetchKakaoCandidates(preferences)).toEqual([]);
  });
});

describe('hybrid recommendation provider', () => {
  const reply=(items:unknown[])=>new Response(JSON.stringify({response:{header:{resultCode:'0000'},body:{items:{item:items}}}}));
  const tourism={contentid:'1',contenttypeid:'12',cat1:'A01',title:'강변공원',addr1:'전남 나주시',mapx:'126.718',mapy:'35.033',firstimage:'https://tong.visitkorea.or.kr/photo.jpg'};
  function kakaoReply() {
    request.mockImplementation(async(_endpoint,params)=>({meta:{is_end:true},documents:params.query.endsWith('맛집')
      ? [doc({id:'201',place_name:'나주 식당',category_group_code:'FD6',category_name:'음식점 > 한식',x:'126.719',y:'35.034'})]
      : [doc({id:'101',place_name:'강변 공원',category_name:'여행 > 관광,명소 > 공원'}),
        doc({id:'102',place_name:'호수공원',category_name:'여행 > 관광,명소 > 공원',x:'126.720',y:'35.035'}),
        doc({id:'103',place_name:'역사기념관',category_name:'문화,예술 > 문화시설 > 기념관',x:'126.721',y:'35.036'})]}));
  }
  it('merges Kakao places before planning, preserves TourAPI photos, and includes real supplemental meals', async () => {
    vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','fixture');kakaoReply();
    vi.stubGlobal('fetch',vi.fn(async(input)=>{const url=new URL(String(input));
      if(url.pathname.endsWith('ldongCode2'))return reply(url.searchParams.has('lDongRegnCd')?[{name:'나주시',code:'170'}]:[{name:'전라남도',code:'46'}]);
      return reply([tourism,{...tourism,contentid:'overnight',contenttypeid:'28',title:'강변캠핑장'}]);
    }));
    const {TourApiProvider}=await import('../server/src/modules/recommendation/data/tour-api');
    const courses=await new TourApiProvider().fetchCourses(preferences);
    const pool=collectPlanningCandidates(courses,preferences);
    expect(pool.find(p=>p.id==='tour-1')?.imageUrl).toBe(tourism.firstimage);
    expect(pool.some(p=>p.id==='kakao-101')).toBe(false);
    expect(pool.some(p=>p.id==='tour-overnight')).toBe(false);
    expect(pool.some(p=>p.id==='kakao-201'&&p.category==='food')).toBe(true);
    expect(courseDataSource(courses)).toBe('mixed');
    const planned=buildRulePlannedCourses(preferences,pool);
    expect(planned.length).toBeGreaterThan(0);
    expect(planned.some(c=>c.places.some(p=>p.id==='kakao-201'))).toBe(true);
    expect(planned.flatMap(c=>c.places).every(p=>p.dataSource)).toBe(true);
  });
  it('can use Kakao when TourAPI is unavailable without labeling it as TourAPI or demo', async () => {
    vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','');kakaoReply();
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const {TourApiProvider}=await import('../server/src/modules/recommendation/data/tour-api');
    const courses=await new TourApiProvider().fetchCourses(preferences);
    expect(courses.length).toBeGreaterThan(0);expect(courseDataSource(courses)).toBe('kakao');
    expect(courses.flatMap(c=>c.places).every(p=>p.id.startsWith('kakao-')&&!p.imageUrl)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    await expect(new TourApiProvider().fetchCourses({...preferences,requiredContentId:'1'})).rejects.toMatchObject({code:'REQUIRED_VISIT'});
  });
  it('keeps ordinary TourAPI recommendations when Kakao is unavailable', async () => {
    vi.resetModules();vi.stubEnv('DATA_GO_KR_KEY','fixture');request.mockResolvedValue(null);
    vi.stubGlobal('fetch',vi.fn(async(input)=>{const url=new URL(String(input));
      if(url.pathname.endsWith('ldongCode2'))return reply(url.searchParams.has('lDongRegnCd')?[{name:'나주시',code:'170'}]:[{name:'전라남도',code:'46'}]);
      return reply([tourism]);
    }));
    const {TourApiProvider}=await import('../server/src/modules/recommendation/data/tour-api');
    const courses=await new TourApiProvider().fetchCourses(preferences);
    expect(courses.length).toBeGreaterThan(0); expect(courseDataSource(courses)).toBe('tour-api');
  });
});
