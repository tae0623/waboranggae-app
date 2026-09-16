import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), find: vi.fn() }));
vi.mock('../server/src/auth/jwt', () => ({verifyAccessToken:mocks.verify}));
vi.mock('../server/src/db/client', () => ({prisma:{user:{findUnique:mocks.find}}}));
import { authenticateToken } from '../server/src/middleware/auth';
beforeEach(() => { vi.clearAllMocks(); mocks.verify.mockReturnValue({userId:'test-id',tokenVersion:2}); });
async function request(header = 'Bearer test-token') {
  const req:any={headers:{authorization:header}},res:any={status:vi.fn().mockReturnThis(),json:vi.fn()},next=vi.fn();
  await authenticateToken(req,res,next); return {req,res,next};
}
describe('삭제/무효화된 계정 토큰 차단', () => {
  it('Bearer가 아닌 헤더는 거부', async()=>{const r=await request('Basic test-token');expect(r.res.status).toHaveBeenCalledWith(401);expect(mocks.find).not.toHaveBeenCalled();});
  it('삭제된 계정은 기존 JWT가 유효해도 거부', async()=>{mocks.find.mockResolvedValue(null);const r=await request();expect(r.res.status).toHaveBeenCalledWith(401);expect(r.next).not.toHaveBeenCalled();});
  it('버전이 무효화된 토큰은 거부', async()=>{mocks.find.mockResolvedValue({id:'test-id',tokenVersion:3});const r=await request();expect(r.res.status).toHaveBeenCalledWith(401);});
  it('정상 계정만 다음 단계로 전달', async()=>{mocks.find.mockResolvedValue({id:'test-id',tokenVersion:2});const r=await request();expect(r.req.user.userId).toBe('test-id');expect(r.next).toHaveBeenCalledWith();});
  it('DB 장애 시 인증을 우회하지 않음', async()=>{const error=new Error('DB unavailable');mocks.find.mockRejectedValue(error);const r=await request();expect(r.req.user).toBeUndefined();expect(r.next).toHaveBeenCalledWith(error);});
});
