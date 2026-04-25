// userInsights 와 interests 가 동일 canonicalId 를 공유해 발생할 수 있는 충돌 진단
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
const [insights, interests, terms] = await Promise.all([
  load('userInsights'), load('interests'), load('canonicalTerms'),
]);

console.log(`[전체] insights=${insights.length} interests=${interests.length} canonicalTerms=${terms.length}\n`);

// canonicalId 별로 어디서 쓰이는지 분류
const usage = new Map(); // canonicalId -> { fromInsight: [kw], fromInterest: [kw] }
for (const i of insights) {
  if (!i.canonicalId) continue;
  if (!usage.has(i.canonicalId)) usage.set(i.canonicalId, { fromInsight: [], fromInterest: [] });
  usage.get(i.canonicalId).fromInsight.push(i.keyword);
}
for (const i of interests) {
  if (!i.canonicalId) continue;
  if (!usage.has(i.canonicalId)) usage.set(i.canonicalId, { fromInsight: [], fromInterest: [] });
  usage.get(i.canonicalId).fromInterest.push(i.keyword);
}

let shared = 0, insightOnly = 0, interestOnly = 0;
const sharedDetails = [];
for (const [cid, u] of usage) {
  const term = terms.find(t => t.id === cid);
  const label = term?.term || '?';
  if (u.fromInsight.length > 0 && u.fromInterest.length > 0) {
    shared++;
    sharedDetails.push({ cid, label, ...u });
  } else if (u.fromInsight.length > 0) insightOnly++;
  else interestOnly++;
}

console.log(`[canonicalId 사용 분류]`);
console.log(`  insight 만 사용:     ${insightOnly}`);
console.log(`  interest 만 사용:    ${interestOnly}`);
console.log(`  ⚠️ 양쪽 공유:         ${shared}\n`);

if (sharedDetails.length > 0) {
  console.log(`[공유 canonicalId 상세]`);
  for (const s of sharedDetails) {
    console.log(`  ${s.cid}  대표="${s.label}"`);
    console.log(`    insight 측: ${[...new Set(s.fromInsight)].map(k => `"${k}"`).join(', ')} (×${s.fromInsight.length})`);
    console.log(`    interest 측: ${[...new Set(s.fromInterest)].map(k => `"${k}"`).join(', ')} (×${s.fromInterest.length})`);
  }
}

// canonicalTerms 에 kind 필드 존재 여부
console.log(`\n[canonicalTerms 메타]`);
console.log(`  kind 필드 있음: ${terms.filter(t => t.kind).length}/${terms.length}`);
console.log(`  embedding 있음: ${terms.filter(t => t.embedding).length}/${terms.length}`);

process.exit(0);
