import jwt from 'jsonwebtoken';

const PLACEHOLDER_MARKERS = [
  'change-this',
  'replace-with',
  'change-in-production',
  'dev-secret',
];

function isPlaceholderSecret(value: string | undefined) {
  if (!value?.trim()) return true;
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

/** production에서는 placeholder·짧은 키를 거부합니다. */
export function assertJwtSecrets() {
  const access = process.env.JWT_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV !== 'production') return;

  const unsafe = [access, refresh].some((value) => isPlaceholderSecret(value) || (value?.length ?? 0) < 32);
  if (unsafe) {
    throw new Error('운영 환경의 JWT_SECRET / JWT_REFRESH_SECRET를 32자 이상의 무작위 값으로 설정해야 합니다.');
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-this-local-only';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-this-local-only';

export interface JWTPayload {
  userId: string;
  email: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export interface RefreshPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

/**
 * Access Token 생성 (15분 유효기간)
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
  });
}

/**
 * Refresh Token 생성 (7일 유효기간)
 */
export function generateRefreshToken(payload: Omit<RefreshPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

/**
 * Access Token 검증
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh Token 검증
 */
export function verifyRefreshToken(token: string): RefreshPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 토큰 쌍 생성
 */
export function generateTokenPair(userId: string, email: string, tokenVersion: number) {
  const accessToken = generateAccessToken({ userId, email, tokenVersion });
  const refreshToken = generateRefreshToken({ userId, tokenVersion });
  return { accessToken, refreshToken };
}
