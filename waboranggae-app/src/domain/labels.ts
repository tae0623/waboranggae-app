import { Interest, Pace, PlaceCategory } from '../types/travel';

export const INTEREST_LABELS: Record<Interest, string> = {
  nature: '자연',
  food: '맛집',
  cafe: '카페',
  photo: '사진',
  market: '시장',
  history: '역사',
};

export const PACE_LABELS: Record<Pace, string> = {
  easy: '적게 걷기',
  balanced: '보통',
  full: '많이 보기',
};

export const START_TYPE_LABELS: Record<import('../types/travel').StartLocationType, string> = {
  station: '역',
  terminal: '터미널',
  current: '현재 위치',
  lodging: '숙소',
  custom: '직접 입력',
};

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  station: '교통거점',
  nature: '자연',
  food: '식사',
  cafe: '카페',
  market: '시장',
  history: '역사',
  culture: '문화',
};
