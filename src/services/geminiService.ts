// Gemini 1.5 Flash 인사이트 요약
// 1순위: /api/summarize 프록시 (키 보호)
// 2순위(폴백): GoogleGenerativeAI SDK 직접 호출 (개발용)
// timeout / abort signal / 자동 재시도 (프록시가 처리) 포함

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function summarizeInsights(
  keyword: string,
  insights: string[],
  options?: { signal?: AbortSignal }
): Promise<string> {
  if (!insights || insights.length === 0)
    return `${keyword} 관련 핵심 인사이트가 집계 중입니다.`;

  // 1) 서버 프록시 시도
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 22000);
    const onExt = () => ctrl.abort();
    options?.signal?.addEventListener('abort', onExt, { once: true });

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, insights }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.summary) return data.summary;
      } else if (res.status !== 404 && res.status !== 405 && res.status !== 500) {
        return `${keyword} 키워드에 대한 인사이트를 요약하는 중 오류가 발생했습니다.`;
      }
    } finally {
      clearTimeout(tid);
      options?.signal?.removeEventListener('abort', onExt);
    }
  } catch {
    // fallback 으로
  }

  // 2) Fallback: 클라이언트 직접 (개발용)
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!key) return `${keyword} 관련 핵심 인사이트가 집계 중입니다.`;

  const prompt = `
    다음은 '${keyword}'라는 키워드에 대해 학습자들이 작성한 인사이트들입니다.
    이 내용들을 종합하여 핵심 내용을 1~3줄 사이로 요약해 주세요.
    요약할 때는 공통적으로 나오는 의견이나 의견의 경향성을 파악하여 정리해 주세요.
    존댓말로 작성해 주시고, "~인 것으로 파악됩니다"와 같은 고정된 문구는 지양하고 자연스럽게 요약해 주세요.

    학습자 인사이트:
    ${insights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')}
  `;

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    // SDK 자체에는 timeout 옵션이 없어 Promise.race 로 보호.
    const callP = model.generateContent(prompt).then((r) => r.response.text().trim());
    const timeoutP = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 18000));
    return await Promise.race([callP, timeoutP]);
  } catch (error) {
    console.error('Gemini summarization error:', error);
    return `${keyword} 키워드에 대한 인사이트를 요약하는 중 오류가 발생했습니다.`;
  }
}
