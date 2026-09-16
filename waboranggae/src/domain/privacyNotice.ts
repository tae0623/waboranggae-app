// Public notice metadata shared by the server and web; never put secrets here.
export const PRIVACY_NOTICE_VERSION = '2026-09-15-consent-v3';
export const PRIVACY_OPERATOR_NAME = '뚜버기 Team (administrator: Taeyoung Ko)';
export const SUPPORT_EMAIL = 'waboranggae.help@gmail.com';
export const ACCOUNT_CONSENT_TEXT = '[계정 이용 필수] 계정 관리 목적으로 이메일·표시 이름·비밀번호 해시(이메일 가입) 또는 공급자 식별자·표시 이름(소셜 로그인), 동의 버전·시각을 탈퇴 시까지 수집·이용하는 데 동의합니다. 클라우드 검증에서는 Supabase의 서버와 DB에 저장·처리됩니다. 거부해도 게스트 이용과 기존 계정 삭제는 가능합니다. 여행 조건·코스 저장은 별도 선택입니다.';
export function needsPrivacyConsent(user: { consentVersion?: string | null; consentedAt?: unknown } | null | undefined): boolean {
  return !user || user.consentVersion !== PRIVACY_NOTICE_VERSION || !user.consentedAt;
}
