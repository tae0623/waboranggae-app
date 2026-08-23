import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-in-production';

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
