import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, AppTab } from './src/components/TabBar';
import { DEFAULT_QUERY, parseTravelText } from './src/domain/demoEngine';
import { CourseDetailScreen } from './src/screens/CourseDetailScreen';
import { CoursesScreen } from './src/screens/CoursesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { colors } from './src/theme';
import { RankedCourse, TravelPreferences } from './src/types/travel';
import { apiClient } from './src/services/apiClient';
import {
  useAnalysis,
  useRecommendation,
} from './src/hooks';

const initialPreferences = parseTravelText(DEFAULT_QUERY);

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [manualPreferences, setManualPreferences] = useState<TravelPreferences>(initialPreferences);
  const [reasonOverrides, setReasonOverrides] = useState<Record<string, RankedCourse['reason']>>({});
  const [explainingCourseId, setExplainingCourseId] = useState<string | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const { preferences, source, loading: analyzing, analyze } = useAnalysis();
  const {
    courses,
    source: courseSource,
    planningSource,
    loading: recommending,
    error: recommendationError,
    fallbackReason,
    recommend,
    clear: clearRecommendations,
  } = useRecommendation();

  const loading = analyzing || recommending;
  // AI 분석 결과도 수동 선택 폼에 복사합니다. 이후 사용자가 수정한 값이 항상 최종값입니다.
  const activePreferences = manualPreferences;
  const displayedCourses = useMemo(
    () => courses.map((course) => ({
      ...course,
      reason: reasonOverrides[course.id] ?? course.reason,
    })),
    [courses, reasonOverrides],
  );

  useEffect(() => {
    if (preferences) setManualPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (courses[0]?.id) setSelectedCourseId(courses[0].id);
  }, [courses]);

  const selectedCourse = useMemo(
    () => displayedCourses.find((course) => course.id === selectedCourseId) ?? displayedCourses[0],
    [displayedCourses, selectedCourseId],
  );

  const handleAnalyze = async () => {
    if (!query.trim() || loading) return;

    try {
      const analyzedPrefs = await analyze(query);
      setManualPreferences(analyzedPrefs);
      clearRecommendations();
      setReasonOverrides({});
    } catch (error) {
      console.warn('AI 조건 자동 채우기 실패:', error);
    }
  };

  const handlePreferencesChange = (next: TravelPreferences) => {
    setManualPreferences(next);
    clearRecommendations();
    setSelectedCourseId('');
    setReasonOverrides({});
  };

  const handleRecommendByConditions = async () => {
    if (loading) return;
    setActiveTab('courses');
    try {
      setReasonOverrides({});
      await recommend(manualPreferences);
    } catch (error) {
      console.warn('조건 추천 실패:', error);
    }
  };

  const handleOpenCourse = async (course: RankedCourse) => {
    setSelectedCourseId(course.id);
    setDetailOpen(true);
    setExplanationError(null);

    if (reasonOverrides[course.id]?.source === 'ollama' || course.reason.source === 'ollama') return;

    setExplainingCourseId(course.id);
    try {
      const response = await apiClient.explain({
        preferences: activePreferences,
        course,
      });
      setReasonOverrides((current) => ({ ...current, [course.id]: response.reason }));
    } catch (error) {
      setExplanationError(error instanceof Error ? error.message : '추천 이유 생성에 실패했습니다.');
      console.warn('추천 이유 API 호출 실패:', error);
    } finally {
      setExplainingCourseId((current) => current === course.id ? null : current);
    }
  };

  const handleSeeAllCourses = async () => {
    setActiveTab('courses');
    if (!courses.length && !recommending) await recommend(activePreferences);
  };

  const handleTabChange = async (tab: AppTab) => {
    setDetailOpen(false);
    if (tab !== 'home' && !courses.length && !recommending) {
      setActiveTab('courses');
      await recommend(activePreferences);
      return;
    }
    setActiveTab(tab);
  };

  return (
    <View style={styles.viewport}>
      <View style={[styles.device, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
        <View style={styles.screen}>
          {detailOpen && selectedCourse ? (
            <CourseDetailScreen
              course={selectedCourse}
              preferences={activePreferences}
              explanationLoading={explainingCourseId === selectedCourse.id}
              explanationError={explanationError}
              onBack={() => setDetailOpen(false)}
              onOpenMap={() => {
                setDetailOpen(false);
                setActiveTab('map');
              }}
            />
          ) : activeTab === 'home' ? (
            <HomeScreen
              query={query}
              onQueryChange={setQuery}
              onAnalyze={handleAnalyze}
              loading={loading}
              preferences={activePreferences}
              onPreferencesChange={handlePreferencesChange}
              onRecommendByConditions={handleRecommendByConditions}
              recommendation={displayedCourses[0] ?? null}
              source={source}
              onOpenCourse={handleOpenCourse}
              onSeeAll={handleSeeAllCourses}
            />
          ) : activeTab === 'courses' ? (
            <CoursesScreen
              courses={displayedCourses}
              source={courseSource}
              planningSource={planningSource || 'rules'}
              preferences={activePreferences}
              loading={recommending}
              error={recommendationError}
              fallbackReason={fallbackReason}
              onRetry={() => recommend(activePreferences)}
              onOpenCourse={handleOpenCourse}
            />
          ) : activeTab === 'map' && selectedCourse ? (
            <MapScreen
              course={selectedCourse}
              courses={displayedCourses}
              onSelectCourse={(course) => setSelectedCourseId(course.id)}
              onOpenDetail={() => setDetailOpen(true)}
            />
          ) : null}
        </View>

        {!detailOpen ? (
          <View style={{ paddingBottom: Platform.OS === 'web' ? 0 : insets.bottom }}>
            <TabBar active={activeTab} onChange={handleTabChange} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#17352C' : colors.cream,
    alignItems: 'center',
  },
  device: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.cream,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
      },
      default: {},
    }),
  },
  screen: { flex: 1 },
});
