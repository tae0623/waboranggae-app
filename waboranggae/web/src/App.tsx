import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiError, tokenStore, unwrapList, browserSessionStatus, restoreBrowserLogin, setAutoLogin, type AuthUser, type BookmarkItem, type HistoryItem, type HotPlace, type RankedCourse, type TravelPreferences } from './api'
import { conditionToPreferences, preferencesToCondition, rankedToUiCourse } from './mappers'
import { CourseRouteMap } from './CourseRouteMap'
import { useWeather } from './useWeather'
import { SocialLoginButtons } from './SocialLoginButtons'
import { AccountActions } from './AccountActions'
import { PrivacyConsent } from './PrivacyConsent'
import brandMark from './assets/brand-mark.svg'
import splashMap from './assets/splash-map.svg'
import { PlanWizard, defaultCondition } from './PlanWizard'
import { HOME_SCENERY_URL, todayKorea, visibleHomePlaces, hotPlaceSeed, acceptedCourses, canPreviewCourse, formatMinutes } from './parity'
import { useDialogs } from './Dialogs'
import { RouteSummary, SourceFooter } from './RouteSummary'
import './parity.css'
import { ACCOUNT_CONSENT_TEXT, needsPrivacyConsent } from '../../src/domain/privacyNotice'

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
  startTime: string; endTime: string; endTimeLimited?: boolean
  duration: number; meal: string; meals: string[]; walkLevel: string; companion: string
  interests: string[]; purpose: string[]; atmosphere: string[]
  pace: string; isLocal: boolean; transitOnly: boolean
  transitModes: string[]
  requiredPlace?: HotPlace; requiredContentId?: string; requiredPlaceName?: string
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
  imageUrl?: string
  id: string; category: PlaceCat; name: string; address: string
  arriveAt: string; stayMin: number; description: string
  interests: string[]
  transitTo?: string; transitMin?: number; transitMode?: 'bus' | 'walk' | 'shuttle'
  transitSteps?: TransitStep[]
}
interface Locker { name: string; distanceM: number; available: boolean }
interface ScoreItem { label: string; value: number; weight: number }
interface WalkItem { label: string; stars: number; detail: string; value?:number }
export interface Course {
  apiCourse?: RankedCourse
  id: string; city: string; title: string; subtitle: string
  score: number; walkFitScore: number
  prefScore: number; timeScore: number; completionScore: number
  hours: number; distanceKm: number; placeCount: number
  walkMin: number; transitMin: number; transferCount: number
  imageUrl: string; tags: string[]; reason: string
  dataSource: 'real' | 'demo' | 'ai'; routeSource: 'kakao' | 'estimated' | 'mixed'
  places: Place[]; locker: Locker[]
  scoreBreakdown: ScoreItem[]; walkBreakdown: WalkItem[]
}
const DEFAULT_CONDITION = defaultCondition()

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
    kakao: { bg: '#EFF6FF', c: '#2563EB', t: '카카오 조회' },
    estimated: { bg: 'rgba(255,255,255,0.85)', c: '#636366', t: '예상' },
    mixed: { bg: '#FFF7ED', c: '#9A3412', t: '혼합' },
  }
  const s = m[type] ?? { bg: '#F2F2F7', c: '#636366', t: type }
  return <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.c, borderRadius: 6, padding: '2px 7px' }}>{s.t}</span>
}

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

function Splash({onDone}:{onDone:()=>void}) {
  const done=useRef(onDone);done.current=onDone;
  useEffect(()=>{const timer=setTimeout(()=>done.current(),1800);return()=>clearTimeout(timer);},[]);
  return <div style={{position:'absolute',inset:0,background:'#f0fdf4',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:28}}>
    <img src={splashMap} alt="전남 광주 지도를 걷는 사람" style={{width:'75%',maxWidth:300,height:300,objectFit:'contain'}}/>
    <h1 style={{fontSize:36,color:'#174438',margin:0}}>뚜버기</h1>
    <p style={{fontSize:13,color:'#43785c'}}>전남을 걷는 가장 쉬운 방법</p>
  </div>;
}

function readRememberedEmail(){try{return localStorage.getItem('ddubugi.rememberedEmail')||''}catch{return ''}}
function rememberEmail(value:string|null){try{if(value)localStorage.setItem('ddubugi.rememberedEmail',value);else localStorage.removeItem('ddubugi.rememberedEmail')}catch{/* Storage can be disabled by the browser. */}}

function Login({ onLogin, onSignup, onGuest, error, onAuthenticated }: {
  onAuthenticated: (result: import('./api').AuthResponse) => Promise<void>
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, name: string, password: string) => Promise<void>
  onGuest: () => void
  error?: string | null
}) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [rememberId,setRememberId]=useState(()=>Boolean(readRememberedEmail()))
  const [automatic,setAutomatic]=useState(false),[canPersist,setCanPersist]=useState(false)
  const [email, setEmail] = useState(()=>readRememberedEmail()); const [pw, setPw] = useState(''); const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const backdrop = HOME_SCENERY_URL
  const [photoLoaded,setPhotoLoaded]=useState(false)
  useEffect(()=>{let active=true;browserSessionStatus().then(status=>{if(active){setCanPersist(status.supported);setAutoLogin(false)}});return()=>{active=false}},[])
  const submit = async () => {
    if (mode === 'signup' && !privacyConsent) return
    rememberEmail(rememberId?email.trim():null)
    setAutoLogin(automatic&&canPersist)
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


  return (
    <div style={{ position: 'absolute', inset: 0, background: '#14532D', overflowY: 'auto' }} className="hide-scroll">
      {backdrop ? (
        <img src={backdrop} onLoad={()=>setPhotoLoaded(true)} onError={()=>setPhotoLoaded(false)} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
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
            {mode==='signup' ? <label style={{color:'white',fontSize:12,lineHeight:1.7}}><input type="checkbox" checked={privacyConsent} onChange={e=>setPrivacyConsent(e.target.checked)} /> {ACCOUNT_CONSENT_TEXT} <a href="/legal/privacy" target="_blank" rel="noreferrer" style={{color:'white'}}>개인정보 안내</a></label> : null}
            {mode==='login'&&<div className="login-options"><label><input type="checkbox" checked={rememberId} onChange={e=>{setRememberId(e.target.checked);if(!e.target.checked)rememberEmail(null)}}/>아이디 저장</label><label title={canPersist?'개인 기기에서만 사용하세요.':'고정 팀 웹 주소에서 이용할 수 있어요.'}><input type="checkbox" checked={automatic} disabled={!canPersist} onChange={e=>{setAutomatic(e.target.checked);setAutoLogin(e.target.checked)}}/>자동 로그인</label></div>}
            <Btn frost onClick={submit} loading={loading}>{mode === 'login' ? '로그인' : '회원가입'}</Btn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} /><span style={S.text(13, 400, 'rgba(255,255,255,0.58)')}>또는</span><div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} />
          </div>
          <SocialLoginButtons onAuthenticated={onAuthenticated} />
          {photoLoaded&&<p className="source-footer" style={{color:'rgba(255,255,255,.65)',textAlign:'center'}}>배경 사진: Unsplash</p>}
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
            { label: `⏱ ${formatMinutes(c.hours*60)}`, col: L.dark },
            { label: `🚶 ${c.walkMin}분`, col: L.teal },
            { label: `🔄 ${c.transferCount}회`, col: L.textSec },
          ].map(t => (
            <span key={t.label} style={{ fontSize: 11, fontWeight: 700, color: t.col, background: L.bg, borderRadius: 8, padding: '4px 9px' }}>{t.label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatHotMetric(place: HotPlace) {
  if (place.source === 'festival' || place.category === '축제·행사') {
    return place.periodShort || place.statusLabel || '행사'
  }
  if (place.visitors > 0) return (place.metricLabel || '지표') + ' ' + place.visitors.toLocaleString()
  return place.metricLabel || '관광정보'
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
            <div style={{ fontSize: 16, fontWeight: 900, color: '#16A34A', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.25, overflowWrap: 'anywhere' }}>{metricSide}</div>
            <div style={{ fontSize: 11, color: L.textMuted, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{metricSideLabel}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '22px 20px 0' }}>
        {place.metricNote ? <details className="source-footer"><summary>지표 기준</summary><p>{place.metricNote}</p></details> : null}
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
          {place.homepage && /^https?:\/\//i.test(place.homepage) ? (
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
        <button onClick={onPlan} disabled={!/^\d{1,20}$/.test(place.id.replace(/^festival-/,''))} className="card-press" style={{ width: '100%', background: L.dark, color: '#fff', border: 'none', borderRadius: L.rXl, padding: '18px', fontSize: 15, fontWeight: 700, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Ic n="search" sz={18} c="#fff" />
          이 장소 포함해서 코스 만들기
        </button>
        {!/^\d{1,20}$/.test(place.id.replace(/^festival-/,''))&&<p className="muted">장소 정보를 확인한 후 코스를 만들 수 있어요.</p>}
        <p className="source-footer">관광정보 © 한국관광공사 · 사진: {place.imageCredit||'© 한국관광공사'}</p>
      </div>
    </div>
  )
}

function HomeScreen({ onPlan, courses }: { onPlan: (seed?: Partial<Condition>) => void; courses: Course[] }) {
  const hero = {img:HOME_SCENERY_URL,title:'배경 사진: Unsplash'};
  const [selectedHotPlace, setSelectedHotPlace] = useState<HotPlace | null>(null)
  const [hotPlaces, setHotPlaces] = useState<HotPlace[]>([])
  const [hotStatus, setHotStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [hotUpdated, setHotUpdated] = useState('불러오는 중')

  useEffect(() => {
    let cancelled = false
    api.hotPlaces()
      .then((payload) => {
        if (cancelled) return
        const visible=visibleHomePlaces(payload.places ?? []);
        setHotPlaces(visible)
        setHotStatus(visible.length ? 'ready' : 'empty')
        setHotUpdated(payload.fetchedAt ? new Date(payload.fetchedAt).toLocaleDateString('ko-KR') : '오늘')
      })
      .catch(() => {
        if (!cancelled) setHotStatus('error')
      })
    return () => { cancelled = true }
  }, [])

  const planFromPlace = (place: HotPlace) => onPlan(hotPlaceSeed(place))

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH }} className="hide-scroll">

      {/* ── 히어로 영역 ── */}
      <div style={{ position: 'relative', height: 400 }}>
        {hero.img ? <img src={hero.img} alt={hero.title || '한국관광공사 관광사진'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#174438,#3F6A68)'}} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.72) 100%)' }} />

        {/* 앱 로고 */}
        <div style={{ position: 'absolute', top: 52, left: 20, right: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img data-testid="home-brand-mark" src={brandMark} alt="전남 지도를 걷는 사람" width={40} height={40} style={{ display: 'block', borderRadius: 12, background: '#F0FDF4', flexShrink: 0 }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>뚜버기</span>
          </div>
        </div>

        {/* 히어로 텍스트 */}
        <div style={{ position: 'absolute', bottom: 96, left: 20, right: 20 }} className="anim-fade-up">
          <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 10, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>전남을<br />걸어봐요</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>가볍게 떠나는 전남 여행</div>
        </div>

        {/* 코스 만들기 CTA — 히어로 하단에 띄워진 흰 카드 */}
        <button onClick={() => onPlan()} className="card-press" style={{ position: 'absolute', bottom: -28, left: 20, right: 20, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', borderRadius: L.rXl, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', border: 'none', boxShadow: L.shadowLg, textAlign: 'left' }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: L.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Ic n="search" sz={20} c="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={S.text(15, 700, L.text)}>여행 코스 만들기</div>
            <div style={S.text(12, 400, L.textMuted)}>출발지 · 일정 · 여행 취향</div>
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
            <div style={{ fontSize: 20, fontWeight: 900, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>전남 여행 소식</div>

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
      <div style={{padding:'0 20px 20px'}}><SourceFooter home /></div>
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
  const filters = ['추천순', '적게 걷기', '맛집', '자연', '카페', '역사', '로컬']
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
      <div style={{padding:'0 20px 20px'}}><SourceFooter/></div>
    </div>
  )
  if (state === 'error') return <div style={{position:'absolute',inset:0,background:L.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24}}><Empty icon="info" title="코스를 불러오지 못했어요" desc={fallbackReason||'잠시 후 다시 시도해 주세요.'} cta="다시 시도" onCta={onRetry}/><button onClick={onPlan} style={{padding:12,border:0,borderRadius:12}}>조건 변경</button></div>
  if (state === 'idle') return <div style={{ position: 'absolute', inset: 0, background: L.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Empty icon="list" title="추천 코스가 없어요" desc="홈에서 여행 조건을 설정해 보세요." cta="코스 만들기" onCta={onPlan} /></div>

  return (
    <div style={{ position: 'absolute', inset: 0, background: L.bg, overflowY: 'auto', paddingBottom: L.tabH }} className="hide-scroll">
      <div style={{ background: L.surface, padding: '52px 20px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        {condition && <div style={{ ...S.text(13, 500, L.textMuted), marginBottom: 2 }}>{condition.departure} → {condition.region} · {condition.date} {condition.startTime} 시작{condition.endTimeLimited ? ` · ${condition.endTime}까지` : ''}</div>}
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
function CourseDetailScreen({ course: c, onBack, onBookmark, bookmarked, onEdit, onConfirm, preferences, routingBusy, routingError, onRefresh, onHistory }: {
  course: Course; onBack: () => void; onBookmark: () => void; bookmarked: boolean; onEdit: () => void; onConfirm: () => void
  preferences:TravelPreferences|null; routingBusy:boolean; routingError:string; onRefresh:()=>void; onHistory:()=>void
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
  const efficiency = Math.round((c.apiCourse?.scoreFacts?.stayRatio??0)*100)
  const totalMin = c.apiCourse?.timeBreakdown?.totalMinutes ?? Math.round(c.hours*60)
  const totalH = Math.floor(totalMin / 60); const totalM = totalMin % 60

  // Never represent unrelated stock photography as the recommended destination.
  const thumbUrls = [...new Set([c.imageUrl, ...(c.apiCourse?.places.map(p=>p.imageUrl)||[])].filter((value):value is string=>Boolean(value)))].slice(0,4)

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

      <RouteSummary course={c.apiCourse} preferences={preferences} busy={routingBusy} error={routingError} onRefresh={onRefresh}/>
      <button onClick={onHistory} style={{margin:'0 20px 12px',padding:12,border:'1px solid #e4e4e9',borderRadius:12,background:'white',color:'#1c1c1e'}}>이 여행 조건 저장</button>
      {/* Metrics row — reference style */}
      <div style={{ background: L.surface, padding: '16px 20px', display: 'flex', gap: 0, marginBottom: 12 }}>
        {[
          { label: '현지 예상시간', value: formatMinutes(c.hours*60), valueCol: L.dark },
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
                  <span style={S.text(13,700,L.text)}>{w.value ?? w.stars*20} / 100</span>
                </div>
              ))}
            </div>
            <div style={{ background: L.surface, borderRadius: L.rXl, padding: 16, boxShadow: L.shadowSm }}>
              <div style={{ ...S.text(14, 700, L.text), marginBottom: 12 }}>⏱ 시간 적합도</div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div><div style={S.text(11, 500, L.textMuted)}>선택한 종료 제한</div><div style={{ fontSize: 20, fontWeight: 800, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{c.apiCourse?.timeBreakdown?.requestedMinutes ? formatMinutes(c.apiCourse.timeBreakdown.requestedMinutes) : '없음'}</div></div>
                <div style={{ color: L.textMuted, fontSize: 20 }}>≈</div>
                <div><div style={S.text(11, 500, L.textMuted)}>예상</div><div style={{ fontSize: 20, fontWeight: 800, color: L.teal, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>{totalH}시간 {totalM}분</div></div>
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
          <button onClick={onConfirm} disabled={!c.apiCourse || !canPreviewCourse(c.apiCourse)} className="card-press" style={{ height: 44, borderRadius: L.rFull, background: '#16A34A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 18px', flexShrink: 0, boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}>
            <span style={{ fontSize: 14 }}>🗺</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", whiteSpace: 'nowrap' }}>{c.apiCourse?.constraintPassed===false?'동선 미리보기':'이 코스로 동선 확인'}</span>
          </button>
        </div>
        <SourceFooter/>
      </div>
    </div>
  )
}


function MapScreen({ confirmedCourse, onDetail, onCancelConfirm, courses, onSelect, preferences, routingBusy, routingError, onRefresh }: {
  confirmedCourse: Course | null; onDetail: (c: Course) => void; onCancelConfirm: () => void
  courses:Course[]; onSelect:(c:Course)=>void; preferences:TravelPreferences|null; routingBusy:boolean; routingError:string; onRefresh:()=>void
}) {
  const weatherTip = useWeather(confirmedCourse?.apiCourse, preferences)
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 2, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '0.04em' }}>여행 안내 · {weatherTip.condition}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14532D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.4 }}>{weatherTip.msg}</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>🗺</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: L.text, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '-0.02em' }}>확정된 코스가 없어요</div>
        <div style={{ fontSize: 14, color: L.textMuted, lineHeight: 1.7, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>추천 코스 탭에서 마음에 드는 코스를<br />"이 코스로 동선 확인" 버튼으로 확정해 보세요.</div>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', marginBottom: 2, fontFamily: "'Pretendard Variable', Pretendard, sans-serif", letterSpacing: '0.04em' }}>여행 안내 · {weatherTip.condition}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#14532D', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", lineHeight: 1.4 }}>{weatherTip.msg}</div>
            </div>
          </div>
        </div>

        {courses.length>1&&<div className="course-selector" aria-label="동선 코스 선택">{courses.map((course,i)=><button key={course.id} aria-pressed={course.id===c.id} onClick={()=>onSelect(course)}>{i+1}. {course.title}</button>)}</div>}
        {/* 코스 헤더 */}
        <div style={{ background: L.surface, padding: '0 16px 16px', borderBottom: `1px solid ${L.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#16A34A', background: '#DCFCE7', borderRadius: 6, padding: '2px 8px' }}>선택한 코스</span>
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

        <RouteSummary course={c.apiCourse} preferences={preferences} busy={routingBusy} error={routingError} onRefresh={onRefresh} hideWeather/>
        <div style={{margin:16}}><CourseRouteMap key={c.id} course={c.apiCourse} /></div>

        <button onClick={()=>onDetail(c)} style={{margin:'0 16px',padding:12,border:0,borderRadius:12}}>코스 상세 보기</button>
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
                    {!isLast && <div style={{ width: 2, flex: 1, minHeight: 48, background: `linear-gradient(${col}, ${catColor[c.places[i+1]?.category ?? 'transit'] ?? L.dark})`, opacity: 0.25, margin: '4px 0' }} />}
                  </div>
                  {/* 장소 정보 */}
                  <div style={{ flex: 1, paddingBottom: 4 }}>
                    <div style={{ background: L.surface, borderRadius: L.rLg, padding: '12px 14px', boxShadow: L.shadowSm }}>
                      {p.imageUrl&&<img src={p.imageUrl} alt={p.name} loading="lazy" style={{width:'100%',height:150,objectFit:'cover',borderRadius:12,marginBottom:10}}/>}
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
        <SourceFooter/>
        </div>
      </div>
    </div>
  )
}

function MyTravelScreen({ loggedIn, user, onLogin, onLogout, onDeleted, bookmarkItems, history, onSelectCourse, onReplayHistory, onDeleteHistory, courses }: {
  loggedIn: boolean; user: AuthUser | null; onLogin: () => void; onLogout: () => void; onDeleted:()=>void;
  bookmarkItems: BookmarkItem[]; history: HistoryItem[];
  onSelectCourse: (c: Course) => void; onReplayHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id?: string) => void; courses: Course[]
}) {
  const bm = bookmarkItems.map((item) => {
    const course = courses.find((c) => c.id === item.courseId) ?? (item.snapshot ? rankedToUiCourse(item.snapshot) : undefined)
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
            <div style={{ ...S.text(12, 400, 'rgba(255,255,255,0.55)'), marginTop: 2 }}>{user?.email?.endsWith('@social.waboranggae.invalid') ? '소셜 로그인 계정' : user?.email || ''}</div>
          </div>
          <button onClick={onLogout} style={{ padding: '7px 14px', borderRadius: L.rFull, background: 'rgba(255,255,255,0.12)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>로그아웃</button>
        </div>
        <AccountActions onDeleted={onDeleted} />
        <div style={{ ...S.text(16, 800, L.text), marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          북마크 <span style={{ fontSize: 13, fontWeight: 600, color: L.textMuted, background: L.border, padding: '2px 8px', borderRadius: 20 }}>{bm.length}</span>
        </div>
        {bm.length === 0
          ? <div style={{ background: L.surface, borderRadius: L.rXl, padding: '20px 16px', textAlign: 'center', ...S.text(14, 400, L.textMuted), marginBottom: 20, boxShadow: L.shadowSm }}>북마크한 코스가 없어요</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {bm.map(({ item, course }) => <div key={item.id} onClick={() => course && onSelectCourse(course)} style={{ background: L.surface, borderRadius: L.rXl, padding: 14, cursor: course ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 12, boxShadow: L.shadowSm, opacity: course ? 1 : 0.7 }}>
                <img src={course?.imageUrl || brandMark} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...S.text(14, 700, L.text), overflowWrap: 'anywhere' }}>{item.courseName}</div>
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
// ── Course Editor ─────────────────────────────────────────────────────────────
function CourseEditor({ course, onClose, onSave, pool }: {
  course: Course; onClose: () => void; onSave: (updated: Course) => Promise<void>; pool: Place[]
}) {
  const [places, setPlaces] = useState<Place[]>(course.places)
  const [addOpen, setAddOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

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
    if (places[idx]?.category === 'transit' || saved) return
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
    setOverIdx(Math.max(places[0]?.category === 'transit' ? 1 : 0, Math.min(places.length - 1, dragIdx.current + Math.round(delta / ITEM_H))))
  }
  const handleUp = () => {
    if (dragIdx.current !== null && overIdx !== null && dragIdx.current !== overIdx) {
      setPlaces(prev => {
        const arr = [...prev]
        const [item] = arr.splice(dragIdx.current!, 1)
        if (item) arr.splice(overIdx, 0, item)
        return arr
      })
    }
    dragIdx.current = null; setActiveDrag(null); setOverIdx(null)
    if (ghostRef.current) ghostRef.current.style.transform = 'translateY(0)'
  }
  const removePlace = (idx: number) => { if (!saved && places[idx]?.category !== 'transit' && places.length > 2) setPlaces(prev => prev.filter((_, i) => i !== idx)) }
  const addPlace = (p: Place) => { if (!places.some(x => x.id === p.id)) { setPlaces(prev => [...prev, { ...p, arriveAt: '–' }]); setAddOpen(false) } }
  const handleSave = async () => { setSaved(true); setSaveError(''); try { await onSave({ ...course, places, placeCount: places.length }); onClose() } catch (error) { setSaveError(error instanceof Error ? error.message : '편집 검증 실패'); } finally { setSaved(false); } }

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
        <button disabled={saved} onClick={()=>void handleSave()} style={{ padding: '10px 20px', borderRadius: L.rFull, background: saved ? L.success : L.dark, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.3s' }}>
          {saved ? '경로 검증 중…' : '검증 후 적용'}
        </button>
      </div>

      {saveError && <p role="alert" style={{padding:'8px 16px',color:L.error}}>{saveError}</p>}
      <p style={{padding:'4px 16px',fontSize:12}}>순서 미리보기입니다. 적용 시 이동 시간·일정·점수를 다시 계산합니다. 출발지는 고정됩니다.</p>
      {/* Order preview, not a geographic map */}
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
                    <div style={{ ...S.text(14, 700, L.text), overflowWrap: 'anywhere' }}>{p.name}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10, background: cat.bg, color: cat.col, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{p.stayMin > 0 ? `${p.stayMin}분` : '거점'}</span>
                      {p.transitMin && p.transitMin > 0 && <span style={S.text(10, 400, L.textMuted)}>→ {p.transitMin}분</span>}
                    </div>
                  </div>
                  <button onPointerDown={e => e.stopPropagation()} onClick={() => removePlace(i)} disabled={places.length <= 2 || p.category === 'transit' || saved}
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
export default function App({ onBackState }: { onBackState?: (canGoBack: boolean) => Promise<void> } = {}) {
  const {ask,dialog}=useDialogs()
  const recommendationVersion=useRef(0)
  const routingPending=useRef(new Set<string>())
  const [routingStatus,setRoutingStatus]=useState<Record<string,{busy:boolean;error:string}>>({})
  const [coursePrefs,setCoursePrefs]=useState<Record<string,TravelPreferences>>({})
  const [screen, setScreen] = useState<Screen>('splash')
  const [tab, setTab] = useState<Tab>('home')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardSeed, setWizardSeed] = useState<Partial<Condition> | undefined>()
  const [courseState, setCourseState] = useState<CourseState>('idle')
  const [condition, setCondition] = useState<Condition | undefined>()
  const [activePrefs, setActivePrefs] = useState<TravelPreferences | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [fallbackReason, setFallbackReason] = useState<string | null>(null)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [confirmedCourse, setConfirmedCourse] = useState<Course | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const loggedIn = Boolean(user && tokenStore.getAccess())

  useEffect(() => {
    void onBackState?.(editorOpen || Boolean(selectedCourse) || wizardOpen || tab !== 'home' || screen === 'login');
    const back = () => {
      if (editorOpen) setEditorOpen(false)
      else if (selectedCourse) setSelectedCourse(null)
      else if (wizardOpen) setWizardOpen(false)
      else if (screen === 'login') setScreen('main')
      else setTab('home')
    };
    window.addEventListener('waboranggae:back', back);
    return () => window.removeEventListener('waboranggae:back', back);
  }, [editorOpen, selectedCourse, wizardOpen, tab, screen, onBackState]);

  const refreshAccount = useCallback(async () => {
    const requestToken = tokenStore.getAccess();
    const version = tokenStore.version();
    if (!requestToken) return
    try {
      const me=await api.me()
      if (tokenStore.version() !== version) return
      setUser(me)
      if(needsPrivacyConsent(me)){setBookmarkItems([]);setHistory([]);return;}
      const [bookmarks, logs] = await Promise.all([
        api.bookmarks.list(),
        api.history.list(8),
      ])
      if (tokenStore.version() !== version) return
      setUser(me)
      setBookmarkItems(unwrapList(bookmarks, 'bookmarks'))
      setHistory(unwrapList(logs, 'history'))
    } catch (error) {
      if (!tokenStore.getAccess()) { setUser(null); setBookmarkItems([]); setHistory([]); return; }
      if (tokenStore.version() !== version) return
      // A temporary API/network error must not delete a real user's session.
      if (!(error instanceof ApiError) || error.status !== 401) return
      await tokenStore.clear()
      setUser(null)
      setBookmarkItems([])
      setHistory([])
    }
  }, [])

  useEffect(() => {
    let active=true;
    const restore=async()=>{await browserSessionStatus();if(tokenStore.getAccess()||await restoreBrowserLogin()){await refreshAccount();if(active)setScreen('main')}};
    void restore().catch(()=>undefined);return()=>{active=false};
  }, [refreshAccount])

  const applyAuth = useCallback(async (response: { user: AuthUser; accessToken: string; refreshToken: string }) => {
    await tokenStore.set(response.accessToken, response.refreshToken)
    setUser(response.user)
    setAuthError(null)
    await refreshAccount()
    setScreen('main')
  },[refreshAccount])

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

  const clearAccount = async () => {
    ++recommendationVersion.current
    await tokenStore.clear()
    setUser(null);setBookmarkItems([]);setHistory([]);setCourses([])
    setCondition(undefined);setActivePrefs(null);setSelectedCourse(null);setConfirmedCourse(null)
    setCoursePrefs({});setRoutingStatus({});setEditorOpen(false);setWizardOpen(false);setWizardSeed(undefined)
    setCourseState('idle');setTab('home')
  }
  const handleLogout = async () => {
    if(!await ask('로그아웃','이 브라우저에서 로그아웃할까요?','로그아웃'))return
    try { await api.logout(); await clearAccount() }
    catch(error){await ask('로그아웃 실패',error instanceof Error?error.message:'연결을 확인하고 다시 시도해 주세요.')}
  }
  const handleComplete = async (cond: Condition) => {
    let prefs:TravelPreferences
    try {prefs=conditionToPreferences(cond)}catch(error){await ask('여행 조건 확인',error instanceof Error?error.message:'조건을 확인해 주세요.');return}
    const version=++recommendationVersion.current
    setCondition(cond);setActivePrefs(prefs);setWizardOpen(false);setWizardSeed(undefined)
    setSelectedCourse(null);setConfirmedCourse(null);setEditorOpen(false)
    setCourses([]);setCoursePrefs({});setRoutingStatus({})
    setCourseState('loading');setTab('course')
    try {
      const response=await api.recommend(prefs)
      if(version!==recommendationVersion.current)return
      const accepted=acceptedCourses(response.source,response.courses)
      setCourses(accepted.map(rankedToUiCourse))
      setCoursePrefs(Object.fromEntries(accepted.map(c=>[c.id,prefs])))
      setFallbackReason(response.fallbackReason??null)
      setCourseState(accepted.length?'success':'error')
      if(!accepted.length)setFallbackReason(response.fallbackReason||'조건에 맞는 코스를 찾지 못했어요. 장소나 취향을 바꿔 다시 시도해 주세요.')
    } catch(error) {
      if(version!==recommendationVersion.current)return
      setCourses([]);setFallbackReason(error instanceof Error?error.message:'서버 연결에 실패했습니다.');setCourseState('error')
    }
  }
  const replaceCourse=(raw:RankedCourse)=>{
    const updated=rankedToUiCourse(raw)
    setCourses(prev=>prev.map(c=>c.id===raw.id?updated:c))
    setSelectedCourse(prev=>prev?.id===raw.id?updated:prev)
    setConfirmedCourse(prev=>prev?.id===raw.id?updated:prev)
  }
  const refreshRoute=async (course:Course,force=false)=>{
    const prefs=coursePrefs[course.id],raw=course.apiCourse
    if(!prefs || !raw || routingPending.current.has(course.id))return
    if(!force && raw.routingCheckedAt && Date.now()-Date.parse(raw.routingCheckedAt)<300000)return
    const version=recommendationVersion.current
    routingPending.current.add(course.id);setRoutingStatus(prev=>({...prev,[course.id]:{busy:true,error:''}}))
    try {
      const result=await api.refreshRoute(prefs,raw)
      if(version!==recommendationVersion.current)return
      if(result.course.id!==raw.id || !canPreviewCourse(result.course))throw new Error('이동 정보가 올바르지 않아 기존 코스를 유지했어요.')
      replaceCourse(result.course)
      setRoutingStatus(prev=>({...prev,[course.id]:{busy:false,error:''}}))
    } catch(error){if(version===recommendationVersion.current)setRoutingStatus(prev=>({...prev,[course.id]:{busy:false,error:error instanceof Error?error.message:'이동 정보를 확인하지 못했어요.'}}))}
    finally{routingPending.current.delete(course.id)}
  }
  const openCourse = (course:Course) => {
    setSelectedCourse(course);setActivePrefs(coursePrefs[course.id]??null)
    void refreshRoute(course)
  }
  const saveHistory=async(course:Course)=>{
    if(!loggedIn){setSelectedCourse(null);setTab('mytravel');return}
    const prefs=coursePrefs[course.id];if(!prefs){await ask('저장 안내','새로 추천받은 여행 조건만 저장할 수 있어요.');return}
    if(!await ask('여행 조건 저장','출발지·좌표·일시·취향이 계정에 연결되어 직접 삭제하거나 탈퇴할 때까지 저장됩니다. 저장할까요?','저장'))return
    const version=tokenStore.version()
    if(version!==tokenStore.version() || !tokenStore.getAccess())return
    try{await api.history.record(prefs.summary,prefs);await refreshAccount();await ask('저장 완료','내 여행에서 다시 확인할 수 있어요.')}
    catch(error){await ask('저장 실패',error instanceof Error?error.message:'다시 시도해 주세요.')}
  }
  const toggleBookmark = async (course:Course) => {
    if(!loggedIn){setTab('mytravel');setSelectedCourse(null);return}
    const saved=bookmarkItems.some(item=>item.courseId===course.id)
    if(!saved && !await ask('코스 저장','출발지 좌표와 장소·시간표가 계정에 저장됩니다. 직접 삭제하거나 탈퇴할 때까지 보관합니다. 저장할까요?','저장'))return
    try{
      if(saved)await api.bookmarks.remove(course.id)
      else await api.bookmarks.add({courseId:course.id,courseName:course.title,city:course.city,snapshot:course.apiCourse})
      await refreshAccount()
    }catch(error){await ask('코스 저장 실패',error instanceof Error?error.message:'다시 시도해 주세요.')}
  }
  const replayHistory=(item:HistoryItem)=>{
    const seed=item.preferences?preferencesToCondition(item.preferences):{...DEFAULT_CONDITION,region:item.city||'순천'}
    setWizardSeed({...seed,date:todayKorea(),endDate:todayKorea()});setWizardOpen(true)
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', background: '#E8EEF4' }}>
      <div style={{ width: '100%', maxWidth: 520, height: '100%', position: 'relative', overflow: 'hidden', background: L.bg, fontFamily: "'Pretendard Variable', Pretendard, sans-serif" }}>
        {dialog}
        {user && needsPrivacyConsent(user) && <PrivacyConsent onAgree={async()=>{setUser(await api.acceptPrivacy());await refreshAccount();setScreen('main');}} onDecline={()=>{void tokenStore.clear();setUser(null);setBookmarkItems([]);setHistory([]);setScreen('main');}} onDelete={async()=>{await api.deleteAccount();await tokenStore.clear();setUser(null);setBookmarkItems([]);setHistory([]);setScreen('login');}}/>}
        {screen === 'splash' && <Splash onDone={() => setScreen(tokenStore.getAccess() ? 'main' : 'login')} />}
        {screen === 'login' && <Login onAuthenticated={applyAuth} onLogin={handleLogin} onSignup={handleSignup} onGuest={() => setScreen('main')} error={authError} />}
        {screen === 'main' && (
          <>
            <div style={{ position: 'absolute', inset: 0 }}>
              {tab === 'home' && <HomeScreen onPlan={(seed) => { setWizardSeed(seed); setWizardOpen(true); }} courses={courses} />}
              {tab === 'course' && <CourseListScreen state={courseState} condition={condition} courses={courses} fallbackReason={fallbackReason} onSelect={(course) => void openCourse(course)} onRetry={() => condition && void handleComplete(condition)} onPlan={() => {setWizardSeed(condition);setWizardOpen(true)}} />}
              {tab === 'map' && <MapScreen courses={courses} onSelect={course=>{setConfirmedCourse(course);void refreshRoute(course)}} preferences={coursePrefs[(confirmedCourse||courses[0])?.id||'']??null} routingBusy={!!routingStatus[confirmedCourse?.id||'']?.busy} routingError={routingStatus[confirmedCourse?.id||'']?.error||''} onRefresh={()=>{const c=confirmedCourse||courses[0];if(c)void refreshRoute(c,true)}} confirmedCourse={confirmedCourse || courses[0] || null} onDetail={(course) => void openCourse(course)} onCancelConfirm={() => setTab('course')} />}
              {tab === 'mytravel' && <MyTravelScreen loggedIn={loggedIn} user={user} onLogin={() => setScreen('login')} onLogout={() => void handleLogout()} onDeleted={()=>void clearAccount()} bookmarkItems={bookmarkItems} history={history} onSelectCourse={(course) => void openCourse(course)} onReplayHistory={replayHistory} onDeleteHistory={async(id)=>{if(await ask('여행 기록 삭제','저장한 여행 기록을 삭제할까요?','삭제'))try{await api.history.delete(id);await refreshAccount()}catch(error){await ask('삭제 실패',error instanceof Error?error.message:'다시 시도해 주세요.')}}} courses={courses} />}
            </div>
            <TabBar active={tab} onChange={next=>{setTab(next);if(next==='map'&&!confirmedCourse&&courses[0]){setConfirmedCourse(courses[0]);void refreshRoute(courses[0]);}}} />
            {wizardOpen && <PlanWizard initial={wizardSeed} onClose={() => { setWizardOpen(false); setWizardSeed(undefined); }} onComplete={(cond) => void handleComplete(cond)} />}
            {selectedCourse && <CourseDetailScreen preferences={coursePrefs[selectedCourse.id]??null} routingBusy={!!routingStatus[selectedCourse.id]?.busy} routingError={routingStatus[selectedCourse.id]?.error||''} onRefresh={()=>void refreshRoute(selectedCourse,true)} onHistory={()=>void saveHistory(selectedCourse)} course={selectedCourse} onBack={() => setSelectedCourse(null)} onBookmark={() => void toggleBookmark(selectedCourse)} bookmarked={bookmarkItems.some((item) => item.courseId === selectedCourse.id)} onEdit={()=>{if(coursePrefs[selectedCourse.id])setEditorOpen(true);else void ask('코스 편집','저장된 코스는 여행 조건을 새로 선택한 후 편집해 주세요.')}} onConfirm={() => { setConfirmedCourse(selectedCourse); setSelectedCourse(null); setTab('map') }} />}
            {selectedCourse && editorOpen && <CourseEditor course={selectedCourse} pool={[...new Map(courses.flatMap(c => c.places).filter(p => p.category !== 'transit').map(p => [p.id, p])).values()]} onClose={() => setEditorOpen(false)} onSave={async updated => {
              if (!activePrefs) throw new Error('코스를 다시 추천받은 후 편집해 주세요.');
              const version=recommendationVersion.current;
              const result = await api.editCourse(activePrefs, updated.id, updated.places.filter(p => p.category !== 'transit').map(p => p.id));
              if(version!==recommendationVersion.current)throw new Error('여행 조건이 변경되었습니다. 다시 시도해 주세요.');
              if(!result.course.constraintPassed||!canPreviewCourse(result.course))throw new Error('조건에 맞지 않아 기존 코스를 유지했어요.');
              const verified = rankedToUiCourse(result.course);
              if (bookmarkItems.some(item => item.courseId === verified.id)) { await api.bookmarks.add({courseId:verified.id, courseName:verified.title, city:verified.city, snapshot:result.course}); await refreshAccount(); }
              setSelectedCourse(verified); setCourses(prev => prev.map(c => c.id === verified.id ? verified : c));
              setConfirmedCourse(prev => prev?.id === verified.id ? verified : prev);
            }} />}
          </>
        )}
      </div>
    </div>
  )
}
