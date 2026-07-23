import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INTEREST_LABELS, PACE_LABELS, START_TYPE_LABELS } from '../domain/labels';
import { colors, radii } from '../theme';
import {
  Interest,
  Pace,
  StartLocationType,
  TravelPreferences,
} from '../types/travel';
import { apiClient } from '../services/apiClient';

const PACES: Pace[] = ['easy', 'balanced', 'full'];
const START_TYPES: StartLocationType[] = ['station', 'terminal', 'current', 'lodging'];
const INTERESTS: Interest[] = ['nature', 'food', 'cafe', 'photo', 'market', 'history'];
const FALLBACK_CITIES = ['순천', '여수', '목포', '나주', '광양', '담양', '보성', '해남'];

export function ConditionForm({
  value,
  onChange,
  onSubmit,
  loading,
}: {
  value: TravelPreferences;
  onChange: (next: TravelPreferences) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const [cities, setCities] = useState<string[]>(FALLBACK_CITIES);

  useEffect(() => {
    apiClient.regions
      .jeonnamCities()
      .then((response: any) => {
        const names = (response.cities as Array<{ name: string }> | undefined)?.map((c) => c.name);
        if (names?.length) setCities(names);
      })
      .catch(() => {
        // keep fallback
      });
  }, []);

  const startPlaceholder = useMemo(() => {
    if (value.startType === 'terminal') return `${value.city}종합터미널`;
    if (value.startType === 'lodging') return `${value.city} 숙소`;
    if (value.startType === 'current') return '현재 위치';
    return `${value.city}역`;
  }, [value.city, value.startType]);

  const patch = (partial: Partial<TravelPreferences>) => {
    const next = { ...value, ...partial };
    const interestLabels = next.interests.slice(0, 3).map((item) => INTEREST_LABELS[item]).join('·');
    next.summary = `${next.city} · ${START_TYPE_LABELS[next.startType]} · ${PACE_LABELS[next.pace]}${next.preferLocal ? ' · 로컬 감성' : ''} · ${interestLabels}`;
    onChange(next);
  };

  const toggleInterest = (interest: Interest) => {
    const exists = value.interests.includes(interest);
    const interests = exists
      ? value.interests.filter((item) => item !== interest)
      : [...value.interests, interest].slice(0, 6);
    patch({ interests: interests.length ? interests : [interest] });
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>코스 조건 선택</Text>
      <Text style={styles.sub}>시군 · 출발지 · 여행 스타일 · 관심사를 고르면 뚜벅이 점수가 달라집니다.</Text>

      <Text style={styles.label}>전남 시군</Text>
      <View style={styles.wrap}>
        {cities.slice(0, 12).map((city) => (
          <Chip key={city} active={value.city === city} label={city} onPress={() => patch({
            city,
            startLocation: value.startType === 'station' ? `${city}역` : value.startLocation.includes(value.city)
              ? value.startLocation.replace(value.city, city)
              : startPlaceholder.replace(value.city, city),
          })} />
        ))}
      </View>

      <Text style={styles.label}>출발지 유형</Text>
      <View style={styles.wrap}>
        {START_TYPES.map((type) => (
          <Chip
            key={type}
            active={value.startType === type}
            label={START_TYPE_LABELS[type]}
            onPress={() => patch({
              startType: type,
              startLocation: type === 'station'
                ? `${value.city}역`
                : type === 'terminal'
                  ? `${value.city}종합터미널`
                  : type === 'lodging'
                    ? `${value.city} 숙소`
                    : '현재 위치',
            })}
          />
        ))}
      </View>

      <Text style={styles.label}>여행 스타일</Text>
      <View style={styles.wrap}>
        {PACES.map((pace) => (
          <Chip key={pace} active={value.pace === pace} label={PACE_LABELS[pace]} onPress={() => patch({ pace })} />
        ))}
        <Chip
          active={value.preferLocal}
          label="로컬 감성"
          onPress={() => patch({ preferLocal: !value.preferLocal })}
        />
      </View>

      <Text style={styles.label}>관심사</Text>
      <View style={styles.wrap}>
        {INTERESTS.map((interest) => (
          <Chip
            key={interest}
            active={value.interests.includes(interest)}
            label={INTEREST_LABELS[interest]}
            onPress={() => toggleInterest(interest)}
          />
        ))}
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={({ pressed }) => [styles.submit, pressed && styles.pressed, loading && styles.disabled]}
      >
        <Text style={styles.submitText}>{loading ? '코스 만드는 중…' : '조건으로 코스 추천'}</Text>
      </Pressable>
    </View>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sub: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  label: { color: colors.forest, fontSize: 10, fontWeight: '900', marginTop: 10, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F5F0',
    borderWidth: 1,
    borderColor: '#E3E7DF',
  },
  chipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  chipTextActive: { color: colors.white },
  submit: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: colors.coral,
    alignItems: 'center',
    paddingVertical: 13,
  },
  submitText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
});
