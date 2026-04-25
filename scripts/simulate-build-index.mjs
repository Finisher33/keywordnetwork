// 실제 DB 데이터로 buildInterestKeyIndex 재현 — 그룹 키 분포 확인
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
const [users, interests, terms] = await Promise.all([load('users'), load('interests'), load('canonicalTerms')]);

const COURSE = '1777003963443';
const cUsers = users.filter(u => u.courseId === COURSE);
const userIds = new Set(cUsers.map(u => u.id));
const cInterests = interests.filter(i => userIds.has(i.userId));

// buildInterestKeyIndex 재현
function buildIndex(interests, canonicalTerms) {
  const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, '');
  const parent = new Map();
  const find = (x) => {
    const p = parent.get(x);
    if (p === undefined) { parent.set(x, x); return x; }
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  const interestKey = new Map();
  const normToKey = new Map();
  for (const i of interests) {
    const primary = i.canonicalId || `kw:${norm(i.keyword)}`;
    if (!parent.has(primary)) parent.set(primary, primary);
    interestKey.set(i.id, primary);
    const nk = norm(i.keyword);
    if (normToKey.has(nk)) union(normToKey.get(nk), primary);
    else normToKey.set(nk, primary);
  }
  const groups = new Map();
  for (const i of interests) {
    const root = find(interestKey.get(i.id));
    if (!groups.has(root)) {
      const term = canonicalTerms?.find(t => t.id === root);
      groups.set(root, { displayName: term?.term || i.keyword, originals: [], interestIds: [] });
    }
    const g = groups.get(root);
    if (!g.originals.includes(i.keyword)) g.originals.push(i.keyword);
    g.interestIds.push(i.id);
  }
  return { groupOf: (id) => find(interestKey.get(id)), groups };
}

const idx = buildIndex(cInterests, terms);

console.log(`\n[buildInterestKeyIndex 결과 — 그룹 ${idx.groups.size}개]`);
const userById = new Map(cUsers.map(u => [u.id, u]));
for (const [root, g] of idx.groups) {
  console.log(`\n  ◯ "${g.displayName}"  (root=${root})`);
  console.log(`    originals: ${g.originals.map(o => `"${o}"`).join(', ')}`);
  for (const iid of g.interestIds) {
    const i = cInterests.find(x => x.id === iid);
    const u = userById.get(i?.userId);
    console.log(`      - ${u?.name || '?'} | ${i?.type} | "${i?.keyword}" | cid=${i?.canonicalId}`);
  }
}

// 시뮬레이션: nodes / links
console.log(`\n\n[시뮬레이션 nodes/links]`);
const nodes = [];
const links = [];
for (const u of cUsers) nodes.push({ id: `user-${u.id}`, type: 'user', label: u.name });

for (const [root, g] of idx.groups) {
  nodes.push({ id: `kw-${root}`, type: 'keyword', label: g.displayName });
  for (const i of cInterests) {
    if (idx.groupOf(i.id) === root) {
      links.push({ source: `user-${i.userId}`, target: `kw-${root}`, type: i.type });
    }
  }
}
console.log(`  nodes=${nodes.length} (users=${cUsers.length} + keywords=${idx.groups.size})`);
console.log(`  links=${links.length}`);
console.log(`  keyword nodes:`);
for (const n of nodes.filter(x => x.type === 'keyword')) console.log(`    ${n.id}  "${n.label}"`);

process.exit(0);
