import { useState, useCallback } from 'react';
import { apiClient, ApiError } from '../services/apiClient';
import { TravelPreferences } from '../types/travel';

interface SearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  city?: string;
  pace?: string;
  createdAt: string;
}

interface FrequentCity {
  city: string;
  _count: number;
}

interface UseSearchHistoryState {
  history: SearchHistoryItem[];
  frequentCities: FrequentCity[];
  loading: boolean;
  error: string | null;
}

interface UseSearchHistoryActions {
  record: (query: string, preferences: TravelPreferences) => Promise<void>;
  fetch: (limit?: number) => Promise<void>;
  fetchFrequentCities: (limit?: number) => Promise<void>;
  delete: (historyId?: string) => Promise<void>;
  clear: () => void;
}

/**
 * 검색 이력 관리 hook
 *
 * 사용 예시:
 * ```tsx
 * const { history, frequentCities, record, fetch } = useSearchHistory(userId);
 *
 * // 검색 이력 기록
 * await record('순천 정원 투어', preferences);
 *
 * // 검색 이력 조회
 * await fetch(10);
 *
 * // 자주 검색한 도시
 * await fetchFrequentCities(5);
 * ```
 */
export function useSearchHistory(userId: string | null): UseSearchHistoryState & UseSearchHistoryActions {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [frequentCities, setFrequentCities] = useState<FrequentCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 검색 이력 기록
  const record = useCallback(
    async (query: string, preferences: TravelPreferences) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      try {
        const response = await apiClient.searchHistory.record(userId, { query, preferences });
        setHistory((prev) => [response as SearchHistoryItem, ...prev]);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '검색 이력 저장 실패';
        setError(message);
        // 검색 이력 실패는 조용히 무시 (사용자 경험에 영향 없음)
        console.warn(message);
      }
    },
    [userId],
  );

  // 검색 이력 조회
  const fetch = useCallback(
    async (limit?: number) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.searchHistory.list(userId, limit);
        setHistory(response as SearchHistoryItem[]);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '검색 이력 조회 실패';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // 자주 검색한 도시 조회
  const fetchFrequentCities = useCallback(
    async (limit?: number) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.searchHistory.frequentCities(userId, limit);
        // Prisma의 groupBy 결과 변환
        setFrequentCities(
          (response as any[]).map((item) => ({
            city: item.city,
            _count: item._count,
          })),
        );
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '자주 검색한 도시 조회 실패';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // 검색 이력 삭제 (개별 또는 전체)
  const deleteHistory = useCallback(
    async (historyId?: string) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await apiClient.searchHistory.delete(userId, historyId);
        if (historyId) {
          setHistory((prev) => prev.filter((h) => h.id !== historyId));
        } else {
          setHistory([]);
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '검색 이력 삭제 실패';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  // 상태 초기화
  const clear = useCallback(() => {
    setHistory([]);
    setFrequentCities([]);
    setError(null);
  }, []);

  return {
    history,
    frequentCities,
    loading,
    error,
    record,
    fetch,
    fetchFrequentCities,
    delete: deleteHistory,
    clear,
  };
}
