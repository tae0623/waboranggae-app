import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapEmbedUrl } from '../domain/kakaoMapHtml';
import { API_BASE_URL } from '../services/apiClient';
import { colors, radii } from '../theme';
import { RankedCourse } from '../types/travel';
import { RouteMap } from './RouteMap';

/** 등록된 API 도메인에서 Android/iOS용 카카오 지도 페이지를 로드합니다. */
export function CourseMap({ course }: { course: RankedCourse }) {
  const url = mapEmbedUrl(course, API_BASE_URL);
  if (!url) return <RouteMap course={course} />;

  return (
    <View style={styles.wrap}>
      <WebView
        key={url}
        source={{ uri: url }}
        onOpenWindow={({ nativeEvent }) => {
          if (nativeEvent.targetUrl.startsWith('https://map.kakao.com/')) void Linking.openURL(nativeEvent.targetUrl);
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url.startsWith('https://map.kakao.com/')) {
            void Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
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
