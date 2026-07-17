import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from './AppIcon';
import { RankedCourse } from '../types/travel';
import { colors, radii } from '../theme';

export function RouteMap({ course, compact = false }: { course: RankedCourse; compact?: boolean }) {
  const points = course.places.map((place) => place.mapPoint);
  const routePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Svg width="100%" height="100%" viewBox="0 0 330 270" accessibilityLabel={`${course.title} 동선 지도`}>
        <Defs>
          <LinearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#EDF3E8" />
            <Stop offset="1" stopColor="#DDE9E3" />
          </LinearGradient>
        </Defs>
        <Path d="M0 0 H330 V270 H0 Z" fill="url(#mapBg)" />
        <Path d="M-20 85 C55 40, 97 112, 168 69 S279 54, 356 22" fill="none" stroke="#C4D3C9" strokeWidth="11" opacity={0.55} />
        <Path d="M-15 206 C69 150, 146 232, 350 152" fill="none" stroke="#C7DDE0" strokeWidth="18" opacity={0.72} />
        <Path d="M20 250 C87 211, 137 224, 207 184 S302 126, 360 145" fill="none" stroke="#FFFFFF" strokeWidth="5" opacity={0.8} />
        <Path d={routePath} fill="none" stroke={course.accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <Path d={routePath} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 7" opacity={0.85} />
        {course.places.map((place, index) => (
          <Circle key={`halo-${place.id}`} cx={place.mapPoint.x} cy={place.mapPoint.y} r="15" fill="#FFFFFF" opacity={0.96} />
        ))}
        {course.places.map((place, index) => (
          <Circle key={`dot-${place.id}`} cx={place.mapPoint.x} cy={place.mapPoint.y} r="11" fill={index === 0 ? colors.coral : course.accent} />
        ))}
        {course.places.map((place, index) => (
          <SvgText key={`text-${place.id}`} x={place.mapPoint.x} y={place.mapPoint.y + 4} fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle">
            {index + 1}
          </SvgText>
        ))}
        {!compact && course.conveniences.map((spot) => (
          <Circle key={spot.id} cx={spot.mapPoint.x} cy={spot.mapPoint.y} r="6" fill={spot.type === 'locker' ? colors.sun : colors.sky} stroke={colors.white} strokeWidth="2" />
        ))}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: course.accent }]} />
          <Text style={styles.legendText}>추천 동선</Text>
        </View>
        {!compact ? (
          <View style={styles.legendItem}>
            <Ionicons name="briefcase" size={12} color={colors.ink} />
            <Text style={styles.legendText}>편의시설</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 300, overflow: 'hidden', backgroundColor: '#E5EDE5', borderRadius: radii.lg },
  compact: { height: 190 },
  legend: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: colors.ink, fontSize: 9, fontWeight: '800' },
});
