import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { BrandMark } from '../components/BrandMark';
import { CourseCard } from '../components/CourseCard';
import { SectionHeader } from '../components/SectionHeader';
import { colors, radii } from '../theme';
import { CourseDataSource, RankedCourse } from '../types/travel';

const FILTERS = ['AI 추천순', '적게 걷기', '맛집', '자연', '역사'];

export function CoursesScreen({ courses, source, onOpenCourse }: { courses: RankedCourse[]; source: CourseDataSource; onOpenCourse: (course: RankedCourse) => void }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <BrandMark compact />
        <Pressable style={styles.sortButton}>
          <Ionicons name="options-outline" size={18} color={colors.forest} />
        </Pressable>
      </View>

      <View style={styles.titleArea}>
        <SectionHeader eyebrow="CURATED FOR YOU" title="조건에 맞춰 고른 코스" />
        <Text style={styles.description}>대중교통 접근성과 도보 부담을 함께 계산했어요.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((filter, index) => (
          <View key={filter} style={[styles.filter, index === 0 && styles.filterActive]}>
            {index === 0 ? <Ionicons name="sparkles" size={12} color={colors.white} /> : null}
            <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>{filter}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.insight}>
        <View style={styles.insightIcon}><Ionicons name="footsteps" size={20} color={colors.forest} /></View>
        <View style={styles.insightCopy}>
          <Text style={styles.insightTitle}>도보 부담을 더 중요하게 반영 중</Text>
          <Text style={styles.insightText}>입력한 문장의 “많이 걷지 않고” 조건 때문에 도보 가중치를 45%로 조정했어요.</Text>
        </View>
      </View>

      <View style={styles.list}>
        {courses.map((course, index) => (
          <View key={course.id} style={styles.listItem}>
            <View style={styles.rankRow}>
              <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.rankLine} />
              <Text style={styles.rankLabel}>{index === 0 ? '가장 잘 맞아요' : '이 조건도 좋아요'}</Text>
            </View>
            <CourseCard course={course} onPress={() => onOpenCourse(course)} />
          </View>
        ))}
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={18} color={colors.blue} />
        <Text style={styles.noticeText}>
          {source === 'tour-api'
            ? '관광지는 한국관광공사 TourAPI에서 조회했습니다. 거리와 이동시간은 좌표 기반 추정치이며, 운영시간과 실제 경로는 방문 전에 확인하세요.'
            : '현재 장소·편의시설 운영 정보는 시연 데이터입니다. .env에 TOUR_API_KEY를 설정하면 실제 관광정보를 조회합니다.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16 },
  sortButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  titleArea: { paddingHorizontal: 20, marginTop: 28 },
  description: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 7 },
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
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  rank: { color: colors.coral, fontSize: 12, fontWeight: '900' },
  rankLine: { width: 18, height: 1, backgroundColor: '#B8C1BC', marginHorizontal: 8 },
  rankLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 20, marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  noticeText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700' },
});
