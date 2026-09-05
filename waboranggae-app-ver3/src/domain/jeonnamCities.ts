import cities from './jeonnamCities.json';

/** 전라남도 시·군 목록 (파서 · UI · TourAPI · 검증 스크립트 공통) */
export const JEONNAM_CITIES = cities as readonly string[];

export const JEONNAM_CITY_SET = new Set<string>(JEONNAM_CITIES);

/** 문장에서 시·군명을 찾을 때 긴 이름 우선 (부분 문자열 충돌 방지) */
export const JEONNAM_CITIES_BY_LENGTH = [...JEONNAM_CITIES].sort((a, b) => b.length - a.length);
