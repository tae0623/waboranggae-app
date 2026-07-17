import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function ScoreBadge({ score, inverse = false }: { score: number; inverse?: boolean }) {
  return (
    <View style={[styles.badge, inverse && styles.badgeInverse]}>
      <Text style={[styles.score, inverse && styles.scoreInverse]}>{score}</Text>
      <Text style={[styles.unit, inverse && styles.unitInverse]}>점</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 58,
    height: 58,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInverse: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  score: { color: colors.forestDark, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  scoreInverse: { color: colors.white },
  unit: { color: colors.forest, fontSize: 9, fontWeight: '900' },
  unitInverse: { color: '#DDF3A7' },
});
