import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db/client';
import { generateTokenPair } from './jwt';
import { consentSchema, PRIVACY_NOTICE_VERSION } from '../privacy';
import { flowStore } from './flow-store';
import { EDGE_PUBLIC_PATH } from '../runtime/edge-path';

type Provider = 'kakao' | 'google';
type PendingIdentity = { subject: string; name: string };
type Flow = { provider: Provider; secretHash: string; expires: number; stage: 'pending' | 'exchanging' | 'consent' | 'complete' | 'failed'; userId?: string; identity?: PendingIdentity; verifier: string; redirectUri: string };
const hash = (value: string) => createHash('sha256').update(value).digest();
export function socialConfiguration(provider: Provider) {
  const prefix = provider.toUpperCase();
  const clientId = process.env[prefix + (provider === 'kakao' ? '_REST_API_KEY' : '_OAUTH_CLIENT_ID')] || '';
  const clientSecret = process.env[prefix + '_OAUTH_CLIENT_SECRET'] || '';
  const base = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, '') || '';
  let safeBase = false;
  try { const url = new URL(base); const allowedPath = url.pathname === '/' || (process.env.API_RUNTIME === 'supabase-edge' && url.pathname === EDGE_PUBLIC_PATH);
    safeBase = (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash && allowedPath; } catch { /* not configured */ }
  const enabled=safeBase && process.env[prefix + '_LOGIN_ENABLED'] === 'true' && Boolean(clientId && clientSecret);
  const reason=enabled?'':!safeBase?'이 서버의 로그인 콜백 주소 설정이 필요합니다.'
    :!(clientId&&clientSecret)?'이 서버에 소셜 로그인 키가 아직 설정되지 않았습니다.'
    :'이 서버의 소셜 로그인이 비활성화되어 있습니다.';
  return { clientId, clientSecret, redirectUri: base + '/auth/social/' + provider + '/callback', enabled, reason };
}
export async function createSocialFlow(provider: Provider) {
  const config = socialConfiguration(provider);
  if (!config.enabled) throw new Error('소셜 로그인 설정이 아직 완료되지 않았습니다.');
  const flowId = randomBytes(32).toString('hex'), pollSecret = randomBytes(32).toString('hex'), verifier = randomBytes(32).toString('base64url');
  const expires = Date.now() + 5 * 60_000;
  await flowStore.create(flowId, { provider, secretHash: hash(pollSecret).toString('hex'), expires, stage: 'pending', verifier, redirectUri: config.redirectUri }, new Date(expires));
  const url = new URL(provider === 'kakao' ? 'https://kauth.kakao.com/oauth/authorize' : 'https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', state: flowId,
    ...(provider === 'google' ? { scope: 'openid profile', code_challenge: hash(verifier).toString('base64url'), code_challenge_method: 'S256' } : {}),
  }).toString();
  return { flowId, pollSecret, authorizationUrl: url.href };
}
export async function authenticatedFlow(flowId: string, pollSecret: string) {
  const stored = await flowStore.get<Flow>(flowId);
  if (!stored || stored.value.expires <= Date.now()) return null;
  const secret = Buffer.from(stored.value.secretHash, 'hex');
  return secret.length === 32 && timingSafeEqual(secret, hash(pollSecret)) ? stored : null;
}
async function identityForCode(provider: Provider, code: string, flow: Flow) {
  const config = socialConfiguration(provider);
  if (!config.enabled) throw new Error('Provider disabled');
  const tokenResponse = await fetch(provider === 'kakao' ? 'https://kauth.kakao.com/oauth/token' : 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret,
      redirect_uri: flow.redirectUri, code, ...(provider === 'google' ? { code_verifier: flow.verifier } : {}) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenResponse.ok) throw new Error('Token exchange failed');
  const token = await tokenResponse.json() as { access_token?: string };
  if (!token.access_token) throw new Error('Missing access token');
  const infoResponse = await fetch(provider === 'kakao' ? 'https://kapi.kakao.com/v2/user/me' : 'https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: 'Bearer ' + token.access_token }, signal: AbortSignal.timeout(10000),
  });
  if (!infoResponse.ok) throw new Error('User lookup failed');
  const info = await infoResponse.json() as { id?: number; sub?: string; name?: string; kakao_account?: { profile?: { nickname?: string } } };
  const subject = provider === 'kakao' ? String(info.id || '') : info.sub || '';
  if (!subject || subject.length > 256) throw new Error('Missing provider subject');
  // Provider subject, not unverified email, is the identity. Never silently link accounts by email.
  const name = provider === 'kakao' ? info.kakao_account?.profile?.nickname : info.name;
  return { subject, name: (name || (provider === 'kakao' ? '카카오 여행자' : '구글 여행자')).slice(0, 50) };
}
async function persistConsentedIdentity(provider: Provider, pending: PendingIdentity) {
  const { subject, name } = pending;
  return prisma.$transaction(async tx => {
  const identity = await tx.oAuthIdentity.upsert({
    where: { provider_subject: { provider, subject } }, update: {},
    create: { provider, subject, user: { create: {
      email: provider + '-' + hash(subject).toString('hex') + '@social.waboranggae.invalid',
      displayName: name,
      consentVersion: PRIVACY_NOTICE_VERSION, consentedAt: new Date(),
    } } },
  });
  // Only /consent can persist a new identity or update an outdated notice record.
  await tx.user.updateMany({ where: { id: identity.userId, OR: [
    { consentVersion: null }, { consentVersion: { not: PRIVACY_NOTICE_VERSION } }, { consentedAt: null },
  ] }, data: { consentVersion: PRIVACY_NOTICE_VERSION, consentedAt: new Date() } });
  return identity.userId;
  });
}
export const socialRouter = Router();
// Coarse network cap, plus a separate cap per unguessable flow for result polling.
socialRouter.use(rateLimit({ windowMs: 60_000, max: 600, standardHeaders: true, legacyHeaders: false }));
const startLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const pollLimiter = rateLimit({ windowMs: 60_000, max: 30, keyGenerator: req => /^[a-f0-9]{64}$/.test(req.body?.flowId || '') ? req.body.flowId : 'invalid-flow', standardHeaders: true, legacyHeaders: false });
socialRouter.get('/providers', (_req, res) => res.json({ providers: (['kakao','google'] as const).map(id=>{
  const {enabled,reason}=socialConfiguration(id);return {id,enabled,reason};
}) }));
socialRouter.post('/:provider/start', startLimiter, async (req, res, next) => {
  try { const provider = z.enum(['kakao', 'google']).parse(req.params.provider); res.setHeader('Cache-Control', 'no-store'); res.json(await createSocialFlow(provider)); }
  catch (error) { next(error); }
});
socialRouter.get('/:provider/callback', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const parsed = z.object({ state: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().min(1).max(4096).optional(), error: z.string().max(200).optional() }).safeParse(req.query);
  if (!parsed.success) { res.status(400).type('text').send('잘못된 로그인 요청입니다.'); return; }
  let stored;
  try { stored = await flowStore.get<Flow>(parsed.data.state); } catch(error) { next(error); return; }
  const flow = stored?.value;
  if (!stored || !flow || flow.expires <= Date.now() || flow.stage !== 'pending' || flow.provider !== req.params.provider) { res.status(400).type('text').send('로그인 요청이 만료되었거나 이미 처리되었습니다. 앱에서 다시 시작해 주세요.'); return; }
  try {
    flow.stage = 'exchanging';
    if (!await flowStore.update(parsed.data.state, stored.revision, flow)) { res.status(409).type('text').send('이미 처리 중인 로그인입니다. 앱으로 돌아가 주세요.'); return; }
    if (!parsed.data.code || parsed.data.error) throw new Error('Authorization cancelled');
    const identity = await identityForCode(flow.provider, parsed.data.code, flow);
    const existing = await prisma.oAuthIdentity.findUnique({ where: { provider_subject: { provider: flow.provider, subject: identity.subject } }, include: { user: true } });
    // Existing users receive an authenticated session even without current consent,
    // so they can read/delete their data. Clients and account-write middleware gate continued use.
    if (existing) { flow.userId = existing.userId; flow.stage = 'complete'; }
    else { flow.identity = identity; flow.stage = 'consent'; }
    if (!await flowStore.update(parsed.data.state, stored.revision + 1, flow)) throw new Error('OAuth request expired');
    if (process.env.API_RUNTIME === 'supabase-edge') res.type('text').send('뚜버기 로그인 인증이 완료되었습니다.\n이 창을 닫고 뚜버기 앱으로 돌아가 주세요.');
    else res.type('html').send('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width"><meta charset="utf-8"><title>뚜버기 로그인</title><body><h1>로그인이 완료되었습니다.</h1><p>이 창을 닫고 뚜버기 앱으로 돌아가 주세요.</p></body></html>');
  } catch { flow.stage = 'failed'; await flowStore.update(parsed.data.state, stored.revision + 1, flow).catch(()=>false); res.status(400).type('text').send('로그인을 완료하지 못했습니다. 앱으로 돌아가 다시 시도해 주세요.'); }
});
socialRouter.post('/consent', async (req, res, next) => {
  try {
    const body = consentSchema.extend({ flowId: z.string().length(64), pollSecret: z.string().length(64) }).parse(req.body);
    const stored = await authenticatedFlow(body.flowId, body.pollSecret), flow = stored?.value;
    if (!stored || !flow || flow.stage !== 'consent' || !flow.identity) { res.status(400).json({ error: '로그인 요청이 만료되었습니다. 다시 로그인해 주세요.' }); return; }
    flow.stage = 'exchanging';
    if (!await flowStore.update(body.flowId, stored.revision, flow)) { res.status(409).json({ error: '이미 처리 중인 로그인입니다.' }); return; }
    try { flow.userId = await persistConsentedIdentity(flow.provider, flow.identity); flow.identity = undefined; flow.stage = 'complete';
      if (!await flowStore.update(body.flowId, stored.revision + 1, flow)) throw new Error('OAuth request expired');
    } catch (error) { flow.stage = 'failed'; await flowStore.update(body.flowId, stored.revision + 1, flow).catch(()=>false); throw error; }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ status: 'complete' });
  } catch (error) { next(error); }
});
socialRouter.post('/result', pollLimiter, async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const body = z.object({ flowId: z.string().length(64), pollSecret: z.string().length(64) }).parse(req.body);
    const stored = await authenticatedFlow(body.flowId, body.pollSecret), flow = stored?.value;
    if (!stored || !flow) { res.status(400).json({ error: '로그인 요청이 만료되었습니다.' }); return; }
    if (flow.stage === 'failed') { await flowStore.remove(body.flowId, stored.revision); res.status(400).json({ error: '로그인이 취소되었거나 설정을 확인해야 합니다.' }); return; }
    if (flow.stage === 'consent') { res.json({ status: 'consent_required', consentVersion: PRIVACY_NOTICE_VERSION }); return; }
    if (flow.stage !== 'complete' || !flow.userId) { res.json({ status: 'pending' }); return; }
    const user = await prisma.user.findUnique({ where: { id: flow.userId } });
    if (!user) { res.status(401).json({ error: '계정을 찾을 수 없습니다.' }); return; }
    if (!await flowStore.remove(body.flowId, stored.revision)) { res.status(400).json({ error: '이미 수령했거나 만료된 로그인입니다. 다시 로그인해 주세요.' }); return; }
    const { password: _, ...safeUser } = user;
    res.json({ status: 'complete', user: safeUser, ...generateTokenPair(user.id, user.email, user.tokenVersion) });
  } catch (error) { next(error); }
});
