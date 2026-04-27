// E2E 그룹핑 검증 — 프록시(/api/embedding) + canonicalizeKeyword 동일 로직 + Firestore 기록
//
// 1) 운영 프록시로 임베딩 받아 client store.tsx 의 canonicalizeKeyword 와 동일 알고리즘 실행
// 2) 의도적으로 동의어 / 변형 / 무관어 섞인 20개 학습 인사이트를 mock 유저 이름으로 시드
// 3) Firestore 에 실제 기록 (admin / user 양쪽 화면 데이터로 동일하게 작용)
// 4) 시드 결과를 그룹별로 출력하고, Admin/User 화면에서 어떻게 보일지 검증
// 5) 시드 데이터 자동 정리 (TEST_grouping_ 접두사)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'https://keywordnetworking.vercel.app';
const ALLOWED = `${BASE}/`;
const _f = globalThis.fetch;
globalThis.fetch = (u, o = {}) => {
  const h = new Headers(o.headers || {});
  if (!h.has('Referer')) h.set('Referer', ALLOWED);
  if (!h.has('Origin')) h.set('Origin', BASE);
  return _f(u, { ...o, headers: h });
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));

const { initializeApp } = await import('firebase/app');
const { getAuth, signInAnonymously } = await import('firebase/auth');
const { getFirestore, collection, getDocs, setDoc, doc, writeBatch, deleteDoc } =
  await import('firebase/firestore');

const app = initializeApp(cfg);
const fs_db = getFirestore(app);
await signInAnonymously(getAuth(app));
console.log('✓ 익명 인증 완료');

// ─── 프록시 임베딩 (운영 키 노출 X) ──────────────────────────────────────
async function embed(text) {
  const r = await fetch(`${BASE}/api/embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.embedding;
}
function cos(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── store.tsx canonicalizeKeyword 와 동일 ────────────────────────────────
const ZW_RE = /[​‌‍﻿ ]/g;
const norm = (s) => (s || '').replace(ZW_RE, '').replace(/\s+/g, '').toLowerCase();
function hashId(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let h2 = (h ^ 0xcafebabe) >>> 0;
  for (let i = 0; i < input.length; i++) {
    h2 ^= input.charCodeAt(i) << (i % 24);
    h2 = Math.imul(h2, 1540483477) >>> 0;
  }
  return h.toString(36) + h2.toString(36);
}
const THRESHOLD = 0.78;

async function loadAll(name) {
  const snap = await getDocs(collection(fs_db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
const [courses, sessions, terms] = await Promise.all([
  loadAll('courses'), loadAll('sessions'), loadAll('canonicalTerms'),
]);
const COURSE = courses.find(c => c.isActive ?? true) || courses[0];
let SESSION = sessions.find(s => s.courseId === COURSE.id);
if (!SESSION) {
  SESSION = { id: `s_test_${Date.now()}`, courseId: COURSE.id, name: '[TEST] 그룹핑 세션', time: '10:00', module: 'M1', day: 1, isActive: true };
  await setDoc(doc(fs_db, 'sessions', SESSION.id), SESSION);
}
console.log(`✓ 사용 과정 "${COURSE.name}" / 세션 "${SESSION.name}"`);

// 같은 kind 끼리만 매칭하고, exact-text → embedding 0.78 → 새 ID 결정적 hash
const sessionTerms = terms.filter(t => t.kind === 'insight');
const newCanonicalsLocal = [];
async function canonicalize(keyword) {
  const k = norm(keyword);
  const all = [...sessionTerms, ...newCanonicalsLocal];
  // 1) exact (텍스트 기준)
  const exact = all.find(t => norm(t.term || '') === k);
  if (exact) return { canonicalId: exact.id, term: exact.term, kind: 'exact' };
  // 2) embedding similarity
  const v = await embed(keyword);
  let best = null, max = -1;
  for (const t of all) {
    if (!t.embedding) continue;
    const s = cos(v, t.embedding);
    if (s > max) { max = s; best = t; }
  }
  if (best && max > THRESHOLD) {
    return { canonicalId: best.id, term: best.term, kind: 'embed', sim: max, against: best.term };
  }
  // 3) new — 결정적 ID
  const id = `ct_insight_${hashId(k + '|insight')}`;
  const newTerm = { id, term: keyword, embedding: v, kind: 'insight' };
  newCanonicalsLocal.push(newTerm);
  return { canonicalId: id, term: keyword, kind: 'new', sim: max, against: best?.term };
}

// ─── 시드 데이터 ────────────────────────────────────────────────────────
// 의도: 동의어 그룹 4개 + 무관어 4개 → 기대 그룹 8개
const SAMPLES = [
  // AI / Physical AI 그룹 (5명)
  ['김민준', 'Physical AI'],
  ['이서연', '피지컬 AI'],
  ['박지호', '인공지능 로봇'],
  ['최예린', 'Physical AI'],
  ['정도윤', '피지컬AI'],
  // 리더십 그룹 (4명)
  ['강하은', '리더십'],
  ['윤시우', 'Leadership'],
  ['장유나', '리더쉽'],
  ['임수아', '리더십이'],
  // 데이터 분석 그룹 (4명)
  ['홍지안', '데이터 분석'],
  ['고은우', '데이터 사이언스'],
  ['배서현', 'Data Science'],
  ['신하준', '데이터분석'],
  // 모빌리티 그룹 (3명)
  ['오채원', '전기차'],
  ['한도현', 'EV'],
  ['서다은', '자율주행'],
  // 무관어 (4명)
  ['황지우', '브랜딩'],
  ['문현우', '요리'],
  ['양시현', '낚시'],
  ['조태민', '코딩'],
];
const RUN = `grouping_${Date.now().toString(36)}`;
console.log(`\n[시드 시작] ${SAMPLES.length}명 인사이트 — RUN=${RUN}`);

const groupBy = new Map(); // canonicalId → { term, members:[{user,kw,kind,sim}] }
let i = 0;
for (const [name, kw] of SAMPLES) {
  const userId = `${COURSE.id}_TEST_${RUN}_${i}`;
  const insightId = `ui_${userId}__${SESSION.id}`;
  const can = await canonicalize(kw);

  const batch = writeBatch(fs_db);
  // canonicalTerm doc (idempotent setDoc)
  if (can.kind !== 'exact') {
    batch.set(doc(fs_db, 'canonicalTerms', can.canonicalId), {
      id: can.canonicalId,
      term: can.term,
      embedding: can.kind === 'new' ? newCanonicalsLocal.find(t => t.id === can.canonicalId)?.embedding || null : null,
      kind: 'insight',
    }, { merge: true });
  }
  // user doc
  batch.set(doc(fs_db, 'users', userId), {
    id: userId, courseId: COURSE.id, company: 'TEST',
    name, department: 'QA', title: 'mock',
    surveyCompleted: true,
  });
  // insight doc
  batch.set(doc(fs_db, 'userInsights', insightId), {
    id: insightId, userId, sessionId: SESSION.id,
    keyword: kw, canonicalId: can.canonicalId,
    description: `${name}의 핵심 인사이트: ${kw}`,
    likes: [],
  });
  await batch.commit();

  if (!groupBy.has(can.canonicalId)) groupBy.set(can.canonicalId, { term: can.term, members: [] });
  groupBy.get(can.canonicalId).members.push({ user: name, kw, kind: can.kind, sim: can.sim, against: can.against });

  const tag = can.kind === 'new' ? 'NEW       ' : can.kind === 'exact' ? 'EXACT     ' : `MERGE→${can.against || '?'}`;
  const simStr = can.sim != null ? `(sim=${can.sim.toFixed(3)})` : '';
  console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(4)}  "${kw}".padEnd(20) → ${tag.padEnd(30)} ${simStr}`);
  i++;
}

console.log(`\n[그룹핑 결과] ${groupBy.size}개 버블`);
const groups = [...groupBy.values()].sort((a, b) => b.members.length - a.members.length);
for (const g of groups) {
  console.log(`  ◯ "${g.term}" × ${g.members.length}`);
  for (const m of g.members) console.log(`      - ${m.user}: ${m.kw}`);
}

// ─── 검증 결과 ───────────────────────────────────────────────────────────
const BUBBLE_COUNT = groups.length;
const expectedGroups = 8;     // AI(5) + 리더십(4) + 데이터(4) + 전기차/EV(?) + 자율주행 + 브랜딩 + 요리 + 낚시 + 코딩 = ~9
console.log(`\n[검증]`);
console.log(`  실측 버블 수    : ${BUBBLE_COUNT}`);
console.log(`  AI 그룹 합쳐짐  : ${groups.find(g => g.members.some(m => m.kw.toLowerCase().includes('physical')))?.members.length || 0} 명`);
console.log(`  리더십 합쳐짐  : ${groups.find(g => g.members.some(m => m.kw.toLowerCase().includes('leader') || m.kw.includes('리더')))?.members.length || 0} 명`);
console.log(`  데이터 합쳐짐  : ${groups.find(g => g.members.some(m => m.kw.toLowerCase().includes('data') || m.kw.includes('데이터')))?.members.length || 0} 명`);

// 화면 검증 시 사용할 정보
console.log(`\n[화면 확인 안내]`);
console.log(`  · 유저 화면: 과정 "${COURSE.name}" → 세션 "${SESSION.name}" → KEYWORD BUBBLE 탭`);
console.log(`  · 어드민 화면: Admin > 분석 > "${COURSE.name}" 선택 → 학습 인사이트`);
console.log(`  · 정리: node scripts/cleanup-test-grouping.mjs (또는 RUN=${RUN} 으로 별도 정리)`);

// ─── 자동 정리 ───────────────────────────────────────────────────────────
console.log(`\n[자동 정리] 시드 데이터 삭제 중...`);
const rmInsights = (await getDocs(collection(fs_db, 'userInsights'))).docs.filter(d => d.id.includes(`TEST_${RUN}_`) || d.id.includes(`__${SESSION.id}`) && d.id.includes(`TEST_${RUN}`));
const rmUsers = (await getDocs(collection(fs_db, 'users'))).docs.filter(d => d.id.includes(`TEST_${RUN}_`));
let removed = 0;
for (let j = 0; j < rmInsights.length; j += 450) {
  const batch = writeBatch(fs_db);
  rmInsights.slice(j, j + 450).forEach(d => { batch.delete(d.ref); removed++; });
  await batch.commit();
}
for (let j = 0; j < rmUsers.length; j += 450) {
  const batch = writeBatch(fs_db);
  rmUsers.slice(j, j + 450).forEach(d => { batch.delete(d.ref); removed++; });
  await batch.commit();
}
console.log(`  ✓ ${removed}건 삭제 완료 (canonicalTerms 는 다른 사용자 인사이트가 참조 중일 수 있어 보존)`);

console.log(`\n✓ 종합 검증 완료`);
process.exit(0);
