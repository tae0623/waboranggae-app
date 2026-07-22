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

export interface UseSearchHistoryState {
  history: SearchHistoryItem[];
  frequentCities: FrequentCity[];
  loading: boolean;
  error: string | null;
}

export interface UseSearchHistoryActions {
  record: (query: string, preferences: TravelPreferences) => Promise<void>;
  fetch: (limit?: number) => Promise<void>;
  fetchFrequentCities: (limit?: number) => Promise<void>;
  delete: (historyId?: string) => Promise<void>;
  clear: () => void;
}

/**
 * 검색 이력 관리 hook (JWT Authorization 헤더 사용)
 */
export function useSearchHistory(userId: string | null): UseSearchHistoryState & UseSearchHistoryActions {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [frequentCities, setFrequentCities] = useState<FrequentCity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = useCallback(
    async (query: string, preferences: TravelPreferences) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      try {
        const response = await apiClient.searchHistory.record({ query, preferences });
        setHistory((prev) => [response as SearchHistoryItem, ...prev]);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : '검색 이력 저장 실패';
        setError(message);
        console.warn(message);
      }
    },
    [userId],
  );

  const fetch = useCallback(
    async (limit?: number) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.searchHistory.list(limit);
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

  const fetchFrequentCities = useCallback(
    async (limit?: number) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.searchHistory.frequentCities(limit);
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

  const deleteHistory = useCallback(
    async (historyId?: string) => {
      if (!userId) {
        setError('로그인이 필요합니다');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await apiClient.searchHistory.delete(historyId);
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
