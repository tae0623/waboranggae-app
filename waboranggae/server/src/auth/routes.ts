import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { hashPassword, verifyPassword, validatePasswordRequirements } from '../utils/crypto';
import { generateTokenPair, verifyRefreshToken } from './jwt';
import { authenticateToken } from '../middleware/auth';
import { loginLimiter, signupLimiter } from '../middleware/rateLimiter';
import { consentSchema, needsPrivacyConsent } from '../privacy';
import { isSessionRevoked, revokeSession } from './session-revocations';
import {SignupBotError,signupBotConfig,verifySignupBot} from './signup-bot';
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from './disposable-email';

const router = Router();

// 스키마 정의
const signupSchema = z.object({
  email: z.string().trim().max(254).email('올바른 이메일 주소를 입력하세요'),
  displayName: z.string().min(2, '이름은 2자 이상이어야 합니다').max(50, '이름은 50자 이하여야 합니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(128),
  botToken: z.string().max(2048).optional(),
}).merge(consentSchema);

const loginSchema = z.object({
  email: z.string().trim().max(254).refine(value=>z.string().email().safeParse(value).success||/^[a-z][a-z0-9_-]{2,31}$/.test(value),'이메일 또는 아이디를 확인해 주세요'),
  password: z.string().min(1, '비밀번호를 입력하세요').max(128),
  privacyConsent: z.boolean().optional(),
  ageConfirmed: z.boolean().optional(),
  consentVersion: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token이 필요합니다').max(8192),
});

// 회원가입
router.get('/signup-config',(_req,res)=>res.set('Cache-Control','no-store').json(signupBotConfig()));
router.post('/signup', signupLimiter, async (req: Request, res: Response) => {
  try {
    const { email, displayName, password, consentVersion,botToken } = signupSchema.parse(req.body);
    // Check before bot-provider calls, password hashing and database operations.
    if (isDisposableEmail(email)) {
      res.status(400).json({ error: DISPOSABLE_EMAIL_MESSAGE, code: 'DISPOSABLE_EMAIL_DOMAIN' });
      return;
    }
    await verifySignupBot(botToken);

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
        consentVersion,
        consentedAt: new Date(),
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
    if(error instanceof SignupBotError){res.status(error.status).json({error:error.message,code:'SIGNUP_BOT_CHECK'});return;}
    if (error.issues) {
      // Zod 검증 에러
      res.status(400).json({
        error: error.issues[0]?.message || '입력 값이 올바르지 않습니다',
      });
      return;
    }

    console.error('[Signup Error] Request failed');
    res.status(500).json({
      error: '회원가입 중 오류가 발생했습니다',
    });
  }
});

// 로그인
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, privacyConsent, consentVersion, ageConfirmed } = loginSchema.parse(req.body);
    // Authentication without consent remains available for privacy rights/deletion.
    // It never records consent implicitly; account writes are separately gated.
    const consent = privacyConsent !== undefined || consentVersion !== undefined || ageConfirmed !== undefined
      ? consentSchema.parse({ privacyConsent, consentVersion, ageConfirmed }) : null;

    // 사용자 조회
    // A provisioned alias still requires the account's normal bcrypt password.
    let user = await prisma.user.findUnique({where:email.includes('@')?{email}:{loginAlias:email}});

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

    if (consent && needsPrivacyConsent(user)) {
      user = await prisma.user.update({ where: { id: user.id }, data: { consentVersion: consent.consentVersion, consentedAt: new Date() } });
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

    console.error('[Login Error] Request failed');
    res.status(500).json({
      error: '로그인 중 오류가 발생했습니다',
    });
  }
});

// Existing sessions must explicitly accept the current notice before new account writes.
router.post('/consent', authenticateToken, async (req, res, next) => {
  try {
    const consent = consentSchema.parse(req.body);
    const current = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.userId } });
    const user = needsPrivacyConsent(current)
      ? await prisma.user.update({ where: { id: current.id }, data: { consentVersion: consent.consentVersion, consentedAt: new Date() } })
      : current;
    const { password: _, ...safeUser } = user;
    res.setHeader('Cache-Control', 'no-store');
    res.json(safeUser);
  } catch (error) { next(error); }
});

// 토큰 갱신
router.post('/refresh', loginLimiter, async (req: Request, res: Response) => {
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

    if (!user || user.tokenVersion !== payload.tokenVersion || await isSessionRevoked(payload.sessionId)) {
      // 비밀번호 변경 등으로 토큰이 무효화됨
      res.status(401).json({ error: '토큰이 무효화되었습니다. 다시 로그인하세요' });
      return;
    }

    // 새 토큰 생성
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.tokenVersion,
      payload.sessionId
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

    console.error('[Refresh Error] Request failed');
    res.status(500).json({
      error: '토큰 갱신 중 오류가 발생했습니다',
    });
  }
});

// Native logout revokes this login only; other devices keep their own session IDs.
router.post('/logout/current', authenticateToken, async (req:Request,res:Response,next)=>{
  try {
    if(!req.user!.sessionId){res.status(409).json({error:'세션을 갱신한 후 다시 시도해 주세요.'});return;}
    await revokeSession(req.user!.sessionId);
    res.setHeader('Cache-Control','no-store');
    res.json({message:'로그아웃되었습니다',scope:'current-session'});
  }catch(error){next(error);}
});

// Retained for older web clients whose button explicitly says all devices.
router.post('/logout', authenticateToken, async (req: Request, res: Response, next) => {
  try {
    await prisma.user.update({ where: { id: req.user!.userId }, data: { tokenVersion: { increment: 1 } } });
    res.json({ message: '모든 기기에서 로그아웃되었습니다' });
  } catch (error) { next(error); }
});

export const authRouter = router;
