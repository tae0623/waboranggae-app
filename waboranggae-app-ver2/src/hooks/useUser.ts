import { useState, useCallback } from 'react';
import { apiClient, ApiError, tokenManager } from '../services/apiClient';

interface User {
  id: string;
  email: string;
  displayName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface UseUserState {
  user: User | null;
  userId: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export interface UseUserActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

/**
 * JWT 기반 사용자 인증 및 프로필 관리 hook
 *
 * 사용 예시:
 * ```tsx
 * const { user, userId, loading, error, login, signup, logout } = useUser();
 *
 * await login('user@example.com', 'Password1!');
 * await signup('user@example.com', '홍길동', 'Password1!');
 * logout();
 * ```
 */
export function useUser(): UseUserState & UseUserActions {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const isAuthenticated = Boolean(userId && tokenManager.getAccessToken());

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = (await apiClient.auth.login({ email, password })) as AuthResponse;
      tokenManager.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '로그인 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, displayName: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = (await apiClient.auth.signup({
        email,
        displayName,
        password,
      })) as AuthResponse;
      tokenManager.setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '회원가입 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMe = useCallback(async () => {
    if (!tokenManager.getAccessToken()) {
      setError('로그인이 필요합니다');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = (await apiClient.user.me()) as User;
      setUser(response);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '사용자 정보 조회 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!tokenManager.getAccessToken()) {
      setError('로그인이 필요합니다');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.user.deleteAccount();
      tokenManager.clearTokens();
      setUser(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '계정 삭제 실패';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (tokenManager.getAccessToken()) {
        await apiClient.auth.logout().catch(() => {
          // 서버 로그아웃 실패해도 로컬 로그아웃은 진행
        });
      }
    } finally {
      tokenManager.clearTokens();
      setUser(null);
      setError(null);
    }
  }, []);

  return {
    user,
    userId,
    loading,
    error,
    isAuthenticated,
    login,
    signup,
    fetchMe,
    deleteAccount,
    logout,
  };
}
