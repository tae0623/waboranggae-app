import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../server/src/auth/flow-store', async () => ({ flowStore: (await import('./helpers/flowStoreMock')).createFlowStoreMock() }));
import { authenticatedFlow, createSocialFlow, socialConfiguration } from '../server/src/auth/social';
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function configure() {
  vi.stubEnv('PUBLIC_APP_URL','https://api.example.org');
  vi.stubEnv('GOOGLE_LOGIN_ENABLED','true');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','test-client');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','test-secret');
}
describe('무료 소셜 로그인 연결 준비', () => {
  it('미설정 provider는 활성화하지 않음', async () => { vi.stubEnv('GOOGLE_LOGIN_ENABLED','false'); expect(socialConfiguration('google').enabled).toBe(false); await expect(createSocialFlow('google')).rejects.toThrow(); });
  it('운영 환경 HTTP 콜백 거부', () => { configure(); vi.stubEnv('NODE_ENV','production'); vi.stubEnv('PUBLIC_APP_URL','http://example.org'); expect(socialConfiguration('google').enabled).toBe(false); });
  it('구글 PKCE 및 별도 결과 수령 암호', async () => { configure(); const flow=await createSocialFlow('google'); const url=new URL(flow.authorizationUrl); expect(url.hostname).toBe('accounts.google.com'); expect(url.searchParams.get('code_challenge_method')).toBe('S256'); expect(url.href).not.toContain(flow.pollSecret); expect(await authenticatedFlow(flow.flowId,'wrong')).toBeNull(); expect((await authenticatedFlow(flow.flowId,flow.pollSecret))?.value.stage).toBe('pending'); });
  it('5분이 지나면 결과 요청도 만료됨', async () => { configure(); const flow=await createSocialFlow('google'); const future=Date.now()+301000; vi.spyOn(Date,'now').mockReturnValue(future); expect(await authenticatedFlow(flow.flowId,flow.pollSecret)).toBeNull(); });
});
