import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiError, tokenStore, unwrapList, type AuthUser, type BookmarkItem, type HistoryItem, type HotPlace, type PlaceSuggestion, type RankedCourse, type TravelPreferences } from './api'
import { conditionToPreferences, preferencesToCondition, rankedToUiCourse } from './mappers'

// ── Design tokens (clean white-first, reference-matched) ──────────────────────
const L = {
  purple: '#5B21B6', purpleDark: '#4C1D95', purpleMid: '#7C3AED',
  purpleLight: '#EDE9FE', purpleSoft: '#C4B5FD',
  dark: '#1C1C1E',
  bg: '#F2F4F8',
  bgSoft: '#F9F9FB',
  surface: '#FFFFFF',
  border: '#E4E4E9',
  borderLight: '#F2F2F7',
  text: '#1C1C1E',
  textSec: '#636366',
  textMuted: '#AEAEB2',
  onDark: '#FFFFFF', onDarkSec: 'rgba(255,255,255,0.75)', onDarkMuted: 'rgba(255,255,255,0.45)',
  success: '#059669', successLight: '#ECFDF5',
  error: '#DC2626', errorLight: '#FEF2F2',
  teal: '#0D9488', tealLight: '#F0FDFA',
  demoOrange: '#D97706', blue: '#2563EB', blueLight: '#EFF6FF',
  shadowSm: '0 2px 8px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 20px rgba(0,0,0,0.09)',
  shadowLg: '0 8px 40px rgba(0,0,0,0.13)',
  rSm: 10, rMd: 14, rLg: 18, rXl: 24, rFull: 9999, tabH: 74,
}

type Screen = 'splash' | 'login' | 'main'
type Tab = 'home' | 'course' | 'map' | 'mytravel'
export type PlaceCat = 'transit' | 'nature' | 'meal' | 'cafe' | 'market' | 'history' | 'culture'
type CourseState = 'idle' | 'loading' | 'success' | 'error' | 'demo'

export interface Condition {
  departure: string; region: string; date: string; endDate: string
  startTime: string; endTime: string
  duration: number; meal: string; meals: string[]; walkLevel: string; companion: string
  interests: string[]; purpose: string[]; atmosphere: string[]
  pace: string; isLocal: boolean; transitOnly: boolean
  transitModes: string[]
  departureAddress?: string; departureLat?: number; departureLng?: number
  lodging?: string; lodgingAddress?: string; lodgingLat?: number; lodgingLng?: number
}
export interface TransitStep {
  mode: 'walk' | 'bus' | 'subway' | 'train' | 'expressbus' | 'ferry' | 'other'
  route?: string
  label: string
  minutes: number
  fromStop?: string
  toStop?: string
}
export interface Place {
  id: string; category: PlaceCat; name: string; address: string
  arriveAt: string; stayMin: number; description: string
  interests: string[]
  transitTo?: string; transitMin?: number; transitMode?: 'bus' | 'walk' | 'shuttle'
  transitSteps?: TransitStep[]
}
interface Locker { name: string; distanceM: number; available: boolean }
interface ScoreItem { label: string; value: number; weight: number }
interface WalkItem { label: string; stars: number; detail: string }
export interface Course {
  id: string; city: string; title: string; subtitle: string
  score: number; walkFitScore: number
  prefScore: number; timeScore: number; completionScore: number
  hours: number; distanceKm: number; placeCount: number
  walkMin: number; transitMin: number; transferCount: number
  imageUrl: string; tags: string[]; reason: string
  dataSource: 'real' | 'demo' | 'ai'; routeSource: 'tmap' | 'estimated' | 'mixed'
  places: Place[]; locker: Locker[]
  scoreBreakdown: ScoreItem[]; walkBreakdown: WalkItem[]
}
interface HistoryEntry { id: string; summary: string; city: string; date: string; condition: Condition }

const REGIONS = [
  { name: '강진', desc: '다산 정약용의 고장, 청자박물관' },
  { name: '고흥', desc: '나로우주센터, 소록도' },
  { name: '곡성', desc: '섬진강 기차마을, 장미공원' },
  { name: '광양', desc: '매화마을, 섬진강 백운산' },
  { name: '구례', desc: '지리산 노고단, 화엄사' },
  { name: '나주', desc: '나주 영산강, 나주배 명산지' },
  { name: '담양', desc: '죽녹원, 메타세쿼이아 가로수길' },
  { name: '목포', desc: '근대역사문화공간, 유달산' },
  { name: '무안', desc: '회산백련지, 무안황토' },
  { name: '보성', desc: '녹차밭, 한국차박물관' },
  { name: '순천', desc: '국가정원, 순천만습지' },
  { name: '신안', desc: '1004섬, 퍼플섬' },
  { name: '여수', desc: '오동도, 이순신광장, 밤바다' },
  { name: '영광', desc: '법성포 굴비, 불갑사' },
  { name: '영암', desc: '월출산, 왕인박사 유적지' },
  { name: '완도', desc: '청산도, 고금도' },
  { name: '장성', desc: '백양사, 황룡강 노란꽃잔치' },
  { name: '장흥', desc: '천관산, 정남진 편백숲' },
  { name: '진도', desc: '진도개, 운림산방' },
  { name: '함평', desc: '함평나비축제, 돌머리해수욕장' },
  { name: '해남', desc: '땅끝마을, 두륜산 대흥사' },
  { name: '화순', desc: '운주사, 화순온천' },
]

function localISODate(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const QUICK_DEPARTURES = ['순천역', '여수엑스포역', '목포역', '광주송정역', '나주역']
const DEFAULT_CONDITION: Condition = {
  departure: '', region: '', date: localISODate(),
  endDate: localISODate(),
  startTime: '10:00', endTime: '16:00', duration: 6, meal: '점심', meals: ['점심'],
  walkLevel: '적게 걷기',
  companion: '혼자', interests: [], purpose: [], atmosphere: [],
  pace: '적당히', isLocal: false, transitOnly: true, transitModes: ['bus'],
}

const COURSES: Course[] = [
  {
    id: 'sc-1', city: '순천', title: '정원과 시장을 잇는 순천 하루',
    subtitle: '순천만국가정원 → 낙안읍성 → 남도 한정식',
    score: 92, walkFitScore: 89, prefScore: 94, timeScore: 96, completionScore: 91,
    hours: 6, distanceKm: 8.4, placeCount: 6, walkMin: 32, transitMin: 38, transferCount: 1,
    imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=700&h=500&fit=crop&auto=format',
    tags: ['자연', '역사', '맛집', '사진', '적게 걷기', '로컬'], dataSource: 'real', routeSource: 'tmap',
    reason: '자연과 사진 찍기 좋은 장소를 선호하고, 많이 걷는 것을 원하지 않는 조건을 반영했어요. 장소 간 이동거리가 짧고 환승이 적어 여유롭게 여행할 수 있어요.',
    places: [
      { id: 's0', category: 'transit', name: '순천역', address: '전남 순천시 역전광장 1', arriveAt: '09:00', stayMin: 0, description: '출발 거점. 1번 출구 앞 정류장에서 67번 탑승', interests: [], transitTo: '67번 버스 24분', transitMin: 28, transitMode: 'bus', transitSteps: [{ mode: 'walk', label: '도보', minutes: 4 }, { mode: 'bus', route: '67', label: '67번 버스', minutes: 24, fromStop: '순천역', toStop: '국가정원역' }] },
      { id: 's1', category: 'nature', name: '순천만국가정원', address: '전남 순천시 국가정원1호길 47', arriveAt: '09:30', stayMin: 80, description: '국내 최초 국가정원. 습지와 생태 공원이 어우러진 사계절 여행지.', interests: ['자연', '사진', '산책로'], transitTo: '도보 15분', transitMin: 15, transitMode: 'walk', transitSteps: [{ mode: 'walk', label: '도보', minutes: 15 }] },
      { id: 's2', category: 'nature', name: '순천만습지', address: '전남 순천시 순천만길 513-25', arriveAt: '11:05', stayMin: 45, description: '람사르 습지. 갈대밭과 흑두루미 서식지. 용산 전망대에서 S자 수로 감상.', interests: ['자연', '사진'], transitTo: '71번 버스 36분', transitMin: 42, transitMode: 'bus', transitSteps: [{ mode: 'walk', label: '도보', minutes: 6 }, { mode: 'bus', route: '71', label: '71번 버스', minutes: 36, fromStop: '순천만습지', toStop: '낙안면' }] },
      { id: 's3', category: 'meal', name: '남도진미 순천점', address: '전남 순천시 장평로 15', arriveAt: '12:30', stayMin: 60, description: '간장게장·갈치조림 전문 남도 한정식. 현지인 맛집.', interests: ['로컬 맛집', '전통음식'], transitTo: '셔틀 → 낙안읍성', transitMin: 25, transitMode: 'shuttle' },
      { id: 's4', category: 'history', name: '낙안읍성 민속촌', address: '전남 순천시 낙안면 낙안읍성길 43', arriveAt: '14:00', stayMin: 75, description: '조선시대 돌담 성곽과 초가집이 살아있는 민속촌.', interests: ['역사 유적', '사진'], transitTo: '셔틀 역방향 → 순천역', transitMin: 45, transitMode: 'shuttle' },
      { id: 's5', category: 'cafe', name: '그린노트 카페', address: '전남 순천시 국가정원1호길 22', arriveAt: '16:00', stayMin: 55, description: '국가정원 전망 테라스. 로컬 정원사가 운영.', interests: ['카페·디저트', '사진'], transitTo: '67번 버스 → 순천역', transitMin: 28, transitMode: 'bus' },
    ],
    locker: [{ name: '순천역 보관함 (1번 출구)', distanceM: 50, available: true }, { name: '국가정원 입구 보관함', distanceM: 120, available: true }],
    scoreBreakdown: [
      { label: '취향 적합도', value: 94, weight: 40 },
      { label: '뚜벅이 적합도', value: 89, weight: 35 },
      { label: '시간 적합도', value: 96, weight: 15 },
      { label: '코스 완성도', value: 91, weight: 10 },
    ],
    walkBreakdown: [
      { label: '도보 부담', stars: 5, detail: '총 도보 32분 · 걷기 부담 없음' },
      { label: '대중교통 접근성', stars: 4, detail: '버스 직결 · 예약 불필요' },
      { label: '환승 편의성', stars: 5, detail: '환승 1회 · 셔틀 포함' },
      { label: '이동 효율', stars: 4, detail: '여행시간의 81%를 장소에서 보냄' },
    ],
  },
  {
    id: 'ys-1', city: '여수', title: '바다와 야경, 여수 오후 반나절',
    subtitle: '여수엑스포역 → 오동도 → 진남관 → 밤바다',
    score: 87, walkFitScore: 82, prefScore: 88, timeScore: 84, completionScore: 85,
    hours: 6, distanceKm: 5.2, placeCount: 5, walkMin: 45, transitMin: 55, transferCount: 2,
    imageUrl: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=700&h=500&fit=crop&auto=format',
    tags: ['바다', '사진', '카페', '야경', '역사'], dataSource: 'demo', routeSource: 'estimated',
    reason: '엑스포역 도보권 오동도, 이동 최소화 동선, 여수 밤바다 야경 직결 코스예요.',
    places: [
      { id: 'y0', category: 'transit', name: '여수엑스포역', address: '전남 여수시 박람회길 1', arriveAt: '13:00', stayMin: 0, description: '출발 거점. KTX/SRT 정차. 역 앞 정류장 도보 2분.', interests: [], transitTo: '도보 20분', transitMin: 20, transitMode: 'walk' },
      { id: 'y1', category: 'nature', name: '오동도', address: '전남 여수시 오동도로 222', arriveAt: '13:20', stayMin: 65, description: '동백꽃과 해안 산책로. 섬 내 모노레일 왕복 3,000원.', interests: ['바다', '사진', '산책로'], transitTo: '시내버스 7번', transitMin: 25, transitMode: 'bus' },
      { id: 'y2', category: 'history', name: '진남관', address: '전남 여수시 동문로 11', arriveAt: '15:00', stayMin: 40, description: '국보 304호. 이순신 장군 삼도수군 지휘소.', interests: ['역사 유적'], transitTo: '버스 2번', transitMin: 20, transitMode: 'bus' },
      { id: 'y3', category: 'meal', name: '돌산 갓김치 서대회 전문점', address: '전남 여수시 돌산읍', arriveAt: '17:30', stayMin: 60, description: '여수 돌산 갓김치·서대회무침 저녁. 1인 15,000원.', interests: ['로컬 맛집', '해산물'], transitTo: '도보 10분', transitMin: 10, transitMode: 'walk' },
      { id: 'y4', category: 'cafe', name: '씨사이드 카페', address: '전남 여수시 해양공원 내', arriveAt: '19:10', stayMin: 60, description: '여수 밤바다 조망 테라스. 야경 사진 명소.', interests: ['카페·디저트', '사진', '야경'], transitTo: '', transitMin: 0 },
    ],
    locker: [],
    scoreBreakdown: [
      { label: '취향 적합도', value: 88, weight: 40 },
      { label: '뚜벅이 적합도', value: 82, weight: 35 },
      { label: '시간 적합도', value: 84, weight: 15 },
      { label: '코스 완성도', value: 85, weight: 10 },
    ],
    walkBreakdown: [
      { label: '도보 부담', stars: 4, detail: '총 도보 45분 · 다소 있음' },
      { label: '대중교통 접근성', stars: 4, detail: '버스 연결 · 배차 15분' },
      { label: '환승 편의성', stars: 3, detail: '환승 2회 필요' },
      { label: '이동 효율', stars: 4, detail: '여행시간의 75%를 장소에서 보냄' },
    ],
  },
  {
    id: 'mk-1', city: '목포', title: '항구 도시 목포, 역사와 맛 탐방',
    subtitle: '목포역 → 근대역사거리 → 유달산 → 수산시장',
    score: 84, walkFitScore: 78, prefScore: 82, timeScore: 88, completionScore: 84,
    hours: 6, distanceKm: 6.1, placeCount: 5, walkMin: 52, transitMin: 45, transferCount: 2,
    imageUrl: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=700&h=500&fit=crop&auto=format',
    tags: ['역사', '시장', '사진', '로컬', '구도심'], dataSource: 'demo', routeSource: 'mixed',
    reason: '역 도보권 근대건축 밀집, 케이블카로 이동 최소화, 수산시장 직행 코스예요.',
    places: [
      { id: 'm0', category: 'transit', name: '목포역', address: '전남 목포시 통일대로 1', arriveAt: '10:00', stayMin: 0, description: '출발 거점. KTX 정차역.', interests: [], transitTo: '도보 15분', transitMin: 15, transitMode: 'walk' },
      { id: 'm1', category: 'history', name: '목포 근대역사문화공간', address: '전남 목포시 영산로 29번길 6', arriveAt: '10:15', stayMin: 70, description: '일제강점기 건축물 보존 구역. 붉은 벽돌 포토스팟.', interests: ['역사 유적', '사진', '근현대 문화'], transitTo: '도보 20분', transitMin: 20, transitMode: 'walk' },
      { id: 'm2', category: 'nature', name: '유달산', address: '전남 목포시 유달로 180', arriveAt: '12:05', stayMin: 55, description: '목포 시내와 다도해 전망. 케이블카 왕복 이용.', interests: ['전망 좋은 곳', '사진'], transitTo: '버스 2번', transitMin: 20, transitMode: 'bus' },
      { id: 'm3', category: 'meal', name: '목포 민어회 명가', address: '전남 목포시 해안로', arriveAt: '13:30', stayMin: 60, description: '제철 민어회와 홍탁 삼합. 2인 5만 원 내외.', interests: ['로컬 맛집', '해산물'], transitTo: '도보 5분', transitMin: 5, transitMode: 'walk' },
      { id: 'm4', category: 'market', name: '남진수산 전통시장', address: '전남 목포시 항동1가', arriveAt: '15:00', stayMin: 65, description: '활어·건어물 전통시장. 홍어 전문점 밀집.', interests: ['전통시장', '로컬 골목', '시장 먹거리'], transitTo: '', transitMin: 0 },
    ],
    locker: [],
    scoreBreakdown: [
      { label: '취향 적합도', value: 82, weight: 40 },
      { label: '뚜벅이 적합도', value: 78, weight: 35 },
      { label: '시간 적합도', value: 88, weight: 15 },
      { label: '코스 완성도', value: 84, weight: 10 },
    ],
    walkBreakdown: [
      { label: '도보 부담', stars: 3, detail: '총 도보 52분 · 보통 수준' },
      { label: '대중교통 접근성', stars: 4, detail: '버스 연결 양호' },
      { label: '환승 편의성', stars: 3, detail: '환승 2회 · 도보 구간 있음' },
      { label: '이동 효율', stars: 4, detail: '여행시간의 78%를 장소에서 보냄' },
    ],
  },
]

const DEMO_HISTORY: HistoryEntry[] = [
  { id: 'h1', summary: '순천 · 6시간 · 자연·맛집 · 적게 걷기', city: '순천', date: '2025-03-12', condition: { ...DEFAULT_CONDITION, departure: '순천역', region: '순천', purpose: ['자연·풍경', '맛집'] } },
  { id: 'h2', summary: '여수 · 4시간 · 카페 · 혼자', city: '여수', date: '2025-02-20', condition: { ...DEFAULT_CONDITION, departure: '여수엑스포역', region: '여수', duration: 4, endTime: '14:00', purpose: ['카페'] } },
]

const S = {
  text: (size: number, weight: number | string = 400, color = L.text, lineH?: number): React.CSSProperties => ({
    fontSize: size, fontWeight: weight, color, lineHeight: lineH ?? 1.4, fontFamily: "'Pretendard Variable', Pretendard, sans-serif",
  }),
}

// ── Icons ────────────────────────────────────────────────────────────────────
const Ic = ({ n, sz = 20, c = 'currentColor' }: { n: string; sz?: number; c?: string }) => {
  const paths: Record<string, string> = {
    home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    list: 'M4 6h16M4 10h16M4 14h16M4 18h16',
    map: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    back: 'M10 19l-7-7m0 0l7-7m-7 7h18', close: 'M6 18L18 6M6 6l12 12',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    location: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
    check: 'M5 13l4 4L19 7', chevR: 'M9 5l7 7-7 7', chevD: 'M19 9l-7 7-7-7',
    star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
    bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3-7 3V5z',
    share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
    clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    filter: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z',
    eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    'eye-off': 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21',
    plus: 'M12 4v16m8-8H4',
    minus: 'M20 12H4',
  }
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {paths[n] && <path d={paths[n]} />}
    </svg>
  )
}

const Badge = ({ type }: { type: string }) => {
  const m: Record<string, { bg: string; c: string; t: string }> = {
    real: { bg: '#ECFDF5', c: '#059669', t: '실데이터' },
    demo: { bg: '#FEF9C3', c: '#92400E', t: '시연' },
    ai: { bg: '#EDE9FE', c: '#5B21B6', t: 'AI 구성' },
    tmap: { bg: '#EFF6FF', c: '#2563EB', t: 'TMAP' },
    estimated: { bg: 'rgba(255,255,255,0.85)', c: '#636366', t: '예상' },
    mixed: { bg: '#FFF7ED', c: '#9A3412', t: '혼합' },
  }
  const s = m[type] ?? { bg: '#F2F2F7', c: '#636366', t: type }
  return <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.c, borderRadius: 6, padding: '2px 7px' }}>{s.t}</span>
}

const DualScore = ({ score, walkFit }: { score: number; walkFit: number }) => (
  <div style={{ display: 'flex', gap: 5 }}>
    <span style={{ background: 'rgba(255,255,255,0.92)', color: L.dark, borderRadius: L.rFull, padding: '4px 10px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
      ★ {score}
    </span>
    <span style={{ background: 'rgba(255,255,255,0.92)', color: L.teal, borderRadius: L.rFull, padding: '4px 10px', fontSize: 12, fontWeight: 800, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
      🚶{walkFit}
    </span>
  </div>
)

const Stars = ({ count }: { count: number }) => (
  <span style={{ color: '#F59E0B', fontSize: 14, letterSpacing: 1 }}>{'★'.repeat(count)}{'☆'.repeat(5 - count)}</span>
)

const Btn = ({ children, onClick, disabled, loading, ghost, sm, frost }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; ghost?: boolean; sm?: boolean; frost?: boolean
}) => (
  <button onClick={onClick} disabled={disabled || loading}
    style={{ background: frost ? 'rgba(255,255,255,0.16)' : ghost ? 'transparent' : disabled ? L.border : L.dark, color: frost || (!ghost && !disabled) ? '#fff' : ghost ? L.dark : L.textMuted, border: frost ? '1px solid rgba(255,255,255,0.22)' : ghost ? `2px solid ${L.dark}` : 'none', borderRadius: L.rFull, padding: sm ? '10px 20px' : '16px 20px', fontSize: sm ? 14 : 15, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", width: '100%', minHeight: sm ? 40 : 54, boxShadow: frost ? 'none' : disabled || ghost ? 'none' : '0 4px 16px rgba(0,0,0,0.2)', backdropFilter: frost ? 'blur(14px)' : undefined, WebkitBackdropFilter: frost ? 'blur(14px)' : undefined, transition: 'all 0.14s' }}>
    {loading && <div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.25)', borderTop: '2.5px solid #fff', borderRadius: 9999 }} className="spin" />}
    {children}
  </button>
)

const TxtInput = ({ value, onChange, placeholder, type = 'text', icon, autoFocus, glass }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: string; autoFocus?: boolean; glass?: boolean }) => {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><Ic n={icon} sz={17} c={glass ? 'rgba(255,255,255,0.7)' : L.textMuted} /></span>}
      <input autoFocus={autoFocus} type={type === 'password' ? (show ? 'text' : 'password') : type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={glass ? 'glass-input' : undefined}
        style={{ width: '100%', padding: `15px ${type === 'password' ? 48 : 16}px 15px ${icon ? 46 : 16}px`, border: glass ? '1px solid rgba(255,255,255,0.16)' : `1.5px solid ${L.border}`, borderRadius: glass ? 16 : L.rMd, fontSize: 15, color: glass ? '#fff' : L.text, background: glass ? 'rgba(255,255,255,0.07)' : L.bgSoft, outline: 'none', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", boxSizing: 'border-box', backdropFilter: glass ? 'blur(10px)' : undefined, WebkitBackdropFilter: glass ? 'blur(10px)' : undefined }} />
      {type === 'password' && <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Ic n={show ? 'eye-off' : 'eye'} sz={17} c={glass ? 'rgba(255,255,255,0.7)' : L.textMuted} /></button>}
    </div>
  )
}

const Toggle = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
  <button onClick={() => onChange(!on)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: '12px 0', cursor: 'pointer', width: '100%' }}>
    <div style={{ position: 'relative', width: 46, height: 27, borderRadius: 14, background: on ? L.dark : L.border, transition: 'background 0.18s', flexShrink: 0 }}>
      <div style={{ width: 21, height: 21, borderRadius: 11, background: '#fff', position: 'absolute', top: 3, left: on ? 22 : 3, transition: 'left 0.18s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
    </div>
    <div style={{ textAlign: 'left' }}>
      <div style={S.text(14, 600, L.text)}>{label}</div>
      {sub && <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 1 }}>{sub}</div>}
    </div>
  </button>
)

const Empty = ({ icon, title, desc, cta, onCta }: { icon: string; title: string; desc?: string; cta?: string; onCta?: () => void }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', textAlign: 'center', gap: 12 }}>
    <div style={{ width: 72, height: 72, borderRadius: 36, background: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Ic n={icon} sz={28} c={L.textMuted} />
    </div>
    <div style={S.text(17, 700, L.text)}>{title}</div>
    {desc && <div style={{ ...S.text(14, 400, L.textMuted), maxWidth: 270, lineHeight: 1.65 }}>{desc}</div>}
    {cta && onCta && <button onClick={onCta} style={{ marginTop: 6, background: L.dark, color: '#fff', border: 'none', borderRadius: L.rFull, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>{cta}</button>}
  </div>
)

const Skel = ({ h, w = '100%', r = 10 }: { h: number; w?: number | string; r?: number }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: r, flexShrink: 0 }} />
)

// ── Tab Bar (dark circle active — reference style) ────────────────────────────
const TabBar = ({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) => (
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: L.tabH, background: L.surface, borderTop: `1px solid ${L.borderLight}`, display: 'flex', alignItems: 'center', zIndex: 100, paddingBottom: 10 }}>
    {([['home','홈'],['course','코스'],['map','동선'],['mytravel','내 여행']] as [Tab,string][]).map(([id, label]) => {
      const on = active === id
      const icName = id === 'home' ? 'home' : id === 'course' ? 'list' : id === 'map' ? 'map' : 'user'
      return (
        <button key={id} onClick={() => onChange(id)} className="tab-btn"
          style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 44, height: 32, borderRadius: 12, background: on ? L.dark : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.18s' }}>
            <Ic n={icName} sz={20} c={on ? '#fff' : L.textMuted} />
          </div>
          <span style={{ fontSize: 10, fontWeight: on ? 700 : 400, color: on ? L.dark : L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{label}</span>
        </button>
      )
    })}
  </div>
)

const Sheet = ({ children, onClose, maxH = '90%' }: { children: React.ReactNode; onClose: () => void; maxH?: string }) => (
  <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.36)' }} onClick={onClose} className="anim-fade-in" />
    <div className="anim-sheet" style={{ position: 'relative', background: L.surface, borderRadius: `${L.rXl}px ${L.rXl}px 0 0`, maxHeight: maxH, overflowY: 'auto', paddingBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: L.border }} />
      </div>
      {children}
    </div>
  </div>
)

const RegionSheet = ({ selected, onSelect, onClose }: { selected: string; onSelect: (r: string) => void; onClose: () => void }) => {
  const [q, setQ] = useState('')
  const filtered = REGIONS.filter(r => r.name.includes(q) || r.desc.includes(q))
  return (
    <Sheet onClose={onClose} maxH="88%">
      <div style={{ padding: '0 20px 12px' }}>
        <div style={S.text(20, 800, L.text)}>어디로 떠날까요?</div>
        <div style={{ ...S.text(13, 400, L.textMuted), marginTop: 4 }}>전남 22개 지역 중 선택</div>
      </div>
      <div style={{ padding: '0 20px 16px', position: 'sticky', top: 0, background: L.surface, zIndex: 1 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}><Ic n="search" sz={16} c={L.textMuted} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="지역 검색…" autoFocus
            style={{ width: '100%', padding: '12px 14px 12px 42px', border: `1.5px solid ${L.border}`, borderRadius: L.rFull, fontSize: 14, color: L.text, background: L.bg, outline: 'none', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", boxSizing: 'border-box' }} />
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        {filtered.map((r, i) => {
          const on = selected === r.name
          return (
            <div key={r.name}>
              {i > 0 && <div style={{ height: 1, background: L.borderLight }} />}
              <button onClick={() => { onSelect(r.name); onClose() }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: on ? L.dark : L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={S.text(15, on ? 700 : 500, L.text)}>{r.name}</div>
                  <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 1 }}>{r.desc}</div>
                </div>
                {on && <Ic n="check" sz={18} c={L.dark} />}
              </button>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// ── Plan Wizard ───────────────────────────────────────────────────────────────
const WALK_LEVELS = [
  { id: '적게 걷기', label: '적게 걷기', desc: '총 도보 30~60분 내외', emoji: '🛋️' },
  { id: '보통', label: '보통', desc: '총 도보 60~90분 내외', emoji: '🚶' },
  { id: '많이 걷기', label: '많이 걷기', desc: '도보 중심 · 체력 필요', emoji: '🥾' },
]
const COMPANIONS = [
  { id: '혼자', emoji: '🧍' }, { id: '친구와', emoji: '👫' }, { id: '연인과', emoji: '💑' },
  { id: '가족과', emoji: '👨‍👩‍👧' }, { id: '부모님과', emoji: '👴👵' }, { id: '아이와', emoji: '👶' },
]
const PACE_OPTIONS = [
  { id: '여유롭게', desc: '장소 수 적고 체류시간 ↑', emoji: '🌿' },
  { id: '적당히', desc: '균형 잡힌 동선', emoji: '⚖️' },
  { id: '알차게', desc: '더 많은 장소, 이동 효율 ↑', emoji: '⚡' },
]
const PURPOSES = ['자연·풍경', '맛집', '카페', '역사·문화', '시장·골목', '휴식']
const MEALS = ['아침', '점심', '저녁']
const TRANSIT_MODES = [
  { id: 'bus', label: '시내버스', desc: '시내 이동의 기본' },
  { id: 'express', label: '시외·고속버스', desc: '도시 사이 이동' },
  { id: 'train', label: '기차', desc: 'KTX·무궁화호' },
  { id: 'walk', label: '도보 위주', desc: '가까운 곳은 걸어갈게요' },
]
const TOTAL_STEPS = 5

function DepartureSearch({ value, address, onChange, onPick, placeholder = '가게, 명소, 주소 — 전국 검색', autoFocus = true }: {
  value: string
  address?: string
  onChange: (name: string) => void
  onPick: (place: PlaceSuggestion) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PlaceSuggestion[]>([])
  const seq = useRef(0)

  useEffect(() => {
    const q = value.trim()
    if (q.length < 1) {
      setResults([])
      setLoading(false)
      return
    }
    const id = ++seq.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      api.searchPlaces(q)
        .then((payload) => { if (seq.current === id) setResults(payload.places) })
        .catch(() => { if (seq.current === id) setResults([]) })
        .finally(() => { if (seq.current === id) setLoading(false) })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [value])

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <span style={{ position: 'absolute', left: 16, top: 18, pointerEvents: 'none', display: 'flex', zIndex: 1 }}><Ic n="search" sz={18} c={value ? L.dark : L.textMuted} /></span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoFocus={autoFocus} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        style={{ width: '100%', padding: '16px 16px 16px 48px', border: `2px solid ${value ? L.dark : L.border}`, borderRadius: L.rLg, fontSize: 15, color: L.text, background: L.bgSoft, outline: 'none', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", boxSizing: 'border-box', transition: 'all 0.18s' }} />
      {address ? <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 8, paddingLeft: 4 }}>{address}</div> : null}
      {open && value.trim() ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 62, background: L.surface, borderRadius: L.rLg, boxShadow: L.shadowLg, border: `1px solid ${L.borderLight}`, zIndex: 20, overflow: 'hidden' }}>
          {loading && !results.length ? <div style={{ padding: '16px 18px', ...S.text(13, 400, L.textMuted) }}>전국에서 장소를 찾고 있어요…</div> : null}
          {!loading && !results.length ? <div style={{ padding: '16px 18px', ...S.text(13, 400, L.textMuted) }}>검색 결과가 없어요. 가게 이름이나 주소를 조금 더 적어보세요.</div> : null}
          {results.map(place => (
            <button key={place.id} onMouseDown={e => e.preventDefault()} onClick={() => { onPick(place); setOpen(false) }}
              style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${L.borderLight}`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...S.text(14, 700, L.text), flex: 1 }}>{place.name}</div>
                {place.category ? <span style={{ fontSize: 11, fontWeight: 700, color: L.teal, background: L.tealLight, borderRadius: 6, padding: '2px 7px' }}>{place.category}</span> : null}
              </div>
              <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 3 }}>{place.address}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PlanWizard({ onClose, onComplete, initial }: { onClose: () => void; onComplete: (c: Condition) => void; initial?: Partial<Condition> }) {
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [cond, setCond] = useState<Condition>({ ...DEFAULT_CONDITION, ...initial })
  const [regionOpen, setRegionOpen] = useState(false)

  const upd = <K extends keyof Condition>(k: K, v: Condition[K]) => setCond(p => ({ ...p, [k]: v }))
  const toggleArr = (k: 'interests' | 'purpose' | 'atmosphere' | 'meals' | 'transitModes', v: string) =>
    upd(k, (cond[k] as string[]).includes(v) ? (cond[k] as string[]).filter(x => x !== v) : [...(cond[k] as string[]), v])

  const go = (d: 'next' | 'prev') => { setDir(d); setStep(s => d === 'next' ? s + 1 : s - 1) }
  const validRange = new Date(`${cond.endDate}T${cond.endTime}:00`).getTime() > new Date(`${cond.date}T${cond.startTime}:00`).getTime()
  const overnight = Boolean(cond.date && cond.endDate && cond.date !== cond.endDate)
  const tripHours = Math.max(0.5, (new Date(`${cond.endDate}T${cond.endTime}:00`).getTime() - new Date(`${cond.date}T${cond.startTime}:00`).getTime()) / 36e5)
  const canNext = step === 1 ? !!cond.departure : step === 2 ? !!cond.region && validRange && tripHours <= 72 : step === 5 ? cond.transitModes.length > 0 : true
  const setStartDate = (value: string) => setCond(p => ({ ...p, date: value, endDate: p.endDate < value ? value : p.endDate }))
  const setEndDate = (value: string) => setCond(p => ({ ...p, endDate: p.date && value < p.date ? p.date : value }))

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '9px 16px', borderRadius: L.rFull,
    border: `1.5px solid ${on ? L.dark : L.border}`,
    background: on ? L.dark : L.surface, color: on ? '#fff' : L.text,
    fontSize: 13, fontWeight: on ? 700 : 400, cursor: 'pointer',
    fontFamily: "'Pretendard Variable', Pretendard, sans-serif",
    transition: 'all 0.14s',
  })
  const secLabel = (t: string) => <div style={{ ...S.text(11, 700, L.textMuted), marginBottom: 10, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>{t}</div>

  const content = () => {
    const cls = dir === 'next' ? 'anim-step-next' : 'anim-step-prev'
    if (step === 1) return (
      <div key="1" className={cls} style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: L.text, lineHeight: 1.15, marginBottom: 6, letterSpacing: '-0.03em', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>어디서<br />출발하세요?</div>
        <div style={{ ...S.text(14, 400, L.textMuted), marginBottom: 24 }}>전국 어디서든 가게, 명소, 주소를 검색해 고르세요</div>
        <DepartureSearch
          value={cond.departure}
          address={cond.departureAddress}
          onChange={(name) => setCond(p => ({ ...p, departure: name, departureAddress: undefined, departureLat: undefined, departureLng: undefined }))}
          onPick={(place) => setCond(p => ({ ...p, departure: place.name, departureAddress: place.address, departureLat: place.latitude, departureLng: place.longitude }))}
        />
        {secLabel('자주 이용하는 역')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {QUICK_DEPARTURES.map(d => (
            <button key={d} onClick={() => setCond(p => ({ ...p, departure: d, departureAddress: undefined, departureLat: undefined, departureLng: undefined }))} style={{ ...chip(cond.departure === d), display: 'flex', alignItems: 'center', gap: 5 }}>
              🚉 {d}
            </button>
          ))}
        </div>
      </div>
    )
    if (step === 2) return (
      <div key="2" className={cls} style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: L.text, lineHeight: 1.15, marginBottom: 6, letterSpacing: '-0.03em', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>어디로<br />떠날까요?</div>
        <div style={{ ...S.text(14, 400, L.textMuted), marginBottom: 20 }}>전남 22개 지역 중 목적지 선택</div>
        <button onClick={() => setRegionOpen(true)} style={{ width: '100%', padding: '18px', borderRadius: L.rLg, border: `2px solid ${cond.region ? L.dark : L.border}`, background: cond.region ? L.dark : L.bgSoft, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.18s', marginBottom: 24 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: cond.region ? 'rgba(255,255,255,0.18)' : L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic n="location" sz={20} c={cond.region ? '#fff' : L.textMuted} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            {cond.region
              ? <><div style={S.text(17, 700, '#fff')}>{cond.region}</div><div style={{ ...S.text(12, 400, 'rgba(255,255,255,0.7)'), marginTop: 2 }}>{REGIONS.find(r => r.name === cond.region)?.desc}</div></>
              : <div style={S.text(15, 400, L.textMuted)}>지역을 선택하세요…</div>}
          </div>
          <Ic n="chevR" sz={18} c={cond.region ? 'rgba(255,255,255,0.7)' : L.textMuted} />
        </button>
        {secLabel('여행 기간')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <label style={{ display: 'block' }}>
            <div style={{ ...S.text(11, 600, L.textMuted), marginBottom: 6 }}>시작일</div>
            <input type="date" value={cond.date} min={localISODate()} onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: L.rMd, border: `1.5px solid ${L.border}`, background: L.bgSoft, fontSize: 14, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ ...S.text(11, 600, L.textMuted), marginBottom: 6 }}>종료일</div>
            <input type="date" value={cond.endDate} min={cond.date} onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: L.rMd, border: `1.5px solid ${L.border}`, background: L.bgSoft, fontSize: 14, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </label>
        </div>
        {secLabel('여행 시간')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <label style={{ display: 'block' }}>
            <div style={{ ...S.text(11, 600, L.textMuted), marginBottom: 6 }}>시작</div>
            <input type="time" value={cond.startTime} onChange={e => upd('startTime', e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: L.rMd, border: `1.5px solid ${L.border}`, background: L.bgSoft, fontSize: 14, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ ...S.text(11, 600, L.textMuted), marginBottom: 6 }}>종료</div>
            <input type="time" value={cond.endTime} onChange={e => upd('endTime', e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: L.rMd, border: `1.5px solid ${L.border}`, background: L.bgSoft, fontSize: 14, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", outline: 'none', boxSizing: 'border-box' }} />
          </label>
        </div>
        <div style={{ ...S.text(12, 500, validRange && tripHours <= 72 ? L.teal : L.error), marginBottom: 20 }}>
          {!validRange
            ? '종료 시각은 시작보다 뒤여야 해요'
            : tripHours > 72
              ? '한 번에 최대 3일(72시간)까지 추천할 수 있어요'
              : `${cond.date === cond.endDate ? '당일' : `${cond.date.slice(5)} – ${cond.endDate.slice(5)}`} · 약 ${tripHours % 1 === 0 ? tripHours : tripHours.toFixed(1)}시간${overnight ? ' · 하룻밤 일정(밤 10시–아침 8시는 숙소)' : ''}`}
        </div>
        {secLabel('숙소 (선택)')}
        <div style={{ ...S.text(12, 400, L.textMuted), marginBottom: 10, lineHeight: 1.55 }}>
          {overnight
            ? '밤을 보내는 숙소를 넣으면 그 주변을 중심으로 동선을 짜요. 건너뛰어도 됩니다.'
            : '숙소가 있으면 알려주세요. 가까운 장소를 우선 추천합니다.'}
        </div>
        <DepartureSearch
          value={cond.lodging || ''}
          address={cond.lodgingAddress}
          placeholder="숙소 이름이나 주소"
          autoFocus={false}
          onChange={(name) => setCond(p => ({ ...p, lodging: name, lodgingAddress: undefined, lodgingLat: undefined, lodgingLng: undefined }))}
          onPick={(place) => setCond(p => ({ ...p, lodging: place.name, lodgingAddress: place.address, lodgingLat: place.latitude, lodgingLng: place.longitude }))}
        />
      </div>
    )
    if (step === 3) return (
      <div key="3" className={cls} style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: L.text, lineHeight: 1.15, marginBottom: 6, letterSpacing: '-0.03em', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>어떻게<br />여행할까요?</div>
        <div style={{ ...S.text(14, 400, L.textMuted), marginBottom: 22 }}>걷기 부담, 여행 속도, 동행자 선택</div>
        {secLabel('걷기 부담')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {WALK_LEVELS.map(w => (
            <button key={w.id} onClick={() => upd('walkLevel', w.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: L.rLg, border: `2px solid ${cond.walkLevel === w.id ? L.dark : L.border}`, background: cond.walkLevel === w.id ? L.dark : L.surface, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}>
              <span style={{ fontSize: 22 }}>{w.emoji}</span>
              <div>
                <div style={S.text(15, cond.walkLevel === w.id ? 700 : 500, cond.walkLevel === w.id ? '#fff' : L.text)}>{w.label}</div>
                <div style={S.text(12, 400, cond.walkLevel === w.id ? 'rgba(255,255,255,0.7)' : L.textMuted)}>{w.desc}</div>
              </div>
              {cond.walkLevel === w.id && <div style={{ marginLeft: 'auto' }}><Ic n="check" sz={18} c="#fff" /></div>}
            </button>
          ))}
        </div>
        {secLabel('여행 속도')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {PACE_OPTIONS.map(p => (
            <button key={p.id} onClick={() => upd('pace', p.id)} style={{ flex: 1, padding: '12px 8px', borderRadius: L.rMd, border: `2px solid ${cond.pace === p.id ? L.dark : L.border}`, background: cond.pace === p.id ? L.dark : L.surface, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{p.emoji}</div>
              <div style={S.text(13, cond.pace === p.id ? 700 : 500, cond.pace === p.id ? '#fff' : L.text)}>{p.id}</div>
              <div style={{ ...S.text(10, 400, cond.pace === p.id ? 'rgba(255,255,255,0.65)' : L.textMuted), marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
            </button>
          ))}
        </div>
        {secLabel('함께')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COMPANIONS.map(c => (
            <button key={c.id} onClick={() => upd('companion', c.id)} style={{ ...chip(cond.companion === c.id), display: 'flex', alignItems: 'center', gap: 5 }}>
              {c.emoji} {c.id}
            </button>
          ))}
        </div>
      </div>
    )
    if (step === 4) return (
      <div key="4" className={cls} style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: L.text, lineHeight: 1.15, marginBottom: 6, letterSpacing: '-0.03em', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>어떤 여행을<br />원하세요?</div>
        <div style={{ ...S.text(14, 400, L.textMuted), marginBottom: 22 }}>목적과 식사만 고르면 됩니다</div>
        {secLabel('여행 목적')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
          {PURPOSES.map(p => <button key={p} onClick={() => toggleArr('purpose', p)} style={chip(cond.purpose.includes(p))}>{p}</button>)}
        </div>
        {secLabel('식사')}
        <div style={{ ...S.text(12, 400, L.textMuted), marginBottom: 10 }}>일정에 넣을 끼니를 고르세요. 선택하지 않으면 식사는 빼요.</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MEALS.map(m => <button key={m} onClick={() => toggleArr('meals', m)} style={chip(cond.meals.includes(m))}>{m}</button>)}
        </div>
      </div>
    )
    if (step === 5) return (
      <div key="5" className={cls} style={{ padding: '0 24px' }}>
        <div style={{ fontSize: 30, fontWeight: 900, color: L.text, lineHeight: 1.15, marginBottom: 6, letterSpacing: '-0.03em', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>어떤 교통을<br />이용할까요?</div>
        <div style={{ ...S.text(14, 400, L.textMuted), marginBottom: 22 }}>주로 타고 싶은 수단을 고르세요. 여러 개 선택할 수 있어요.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TRANSIT_MODES.map(mode => {
            const on = cond.transitModes.includes(mode.id)
            return (
              <button key={mode.id} onClick={() => toggleArr('transitModes', mode.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: L.rLg, border: `2px solid ${on ? L.dark : L.border}`, background: on ? L.dark : L.surface, cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <div style={S.text(15, on ? 700 : 500, on ? '#fff' : L.text)}>{mode.label}</div>
                  <div style={S.text(12, 400, on ? 'rgba(255,255,255,0.7)' : L.textMuted)}>{mode.desc}</div>
                </div>
                {on && <div style={{ marginLeft: 'auto' }}><Ic n="check" sz={18} c="#fff" /></div>}
              </button>
            )
          })}
        </div>
      </div>
    )
    return null
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: L.bgSoft, zIndex: 150, display: 'flex', flexDirection: 'column' }} className="anim-sheet">
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={step > 1 ? () => go('prev') : onClose} style={{ width: 44, height: 44, borderRadius: L.rFull, background: L.bg, border: `1px solid ${L.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ic n={step > 1 ? 'back' : 'close'} sz={18} c={L.text} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? L.dark : L.border, transition: 'background 0.3s' }} />
            ))}
          </div>
          <div style={{ ...S.text(12, 500, L.textMuted), marginTop: 6 }}>단계 {step} / {TOTAL_STEPS}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 28, paddingBottom: 24 }} className="hide-scroll">
        {content()}
      </div>
      <div style={{ padding: '12px 24px 40px', flexShrink: 0, borderTop: `1px solid ${L.borderLight}` }}>
        {step < TOTAL_STEPS
          ? <Btn onClick={() => canNext && go('next')} disabled={!canNext}>다음 →</Btn>
          : <Btn onClick={() => onComplete({
              ...cond,
              duration: Math.min(72, Math.max(1, Math.round(tripHours * 10) / 10)),
              meal: cond.meals.length ? cond.meals.join('+') : '식사 제외',
            })}>이 조건으로 추천받기</Btn>}
      </div>
      {regionOpen && <RegionSheet selected={cond.region} onSelect={r => upd('region', r)} onClose={() => setRegionOpen(false)} />}
    </div>
  )
}

// ── Screens ───────────────────────────────────────────────────────────────────

// ── 뚜벅 로고 시리즈 ─────────────────────────────────────────────────────────
// All four capture the 뚜벅뚜벅 walking motion — legs, stride, rhythm.

// W1: 정면 두 다리 — front-on view, both legs visible in wide stride.
// The viewer is low, looking up at the legs. One leg forward (heel down),
// one leg back (toe lifting). Negative space between legs is the path.
// Forest green #166534.
function LogoW1({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="16" fill="#166534" />
      {/* pelvis/hip connector — thin bridge at top center */}
      <rect x="22" y="11" width="20" height="7" rx="3.5" fill="white" />
      {/* LEFT leg — forward, foot flat on ground */}
      {/* thigh */}
      <path d="M22 15 C20 24 18 32 17 42 L25 44 C25 34 26 26 29 17 Z" fill="white" />
      {/* shin — slight forward lean */}
      <path d="M17 42 C16 48 16 52 17 54 L25 54 L25 44 Z" fill="white" />
      {/* foot — flat, weight bearing */}
      <rect x="12" y="53" width="16" height="5" rx="2.5" fill="white" />
      {/* RIGHT leg — back, heel lifting */}
      {/* thigh */}
      <path d="M42 15 C44 24 46 32 47 40 L39 42 C38 32 37 24 35 17 Z" fill="white" />
      {/* shin — angled, knee bent */}
      <path d="M47 40 C49 46 50 50 48 54 L40 52 L39 42 Z" fill="white" />
      {/* foot — heel raised, toe pointing down */}
      <path d="M36 52 C38 52 42 52 46 54 C47 55.5 46 57 44 57 L36 57 C34 57 34 55 35 53 Z" fill="white" />
      {/* ground line */}
      <rect x="10" y="57" width="44" height="2" rx="1" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

// W2: 보폭 — bold side-profile stride. The decisive snapshot of mid-step:
// one foot breaking forward, one heel pushing off behind.
// Thick, chunky limbs — more mascot than pictogram.
// Lime green #16A34A.
function LogoW2({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="16" fill="#15803D" />
      {/* head */}
      <circle cx="22" cy="12" r="7" fill="white" />
      {/* torso — slight forward lean */}
      <path d="M20 19 L22 35 L28 35 L26 19 Z" fill="white" />
      {/* FRONT arm — swings back */}
      <path d="M26 22 C32 24 36 26 38 28" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      {/* BACK arm — swings forward */}
      <path d="M20 22 C14 24 10 28 9 31" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      {/* FRONT leg — stepping forward, heel lands */}
      {/* thigh */}
      <path d="M25 35 C28 42 34 46 38 50 L34 54 C30 50 24 44 21 38 Z" fill="white" />
      {/* foot — heel striking ground */}
      <path d="M34 54 C38 52 44 52 46 53 C48 54 47 57 45 57 L32 57 C30 57 30 55 32 54 Z" fill="white" />
      {/* BACK leg — pushing off, knee bent up */}
      {/* thigh angled back */}
      <path d="M22 35 C18 40 16 45 18 50 L24 48 C22 44 22 40 26 36 Z" fill="white" />
      {/* shin — knee bent, foot lifting */}
      <path d="M18 50 C16 54 18 57 20 56 L26 52 L24 48 Z" fill="white" />
      {/* raised foot */}
      <path d="M18 56 C20 57 24 57 26 56 C28 55 27 53 25 53 L19 53 C17 53 17 55 18 56 Z" fill="white" />
    </svg>
  )
}

// W3: 뚜벅 리듬 — five alternating footprint ovals in a walking diagonal.
// Left–Right–Left–Right–Left. The rhythm IS the logotype.
// Each print is simple: rounded heel, wider ball, slight taper to toe.
// The spacing encodes the 뚜벅뚜벅 beat. Olive #4D7C0F.
function LogoW3({ size = 64 }: { size?: number }) {
  // (cx, cy, rotation) — L prints tilt left, R prints tilt right
  const prints: [number, number, number, 'L'|'R'][] = [
    [19, 51, -12, 'L'],
    [34, 44,  12, 'R'],
    [21, 35, -12, 'L'],
    [36, 26,  12, 'R'],
    [22, 17, -12, 'L'],
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="16" fill="#3F6212" />
      {prints.map(([cx, cy, rot, side], i) => {
        const op = i === 2 ? 1 : i === 0 || i === 4 ? 0.85 : 0.65
        return (
          <g key={i} transform={`translate(${cx},${cy}) rotate(${rot})`} fillOpacity={op}>
            {/* heel */}
            <ellipse cx="0" cy="5" rx="4.5" ry="3.5" fill="white" />
            {/* mid arch — narrower */}
            <rect x="-3" y="-1" width="6" height="5" fill="white" />
            {/* ball + toe */}
            <ellipse cx="0" cy="-5" rx="5.5" ry="4" fill="white" />
            {/* toe nubs — 3 dots */}
            <circle cx={side === 'L' ? -3.5 : 3.5} cy="-9.5" r="1.4" fill="white" />
            <circle cx="0" cy="-10.5" r="1.6" fill="white" />
            <circle cx={side === 'L' ? 3.5 : -3.5} cy="-9.5" r="1.4" fill="white" />
          </g>
        )
      })}
      {/* directional arrow hint at top */}
      <path d="M44 10 L50 16 L46 16 L46 22 L42 22 L42 16 L38 16 Z" fill="white" fillOpacity="0.35" />
    </svg>
  )
}

// W4: 한 박자 — "one beat". Two legs shown as pure geometry: two bold rectangles
// tilted in stride, no body above. The gap between them is the path underfoot.
// Ghost (outline) leg behind, solid leg in front — motion blur effect.
// Deep emerald #065F46 with bright accent.
function LogoW4({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="16" fill="#064E3B" />
      {/* GHOST leg — back leg, outline only, suggests motion trace */}
      <path d="M24 10 C20 22 17 34 18 48 C20 50 26 50 28 48 C26 34 28 22 32 10 Z"
        stroke="white" strokeWidth="2" strokeOpacity="0.4" fill="none" strokeLinejoin="round" />
      {/* ghost foot */}
      <path d="M18 48 C16 52 16 56 18 57 L26 57 C28 57 28 53 26 50 Z"
        stroke="white" strokeWidth="2" strokeOpacity="0.4" fill="none" />
      {/* SOLID leg — front leg, full weight */}
      <path d="M32 10 C36 22 40 34 40 48 L48 48 C47 34 44 22 40 10 Z" fill="white" />
      {/* solid foot — heel striking */}
      <path d="M40 48 C40 52 40 56 42 57 L52 57 C54 57 54 54 52 52 C48 50 44 49 40 48 Z"
        fill="white" />
      {/* bright accent stripe on solid leg — speed line */}
      <path d="M34 14 C37 24 40 36 41 46" stroke="#4ADE80" strokeWidth="2.5"
        strokeLinecap="round" strokeOpacity="0.7" fill="none" />
      {/* ground */}
      <rect x="10" y="57" width="44" height="2.5" rx="1.25" fill="white" fillOpacity="0.2" />
    </svg>
  )
}

type LogoId = 'W1' | 'W2' | 'W3' | 'W4'
function LogoByid({ id, size }: { id: LogoId; size: number }) {
  if (id === 'W1') return <LogoW1 size={size} />
  if (id === 'W2') return <LogoW2 size={size} />
  if (id === 'W3') return <LogoW3 size={size} />
  return <LogoW4 size={size} />
}

function LogoShowcase({ onClose }: { onClose: () => void }) {
  const logos: { id: LogoId; name: string; desc: string; tone: string; palette: string }[] = [
    { id: 'W1', name: '정면 두 다리', desc: '정면 로우앵글 — 두 다리가 활짝 벌어진 보폭. 왼발은 착지, 오른발은 들려있습니다. 아이콘으로 전에 없던 시점.', tone: '강렬·독창적', palette: '#166534' },
    { id: 'W2', name: '보폭', desc: '옆면 전신 실루엣. 팔 반동, 무릎 굽힘, 발의 착지·이탈이 모두 담긴 한 순간. 두꺼운 선으로 뚜벅이 특유의 묵직함.', tone: '활동적·친근함', palette: '#15803D' },
    { id: 'W3', name: '뚜벅 리듬', desc: '왼발-오른발-왼발-오른발-왼발. 5개 발자국이 대각선으로 이어져 뚜벅뚜벅 소리 자체를 시각화합니다.', tone: '리드미컬·경쾌', palette: '#3F6212' },
    { id: 'W4', name: '한 박자', desc: '앞다리 솔리드 + 뒷다리 고스트 처리. 모션블러 한 컷. 라임 그린 속도선이 전진감을 더합니다.', tone: '모던·역동적', palette: '#064E3B' },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#080F0A', overflowY: 'auto' }} className="hide-scroll">
      <div style={{ padding: '52px 20px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4ADE80', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '0.14em', marginBottom: 8 }}>뚜벅 시리즈 · 3차 추천</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: 4 }}>다리가 뚜벅뚜벅</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>걷는 동작을 직접 담은 로고</div>
      </div>

      <div style={{ padding: '8px 16px 120px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {logos.map(({ id, name, desc, tone, palette }) => (
          <div key={id} style={{ borderRadius: L.rXl, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
            {/* preview */}
            <div style={{ background: '#0D1710', padding: '28px 0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              {/* sizes: 96 / 52 / 32 aligned to bottom */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <LogoByid id={id} size={96} />
                <LogoByid id={id} size={52} />
                <LogoByid id={id} size={32} />
              </div>
              {/* wordmark pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.07)', borderRadius: L.rFull, padding: '9px 20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <LogoByid id={id} size={26} />
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>와보랑께</span>
              </div>
            </div>
            {/* text info */}
            <div style={{ padding: '14px 18px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: palette, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{name}</div>
                <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#86EFAC', background: 'rgba(134,239,172,0.1)', borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{tone}</div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.82, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onClose} style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#16A34A', color: '#fff', border: 'none', borderRadius: L.rFull, padding: '14px 36px', fontSize: 15, fontWeight: 700, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", cursor: 'pointer', boxShadow: '0 4px 28px rgba(22,163,74,0.45)', whiteSpace: 'nowrap' }}>닫기</button>
    </div>
  )
}

function Splash({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 7500); return () => clearTimeout(t) }, [onDone])

  // Simplified artistic 전남 province outline (clockwise from top-left)
  const mapPath = "M 52 148 C 70 128 100 118 138 112 C 165 108 195 112 218 122 L 248 145 L 258 175 L 272 202 L 256 222 L 238 218 L 220 230 L 194 235 L 165 238 L 136 232 L 108 226 L 80 210 C 62 196 46 172 48 152 Z"

  // Footprint trail from bottom-left → map center (6 steps)
  const steps = [
    { x: 28,  y: 420, a: -22, r: false, d: 1.0 },
    { x: 52,  y: 392, a: -22, r: true,  d: 1.22 },
    { x: 74,  y: 362, a: -22, r: false, d: 1.44 },
    { x: 98,  y: 332, a: -22, r: true,  d: 1.66 },
    { x: 118, y: 300, a: -22, r: false, d: 1.88 },
    { x: 140, y: 270, a: -22, r: true,  d: 2.10 },
  ]

  // map bbox: x 46–272, y 108–238  (w≈226, h≈130)
  // positions below are inside those bounds, geographically sensible
  const landmarks: { x: number; y: number; d: number; label: string; node: React.ReactNode }[] = [
    // 담양 — north-center
    { x: 148, y: 130, d: 2.5, label: '담양', node: (
      <g>
        {/* 3 bamboo stalks, all content -16 to +5 so bubble (r14) contains them */}
        <rect x="-9" y="-14" width="3.5" height="16" rx="1.75" fill="#4ADE80" />
        <rect x="-9" y="-9"  width="3.5" height="1.5" rx="0.75" fill="#16A34A" />
        <rect x="-9" y="-3"  width="3.5" height="1.5" rx="0.75" fill="#16A34A" />
        <rect x="-2" y="-16" width="3.5" height="18" rx="1.75" fill="#4ADE80" />
        <rect x="-2" y="-11" width="3.5" height="1.5" rx="0.75" fill="#16A34A" />
        <rect x="-2" y="-5"  width="3.5" height="1.5" rx="0.75" fill="#16A34A" />
        <rect x="5"  y="-13" width="3.5" height="15" rx="1.75" fill="#4ADE80" />
        <rect x="5"  y="-8"  width="3.5" height="1.5" rx="0.75" fill="#16A34A" />
        <path d="M-9,-14 C-12,-18 -17,-17 -15,-14" stroke="#4ADE80" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="-2,-16 C-5,-20 -10,-19 -8,-16" stroke="#4ADE80" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M5,-13 C2,-17 -3,-16 -1,-13" stroke="#4ADE80" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <text x="0" y="20" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#166534" fontFamily="'Pretendard Variable',Pretendard,sans-serif">담양</text>
      </g>
    )},
    // 보성 — south-center (녹차밭)
    { x: 170, y: 210, d: 2.75, label: '보성', node: (
      <g>
        <path d="M-13,4 C-9,-5 -4,-11 0,-12 C4,-11 9,-5 13,4 Z" fill="#22C55E" />
        <path d="M-10,0 C-6,-7 -3,-10 0,-11 C3,-10 6,-7 10,0" stroke="#15803D" strokeWidth="1" fill="none" />
        <path d="M-7,-4 C-4,-8 -2,-10 0,-10 C2,-10 4,-8 7,-4" stroke="#15803D" strokeWidth="1" fill="none" />
        <rect x="-13" y="4" width="26" height="3" rx="1.5" fill="#166534" />
        <text x="0" y="20" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#166534" fontFamily="'Pretendard Variable',Pretendard,sans-serif">보성</text>
      </g>
    )},
    // 여수 — southeast peninsula
    { x: 244, y: 208, d: 3.0, label: '여수', node: (
      <g>
        {/* arch bridge */}
        <path d="M-13,3 C-9,-7 9,-7 13,3" stroke="#166534" strokeWidth="2" fill="none" strokeLinecap="round" />
        <line x1="-13" y1="3" x2="13" y2="3" stroke="#166534" strokeWidth="2" strokeLinecap="round" />
        <line x1="-5" y1="3" x2="-4" y2="-2" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="0"  y1="3" x2="0"  y2="-5" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="5"  y1="3" x2="4"  y2="-2" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="-13" cy="5" r="1.8" fill="#166534" />
        <circle cx="13"  cy="5" r="1.8" fill="#166534" />
        <text x="0" y="20" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#166534" fontFamily="'Pretendard Variable',Pretendard,sans-serif">여수</text>
      </g>
    )},
    // 목포 — west coast
    { x: 66, y: 192, d: 3.25, label: '목포', node: (
      <g>
        {/* lighthouse */}
        <rect x="-5" y="-13" width="10" height="15" rx="2.5" fill="#fff" />
        <rect x="-5" y="-13" width="10" height="4"  rx="1.5" fill="#EF4444" />
        <rect x="-3" y="-4"  width="6"  height="2"  fill="#ccc" />
        <rect x="-3" y="0"   width="6"  height="2"  fill="#ccc" />
        <rect x="-6" y="-15" width="12" height="3"  rx="1" fill="#fff" />
        <circle cx="0" cy="-17" r="3.5" fill="#FCD34D" />
        <line x1="0"  y1="-21" x2="0"  y2="-24" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="3"  y1="-20" x2="5"  y2="-23" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="-3" y1="-20" x2="-5" y2="-23" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
        <text x="0" y="20" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#166534" fontFamily="'Pretendard Variable',Pretendard,sans-serif">목포</text>
      </g>
    )},
    // 순천만 — east-center (heron + reeds)
    { x: 218, y: 168, d: 3.5, label: '순천만', node: (
      <g>
        {/* reeds */}
        <line x1="-9" y1="4" x2="-9" y2="-10" stroke="#86EFAC" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="-9" cy="-12" rx="2" ry="4" fill="#4ADE80" />
        <line x1="-3" y1="4" x2="-3" y2="-7" stroke="#86EFAC" strokeWidth="1.4" strokeLinecap="round" />
        <ellipse cx="-3" cy="-9" rx="1.6" ry="3" fill="#4ADE80" />
        {/* heron body */}
        <path d="M3,-12 C7,-14 11,-11 9,-8 C8,-6 6,-7 5,-5 L2,0 L5,4" stroke="#166534" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="-10" r="2.2" fill="#166534" />
        <path d="M11,-10 L16,-9" stroke="#166534" strokeWidth="1.4" strokeLinecap="round" />
        <text x="2" y="20" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#166534" fontFamily="'Pretendard Variable',Pretendard,sans-serif">순천만</text>
      </g>
    )},
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(155deg, #FFFFFF 0%, #F0FDF4 48%, #FFFFFF 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <style>{`
        @keyframes sp-drawMap {
          from { stroke-dashoffset: 1400; opacity: 0.3; }
          to   { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes sp-fillMap {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sp-footstep {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          70%  { opacity: 0.75; }
          100% { opacity: 0.4; }
        }
        @keyframes sp-pop {
          0%   { opacity: 0; transform: translateY(14px); }
          55%  { opacity: 1; transform: translateY(-4px); }
          75%  { transform: translateY(2px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes sp-title {
          0%   { opacity: 0; transform: translateY(22px) scale(0.85); }
          65%  { opacity: 1; transform: translateY(-5px) scale(1.04); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sp-sub {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sp-btn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sp-glow {
          0%, 100% { opacity: 0.18; }
          50%       { opacity: 0.32; }
        }
      `}</style>

      {/* Background ambient glow behind map */}
      <div style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translate(-50%,-50%)', width: 300, height: 220, borderRadius: '50%', background: 'radial-gradient(ellipse, #86EFAC 0%, transparent 70%)', animation: 'sp-glow 3s ease-in-out 0.5s infinite' }} />

      {/* SVG: map + footprints + landmarks */}
      <svg viewBox="0 0 320 560" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>

        {/* Islands near south coast */}
        <ellipse cx="178" cy="258" rx="12" ry="7" fill="#BBF7D0" fillOpacity="0" style={{ animation: 'sp-fillMap 0.5s ease 1.6s forwards' }} />
        <ellipse cx="178" cy="258" rx="12" ry="7" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeOpacity="0" style={{ animation: 'sp-fillMap 0.4s ease 0.9s forwards' }} />
        <ellipse cx="118" cy="248" rx="9" ry="5" fill="#BBF7D0" fillOpacity="0" style={{ animation: 'sp-fillMap 0.5s ease 1.7s forwards' }} />
        <ellipse cx="118" cy="248" rx="9" ry="5" fill="none" stroke="#16A34A" strokeWidth="1.5" strokeOpacity="0" style={{ animation: 'sp-fillMap 0.4s ease 1.0s forwards' }} />

        {/* Map fill */}
        <path d={mapPath} fill="#BBF7D0" fillOpacity="0"
          style={{ animation: 'sp-fillMap 0.9s ease 1.3s forwards' }} />

        {/* Map outline drawing itself */}
        <path d={mapPath} fill="none" stroke="#16A34A" strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="1400" strokeDashoffset="1400"
          style={{ animation: 'sp-drawMap 1.3s cubic-bezier(0.4,0,0.2,1) 0.3s forwards' }} />

        {/* Footprints trail */}
        {steps.map((s, i) => (
          <g key={i} transform={`translate(${s.x},${s.y}) rotate(${s.a})`}
            style={{ opacity: 0, animation: `sp-footstep 1.1s ease ${s.d}s forwards` }}>
            <ellipse cx={s.r ? 5 : -5} cy="5"  rx="4"   ry="3.2" fill="#16A34A" />
            <ellipse cx={s.r ? 5 : -5} cy="-3" rx="5.2" ry="3.8" fill="#16A34A" />
            <circle  cx={(s.r ? 5 : -5) - 2.5} cy="-7.5" r="1.6" fill="#16A34A" />
            <circle  cx={ s.r ? 5 : -5}         cy="-8.8" r="1.8" fill="#16A34A" />
            <circle  cx={(s.r ? 5 : -5) + 2.5} cy="-7.5" r="1.6" fill="#16A34A" />
          </g>
        ))}

        {/* Landmark illustrations
            Outer <g>: SVG-only transform for positioning (CSS must NOT touch this)
            Inner <g>: CSS-only animation (translateY + opacity, no SVG transform) */}
        {landmarks.map((lm, i) => (
          <g key={i} transform={`translate(${lm.x},${lm.y})`}>
            <g style={{ opacity: 0, animation: `sp-pop 0.6s ease-out ${lm.d}s both` }}>
              <circle cx="0" cy="0" r="16" fill="#FFFFFF" />
              <circle cx="0" cy="0" r="16" fill="none" stroke="#86EFAC" strokeWidth="1.4" />
              {lm.node}
            </g>
          </g>
        ))}

        {/* City dots on map — same coords as landmarks */}
        {[
          { x: 148, y: 130 }, { x: 170, y: 210 }, { x: 244, y: 208 },
          { x: 66,  y: 192 }, { x: 218, y: 168 },
        ].map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#16A34A" fillOpacity="0"
            style={{ animation: `sp-fillMap 0.3s ease ${2.45 + i * 0.25}s forwards` }} />
        ))}
      </svg>

      {/* "와보랑께" title */}
      <div style={{ position: 'absolute', bottom: 180, left: 0, right: 0, textAlign: 'center', opacity: 0, animation: 'sp-title 0.75s cubic-bezier(0.34,1.56,0.64,1) 3.9s forwards' }}>
        <div style={{ fontSize: 46, fontWeight: 900, color: '#14532D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.035em', lineHeight: 1.05 }}>와보랑께</div>
        <div style={{ fontSize: 14, color: '#15803D', marginTop: 8, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '0.04em', opacity: 0, animation: 'sp-sub 0.5s ease 4.5s forwards' }}>전남 뚜벅이 여행</div>
      </div>

      <button onClick={onDone} style={{ position: 'absolute', bottom: 28, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', fontSize: 14, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", fontWeight: 700 }}>건너뛰기</button>
    </div>
  )
}

function Login({ onLogin, onSignup, onGuest, error }: {
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, name: string, password: string) => Promise<void>
  onGuest: () => void
  error?: string | null
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [backdrop, setBackdrop] = useState<string | null>(null)
  const submit = async () => {
    setLoading(true)
    try {
      if (mode === 'signup') await onSignup(email.trim(), name.trim(), pw)
      else await onLogin(email.trim(), pw)
    } catch {
      // 에러는 상위에서 표시
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    api.loginPhoto()
      .then((payload) => { if (!cancelled) setBackdrop(payload.img) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#14532D', overflowY: 'auto' }} className="hide-scroll">
      {backdrop ? (
        <img src={backdrop} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,16,12,0.06) 0%, rgba(8,16,12,0.16) 42%, rgba(8,16,12,0.34) 100%)' }} />
      <div style={{ position: 'relative', minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 24px' }}>
        <div className="login-card">
          <div className="login-card-glass" />
          <div className="login-card-body">
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, marginBottom: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['login', 'signup'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '9px', borderRadius: 10, background: mode === m ? 'rgba(255,255,255,0.22)' : 'transparent', border: 'none', fontSize: 14, fontWeight: mode === m ? 700 : 400, color: mode === m ? '#fff' : 'rgba(255,255,255,0.58)', cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>
                {m === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && <div><div style={{ ...S.text(13, 500, 'rgba(255,255,255,0.72)'), marginBottom: 6 }}>이름</div><TxtInput glass value={name} onChange={setName} placeholder="홍길동" /></div>}
            <div><div style={{ ...S.text(13, 500, 'rgba(255,255,255,0.72)'), marginBottom: 6 }}>이메일</div><TxtInput glass value={email} onChange={setEmail} placeholder="email@example.com" type="email" icon="user" /></div>
            <div><div style={{ ...S.text(13, 500, 'rgba(255,255,255,0.72)'), marginBottom: 6 }}>비밀번호</div><TxtInput glass value={pw} onChange={setPw} placeholder="비밀번호" type="password" /></div>
            {mode === 'signup' ? <div style={S.text(12, 400, 'rgba(255,255,255,0.58)')}>8자 이상, 대문자·소문자·숫자·특수문자를 포함해야 합니다.</div> : null}
            {error ? <div style={{ ...S.text(13, 600, '#FECACA') }}>{error}</div> : null}
            <Btn frost onClick={submit} loading={loading}>{mode === 'login' ? '로그인' : '회원가입'}</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} /><span style={S.text(13, 400, 'rgba(255,255,255,0.58)')}>또는</span><div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '카카오로 계속하기', bg: 'rgba(254,229,0,0.58)', c: '#181600', emoji: '💬', border: 'rgba(254,229,0,0.28)' },
              { label: '구글로 계속하기', bg: 'rgba(255,255,255,0.1)', c: '#fff', emoji: '🔵', border: 'rgba(255,255,255,0.16)' },
              { label: 'Apple로 계속하기', bg: 'rgba(0,0,0,0.28)', c: '#fff', emoji: '🍎', border: 'rgba(255,255,255,0.12)' }
            ].map(s => (
              <button key={s.label} onClick={() => window.alert('소셜 로그인은 아직 서버에 없습니다. 이메일로 가입해주세요.')} style={{ padding: '13px 18px', borderRadius: 16, background: s.bg, color: s.c, border: `1px solid ${s.border}`, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
                <span>{s.emoji}</span>{s.label}
              </button>
            ))}
          </div>
          <button onClick={onGuest} style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.62)', fontSize: 14, cursor: 'pointer', padding: '10px', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>게스트로 이용하기</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Course Card — photo-forward reference style ───────────────────────────────
function CourseCard({ course: c, onPress, wide }: { course: Course; onPress: () => void; wide?: boolean }) {
  return (
    <div className="card-press" onClick={onPress} style={{ background: L.surface, borderRadius: L.rXl, overflow: 'hidden', boxShadow: L.shadowMd, cursor: 'pointer', width: '100%' }}>
      <div style={{ position: 'relative', height: wide ? 220 : 160 }}>
        <img src={c.imageUrl} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {/* Rating badge — reference style white pill */}
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.95)', borderRadius: L.rFull, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 6px rgba(0,0,0,0.14)' }}>
          <span style={{ color: '#F59E0B', fontSize: 12 }}>★</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: L.dark, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{c.score}</span>
        </div>
        {/* Data badge */}
        <div style={{ position: 'absolute', top: 10, left: 10 }}><Badge type={c.dataSource} /></div>
        {/* Bottom gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
        <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>📍 {c.city}</span>
        </div>
      </div>
      <div style={{ padding: '14px 14px 16px' }}>
        <div style={{ ...S.text(15, 800, L.text), marginBottom: 4, lineHeight: 1.3, letterSpacing: '-0.01em' }}>{c.title}</div>
        <div style={{ ...S.text(12, 400, L.textMuted), marginBottom: 12 }}>{c.subtitle}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: `⏱ ${c.hours}h`, col: L.dark },
            { label: `🚶 ${c.walkMin}분`, col: L.teal },
            { label: `🔄 ${c.transferCount}회`, col: L.textSec },
          ].map(t => (
            <span key={t.label} style={{ fontSize: 11, fontWeight: 700, color: t.col, background: L.bg, borderRadius: 8, padding: '4px 9px' }}>{t.label}</span>
          ))}
        </div>
        {wide && (
          <div style={{ ...S.text(12, 400, L.textSec), marginTop: 10, lineHeight: 1.6, paddingTop: 10, borderTop: `1px solid ${L.borderLight}` }}>
            <span style={{ fontWeight: 700, color: L.dark }}>추천 이유  </span>{c.reason.slice(0, 80)}…
          </div>
        )}
      </div>
    </div>
  )
}

function formatHotMetric(place: HotPlace) {
  if (place.source === 'festival' || place.category === '축제·행사') {
    return place.periodShort || place.statusLabel || '행사'
  }
  if (place.visitors > 0) return place.visitors.toLocaleString()
  return '—'
}

function isFestivalPlace(place: HotPlace) {
  return place.source === 'festival' || place.category === '축제·행사'
}

function hotPlaceFacts(place: HotPlace) {
  return [
    { icon: '📅', label: '기간', val: place.periodLabel },
    { icon: '⏰', label: '운영 시간', val: place.hours },
    { icon: '📍', label: '장소', val: place.eventPlace || place.address },
    { icon: '💳', label: '입장료', val: place.fee },
    { icon: '🕒', label: '관람 소요', val: place.spendTime },
    { icon: '👤', label: '관람 연령', val: place.ageLimit },
    { icon: '🏛', label: '주최', val: place.sponsor },
    { icon: '☎', label: '문의', val: place.tel },
    { icon: '⏸', label: '휴무', val: place.restDate },
  ].filter((item) => Boolean(item.val))
}

function TrendBadge({ isNew, isTrending }: { isNew?: boolean; isTrending?: boolean }) {
  if (isTrending) return <span style={{ fontSize: 10, fontWeight: 800, background: '#FEF2F2', color: '#DC2626', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.02em' }}>🔥 HOT</span>
  if (isNew) return <span style={{ fontSize: 10, fontWeight: 800, background: '#ECFDF5', color: '#059669', borderRadius: 6, padding: '2px 7px', letterSpacing: '0.02em' }}>✨ NEW</span>
  return null
}

function HotPlaceDetail({ place, places, onBack, onPlan }: { place: HotPlace; places: HotPlace[]; onBack: () => void; onPlan: () => void }) {
  const related = places.filter(p => p.id !== place.id && (p.city === place.city || p.category === place.category)).slice(0, 2)
  const festival = isFestivalPlace(place)
  const facts = hotPlaceFacts(place)
  const story = place.story || place.desc
  const metricMain = festival ? (place.periodShort || '일정 확인') : formatHotMetric(place)
  const metricMainLabel = festival ? (place.statusLabel || '행사 기간') : (place.metricLabel || '인기 지표')
  const metricSide = festival ? (place.fee || '문의') : place.city
  const metricSideLabel = festival ? '입장료' : '전라남도'

  return (
    <div style={{ position: 'absolute', inset: 0, background: L.surface, zIndex: 30, overflowY: 'auto' }} className="hide-scroll anim-sheet">
      <div style={{ position: 'relative', height: 320 }}>
        <img src={place.img} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />

        <div style={{ position: 'absolute', top: 52, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: L.rFull, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Ic n="chevL" sz={18} c="#fff" />
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ width: 40, height: 40, borderRadius: L.rFull, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Ic n="heart" sz={18} c="#fff" />
            </button>
            <button style={{ width: 40, height: 40, borderRadius: L.rFull, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Ic n="share" sz={18} c="#fff" />
            </button>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <TrendBadge isTrending={place.isTrending} isNew={place.isNew} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '2px 8px', backdropFilter: 'blur(4px)' }}>{place.category}</span>
            {place.statusLabel ? <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'rgba(22,163,74,0.85)', borderRadius: 6, padding: '2px 8px' }}>{place.statusLabel}</span> : null}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.025em', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{place.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <Ic n="location" sz={12} c="rgba(255,255,255,0.75)" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{place.eventPlace || `${place.city} · 전라남도`}</span>
          </div>
        </div>
      </div>

      <div style={{ margin: '-18px 20px 0', display: 'flex', gap: 10, position: 'relative', zIndex: 2 }}>
        <div style={{ background: L.surface, borderRadius: L.rXl, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: L.shadowMd, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{festival ? '📅' : '👀'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.25 }}>{metricMain}</div>
            <div style={{ fontSize: 11, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{metricMainLabel}</div>
          </div>
        </div>
        <div style={{ background: L.surface, borderRadius: L.rXl, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: L.shadowMd, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>{festival ? '💳' : '📈'}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#16A34A', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{metricSide}</div>
            <div style={{ fontSize: 11, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{metricSideLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '22px 20px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 8 }}>{festival ? '이런 행사예요' : '이런 곳이에요'}</div>
        <div style={{ fontSize: 15, color: L.text, lineHeight: 1.85, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", fontWeight: 400, whiteSpace: 'pre-wrap' }}>{story}</div>
      </div>

      {place.program ? (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 8 }}>프로그램</div>
          <div style={{ fontSize: 14, color: L.textSec, lineHeight: 1.75, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", whiteSpace: 'pre-wrap' }}>{place.program}</div>
        </div>
      ) : null}

      {place.tags.length > 0 && (
        <div style={{ padding: '14px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {place.tags.map(t => (
            <span key={t} style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', background: '#DCFCE7', borderRadius: L.rFull, padding: '5px 12px' }}># {t}</span>
          ))}
        </div>
      )}

      {facts.length > 0 && (
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 12 }}>{festival ? '행사 정보' : '방문 정보'}</div>
          <div style={{ background: L.bg, borderRadius: L.rXl, overflow: 'hidden' }}>
            {facts.map((item, index) => (
              <div key={item.label} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderTop: index === 0 ? 'none' : `1px solid ${L.borderLight}` }}>
                <span style={{ fontSize: 16, lineHeight: '20px' }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>
          {place.homepage ? (
            <a href={place.homepage} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 10, fontSize: 13, fontWeight: 700, color: '#15803D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", textDecoration: 'none' }}>공식 안내 보기 →</a>
          ) : null}
        </div>
      )}

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 12 }}>위치</div>
        <div style={{ height: 140, borderRadius: L.rXl, background: 'linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid #86EFAC' }}>
          <Ic n="location" sz={28} c="#16A34A" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#15803D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{place.city} · {place.name}</span>
          <span style={{ fontSize: 11, color: '#4ADE80', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", textAlign: 'center', padding: '0 16px' }}>{place.eventPlace || place.address || `${place.city} · 전라남도`}</span>
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 12 }}>이런 곳도 있어요</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {related.map(r => (
              <div key={r.id} style={{ background: L.bg, borderRadius: L.rLg, display: 'flex', gap: 0, overflow: 'hidden' }}>
                <img src={r.img} alt={r.name} style={{ width: 80, height: 80, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 3 }}>{r.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Ic n="location" sz={10} c={L.textMuted} />
                    <span style={{ fontSize: 11, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{r.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '24px 20px 40px' }}>
        <button onClick={onPlan} className="card-press" style={{ width: '100%', background: L.dark, color: '#fff', border: 'none', borderRadius: L.rXl, padding: '18px', fontSize: 15, fontWeight: 700, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ic n="search" sz={18} c="#fff" />
          이 장소 포함해서 코스 만들기
        </button>
      </div>
    </div>
  )
}

function HomeScreen({ onPlan, courses }: { onPlan: (seed?: Partial<Condition>) => void; courses: Course[] }) {
  const [selectedHotPlace, setSelectedHotPlace] = useState<HotPlace | null>(null)
  const [hotPlaces, setHotPlaces] = useState<HotPlace[]>([])
  const [hotStatus, setHotStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [hotUpdated, setHotUpdated] = useState('불러오는 중')

  useEffect(() => {
    let cancelled = false
    api.hotPlaces()
      .then((payload) => {
        if (cancelled) return
        setHotPlaces(payload.places ?? [])
        setHotStatus((payload.places?.length ?? 0) ? 'ready' : 'empty')
        setHotUpdated(payload.fetchedAt ? new Date(payload.fetchedAt).toLocaleDateString('ko-KR') : '오늘')
      })
      .catch(() => {
        if (!cancelled) setHotStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  const planFromPlace = (place: HotPlace) => onPlan({
    region: place.city,
    departure: `${place.city}역`,
    interests: place.tags.slice(0, 3),
  })

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH }} className="hide-scroll">

      {/* ── 히어로 영역 ── */}
      <div style={{ position: 'relative', height: 400 }}>
        <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=700&fit=crop&auto=format" alt="전남 풍경" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.72) 100%)' }} />

        {/* 앱 로고 */}
        <div style={{ position: 'absolute', top: 52, left: 20, right: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🚶</div>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>와보랑께</span>
          </div>
          <button style={{ width: 38, height: 38, borderRadius: L.rFull, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Ic n="bell" sz={17} c="#fff" />
          </button>
        </div>

        {/* 히어로 텍스트 */}
        <div style={{ position: 'absolute', bottom: 96, left: 20, right: 20 }} className="anim-fade-up">
          <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 10, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>전남을<br />걸어봐요</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>취향 선택 → 코스 계산 → 대중교통 안내</div>
        </div>

        {/* 코스 만들기 CTA — 히어로 하단에 띄워진 흰 카드 */}
        <button onClick={() => onPlan()} className="card-press" style={{ position: 'absolute', bottom: -28, left: 20, right: 20, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', borderRadius: L.rXl, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', border: 'none', boxShadow: L.shadowLg, textAlign: 'left' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: L.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic n="search" sz={20} c="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={S.text(15, 700, L.text)}>여행 코스 만들기</div>
            <div style={S.text(12, 400, L.textMuted)}>출발지 · 기간 · 목적 · 교통 (5단계)</div>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: L.rFull, background: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic n="chevR" sz={16} c={L.dark} />
          </div>
        </button>
      </div>

      {/* ── 지금 핫한 장소 섹션 ── */}
      <div style={{ padding: '56px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>지금 핫한 장소</div>
            <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 3 }}>전남 사람들이 지금 가장 많이 찾는 곳</div>
          </div>
          <span style={{ fontSize: 12, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", fontWeight: 600, paddingBottom: 2 }}>{hotUpdated}</span>
        </div>
      </div>

      {hotStatus !== 'ready' && (
        <div style={{ margin: '14px 20px 0', background: L.surface, borderRadius: L.rXl, padding: '28px 18px', textAlign: 'center', boxShadow: L.shadowSm }}>
          <div style={S.text(14, 600, L.text)}>
            {hotStatus === 'loading' ? '전남에서 지금 많이 찾는 장소를 불러오는 중이에요.' : hotStatus === 'error' ? '핫한 장소를 불러오지 못했어요. API 서버를 확인해 주세요.' : '표시할 핫한 장소가 아직 없어요.'}
          </div>
        </div>
      )}

      {/* 첫 번째 — 피처드 카드 (넓은 사진 + 긴 설명) */}
      <div style={{ padding: '14px 20px 0' }}>
        {hotPlaces[0] && (() => {
          const p = hotPlaces[0]
          return (
            <div onClick={() => setSelectedHotPlace(p)} style={{ background: L.surface, borderRadius: L.rXl, overflow: 'hidden', boxShadow: L.shadowMd, cursor: 'pointer' }} className="card-press">
              <div style={{ position: 'relative', height: 200 }}>
                <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.48) 0%, transparent 55%)' }} />
                {/* 방문자 수 */}
                <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.92)', borderRadius: L.rFull, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}>
                  <span style={{ fontSize: 11 }}>👀</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: L.dark, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{formatHotMetric(p)}</span>
                </div>
                <div style={{ position: 'absolute', bottom: 12, left: 14, display: 'flex', gap: 6 }}>
                  <TrendBadge isTrending={p.isTrending} isNew={p.isNew} />
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 6, padding: '2px 7px', backdropFilter: 'blur(4px)' }}>{p.category}</span>
                </div>
              </div>
              <div style={{ padding: '14px 16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ ...S.text(16, 800, L.text), lineHeight: 1.3, letterSpacing: '-0.01em' }}>{p.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                      <Ic n="location" sz={11} c={L.textMuted} />
                      <span style={S.text(12, 500, L.textMuted)}>{p.city}</span>
                    </div>
                  </div>
                </div>
                <div style={{ ...S.text(13, 400, L.textSec), lineHeight: 1.75, marginBottom: 12 }}>{p.desc}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.tags.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 600, color: L.textSec, background: L.bg, borderRadius: L.rFull, padding: '4px 10px' }}># {t}</span>)}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* 나머지 — 2열 작은 카드 + 세로 리스트 교차 */}
      <div style={{ padding: '12px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {hotPlaces.slice(1, 3).map(p => (
          <div key={p.id} onClick={() => setSelectedHotPlace(p)} style={{ background: L.surface, borderRadius: L.rXl, overflow: 'hidden', boxShadow: L.shadowSm, cursor: 'pointer' }} className="card-press">
            <div style={{ position: 'relative', height: 120 }}>
              <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.42) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', top: 8, left: 8 }}>
                <TrendBadge isTrending={p.isTrending} isNew={p.isNew} />
              </div>
              <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(255,255,255,0.88)', borderRadius: L.rFull, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 10 }}>👀</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: L.dark, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{formatHotMetric(p)}</span>
              </div>
            </div>
            <div style={{ padding: '10px 12px 14px' }}>
              <div style={{ ...S.text(13, 800, L.text), lineHeight: 1.3, marginBottom: 3 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 7 }}>
                <Ic n="location" sz={10} c={L.textMuted} />
                <span style={S.text(11, 500, L.textMuted)}>{p.city}</span>
              </div>
              <div style={{ ...S.text(11, 400, L.textSec), lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 나머지 — 가로형 리스트 카드 */}
      <div style={{ padding: '12px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hotPlaces.slice(3).map(p => (
          <div key={p.id} onClick={() => setSelectedHotPlace(p)} style={{ background: L.surface, borderRadius: L.rXl, display: 'flex', gap: 0, overflow: 'hidden', boxShadow: L.shadowSm, cursor: 'pointer' }} className="card-press">
            <div style={{ position: 'relative', width: 110, flexShrink: 0 }}>
              <img src={p.img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', top: 8, left: 8 }}>
                <TrendBadge isTrending={p.isTrending} isNew={p.isNew} />
              </div>
            </div>
            <div style={{ flex: 1, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: L.bg, color: L.textSec, borderRadius: 5, padding: '2px 6px' }}>{p.category}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10 }}>👀</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{formatHotMetric(p)}</span>
                </div>
              </div>
              <div style={{ ...S.text(14, 800, L.text), lineHeight: 1.3, marginBottom: 3 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 7 }}>
                <Ic n="location" sz={10} c={L.textMuted} />
                <span style={S.text(11, 500, L.textMuted)}>{p.city}</span>
              </div>
              <div style={{ ...S.text(12, 400, L.textSec), lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>
      </div>
      {selectedHotPlace && (
        <HotPlaceDetail place={selectedHotPlace} places={hotPlaces} onBack={() => setSelectedHotPlace(null)} onPlan={() => planFromPlace(selectedHotPlace)} />
      )}
    </div>
  )
}

function CourseListScreen({ state, condition, courses, onSelect, onRetry, onPlan, fallbackReason }: {
  state: CourseState; condition?: Condition; courses: Course[]; onSelect: (c: Course) => void; onRetry: () => void; onPlan: () => void; fallbackReason?: string | null
}) {
  const [filter, setFilter] = useState('추천순')
  const filters = ['추천순', '적게 걷기', '맛집', '자연', '카페', '사진', '역사', '로컬']
  const filtered = filter === '추천순'
    ? courses
    : filter === '적게 걷기'
      ? [...courses].sort((a, b) => b.walkFitScore - a.walkFitScore)
      : courses.filter(c => c.tags.some(t => t.includes(filter)))

  if (state === 'loading') return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH }} className="hide-scroll">
      <div style={{ padding: '80px 20px 24px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: `3px solid ${L.border}`, borderTop: `3px solid ${L.dark}`, borderRadius: 24, margin: '0 auto 20px' }} className="spin" />
        <div style={S.text(17, 700, L.text)}>코스 계산 중…</div>
      </div>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[1, 2].map(i => <div key={i} style={{ background: L.surface, borderRadius: L.rXl, overflow: 'hidden' }}><Skel h={160} r={0} /><div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}><Skel h={16} w="60%" /><Skel h={12} w="44%" /><Skel h={34} /></div></div>)}
      </div>
    </div>
  )
  if (state === 'error') return <div style={{ position: 'absolute', inset: 0, background: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Empty icon="info" title="코스를 불러오지 못했어요" cta="다시 시도" onCta={onRetry} /></div>
  if (state === 'idle') return <div style={{ position: 'absolute', inset: 0, background: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Empty icon="list" title="추천 코스가 없어요" desc="홈에서 여행 조건을 설정해 보세요." cta="코스 만들기" onCta={onPlan} /></div>

  return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH }} className="hide-scroll">
      <div style={{ background: L.surface, padding: '52px 20px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        {condition && <div style={{ ...S.text(13, 500, L.textMuted), marginBottom: 2 }}>{condition.departure} → {condition.region} · {condition.date === condition.endDate ? `${condition.date} ${condition.startTime}–${condition.endTime}` : `${condition.date} ${condition.startTime} – ${condition.endDate} ${condition.endTime}`}</div>}
        <div style={{ fontSize: 22, fontWeight: 900, color: L.text, marginBottom: 14, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>추천 코스 {courses.length}개</div>
        {(state === 'demo' || fallbackReason) && <div style={{ background: '#FEF9C3', borderRadius: L.rMd, padding: '8px 14px', marginBottom: 12, ...S.text(12, 500, '#92400E') }}>{fallbackReason || '시연 코스로 대체했습니다'}</div>}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16 }} className="hide-scroll">
          {filters.map(f => <button key={f} onClick={() => setFilter(f)} className="chip-btn" style={{ whiteSpace: 'nowrap', padding: '8px 16px', borderRadius: L.rFull, background: filter === f ? L.dark : L.bg, color: filter === f ? '#fff' : L.textSec, border: 'none', fontSize: 13, fontWeight: filter === f ? 700 : 500, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{f}</button>)}
        </div>
      </div>
      {filtered.length === 0
        ? <Empty icon="filter" title={`'${filter}' 코스가 없어요`} cta="필터 초기화" onCta={() => setFilter('추천순')} />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px 20px' }}>
            {filtered.map((c, i) => <CourseCard key={c.id} course={c} onPress={() => onSelect(c)} wide={i === 0} />)}
          </div>
      }
    </div>
  )
}

function transitStepIcon(mode?: TransitStep['mode'] | Place['transitMode']) {
  if (mode === 'walk') return '🚶'
  if (mode === 'shuttle') return '🚐'
  if (mode === 'subway' || mode === 'train') return '🚇'
  if (mode === 'ferry') return '⛴️'
  return '🚌'
}

function TransitHop({ place, compact = false }: { place: Place; compact?: boolean }) {
  const steps = place.transitSteps?.filter((step) => step.minutes > 0)
  if ((!steps || !steps.length) && !place.transitTo) return null
  if (steps?.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6, padding: compact ? '10px 14px 6px' : '8px 12px', background: compact ? 'transparent' : L.bg, borderRadius: 10 }}>
        {steps.map((step, index) => (
          <div key={`${step.label}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 14, lineHeight: '18px' }}>{transitStepIcon(step.mode)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...S.text(12, 700, L.textSec) }}>{step.label} {step.minutes}분</div>
              {step.fromStop && step.toStop && (
                <div style={{ ...S.text(11, 500, L.textMuted), marginTop: 2 }}>{step.fromStop} → {step.toStop}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '10px 14px 6px' : '8px 12px', background: compact ? 'transparent' : L.bg, borderRadius: 10 }}>
      <span style={{ fontSize: 14 }}>{transitStepIcon(place.transitMode)}</span>
      <span style={{ ...S.text(12, 500, L.textSec), flex: 1 }}>{place.transitTo}</span>
      {place.transitMin ? <span style={{ fontFamily: "'Pretendard Variable', Pretendard, sans-serif", fontSize: 12, fontWeight: 700, color: L.dark }}>{place.transitMin}분</span> : null}
    </div>
  )
}

// ── Course Detail — hero + right thumbnail strip (reference) ─────────────────
function CourseDetailScreen({ course: c, onBack, onBookmark, bookmarked, onEdit, onConfirm }: {
  course: Course; onBack: () => void; onBookmark: () => void; bookmarked: boolean; onEdit: () => void; onConfirm: () => void
}) {
  const [tab, setTab] = useState<'timeline' | 'score'>('timeline')
  const catMeta: Record<PlaceCat, { label: string; emoji: string; bg: string; col: string }> = {
    transit: { label: '교통 거점', emoji: '🚉', bg: '#EFF6FF', col: '#2563EB' },
    nature:  { label: '자연',       emoji: '🌿', bg: '#ECFDF5', col: '#059669' },
    meal:    { label: '식사',       emoji: '🍽', bg: '#FDF0E3', col: '#C2611F' },
    cafe:    { label: '카페',       emoji: '☕', bg: '#FFFBEB', col: '#92400E' },
    market:  { label: '시장',       emoji: '🛒', bg: '#F5F3FF', col: '#5B21B6' },
    history: { label: '역사',       emoji: '🏛', bg: '#FEE2E2', col: '#DC2626' },
    culture: { label: '문화',       emoji: '🎨', bg: '#ECFEFF', col: '#0E7490' },
  }
  const efficiency = Math.round(((c.hours * 60) - c.walkMin - c.transitMin) / (c.hours * 60) * 100)
  const totalPlaceMin = c.places.reduce((s, p) => s + p.stayMin, 0)
  const totalMin = c.walkMin + c.transitMin + totalPlaceMin
  const totalH = Math.floor(totalMin / 60); const totalM = totalMin % 60

  // Photos for thumbnail strip — use place imagery or static crops
  const thumbUrls = [
    c.imageUrl,
    'https://images.unsplash.com/photo-1559827291-72ee739d0d9a?w=120&h=120&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=120&h=120&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=120&h=120&fit=crop&auto=format',
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, zIndex: 110, display: 'flex', flexDirection: 'column' }} className="anim-fade-in">
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} className="hide-scroll">
      {/* Hero + thumbnail strip */}
      <div style={{ position: 'relative', height: 340 }}>
        <img src={c.imageUrl} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.7) 100%)' }} />

        {/* Back + heart */}
        <div style={{ position: 'absolute', top: 52, left: 16, right: 16, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={onBack} style={{ width: 40, height: 40, borderRadius: L.rFull, background: 'rgba(255,255,255,0.92)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>
            <Ic n="back" sz={18} c={L.dark} />
          </button>
          <button onClick={onBookmark} style={{ width: 40, height: 40, borderRadius: L.rFull, background: 'rgba(255,255,255,0.92)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 6px rgba(0,0,0,0.15)' }}>
            <Ic n="heart" sz={18} c={bookmarked ? '#EF4444' : L.dark} />
          </button>
        </div>

        {/* Right thumbnail strip — reference style */}
        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {thumbUrls.map((u, i) => (
            <div key={i} style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
              <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
        </div>

        {/* Title block bottom */}
        <div style={{ position: 'absolute', bottom: 20, left: 16, right: 76 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}><Badge type={c.dataSource} /><Badge type={c.routeSource} /></div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 6 }}>{c.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Ic n="location" sz={12} c="rgba(255,255,255,0.8)" />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{c.city}</span>
          </div>
        </div>
      </div>

      {/* Metrics row — reference style */}
      <div style={{ background: L.surface, padding: '16px 20px', display: 'flex', gap: 0, marginBottom: 12 }}>
        {[
          { label: '소요시간', value: `${c.hours}시간`, valueCol: L.dark },
          { label: '걷기 부담', value: c.walkFitScore >= 85 ? '낮음' : c.walkFitScore >= 70 ? '보통' : '높음', valueCol: L.teal },
          { label: '추천 점수', value: String(c.score), valueCol: '#F59E0B' },
        ].map((m, i) => (
          <div key={m.label} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? `1px solid ${L.borderLight}` : 'none' }}>
            <div style={S.text(11, 500, L.textMuted)}>{m.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: m.valueCol, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginTop: 3 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Reason */}
      <div style={{ margin: '0 16px 12px', background: L.surface, borderRadius: L.rXl, padding: '16px 18px', boxShadow: L.shadowSm }}>
        <div style={{ ...S.text(12, 700, L.textMuted), marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>이 코스를 추천한 이유</div>
        <div style={{ ...S.text(14, 400, L.textSec), lineHeight: 1.7 }}>{c.reason}</div>
        {/* Move metrics */}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${L.borderLight}` }}>
          <span style={S.text(12, 600, L.dark)}>🚶 도보 {c.walkMin}분</span>
          <span style={S.text(12, 600, L.textSec)}>🚌 대중교통 {c.transitMin}분</span>
          <span style={S.text(12, 600, L.textSec)}>🔄 환승 {c.transferCount}회</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', background: L.surface, borderRadius: L.rXl, padding: 4, marginBottom: 14, boxShadow: L.shadowSm }}>
          {([['timeline','타임라인'],['score','점수 분석']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '10px', borderRadius: L.rLg, background: tab === id ? L.dark : 'transparent', border: 'none', fontSize: 13, fontWeight: tab === id ? 700 : 400, color: tab === id ? '#fff' : L.textMuted, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", transition: 'all 0.15s' }}>{label}</button>
          ))}
        </div>

        {tab === 'timeline' && (
          <div>
            {c.places.map((p, i) => {
              const cat = catMeta[p.category]
              const isLast = i === c.places.length - 1
              return (
                <div key={p.id} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 46, flexShrink: 0, paddingTop: 4 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: i === 0 ? L.dark : L.surface, border: `2px solid ${i === 0 ? L.dark : L.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, zIndex: 1, boxShadow: L.shadowSm }}>
                      {cat.emoji}
                    </div>
                    {!isLast && <div style={{ flex: 1, width: 1.5, background: L.border, margin: '4px 0', minHeight: 28 }} />}
                  </div>
                  <div style={{ flex: 1, paddingLeft: 12, paddingBottom: isLast ? 8 : 18 }}>
                    <div style={{ background: L.surface, borderRadius: L.rLg, padding: '14px', boxShadow: L.shadowSm, marginBottom: p.transitTo && !isLast ? 6 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'Pretendard Variable', Pretendard, sans-serif", fontSize: 12, fontWeight: 800, color: L.dark, background: L.bg, padding: '2px 8px', borderRadius: 20 }}>{p.arriveAt}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, background: cat.bg, color: cat.col, borderRadius: 6, padding: '2px 7px' }}>{cat.label}</span>
                        {p.stayMin > 0 && <span style={S.text(11, 400, L.textMuted)}>{p.stayMin}분</span>}
                      </div>
                      <div style={S.text(15, 700, L.text)}>{p.name}</div>
                      <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 2, marginBottom: 6 }}>{p.address}</div>
                      <div style={{ ...S.text(13, 400, L.textSec), lineHeight: 1.55, marginBottom: p.interests.length > 0 ? 8 : 0 }}>{p.description}</div>
                      {p.interests.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {p.interests.map(tag => <span key={tag} style={{ fontSize: 11, background: L.bg, color: L.textSec, borderRadius: 6, padding: '2px 7px', fontWeight: 600 }}>{tag}</span>)}
                        </div>
                      )}
                    </div>
                    {(p.transitTo || p.transitSteps?.length) && !isLast && (
                      <TransitHop place={p} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'score' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: L.surface, borderRadius: L.rXl, padding: 18, boxShadow: L.shadowSm }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: L.dark, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1 }}>{c.score}</div>
                <div><div style={S.text(13, 700, L.text)}>추천 점수</div><div style={S.text(11, 400, L.textMuted)}>/ 100점</div></div>
              </div>
              {c.scoreBreakdown.map(s => {
                const col = s.value >= 85 ? L.dark : s.value >= 70 ? L.demoOrange : '#EF4444'
                return (
                  <div key={s.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={S.text(13, 500, L.textSec)}>{s.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: col, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{s.value}</span>
                    </div>
                    <div style={{ height: 6, background: L.bg, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.value}%`, background: col, borderRadius: 3 }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ background: L.surface, borderRadius: L.rXl, padding: 18, boxShadow: L.shadowSm }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: L.teal, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1 }}>{c.walkFitScore}</div>
                <div><div style={S.text(13, 700, L.text)}>🚶 뚜벅이 적합도</div><div style={S.text(11, 400, L.textMuted)}>/ 100점</div></div>
              </div>
              <div style={{ ...S.text(12, 500, L.textSec), marginBottom: 14 }}>여행시간의 <span style={{ fontWeight: 800, color: L.teal }}>{efficiency}%</span>를 장소에서 보내요</div>
              {c.walkBreakdown.map((w, i) => (
                <div key={w.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: i < c.walkBreakdown.length - 1 ? `1px solid ${L.borderLight}` : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.text(13, 600, L.text)}>{w.label}</div>
                    <div style={{ ...S.text(11, 400, L.textMuted), marginTop: 1 }}>{w.detail}</div>
                  </div>
                  <Stars count={w.stars} />
                </div>
              ))}
            </div>
            <div style={{ background: L.surface, borderRadius: L.rXl, padding: 16, boxShadow: L.shadowSm }}>
              <div style={{ ...S.text(14, 700, L.text), marginBottom: 12 }}>⏱ 시간 적합도</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div><div style={S.text(11, 500, L.textMuted)}>설정</div><div style={{ fontSize: 20, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{c.hours}시간</div></div>
                <div style={{ color: L.textMuted, fontSize: 20 }}>≈</div>
                <div><div style={S.text(11, 500, L.textMuted)}>실제</div><div style={{ fontSize: 20, fontWeight: 800, color: L.teal, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{totalH}시간 {totalM}분</div></div>
              </div>
            </div>
          </div>
        )}

      </div>
      <div style={{ height: 16 }} />
    </div>

      {/* Bottom CTA */}
      <div style={{ flexShrink: 0, padding: '12px 20px 18px', background: L.surface, borderTop: `1px solid ${L.borderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={S.text(11, 500, L.textMuted)}>추천점수 / 뚜벅이적합도</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: L.dark, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{c.score} <span style={{ color: L.teal }}>/ {c.walkFitScore}</span></div>
          </div>
          <button onClick={onBookmark} style={{ width: 44, height: 44, borderRadius: L.rFull, border: `1.5px solid ${L.border}`, background: L.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic n="heart" sz={19} c={bookmarked ? '#EF4444' : L.textMuted} />
          </button>
          <button onClick={onEdit} style={{ width: 44, height: 44, borderRadius: L.rFull, border: `1.5px solid ${L.border}`, background: L.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic n="edit" sz={17} c={L.dark} />
          </button>
          <button onClick={onConfirm} className="card-press" style={{ height: 44, borderRadius: L.rFull, background: '#16A34A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 18px', flexShrink: 0, boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
            <span style={{ fontSize: 14 }}>🗺</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", whiteSpace: 'nowrap' }}>이 코스로 여행하기</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const WEATHER_TIPS = [
  { icon: '☀️', condition: '맑음', msg: '오늘 하늘이 맑아요. 야외 코스 최적의 날이에요!' },
  { icon: '⛅', condition: '구름 조금', msg: '구름이 살짝 있어 걷기 딱 좋은 날씨예요.' },
  { icon: '🌥', condition: '흐림', msg: '흐린 날엔 실내 명소도 좋아요. 역사·카페 코스 추천!' },
  { icon: '🌧', condition: '비', msg: '오늘은 비가 와요. 실내 여행지를 중심으로 다녀보세요.' },
  { icon: '⛈', condition: '천둥·번개', msg: '강한 비가 예상돼요. 안전한 실내에서 즐기세요.' },
  { icon: '🌨', condition: '눈', msg: '눈이 내려요! 설경 감상에 미끄럼 주의하세요.' },
  { icon: '🌬', condition: '바람', msg: '바람이 강해요. 바람막이 챙기고 출발하세요.' },
  { icon: '🌈', condition: '비 후 맑음', msg: '비 갠 뒤라 공기가 청명해요. 사진 찍기 딱이에요!' },
]

function MapScreen({ confirmedCourse, onDetail, onCancelConfirm }: {
  confirmedCourse: Course | null; onDetail: (c: Course) => void; onCancelConfirm: () => void
}) {
  const weatherTip = WEATHER_TIPS[new Date().getHours() % WEATHER_TIPS.length]
  const c = confirmedCourse

  const catColor: Record<string, string> = {
    transit: '#6366F1', nature: '#16A34A', meal: '#EA580C',
    cafe: '#D97706', market: '#0891B2', history: '#DC2626', culture: '#7C3AED',
  }

  if (!c) return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, display: 'flex', flexDirection: 'column', paddingBottom: L.tabH }}>
      {/* 날씨 배너 */}
      <div style={{ background: L.surface, padding: '52px 20px 20px', borderBottom: `1px solid ${L.borderLight}` }}>
        <div style={{ background: 'linear-gradient(135deg, #DCFCE7, #D1FAE5)', borderRadius: L.rXl, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>{weatherTip.icon}</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 2, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '0.04em' }}>오늘의 날씨 · {weatherTip.condition}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14532D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.4 }}>{weatherTip.msg}</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>🗺</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>확정된 코스가 없어요</div>
        <div style={{ fontSize: 14, color: L.textMuted, lineHeight: 1.7, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>추천 코스 탭에서 마음에 드는 코스를<br />"이 코스로 여행하기" 버튼으로 확정해 보세요.</div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, display: 'flex', flexDirection: 'column', paddingBottom: L.tabH }}>
      <div style={{ overflowY: 'auto', flex: 1 }} className="hide-scroll">

        {/* 날씨 배너 */}
        <div style={{ background: L.surface, padding: '52px 16px 16px' }}>
          <div style={{ background: 'linear-gradient(135deg, #DCFCE7, #D1FAE5)', borderRadius: L.rXl, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{weatherTip.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 2, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '0.04em' }}>오늘의 날씨 · {weatherTip.condition}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#14532D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.4 }}>{weatherTip.msg}</div>
            </div>
          </div>
        </div>

        {/* 코스 헤더 */}
        <div style={{ background: L.surface, padding: '0 16px 16px', borderBottom: `1px solid ${L.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', borderRadius: 6, padding: '2px 8px' }}>✓ 확정된 코스</span>
                <span style={{ fontSize: 11, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{c.city}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.025em', lineHeight: 1.25 }}>{c.title}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>🚶 도보 {c.walkMin}분</span>
                <span style={{ fontSize: 12, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>🔄 환승 {c.transferCount}회</span>
                <span style={{ fontSize: 12, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>📍 {c.placeCount}곳</span>
              </div>
            </div>
            <button onClick={onCancelConfirm} style={{ background: L.bg, border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>코스 변경</button>
          </div>
        </div>

        {/* 지도 플레이스홀더 */}
        <div style={{ margin: '16px 16px 0', position: 'relative', height: 220, borderRadius: L.rXl, overflow: 'hidden', boxShadow: L.shadowMd }}>
          <div style={{ position: 'absolute', inset: 0, background: '#E8EEF4' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(180,190,200,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(180,190,200,0.25) 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />
            <div style={{ position: 'absolute', top: '25%', left: '18%', width: 120, height: 80, borderRadius: 10, background: '#D4E0C8', opacity: 0.7 }} />
            <div style={{ position: 'absolute', top: '48%', left: '52%', width: 70, height: 55, borderRadius: 8, background: '#C8D8E4', opacity: 0.6 }} />
          </div>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M 55 185 C 95 165 130 148 168 130 C 210 112 240 95 278 78 C 295 68 308 52 296 34" stroke="#16A34A" strokeWidth="3" fill="none" strokeDasharray="8 5" opacity="0.7" />
            {c.places.map((p, i) => {
              const pts: [number,number][] = [[55,185],[110,158],[170,132],[228,104],[280,78],[296,38]]
              const [x, y] = pts[i] ?? [160, 110]
              const col = catColor[p.category] ?? L.dark
              return <g key={p.id}>
                {i === 0 && <circle cx={x} cy={y} r={22} fill={col} opacity={0.15} />}
                <circle cx={x} cy={y} r={i === 0 ? 14 : 10} fill={i === 0 ? col : '#fff'} stroke={col} strokeWidth={i === 0 ? 0 : 2.5} />
                <text x={x} y={y + 4.5} textAnchor="middle" fontSize={i === 0 ? 10 : 9} fill={i === 0 ? '#fff' : col} fontWeight="800" fontFamily="'Pretendard Variable',Pretendard,sans-serif">{i === 0 ? '출' : i + 1}</text>
              </g>
            })}
          </svg>
          <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: L.textSec, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>지도 연동 예정</div>
        </div>

        {/* 상세 타임라인 */}
        <div style={{ padding: '20px 16px 32px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 16 }}>여행 동선</div>
          {c.places.map((p, i) => {
            const col = catColor[p.category] ?? L.dark
            const isLast = i === c.places.length - 1
            return (
              <div key={p.id}>
                {/* 장소 카드 */}
                <div style={{ display: 'flex', gap: 14 }}>
                  {/* 타임라인 도트 + 선 */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: L.rFull, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{i === 0 ? '출' : i + 1}</span>
                    </div>
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 48, background: `linear-gradient(${col}, ${catColor[c.places[i+1]?.category] ?? L.dark})`, opacity: 0.25, margin: '4px 0' }} />}
                  </div>
                  {/* 장소 정보 */}
                  <div style={{ flex: 1, paddingBottom: 4 }}>
                    <div style={{ background: L.surface, borderRadius: L.rLg, padding: '12px 14px', boxShadow: L.shadowSm }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.3, flex: 1 }}>{p.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: col, background: `${col}18`, borderRadius: 6, padding: '2px 8px', flexShrink: 0, marginLeft: 8 }}>{p.arriveAt}</div>
                      </div>
                      <div style={{ fontSize: 12, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 6 }}>{p.address}</div>
                      <div style={{ fontSize: 13, color: L.textSec, lineHeight: 1.65, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", marginBottom: 8 }}>{p.description}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: col, background: `${col}14`, borderRadius: 6, padding: '3px 8px' }}>⏱ {p.stayMin}분 체류</span>
                        {p.interests.slice(0, 2).map(t => <span key={t} style={{ fontSize: 11, fontWeight: 600, color: L.textMuted, background: L.bg, borderRadius: 6, padding: '3px 8px' }}>{t}</span>)}
                      </div>
                    </div>
                    {/* 이동 정보 */}
                    {(p.transitTo || p.transitSteps?.length) && !isLast && (
                      <TransitHop place={p} compact />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MyTravelScreen({ loggedIn, user, onLogin, onLogout, bookmarkItems, history, onSelectCourse, onReplayHistory, onDeleteHistory, courses }: {
  loggedIn: boolean; user: AuthUser | null; onLogin: () => void; onLogout: () => void;
  bookmarkItems: BookmarkItem[]; history: HistoryItem[];
  onSelectCourse: (c: Course) => void; onReplayHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id?: string) => void; courses: Course[]
}) {
  const bm = bookmarkItems.map((item) => {
    const course = courses.find((c) => c.id === item.courseId)
    return { item, course }
  })
  if (!loggedIn) return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH }} className="hide-scroll">
      <div style={{ padding: '56px 20px 0' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: L.text, marginBottom: 4, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>내 여행</div>
        <div style={{ ...S.text(14, 400, L.textMuted), marginBottom: 28 }}>로그인하면 북마크와 이력을 저장합니다</div>
        <div style={{ background: L.dark, borderRadius: L.rXl, padding: 28, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} className="float">🚶</div>
          <div style={S.text(16, 700, '#fff')}>로그인하고 더 많이 즐겨요</div>
          <div style={{ ...S.text(13, 400, 'rgba(255,255,255,0.6)'), marginTop: 6, lineHeight: 1.65, marginBottom: 24 }}>북마크, 검색 이력을 영구 저장해요</div>
          <button onClick={onLogin} style={{ background: '#fff', color: L.dark, border: 'none', borderRadius: L.rFull, padding: '14px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Noto Sans KR', sans-serif', width: '100%'" }}>로그인 / 회원가입</button>
        </div>
      </div>
    </div>
  )
  return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH + 16 }} className="hide-scroll">
      <div style={{ padding: '56px 20px 0' }}>
        <div style={{ background: L.dark, borderRadius: L.rXl, padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 20, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🚶</div>
          <div style={{ flex: 1 }}>
            <div style={S.text(17, 700, '#fff')}>{user?.displayName || '여행자님'}</div>
            <div style={{ ...S.text(12, 400, 'rgba(255,255,255,0.55)'), marginTop: 2 }}>{user?.email || ''}</div>
          </div>
          <button onClick={onLogout} style={{ padding: '7px 14px', borderRadius: L.rFull, background: 'rgba(255,255,255,0.12)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>로그아웃</button>
        </div>
        <div style={{ ...S.text(16, 800, L.text), marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          북마크 <span style={{ fontSize: 13, fontWeight: 600, color: L.textMuted, background: L.border, padding: '2px 8px', borderRadius: 20 }}>{bm.length}</span>
        </div>
        {bm.length === 0
          ? <div style={{ background: L.surface, borderRadius: L.rXl, padding: '20px 16px', textAlign: 'center', ...S.text(14, 400, L.textMuted), marginBottom: 20, boxShadow: L.shadowSm }}>북마크한 코스가 없어요</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {bm.map(({ item, course }) => <div key={item.id} onClick={() => course && onSelectCourse(course)} style={{ background: L.surface, borderRadius: L.rXl, padding: 14, cursor: course ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12, boxShadow: L.shadowSm, opacity: course ? 1 : 0.7 }}>
                <img src={course?.imageUrl || 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&h=200&fit=crop&auto=format'} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...S.text(14, 700, L.text), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.courseName}</div>
                  <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 2 }}>{course ? `${item.city} · ${course.hours}시간` : `${item.city} · 현재 추천에서 이용할 수 없는 코스예요`}</div>
                </div>
                <Ic n="chevR" sz={16} c={L.textMuted} />
              </div>)}
            </div>
        }
        <div style={{ ...S.text(16, 800, L.text), marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>검색 이력</span>
          {history.length ? <button onClick={() => onDeleteHistory()} style={{ background: 'none', border: 'none', color: L.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>전체 삭제</button> : null}
        </div>
        {history.length === 0
          ? <div style={{ background: L.surface, borderRadius: L.rXl, padding: '20px 16px', textAlign: 'center', ...S.text(14, 400, L.textMuted), boxShadow: L.shadowSm }}>아직 검색 이력이 없어요</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((item) => (
                <div key={item.id} style={{ background: L.surface, borderRadius: L.rLg, padding: 14, display: 'flex', alignItems: 'center', gap: 10, boxShadow: L.shadowSm }}>
                  <button onClick={() => onReplayHistory(item)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={S.text(14, 700, L.text)}>{item.query}</div>
                    <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 2 }}>{item.city || '전남'}</div>
                  </button>
                  <button onClick={() => onDeleteHistory(item.id)} style={{ background: 'none', border: 'none', color: L.textMuted, cursor: 'pointer', fontSize: 12 }}>삭제</button>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}

// ── Nearby place suggestions ──────────────────────────────────────────────────
const NEARBY_POOL: Record<string, Place[]> = {
  순천: [
    { id: 'np-sc1', category: 'cafe', name: '어반플랜트 카페', address: '전남 순천시 향매실로 25', arriveAt: '–', stayMin: 45, description: '도심 속 식물 가득한 감성 카페. 루프탑 포토스팟.', interests: ['카페·디저트', '사진'] },
    { id: 'np-sc2', category: 'history', name: '선암사', address: '전남 순천시 승주읍 선암사길 450', arriveAt: '–', stayMin: 60, description: '천 년 고찰. 무지개 모양 승선교가 인상적.', interests: ['역사 유적', '사진'] },
    { id: 'np-sc3', category: 'market', name: '순천 웃장', address: '전남 순천시 장명로 32', arriveAt: '–', stayMin: 40, description: '오일장. 로컬 채소·젓갈·약재 구경.', interests: ['전통시장', '로컬 골목'] },
    { id: 'np-sc4', category: 'culture', name: '드라마 촬영장', address: '전남 순천시 비례골길 24', arriveAt: '–', stayMin: 50, description: '1960–80년대 거리 재현. TV 드라마 세트장.', interests: ['근현대 문화', '사진'] },
  ],
  여수: [
    { id: 'np-ys1', category: 'cafe', name: '하멜등대 카페', address: '전남 여수시 돌산읍 무술목', arriveAt: '–', stayMin: 50, description: '돌산도 끝자락 등대 옆 오션뷰 카페.', interests: ['카페·디저트', '바다', '사진'] },
    { id: 'np-ys2', category: 'nature', name: '향일암', address: '전남 여수시 돌산읍 향일암로 60', arriveAt: '–', stayMin: 60, description: '남해 일출 명소. 기암절벽 위 암자.', interests: ['전망 좋은 곳', '사진'] },
    { id: 'np-ys3', category: 'market', name: '여수 수산시장', address: '전남 여수시 교동', arriveAt: '–', stayMin: 45, description: '활게장·갈치·문어. 현지인 즐겨 찾는 수산물 골목.', interests: ['전통시장', '해산물'] },
  ],
  목포: [
    { id: 'np-mk1', category: 'cafe', name: '1897 개항문화거리 카페', address: '전남 목포시 항동1가', arriveAt: '–', stayMin: 40, description: '붉은벽돌 근대건축 내부 카페. 포토스팟.', interests: ['카페·디저트', '사진', '근현대 문화'] },
    { id: 'np-mk2', category: 'nature', name: '갓바위', address: '전남 목포시 용해동 갓바위길', arriveAt: '–', stayMin: 35, description: '천연기념물 갓바위와 해안 산책로.', interests: ['자연', '사진'] },
  ],
}

// ── Course Editor ─────────────────────────────────────────────────────────────
function CourseEditor({ course, onClose, onSave }: {
  course: Course; onClose: () => void; onSave: (updated: Course) => void
}) {
  const [places, setPlaces] = useState<Place[]>(course.places)
  const [addOpen, setAddOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const dragIdx = useRef<number | null>(null)
  const startClientY = useRef(0)
  const [activeDrag, setActiveDrag] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const ITEM_H = 74

  const catMeta: Record<PlaceCat, { emoji: string; col: string; bg: string }> = {
    transit: { emoji: '🚉', col: '#2563EB', bg: '#EFF6FF' },
    nature:  { emoji: '🌿', col: '#059669', bg: '#ECFDF5' },
    meal:    { emoji: '🍽', col: '#C2611F', bg: '#FDF0E3' },
    cafe:    { emoji: '☕', col: '#92400E', bg: '#FFFBEB' },
    market:  { emoji: '🛒', col: '#5B21B6', bg: '#F5F3FF' },
    history: { emoji: '🏛', col: '#DC2626', bg: '#FEE2E2' },
    culture: { emoji: '🎨', col: '#0E7490', bg: '#ECFEFF' },
  }

  const handleDown = (e: React.PointerEvent, idx: number) => {
    if ((e.target as HTMLElement).closest('[data-handle]') === null) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragIdx.current = idx; startClientY.current = e.clientY
    setActiveDrag(idx); setOverIdx(idx)
  }
  const handleMove = (e: React.PointerEvent) => {
    if (dragIdx.current === null) return
    const delta = e.clientY - startClientY.current
    if (ghostRef.current) ghostRef.current.style.transform = `translateY(${delta}px)`
    setOverIdx(Math.max(0, Math.min(places.length - 1, dragIdx.current + Math.round(delta / ITEM_H))))
  }
  const handleUp = () => {
    if (dragIdx.current !== null && overIdx !== null && dragIdx.current !== overIdx) {
      setPlaces(prev => {
        const arr = [...prev]
        const [item] = arr.splice(dragIdx.current!, 1)
        arr.splice(overIdx, 0, item)
        return arr
      })
    }
    dragIdx.current = null; setActiveDrag(null); setOverIdx(null)
    if (ghostRef.current) ghostRef.current.style.transform = 'translateY(0)'
  }
  const removePlace = (idx: number) => { if (places.length > 2) setPlaces(prev => prev.filter((_, i) => i !== idx)) }
  const addPlace = (p: Place) => { if (!places.some(x => x.id === p.id)) { setPlaces(prev => [...prev, { ...p, arriveAt: '–' }]); setAddOpen(false) } }
  const handleSave = () => { setSaved(true); setTimeout(() => { onSave({ ...course, places, placeCount: places.length }); onClose() }, 500) }

  const pool = NEARBY_POOL[course.city] ?? []
  const addable = pool.filter(p => !places.some(x => x.id === p.id))
  const ptX = (i: number, n: number) => 24 + (i / Math.max(n - 1, 1)) * 284
  const ptY = (i: number) => 30 + Math.sin(i * 1.1) * 12

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 160, background: L.bg, display: 'flex', flexDirection: 'column' }} className="anim-sheet">
      {/* Header */}
      <div style={{ background: L.surface, borderBottom: `1px solid ${L.borderLight}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: L.rFull, background: L.bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Ic n="close" sz={18} c={L.text} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={S.text(16, 800, L.text)}>코스 편집</div>
          <div style={S.text(12, 400, L.textMuted)}>≡ 드래그로 순서 변경 · × 로 삭제</div>
        </div>
        <button onClick={handleSave} style={{ padding: '10px 20px', borderRadius: L.rFull, background: saved ? L.success : L.dark, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.3s' }}>
          {saved ? <><Ic n="check" sz={14} c="#fff" />저장됨</> : '저장'}
        </button>
      </div>

      {/* Live mini map */}
      <div style={{ background: '#1C1C1E', padding: '12px 20px 8px', flexShrink: 0 }}>
        <div style={{ ...S.text(11, 600, 'rgba(255,255,255,0.5)'), marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>실시간 동선 · {places.length}곳</div>
        <svg width="100%" height={56} viewBox="0 0 332 56">
          {places.length > 1 && <polyline points={places.map((_, i) => `${ptX(i, places.length)},${ptY(i)}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="5 4" />}
          {places.map((_, i) => {
            const x = ptX(i, places.length), y = ptY(i)
            return <g key={i}>
              <circle cx={x} cy={y} r={activeDrag === i ? 9 : 7} fill={activeDrag === i ? '#fff' : i === 0 ? '#fff' : 'rgba(255,255,255,0.2)'} stroke="rgba(255,255,255,0.5)" strokeWidth={activeDrag === i ? 2 : 1.5} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={8} fill={i === 0 ? '#1C1C1E' : 'rgba(255,255,255,0.9)'} fontWeight="800" fontFamily="'Pretendard Variable',Pretendard,sans-serif">{i + 1}</text>
            </g>
          })}
        </svg>
      </div>

      {/* Drag list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }} className="hide-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {places.map((p, i) => {
            const cat = catMeta[p.category]
            const isDragging = activeDrag === i
            const isOver = overIdx === i && activeDrag !== null && activeDrag !== i
            return (
              <div key={p.id}>
                {isOver && overIdx !== null && overIdx < (dragIdx.current ?? 0) && <div style={{ height: 3, background: L.dark, borderRadius: 2, margin: '3px 0' }} />}
                <div onPointerDown={e => handleDown(e, i)} onPointerMove={handleMove} onPointerUp={handleUp}
                  ref={isDragging ? ghostRef : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: L.surface, borderRadius: L.rLg, border: `1.5px solid ${isDragging ? L.dark : isOver ? L.border : L.borderLight}`, marginBottom: 8, boxShadow: isDragging ? L.shadowLg : L.shadowSm, transform: isDragging ? 'scale(1.02)' : 'scale(1)', transition: isDragging ? 'none' : 'all 0.15s', position: 'relative', touchAction: 'none', userSelect: 'none' }}>
                  <div data-handle="true" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 6px', cursor: 'grab', flexShrink: 0, opacity: 0.35 }}>
                    {[0,1,2].map(d => <div key={d} style={{ width: 16, height: 2, background: L.text, borderRadius: 1 }} />)}
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0, position: 'relative' }}>
                    {cat.emoji}
                    <div style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, background: i === 0 ? L.dark : L.border, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: i === 0 ? '#fff' : L.textSec, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{i + 1}</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...S.text(14, 700, L.text), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, background: cat.bg, color: cat.col, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{p.stayMin > 0 ? `${p.stayMin}분` : '거점'}</span>
                      {p.transitMin && p.transitMin > 0 && <span style={S.text(10, 400, L.textMuted)}>→ {p.transitMin}분</span>}
                    </div>
                  </div>
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => removePlace(i)} disabled={places.length <= 2}
                    style={{ width: 30, height: 30, borderRadius: 8, background: places.length <= 2 ? L.bg : '#FEE2E2', border: 'none', cursor: places.length <= 2 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: places.length <= 2 ? 0.35 : 1 }}>
                    <Ic n="close" sz={13} c={places.length <= 2 ? L.textMuted : '#DC2626'} />
                  </button>
                </div>
                {isOver && overIdx !== null && overIdx > (dragIdx.current ?? 0) && <div style={{ height: 3, background: L.dark, borderRadius: 2, margin: '3px 0' }} />}
              </div>
            )
          })}
        </div>
        <button onClick={() => setAddOpen(true)} style={{ width: '100%', padding: '14px', borderRadius: L.rLg, border: `2px dashed ${L.border}`, background: L.surface, color: L.textSec, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>
          <Ic n="plus" sz={18} c={L.textSec} />장소 추가
        </button>
        <div style={{ ...S.text(11, 400, L.textMuted), textAlign: 'center', marginTop: 10 }}>최소 2곳 · 최대 8곳 권장</div>
      </div>

      {addOpen && (
        <Sheet onClose={() => setAddOpen(false)} maxH="60%">
          <div style={{ padding: '0 20px 8px' }}>
            <div style={S.text(17, 800, L.text)}>장소 추가</div>
            <div style={{ ...S.text(13, 400, L.textMuted), marginTop: 3 }}>{course.city} 주변 추천 장소</div>
          </div>
          <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {addable.length === 0
              ? <div style={{ textAlign: 'center', padding: '24px 0', ...S.text(14, 400, L.textMuted) }}>추가할 수 있는 장소가 없어요</div>
              : addable.map(p => {
                  const cat = catMeta[p.category]
                  return (
                    <button key={p.id} onClick={() => addPlace(p)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: L.bg, borderRadius: L.rLg, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cat.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.text(14, 700, L.text)}>{p.name}</div>
                        <div style={{ ...S.text(12, 400, L.textMuted), marginTop: 2 }}>{p.description.slice(0, 36)}…</div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                          {p.interests.slice(0, 2).map(tag => <span key={tag} style={{ fontSize: 10, background: L.border, color: L.textSec, borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{tag}</span>)}
                        </div>
                      </div>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: L.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Ic n="plus" sz={14} c="#fff" />
                      </div>
                    </button>
                  )
                })
            }
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [tab, setTab] = useState<Tab>('home')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardSeed, setWizardSeed] = useState<Partial<Condition> | undefined>()
  const [courseState, setCourseState] = useState<CourseState>('idle')
  const [condition, setCondition] = useState<Condition | undefined>()
  const [activePrefs, setActivePrefs] = useState<TravelPreferences | null>(null)
  const [rawCourses, setRawCourses] = useState<RankedCourse[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [confirmedCourse, setConfirmedCourse] = useState<Course | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [showLogoShowcase, setShowLogoShowcase] = useState(false)
  const loggedIn = Boolean(user && tokenStore.getAccess())

  const refreshAccount = useCallback(async () => {
    if (!tokenStore.getAccess()) return
    try {
      const [me, bookmarks, logs] = await Promise.all([
        api.me(),
        api.bookmarks.list(),
        api.history.list(8),
      ])
      setUser(me)
      setBookmarkItems(unwrapList(bookmarks, 'bookmarks'))
      setHistory(unwrapList(logs, 'history'))
    } catch {
      tokenStore.clear()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    if (tokenStore.getAccess()) {
      refreshAccount().then(() => setScreen('main')).catch(() => undefined)
    }
  }, [refreshAccount])

  const applyAuth = async (response: { user: AuthUser; accessToken: string; refreshToken: string }) => {
    tokenStore.set(response.accessToken, response.refreshToken)
    setUser(response.user)
    setAuthError(null)
    await refreshAccount()
    setScreen('main')
  }

  const handleLogin = async (email: string, password: string) => {
    setAuthError(null)
    try {
      await applyAuth(await api.login(email, password))
    } catch (error) {
      setAuthError(error instanceof ApiError || error instanceof Error ? error.message : '로그인에 실패했습니다')
      throw error
    }
  }

  const handleSignup = async (email: string, name: string, password: string) => {
    setAuthError(null)
    try {
      await applyAuth(await api.signup(email, name, password))
    } catch (error) {
      setAuthError(error instanceof ApiError || error instanceof Error ? error.message : '회원가입에 실패했습니다')
      throw error
    }
  }

  const handleLogout = async () => {
    await api.logout()
    tokenStore.clear()
    setUser(null)
    setBookmarkItems([])
    setHistory([])
  }

  const handleComplete = useCallback(async (cond: Condition) => {
    const prefs = conditionToPreferences(cond)
    setCondition(cond)
    setActivePrefs(prefs)
    setWizardOpen(false)
    setCourseState('loading')
    setTab('course')
    try {
      const response = await api.recommend(prefs)
      setRawCourses(response.courses)
      setCourses(response.courses.map(rankedToUiCourse))
      setFallbackReason(response.fallbackReason ?? null)
      setCourseState(response.source === 'demo' ? 'demo' : response.courses.length ? 'success' : 'error')
      if (tokenStore.getAccess()) {
        await api.history.record(prefs.summary, prefs).catch(() => undefined)
        await refreshAccount()
      }
    } catch {
      setCourses([])
      setFallbackReason('서버 연결에 실패했습니다.')
      setCourseState('error')
    }
  }, [refreshAccount])

  const openCourse = async (course: Course) => {
    setSelectedCourse(course)
    const raw = rawCourses.find((item) => item.id === course.id)
    if (!raw || !activePrefs) return
    try {
      const response = await api.explain(activePrefs, raw)
      setSelectedCourse((current) => current && current.id === course.id ? { ...current, reason: response.reason.summary } : current)
      setCourses((current) => current.map((item) => item.id === course.id ? { ...item, reason: response.reason.summary } : item))
    } catch {
      // 규칙 이유 유지
    }
  }

  const toggleBookmark = async (course: Course) => {
    if (!loggedIn) {
      setTab('mytravel')
      setSelectedCourse(null)
      return
    }
    const saved = bookmarkItems.some((item) => item.courseId === course.id)
    try {
      if (saved) await api.bookmarks.remove(course.id)
      else await api.bookmarks.add({ courseId: course.id, courseName: course.title, city: course.city })
      await refreshAccount()
    } catch {
      window.alert('북마크를 저장하지 못했습니다. 다시 로그인해주세요.')
    }
  }

  const replayHistory = (item: HistoryItem) => {
    if (item.preferences) {
      void handleComplete(preferencesToCondition(item.preferences, condition))
      return
    }
    const walkLevel = item.pace === 'full' ? '많이 걷기' : item.pace === 'easy' ? '적게 걷기' : '보통'
    void handleComplete({
      ...(condition ?? DEFAULT_CONDITION),
      region: item.city || condition?.region || '순천',
      departure: condition?.departure || `${item.city || '순천'}역`,
      walkLevel,
    })
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', background: '#E8EEF4' }}>
      <div style={{ width: '100%', maxWidth: 520, height: '100%', position: 'relative', overflow: 'hidden', background: L.bg, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>
        {showLogoShowcase && <LogoShowcase onClose={() => setShowLogoShowcase(false)} />}
        {!showLogoShowcase && screen === 'splash' && <Splash onDone={() => setScreen(tokenStore.getAccess() ? 'main' : 'login')} />}
        {screen === 'login' && <Login onLogin={handleLogin} onSignup={handleSignup} onGuest={() => setScreen('main')} error={authError} />}
        {screen === 'main' && (
          <>
            <div style={{ position: 'absolute', inset: 0 }}>
              {tab === 'home' && <HomeScreen onPlan={(seed) => { setWizardSeed(seed); setWizardOpen(true); }} courses={courses} />}
              {tab === 'course' && <CourseListScreen state={courseState} condition={condition} courses={courses} fallbackReason={fallbackReason} onSelect={(course) => void openCourse(course)} onRetry={() => condition && void handleComplete(condition)} onPlan={() => setWizardOpen(true)} />}
              {tab === 'map' && <MapScreen confirmedCourse={confirmedCourse} onDetail={(course) => void openCourse(course)} onCancelConfirm={() => setConfirmedCourse(null)} />}
              {tab === 'mytravel' && <MyTravelScreen loggedIn={loggedIn} user={user} onLogin={() => setScreen('login')} onLogout={() => void handleLogout()} bookmarkItems={bookmarkItems} history={history} onSelectCourse={(course) => void openCourse(course)} onReplayHistory={replayHistory} onDeleteHistory={(id) => void api.history.delete(id).then(refreshAccount)} courses={courses} />}
            </div>
            <TabBar active={tab} onChange={setTab} />
            {wizardOpen && <PlanWizard initial={wizardSeed} onClose={() => { setWizardOpen(false); setWizardSeed(undefined); }} onComplete={(cond) => void handleComplete(cond)} />}
            {selectedCourse && <CourseDetailScreen course={selectedCourse} onBack={() => setSelectedCourse(null)} onBookmark={() => void toggleBookmark(selectedCourse)} bookmarked={bookmarkItems.some((item) => item.courseId === selectedCourse.id)} onEdit={() => setEditorOpen(true)} onConfirm={() => { setConfirmedCourse(selectedCourse); setSelectedCourse(null); setTab('map') }} />}
            {selectedCourse && editorOpen && <CourseEditor course={selectedCourse} onClose={() => setEditorOpen(false)} onSave={updated => { setSelectedCourse(updated); setCourses(prev => prev.map(c => c.id === updated.id ? updated : c)); setEditorOpen(false) }} />}
          </>
        )}
      </div>
    </div>
  )
}
