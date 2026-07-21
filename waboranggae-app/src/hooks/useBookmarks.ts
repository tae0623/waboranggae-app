import { useState, useCallback } from 'react';
import { apiClient, ApiError } from '../services/apiClient';

interface Bookmark {
  id: string;
  userId: string;
  courseId: string;
  courseName: string;
  city: string;
  createdAt: string;
}

interface UseBookmarksState {
  bookmarks: Bookmark[];
  loading: boolean;
  error: string | null;
}

interface UseBookmarksActions {
  add: (courseId: string, courseName: string, city: string) => Promise<void>;
  remove: (courseId: string) => Promise<void>;
  fetchList: (options?: { city?: string; limit?: number }) => Promise<void>;
  isBookmarked: (courseId: string) => Promise<boolean>;
  clear: () => void;
}

/**
 * 코스 북마크 관리 hook
 *
 * 사용 예시:
 * ```tsx
 * const { bookmarks, loading, error, add, remove, fetchList } = useBookmarks(userId);
 *
 * // 북마크 추가
 * await add('tour-순천-1', '순천 정원 투어', '순천');
 *
 * // 북마크 목록 조회
 * await fetchList({ city: '순천' });
 *
 * // 북마크 제거
 * await remove('tour-순천-1');
 * ```
 */
export function useBookmarks(userId: string | null): UseBookmarksState & UseBookmarksActions {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 북마크 추가
  const add = useCallback(
    async (courseId: string, courseName: string, city: string) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.bookmarks.add(userId, { courseId, courseName, city });
        setBookmarks((prev) => [response as Bookmark, ...prev]);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '북마크 추가 실패';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // 북마크 제거
  const remove = useCallback(
    async (courseId: string) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await apiClient.bookmarks.remove(userId, courseId);
        setBookmarks((prev) => prev.filter((b) => b.courseId !== courseId));
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '북마크 제거 실패';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // 북마크 목록 조회
  const fetchList = useCallback(
    async (options?: { city?: string; limit?: number }) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.bookmarks.list(userId, options);
        setBookmarks(response as Bookmark[]);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '북마크 조회 실패';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // 특정 코스 북마크 여부 확인
  const isBookmarked = useCallback(
    async (courseId: string): Promise<boolean> => {
      if (!userId) {
        return false;
      }

      try {
        const response = await apiClient.bookmarks.isBookmarked(userId, courseId);
        return (response as { isBookmarked: boolean }).isBookmarked;
      } catch (err) {
        console.warn('북마크 확인 실패:', err);
        return false;
      }
    },
    [userId],
  );

  // 상태 초기화
  const clear = useCallback(() => {
    setBookmarks([]);
    setError(null);
  }, []);

  return {
    bookmarks,
    loading,
    error,
    add,
    remove,
    fetchList,
    isBookmarked,
    clear,
  };
}
