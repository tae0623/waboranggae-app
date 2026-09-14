import rateLimit from 'express-rate-limit';

/**
 * 일반 API 요청 제한
 * 15분당 100 요청
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 요청 수
  message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true, // RateLimit-* 헤더 반환
  legacyHeaders: false, // X-RateLimit-* 헤더 비활성화
  skip: (req) => {
    // GET 요청은 더 관대하게
    return req.method === 'GET';
  },
});

/** CPU/GPU 사용량이 큰 AI·추천 API 요청 제한 */
export const generationLimiter = rateLimit({
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
export const loginLimiter = rateLimit({
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
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1시간
  max: 3,
  message: { error: '너무 많은 가입 요청이 있었습니다. 1시간 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 엄격한 제한 (비밀번호 변경, 계정 삭제 등)
 * 1시간당 3회만 가능
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: '보안상의 이유로 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
