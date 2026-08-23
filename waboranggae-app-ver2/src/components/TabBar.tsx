import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from './AppIcon';
import { colors, shadows } from '../theme';

export type AppTab = 'home' | 'courses' | 'map' | 'convenience';

const TABS: Array<{ key: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'home', label: '홈', icon: 'home-outline', activeIcon: 'home' },
  { key: 'courses', label: '코스', icon: 'map-outline', activeIcon: 'map' },
  { key: 'map', label: '동선', icon: 'navigate-circle-outline', activeIcon: 'navigate-circle' },
  { key: 'convenience', label: '편의', icon: 'briefcase-outline', activeIcon: 'briefcase' },
];

export function TabBar({ active, onChange }: { active: AppTab; onChange: (tab: AppTab) => void }) {
  return (
    <View style={styles.shell}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected }}>
            <View style={[styles.iconWrap, selected && styles.iconActive]}>
              <Ionicons name={selected ? tab.activeIcon : tab.icon} size={20} color={selected ? colors.white : colors.muted} />
            </View>
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E8ECE6',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    ...shadows.card,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrap: { width: 36, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconActive: { backgroundColor: colors.forest },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  labelActive: { color: colors.forestDark },
});
