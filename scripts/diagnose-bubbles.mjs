// 현재 DB 상태 진단 — 버블차트 잘못된 그룹핑 원인 파악
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

const load = async (n) => (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, ...d.data() }));
const [courses, sessions, users, insights, terms, interests] = await Promise.all([
  load('courses'), load('sessions'), load('users'), load('userInsights'), load('canonicalTerms'), load('interests'),
]);

console.log(`[전체] courses=${courses.length} sessions=${sessions.length} users=${users.length} insights=${insights.length} interests=${interests.length} canonicalTerms=${terms.length}\n`);

// 1) canonicalId 별로 어떤 키워드들이 묶여있는지 (insights + interests 통합)
const groups = new Map(); // canonicalId -> { term, members: [{kw, where, courseId}] }
for (const t of terms) groups.set(t.id, { term: t.term, hasEmb: !!t.embedding, embLen: (t.embedding?.length||0), members: [] });

const sessionToCourse = new Map(sessions.map(s => [s.id, s.courseId]));
const userToCourse   = new Map(users.map(u => [u.id, u.courseId]));

for (const i of insights) {
  if (!i.canonicalId) continue;
  const g = groups.get(i.canonicalId) || { term: '?', members: [] };
  g.members.push({ kw: i.keyword, where: 'insight', courseId: sessionToCourse.get(i.sessionId) || '?', sessionId: i.sessionId });
  groups.set(i.canonicalId, g);
}
for (const i of interests) {
  if (!i.canonicalId) continue;
  const g = groups.get(i.canonicalId) || { term: '?', members: [] };
  g.members.push({ kw: i.keyword, where: 'interest', courseId: userToCourse.get(i.userId) || '?' });
  groups.set(i.canonicalId, g);
}

// 그룹별 출력 (멤버 1개 이상)
const out = [...groups.entries()]
  .filter(([,g]) => g.members.length > 0)
  .sort((a, b) => b[1].members.length - a[1].members.length);

console.log(`[canonicalId 별 실제 사용 그룹] ${out.length}건`);
for (const [id, g] of out) {
  // 그룹 내 고유 키워드 (대소문자/공백 정규화)
  const norm = (s) => (s||'').replace(/\s+/g,'').toLowerCase();
  const uniqKw = [...new Set(g.members.map(m => m.kw))];
  const courseSet = [...new Set(g.members.map(m => m.courseId))];
  const isMulti = uniqKw.length > 1;
  const tag = isMulti ? '⚠️ MERGED' : '   ';
  console.log(`  ${tag} ${id.slice(0,30).padEnd(30)} 대표="${g.term}"`);
  console.log(`         × ${g.members.length} 멤버, 고유키워드 ${uniqKw.length}개, courses=[${courseSet.join(',')}]`);
  if (isMulti) {
    // 같은 그룹에 묶인 다른 키워드들 표시
    for (const kw of uniqKw) {
      const cnt = g.members.filter(m => m.kw === kw).length;
      const courses = [...new Set(g.members.filter(m => m.kw === kw).map(m => m.courseId))];
      console.log(`           - "${kw}" × ${cnt} (courses: ${courses.join(',')})`);
    }
  }
}

// 2) 임베딩 누락 / courseId 누락 통계
console.log(`\n[canonicalTerms 메타]`);
console.log(`  embedding 있음: ${terms.filter(t => t.embedding).length}/${terms.length}`);
console.log(`  courseId 있음:  ${terms.filter(t => t.courseId).length}/${terms.length}`);

// 3) insights 의 courseId 누락 등 검사
const orphanInsights = insights.filter(i => !sessionToCourse.has(i.sessionId));
console.log(`\n[고아 insights] sessionId가 어느 course에도 속하지 않는 것: ${orphanInsights.length}`);
for (const o of orphanInsights.slice(0, 10)) {
  console.log(`  ${o.id} sessionId=${o.sessionId} kw="${o.keyword}"`);
}

process.exit(0);
