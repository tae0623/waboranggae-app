import { describe, expect, it } from 'vitest';
// @ts-ignore Plain Node helper, deliberately independent from the live .env file.
import { supabaseConnection } from '../scripts/check-supabase.mjs';
const uri = 'postgresql://postgres.test:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres';
describe('Supabase 연결 설정 (실제 서버 호출 없음)', () => {
  it('별도로 입력한 비밀번호의 특수문자를 안전하게 인코딩한다', () => {
    const password = 'unit-only:@/#%';
    const url = new URL(supabaseConnection({ DATABASE_URL: uri, SUPABASE_DB_PASSWORD: password }));
    expect(decodeURIComponent(url.password)).toBe(password);
  });
  it('검증 우회 URI 옵션을 제거한다', () => {
    const url = new URL(supabaseConnection({ DATABASE_URL: uri + '?sslmode=disable', SUPABASE_DB_PASSWORD: 'unit-only' }));
    expect(url.searchParams.has('sslmode')).toBe(false);
  });
  it('쿼리 문자열로 DB 목적지나 사용자를 바꾸지 못한다', () => {
    const url = new URL(supabaseConnection({ DATABASE_URL: uri + '?host=attacker.test&user=attacker', SUPABASE_DB_PASSWORD: 'unit-only' }));
    expect(url.search).toBe(''); expect(url.hostname).toBe('aws-0-ap-northeast-2.pooler.supabase.com');
    expect(url.username).toBe('postgres.test');
  });
  it.each([uri.replace(':5432', ':6543'),uri.replace('pooler.supabase.com','pooler.supabase.com.attacker.test'),
    'postgresql://user:pass@localhost:5432/postgres'])('허용하지 않은 DB 목적지를 거부한다: %s', value => {
    expect(() => supabaseConnection({ DATABASE_URL:value, SUPABASE_DB_PASSWORD:'unit-only' })).toThrow();
  });
  it('빈 설정이나 미입력 비밀번호는 전송하지 않는다', () => {
    expect(() => supabaseConnection({})).toThrow('DATABASE_URL_MISSING');
    expect(() => supabaseConnection({ DATABASE_URL: uri })).toThrow('DB_PASSWORD_MISSING');
  });
});
