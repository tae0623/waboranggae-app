import { describe, expect, it } from 'vitest';
import { parseTourImageUrl } from '../server/src/modules/media/routes';
import { resolveTourImageUrl } from '../src/services/apiClient';

describe('TourAPI image proxy', () => {
  it('routes TourAPI images through the configured app API server', () => {
    const original = 'http://tong.visitkorea.or.kr/cms/example.jpg';
    expect(resolveTourImageUrl(original, 'https://api.example.com')).toBe(
      `https://api.example.com/api/media/tour-image?url=${encodeURIComponent(original)}`,
    );
  });

  it('allows only the official TourAPI image host', () => {
    expect(parseTourImageUrl('http://tong.visitkorea.or.kr/cms/example.jpg').hostname)
      .toBe('tong.visitkorea.or.kr');
    expect(parseTourImageUrl('https://photokorea.knto.or.kr/cms/example.jpg').hostname)
      .toBe('photokorea.knto.or.kr');
    expect(() => parseTourImageUrl('https://example.com/image.jpg')).toThrow('허용되지 않은');
  });

  it('does not proxy unrelated image hosts', () => {
    expect(resolveTourImageUrl('https://images.example.com/photo.jpg', 'https://api.example.com'))
      .toBe('https://images.example.com/photo.jpg');
  });
});
