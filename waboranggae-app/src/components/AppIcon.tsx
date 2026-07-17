import { StyleProp, Text, TextStyle } from 'react-native';

const glyphMap: Record<string, string> = {
  'shoe-print': '〽',
  'creation': '✦',
  'database-check-outline': '✓',
  'database-clock-outline': '◷',
  'home': '⌂',
  'home-outline': '⌂',
  'map': '◆',
  'map-outline': '◇',
  'navigate': '➤',
  'navigate-outline': '➤',
  'navigate-circle': '◎',
  'navigate-circle-outline': '◎',
  'briefcase': '▣',
  'briefcase-outline': '▢',
  'person-outline': '○',
  'location': '●',
  'location-outline': '○',
  'time-outline': '◷',
  'walk-outline': '〽',
  'flag-outline': '⚑',
  'chevron-forward': '›',
  'chevron-down': '⌄',
  'arrow-forward': '→',
  'arrow-back': '←',
  'sparkles': '✦',
  'sparkles-outline': '✦',
  'chatbubble-ellipses-outline': '◌',
  'options-outline': '☷',
  'refresh': '↻',
  'heart-outline': '♡',
  'footsteps': '〽',
  'information-circle-outline': 'ⓘ',
  'information-circle': 'ⓘ',
  'share-social-outline': '↗',
  'bookmark-outline': '⌑',
  'bus-outline': '▤',
  'checkmark-circle': '✓',
  'expand-outline': '⤢',
  'ellipsis-horizontal': '•••',
  'locate': '◎',
  'layers-outline': '▱',
  'bicycle': '⚙',
  'bicycle-outline': '⚙',
  'accessibility-outline': '♿',
  'shield-checkmark-outline': '✓',
  'checkmark': '✓',
};

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

function GlyphIcon({ name, size = 20, color = '#17312A', style }: IconProps) {
  return (
    <Text
      aria-hidden
      style={[
        { color, fontSize: size, lineHeight: size + 3, fontWeight: '900', textAlign: 'center' },
        style,
      ]}
    >
      {glyphMap[name] ?? '•'}
    </Text>
  );
}

export const Ionicons = Object.assign(GlyphIcon, { glyphMap });
export const MaterialCommunityIcons = Object.assign(GlyphIcon, { glyphMap });
