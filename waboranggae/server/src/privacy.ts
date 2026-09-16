import { z } from 'zod';
import { PRIVACY_NOTICE_VERSION } from '../../src/domain/privacyNotice';
export { PRIVACY_NOTICE_VERSION, needsPrivacyConsent } from '../../src/domain/privacyNotice';
export const consentSchema = z.object({
  privacyConsent: z.literal(true, { error: '개인정보 수집·이용 안내를 읽고 동의해 주세요. 동의하지 않아도 게스트로 이용할 수 있습니다.' }),
  consentVersion: z.literal(PRIVACY_NOTICE_VERSION),
});
