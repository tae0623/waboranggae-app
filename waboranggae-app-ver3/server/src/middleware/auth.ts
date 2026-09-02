import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../auth/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT 검증 미들웨어
 * Authorization: Bearer {token}
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // "Bearer token" → "token"

  if (!token) {
    res.status(401).json({ error: '인증이 필요합니다' });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다' });
    return;
  }

  req.user = payload;
  next();
}

/**
 * 선택적 JWT 검증 (없으면 통과)
 */
export function optionalAuthenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}

/**
 * 에러 핸들러
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('[Error]', err);

  // JWT 에러
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: '토큰이 만료되었습니다' });
    return;
  }

  // Zod 검증 에러
  if (err.issues) {
    res.status(400).json({
      error: err.issues[0]?.message || '입력 값이 올바르지 않습니다',
    });
    return;
  }

  // 기타 에러
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: isDev ? err.message : '요청 처리 중 오류가 발생했습니다',
    ...(isDev && { details: err.stack }),
  });
}
