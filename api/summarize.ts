// Vercel Function: Gemini 1.5 Flash 요약 프록시
// - 클라이언트는 키 없이 호출
// - 서버 측 GEMINI_API_KEY 사용
// - timeout / 재시도 / 입력 길이 보호 포함

import type { IncomingMessage, ServerResponse } from 'node:http';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function fetchWithBackoff(url: string, init: any, maxAttempts = 3): Promise<Response> {
  let lastErr: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status === 408 || res.status === 429 || res.status >= 500) {
        if (attempt < maxAttempts - 1) {
          const base = 800 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, base + Math.random() * 500));
          continue;
        }
      }
      throw new Error(`Gemini ${res.status}`);
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt) + Math.random() * 500));
    }
  }
  throw lastErr;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }));
    return;
  }

  let body: any;
  try { body = await readJson(req); } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'invalid JSON body' }));
    return;
  }
  const keyword: string = (body?.keyword || '').trim();
  const insights: string[] = Array.isArray(body?.insights) ? body.insights : [];
  if (!keyword || insights.length === 0) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'keyword/insights required' }));
    return;
  }
  if (keyword.length > 100 || insights.length > 50) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'input too large' }));
    return;
  }
  const trimmedInsights = insights.map((s) => String(s).slice(0, 500)).slice(0, 50);

  const prompt = `
다음은 '${keyword}'라는 키워드에 대해 학습자들이 작성한 인사이트들입니다.
이 내용들을 종합하여 핵심 내용을 1~3줄 사이로 요약해 주세요.
요약할 때는 공통적으로 나오는 의견이나 의견의 경향성을 파악하여 정리해 주세요.
존댓말로 작성해 주시고, "~인 것으로 파악됩니다"와 같은 고정된 문구는 지양하고 자연스럽게 요약해 주세요.

학습자 인사이트:
${trimmedInsights.map((insight, index) => `${index + 1}. ${insight}`).join('\n')}
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const upstream = await fetchWithBackoff(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });
    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ summary: text.trim() }));
  } catch (e: any) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'upstream error', detail: e?.message || String(e) }));
  } finally {
    clearTimeout(timeoutId);
  }
}
