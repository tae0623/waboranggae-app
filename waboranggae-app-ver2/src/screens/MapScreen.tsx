import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '../components/AppIcon';
import { CourseMap } from '../components/CourseMap';
import { CATEGORY_LABELS } from '../domain/labels';
import { colors, radii, shadows } from '../theme';
import { RankedCourse } from '../types/travel';

export function MapScreen({ course, onOpenDetail }: { course: RankedCourse; onOpenDetail: () => void }) {
  const nextPlace = course.places[0];
  const hasGeo = Boolean(course.origin) || course.places.some((place) => typeof place.latitude === 'number');
  const routeSourceLabel = course.routeSource === 'tmap-transit'
    ? 'TMAP 실제 경로'
    : course.routeSource === 'mixed'
      ? '일부 실제 경로'
      : '좌표 기반 예상';

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{hasGeo ? 'MAP SDK · OPENSTREETMAP' : 'ROUTE PREVIEW'}</Text>
            <Text style={styles.title}>{course.title}</Text>
          </View>
          <View style={styles.estimateBadge}><Ionicons name="navigate-outline" size={14} color={colors.forest} /><Text style={styles.estimateText}>{routeSourceLabel}</Text></View>
        </View>

        <View style={styles.mapWrap}>
          <CourseMap course={course} />
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <View style={styles.progressIcon}><Ionicons name="navigate" size={19} color={colors.white} /></View>
            <View style={styles.progressCopy}>
              <Text style={styles.progressLabel}>다음 목적지</Text>
              <Text style={styles.progressTitle}>{nextPlace?.name ?? course.title}</Text>
            </View>
            <View style={styles.timeBlock}>
              <Text style={styles.timeValue}>{nextPlace?.moveMinutes ?? '-'}</Text>
              <Text style={styles.timeUnit}>분</Text>
            </View>
          </View>
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressText}>{nextPlace?.moveLabel ?? '경로 확인'}</Text>
            <Text style={styles.progressText}>예상 도착 {nextPlace?.arrival ?? '-'}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>오늘의 방문 순서</Text>
          <Pressable onPress={onOpenDetail}><Text style={styles.detailLink}>코스 상세</Text></Pressable>
        </View>

        <View style={styles.stops}>
          {course.origin ? (
            <View style={[styles.stop, styles.originStop]}>
              <View style={[styles.number, styles.originNumber]}><Text style={styles.originNumberText}>출</Text></View>
              <View style={styles.stopCopy}>
                <View style={styles.stopTitleRow}>
                  <Text style={styles.stopName}>{course.origin.name}</Text>
                  <Text style={styles.stopArrival}>{course.places[0]?.moveLabel.match(/\d{2}:\d{2}/)?.[0] ?? '출발'}</Text>
                </View>
                <Text style={styles.stopMeta}>선택한 출발 거점 · {course.origin.address}</Text>
              </View>
            </View>
          ) : null}
          {course.places.map((place, index) => (
            <View key={place.id} style={[styles.stop, index === 0 && styles.stopActive]}>
              <View style={[styles.number, index === 0 && styles.numberActive]}>
                <Text style={[styles.numberText, index === 0 && styles.numberTextActive]}>{index + 1}</Text>
              </View>
              <View style={styles.stopCopy}>
                <View style={styles.stopTitleRow}>
                  <Text style={styles.stopName}>{place.name}</Text>
                  <Text style={styles.stopArrival}>{place.arrival}</Text>
                </View>
                <Text style={styles.stopMeta}>{CATEGORY_LABELS[place.category]} · 머무름 {place.stayMinutes}분</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </View>
          ))}
        </View>

        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>지도 범례</Text>
          <Text style={styles.legendText}>주황 ‘출’: 선택한 출발 거점 · 초록 숫자: 방문 순서 · 점선은 좌표 기반 예상 구간</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  eyebrow: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.6, marginTop: 4, maxWidth: 310 },
  estimateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  estimateText: { color: colors.forest, fontSize: 8, fontWeight: '900' },
  mapWrap: { marginHorizontal: 16 },
  progressCard: { marginHorizontal: 16, marginTop: 14, padding: 17, borderRadius: radii.lg, backgroundColor: colors.white, ...shadows.card },
  progressTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  progressIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  progressCopy: { flex: 1 },
  progressLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  progressTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 3 },
  timeBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  timeValue: { color: colors.forest, fontSize: 24, fontWeight: '900' },
  timeUnit: { color: colors.forest, fontSize: 10, fontWeight: '900' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#EDF0EB', marginTop: 14, overflow: 'hidden' },
  progressFill: { width: '28%', height: 5, borderRadius: 3, backgroundColor: colors.coral },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progressText: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  detailLink: { color: colors.forest, fontSize: 10, fontWeight: '900' },
  stops: { paddingHorizontal: 16, gap: 9 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: colors.paper, borderRadius: 17, padding: 13, borderWidth: 1, borderColor: '#E3E7DF' },
  stopActive: { borderColor: colors.forest, backgroundColor: '#F8FBF3' },
  originStop: { borderColor: '#F1C5B7', backgroundColor: '#FFF7F2' },
  number: { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EAE4' },
  originNumber: { backgroundColor: colors.coral },
  originNumberText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  numberActive: { backgroundColor: colors.forest },
  numberText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  numberTextActive: { color: colors.white },
  stopCopy: { flex: 1 },
  stopTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stopName: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  stopArrival: { color: colors.coral, fontSize: 9, fontWeight: '900' },
  stopMeta: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  legendCard: { marginHorizontal: 16, marginTop: 20, padding: 14, borderRadius: 16, backgroundColor: '#E4EFF0' },
  legendTitle: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  legendText: { color: colors.muted, fontSize: 8, lineHeight: 13, fontWeight: '700', marginTop: 3 },
});
