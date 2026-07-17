import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from './AppIcon';
import { RankedCourse } from '../types/travel';
import { colors, radii, shadows } from '../theme';
import { ScoreBadge } from './ScoreBadge';

export function CourseCard({
  course,
  onPress,
  featured = false,
}: {
  course: RankedCourse;
  onPress: () => void;
  featured?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        featured && { backgroundColor: course.accent },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${course.title}, 적합도 ${course.fitScore}점`}
    >
      <View style={styles.topRow}>
        <View style={styles.cityPill}>
          <Ionicons name="location" size={12} color={featured ? colors.forestDark : course.accent} />
          <Text style={[styles.city, featured && styles.cityFeatured]}>{course.city}</Text>
        </View>
        <ScoreBadge score={course.fitScore} inverse={featured} />
      </View>

      <Text style={[styles.title, featured && styles.titleFeatured]}>{course.title}</Text>
      <Text style={[styles.subtitle, featured && styles.subtitleFeatured]}>{course.subtitle}</Text>

      <View style={styles.metaRow}>
        <Meta icon="time-outline" text={`${course.durationHours}시간`} featured={featured} />
        <Meta icon="walk-outline" text={`${course.distanceKm}km`} featured={featured} />
        <Meta icon="flag-outline" text={`${course.places.length}곳`} featured={featured} />
      </View>

      {featured ? (
        <View style={styles.reasonBox}>
          <View style={styles.aiDot} />
          <Text style={styles.reasonText} numberOfLines={2}>{course.reason.summary}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.forestDark} />
        </View>
      ) : (
        <View style={styles.routePreview}>
          {course.places.slice(0, 4).map((place, index) => (
            <View key={place.id} style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: course.accent }]}>
                <Text style={styles.routeNumber}>{index + 1}</Text>
              </View>
              {index < Math.min(3, course.places.length - 1) ? <View style={styles.routeLine} /> : null}
            </View>
          ))}
          <Text style={styles.routeLabel} numberOfLines={1}>{course.places.slice(0, 3).map((place) => place.name).join(' · ')}</Text>
        </View>
      )}
    </Pressable>
  );
}

function Meta({ icon, text, featured }: { icon: keyof typeof Ionicons.glyphMap; text: string; featured: boolean }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={featured ? '#DDECE7' : colors.muted} />
      <Text style={[styles.metaText, featured && styles.metaTextFeatured]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8ECE6',
    ...shadows.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 13 },
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cream, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  city: { fontSize: 11, fontWeight: '900' },
  cityFeatured: { color: colors.forestDark },
  title: { color: colors.ink, fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.7, paddingRight: 6 },
  titleFeatured: { color: colors.white, fontSize: 24, lineHeight: 31 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 6 },
  subtitleFeatured: { color: '#CFE2DC' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  metaTextFeatured: { color: '#E9F3EF' },
  reasonBox: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, padding: 13, borderRadius: 17, backgroundColor: colors.lime },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  reasonText: { flex: 1, color: colors.forestDark, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  routePreview: { flexDirection: 'row', alignItems: 'center', marginTop: 17 },
  routeItem: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  routeNumber: { color: colors.white, fontSize: 9, fontWeight: '900' },
  routeLine: { width: 10, height: 2, backgroundColor: colors.line },
  routeLabel: { flex: 1, color: colors.muted, fontSize: 10, fontWeight: '700', marginLeft: 8 },
});
