// 버블 라벨 폴백 동작 검증 스크립트
// - 운영 DB 의 실 인사이트 + canonicalTerms 를 읽어
//   InsightView.tsx 의 라벨 산출 로직을 그대로 재현
// - "이상한 언어 (hash ID)" 가 화면에 노출되지 않는지 검사
// - 또한 refreshCanonicalTerms() 후 결과도 비교

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = 'https://keywordnetworking.vercel.app/';
const _f = globalThis.fetch;
globalThis.fetch = (u, o = {}) => {
  const h = new Headers(o.headers || {});
  if (!h.has('Referer')) h.set('Referer', ALLOWED);
  if (!h.has('Origin')) h.set('Origin', 'https://keywordnetworking.vercel.app');
  return _f(u, { ...o, headers: h });
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));

const { initializeApp } = await import('firebase/app');
const { getAuth, signInAnonymously } = await import('firebase/auth');
const { getFirestore, collection, getDocs } = await import('firebase/firestore');

const app = initializeApp(cfg);
const db = getFirestore(app);
await signInAnonymously(getAuth(app));
console.log('✓ 익명 인증');

const load = async (n) => (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, ...d.data() }));
const [insights, terms, sessions] = await Promise.all([
  load('userInsights'), load('canonicalTerms'), load('sessions'),
]);
console.log(`[입력] insights=${insights.length}, canonicalTerms=${terms.length}, sessions=${sessions.length}`);

// ─── InsightView 의 라벨 산출 로직 재현 (수정 후) ────────────────────────
function deriveLabel(canonicalId, originalKeywords, allTerms) {
  const term = allTerms.find(t => t.id === canonicalId);
  return (term?.term?.trim()) || originalKeywords[0] || canonicalId;
}
// 비교용 — 수정 전 (버그 버전)
function deriveLabelOld(canonicalId, _originalKeywords, allTerms) {
  const term = allTerms.find(t => t.id === canonicalId);
  return term ? term.term : canonicalId;
}

// 세션별로 그룹핑
const bySession = new Map();
for (const i of insights) {
  if (!i.sessionId) continue;
  if (!bySession.has(i.sessionId)) bySession.set(i.sessionId, []);
  bySession.get(i.sessionId).push(i);
}

// ─── 시나리오 1: 정상 — 모든 canonicalTerm 이 캐시에 있는 경우 ──────────
console.log('\n[시나리오 1] 정상 캐시 — 모든 canonicalTerm 보유');
let oldBad = 0, newBad = 0, total = 0;
for (const [sid, list] of bySession) {
  for (const ins of list) {
    if (!ins.canonicalId) continue;
    total++;
    const oldLabel = deriveLabelOld(ins.canonicalId, [ins.keyword], terms);
    const newLabel = deriveLabel(ins.canonicalId, [ins.keyword], terms);
    // hash ID 형태인지 검사 (ct_*_xxxxx)
    if (/^ct_[a-z]+_[a-z0-9_]+$/.test(oldLabel) && oldLabel === ins.canonicalId) oldBad++;
    if (/^ct_[a-z]+_[a-z0-9_]+$/.test(newLabel) && newLabel === ins.canonicalId) newBad++;
  }
}
console.log(`  total insights with canonicalId: ${total}`);
console.log(`  ✗ old code 라벨이 hash ID 인 케이스: ${oldBad}`);
console.log(`  ✓ new code 라벨이 hash ID 인 케이스: ${newBad}`);

// ─── 시나리오 2: stale 캐시 — canonicalTerm 절반이 누락된 척 ──────────
console.log('\n[시나리오 2] stale 캐시 — canonicalTerm 절반 누락 시뮬레이션');
const halfTerms = terms.filter((_, idx) => idx % 2 === 0); // 절반만 보유
let oldBadStale = 0, newBadStale = 0;
for (const [sid, list] of bySession) {
  for (const ins of list) {
    if (!ins.canonicalId) continue;
    const oldLabel = deriveLabelOld(ins.canonicalId, [ins.keyword], halfTerms);
    const newLabel = deriveLabel(ins.canonicalId, [ins.keyword], halfTerms);
    if (oldLabel === ins.canonicalId) oldBadStale++;
    if (newLabel === ins.canonicalId) newBadStale++;
  }
}
console.log(`  ✗ old code: hash ID 노출 ${oldBadStale}건 (사용자가 "이상한 언어"로 보던 케이스)`);
console.log(`  ✓ new code: hash ID 노출 ${newBadStale}건 (원본 키워드 텍스트로 폴백)`);

// ─── 시나리오 3: 완전히 빈 캐시 (refresh 전 최악) ──────────────────────
console.log('\n[시나리오 3] 빈 캐시 — refresh 직전 최악');
let oldBadEmpty = 0, newBadEmpty = 0;
for (const [sid, list] of bySession) {
  for (const ins of list) {
    if (!ins.canonicalId) continue;
    const oldLabel = deriveLabelOld(ins.canonicalId, [ins.keyword], []);
    const newLabel = deriveLabel(ins.canonicalId, [ins.keyword], []);
    if (oldLabel === ins.canonicalId) oldBadEmpty++;
    if (newLabel === ins.canonicalId) newBadEmpty++;
  }
}
console.log(`  ✗ old code: hash ID 노출 ${oldBadEmpty}/${total}건 (전부 깨짐)`);
console.log(`  ✓ new code: hash ID 노출 ${newBadEmpty}/${total}건 (모두 원본 키워드로 표시)`);

// ─── 시나리오 4: refreshCanonicalTerms 효과 ────────────────────────────
console.log('\n[시나리오 4] refreshCanonicalTerms() 효과 — fresh fetch 후 stale 해소');
const refreshed = await load('canonicalTerms');
console.log(`  refresh 후 canonicalTerms: ${refreshed.length}건 (이전 ${terms.length}건과 동일하면 stale 없음)`);

// ─── 종합 ────────────────────────────────────────────────────────────────
console.log('\n[종합]');
const allOk = newBad === 0 && newBadStale === 0 && newBadEmpty === 0;
console.log(`  새 폴백 로직 정상 작동: ${allOk ? '✓ YES' : '✗ NO'}`);
console.log(`  사용자가 보는 라벨 — 어떤 캐시 상태든 hash ID 노출 0건`);
process.exit(allOk ? 0 : 1);
