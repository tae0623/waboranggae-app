import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '../components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandMark } from '../components/BrandMark';
import { CourseCard } from '../components/CourseCard';
import { SectionHeader } from '../components/SectionHeader';
import { INTEREST_LABELS, PACE_LABELS } from '../domain/labels';
import { colors, radii, shadows } from '../theme';
import { AnalysisSource, RankedCourse, TravelPreferences } from '../types/travel';

const EXAMPLES = [
  '순천역 · 적게 걷기 · 정원과 맛집',
  '여수엑스포역 · 바다 사진과 카페',
  '목포역 · 역사와 전통시장',
];

export function HomeScreen({
  query,
  onQueryChange,
  onAnalyze,
  loading,
  preferences,
  recommendation,
  source,
  onOpenCourse,
  onSeeAll,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  preferences: TravelPreferences | null;
  recommendation: RankedCourse | null;
  source: AnalysisSource | null;
  onOpenCourse: (course: RankedCourse) => void;
  onSeeAll: () => void;
}) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <BrandMark />
        <Pressable style={styles.profile} accessibilityLabel="내 여행 프로필">
          <Ionicons name="person-outline" size={19} color={colors.forest} />
        </Pressable>
      </View>

      <LinearGradient colors={[colors.forestDark, colors.forest, '#17735A']} style={styles.hero}>
        <View style={styles.heroDecorOne} />
        <View style={styles.heroDecorTwo} />
        <View style={styles.aiLabel}>
          <MaterialCommunityIcons name="creation" size={14} color={colors.sun} />
          <Text style={styles.aiLabelText}>AI 여행 조건 분석</Text>
        </View>
        <Text style={styles.heroTitle}>하고 싶은 여행을{`\n`}말하듯 적어보세요</Text>
        <Text style={styles.heroSub}>지역, 걷기 정도, 취향을 한 문장에서 알아들어요.</Text>

        <View style={styles.inputShell}>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            multiline
            maxLength={240}
            style={styles.input}
            placeholder="예: 순천역에서 많이 걷지 않고 정원과 맛집을 보고 싶어요"
            placeholderTextColor="#87978F"
            textAlignVertical="top"
            accessibilityLabel="여행 조건 입력"
          />
          <View style={styles.inputFooter}>
            <Text style={styles.counter}>{query.length}/240</Text>
            <Pressable onPress={onAnalyze} disabled={loading || !query.trim()} style={({ pressed }) => [styles.analyzeButton, pressed && styles.pressed, (loading || !query.trim()) && styles.disabled]}>
              {loading ? <ActivityIndicator size="small" color={colors.white} /> : <MaterialCommunityIcons name="creation" size={16} color={colors.white} />}
              <Text style={styles.analyzeText}>{loading ? '읽는 중…' : '조건 읽기'}</Text>
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examples}>
        {EXAMPLES.map((example) => (
          <Pressable key={example} onPress={() => onQueryChange(`${example} 중심으로 6시간 여행하고 싶어요.`)} style={styles.exampleChip}>
            <Ionicons name="sparkles-outline" size={13} color={colors.coral} />
            <Text style={styles.exampleText}>{example}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {preferences ? (
        <View style={styles.analysisCard}>
          <View style={styles.analysisTop}>
            <View>
              <Text style={styles.analysisEyebrow}>{source === 'ollama' ? '로컬 AI가 이렇게 이해했어요' : '기본 분석기가 이렇게 이해했어요'}</Text>
              <Text style={styles.analysisSummary}>{preferences.summary}</Text>
            </View>
            <View style={[styles.sourcePill, source === 'ollama' ? styles.sourceAi : styles.sourceDemo]}>
              <View style={[styles.sourceDot, source === 'ollama' && styles.sourceDotAi]} />
              <Text style={styles.sourceText}>{source === 'ollama' ? 'Ollama 분석' : '기본 분석'}</Text>
            </View>
          </View>
          <View style={styles.conditionGrid}>
            <Condition icon="location-outline" label="출발" value={preferences.startLocation} />
            <Condition icon="walk-outline" label="여행 스타일" value={PACE_LABELS[preferences.pace]} />
            <Condition icon="time-outline" label="여행 시간" value={`${preferences.durationHours}시간`} />
            <Condition icon="heart-outline" label="관심사" value={preferences.interests.slice(0, 3).map((item) => INTEREST_LABELS[item]).join(' · ')} />
          </View>
          {preferences.wantsLuggageStorage ? (
            <View style={styles.specialCondition}>
              <Ionicons name="briefcase-outline" size={15} color={colors.forest} />
              <Text style={styles.specialText}>물품보관함이 있는 동선을 우선 반영했어요.</Text>
            </View>
          ) : null}
          <Pressable onPress={onAnalyze} style={styles.editRow}>
            <Ionicons name="refresh" size={14} color={colors.forest} />
            <Text style={styles.editText}>문장을 수정한 뒤 다시 분석할 수 있어요</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.guideRow}>
          <Guide icon="chatbubble-ellipses-outline" label="문장 입력" />
          <Ionicons name="arrow-forward" size={15} color="#9EAAA4" />
          <Guide icon="options-outline" label="조건 분석" />
          <Ionicons name="arrow-forward" size={15} color="#9EAAA4" />
          <Guide icon="map-outline" label="코스 추천" />
        </View>
      )}

      {recommendation ? (
        <View style={styles.section}>
          <SectionHeader eyebrow="BEST MATCH" title="가장 잘 맞는 코스예요" action="전체 보기" onAction={onSeeAll} />
          <CourseCard course={recommendation} featured onPress={() => onOpenCourse(recommendation)} />
        </View>
      ) : null}

      <View style={styles.trustCard}>
        <View style={styles.trustIcon}>
          <MaterialCommunityIcons name="database-check-outline" size={22} color={colors.forest} />
        </View>
        <View style={styles.trustCopy}>
          <Text style={styles.trustTitle}>근거가 보이는 추천</Text>
          <Text style={styles.trustText}>관광공사 관광정보, 교통 접근성, 도보 부담, 주변 편의시설을 함께 점수화해요.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Condition({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.condition}>
      <View style={styles.conditionIcon}><Ionicons name={icon} size={16} color={colors.forest} /></View>
      <View style={styles.conditionCopy}>
        <Text style={styles.conditionLabel}>{label}</Text>
        <Text style={styles.conditionValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function Guide({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.guideItem}>
      <View style={styles.guideIcon}><Ionicons name={icon} size={18} color={colors.forest} /></View>
      <Text style={styles.guideLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  profile: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  hero: { marginHorizontal: 16, borderRadius: radii.xl, padding: 22, overflow: 'hidden' },
  heroDecorOne: { position: 'absolute', right: -45, top: -35, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(221,243,167,0.08)' },
  heroDecorTwo: { position: 'absolute', right: 35, top: 78, width: 54, height: 54, borderRadius: 27, borderWidth: 12, borderColor: 'rgba(255,255,255,0.05)' },
  aiLabel: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  aiLabelText: { color: '#F4F6ED', fontSize: 11, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 29, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2, marginTop: 16 },
  heroSub: { color: '#CFE2DC', fontSize: 12, fontWeight: '600', marginTop: 7 },
  inputShell: { backgroundColor: colors.white, borderRadius: 22, padding: 14, marginTop: 20, ...shadows.card },
  input: { minHeight: 86, color: colors.ink, fontSize: 15, lineHeight: 23, fontWeight: '700', padding: 3 },
  inputFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEF0EB', paddingTop: 11 },
  counter: { color: '#9CA7A2', fontSize: 10, fontWeight: '700' },
  analyzeButton: { minWidth: 112, height: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.coral, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  analyzeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.86 },
  examples: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  exampleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#E4E5DD', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  exampleText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  analysisCard: { marginHorizontal: 16, padding: 18, borderRadius: radii.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: '#E4E7DE', ...shadows.card },
  analysisTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  analysisEyebrow: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  analysisSummary: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 5, maxWidth: 250 },
  sourcePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, backgroundColor: '#EFEDE4', paddingHorizontal: 8, paddingVertical: 6 },
  sourceAi: { backgroundColor: '#E2F2D0' },
  sourceDemo: { backgroundColor: '#F0EDE3' },
  sourceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#A09587' },
  sourceDotAi: { backgroundColor: colors.forest },
  sourceText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  conditionGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, rowGap: 12 },
  condition: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 9 },
  conditionIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#E9F0E7', alignItems: 'center', justifyContent: 'center' },
  conditionCopy: { flex: 1, paddingRight: 8 },
  conditionLabel: { color: '#8A9690', fontSize: 9, fontWeight: '800' },
  conditionValue: { color: colors.ink, fontSize: 11, fontWeight: '900', marginTop: 2 },
  specialCondition: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15, backgroundColor: '#EAF2E4', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 },
  specialText: { color: colors.forestDark, fontSize: 10, fontWeight: '800' },
  editRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 14 },
  editText: { color: colors.forest, fontSize: 10, fontWeight: '800' },
  guideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 24, paddingVertical: 9 },
  guideItem: { alignItems: 'center', gap: 6 },
  guideIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  guideLabel: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  section: { paddingHorizontal: 16, gap: 14, marginTop: 26 },
  trustCard: { marginHorizontal: 16, marginTop: 24, padding: 16, borderRadius: 20, backgroundColor: '#E6EFE4', flexDirection: 'row', alignItems: 'center', gap: 13 },
  trustIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  trustCopy: { flex: 1 },
  trustTitle: { color: colors.forestDark, fontSize: 13, fontWeight: '900' },
  trustText: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 4 },
});
