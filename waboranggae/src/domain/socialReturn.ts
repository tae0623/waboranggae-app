// These are presentation-only destinations. No OAuth code, token or polling
// credential may be included. Authentication is completed by /social/result.
export const SOCIAL_RETURN_ORIGIN = 'https://waboranggae-app.pages.dev';
export const SOCIAL_RETURN_PATH = '/auth/complete';
export type SocialClient = 'web' | 'android' | 'legacy';
export type SocialReturnResult = 'ready' | 'cancelled' | 'expired' | 'failed';
export const ANDROID_AUTH_RETURN = 'intent://auth/return#Intent;scheme=ddubugi;package=kr.co.waboranggae.nativepilot;end';
export function socialReturnUrl(client: SocialClient = 'legacy', result: SocialReturnResult = 'ready') {
  const url = new URL(SOCIAL_RETURN_PATH, SOCIAL_RETURN_ORIGIN);
  url.searchParams.set('client', ['web', 'android'].includes(client) ? client : 'legacy');
  url.searchParams.set('result', ['ready', 'cancelled', 'expired'].includes(result) ? result : 'failed');
  return url.href;
}
