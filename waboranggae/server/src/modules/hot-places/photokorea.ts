const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const apiBaseUrl = (process.env.PHOTO_KOREA_BASE_URL || 'https://apis.data.go.kr/B551011/PhotoGalleryService2').replace(/\/$/, '');

function decodedServiceKey() {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

export function isPhotoKoreaConfigured() {
  return Boolean(serviceKey);
}

export interface PhotoKoreaImage {
  url: string;
  title?: string;
  location?: string;
}

function asGalleryItems(payload: unknown): Array<{ galWebImageUrl?: string; galTitle?: string; galPhotographyLocation?: string }> {
  const root = payload as {
    response?: { header?: { resultCode?: string }; body?: { items?: { item?: unknown } | '' } };
    OpenAPI_ServiceResponse?: { cmmMsgHeader?: { returnAuthMsg?: string } };
  };
  if (root.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg) return [];
  if (root.response?.header?.resultCode && root.response.header.resultCode !== '0000') return [];
  const item = typeof root.response?.body?.items === 'object' ? root.response.body.items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function toImages(items: Array<{ galWebImageUrl?: string; galTitle?: string; galPhotographyLocation?: string }>) {
  return items.flatMap<PhotoKoreaImage>((entry) => {
    const url = entry.galWebImageUrl?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{ url, title: entry.galTitle?.trim(), location: entry.galPhotographyLocation?.trim() }];
  });
}

async function requestGallery(operation: string, params: Record<string, string>) {
  if (!serviceKey) return [];
  const url = new URL(`${apiBaseUrl}/${operation}`);
  Object.entries({
    serviceKey: decodedServiceKey(),
    MobileOS: 'ETC',
    MobileApp: 'WA_BO_RANG_GAE',
    _type: 'json',
    ...params,
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return [];
  return toImages(asGalleryItems(await response.json()));
}

export async function searchPhotoKorea(keyword: string) {
  if (!serviceKey || !keyword.trim()) return undefined;
  try {
    const images = await requestGallery('gallerySearchList2', {
      pageNo: '1',
      numOfRows: '5',
      arrange: 'B',
      keyword: keyword.trim(),
    });
    return images[0]?.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    console.warn(`[waboranggae] PhotoKorea 조회 실패: ${message}`);
    return undefined;
  }
}

const FOREST_SEARCH_KEYWORDS = ['죽녹원', '편백숲', '수목원', '전남 숲', '담양 대나무', '축령산', '완도수목원', '메타세쿼이아', '녹차밭', '지리산 숲'];
const FOREST_HINT = /숲|산림|수목원|죽녹|대나무|죽림|편백|삼나무|휴양림|녹음|메타세쿼|녹차|축령|백운산|지리산|월출|천관|백양|화엄|정원|습지|생태|자연휴양/;
let forestPhotoPool: { expiresAt: number; images: PhotoKoreaImage[] } | null = null;
const PHOTO_POOL_TTL_MS = 30 * 60 * 1_000;

export function isForestPhoto(image: Pick<PhotoKoreaImage, 'title' | 'location'>) {
  return FOREST_HINT.test(`${image.title ?? ''} ${image.location ?? ''}`);
}

async function loadForestPhotoPool() {
  if (forestPhotoPool && forestPhotoPool.expiresAt > Date.now() && forestPhotoPool.images.length) return forestPhotoPool.images;
  const keywords = [...FOREST_SEARCH_KEYWORDS].sort(() => Math.random() - 0.5).slice(0, 5);
  const pages = await Promise.allSettled(keywords.map((keyword) => requestGallery('gallerySearchList2', {
    pageNo: '1',
    numOfRows: '10',
    arrange: 'B',
    keyword,
  })));
  const images = pages.flatMap((page) => page.status === 'fulfilled' ? page.value : []);
  const unique = [...new Map(images.map((image) => [image.url, image])).values()];
  const forest = unique.filter(isForestPhoto);
  forestPhotoPool = { images: forest.length ? forest : unique, expiresAt: Date.now() + PHOTO_POOL_TTL_MS };
  return forestPhotoPool.images;
}

export async function pickForestPhotoKorea() {
  try {
    const images = await loadForestPhotoPool();
    if (!images.length) return null;
    return images[Math.floor(Math.random() * images.length)] ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    console.warn(`[waboranggae] PhotoKorea 숲 사진 실패: ${message}`);
    return null;
  }
}
