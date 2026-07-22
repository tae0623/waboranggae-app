import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BookmarkQueries, SearchHistoryQueries, UserQueries } from '../../db/queries';
import { travelPreferencesSchema } from '../shared/schemas';

export const userRouter = Router();

/**
 * JWT 미들웨어에서 설정한 req.user에서 사용자 ID 추출
 */
function extractUserId(request: Request): string {
  const userId = request.user?.userId;
  if (!userId) {
    throw new Error('인증이 필요합니다');
  }
  return userId;
}

/**
 * PATCH /api/user/profile
 * 현재 사용자 표시 이름 수정
 */
userRouter.patch('/user/profile', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const body = z.object({
      displayName: z.string().min(2).max(50),
    }).parse(request.body);

    const user = await UserQueries.updateDisplayName(userId, body.displayName);
    response.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/me
 * 현재 사용자 정보 조회
 */
userRouter.get('/user/me', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const user = await UserQueries.getUserById(userId);

    if (!user) {
      response.status(404).json({ error: 'User not found' });
      return;
    }

    response.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/user/me
 * 계정 삭제
 */
userRouter.delete('/user/me', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    await UserQueries.deleteUser(userId);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/user/bookmarks/add
 * 코스 북마크 추가
 */
userRouter.post('/user/bookmarks/add', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const body = z.object({
      courseId: z.string(),
      courseName: z.string(),
      city: z.string(),
    }).parse(request.body);

    const bookmark = await BookmarkQueries.addBookmark(userId, body.courseId, body.courseName, body.city);
    response.status(201).json(bookmark);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/user/bookmarks/:courseId
 * 코스 북마크 제거
 */
userRouter.delete('/user/bookmarks/:courseId', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const courseId = z.string().parse(request.params.courseId);

    await BookmarkQueries.removeBookmark(userId, courseId);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/bookmarks
 * 사용자의 북마크 목록 조회
 */
userRouter.get('/user/bookmarks', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const city = request.query.city as string | undefined;
    const limit = request.query.limit ? Number(request.query.limit) : undefined;

    const bookmarks = await BookmarkQueries.getUserBookmarks(userId, { city, limit });
    response.json(bookmarks);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/bookmarks/:courseId/is-bookmarked
 * 특정 코스 북마크 여부 확인
 */
userRouter.get('/user/bookmarks/:courseId/is-bookmarked', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const courseId = z.string().parse(request.params.courseId);

    const isBookmarked = await BookmarkQueries.isBookmarked(userId, courseId);
    response.json({ isBookmarked });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/user/search-history
 * 검색 이력 기록
 */
userRouter.post('/user/search-history', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const body = z.object({
      query: z.string(),
      preferences: travelPreferencesSchema,
    }).parse(request.body);

    const history = await SearchHistoryQueries.recordSearch(userId, body.query, body.preferences);
    response.status(201).json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/search-history
 * 검색 이력 조회
 */
userRouter.get('/user/search-history', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const limit = request.query.limit ? Number(request.query.limit) : 10;

    const history = await SearchHistoryQueries.getUserSearchHistory(userId, limit);
    response.json(history);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/user/search-history/frequent-cities
 * 자주 검색한 도시 조회
 */
userRouter.get('/user/search-history/frequent-cities', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const limit = request.query.limit ? Number(request.query.limit) : 5;

    const cities = await SearchHistoryQueries.getFrequentCities(userId, limit);
    response.json(cities);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/user/search-history/:historyId
 * 검색 이력 삭제 (개별)
 */
userRouter.delete('/user/search-history/:historyId', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);
    const historyId = z.string().parse(request.params.historyId);

    await SearchHistoryQueries.deleteSearchHistory(userId, historyId);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/user/search-history
 * 검색 이력 전체 삭제
 */
userRouter.delete('/user/search-history', async (request: Request, response: Response, next: NextFunction) => {
  try {
    const userId = extractUserId(request);

    await SearchHistoryQueries.deleteSearchHistory(userId);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
