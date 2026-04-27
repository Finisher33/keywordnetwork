// Gemini 임베딩 — gemini-embedding-001 (한국어/영어 모두 지원)
// 1순위: 동일 출처 /api/embedding 프록시 (Vercel Function) — 키 노출 0
// 2순위(폴백): VITE_GEMINI_API_KEY 직접 호출 (개발 / 프록시 미배포 환경)
//
// 프록시는 자체적으로 408/429/5xx 재시도를 수행하므로 클라이언트는 단순 호출.

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

export const getEmbedding = async (text: string, options?: { signal?: AbortSignal }): Promise<number[] | null> => {
  if (!text.trim()) return null;

  // 1) 서버 프록시 시도
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 14000);
    // 외부 signal 이 abort 되면 내부 ctrl 도 abort
    const onExternalAbort = () => ctrl.abort();
    options?.signal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const res = await fetch('/api/embedding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const data = await res.json();
        return data?.embedding || null;
      }
      // 프록시가 아예 없거나 (404) 비활성 시 fallback 으로
      if (res.status === 404 || res.status === 405) {
        // pass through to fallback
      } else if (res.status === 500) {
        // 서버에 키가 없는 경우 (GEMINI_API_KEY missing) 도 fallback
      } else {
        // 그 외 오류는 그대로 실패 처리 (재시도는 프록시가 이미 시도)
        return null;
      }
    } finally {
      clearTimeout(tid);
      options?.signal?.removeEventListener('abort', onExternalAbort);
    }
  } catch (e) {
    // 네트워크/abort — fallback 으로
  }

  // 2) Fallback: 클라이언트에서 직접 (개발용)
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!key) return null;

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 8000);
  const onExternalAbort = () => ctrl.abort();
  options?.signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const r = await fetch(`${GEMINI_EMBED_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.embedding?.values || null;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
    options?.signal?.removeEventListener('abort', onExternalAbort);
  }
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
};
