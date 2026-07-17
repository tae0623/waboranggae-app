import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '../components/AppIcon';
import { colors, radii, shadows } from '../theme';
import { ConvenienceSpot, RankedCourse } from '../types/travel';

const iconByType: Record<ConvenienceSpot['type'], keyof typeof Ionicons.glyphMap> = {
  locker: 'briefcase-outline',
  bike: 'bicycle-outline',
  restroom: 'accessibility-outline',
};

const labelByType: Record<ConvenienceSpot['type'], string> = {
  locker: '물품보관함',
  bike: '공영자전거',
  restroom: '공중화장실',
};

export function ConvenienceScreen({ course }: { course: RankedCourse }) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>TRAVEL LIGHT</Text>
          <Text style={styles.title}>짐은 내려놓고{`\n`}가볍게 걸어요</Text>
        </View>
        <View style={styles.heroIcon}><Ionicons name="briefcase" size={28} color={colors.forest} /></View>
      </View>

      <View style={styles.routePill}>
        <Ionicons name="location" size={14} color={colors.forest} />
        <Text style={styles.routeText}>{course.title} 주변</Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroCardTop}>
          <View style={styles.dataIcon}><MaterialCommunityIcons name="database-clock-outline" size={22} color={colors.white} /></View>
          <View style={styles.heroCardCopy}>
            <Text style={styles.heroCardTitle}>공공 편의데이터 통합 보기</Text>
            <Text style={styles.heroCardText}>보관함, 자전거, 화장실을 코스 동선과 함께 확인해요.</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <Stat value={String(course.conveniences.filter((item) => item.type === 'locker').length)} label="보관함" />
          <View style={styles.statDivider} />
          <Stat value={String(course.conveniences.filter((item) => item.type === 'bike').length)} label="자전거" />
          <View style={styles.statDivider} />
          <Stat value={String(course.conveniences.filter((item) => item.type === 'restroom').length)} label="화장실" />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>코스 가까운 편의시설</Text>
        <Text style={styles.sectionHint}>거리순</Text>
      </View>

      <View style={styles.list}>
        {course.conveniences.map((spot) => (
          <Pressable key={spot.id} style={styles.card}>
            <View style={[styles.spotIcon, spot.type === 'locker' && styles.spotIconPrimary]}>
              <Ionicons name={iconByType[spot.type]} size={22} color={spot.type === 'locker' ? colors.white : colors.forest} />
            </View>
            <View style={styles.spotCopy}>
              <View style={styles.typeRow}>
                <Text style={styles.typeLabel}>{labelByType[spot.type]}</Text>
                <View style={styles.demoPill}><Text style={styles.demoText}>시연 정보</Text></View>
              </View>
              <Text style={styles.spotName}>{spot.name}</Text>
              <View style={styles.spotMeta}>
                <Text style={styles.distance}>{spot.distanceLabel}</Text>
                <View style={styles.dot} />
                <Text style={styles.availability}>{spot.availabilityLabel}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>

      <View style={styles.alternativeCard}>
        <View style={styles.alternativeIcon}><Ionicons name="bicycle" size={25} color={colors.blue} /></View>
        <View style={styles.alternativeCopy}>
          <Text style={styles.alternativeTitle}>긴 도보 구간은 자전거로 바꿔볼까요?</Text>
          <Text style={styles.alternativeText}>코스 중 가장 긴 구간을 공영자전거로 이동하면 약 18분을 줄일 수 있어요. 실제 도로·대여 현황 확인 후 이용하세요.</Text>
        </View>
      </View>

      <View style={styles.dataNotice}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.forest} />
        <View style={styles.dataNoticeCopy}>
          <Text style={styles.dataNoticeTitle}>데이터 신뢰 안내</Text>
          <Text style={styles.dataNoticeText}>이 MVP의 잔여 수량은 시연값입니다. 운영 환경에서는 행정안전부·지자체 실시간 데이터의 갱신 시각과 출처를 함께 표시합니다.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 24 },
  eyebrow: { color: colors.coral, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 27, lineHeight: 35, fontWeight: '900', letterSpacing: -1, marginTop: 7 },
  heroIcon: { width: 58, height: 58, borderRadius: 21, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '5deg' }] },
  routePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 20, marginTop: 15, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  routeText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  heroCard: { marginHorizontal: 16, marginTop: 20, padding: 18, borderRadius: radii.lg, backgroundColor: colors.forest, ...shadows.card },
  heroCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dataIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  heroCardCopy: { flex: 1 },
  heroCardTitle: { color: colors.white, fontSize: 14, fontWeight: '900' },
  heroCardText: { color: '#CFE3DC', fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 3 },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 17, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  stat: { alignItems: 'center', minWidth: 64 },
  statValue: { color: colors.lime, fontSize: 22, fontWeight: '900' },
  statLabel: { color: '#E1EEE9', fontSize: 9, fontWeight: '800', marginTop: 2 },
  statDivider: { width: 1, height: 27, backgroundColor: 'rgba(255,255,255,0.18)' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 27, marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  list: { paddingHorizontal: 16, gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 19, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  spotIcon: { width: 47, height: 47, borderRadius: 17, backgroundColor: '#E6F0E1', alignItems: 'center', justifyContent: 'center' },
  spotIconPrimary: { backgroundColor: colors.coral },
  spotCopy: { flex: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeLabel: { color: colors.forest, fontSize: 8, fontWeight: '900' },
  demoPill: { borderRadius: 7, backgroundColor: '#F0EDE5', paddingHorizontal: 5, paddingVertical: 3 },
  demoText: { color: colors.muted, fontSize: 7, fontWeight: '900' },
  spotName: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 4 },
  spotMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  distance: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#AAB3AE' },
  availability: { color: colors.coral, fontSize: 8, fontWeight: '900' },
  alternativeCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginTop: 22, padding: 16, borderRadius: radii.md, backgroundColor: '#E3EFF0' },
  alternativeIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  alternativeCopy: { flex: 1 },
  alternativeTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  alternativeText: { color: colors.muted, fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 4 },
  dataNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, marginTop: 22, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  dataNoticeCopy: { flex: 1 },
  dataNoticeTitle: { color: colors.forestDark, fontSize: 10, fontWeight: '900' },
  dataNoticeText: { color: colors.muted, fontSize: 8, lineHeight: 13, fontWeight: '700', marginTop: 3 },
});
