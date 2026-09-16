import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../auth/jwt';
import { prisma } from '../db/client';
import { isSessionRevoked } from '../auth/session-revocations';

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
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!token) {
    res.status(401).json({ error: '인증이 필요합니다' });
    return;
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, tokenVersion: true } });
    if (!user || user.tokenVersion !== payload.tokenVersion || await isSessionRevoked(payload.sessionId)) {
      res.status(401).json({ error: '계정이 삭제되었거나 인증이 만료되었습니다. 다시 로그인해 주세요.' });
      return;
    }
    req.user = payload;
    next();
  } catch (error) { next(error); }
}

/**
 * 선택적 JWT 검증 (없으면 통과)
 */
export async function optionalAuthenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.headers.authorization) { next(); return; }
  await authenticateToken(req, res, next);
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
