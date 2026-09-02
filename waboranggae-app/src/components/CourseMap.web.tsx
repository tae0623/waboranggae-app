import { StyleSheet, View } from 'react-native';
import { buildLeafletHtml } from '../domain/mapHtml';
import { colors, radii } from '../theme';
import { RankedCourse } from '../types/travel';
import { RouteMap } from './RouteMap';

export function CourseMap({ course }: { course: RankedCourse }) {
  const html = buildLeafletHtml(course);
  if (!html) return <RouteMap course={course} />;
  return (
    <View style={styles.wrap}>
      <iframe title={`${course.title} 실제 좌표 지도`} srcDoc={html} style={iframeStyle} />
    </View>
  );
}

const iframeStyle = { width: '100%', height: '100%', border: 'none' } as const;
const styles = StyleSheet.create({
  wrap: { height: 280, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#D9E8D4', borderWidth: 1, borderColor: colors.line },
});
