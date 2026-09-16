import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { kakaoDirectionsUrl } from '../domain/kakaoLinks';
import { apiClient } from '../services/apiClient';
import { colors } from '../theme';
import { RouteSegment, RoutingPoint, TravelMode } from '../types/travel';

export function SegmentDirections({ from, to, onResult }: {
  from?: RoutingPoint; to: RoutingPoint; onResult: (segment: RouteSegment | null) => void;
}) {
  const [mode, setMode] = useState<TravelMode>('transit');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [segment, setSegment] = useState<RouteSegment | null>(null);
  async function load() {
    if (!from || busy) return;
    setBusy(true);
    try {
      const result = await apiClient.routeSegment(from, to, mode);
      setSegment(result.segment); setNotice(result.notice); onResult(result.segment);
    } catch {
      setNotice('앱 내 조회에 연결하지 못했습니다. 카카오맵 길찾기를 이용해 주세요.');
    } finally { setBusy(false); }
  }
  return <View style={styles.wrap}>
    <View style={styles.row}>
      {(['transit', 'walk'] as const).map(value => <Pressable key={value} disabled={busy}
        onPress={() => { setMode(value); setSegment(null); setNotice(''); onResult(null); }}
        accessibilityRole="button" accessibilityState={{ selected: mode === value }}
        style={[styles.chip, mode === value && styles.selected]}>
        <Text style={styles.label}>{value === 'walk' ? '도보' : '대중교통'}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="link" style={styles.link}
        onPress={() => { void Linking.openURL(kakaoDirectionsUrl(from, to, mode)).catch(() => setNotice('카카오맵을 열지 못했습니다.')); }}>
        <Text style={styles.linkText}>카카오맵 길찾기 ↗</Text>
      </Pressable>
    </View>
    {from ? <Pressable disabled={busy} onPress={load} style={styles.load} accessibilityRole="button">
      <Text style={styles.loadText}>{busy ? '구간 조회 중…' : '이 구간을 앱 지도에서 확인'}</Text>
    </Pressable> : <Text style={styles.notice}>출발 좌표가 없어 카카오맵에서 출발지를 선택해 주세요.</Text>}
    {segment ? <Text style={styles.result}>{segment.totalMinutes}분 · 도보 {segment.walkMinutes}분 / 대중교통 {segment.transitMinutes}분 · {segment.distanceKm}km</Text> : null}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 6 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { padding: 7, backgroundColor: '#EDF0EB', borderRadius: 8 }, selected: { backgroundColor: '#CBE5CB' },
  label: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  link: { padding: 8, borderRadius: 8, backgroundColor: '#FEE500' }, linkText: { color: '#302B19', fontSize: 11, fontWeight: '800' },
  load: { paddingVertical: 6 }, loadText: { color: colors.forest, fontSize: 11, fontWeight: '700' },
  notice: { color: colors.muted, fontSize: 10, lineHeight: 15 }, result: { color: colors.forest, fontSize: 12, fontWeight: '800' },
});

