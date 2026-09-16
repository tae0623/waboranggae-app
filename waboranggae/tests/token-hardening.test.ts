import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { assertJwtSecrets, generateTokenPair, verifyAccessToken, verifyRefreshToken } from '../server/src/auth/jwt';
import { hashPassword, verifyPassword } from '../server/src/utils/crypto';

const accessKey = process.env.JWT_SECRET || 'dev-secret-key-change-this-local-only';
const refreshKey = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-this-local-only';
const valid = { userId: 'fixture', tokenVersion: 0, email: 'fixture@example.invalid' };
afterEach(() => vi.unstubAllEnvs());
function signed(payload: object, key = accessKey) { return jwt.sign(payload, key, { algorithm: 'HS256', expiresIn: '15m' }); }
describe('JWT claim and password boundary hardening', () => {
  it('verifies generated tokens but never their opposite purpose', () => {
    const pair = generateTokenPair(valid.userId, valid.email, 0);
    expect(verifyAccessToken(pair.accessToken)?.userId).toBe('fixture');
    expect(verifyRefreshToken(pair.refreshToken)?.userId).toBe('fixture');
    expect(verifyAccessToken(pair.refreshToken)).toBeNull();
    expect(verifyRefreshToken(pair.accessToken)).toBeNull();
  });
  it.each([{ userId: '' }, { userId: {} }, { userId: 'x'.repeat(201) },
    { tokenVersion: -1 }, { tokenVersion: 0.5 }, { tokenVersion: '0' },
    { email: undefined }, { email: {} }, { sessionId: 'wrong' }, { tokenUse: 'refresh' }])
  ('rejects signed malformed claims %j', bad => expect(verifyAccessToken(signed({ ...valid, ...bad }))).toBeNull());
  it('rejects missing expiry, too-long lifetime and oversized tokens', () => {
    expect(verifyAccessToken(jwt.sign(valid, accessKey))).toBeNull();
    expect(verifyAccessToken(jwt.sign(valid, accessKey, { expiresIn: '1d' }))).toBeNull();
    expect(verifyAccessToken('a'.repeat(8193))).toBeNull();
    expect(verifyRefreshToken('a'.repeat(8193))).toBeNull();
  });
  it('keeps correctly shaped previously issued tokens usable', () => {
    expect(verifyAccessToken(signed(valid))?.userId).toBe('fixture');
    expect(verifyRefreshToken(signed({ userId: 'fixture', tokenVersion: 0 }, refreshKey))?.userId).toBe('fixture');
  });
  it('rejects purpose substitution even under the matching signing key', () => {
    expect(verifyRefreshToken(signed({ ...valid, tokenUse: 'access' }, refreshKey))).toBeNull();
    expect(verifyRefreshToken(signed(valid, refreshKey))).toBeNull();
  });
  it('fails production startup when both signing secrets are identical', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('JWT_SECRET', 'a'.repeat(64)); vi.stubEnv('JWT_REFRESH_SECRET', 'a'.repeat(64));
    expect(assertJwtSecrets).toThrow('서로 달라야');
    vi.stubEnv('JWT_REFRESH_SECRET', 'b'.repeat(64)); expect(assertJwtSecrets).not.toThrow();
  });
  it('does not authenticate a password extended beyond the bcrypt byte limit', async () => {
    const password = 'Aa1!' + 'x'.repeat(68), hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(password + 'different', hash)).toBe(false);
    const unicode = 'Aa1!' + '가'.repeat(22) + '12', unicodeHash = await hashPassword(unicode);
    expect(await verifyPassword(unicode, unicodeHash)).toBe(true);
    expect(await verifyPassword(unicode + '나', unicodeHash)).toBe(false);
  });
});
