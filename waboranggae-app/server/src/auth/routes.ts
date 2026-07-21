import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { hashPassword, verifyPassword, validatePasswordRequirements } from '../utils/crypto';
import { generateTokenPair, verifyRefreshToken } from './jwt';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// 스키마 정의
const signupSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력하세요'),
  displayName: z.string().min(2, '이름은 2자 이상이어야 합니다').max(50, '이름은 50자 이하여야 합니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token이 필요합니다'),
});

// 회원가입
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, displayName, password } = signupSchema.parse(req.body);

    // 비밀번호 요구사항 검증
    const passwordError = validatePasswordRequirements(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    // 이미 가입한 이메일인지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: '이미 가입한 이메일입니다' });
      return;
    }

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(password);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        password: hashedPassword,
      },
    });

    // 토큰 생성
    const { accessToken, refreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.tokenVersion
    );

    // 비밀번호 제외한 사용자 정보 반환
    const { password: _, ...safeUser } = user;

    res.status(201).json({
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    if (error.issues) {
      // Zod 검증 에러
      res.status(400).json({
        error: error.issues[0]?.message || '입력 값이 올바르지 않습니다',
      });
      return;
    }

    console.error('[Signup Error]', error);
    res.status(500).json({
      error: '회원가입 중 오류가 발생했습니다',
    });
  }
});

// 로그인
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      // 보안: 이메일 존재 여부를 숨김
      res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
      return;
    }

    // 비밀번호 검증
    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
      return;
    }

    // 토큰 생성
    const { accessToken, refreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.tokenVersion
    );

    // 비밀번호 제외한 사용자 정보 반환
    const { password: _, ...safeUser } = user;

    res.json({
      user: safeUser,
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    if (error.issues) {
      res.status(400).json({
        error: error.issues[0]?.message || '입력 값이 올바르지 않습니다',
      });
      return;
    }

    console.error('[Login Error]', error);
    res.status(500).json({
      error: '로그인 중 오류가 발생했습니다',
    });
  }
});

// 토큰 갱신
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    // Refresh token 검증
    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      res.status(401).json({ error: '유효하지 않거나 만료된 refresh token입니다' });
      return;
    }

    // 사용자 조회 (토큰 버전 확인)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      // 비밀번호 변경 등으로 토큰이 무효화됨
      res.status(401).json({ error: '토큰이 무효화되었습니다. 다시 로그인하세요' });
      return;
    }

    // 새 토큰 생성
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.tokenVersion
    );

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    if (error.issues) {
      res.status(400).json({
        error: error.issues[0]?.message || '입력 값이 올바르지 않습니다',
      });
      return;
    }

    console.error('[Refresh Error]', error);
    res.status(500).json({
      error: '토큰 갱신 중 오류가 발생했습니다',
    });
  }
});

// 로그아웃 (선택사항: 클라이언트에서 토큰 삭제하면 됨)
router.post('/logout', authenticateToken, (req: Request, res: Response) => {
  // JWT는 stateless이므로 서버에서 할 일이 없음
  // 클라이언트에서 토큰 삭제
  res.json({ message: '로그아웃되었습니다' });
});

export const authRouter = router;
