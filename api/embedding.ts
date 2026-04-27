// Vercel Function: Gemini 임베딩 프록시
// - 클라이언트는 Gemini API 키 없이 호출
// - 서버 측 GEMINI_API_KEY (VITE_ 접두사 X) 사용 → 키 노출 0
// - 408/429/5xx 지수 백오프 재시도 + jitter
// - 6s 단일 시도 timeout, 전체 12s 한도

import type { IncomingMessage, ServerResponse } from 'node:http';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

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
          const base = 600 * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, base + Math.random() * 400));
          continue;
        }
      }
      throw new Error(`Gemini ${res.status}`);
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt) + Math.random() * 400));
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
  const text: string = (body?.text || '').trim();
  if (!text) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'text required' }));
    return;
  }
  // 최대 입력 길이 보호 (남용 방지)
  if (text.length > 500) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'text too long' }));
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const upstream = await fetchWithBackoff(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text }] },
      }),
      signal: controller.signal,
    });
    const data = await upstream.json();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ embedding: data?.embedding?.values || null }));
  } catch (e: any) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'upstream error', detail: e?.message || String(e) }));
  } finally {
    clearTimeout(timeoutId);
  }
}
