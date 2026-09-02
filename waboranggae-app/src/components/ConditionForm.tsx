import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { INTEREST_LABELS, PACE_LABELS, START_TYPE_LABELS } from '../domain/labels';
import { apiClient } from '../services/apiClient';
import { defaultStartLocation } from '../domain/startLocation';
import { colors, radii } from '../theme';
import {
  Interest,
  MealPreference,
  Pace,
  StartLocationType,
  TravelPreferences,
} from '../types/travel';

const PACES: Pace[] = ['easy', 'balanced', 'full'];
// 현재 위치는 실제 위치 권한·좌표 연동 전까지 선택지에서 노출하지 않습니다.
const START_TYPES: StartLocationType[] = ['station', 'terminal', 'lodging', 'custom'];
const INTERESTS: Interest[] = ['nature', 'food', 'cafe', 'photo', 'market', 'history'];
const DURATIONS = [2, 4, 6, 8, 10, 12];
const START_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '16:00'];
const MEAL_PREFERENCES: MealPreference[] = ['auto', 'none', 'lunch', 'dinner', 'both'];
const MEAL_LABELS: Record<MealPreference, string> = {
  auto: '시간에 맞춰 자동',
  none: '식사 제외',
  lunch: '점심',
  dinner: '저녁',
  both: '점심+저녁',
};
const COMPANIONS = ['혼자', '친구와 함께', '연인과 함께', '가족과 함께', '부모님과 함께', '아이와 함께'];
const FALLBACK_CITIES = [
  '목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순',
  '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안',
];

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
      .then((response) => {
        const names = response.cities.map((city) => city.name);
        if (names.length) setCities(names);
      })
      .catch(() => {
        // API 서버가 없을 때도 기본 목록으로 조건을 선택할 수 있습니다.
      });
  }, []);

  const patch = (partial: Partial<TravelPreferences>) => {
    const next = { ...value, ...partial };
    const interestLabels = next.interests
      .slice(0, 3)
      .map((item) => INTEREST_LABELS[item])
      .join('·');
    next.summary = [
      next.city,
      `${next.startTime} 시작`,
      `${next.durationHours}시간`,
      next.startLocation,
      PACE_LABELS[next.pace],
      next.companions,
      interestLabels,
      next.preferLocal ? '로컬 감성' : '',
      MEAL_LABELS[next.mealPreference],
    ].filter(Boolean).join(' · ');
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
      <Text style={styles.title}>1. 여행 조건을 선택하세요</Text>
      <Text style={styles.sub}>지역, 시간, 동행, 관심사와 이동 조건을 직접 고른 뒤 추천을 시작합니다.</Text>

      <Text style={styles.label}>전남 지역</Text>
      <View style={styles.wrap}>
        {cities.map((city) => (
          <Chip
            key={city}
            active={value.city === city}
            label={city}
            onPress={() => patch({
              region: '전라남도',
              city,
              startLocation: defaultStartLocation(city, value.startType),
            })}
          />
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
              startLocation: defaultStartLocation(value.city, type),
            })}
          />
        ))}
      </View>
      <TextInput
        value={value.startLocation}
        onChangeText={(startLocation) => patch({
          startLocation,
          ...(value.startType === 'station' && !/역/.test(startLocation) ? { startType: 'custom' as const } : {}),
        })}
        placeholder="예: 읍내 버스정류장, 여객선터미널, 숙소 주소"
        placeholderTextColor={colors.muted}
        style={styles.startInput}
        accessibilityLabel="구체적인 여행 출발지"
      />
      <Text style={styles.helper}>기차역이 없는 지역은 터미널을 선택하거나 실제 버스정류장·여객선터미널·숙소 주소를 직접 입력하세요.</Text>

      <Text style={styles.label}>여행 시간</Text>
      <View style={styles.wrap}>
        {START_TIMES.map((time) => (
          <Chip
            key={time}
            active={value.startTime === time}
            label={`${Number(time.slice(0, 2))}시 시작`}
            onPress={() => patch({ startTime: time })}
          />
        ))}
      </View>

      <Text style={styles.label}>여행 길이</Text>
      <View style={styles.wrap}>
        {DURATIONS.map((hours) => (
          <Chip
            key={hours}
            active={value.durationHours === hours}
            label={`${hours}시간`}
            onPress={() => patch({ durationHours: hours })}
          />
        ))}
      </View>

      <Text style={styles.label}>식사 일정</Text>
      <View style={styles.wrap}>
        {MEAL_PREFERENCES.map((mealPreference) => (
          <Chip
            key={mealPreference}
            active={value.mealPreference === mealPreference}
            label={MEAL_LABELS[mealPreference]}
            onPress={() => patch({ mealPreference })}
          />
        ))}
      </View>
      <Text style={styles.helper}>점심 11:30~13:30, 저녁 17:30~19:30을 기준으로 배치하고 카페는 식사 뒤에 이어지도록 구성해요.</Text>

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

      <Text style={styles.label}>동행</Text>
      <View style={styles.wrap}>
        {COMPANIONS.map((companion) => (
          <Chip
            key={companion}
            active={value.companions === companion}
            label={companion}
            onPress={() => patch({ companions: companion })}
          />
        ))}
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

      <Text style={styles.label}>추가 조건</Text>
      <View style={styles.wrap}>
        <Chip
          active={value.publicTransportOnly}
          label="대중교통만"
          onPress={() => patch({ publicTransportOnly: !value.publicTransportOnly })}
        />
        <Chip
          active={value.lowMobility}
          label="걷기 부담 최소"
          onPress={() => patch({
            lowMobility: !value.lowMobility,
            ...(!value.lowMobility ? { pace: 'easy' as Pace } : {}),
          })}
        />
      </View>

      <View style={styles.confirmation}>
        <Text style={styles.confirmationLabel}>선택 내용</Text>
        <Text style={styles.confirmationText}>{value.summary}</Text>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={({ pressed }) => [styles.submit, pressed && styles.pressed, loading && styles.disabled]}
      >
        <Text style={styles.submitText}>{loading ? '코스 만드는 중…' : '2. 이 조건으로 추천받기'}</Text>
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
  label: { color: colors.forest, fontSize: 10, fontWeight: '900', marginTop: 12, marginBottom: 8 },
  helper: { color: colors.muted, fontSize: 8, lineHeight: 13, fontWeight: '700', marginTop: 6 },
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
  startInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: '#FAFBF8',
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  confirmation: {
    marginTop: 18,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: '#F0F5EC',
    borderWidth: 1,
    borderColor: '#DFE9D8',
  },
  confirmationLabel: { color: colors.forest, fontSize: 9, fontWeight: '900' },
  confirmationText: { color: colors.ink, fontSize: 11, lineHeight: 17, fontWeight: '800', marginTop: 4 },
  submit: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: colors.coral,
    alignItems: 'center',
    paddingVertical: 13,
  },
  submitText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
});
