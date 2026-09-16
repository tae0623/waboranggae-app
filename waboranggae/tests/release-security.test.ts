import { beforeEach, describe, expect, it, vi } from 'vitest';
const database = vi.hoisted(() => ({ deleteMany: vi.fn(), upsert: vi.fn() }));
vi.mock('../server/src/db/client', () => ({ prisma: { searchHistory: { deleteMany: database.deleteMany }, bookmark: { upsert: database.upsert } } }));
import { SearchHistoryQueries } from '../server/src/db/queries/search-history';
import { BookmarkQueries } from '../server/src/db/queries/bookmark';
import { validatePasswordRequirements } from '../server/src/utils/crypto';
import { classifyTourItemCategory, classifyTourItemTags } from '../server/src/modules/recommendation/data/tour-api';
beforeEach(() => vi.clearAllMocks());
describe('실계정 테스트 전 보안 회귀', () => {
  it('관광지 대분류 12를 모두 자연 관광으로 오인하지 않음', () => {
    const experience = {contenttypeid:'12',cat1:'A02',cat2:'A0203',title:'드로잉라이프'};
    expect(classifyTourItemCategory(experience)).toBe('culture');
    expect(classifyTourItemTags(experience)).not.toContain('nature');
    expect(classifyTourItemCategory({contenttypeid:'12',cat1:'A01'})).toBe('nature');
  });
  it('개별 검색 이력 삭제는 사용자 ID를 함께 검사', async () => {
    await SearchHistoryQueries.deleteSearchHistory('owner-a', 'history-b');
    expect(database.deleteMany).toHaveBeenCalledWith({ where: { id: 'history-b', userId: 'owner-a' } });
  });
  it('북마크 반복 저장은 해당 소유자의 코스만 갱신', async () => {
    await BookmarkQueries.addBookmark('a','course','title','순천',{id:'course'});
    expect(database.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{userId_courseId:{userId:'a',courseId:'course'}}, update:expect.objectContaining({snapshot:{id:'course'}})}));
  });
  it('bcrypt가 무시하는 72바이트 뒤 비밀번호를 허용하지 않음', () => {
    expect(validatePasswordRequirements('Aa1!'+'x'.repeat(69))).toContain('72바이트');
    expect(validatePasswordRequirements('Aa1!'+'가'.repeat(24))).toContain('72바이트');
    expect(validatePasswordRequirements('SafePassword!12')).toBeNull();
  });
});
