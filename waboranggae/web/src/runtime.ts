export interface WebRuntime {
  persistSession?: (tokens: { access: string; refresh: string } | null) => Promise<void>;
  apiBaseUrl: string;
  mapBaseUrl: string;
  devAccessKey?: string;
  openExternal?: (url: string) => Promise<void>;
  nativeRequest?: (path: string, options: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number }) => Promise<{ status: number; body: string }>;
}
let runtime: WebRuntime = { apiBaseUrl: '', mapBaseUrl: '' };
export function configureWebRuntime(next: WebRuntime) {
  runtime = { ...next, apiBaseUrl: next.apiBaseUrl.replace(/\/$/, ''), mapBaseUrl: next.mapBaseUrl.replace(/\/$/, '') };
}
export function getWebRuntime() { return runtime; }
export function apiUrl(path: string) { return runtime.apiBaseUrl + path; }
export async function apiFetch(path: string, options: RequestInit, timeoutMs: number) {
  if (runtime.nativeRequest) {
    const result = await runtime.nativeRequest(path, { method: options.method || 'GET', headers: options.headers as Record<string, string>, body: typeof options.body === 'string' ? options.body : undefined, timeoutMs });
    return new Response(result.body, { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }
  return fetch(apiUrl(path), options);
}
export function mediaUrl(value: string | null | undefined) {
  if (!value) return value;
  if (value.startsWith('/api/')) return apiUrl(value);
  try {
    const url = new URL(value);
    if (url.hostname === 'tong.visitkorea.or.kr') return apiUrl('/api/media/tour-image?url=' + encodeURIComponent(value));
  } catch { /* Non-URL images use the normal image error fallback. */ }
  return value;
}
export async function openExternal(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) throw new Error('안전한 HTTPS 링크만 열 수 있습니다.');
  if (runtime.openExternal) await runtime.openExternal(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}
