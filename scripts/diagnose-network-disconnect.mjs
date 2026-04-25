// 같은 키워드가 노드로 분리되는 원인 진단:
// 1) interest 측의 canonicalId 분포
// 2) 같은 정규화 텍스트인데 canonicalId 가 다른 케이스
// 3) Unicode 차이 (NFC/NFD), 보이지 않는 공백, BOM
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
const [users, interests, terms, courses] = await Promise.all([
  load('users'), load('interests'), load('canonicalTerms'), load('courses')
]);

console.log(`[전체] users=${users.length} interests=${interests.length} terms=${terms.length}\n`);

const norm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, '');
const nfcNorm = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, '').normalize('NFC');

// 코스별로
for (const c of courses) {
  const cUsers = users.filter(u => u.courseId === c.id);
  if (cUsers.length === 0) continue;
  const userIds = new Set(cUsers.map(u => u.id));
  const cInterests = interests.filter(i => userIds.has(i.userId));
  if (cInterests.length === 0) continue;

  console.log(`\n═══ 과정 "${c.name}" (${c.id}) ═══`);
  console.log(`  users=${cUsers.length}, interests=${cInterests.length}`);

  // 정규화 텍스트별로 cluster
  const byNorm = new Map();      // simple norm
  const byNfcNorm = new Map();   // norm + NFC

  for (const i of cInterests) {
    const k1 = norm(i.keyword);
    const k2 = nfcNorm(i.keyword);
    if (!byNorm.has(k1)) byNorm.set(k1, []);
    byNorm.get(k1).push(i);
    if (!byNfcNorm.has(k2)) byNfcNorm.set(k2, []);
    byNfcNorm.get(k2).push(i);
  }

  // 같은 정규화 텍스트인데 canonicalId 가 여러 개
  console.log(`\n  [같은 텍스트 → canonicalId 다수 케이스]`);
  let problemCount = 0;
  for (const [nk, list] of byNorm) {
    const cids = new Set(list.map(i => i.canonicalId || '<없음>'));
    if (cids.size > 1) {
      problemCount++;
      console.log(`    "${list[0].keyword}" (norm="${nk}")`);
      console.log(`      canonicalIds: ${[...cids].join(', ')}`);
      // 어느 유저가 어느 canonicalId 를 가졌는지
      for (const i of list) {
        const u = cUsers.find(x => x.id === i.userId);
        console.log(`        - ${u?.name || i.userId} | "${i.keyword}" | cid=${i.canonicalId || '<없음>'} | type=${i.type}`);
      }
    }
  }
  if (problemCount === 0) console.log(`    (없음)`);

  // Unicode 정규화 후에도 다른 케이스
  console.log(`\n  [NFC 정규화 후 비교 — 차이 있는 케이스]`);
  let nfcDiff = 0;
  for (const [nfc, list] of byNfcNorm) {
    const rawNorms = new Set(list.map(i => norm(i.keyword)));
    if (rawNorms.size > 1) {
      nfcDiff++;
      console.log(`    NFC="${nfc}" 에 다른 raw norm 들 모임:`);
      for (const i of list) {
        const u = cUsers.find(x => x.id === i.userId);
        const codes = [...i.keyword].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
        console.log(`        - ${u?.name || i.userId} | "${i.keyword}" | codes=${codes}`);
      }
    }
  }
  if (nfcDiff === 0) console.log(`    (없음)`);

  // canonicalTerms 측 텍스트 비교
  const termIds = new Set(cInterests.map(i => i.canonicalId).filter(Boolean));
  console.log(`\n  [참조 canonicalTerms ${termIds.size}개]`);
  const termsInUse = terms.filter(t => termIds.has(t.id));
  const termsByNorm = new Map();
  for (const t of termsInUse) {
    const nk = norm(t.term);
    if (!termsByNorm.has(nk)) termsByNorm.set(nk, []);
    termsByNorm.get(nk).push(t);
  }
  for (const [nk, list] of termsByNorm) {
    if (list.length > 1) {
      console.log(`    ⚠ "${list[0].term}" (norm="${nk}") 가 ${list.length}개 doc 으로 분리됨`);
      for (const t of list) {
        console.log(`        - ${t.id} | term="${t.term}" | kind=${t.kind || '<없음>'}`);
      }
    }
  }
}

process.exit(0);
