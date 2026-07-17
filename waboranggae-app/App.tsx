import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, AppTab } from './src/components/TabBar';
import { DEFAULT_QUERY, parseTravelText, rankCourses } from './src/domain/demoEngine';
import { analyzeTravelRequest, generateRecommendationReason, recommendCourses } from './src/services/aiClient';
import { ConvenienceScreen } from './src/screens/ConvenienceScreen';
import { CourseDetailScreen } from './src/screens/CourseDetailScreen';
import { CoursesScreen } from './src/screens/CoursesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MapScreen } from './src/screens/MapScreen';
import { colors } from './src/theme';
import { AnalysisSource, CourseDataSource, RankedCourse, TravelPreferences } from './src/types/travel';

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
  const [preferences, setPreferences] = useState<TravelPreferences>(initialPreferences);
  const [courses, setCourses] = useState<RankedCourse[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourses[0]?.id ?? '');
  const [source, setSource] = useState<AnalysisSource>('rules');
  const [courseSource, setCourseSource] = useState<CourseDataSource>('demo');
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? courses[0],
    [courses, selectedCourseId],
  );

  const handleAnalyze = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    try {
      const analyzed = await analyzeTravelRequest(query);
      const recommendation = await recommendCourses(analyzed.preferences);
      const ranked = [...recommendation.courses];
      const topCourse = ranked[0];
      if (topCourse) {
        const reason = await generateRecommendationReason({ preferences: analyzed.preferences, course: topCourse });
        ranked[0] = { ...topCourse, reason };
        setSelectedCourseId(topCourse.id);
      }
      setPreferences(analyzed.preferences);
      setCourses(ranked);
      setSource(analyzed.source);
      setCourseSource(recommendation.source);
    } finally {
      setLoading(false);
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
              preferences={preferences}
              recommendation={courses[0] ?? null}
              source={source}
              onOpenCourse={handleOpenCourse}
              onSeeAll={() => setActiveTab('courses')}
            />
          ) : activeTab === 'courses' ? (
            <CoursesScreen courses={courses} source={courseSource} onOpenCourse={handleOpenCourse} />
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
