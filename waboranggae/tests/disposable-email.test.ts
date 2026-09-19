import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { isDisposableEmail, DISPOSABLE_EMAIL_MESSAGE } from '../server/src/auth/disposable-email';
import domains from '../server/src/auth/disposable-email-data/domains.json';
import metadata from '../server/src/auth/disposable-email-data/metadata.json';
import overrides from '../server/src/auth/disposable-email-data/overrides.json';
import { PRIVACY_NOTICE_VERSION } from '../src/domain/privacyNotice';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), create: vi.fn(), hashPassword: vi.fn(), verifyPassword: vi.fn(),
  bot: vi.fn(), tokens: vi.fn(), limiter: vi.fn(),
}));
vi.mock('../server/src/db/client', () => ({ prisma: { user: { findUnique: mocks.findUnique, create: mocks.create } } }));
vi.mock('../server/src/utils/crypto', () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword, validatePasswordRequirements: () => null }));
vi.mock('../server/src/auth/jwt', () => ({ generateTokenPair: mocks.tokens, verifyAccessToken: () => null, verifyRefreshToken: () => null }));
vi.mock('../server/src/auth/signup-bot', async importOriginal => ({ ...(await importOriginal<object>()), verifySignupBot: mocks.bot }));
vi.mock('../server/src/middleware/rateLimiter', () => ({
  signupLimiter: (req: unknown, res: unknown, next: () => void) => { mocks.limiter(); next(); },
  loginLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import { authRouter } from '../server/src/auth/routes';
import { SignupBotError } from '../server/src/auth/signup-bot';

describe('offline disposable domain snapshot', () => {
  it('ships a pinned, nonempty list with protected ordinary email providers', () => {
    expect(metadata.license).toBe('CC0-1.0');
    expect(metadata.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(metadata.count).toBe(domains.length);
    expect(new Set(domains).size).toBe(domains.length);
    expect(domains.length).toBeGreaterThan(1000);
    for (const domain of overrides.allow) expect(isDisposableEmail(`test@${domain}`)).toBe(false);
  });
  it.each(['a@mailinator.com', 'A@MAILINATOR.COM', 'a+tag@sub.mailinator.com', '  a@yopmail.com  '])('blocks %s, including subdomains and case changes', email => {
    expect(isDisposableEmail(email)).toBe(true);
  });
  it.each(['a@gmail.com', 'a@naver.com', 'a@hanmail.net', 'a@icloud.com', 'a@proton.me',
    'a@company.example', 'a@mailinator.com.example', 'a@ddubugi-unit-test-mailinator.com'])('allows %s without substring false positives', email => {
    expect(isDisposableEmail(email)).toBe(false);
  });
  it('does not make a remote request or send an email to check the domain', () => {
    const fetch = vi.fn(() => { throw new Error('Network must not be used'); });
    vi.stubGlobal('fetch', fetch);
    expect(isDisposableEmail('person@mailinator.com')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

let server: Server, base: string;
const httpFetch = globalThis.fetch;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/auth', authRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(null);
  mocks.bot.mockResolvedValue(undefined);
  mocks.hashPassword.mockResolvedValue('fixture-hash');
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.tokens.mockReturnValue({ accessToken: 'fixture-access', refreshToken: 'fixture-refresh' });
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'fixture', tokenVersion: 0, ...data }));
});
const body = (email: string) => ({
  email, displayName: '테스트', password: 'fixture-password-12!', botToken: 'fixture-bot',
  privacyConsent: true, ageConfirmed: true, consentVersion: PRIVACY_NOTICE_VERSION,
});
async function post(route: string, value: unknown) {
  const res = await httpFetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  return { status: res.status, body: await res.json() as Record<string, any> };
}
describe('email signup enforcement', () => {
  it.each(['person@mailinator.com', 'person@SUB.MAILINATOR.COM', '  person@yopmail.com  '])('rejects %s before DB, hashing, tokens or bot verification', async email => {
    const res = await post('/auth/signup', body(email));
    expect(res).toEqual({ status: 400, body: { code: 'DISPOSABLE_EMAIL_DOMAIN', error: DISPOSABLE_EMAIL_MESSAGE } });
    expect(mocks.limiter).toHaveBeenCalledTimes(1);
    for (const operation of [mocks.findUnique, mocks.create, mocks.hashPassword, mocks.tokens, mocks.bot]) expect(operation).not.toHaveBeenCalled();
  });
  it('keeps normal signup, explicit consent, password hashing and bot verification', async () => {
    const res = await post('/auth/signup', body('fixture@naver.com'));
    expect(res.status).toBe(201);
    expect(mocks.bot).toHaveBeenCalledWith('fixture-bot');
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'fixture@naver.com', password: 'fixture-hash', consentVersion: PRIVACY_NOTICE_VERSION }) });
    expect(res.body.user.password).toBeUndefined();
  });
  it('still rejects ordinary email when the bot check fails', async () => {
    mocks.bot.mockRejectedValue(new SignupBotError(400, '자동 가입 방지 확인을 완료해 주세요.'));
    const res = await post('/auth/signup', body('fixture@gmail.com'));
    expect(res.status).toBe(400); expect(res.body.code).toBe('SIGNUP_BOT_CHECK');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(['not-an-email', 'person@mailinator.com.', 'person@@gmail.com'])('keeps syntax validation for %s', async email => {
    expect((await post('/auth/signup', body(email))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not record a signup without age and privacy consent', async () => {
    expect((await post('/auth/signup', { ...body('fixture@gmail.com'), ageConfirmed: false })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each(['legacy@mailinator.com', 'test'])('does not lock existing users or the test alias out of login: %s', async email => {
    mocks.findUnique.mockResolvedValue({ id: 'existing', email: 'legacy@mailinator.com', password: 'fixture-hash', tokenVersion: 0 });
    const res = await post('/auth/login', { email, password: 'fixture-password' });
    expect(res.status).toBe(200); expect(res.body.accessToken).toBe('fixture-access');
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: email === 'test' ? { loginAlias: 'test' } : { email } });
    expect(mocks.bot).not.toHaveBeenCalled();
  });
});
