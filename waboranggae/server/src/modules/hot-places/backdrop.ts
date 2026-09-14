import { fetchCityHighlights, fetchKeywordHighlights } from '../recommendation/data/tour-api';
import { isForestPhoto, pickForestPhotoKorea } from './photokorea';

const FOREST_CITIES = ['담양', '장흥', '장성', '완도', '구례', '보성'];
const FOREST_TOUR_KEYWORDS = ['죽녹원', '편백숲', '수목원', '메타세쿼이아'];

function proxied(url: string) {
  try {
    const host = new URL(url).hostname;
    if (host === 'tong.visitkorea.or.kr' || host.endsWith('visitkorea.or.kr') || host.endsWith('knto.or.kr')) {
      return `/api/media/tour-image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}

function pickForestHighlight<T extends { imageUrl?: string; name?: string; city?: string }>(items: T[]) {
  const withImage = items.filter((item) => item.imageUrl);
  const forest = withImage.filter((item) => isForestPhoto({ title: item.name, location: item.city }));
  const pool = forest.length ? forest : withImage;
  return pool[Math.floor(Math.random() * pool.length)] ?? items[0];
}

export async function pickLoginBackdrop() {
  const photo = await pickForestPhotoKorea();
  if (photo?.url) {
    return {
      img: proxied(photo.url),
      title: photo.title ?? null,
      location: photo.location ?? null,
      source: 'photokorea' as const,
    };
  }

  const keywordHits = (await Promise.all(FOREST_TOUR_KEYWORDS.map((keyword) => fetchKeywordHighlights(keyword, 6)))).flat();
  const cityHits = (await Promise.all(FOREST_CITIES.map((city) => fetchCityHighlights(city, 6)))).flat();
  const picked = pickForestHighlight([...keywordHits, ...cityHits]);
  if (picked?.imageUrl) {
    return {
      img: proxied(picked.imageUrl),
      title: picked.name,
      location: picked.city,
      source: 'tour-api' as const,
    };
  }

  return {
    img: null,
    title: null,
    location: null,
    source: 'none' as const,
  };
}
