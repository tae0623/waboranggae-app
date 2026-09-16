import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';
import { needsPrivacyConsent, PRIVACY_NOTICE_VERSION } from '../privacy';

/** Reading/deleting one's existing information must not require new consent. */
export async function requireConsentForAccountWrite(req: Request, res: Response, next: NextFunction) {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) { next(); return; }
  if (!req.user) { res.status(401).json({ error: '인증이 필요합니다.' }); return; }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { consentVersion: true, consentedAt: true } });
    if (needsPrivacyConsent(user)) {
      res.status(403).json({ code: 'PRIVACY_CONSENT_REQUIRED', consentVersion: PRIVACY_NOTICE_VERSION, error: '개인정보 수집·이용 안내에 동의한 뒤 계정 기능을 이용해 주세요. 게스트 이용과 기존 정보 조회·삭제는 가능합니다.' });
      return;
    }
    next();
  } catch (error) { next(error); }
}
