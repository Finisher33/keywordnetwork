// 실제 interest 별 canonicalId / keyword 풀 덤프 — 그룹 분리 진짜 원인 찾기
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
const [users, interests, terms] = await Promise.all([
  load('users'), load('interests'), load('canonicalTerms')
]);

const userById = new Map(users.map(u => [u.id, u]));
const termById = new Map(terms.map(t => [t.id, t]));

console.log(`\n[유저별 interest 덤프]`);
const byUser = new Map();
for (const i of interests) {
  if (!byUser.has(i.userId)) byUser.set(i.userId, []);
  byUser.get(i.userId).push(i);
}

for (const [uid, list] of byUser) {
  const u = userById.get(uid);
  console.log(`\n  ▶ ${u?.name || '<unknown>'} (${u?.courseId || '?'})`);
  for (const i of list) {
    const term = termById.get(i.canonicalId);
    console.log(`    [${i.type.padEnd(5)}] "${i.keyword}"  cid=${i.canonicalId || '<X>'}  → term="${term?.term || '?'}" kind=${term?.kind || '?'}`);
  }
}

// canonicalTerms 측에서 같은 정규화 텍스트가 여러 doc 으로 흩어져 있는지
console.log(`\n[canonicalTerms 전체 — kind=interest 만, 정규화 텍스트별 그룹]`);
const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, '').normalize('NFC');
const interestTerms = terms.filter(t => t.kind === 'interest');
const groupedByNorm = new Map();
for (const t of interestTerms) {
  const k = norm(t.term);
  if (!groupedByNorm.has(k)) groupedByNorm.set(k, []);
  groupedByNorm.get(k).push(t);
}
for (const [k, list] of groupedByNorm) {
  if (list.length > 1) {
    console.log(`  ⚠ "${list[0].term}" 가 ${list.length}개 doc:`);
    for (const t of list) console.log(`     - ${t.id}  "${t.term}"`);
  }
}

process.exit(0);
