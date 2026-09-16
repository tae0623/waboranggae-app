import { StyleSheet, View } from 'react-native';
import { mapEmbedUrl } from '../domain/kakaoMapHtml';
import { API_BASE_URL } from '../services/apiClient';
import { colors, radii } from '../theme';
import { RankedCourse } from '../types/travel';
import { RouteMap } from './RouteMap';

export function CourseMap({ course }: { course: RankedCourse }) {
  const url = mapEmbedUrl(course, API_BASE_URL);
  if (!url) return <RouteMap course={course} />;
  return (
    <View style={styles.wrap}>
      <iframe key={url} title={`${course.title} 카카오 지도`} src={url} style={iframeStyle} />
    </View>
  );
}

const iframeStyle = { width: '100%', height: '100%', border: 'none' } as const;
const styles = StyleSheet.create({
  wrap: { height: 280, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#D9E8D4', borderWidth: 1, borderColor: colors.line },
});
