import { describe, expect, it } from 'vitest';
import { cityFromItem } from '../server/src/modules/hot-places/datalab';
import { isForestPhoto } from '../server/src/modules/hot-places/photokorea';
import {
  composeFestivalCopy,
  formatAdmissionFee,
  formatEventPeriod,
  cleanTourText,
  pickAdmissionFee,
  withCopula,
} from '../server/src/modules/hot-places/copy';

describe('hot place city mapping', () => {
  it('maps Jeonnam signgu names to app city names', () => {
    expect(cityFromItem({ signguNm: '순천시' })).toBe('순천');
    expect(cityFromItem({ areaNm: '전라남도 여수시' })).toBe('여수');
    expect(cityFromItem({ signguNm: '서울특별시 강남구' })).toBeNull();
  });
});

describe('login forest photo filter', () => {
  it('keeps forest and bamboo scenes', () => {
    expect(isForestPhoto({ title: '담양 죽녹원', location: '전라남도 담양' })).toBe(true);
    expect(isForestPhoto({ title: '장흥 편백숲', location: '전라남도 장흥' })).toBe(true);
    expect(isForestPhoto({ title: '완도수목원', location: '완도' })).toBe(true);
  });

  it('drops city night and food shots', () => {
    expect(isForestPhoto({ title: '여수 밤바다', location: '전라남도 여수' })).toBe(false);
    expect(isForestPhoto({ title: '목포 홍어삼합', location: '목포' })).toBe(false);
  });
});

describe('festival copy', () => {
  it('turns raw yyyymmdd into a spoken Korean period', () => {
    expect(formatEventPeriod('20261009', '20261010')).toBe('2026년 10월 9일(금) ~ 10일(토)');
  });

  it('does not say a future festival is happening now', () => {
    const copy = composeFestivalCopy({
      city: '담양',
      name: '담양 대나무축제',
      startDate: '20261009',
      endDate: '20261010',
      overview: '죽녹원과 관방제림에서 대나무 공예와 숲길 체험을 여는 지역 축제입니다.',
      eventPlace: '담양읍 죽녹원 일원',
      now: new Date(2026, 8, 15),
    });
    expect(copy.teaser).toBe('담양에서 2026년 10월 9일(금) ~ 10일(토) 열리는 축제예요.');
    expect(copy.teaser).not.toMatch(/지금 열리는/);
    expect(copy.teaser).not.toMatch(/20261009/);
    expect(copy.statusLabel).toBe('곧 열려요');
    expect(copy.story).toContain('죽녹원');
  });

  it('strips TourAPI html and normalizes free admission', () => {
    expect(cleanTourText('성인 5,000원<br />청소년 3,000원')).toBe('성인 5,000원\n청소년 3,000원');
    expect(formatAdmissionFee('무료')).toBe('무료');
    expect(formatAdmissionFee('입장료 없음')).toBe('무료');
  });

  it('reads free-admission notes that TourAPI stored in the hours field', () => {
    expect(pickAdmissionFee('', '무료(프리마켓 및 체험 프로그램 일부 유료)')).toEqual({
      fee: '무료(프리마켓 및 체험 프로그램 일부 유료)',
      hours: '',
    });
  });
});
