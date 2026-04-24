// Gemini 임베딩 — gemini-embedding-001 (한국어/영어 모두 지원)
// API 키: .env.local의 VITE_GEMINI_API_KEY 사용

const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

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
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(`${GEMINI_EMBED_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini embedding error: ${response.status}`);
    }

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
