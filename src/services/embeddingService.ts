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

  try {
    const response = await fetch(`${GEMINI_EMBED_URL}?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini embedding error: ${response.status}`);
    }

    const data = await response.json();
    return data?.embedding?.values || null;
  } catch (error) {
    console.error("Error getting embedding:", error);
    return null;
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
