import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { parseTravelText, rankCourses } from '../domain/demoEngine';
import {
  AnalysisSource,
  CoursePlanningSource,
  CourseDataSource,
  RankedCourse,
  TravelPreferences,
} from '../types/travel';

export interface UseAnalysisState {
  preferences: TravelPreferences | null;
  source: AnalysisSource | null;
  loading: boolean;
  error: string | null;
}

export interface UseAnalysisActions {
  analyze: (query: string) => Promise<TravelPreferences>;
  clear: () => void;
}

/**
 * 자연어 분석 hook (쿼리 → 여행 선호도)
 */
export function useAnalysis(): UseAnalysisState & UseAnalysisActions {
  const [preferences, setPreferences] = useState<TravelPreferences | null>(null);
  const [source, setSource] = useState<AnalysisSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.analyze({ query });
      const next = response.preferences;
      setPreferences(next);
      setSource(response.source);
      return next;
    } catch (err) {
      const fallback = parseTravelText(query);
      setPreferences(fallback);
      setSource('rules');
      setError(err instanceof Error ? err.message : 'AI 분석에 실패했습니다.');
      console.warn('AI 분석 실패, 규칙 기반 파서 사용');
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setPreferences(null);
    setSource(null);
    setError(null);
  }, []);

  return {
    preferences,
    source,
    loading,
    error,
    analyze,
    clear,
  };
}

export interface UseRecommendationState {
  courses: RankedCourse[];
  source: CourseDataSource | null;
  planningSource: CoursePlanningSource | null;
  loading: boolean;
  error: string | null;
}

export interface UseRecommendationActions {
  recommend: (preferences: TravelPreferences) => Promise<RankedCourse[]>;
  clear: () => void;
}

/**
 * 코스 추천 hook (여행 선호도 → 코스 순위)
 *
 * 사용 예시:
 * ```tsx
 * const { courses, source, recommend } = useRecommendation();
 * await recommend(preferences);
 * ```
 */
export function useRecommendation(): UseRecommendationState & UseRecommendationActions {
  const [courses, setCourses] = useState<RankedCourse[]>([]);
  const [source, setSource] = useState<CourseDataSource | null>(null);
  const [planningSource, setPlanningSource] = useState<CoursePlanningSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommend = useCallback(async (preferences: TravelPreferences) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.recommend({ preferences });
      setCourses(response.courses);
      setSource(response.source);
      setPlanningSource(response.planningSource ?? response.courses[0]?.planningSource ?? 'rules');
      return response.courses;
    } catch (err) {
      // 실패해도 기본 데모 데이터로 추천
      const fallback = rankCourses(preferences);
      setCourses(fallback);
      setSource('demo');
      setPlanningSource('rules');
      setError(err instanceof Error ? err.message : '추천 API 호출에 실패했습니다.');
      console.warn('API 추천 실패, 데모 데이터 사용');
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setCourses([]);
    setSource(null);
    setPlanningSource(null);
    setError(null);
  }, []);

  return {
    courses,
    source,
    planningSource,
    loading,
    error,
    recommend,
    clear,
  };
}
