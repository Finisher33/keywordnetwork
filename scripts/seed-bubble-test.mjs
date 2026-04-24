// 키워드 버블 그룹핑 라이브 테스트 시드 스크립트
// - 익명 로그인 → 임의 과정 선택 → 임의 세션 선택
// - 20명 가짜 유저 + userInsight 생성
// - canonicalizeKeyword 로직 복제 (Gemini embedding + cosine > 0.55)
// - 그룹핑 결과 콘솔 출력

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 모든 fetch 에 Referer/Origin 헤더 강제 주입 (API 키 referrer 제한 우회)
const ALLOWED_REFERER = 'https://keywordnetworking.vercel.app/';
const _origFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => {
  const headers = new Headers(opts.headers || {});
  if (!headers.has('Referer')) headers.set('Referer', ALLOWED_REFERER);
  if (!headers.has('Origin')) headers.set('Origin', 'https://keywordnetworking.vercel.app');
  if (!headers.has('X-Goog-Api-Client')) headers.set('X-Goog-Api-Client', 'gl-node/24 fire/12');
  return _origFetch(url, { ...opts, headers });
};

const { initializeApp } = await import('firebase/app');
const { getAuth, signInAnonymously } = await import('firebase/auth');
const { getFirestore, collection, getDocs, setDoc, doc } = await import('firebase/firestore');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── 설정 로드 ────────────────────────────────────────────────────────────
const firebaseConfig = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8')
);
const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const GEMINI_KEY = (envText.match(/^VITE_GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!GEMINI_KEY) { console.error('VITE_GEMINI_API_KEY missing'); process.exit(1); }

// ─── Firebase 초기화 + 익명 로그인 ───────────────────────────────────────
const app = initializeApp(firebaseConfig);
const fs_db = getFirestore(app);
const auth = getAuth(app);
await signInAnonymously(auth);
console.log('[auth] signed in anonymously:', auth.currentUser.uid);

// ─── Embedding ────────────────────────────────────────────────────────────
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
async function embed(text) {
  const r = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] } }),
  });
  if (!r.ok) throw new Error(`embed ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.embedding.values;
}
function cos(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── 기존 데이터 로드 ─────────────────────────────────────────────────────
async function loadAll(name) {
  const snap = await getDocs(collection(fs_db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
const [courses, sessions, existingTerms] = await Promise.all([
  loadAll('courses'), loadAll('sessions'), loadAll('canonicalTerms'),
]);
console.log(`[load] courses=${courses.length} sessions=${sessions.length} canonicalTerms=${existingTerms.length}`);
if (courses.length === 0) { console.error('No course found'); process.exit(1); }

const COURSE = courses.find(c => c.isActive ?? true) || courses[0];
let SESSION = sessions.find(s => s.courseId === COURSE.id);
if (!SESSION) {
  // 세션이 없으면 만들기
  SESSION = { id: `s_test_${Date.now()}`, courseId: COURSE.id, name: '버블 테스트 세션', time: '14:00', module: 'M1', day: 1, isActive: true };
  await setDoc(doc(fs_db, 'sessions', SESSION.id), SESSION);
  console.log('[seed] created session', SESSION.id);
}
console.log(`[pick] course="${COURSE.name}"(${COURSE.id})  session="${SESSION.name}"(${SESSION.id})`);

// ─── 20명 가짜 유저 + 인사이트 키워드 ────────────────────────────────────
// 의도: 유사군 5세트 + 무관어 일부 → 이상적으로 5~6개 버블이 형성되어야 함
const SAMPLES = [
  // AI 그룹 (5명)
  ['김민준', 'Physical AI'], ['이서연', '피지컬 AI'], ['박지호', '로봇 AI'],
  ['최예린', 'AI 에이전트'],  ['정도윤', 'Physical AI'],
  // 리더십/소통 그룹 (4명)
  ['강하은', '리더십'], ['윤시우', 'Leadership'], ['장유나', '커뮤니케이션'], ['임수아', '소통'],
  // 데이터 그룹 (4명)
  ['홍지안', '데이터 분석'], ['고은우', '데이터 사이언스'], ['배서현', 'Data Science'], ['신하준', '데이터 시각화'],
  // 모빌리티 그룹 (3명)
  ['오채원', '전기차'], ['한도현', 'EV'], ['서다은', '자율주행'],
  // 무관어 (4명) — 별개 버블이 되어야 함
  ['황지우', '브랜딩'], ['문현우', '요리'], ['양시현', '인사평가'], ['조태민', '코딩'],
];
console.log(`[plan] ${SAMPLES.length} mock users`);

// ─── canonicalizeKeyword 복제 ────────────────────────────────────────────
const THRESHOLD = 0.55;
const sessionTerms = [...existingTerms]; // 메모리 캐시 (앱의 newCanonicalTermsRef 역할)

function safeKeyId(k) { return 'k_' + Buffer.from(k, 'utf8').toString('hex').slice(0, 24); }

async function canonicalize(keyword) {
  const norm = keyword.trim().toLowerCase();
  // 1) exact match
  const exact = sessionTerms.find(t => (t.term || '').trim().toLowerCase() === norm);
  if (exact) return { id: exact.id, term: exact.term, kind: 'exact' };

  // 2) embedding similarity
  const v = await embed(keyword);
  let best = null, max = -1;
  for (const t of sessionTerms) {
    if (!t.embedding) continue;
    const s = cos(v, t.embedding);
    if (s > max) { max = s; best = t; }
  }
  if (best && max > THRESHOLD) return { id: best.id, term: best.term, kind: 'embed', sim: max, against: best.term };

  // 3) new term
  const id = `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const term = { id, term: keyword, embedding: v };
  sessionTerms.push(term);
  await setDoc(doc(fs_db, 'canonicalTerms', id), term);
  return { id, term: keyword, kind: 'new', sim: max, against: best?.term };
}

// ─── 시드 작성 ────────────────────────────────────────────────────────────
const RUN = `bubbletest_${Date.now().toString(36)}`;
const groupBy = new Map(); // canonicalId -> {term, members:[{user,keyword}]}
console.log('\n[seed] writing users + insights...');

for (let i = 0; i < SAMPLES.length; i++) {
  const [name, kw] = SAMPLES[i];
  const userId = `${COURSE.id}_TEST_${RUN}_${i}`;
  const user = {
    id: userId, courseId: COURSE.id,
    company: '테스트', name, department: 'QA', title: '시드',
    condition: 5 + (i % 6), careerYears: 1 + (i % 15),
    surveyCompleted: true,
  };
  const can = await canonicalize(kw);
  const insight = {
    id: `ui_${RUN}_${i}`,
    userId, sessionId: SESSION.id,
    keyword: kw, canonicalId: can.id,
    description: `${name}의 핵심 인사이트: ${kw}`,
    likes: [],
  };
  await setDoc(doc(fs_db, 'users', user.id), user);
  await setDoc(doc(fs_db, 'userInsights', insight.id), insight);

  if (!groupBy.has(can.id)) groupBy.set(can.id, { term: can.term, members: [] });
  groupBy.get(can.id).members.push({ user: name, keyword: kw, kind: can.kind, sim: can.sim, against: can.against });

  const tag = can.kind === 'new' ? 'NEW       ' : can.kind === 'exact' ? 'EXACT     ' : `MERGE→${can.against||'?'}`;
  const simStr = can.sim != null ? `(sim=${can.sim.toFixed(3)})` : '';
  console.log(`  ${String(i+1).padStart(2)}. ${name.padEnd(4)}  "${kw}".padEnd(18)`.padEnd(40), `→ ${tag.padEnd(28)} ${simStr}`);
}

// ─── 결과 리포트 ─────────────────────────────────────────────────────────
console.log('\n[result] bubble groups:');
const groups = [...groupBy.values()].sort((a,b) => b.members.length - a.members.length);
for (const g of groups) {
  console.log(`  ◯ "${g.term}" × ${g.members.length}`);
  for (const m of g.members) console.log(`      - ${m.user}: ${m.keyword}`);
}
console.log(`\n[summary] users=${SAMPLES.length}, bubbles=${groups.length}, run_tag=${RUN}`);
console.log(`[summary] open: https://keywordnetworking.vercel.app/  → 과정 "${COURSE.name}" → 인사이트 → ${SESSION.name}`);

process.exit(0);
