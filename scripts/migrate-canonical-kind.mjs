// 기존 canonicalTerms 에 kind 필드를 부여 (insight / interest)
// - 사용처 분석으로 자동 결정. 양쪽에서 쓰면 split (insight 측을 새 doc 으로 복제하고 userInsights 참조 갱신).
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
const { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc } = await import('firebase/firestore');

const app = initializeApp(cfg);
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

const load = async (n) => (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, ...d.data() }));
const [insights, interests, terms] = await Promise.all([
  load('userInsights'), load('interests'), load('canonicalTerms'),
]);
console.log(`[입력] insights=${insights.length} interests=${interests.length} canonicalTerms=${terms.length}`);

// 사용처 매핑
const usage = new Map(); // canonicalId → { insight: [insightDocId], interest: [interestDocId] }
for (const i of insights) {
  if (!i.canonicalId) continue;
  if (!usage.has(i.canonicalId)) usage.set(i.canonicalId, { insight: [], interest: [] });
  usage.get(i.canonicalId).insight.push(i.id);
}
for (const i of interests) {
  if (!i.canonicalId) continue;
  if (!usage.has(i.canonicalId)) usage.set(i.canonicalId, { insight: [], interest: [] });
  usage.get(i.canonicalId).interest.push(i.id);
}

let setInsight = 0, setInterest = 0, splitCount = 0, deleteCount = 0;
const batchOps = []; // {coll, id, data} or {delete: id}

for (const t of terms) {
  const u = usage.get(t.id) || { insight: [], interest: [] };
  const inI = u.insight.length > 0;
  const inT = u.interest.length > 0;

  if (inI && inT) {
    // 양쪽 사용: 기존 doc 을 interest 측으로 두고, insight 측은 새 doc 으로 복제 → insights 참조 갱신
    const newId = `ct_insight_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}_${t.id.slice(-6)}`;
    const dup = { id: newId, term: t.term, embedding: t.embedding || null, kind: 'insight' };
    batchOps.push({ set: { coll: 'canonicalTerms', id: newId, data: dup } });
    // 기존 doc 은 interest 로 표시
    batchOps.push({ set: { coll: 'canonicalTerms', id: t.id, data: { ...t, kind: 'interest' } } });
    // insight 들의 canonicalId 갱신
    for (const insId of u.insight) {
      const orig = insights.find(x => x.id === insId);
      if (orig) batchOps.push({ set: { coll: 'userInsights', id: insId, data: { ...orig, canonicalId: newId } } });
    }
    splitCount++;
    console.log(`  ⚠ SPLIT "${t.term}" → interest=${t.id}, 신규 insight=${newId}`);
  } else if (inI) {
    batchOps.push({ set: { coll: 'canonicalTerms', id: t.id, data: { ...t, kind: 'insight' } } });
    setInsight++;
  } else if (inT) {
    batchOps.push({ set: { coll: 'canonicalTerms', id: t.id, data: { ...t, kind: 'interest' } } });
    setInterest++;
  } else {
    // 사용처 없음 → 정리 차원에서 삭제 (legacy 노이즈)
    batchOps.push({ delete: { coll: 'canonicalTerms', id: t.id } });
    deleteCount++;
  }
}

console.log(`\n[집계] insight=${setInsight}, interest=${setInterest}, split=${splitCount}, delete(unused)=${deleteCount}`);
console.log(`총 op ${batchOps.length}건 적용 시작...`);

// 500개 단위로 batch
for (let i = 0; i < batchOps.length; i += 450) {
  const slice = batchOps.slice(i, i + 450);
  const batch = writeBatch(db);
  for (const op of slice) {
    if (op.set) {
      // null 필드 제거
      const clean = Object.fromEntries(Object.entries(op.set.data).filter(([,v]) => v !== undefined && v !== null));
      batch.set(doc(db, op.set.coll, op.set.id), clean);
    } else if (op.delete) {
      batch.delete(doc(db, op.delete.coll, op.delete.id));
    }
  }
  await batch.commit();
  console.log(`  batch ${Math.floor(i/450)+1} committed (${slice.length} ops)`);
}

console.log('\n✓ 마이그레이션 완료');
process.exit(0);
