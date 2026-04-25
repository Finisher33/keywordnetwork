// Gemini 임베딩 — gemini-embedding-001 (한국어/영어 모두 지원)
// API 키: .env.local의 VITE_GEMINI_API_KEY 사용

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

// 동시 다발 호출 시 429/5xx 에 대비한 지수 백오프 재시도.
// 다중 사용자(50명 동시 등록) 폭주 상황에서 일부 요청이 일시 거절돼도 살아남도록.
async function fetchWithBackoff(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      // 재시도 가능한 상태코드만 retry: 408 timeout, 429 rate limit, 5xx 서버 오류
      if (res.status === 408 || res.status === 429 || res.status >= 500) {
        if (attempt < maxAttempts - 1) {
          // jitter 추가로 동시 사용자가 동기화돼 다시 충돌하는 것 방지
          const base = 600 * Math.pow(2, attempt);
          const jitter = Math.random() * 400;
          await new Promise(r => setTimeout(r, base + jitter));
          continue;
        }
      }
      throw new Error(`Gemini embedding ${res.status}`);
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts - 1) throw e;
      const base = 600 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, base + Math.random() * 400));
    }
  }
  throw lastErr;
}

export const getEmbedding = async (text: string): Promise<number[] | null> => {
  if (!text.trim()) return null;

  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    console.warn("VITE_GEMINI_API_KEY not set — embedding unavailable");
    return null;
  }

  // 인앱브라우저/느린 네트워크에서 fetch가 무한 대기하는 것을 방지.
  // 임베딩은 저장 플로우의 차단 요소가 아니어야 하므로 실패해도 null 반환.
  const controller = new AbortController();
  // 재시도까지 고려해 전체 timeout 을 12s 로 확대 (단일 시도 시 6s × 재시도)
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetchWithBackoff(`${GEMINI_EMBED_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
      }),
      signal: controller.signal,
    });

    const data = await response.json();
    return data?.embedding?.values || null;
  } catch (error) {
    console.error("Error getting embedding:", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
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
