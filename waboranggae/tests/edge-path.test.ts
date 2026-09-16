import { afterEach, describe, expect, it, vi } from 'vitest';
import { edgePathPrefix, EDGE_PUBLIC_PATH, stripEdgePath } from '../server/src/runtime/edge-path';
import { permanentApiBase } from '../server/src/runtime/production-config';
import { edgeValidation, validDeviceValidation } from '../server/src/runtime/edge-validation';
import { createHash } from 'node:crypto';
afterEach(() => vi.unstubAllEnvs());
describe('Edge API base path', () => {
  it.each([EDGE_PUBLIC_PATH, '/waboranggae-api'])('keeps route and query under %s', prefix => {
    expect(stripEdgePath(prefix + '/api/recommend?city=x')).toBe('/api/recommend?city=x');
    expect(stripEdgePath(prefix)).toBe('/');
    expect(stripEdgePath(prefix + '?a=b')).toBe('/?a=b');
  });
  it.each(['/api/recommend', '/functions/v1/another/api', '/waboranggae-api-extra/api'])('rejects another base: %s', value => {
    expect(stripEdgePath(value)).toBeNull();
  });
  it('does not alter the existing Node server', () => {
    vi.stubEnv('API_RUNTIME', 'node');
    const req = {url:'/api/recommend'}, next = vi.fn();
    edgePathPrefix(req as never, {} as never, next);
    expect(req.url).toBe('/api/recommend'); expect(next).toHaveBeenCalledOnce();
  });
  it('accepts only the expected Supabase function base in edge mode', () => {
    const base = 'https://abcdefghijklmnopqrst.supabase.co' + EDGE_PUBLIC_PATH;
    expect(permanentApiBase(base, 'supabase-edge')).toBe(true);
    expect(permanentApiBase(base + '/', 'supabase-edge')).toBe(true);
    expect(permanentApiBase(base, 'node')).toBe(false);
    for (const value of [base + '/other', base + '?key=x', base.replace('supabase.co','evil.org')]) {
      expect(permanentApiBase(value, 'supabase-edge')).toBe(false);
    }
  });
});
describe('Cloud validation access gate', () => {
  it('limits the expiring device key to guest APIs, never account operations', () => {
    const token='a'.repeat(64),now=Date.now();
    vi.stubEnv('EDGE_DEVICE_VALIDATION_HASH',createHash('sha256').update(token).digest('hex'));
    vi.stubEnv('EDGE_DEVICE_VALIDATION_EXPIRES_AT',new Date(now+1000).toISOString());
    expect(validDeviceValidation('POST','/api/recommend',token,now)).toBe(true);
    expect(validDeviceValidation('GET','/api/media/tour-image',token,now)).toBe(true);
    expect(validDeviceValidation('POST','/auth/login',token,now)).toBe(false);
    expect(validDeviceValidation('DELETE','/api/user/me',token,now)).toBe(false);
    expect(validDeviceValidation('GET','/api/user/me',token,now)).toBe(false);
    expect(validDeviceValidation('POST','/api/recommend','b'.repeat(64),now)).toBe(false);
    expect(validDeviceValidation('POST','/api/recommend',token,now+1001)).toBe(false);
  });
  it('rejects absent, invalid, and unconfigured credentials', () => {
    vi.stubEnv('API_RUNTIME','supabase-edge'); vi.stubEnv('EDGE_VALIDATION_MODE','true');
    vi.stubEnv('EDGE_VALIDATION_KEY','test-key-'.repeat(5));
    for(const key of ['', 'wrong', 'x'.repeat(45)]){
      const res={status:vi.fn().mockReturnThis(),set:vi.fn().mockReturnThis(),json:vi.fn()}, next=vi.fn();
      edgeValidation({path:'/auth/login',get:()=>key} as never,res as never,next);
      expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
    }
  });
  it('admits a separate account-test credential without extending the guest credential', () => {
    const token='c'.repeat(64),guest='d'.repeat(64),now=Date.now();
    vi.stubEnv('EDGE_ACCOUNT_VALIDATION_HASH',createHash('sha256').update(token).digest('hex'));
    vi.stubEnv('EDGE_ACCOUNT_VALIDATION_EXPIRES_AT',new Date(now+1000).toISOString());
    vi.stubEnv('EDGE_DEVICE_VALIDATION_HASH',createHash('sha256').update(guest).digest('hex'));
    vi.stubEnv('EDGE_DEVICE_VALIDATION_EXPIRES_AT',new Date(now+1000).toISOString());
    for(const [method,path] of [['POST','/auth/signup'],['POST','/auth/login'],['POST','/auth/social/google/start'],['POST','/auth/social/result'],['GET','/api/user/me'],['DELETE','/api/user/bookmarks/fixture'],['POST','/api/recommend']] as const) {
      expect(validDeviceValidation(method,path,token,now)).toBe(true);
    }
    expect(validDeviceValidation('POST','/auth/login',guest,now)).toBe(false);
    expect(validDeviceValidation('POST','/auth/login',token,now+1001)).toBe(false);
    for(const [method,path] of [['GET','/admin'],['GET','/api/user/all'],['GET','/health'],['POST','/auth/social/apple/start'],['PUT','/api/user/me']] as const) {
      expect(validDeviceValidation(method,path,token,now)).toBe(false);
    }
  });
  it('allows only exact provider GET callbacks to reach their own state validation', () => {
    vi.stubEnv('API_RUNTIME','supabase-edge');vi.stubEnv('EDGE_VALIDATION_MODE','true');
    for(const path of ['/auth/social/kakao/callback','/auth/social/google/callback']) {
      const next=vi.fn();edgeValidation({method:'GET',path,get:()=>''} as never,{} as never,next);expect(next).toHaveBeenCalledOnce();
    }
    for(const [method,path] of [['POST','/auth/social/google/callback'],['GET','/auth/social/apple/callback'],['GET','/auth/social/google/start'],['POST','/auth/social/result']]) {
      const next=vi.fn(),res={status:vi.fn().mockReturnThis(),set:vi.fn().mockReturnThis(),json:vi.fn()};
      edgeValidation({method,path,get:()=>''} as never,res as never,next);expect(next).not.toHaveBeenCalled();expect(res.status).toHaveBeenCalledWith(403);
    }
  });
  it('allows the server-side verification key and public liveness', () => {
    vi.stubEnv('API_RUNTIME','supabase-edge'); vi.stubEnv('EDGE_VALIDATION_MODE','true');
    const key='test-key-'.repeat(5);vi.stubEnv('EDGE_VALIDATION_KEY',key);
    for(const [route,value] of [['/auth/login',key],['/livez','']]){
      const next=vi.fn();edgeValidation({path:route,get:()=>value} as never,{} as never,next);
      expect(next).toHaveBeenCalledOnce();
    }
  });
});
