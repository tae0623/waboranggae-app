import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BrandMark } from '../components/BrandMark';
import { CourseCard } from '../components/CourseCard';
import { SectionHeader } from '../components/SectionHeader';
import { colors, radii } from '../theme';
import { CourseDataSource, CoursePlanningSource, RankedCourse, TravelPreferences } from '../types/travel';

const FILTERS = ['추천순', '적게 걷기', '맛집', '자연', '역사'] as const;
type CourseFilter = typeof FILTERS[number];

export function CoursesScreen({
  courses,
  source,
  planningSource,
  preferences,
  loading = false,
  error = null,
  fallbackReason = null,
  onRetry,
  onOpenCourse,
}: {
  courses: RankedCourse[];
  source: CourseDataSource | null;
  planningSource: CoursePlanningSource;
  preferences: TravelPreferences;
  loading?: boolean;
  error?: string | null;
  fallbackReason?: string | null;
  onRetry?: () => void;
  onOpenCourse: (course: RankedCourse) => void;
}) {
  const [filter, setFilter] = useState<CourseFilter>('추천순');
  const visibleCourses = useMemo(() => {
    const next = filter === '맛집'
      ? courses.filter((course) => course.places.some((place) => place.category === 'food'))
      : filter === '자연'
        ? courses.filter((course) => course.places.some((place) => place.category === 'nature'))
        : filter === '역사'
          ? courses.filter((course) => course.places.some((place) => place.category === 'history'))
          : [...courses];
    if (filter === '적게 걷기') next.sort((a, b) => (b.walkingScore ?? b.scoreBreakdown.walkingEase) - (a.walkingScore ?? a.scoreBreakdown.walkingEase));
    return next;
  }, [courses, filter]);

  const walkingWeight = preferences.pace === 'easy' ? 45 : preferences.pace === 'full' ? 20 : 30;
  const planningLabel = source === null
    ? '실제 관광정보 조회·일정 구성 중'
    : source === 'demo'
    ? '실데이터 연결 실패 · 시연 코스'
    : planningSource === 'ollama' ? 'AI가 구성하고 서버가 검증' : '시간 규칙으로 구성·검증';
  const routingNotice = courses[0]?.routeSource === 'kakao'
    ? '출발지와 장소 간 이동은 조회한 카카오 구간 경로를 반영했습니다.'
    : courses[0]?.routeSource === 'mixed'
      ? '일부 구간은 조회한 경로, 나머지는 좌표 기반 예상 경로입니다.'
      : '출발지 실좌표를 반영한 예상 시간입니다. 동선 탭에서 구간별 카카오맵 길찾기를 확인하세요.';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <BrandMark compact />
        <View style={styles.sourceBadge}>
          <Ionicons name={source === null ? 'time-outline' : source === 'demo' ? 'information-circle-outline' : planningSource === 'ollama' ? 'sparkles' : 'shield-checkmark'} size={13} color={colors.forest} />
          <Text style={styles.sourceBadgeText}>{source === null ? '구성 중' : source === 'demo' ? '시연 모드' : planningSource === 'ollama' ? 'AI+검증' : '규칙+검증'}</Text>
        </View>
      </View>

      <View style={styles.titleArea}>
        <SectionHeader eyebrow="CURATED FOR YOU" title="조건에 맞춰 고른 코스" />
        <Text style={styles.description}>{preferences.startTime}부터 {preferences.durationHours}시간 · {planningLabel}</Text>
      </View>

      {loading ? (
        <View style={styles.apiStatus}>
          <ActivityIndicator size="small" color={colors.forest} />
          <Text style={styles.apiStatusText}>TourAPI 장소를 조회해 AI 일정 구성과 시간표 검증을 진행하고 있어요. 첫 실행은 약 1분 걸릴 수 있어요.</Text>
        </View>
      ) : error ? (
        <Pressable style={styles.apiStatus} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={17} color={colors.coral} />
          <Text style={styles.apiStatusText}>{fallbackReason || '실제 관광정보 추천을 불러오지 못했습니다. 눌러서 다시 시도하세요.'}</Text>
        </Pressable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.filterActive]}>
            {item === '추천순' ? <Ionicons name="sparkles" size={12} color={filter === item ? colors.white : colors.forest} /> : null}
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.insight}>
        <View style={styles.insightIcon}><Ionicons name="footsteps" size={20} color={colors.forest} /></View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightTitle}>선택 조건을 점수에 반영했어요</Text>
          <Text style={styles.insightText}>출발 {preferences.startLocation} · {preferences.startTime} · 식사 시간과 식사 후 카페 순서를 별도로 검증했어요.</Text>
        </View>
      </View>

      <View style={styles.list}>
        {visibleCourses.map((course, index) => (
          <View key={course.id} style={styles.listItem}>
            <View style={styles.rankRow}>
              <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.rankLine} />
              <Text style={styles.rankLabel}>{index === 0 ? '가장 잘 맞아요' : '이 조건도 좋아요'}</Text>
            </View>
            <CourseCard course={course} onPress={() => onOpenCourse(course)} />
          </View>
        ))}
        {!visibleCourses.length && !loading ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={21} color={colors.forest} />
            <Text style={styles.emptyTitle}>이 필터에 맞는 코스가 없어요</Text>
            <Text style={styles.emptyText}>다른 필터를 선택하면 전체 추천을 다시 볼 수 있어요.</Text>
          </View>
        ) : null}
      </View>

      {source !== null ? <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
        <Text style={styles.noticeText}>
          {source !== 'demo'
            ? `장소: 한국관광공사·카카오 · 사진: 한국관광공사. ${routingNotice} 운영시간은 방문 전에 확인하세요.`
            : fallbackReason || 'TourAPI를 쓰지 못해 시연 코스를 표시합니다. .env의 DATA_GO_KR_KEY를 확인하세요.'}
        </Text>
      </View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  sourceBadgeText: { color: colors.forest, fontSize: 9, fontWeight: '900' },
  titleArea: { paddingHorizontal: 20, marginTop: 28 },
  description: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 7 },
  apiStatus: { marginHorizontal: 20, marginTop: 14, padding: 12, borderRadius: 13, backgroundColor: '#EDF2E8', flexDirection: 'row', alignItems: 'center', gap: 9 },
  apiStatusText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  filters: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.paper, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 13, paddingVertical: 8 },
  filterActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  filterText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  filterTextActive: { color: colors.white },
  insight: { marginHorizontal: 16, padding: 15, borderRadius: radii.md, backgroundColor: '#E8F0E2', flexDirection: 'row', alignItems: 'center', gap: 11 },
  insightIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  insightCopy: { flex: 1 },
  insightTitle: { color: colors.forestDark, fontSize: 12, fontWeight: '900' },
  insightText: { color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 3 },
  list: { gap: 24, paddingHorizontal: 16, marginTop: 24 },
  listItem: { gap: 9 },
  emptyCard: { alignItems: 'center', padding: 24, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 8 },
  emptyText: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  rank: { color: colors.coral, fontSize: 12, fontWeight: '900' },
  rankLine: { width: 18, height: 1, backgroundColor: '#B8C1BC', marginHorizontal: 8 },
  rankLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  noticeText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700' },
});
