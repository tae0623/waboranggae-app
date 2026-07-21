import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, AppTab } from './src/components/TabBar';
import { DEFAULT_QUERY, parseTravelText, rankCourses } from './src/domain/demoEngine';
import { ConvenienceScreen } from './src/screens/ConvenienceScreen';
import { CourseDetailScreen } from './src/screens/CourseDetailScreen';
import { CoursesScreen } from './src/screens/CoursesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { colors } from './src/theme';
import { RankedCourse } from './src/types/travel';
import {
  useAnalysis,
  useRecommendation,
  useUser,
  useSearchHistory,
} from './src/hooks';

const initialPreferences = parseTravelText(DEFAULT_QUERY);
const initialCourses = rankCourses(initialPreferences);

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
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourses[0]?.id ?? '');
  const [detailOpen, setDetailOpen] = useState(false);

  // Hooks
  const { preferences, source, loading, analyze } = useAnalysis();
  const { courses, source: courseSource, recommend } = useRecommendation();
  const { userId } = useUser();
  const { record: recordSearch } = useSearchHistory(userId);

  const displayedCourses = courses.length > 0 ? courses : initialCourses;

  const selectedCourse = useMemo(
    () => displayedCourses.find((course) => course.id === selectedCourseId) ?? displayedCourses[0],
    [displayedCourses, selectedCourseId],
  );

  const handleAnalyze = async () => {
    if (!query.trim() || loading) return;

    try {
      // 1. 자연어 분석
      await analyze(query);

      // 2. 분석 후 preferences를 사용해 추천
      const analyzedPrefs = preferences || parseTravelText(query);
      await recommend(analyzedPrefs);

      // 3. 검색 이력 기록 (백그라운드)
      if (userId) {
        recordSearch(query, analyzedPrefs).catch(() => {
          // 조용히 실패
        });
      }

      // 4. 첫 번째 코스 선택
      if (courses.length > 0) {
        setSelectedCourseId(courses[0].id);
      }
    } catch (error) {
      console.warn('분석 또는 추천 실패:', error);
    }
  };

  const handleOpenCourse = (course: RankedCourse) => {
    setSelectedCourseId(course.id);
    setDetailOpen(true);
  };

  const handleTabChange = (tab: AppTab) => {
    setDetailOpen(false);
    setActiveTab(tab);
  };

  return (
    <View style={styles.viewport}>
      <View style={[styles.device, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
        <View style={styles.screen}>
          {detailOpen && selectedCourse ? (
            <CourseDetailScreen
              course={selectedCourse}
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
              preferences={preferences || initialPreferences}
              recommendation={displayedCourses[0] ?? null}
              source={source || 'rules'}
              onOpenCourse={handleOpenCourse}
              onSeeAll={() => setActiveTab('courses')}
            />
          ) : activeTab === 'courses' ? (
            <CoursesScreen
              courses={displayedCourses}
              source={courseSource || 'demo'}
              onOpenCourse={handleOpenCourse}
            />
          ) : activeTab === 'map' && selectedCourse ? (
            <MapScreen course={selectedCourse} onOpenDetail={() => setDetailOpen(true)} />
          ) : selectedCourse ? (
            <ConvenienceScreen course={selectedCourse} />
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
