/**
 * 모든 custom hooks를 한 곳에서 export합니다.
 */

export { useUser } from './useUser';
export type { UseUserState, UseUserActions } from './useUser';

export { useBookmarks } from './useBookmarks';
export type { UseBookmarksState, UseBookmarksActions } from './useBookmarks';

export { useSearchHistory } from './useSearchHistory';
export type { UseSearchHistoryState, UseSearchHistoryActions } from './useSearchHistory';

export { useAnalysis, useRecommendation } from './useAnalysisAndRecommendation';
export type {
  UseAnalysisState,
  UseAnalysisActions,
  UseRecommendationState,
  UseRecommendationActions,
} from './useAnalysisAndRecommendation';
