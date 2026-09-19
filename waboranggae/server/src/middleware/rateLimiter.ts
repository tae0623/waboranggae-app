import { sharedRateLimit } from './sharedRateLimit';

/**
 * 일반 API 요청 제한
 * 읽기·이미지 조회를 포함해 15분당 300 요청. 검색·추천은 아래의 더 작은 별도 한도 적용.
 */
export const apiLimiter = sharedRateLimit('api',{
  windowMs: 15 * 60 * 1000, // 15분
  max: 300,
  message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true, // RateLimit-* 헤더 반환
  legacyHeaders: false, // X-RateLimit-* 헤더 비활성화
});

/** 장소 검색은 후보를 바꿔가며 반복하므로 추천 생성과 별도 예산으로 제한합니다. */
export const placeSearchLimiter = sharedRateLimit('places',{
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: '장소 검색 요청이 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** CPU/GPU 사용량이 큰 AI·추천 API 요청 제한 */
export const generationLimiter = sharedRateLimit('generation',{
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '추천 요청이 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 로그인 시도 제한
 * 15분당 5회 시도만 가능
 */
export const loginLimiter = sharedRateLimit('login',{
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: '너무 많은 로그인 시도가 있었습니다. 15분 후 다시 시도해주세요.' },
  skipSuccessfulRequests: true, // 성공하면 카운트 안 함
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 회원가입 제한
 * 1시간당 3회 가입만 가능 (봇 방지)
 */
export const signupLimiter = sharedRateLimit('signup',{
  windowMs: 60 * 60 * 1000, // 1시간
  max: 3,
  message: { error: '너무 많은 가입 요청이 있었습니다. 1시간 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
