// Voyage AI — Anthropic 공식 파트너 임베딩 서비스
// https://www.voyageai.com
// API 키: https://dash.voyageai.com

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

export const getEmbedding = async (text: string): Promise<number[] | null> => {
  if (!text.trim()) return null;

  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_VOYAGE_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: "voyage-3",
        input: [text],
      }),
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].embedding;
    }
    return null;
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
