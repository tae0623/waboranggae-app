import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { RankedCourse } from '../types/travel';
import { colors, radii } from '../theme';

export function RouteMap({ course, compact = false }: { course: RankedCourse; compact?: boolean }) {
  const geoPoints = [
    ...(course.origin ? [course.origin] : []),
    ...course.places.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude)),
    ...(course.conveniences || []),
  ];
  const latitudes = geoPoints.map((point) => point.latitude!);
  const longitudes = geoPoints.map((point) => point.longitude!);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const project = (latitude: number, longitude: number) => ({
    x: 30 + (longitude - minLng) / Math.max(0.002, maxLng - minLng) * 270,
    y: 235 - (latitude - minLat) / Math.max(0.002, maxLat - minLat) * 195,
  });
  const placePoints = course.places.map((place) =>
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
      ? project(place.latitude!, place.longitude!)
      : place.mapPoint,
  );
  const originPoint = course.origin ? project(course.origin.latitude, course.origin.longitude) : null;
  const lockerPoints = (course.conveniences || []).map((spot) => project(spot.latitude, spot.longitude));
  const fallbackPoints = [...(originPoint ? [originPoint] : []), ...placePoints];
  const fallbackPath = fallbackPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const routePaths = course.routeSegments?.length
    ? course.routeSegments.map((segment) => ({
      source: segment.source,
      path: segment.geometry.map((point, index) => {
        const mapped = project(point.latitude, point.longitude);
        return `${index === 0 ? 'M' : 'L'} ${mapped.x} ${mapped.y}`;
      }).join(' '),
    }))
    : [{ source: 'estimated' as const, path: fallbackPath }];

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
        {routePaths.map((route, index) => (
          <Path key={`route-${index}`} d={route.path} fill="none" stroke={route.source === 'tmap-transit' ? course.accent : '#7A8B82'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={route.source === 'tmap-transit' ? undefined : '8 7'} />
        ))}
        {originPoint ? <Rect x={originPoint.x - 14} y={originPoint.y - 14} width="28" height="28" rx="9" fill={colors.coral} stroke={colors.white} strokeWidth="3" /> : null}
        {originPoint ? <SvgText x={originPoint.x} y={originPoint.y + 4} fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle">출</SvgText> : null}
        {course.places.map((place, index) => (
          <Circle key={`halo-${place.id}`} cx={placePoints[index]!.x} cy={placePoints[index]!.y} r="15" fill="#FFFFFF" opacity={0.96} />
        ))}
        {!compact && lockerPoints.map((point, index) => (
          <Circle key={`locker-${course.conveniences?.[index]?.id}`} cx={point.x} cy={point.y} r="7" fill={colors.coral} stroke={colors.white} strokeWidth="2" />
        ))}
        {course.places.map((place, index) => (
          <Circle key={`dot-${place.id}`} cx={placePoints[index]!.x} cy={placePoints[index]!.y} r="11" fill={course.accent} />
        ))}
        {course.places.map((place, index) => (
          <SvgText key={`text-${place.id}`} x={placePoints[index]!.x} y={placePoints[index]!.y + 4} fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle">
            {index + 1}
          </SvgText>
        ))}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: course.accent }]} />
          <Text style={styles.legendText}>{course.routeSource === 'tmap-transit' ? 'TMAP 실제 동선' : '예상 동선'}</Text>
        </View>
        {!compact && lockerPoints.length ? (
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.coral }]} />
            <Text style={styles.legendText}>공영 물품보관함</Text>
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
