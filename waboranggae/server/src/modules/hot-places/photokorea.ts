const serviceKey = (process.env.DATA_GO_KR_KEY || '').trim();
const configuredBase = process.env.PHOTO_KOREA_BASE_URL?.trim().replace(/\/$/, '');
const apiBaseUrl = !configuredBase || /^https?:\/\/apis\.data\.go\.kr\/B551011\/PhotoGalleryService2$/.test(configuredBase)
  ? 'https://apis.data.go.kr/B551011/PhotoGalleryService1' : configuredBase;

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
  photographer?: string;
  contentId?: string;
}

type GalleryItem={ galWebImageUrl?: string; galTitle?: string; galPhotographyLocation?: string; galPhotographer?:string;galContentId?:string };
function asGalleryItems(payload: unknown): GalleryItem[] {
  const root = payload as {
    response?: { header?: { resultCode?: string }; body?: { items?: { item?: unknown } | '' } };
    OpenAPI_ServiceResponse?: { cmmMsgHeader?: { returnAuthMsg?: string } };
  };
  if (root.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg) throw new Error('PhotoKorea 인증 오류');
  if (root.response?.header?.resultCode && !['0000', '00'].includes(root.response.header.resultCode)) throw new Error('PhotoKorea 응답 오류');
  const item = typeof root.response?.body?.items === 'object' ? root.response.body.items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

export function toPhotoImages(items: GalleryItem[]) {
  return items.flatMap<PhotoKoreaImage>((entry) => {
    const url = entry.galWebImageUrl?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return [];
    return [{ url, title: entry.galTitle?.trim(), location: entry.galPhotographyLocation?.trim(),photographer:entry.galPhotographer?.trim(),contentId:entry.galContentId }];
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
  if (!response.ok) throw new Error(`PhotoKorea HTTP ${response.status}`);
  return toPhotoImages(asGalleryItems(await response.json()));
}

export async function searchPhotoKoreaDetails(keyword: string) {
  if (!serviceKey || !keyword.trim()) return undefined;
  try {
    const images = await requestGallery('gallerySearchList1', {
      pageNo: '1',
      numOfRows: '5',
      arrange: 'B',
      keyword: keyword.trim(),
    });
    return images[0];
  } catch (error) {
    console.warn(`[waboranggae] PhotoKorea 조회 실패 (${error instanceof Error ? error.name : 'Error'}); TourAPI 사진을 사용합니다.`);
    return undefined;
  }
}
export async function searchPhotoKorea(keyword:string){return (await searchPhotoKoreaDetails(keyword))?.url;}

const FOREST_SEARCH_KEYWORDS = ['죽녹원', '편백숲', '수목원', '전남 숲', '담양 대나무', '축령산', '완도수목원', '메타세쿼이아', '녹차밭', '지리산 숲'];
const FOREST_HINT = /숲|산림|수목원|죽녹|대나무|죽림|편백|삼나무|휴양림|녹음|메타세쿼|녹차|축령|백운산|지리산|월출|천관|백양|화엄|정원|습지|생태|자연휴양/;
let forestPhotoPool: { expiresAt: number; images: PhotoKoreaImage[] } | null = null;
let forestPending: Promise<PhotoKoreaImage[]> | undefined;
const PHOTO_POOL_TTL_MS = 30 * 60 * 1_000;

export function isForestPhoto(image: Pick<PhotoKoreaImage, 'title' | 'location'>) {
  return FOREST_HINT.test(`${image.title ?? ''} ${image.location ?? ''}`);
}

async function loadForestPhotoPool() {
  if (forestPhotoPool && forestPhotoPool.expiresAt > Date.now()) return forestPhotoPool.images;
  if (forestPending) return forestPending;
  forestPending = fetchForestPhotoPool().finally(() => { forestPending = undefined; });
  return forestPending;
}

async function fetchForestPhotoPool() {
  const keywords = [...FOREST_SEARCH_KEYWORDS].sort(() => Math.random() - 0.5).slice(0, 5);
  const pages = await Promise.allSettled(keywords.map((keyword) => requestGallery('gallerySearchList1', {
    pageNo: '1',
    numOfRows: '10',
    arrange: 'B',
    keyword,
  })));
  const images = pages.flatMap((page) => page.status === 'fulfilled' ? page.value : []);
  const unique = [...new Map(images.map((image) => [image.url, image])).values()];
  const forest = unique.filter(isForestPhoto);
  if (pages.some(page => page.status === 'rejected')) console.warn('[waboranggae] PhotoKorea 숲 사진 일부 조회 실패; 성공한 사진 또는 TourAPI 사진을 사용합니다.');
  forestPhotoPool = { images: forest.length ? forest : unique, expiresAt: Date.now() + (unique.length ? PHOTO_POOL_TTL_MS : 5 * 60_000) };
  return forestPhotoPool.images;
}

export async function pickForestPhotoKorea() {
  try {
    const images = await loadForestPhotoPool();
    if (!images.length) return null;
    return images[Math.floor(Math.random() * images.length)] ?? null;
  } catch (error) {
    console.warn(`[waboranggae] PhotoKorea 숲 사진 실패 (${error instanceof Error ? error.name : 'Error'}).`);
    return null;
  }
}
