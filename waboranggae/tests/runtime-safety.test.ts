import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock('../server/src/db/client', () => ({ prisma: { $queryRaw: db.query, $executeRaw: db.execute } }));
import { openFlow, sealFlow } from '../server/src/auth/flow-store';
import { OptionalServiceGate } from '../server/src/runtime/bulkhead';
import { permanentHttps, productionProblems } from '../server/src/runtime/production-config';
import { koreaDay, reserveDailyQuota } from '../server/src/runtime/quota';

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('암호화된 OAuth 임시 저장', () => {
  it('평문을 노출하지 않고 매번 다른 암호문을 생성한다', () => {
    vi.stubEnv('OAUTH_FLOW_ENCRYPTION_KEY', 'unit-only-'.repeat(5));
    const value = { name: '테스트 사용자', secret: 'not-a-real-secret' };
    const first = sealFlow(value, 'flow-1'), second = sealFlow(value, 'flow-1');
    expect(first).not.toBe(second); expect(first).not.toContain(value.secret);
    expect(openFlow(first, 'flow-1')).toEqual(value);
  });
  it('다른 flow로 복사하거나 변조한 인증 정보는 거부한다', () => {
    vi.stubEnv('OAUTH_FLOW_ENCRYPTION_KEY', 'unit-only-'.repeat(5));
    const encoded = sealFlow({ user: 'test' }, 'flow-1');
    expect(() => openFlow(encoded, 'flow-2')).toThrow();
    const bytes = Buffer.from(encoded, 'base64'); bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    expect(() => openFlow(bytes.toString('base64'), 'flow-1')).toThrow();
    expect(() => openFlow('short', 'flow-1')).toThrow();
  });
  it('암호화 키가 없거나 너무 짧으면 저장하지 않는다', () => {
    vi.stubEnv('OAUTH_FLOW_ENCRYPTION_KEY', 'short'); vi.stubEnv('JWT_SECRET', '');
    expect(() => sealFlow({}, 'flow')).toThrow();
  });
});

describe('출시 환경 보호', () => {
  it.each(['http://api.waboranggae.kr','https://localhost','https://172.16.0.1','https://[fc00::1]',
    'https://10.0.0.1','https://169.254.169.254','https://127.0.0.1','https://a.trycloudflare.com',
    'https://a.ngrok-free.app','https://api.example.com','https://api.waboranggae.kr/path',
    'https://secret@api.waboranggae.kr','https://api.waboranggae.kr?key=x','https://api.waboranggae.kr:8080'])
  ('운영 origin으로 %s를 거부한다', value => expect(permanentHttps(value)).toBe(false));
  it('고정 HTTPS 후보만 통과한다 (실제 DNS/가용성 검증은 별도)', () => expect(permanentHttps('https://api.waboranggae.kr')).toBe(true));
  it('개발 설정은 기존 로컬 테스트를 막지 않는다', () => expect(productionProblems({ NODE_ENV: 'development' })).toEqual([]));
  it('운영 모드의 위험한 설정을 명시적으로 차단한다', () => {
    expect(productionProblems({NODE_ENV:'production', PUBLIC_APP_URL:'https://a.trycloudflare.com',
      TEAM_ACCESS_KEY:'test', TRUST_PROXY:'0.0.0.0/0'})).toHaveLength(6);
  });
});

describe('Ollama 보조 기능 과부하 격리', () => {
  it('동시 요청은 대기열 없이 바로 기본 분석으로 돌린다', () => {
    const gate = new OptionalServiceGate();
    expect(gate.acquire(0)).toBe(true); expect(gate.acquire(0)).toBe(false);
    gate.release(true, 1); expect(gate.acquire(2)).toBe(true);
  });
  it('연속 실패 뒤에는 30초 쉬고 복구를 시도한다', () => {
    const gate = new OptionalServiceGate();
    gate.acquire(0); gate.release(false, 1); gate.acquire(2); gate.release(false, 3);
    expect(gate.acquire(30002)).toBe(false); expect(gate.acquire(30003)).toBe(true);
    gate.release(true, 30004); expect(gate.acquire(30005)).toBe(true);
  });
});

describe('공유 API 호출량 예약', () => {
  it('한국 날짜 경계로 일일 한도를 구분한다', () => {
    expect(koreaDay(new Date('2026-09-15T14:59:59Z'))).toBe('2026-09-15');
    expect(koreaDay(new Date('2026-09-15T15:00:00Z'))).toBe('2026-09-16');
  });
  it('한도 초과 및 저장 실패는 외부 호출을 차단한다', async () => {
    db.query.mockResolvedValueOnce([{ count: 1 }]).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await reserveDailyQuota('test:api', 2)).toBe(true);
    expect(await reserveDailyQuota('test:api', 2)).toBe(false);
    expect(await reserveDailyQuota('test:api', 2)).toBe(false);
  });
  it('잘못된 한도는 DB에 전달하지 않는다', async () => {
    expect(await reserveDailyQuota('test', 0)).toBe(false); expect(await reserveDailyQuota('test', 1.5)).toBe(false);
    expect(await reserveDailyQuota('test;drop', 1)).toBe(false); expect(db.query).not.toHaveBeenCalled();
  });
});

describe('DB 준비 상태', () => {
  beforeEach(() => vi.resetModules());
  it('필수 테이블이 모두 있을 때만 준비 완료다', async () => {
    db.query.mockResolvedValue([{ flows: 'oauth_flows', quotas: 'api_quota_buckets', users: 'users' }]);
    const { databaseReady } = await import('../server/src/runtime/health');
    expect(await databaseReady()).toBe(true);
  });
  it('연결 실패를 정상 상태로 표시하지 않는다', async () => {
    db.query.mockRejectedValue(new Error('not reachable'));
    const { databaseReady } = await import('../server/src/runtime/health');
    expect(await databaseReady()).toBe(false);
  });
  it('마이그레이션 누락은 준비 실패다', async () => {
    db.query.mockResolvedValue([{ flows: null, quotas: null, users: 'users' }]);
    const { databaseReady } = await import('../server/src/runtime/health');
    expect(await databaseReady()).toBe(false);
  });
  it('DB 응답 지연은 제한 시간 안에 실패하며 중복 확인은 합친다', async () => {
    db.query.mockReturnValue(new Promise(() => {}));
    const { databaseReady } = await import('../server/src/runtime/health');
    expect(await Promise.all([databaseReady(15), databaseReady(15)])).toEqual([false, false]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
  it('종료 중이면 캐시가 정상이어도 준비 실패다', async () => {
    db.query.mockResolvedValue([{ flows: 'oauth_flows', quotas: 'api_quota_buckets', users: 'users' }]);
    const { databaseReady, beginShutdown } = await import('../server/src/runtime/health');
    expect(await databaseReady()).toBe(true); beginShutdown(); expect(await databaseReady()).toBe(false);
  });
});
