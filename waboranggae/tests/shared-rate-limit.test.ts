import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const db=vi.hoisted(()=>({query:vi.fn(),execute:vi.fn()}));
vi.mock('../server/src/db/client',()=>({prisma:{$queryRaw:db.query,$executeRaw:db.execute}}));
import {normalizedNetwork,edgeClientNetwork,PostgresRateStore,sharedRateLimit} from '../server/src/middleware/sharedRateLimit';
const req=(headers:Record<string,string>)=>({get:(key:string)=>headers[key.toLowerCase()],method:'GET',originalUrl:'/api/places/search',ip:'127.0.0.1'}) as any;
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('API_RUNTIME','supabase-edge');vi.stubEnv('EDGE_CLIENT_IP_HEADER','cf-connecting-ip');vi.stubEnv('JWT_SECRET','test-rate-only-'.repeat(4));});
afterEach(()=>vi.unstubAllEnvs());
describe('공개 서버 요청 제한',()=>{
  it('공유 프록시 IP 대신 검증된 연결 주소를 사용한다',()=>{
    const a=req({'cf-connecting-ip':'192.0.2.1','x-forwarded-for':'192.0.2.1, 10.0.0.1'});
    const b=req({'cf-connecting-ip':'192.0.2.2','x-forwarded-for':'192.0.2.2, 10.0.0.1'});
    expect(edgeClientNetwork(a)).not.toBe(edgeClientNetwork(b));
  });
  it('인증되지 않은 팀 헤더·XFF 변경으로 제한을 회피할 수 없다',()=>{
    expect(edgeClientNetwork(req({'cf-connecting-ip':'192.0.2.1','x-forwarded-for':'192.0.2.1','x-team-client-ip':'192.0.2.9'}))).toBe('192.0.2.1');
    expect(()=>edgeClientNetwork(req({'cf-connecting-ip':'192.0.2.1','x-forwarded-for':'192.0.2.9'}))).toThrow();
    expect(()=>edgeClientNetwork(req({}))).toThrow();
    vi.stubEnv('API_RUNTIME','node');expect(()=>edgeClientNetwork(req({}))).toThrow();
  });
  it('IPv6는 /64로 묶고 같은 주소의 다른 표현은 정규화한다',()=>{
    expect(normalizedNetwork('2001:db8:1:2::1')).toBe(normalizedNetwork('2001:0db8:0001:0002::9'));
    expect(normalizedNetwork('::ffff:192.0.2.1')).toBe('192.0.2.1');
    for(const invalid of ['unknown','192.0.2.1:80','fe80::1%eth0',''])expect(()=>normalizedNetwork(invalid)).toThrow();
  });
  it('카운터를 원자적으로 갱신하고 서로 다른 기능의 키를 분리한다',async()=>{
    db.query.mockResolvedValue([{count:2,expires_at:new Date('2026-09-18T01:00:00Z')}]);
    const store=new PostgresRateStore('fixture',60_000,3);
    expect((await store.increment('digest')).totalHits).toBe(2);
    const [sql,...values]=db.query.mock.calls[0]!;
    expect(sql.join('')).toContain('ON CONFLICT (key) DO UPDATE');
    expect(values).toContain('rl:fixture:digest');expect(values).toContain(4);
    await store.decrement('digest');expect(db.execute.mock.calls.at(-1)![0].join('')).toContain('GREATEST(count-1,0)');
  });
  it('DB 장애는 제한 우회가 아닌 서비스 일시 중단으로 처리한다',async()=>{
    db.query.mockRejectedValue(new Error('private connection error'));
    const limit=sharedRateLimit('failure-fixture',{windowMs:60_000,max:3,standardHeaders:true,legacyHeaders:false});
    const response:any={status:vi.fn().mockReturnThis(),set:vi.fn().mockReturnThis(),json:vi.fn(),setHeader:vi.fn(),on:vi.fn()};
    const next=vi.fn();
    await limit(req({'cf-connecting-ip':'192.0.2.1','x-forwarded-for':'192.0.2.1'}),response,next);
    expect(response.status).toHaveBeenCalledWith(503);expect(next).not.toHaveBeenCalled();
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('private connection');
    expect(JSON.stringify(db.query.mock.calls)).not.toContain('192.0.2.1');
  });
});
