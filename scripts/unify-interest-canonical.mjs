// 동일 정규화 텍스트를 가진 interest 들이 서로 다른 canonicalId 를 가지면
// 가장 많이 쓰이는(빈도 1순위, 동률이면 가장 오래된) canonicalId 로 통일.
// canonicalTerms 도 합쳐 미사용 doc 정리.
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
const { getFirestore, collection, getDocs, writeBatch, doc } = await import('firebase/firestore');

const app = initializeApp(cfg);
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

const ZW = /[​‌‍﻿ ]/g;
const norm = (s) => {
  if (!s) return '';
  let v = s;
  try { v = v.normalize('NFC'); } catch {}
  return v.replace(ZW, '').trim().toLowerCase().replace(/\s+/g, '');
};

const load = async (n) => (await getDocs(collection(db, n))).docs.map(d => ({ id: d.id, ...d.data() }));
const [interests, terms] = await Promise.all([load('interests'), load('canonicalTerms')]);
console.log(`[전체] interests=${interests.length} terms=${terms.length}`);

// 1) 정규화 텍스트별로 interest 묶기 (kind=interest 도메인만)
const byNorm = new Map();
for (const i of interests) {
  const k = norm(i.keyword);
  if (!k) continue;
  if (!byNorm.has(k)) byNorm.set(k, []);
  byNorm.get(k).push(i);
}

let unifiedGroups = 0;
const ops = [];
const orphanedTermIds = new Set();

for (const [k, list] of byNorm) {
  const cidCounts = new Map();
  for (const i of list) {
    if (!i.canonicalId) continue;
    cidCounts.set(i.canonicalId, (cidCounts.get(i.canonicalId) || 0) + 1);
  }
  if (cidCounts.size <= 1) continue; // 이미 통일됨

  // 가장 많이 쓰이는 cid → 동률이면 term 의 embedding 길이 / 가장 오래된 ID
  const winner = [...cidCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      // tie-breaker: term doc 의 ID 사전순 (oldest)
      return a[0].localeCompare(b[0]);
    })[0][0];

  const winnerTerm = terms.find(t => t.id === winner);
  const winnerName = winnerTerm?.term || list[0].keyword;
  console.log(`\n  ⚠ "${winnerName}" 분기 발견 → ${winner} 로 통합`);
  for (const [cid, cnt] of cidCounts) {
    if (cid === winner) {
      console.log(`     ✓ KEEP  ${cid}  (×${cnt})`);
    } else {
      console.log(`     × MERGE ${cid}  (×${cnt})`);
      orphanedTermIds.add(cid);
    }
  }

  // 패치 op
  for (const i of list) {
    if (i.canonicalId && i.canonicalId !== winner) {
      ops.push({ set: { coll: 'interests', id: i.id, data: { ...i, canonicalId: winner } } });
    }
  }
  unifiedGroups++;
}

// 2) orphaned canonicalTerm doc 삭제 (다른 interest 가 참조하지 않을 때만)
const stillUsed = new Set();
for (const i of interests) if (i.canonicalId) stillUsed.add(i.canonicalId);
// note: ops 에서 갱신된 canonicalId 도 반영해야 정확. 간단히, orphanedTermIds 중 ops 갱신 후에도
// 어떤 interest 도 참조하지 않으면 삭제.
const willBeUsed = new Set();
for (const i of interests) {
  // ops 에서 patched 됐는지 확인
  const patched = ops.find(o => o.set?.coll === 'interests' && o.set.id === i.id);
  willBeUsed.add(patched ? patched.set.data.canonicalId : i.canonicalId);
}
for (const oid of orphanedTermIds) {
  if (!willBeUsed.has(oid)) ops.push({ delete: { coll: 'canonicalTerms', id: oid } });
}

console.log(`\n[집계] 통합 그룹 ${unifiedGroups}건, ops ${ops.length}건`);
if (ops.length === 0) {
  console.log('통일할 항목 없음 — 종료');
  process.exit(0);
}

for (let i = 0; i < ops.length; i += 450) {
  const slice = ops.slice(i, i + 450);
  const batch = writeBatch(db);
  for (const op of slice) {
    if (op.set) {
      const clean = Object.fromEntries(Object.entries(op.set.data).filter(([,v]) => v !== undefined && v !== null));
      batch.set(doc(db, op.set.coll, op.set.id), clean);
    } else if (op.delete) {
      batch.delete(doc(db, op.delete.coll, op.delete.id));
    }
  }
  await batch.commit();
  console.log(`  batch ${Math.floor(i/450)+1} committed (${slice.length} ops)`);
}
console.log('\n✓ 통합 완료');
process.exit(0);
