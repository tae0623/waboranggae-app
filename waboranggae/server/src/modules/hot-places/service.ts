import { CATEGORY_LABELS, INTEREST_LABELS } from '../../../../src/domain/labels';
import { fetchCityHighlights, fetchOngoingFestivals, fetchTourPlaceDetail, TourHighlight } from '../recommendation/data/tour-api';
import {
  composeAttractionCopy,
  composeFestivalCopy,
  pickAdmissionFee,
  cleanTourText,
} from './copy';
import { rankJeonnamCities } from './datalab';
import { searchPhotoKorea } from './photokorea';

export interface HotPlaceDto {
  id: string;
  name: string;
  city: string;
  category: string;
  desc: string;
  story?: string;
  img: string;
  visitors: number;
  metricLabel: string;
  tags: string[];
  isNew?: boolean;
  isTrending?: boolean;
  source: 'demand' | 'visitors' | 'festival' | 'tour-api';
  address?: string;
  periodLabel?: string;
  periodShort?: string;
  statusLabel?: string;
  fee?: string;
  hours?: string;
  eventPlace?: string;
  sponsor?: string;
  ageLimit?: string;
  tel?: string;
  spendTime?: string;
  program?: string;
  restDate?: string;
  homepage?: string;
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=700&h=500&fit=crop&auto=format';
let cache: { expiresAt: number; value: { places: HotPlaceDto[]; source: string; fetchedAt: string } } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1_000;

function categoryLabel(highlight: TourHighlight) {
  if (highlight.contentTypeId === 15) return '축제·행사';
  return CATEGORY_LABELS[highlight.category] || '관광';
}

function describePlace(highlight: TourHighlight, demandLabel: string) {
  if (highlight.contentTypeId === 15) {
    return composeFestivalCopy({
      city: highlight.city,
      name: highlight.name,
      startDate: highlight.eventStartDate,
      endDate: highlight.eventEndDate,
    }).teaser;
  }
  return composeAttractionCopy({
    city: highlight.city,
    name: highlight.name,
    address: highlight.address,
    demandLabel,
  }).teaser;
}

async function enrichHighlight(highlight: TourHighlight) {
  const contentId = highlight.id.replace(/^festival-/, '');
  const detail = await fetchTourPlaceDetail(contentId, highlight.contentTypeId);
  const startDate = detail?.startDate || highlight.eventStartDate;
  const endDate = detail?.endDate || highlight.eventEndDate;
  const isFestival = highlight.contentTypeId === 15;
  if (isFestival) {
    const copy = composeFestivalCopy({
      city: highlight.city,
      name: highlight.name,
      startDate,
      endDate,
      overview: detail?.overview,
      eventPlace: detail?.eventPlace,
    });
    const admission = pickAdmissionFee(detail?.fee, detail?.hours);
    return {
      story: copy.story,
      desc: copy.teaser,
      periodLabel: copy.periodLabel,
      periodShort: copy.periodShort,
      statusLabel: copy.statusLabel,
      fee: admission.fee,
      hours: admission.hours,
      eventPlace: cleanTourText(detail?.eventPlace),
      sponsor: cleanTourText(detail?.sponsor),
      ageLimit: cleanTourText(detail?.ageLimit),
      tel: cleanTourText(detail?.tel),
      spendTime: cleanTourText(detail?.spendTime),
      program: cleanTourText(detail?.program),
      restDate: cleanTourText(detail?.restDate),
      homepage: detail?.homepage || '',
    };
  }
  const copy = composeAttractionCopy({
    city: highlight.city,
    name: highlight.name,
    address: highlight.address,
    overview: detail?.overview,
  });
  const admission = pickAdmissionFee(detail?.fee, detail?.hours);
  return {
    story: copy.story,
    desc: copy.teaser,
    periodLabel: '',
    periodShort: '',
    statusLabel: '',
    fee: admission.fee,
    hours: admission.hours,
    eventPlace: '',
    sponsor: '',
    ageLimit: '',
    tel: cleanTourText(detail?.tel),
    spendTime: '',
    program: '',
    restDate: cleanTourText(detail?.restDate),
    homepage: detail?.homepage || '',
  };
}

function toTags(highlight: TourHighlight) {
  const tags = highlight.tags.map((tag) => INTEREST_LABELS[tag]);
  if (highlight.contentTypeId === 15) tags.unshift('축제');
  return [...new Set(tags)].slice(0, 3);
}

function proxiedImage(url?: string) {
  if (!url) return PLACEHOLDER_IMAGE;
  try {
    const host = new URL(url).hostname;
    if (host === 'tong.visitkorea.or.kr' || host.endsWith('visitkorea.or.kr') || host.endsWith('knto.or.kr')) {
      return `/api/media/tour-image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    return PLACEHOLDER_IMAGE;
  }
  return url;
}

async function withPhoto(highlight: TourHighlight) {
  if (highlight.imageUrl) return highlight.imageUrl;
  return await searchPhotoKorea(`${highlight.city} ${highlight.name}`)
    || await searchPhotoKorea(highlight.name)
    || await searchPhotoKorea(highlight.city);
}

export async function listHotPlaces(limit = 6) {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const [rankedCities, festivals] = await Promise.all([
    rankJeonnamCities(),
    fetchOngoingFestivals(3),
  ]);

  const cityPlaces = await Promise.all(rankedCities.slice(0, 8).map(async (city, index) => {
    const highlights = await fetchCityHighlights(city.name, 6);
    const picked = highlights.find((item) => item.imageUrl) ?? highlights[0];
    if (!picked) return null;
    const imageUrl = await withPhoto(picked);
    const visitors = city.visitors == null ? Math.round(city.score) : Math.round(city.visitors);
    const demandLabel = city.source === 'visitors'
      ? `최근 방문자 규모를 반영한 ${city.name} 인기 장소예요.`
      : city.source === 'demand'
        ? `한국관광 데이터랩 수요 강도가 높은 ${city.name}의 대표 장소예요.`
        : `전남에서 많이 찾는 ${city.name} 관광지예요.`;
    const extra = await enrichHighlight(picked);
    return {
      ...extra,
      id: picked.id,
      name: picked.name,
      city: picked.city,
      category: categoryLabel(picked),
      desc: extra.desc || describePlace(picked, demandLabel),
      img: proxiedImage(imageUrl),
      visitors,
      metricLabel: city.source === 'visitors' ? '최근 방문자' : '수요 지수',
      tags: toTags(picked),
      isTrending: index < 2,
      isNew: false,
      source: city.source === 'fallback' ? 'tour-api' : city.source,
      address: picked.address,
    } satisfies HotPlaceDto;
  }));

  const festivalPlaces = await Promise.all(festivals.map(async (festival, index) => {
    const imageUrl = await withPhoto(festival);
    const extra = await enrichHighlight({ ...festival, contentTypeId: festival.contentTypeId || 15 });
    return {
      ...extra,
      id: `festival-${festival.id}`,
      name: festival.name,
      city: festival.city,
      category: categoryLabel(festival),
      img: proxiedImage(imageUrl),
      visitors: 0,
      metricLabel: extra.statusLabel || '진행 중 행사',
      tags: toTags(festival),
      isTrending: index === 0,
      isNew: extra.statusLabel === '곧 열려요' || extra.statusLabel === '지금 진행 중',
      source: 'festival' as const,
      address: extra.eventPlace || festival.address,
    } satisfies HotPlaceDto;
  }));

  const merged: HotPlaceDto[] = [];
  const seen = new Set<string>();
  const cityHits = cityPlaces.filter((item): item is NonNullable<typeof item> => item != null);
  for (const place of [...festivalPlaces, ...cityHits]) {
    const key = `${place.city}:${place.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
    if (merged.length >= limit) break;
  }

  const value = {
    places: merged,
    source: rankedCities[0]?.source ?? 'tour-api',
    fetchedAt: new Date().toISOString(),
  };
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}
