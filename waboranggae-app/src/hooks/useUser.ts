import { useState, useCallback, useEffect } from 'react';
import { apiClient, ApiError } from '../services/apiClient';

interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

interface UseUserState {
  user: User | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
}

interface UseUserActions {
  login: (email: string, displayName?: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

/**
 * 사용자 인증 및 프로필 관리 hook
 *
 * 사용 예시:
 * ```tsx
 * const { user, userId, loading, error, login, logout } = useUser();
 *
 * // 로그인
 * await login('user@example.com', '홍길동');
 *
 * // 현재 사용자 정보 조회
 * const user = user;
 *
 * // 로그아웃
 * logout();
 * ```
 */
export function useUser(): UseUserState & UseUserActions {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인 (프로필 생성/수정)
  const login = useCallback(async (email: string, displayName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.user.profile({ email, displayName });
      setUser(response as User);
      setUserId(response.id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '로그인 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 현재 사용자 정보 조회
  const fetchMe = useCallback(async () => {
    if (!userId) {
      setError('사용자 ID가 없습니다');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.user.me(userId);
      setUser(response as User);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '사용자 정보 조회 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 계정 삭제
  const deleteAccount = useCallback(async () => {
    if (!userId) {
      setError('사용자 ID가 없습니다');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.user.deleteAccount(userId);
      setUser(null);
      setUserId(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '계정 삭제 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // 로그아웃
  const logout = useCallback(() => {
    setUser(null);
    setUserId(null);
    setError(null);
  }, []);

  return {
    user,
    userId,
    loading,
    error,
    login,
    fetchMe,
    deleteAccount,
    logout,
  };
}
