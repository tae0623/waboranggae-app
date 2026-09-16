import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubEnv('OLLAMA_ENABLED','true'); vi.stubEnv('OLLAMA_TIMEOUT_MS','30'); vi.spyOn(console,'warn').mockImplementation(()=>{}); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('실제 Ollama 호출 코드의 실패 복구 (통신은 가짜 응답)', () => {
  it('응답이 없으면 제한 시간에 중단하고 동시 요청은 바로 fallback한다', async () => {
    const network = vi.fn((_url:unknown, options:RequestInit) => new Promise<Response>((_resolve,reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('This operation was aborted','AbortError')), {once:true});
    }));
    vi.stubGlobal('fetch',network);
    const { analyzeWithOllama } = await import('../server/src/modules/analysis/ollama');
    const first = analyzeWithOllama('고흥 터미널에서 출발');
    expect(await analyzeWithOllama('목포 카페 여행')).toBeNull();
    expect(network).toHaveBeenCalledTimes(1);
    expect(await first).toBeNull();
  });
  it('두 번 실패한 서버로 세 번째 요청을 계속 보내지 않는다', async () => {
    const network = vi.fn().mockResolvedValue(new Response('{}',{status:503})); vi.stubGlobal('fetch',network);
    const { analyzeWithOllama } = await import('../server/src/modules/analysis/ollama');
    expect(await analyzeWithOllama('조건')).toBeNull(); expect(await analyzeWithOllama('조건')).toBeNull();
    expect(await analyzeWithOllama('조건')).toBeNull(); expect(network).toHaveBeenCalledTimes(2);
  });
  it('예전 90초 설정도 출시 코드에서 20초를 초과하지 않는다', async () => {
    vi.stubEnv('OLLAMA_TIMEOUT_MS','90000');
    const { getOllamaRuntimeConfig } = await import('../server/src/modules/analysis/ollama');
    expect(getOllamaRuntimeConfig().timeoutMs).toBe(20000);
  });
});
