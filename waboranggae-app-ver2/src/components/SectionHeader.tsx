import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from './AppIcon';
import { colors } from '../theme';

export function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.action} hitSlop={8}>
          <Text style={styles.actionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.forest} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  copy: { flex: 1 },
  eyebrow: { color: colors.coral, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 },
  title: { color: colors.ink, fontSize: 22, lineHeight: 29, fontWeight: '900', letterSpacing: -0.8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 2 },
  actionText: { color: colors.forest, fontSize: 12, fontWeight: '900' },
});
