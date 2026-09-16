import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
const { validateReleaseEnvironment } = createRequire(import.meta.url)('../scripts/release-config.cjs');
describe('Google Play 출시 설정 보호', () => {
  it.each(['', 'http://localhost:8787', 'https://preview.trycloudflare.com', 'https://api.example.com'])('임시 또는 미설정 주소 %s 거부', url => expect(validateReleaseEnvironment({EXPO_PUBLIC_API_BASE_URL:url}).length).toBeGreaterThan(0));
  it('팀 접속 암호를 앱에 배포하지 않음', () => expect(validateReleaseEnvironment({EXPO_PUBLIC_API_BASE_URL:'https://api.example.org',EXPO_PUBLIC_DEV_ACCESS_KEY:'test-only'}).length).toBeGreaterThan(0));
  it('HTTPS 운영 API는 허용', () => expect(validateReleaseEnvironment({EXPO_PUBLIC_API_BASE_URL:'https://api.example.org'})).toEqual([]));
});
