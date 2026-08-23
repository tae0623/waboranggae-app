import { ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '../components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteMap } from '../components/RouteMap';
import { CATEGORY_LABELS } from '../domain/labels';
import { colors, radii, shadows } from '../theme';
import { RankedCourse, TravelPreferences } from '../types/travel';

export function CourseDetailScreen({
  course,
  preferences,
  explanationLoading = false,
  explanationError = null,
  onBack,
  onOpenMap,
}: {
  course: RankedCourse;
  preferences: TravelPreferences;
  explanationLoading?: boolean;
  explanationError?: string | null;
  onBack: () => void;
  onOpenMap: () => void;
}) {
  const coverImage = course.places.find((place) => place.imageUrl)?.imageUrl;
  const weights = preferences.pace === 'easy'
    ? { walking: '45%', nearby: '15%' }
    : preferences.pace === 'full'
      ? { walking: '20%', nearby: '40%' }
      : { walking: '30%', nearby: '30%' };
  const shareCourse = () => {
    const route = [
      ...(course.origin ? [`출발. ${course.origin.name}`] : []),
      ...course.places.map((place, index) => `${index + 1}. ${place.name} (${place.arrival})`),
    ].join('\n');
    Share.share({ message: `[와보랑께] ${course.title}\n${course.subtitle}\n\n${route}` }).catch(() => undefined);
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[course.accent, colors.forestDark]} style={styles.hero}>
          <View style={styles.navRow}>
            <Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={20} color={colors.white} /></Pressable>
            <View style={styles.navActions}>
              <Pressable onPress={shareCourse} style={styles.iconButton} accessibilityLabel="코스 공유"><Ionicons name="share-social-outline" size={19} color={colors.white} /></Pressable>
            </View>
          </View>
          <View style={styles.heroContent}>
            <View style={styles.cityPill}><Ionicons name="location" size={12} color={colors.forestDark} /><Text style={styles.cityText}>{course.city}</Text></View>
            <Text style={styles.title}>{course.title}</Text>
            <Text style={styles.subtitle}>{course.subtitle}</Text>
            <View style={styles.metaRow}>
              <Meta icon="time-outline" text={`${course.durationHours}시간`} />
              <Meta icon="walk-outline" text={`${course.distanceKm}km`} />
              <Meta icon="bus-outline" text={`이동 ${course.walkMinutes + course.transitMinutes}분`} />
            </View>
          </View>
          <View style={styles.scoreOrb}>
            <Text style={styles.score}>{course.fitScore}</Text>
            <Text style={styles.scoreLabel}>뚜벅이 적합도</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {coverImage ? <Image source={{ uri: coverImage }} style={styles.coverImage} resizeMode="cover" accessibilityLabel={`${course.title} 대표 관광 이미지`} /> : null}
          <View style={styles.reasonCard}>
            <View style={styles.reasonHeader}>
              <View style={styles.aiIcon}><MaterialCommunityIcons name="creation" size={18} color={colors.forest} /></View>
              <View style={styles.reasonTitleWrap}>
                <Text style={styles.reasonEyebrow}>RECOMMENDATION EVIDENCE</Text>
                <Text style={styles.reasonTitle}>{course.reason.headline}</Text>
              </View>
              <View style={styles.reasonSource}><Text style={styles.reasonSourceText}>{course.reason.source === 'ollama' ? 'OLLAMA' : 'RULES'}</Text></View>
            </View>
            <Text style={styles.reasonSummary}>{course.reason.summary}</Text>
            {explanationLoading ? (
              <View style={styles.reasonStatus}>
                <ActivityIndicator size="small" color={colors.forest} />
                <Text style={styles.reasonStatusText}>Ollama가 이 코스의 추천 이유를 만들고 있어요.</Text>
              </View>
            ) : explanationError ? (
              <View style={styles.reasonStatus}>
                <Ionicons name="information-circle-outline" size={15} color={colors.coral} />
                <Text style={styles.reasonStatusText}>AI 설명을 불러오지 못해 계산 기반 설명을 표시합니다.</Text>
              </View>
            ) : null}
            <View style={styles.evidenceList}>
              {course.reason.evidence.map((evidence) => (
                <View key={evidence} style={styles.evidenceItem}>
                  <Ionicons name="checkmark-circle" size={15} color={colors.forest} />
                  <Text style={styles.evidenceText}>{evidence}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.validationCard}>
            <Ionicons name={course.validationNotes?.length ? 'shield-checkmark' : 'information-circle-outline'} size={20} color={colors.forest} />
            <View style={styles.validationCopy}>
              <Text style={styles.validationTitle}>{course.validationNotes?.length
                ? course.planningSource === 'ollama' ? 'AI 일정 · 서버 검증 완료' : '시간 규칙 일정 · 서버 검증 완료'
                : '시연 코스 · 검증 범위 제한'}</Text>
              <Text style={styles.validationText}>{course.validationNotes?.join(' · ') || '실제 관광정보 연결이 복구되면 선택 조건으로 시간표를 다시 구성해요.'}</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>ROUTE AT A GLANCE</Text>
              <Text style={styles.sectionTitle}>이동 동선</Text>
            </View>
            <Pressable onPress={onOpenMap} style={styles.mapAction}>
              <Text style={styles.mapActionText}>크게 보기</Text>
              <Ionicons name="expand-outline" size={14} color={colors.forest} />
            </Pressable>
          </View>
          <Pressable onPress={onOpenMap}><RouteMap course={course} compact /></Pressable>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreCardTitle}>점수 산정 근거</Text>
            <Metric label="대중교통 접근성" score={course.scoreBreakdown.transitAccess} weight="30%" color={course.accent} />
            <Metric label="도보 부담도" score={course.scoreBreakdown.walkingEase} weight={weights.walking} color={colors.coral} />
            <Metric label="주변 관광 연계성" score={course.scoreBreakdown.nearbyLinks} weight={weights.nearby} color={colors.blue} />
            <Metric label="편의시설 접근성" score={course.scoreBreakdown.convenience} weight="10%" color={colors.sun} />
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>STEP BY STEP</Text>
              <Text style={styles.sectionTitle}>방문 순서</Text>
            </View>
            <Text style={styles.stopCount}>{course.places.length}개 장소</Text>
          </View>

          <View style={styles.timeline}>
            {course.origin ? (
              <View style={styles.stop}>
                <View style={styles.stopRail}>
                  <View style={[styles.stopNumber, { backgroundColor: colors.coral }]}><Text style={styles.stopNumberText}>출</Text></View>
                  <View style={styles.stopLine} />
                </View>
                <View style={[styles.stopCard, styles.originCard]}>
                  <Text style={styles.originEyebrow}>선택한 출발 거점</Text>
                  <Text style={styles.stopName}>{course.origin.name}</Text>
                  <Text style={styles.addressText}>{course.origin.address}</Text>
                </View>
              </View>
            ) : null}
            {course.places.map((place, index) => (
              <View key={place.id} style={styles.stop}>
                <View style={styles.stopRail}>
                  <View style={[styles.stopNumber, { backgroundColor: index === 0 ? colors.coral : course.accent }]}><Text style={styles.stopNumberText}>{index + 1}</Text></View>
                  {index < course.places.length - 1 ? <View style={styles.stopLine} /> : null}
                </View>
                <View style={styles.stopCard}>
                  <View style={styles.stopTop}>
                    <View style={styles.categoryPill}><Text style={styles.categoryText}>{CATEGORY_LABELS[place.category]}</Text></View>
                    <Text style={styles.arrival}>{place.arrival}</Text>
                  </View>
                  <Text style={styles.stopName}>{place.name}</Text>
                  <Text style={styles.stopDescription}>{place.description}</Text>
                  <View style={styles.addressRow}>
                    <Ionicons name="location-outline" size={12} color={colors.muted} />
                    <Text style={styles.addressText}>{place.address}</Text>
                  </View>
                  <View style={styles.moveRow}>
                    <Ionicons name={index === 0 ? 'flag-outline' : 'navigate-outline'} size={13} color={colors.forest} />
                    <Text style={styles.moveText}>{place.moveLabel} · 머무름 {place.stayMinutes}분</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>예상 총 이동</Text>
          <Text style={styles.bottomValue}>도보 {course.walkMinutes}분 · 대중교통 {course.transitMinutes}분</Text>
        </View>
        <Pressable onPress={onOpenMap} style={styles.startButton}>
          <Ionicons name="navigate" size={17} color={colors.white} />
          <Text style={styles.startText}>동선 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.meta}><Ionicons name={icon} size={14} color="#E5F0EC" /><Text style={styles.metaText}>{text}</Text></View>;
}

function Metric({ label, score, weight, color }: { label: string; score: number; weight: string; color: string }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricTop}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricScore}>{score}점 <Text style={styles.metricWeight}>· {weight}</Text></Text></View>
      <View style={styles.metricTrack}><View style={[styles.metricFill, { width: `${score}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 92 },
  hero: { minHeight: 318, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', padding: 18 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  heroContent: { marginTop: 38, maxWidth: 285 },
  cityPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.lime },
  cityText: { color: colors.forestDark, fontSize: 10, fontWeight: '900' },
  title: { color: colors.white, fontSize: 29, lineHeight: 36, fontWeight: '900', letterSpacing: -1.2, marginTop: 13 },
  subtitle: { color: '#D2E3DE', fontSize: 12, fontWeight: '700', marginTop: 6 },
  metaRow: { flexDirection: 'row', gap: 13, marginTop: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#E5F0EC', fontSize: 9, fontWeight: '800' },
  scoreOrb: { position: 'absolute', right: 20, bottom: 20, width: 82, height: 82, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  score: { color: colors.white, fontSize: 30, lineHeight: 32, fontWeight: '900' },
  scoreLabel: { color: colors.lime, fontSize: 8, fontWeight: '900' },
  body: { paddingHorizontal: 16 },
  coverImage: { width: '100%', height: 180, borderRadius: radii.lg, marginTop: 16, backgroundColor: '#DDE8DF' },
  reasonCard: { marginTop: 16, backgroundColor: colors.paper, borderRadius: radii.lg, padding: 19, ...shadows.card },
  reasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#E6F0DF', alignItems: 'center', justifyContent: 'center' },
  reasonTitleWrap: { flex: 1 },
  reasonEyebrow: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  reasonTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 3 },
  reasonSource: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F0EDE4' },
  reasonSourceText: { color: colors.muted, fontSize: 8, fontWeight: '900' },
  reasonSummary: { color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 14 },
  reasonStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11, padding: 10, borderRadius: 12, backgroundColor: '#F3F5EE' },
  reasonStatusText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700' },
  validationCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: 14, borderRadius: radii.md, backgroundColor: '#E8F0E2' },
  validationCopy: { flex: 1 },
  validationTitle: { color: colors.forestDark, fontSize: 11, fontWeight: '900' },
  validationText: { color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 3 },
  evidenceList: { marginTop: 12, gap: 7 },
  evidenceItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  evidenceText: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  eyebrow: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 4, letterSpacing: -0.6 },
  mapAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapActionText: { color: colors.forest, fontSize: 10, fontWeight: '900' },
  scoreCard: { marginTop: 16, padding: 18, borderRadius: radii.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  scoreCardTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginBottom: 14 },
  metric: { marginBottom: 13 },
  metricTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  metricScore: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  metricWeight: { color: colors.coral, fontSize: 8 },
  metricTrack: { height: 6, borderRadius: 3, backgroundColor: '#EDF0EA', overflow: 'hidden' },
  metricFill: { height: 6, borderRadius: 3 },
  stopCount: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  timeline: { gap: 0 },
  stop: { flexDirection: 'row', gap: 12 },
  stopRail: { width: 30, alignItems: 'center' },
  stopNumber: { width: 29, height: 29, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stopNumberText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  stopLine: { flex: 1, width: 2, minHeight: 92, backgroundColor: '#CAD6CF', marginVertical: 4 },
  stopCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.md, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#E5E9E3' },
  originCard: { backgroundColor: '#FFF7F2', borderColor: '#F1C5B7' },
  originEyebrow: { color: colors.coral, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  stopTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#EBF2E6' },
  categoryText: { color: colors.forest, fontSize: 8, fontWeight: '900' },
  arrival: { color: colors.coral, fontSize: 10, fontWeight: '900' },
  stopName: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 9 },
  stopDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 5 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 7 },
  addressText: { flex: 1, color: colors.muted, fontSize: 8, lineHeight: 12, fontWeight: '700' },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#EDF0EB' },
  moveText: { color: colors.forest, fontSize: 9, fontWeight: '800' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  bottomLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  bottomValue: { color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 3 },
  startButton: { height: 44, borderRadius: 15, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.coral },
  startText: { color: colors.white, fontSize: 12, fontWeight: '900' },
});
