import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

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
  if (access === refresh) throw new Error('Access와 Refresh 토큰의 서명 키는 서로 달라야 합니다.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-this-local-only';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-this-local-only';

export interface JWTPayload {
  userId: string;
  email: string;
  tokenVersion: number;
  sessionId?: string;
  iat?: number;
  exp?: number;
}

export interface RefreshPayload {
  userId: string;
  tokenVersion: number;
  sessionId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Access Token 생성 (15분 유효기간)
 */
export function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, tokenUse: 'access' }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '15m',
  });
}

/**
 * Refresh Token 생성 (7일 유효기간)
 */
export function generateRefreshToken(payload: Omit<RefreshPayload, 'iat' | 'exp'>): string {
  return jwt.sign({ ...payload, tokenUse: 'refresh' }, JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });
}

/**
 * Access Token 검증
 */
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    if (token.length > 8192) return null;
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!validClaims(payload, 'access') || typeof payload.email !== 'string'
      || !payload.email.trim() || payload.email.length > 320) return null;
    return payload as unknown as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh Token 검증
 */
export function verifyRefreshToken(token: string): RefreshPayload | null {
  try {
    if (token.length > 8192) return null;
    const payload = jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    if (!validClaims(payload, 'refresh') || payload.email !== undefined) return null;
    return payload as unknown as RefreshPayload;
  } catch (error) {
    return null;
  }
}

/**
 * 토큰 쌍 생성
 */
function validSessionId(value:unknown) { return value === undefined || (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)); }
function validClaims(value: unknown, use: 'access' | 'refresh'): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  // Legacy tokens retain their separate claim shapes and signing keys.
  if (p.tokenUse !== undefined && p.tokenUse !== use) return false;
  return typeof p.userId === 'string' && p.userId.trim().length > 0 && p.userId.length <= 200
    && typeof p.tokenVersion === 'number' && Number.isSafeInteger(p.tokenVersion) && p.tokenVersion >= 0
    && typeof p.iat === 'number' && Number.isSafeInteger(p.iat)
    && p.iat <= Math.floor(Date.now() / 1000) + 60
    && typeof p.exp === 'number' && Number.isSafeInteger(p.exp) && p.exp > p.iat
    && p.exp - p.iat <= (use === 'access' ? 15 * 60 : 7 * 24 * 60 * 60)
    && validSessionId(p.sessionId);
}
export function generateTokenPair(userId: string, email: string, tokenVersion: number, sessionId = randomBytes(32).toString('hex')) {
  const accessToken = generateAccessToken({ userId, email, tokenVersion, sessionId });
  const refreshToken = generateRefreshToken({ userId, tokenVersion, sessionId });
  return { accessToken, refreshToken };
}
