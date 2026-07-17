import { Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from './AppIcon';
import { colors } from '../theme';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel="와보랑께">
      <View style={[styles.mark, compact && styles.markCompact]}>
        <MaterialCommunityIcons name="shoe-print" size={compact ? 18 : 22} color={colors.cream} />
      </View>
      <View>
        <Text style={[styles.name, compact && styles.nameCompact]}>와보랑께</Text>
        {!compact && <Text style={styles.caption}>AI 전남 뚜벅이 여행</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-7deg' }],
  },
  markCompact: { width: 34, height: 34, borderRadius: 12 },
  name: { color: colors.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.8 },
  nameCompact: { fontSize: 18 },
  caption: { marginTop: 1, color: colors.muted, fontSize: 11, fontWeight: '700' },
});
