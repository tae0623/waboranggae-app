import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '../components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandMark } from '../components/BrandMark';
import { CourseCard } from '../components/CourseCard';
import { ConditionForm } from '../components/ConditionForm';
import { SectionHeader } from '../components/SectionHeader';
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
  onPreferencesChange,
  onRecommendByConditions,
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
  onPreferencesChange: (value: TravelPreferences) => void;
  onRecommendByConditions: () => void;
  recommendation: RankedCourse | null;
  source: AnalysisSource | null;
  onOpenCourse: (course: RankedCourse) => void;
  onSeeAll: () => void;
}) {
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <BrandMark />
        <View style={styles.serviceMark} accessibilityLabel="전남 뚜벅이 여행 서비스">
          <Ionicons name="walk-outline" size={19} color={colors.forest} />
        </View>
      </View>

      <View style={styles.primaryIntro}>
        <View style={styles.primaryBadge}>
          <Ionicons name="options-outline" size={13} color={colors.forest} />
          <Text style={styles.primaryBadgeText}>기본 추천 방식</Text>
        </View>
        <Text style={styles.primaryTitle}>원하는 여행 조건을 골라주세요</Text>
        <Text style={styles.primarySub}>선택한 조건을 직접 확인한 뒤 추천을 시작하므로 결과가 더 안정적이에요.</Text>
      </View>

      {preferences ? (
        <ConditionForm
          value={preferences}
          onChange={onPreferencesChange}
          onSubmit={onRecommendByConditions}
          loading={loading}
        />
      ) : null}

      <Pressable onPress={() => setAiOpen((open) => !open)} style={styles.aiToggle}>
        <View style={styles.aiToggleIcon}>
          <MaterialCommunityIcons name="creation" size={19} color={colors.forest} />
        </View>
        <View style={styles.aiToggleCopy}>
          <View style={styles.aiToggleTitleRow}>
            <Text style={styles.aiToggleTitle}>AI로 조건 자동 채우기</Text>
            <View style={styles.optionalPill}><Text style={styles.optionalText}>선택 기능</Text></View>
          </View>
          <Text style={styles.aiToggleText}>문장으로 입력하면 위 선택 항목에 자동으로 반영해요.</Text>
        </View>
        <Ionicons name={aiOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.forest} />
      </Pressable>

      {aiOpen ? (
        <>
          <LinearGradient colors={[colors.forestDark, colors.forest, '#17735A']} style={styles.hero}>
            <View style={styles.heroDecorOne} />
            <View style={styles.heroDecorTwo} />
            <View style={styles.aiLabel}>
              <MaterialCommunityIcons name="creation" size={14} color={colors.sun} />
              <Text style={styles.aiLabelText}>AI ASSISTANT</Text>
            </View>
            <Text style={styles.heroTitle}>말하듯 적으면{`\n`}조건을 대신 채워드려요</Text>
            <Text style={styles.heroSub}>자동 입력 후 위 조건을 확인하고 수정할 수 있어요.</Text>

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
                accessibilityLabel="AI 여행 조건 입력"
              />
              <View style={styles.inputFooter}>
                <Text style={styles.counter}>{query.length}/240</Text>
                <Pressable onPress={onAnalyze} disabled={loading || !query.trim()} style={({ pressed }) => [styles.analyzeButton, pressed && styles.pressed, (loading || !query.trim()) && styles.disabled]}>
                  {loading ? <ActivityIndicator size="small" color={colors.white} /> : <MaterialCommunityIcons name="creation" size={16} color={colors.white} />}
                  <Text style={styles.analyzeText}>{loading ? '분석 중…' : '조건 자동 채우기'}</Text>
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

          {source && preferences ? (
            <View style={styles.analysisCard}>
              <View style={styles.analysisTop}>
                <View style={styles.analysisCopy}>
                  <Text style={styles.analysisEyebrow}>{source === 'ollama' ? 'AI가 조건을 자동으로 채웠어요' : '기본 분석기로 조건을 채웠어요'}</Text>
                  <Text style={styles.analysisSummary}>{preferences.summary}</Text>
                  <Text style={styles.analysisGuide}>위 선택 항목을 확인·수정한 뒤 “이 조건으로 추천받기”를 눌러주세요.</Text>
                </View>
                <View style={[styles.sourcePill, source === 'ollama' ? styles.sourceAi : styles.sourceDemo]}>
                  <View style={[styles.sourceDot, source === 'ollama' && styles.sourceDotAi]} />
                  <Text style={styles.sourceText}>{source === 'ollama' ? 'Ollama' : '규칙 분석'}</Text>
                </View>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

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
          <Text style={styles.trustText}>관광공사 실제 장소를 바탕으로 AI가 일정을 구성하고, 서버가 출발 거점·식사 시간·식사 후 카페·소요시간을 다시 검증해요.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  serviceMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  primaryIntro: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 },
  primaryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E6F0DF' },
  primaryBadgeText: { color: colors.forest, fontSize: 9, fontWeight: '900' },
  primaryTitle: { color: colors.ink, fontSize: 25, lineHeight: 32, fontWeight: '900', letterSpacing: -0.9, marginTop: 11 },
  primarySub: { color: colors.muted, fontSize: 11, lineHeight: 17, fontWeight: '700', marginTop: 5 },
  aiToggle: { marginHorizontal: 16, marginTop: 16, padding: 14, borderRadius: radii.lg, backgroundColor: '#E8F0E2', flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#D9E5D2' },
  aiToggleIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  aiToggleCopy: { flex: 1 },
  aiToggleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aiToggleTitle: { color: colors.forestDark, fontSize: 13, fontWeight: '900' },
  optionalPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: '#DDF3A7' },
  optionalText: { color: colors.forestDark, fontSize: 8, fontWeight: '900' },
  aiToggleText: { color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 3 },
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
  analysisCopy: { flex: 1 },
  analysisEyebrow: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  analysisSummary: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 5, maxWidth: 250 },
  analysisGuide: { color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 8 },
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
