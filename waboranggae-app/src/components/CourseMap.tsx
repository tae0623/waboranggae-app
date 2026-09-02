import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildLeafletHtml } from '../domain/mapHtml';
import { colors, radii } from '../theme';
import { RankedCourse } from '../types/travel';
import { RouteMap } from './RouteMap';

/** Android/iOS에서는 WebView 안에 Leaflet/OpenStreetMap 지도를 표시합니다. */
export function CourseMap({ course }: { course: RankedCourse }) {
  const html = buildLeafletHtml(course);
  if (!html) return <RouteMap course={course} />;

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        originWhitelist={['https://*', 'http://*']}
        javaScriptEnabled
        domStorageEnabled
        accessibilityLabel={`${course.title} 실제 좌표 지도`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 280, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#D9E8D4', borderWidth: 1, borderColor: colors.line },
});
