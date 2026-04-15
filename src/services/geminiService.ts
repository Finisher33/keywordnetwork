import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function summarizeInsights(keyword: string, insights: string[]): Promise<string> {
  if (!insights || insights.length === 0) return `${keyword} 관련 핵심 인사이트가 집계 중입니다.`;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    다음은 '${keyword}'라는 키워드에 대해 학습자들이 작성한 인사이트들입니다.
    이 내용들을 종합하여 핵심 내용을 1~3줄 사이로 요약해 주세요.
    요약할 때는 공통적으로 나오는 의견이나 의견의 경향성을 파악하여 정리해 주세요.
    존댓말로 작성해 주시고, "~인 것으로 파악됩니다"와 같은 고정된 문구는 지양하고 자연스럽게 요약해 주세요.

    학습자 인사이트:
    ${insights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error("Gemini summarization error:", error);
    return `${keyword} 키워드에 대한 인사이트를 요약하는 중 오류가 발생했습니다.`;
  }
}
