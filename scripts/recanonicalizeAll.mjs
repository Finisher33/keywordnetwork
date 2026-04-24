// 기존 canonicalTerms / userInsights / interests 를 전부 재-canonicalize.
// 프로덕션 env var 세팅 전에 저장된 embedding 없는 term 들을 정리하고
// 0.75 임계값으로 재병합.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const envLocal = fs.readFileSync('.env.local', 'utf8');
const apiKey = envLocal.match(/VITE_GEMINI_API_KEY=([^\s]+)/)?.[1];
if (!apiKey) { console.error('VITE_GEMINI_API_KEY not found in .env.local'); process.exit(1); }

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
await signInAnonymously(auth);
console.log('✓ 익명 로그인');

async function getEmbedding(text) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text }] } })
  });
  if (!r.ok) { console.warn(`embed fail "${text}": ${r.status}`); return null; }
  const d = await r.json();
  return d.embedding?.values || null;
}

function cos(a,b){let d=0,na=0,nb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return d/(Math.sqrt(na)*Math.sqrt(nb));}

const THRESHOLD = 0.75;

// 1. 기존 컬렉션 스냅샷
const [termsSnap, insightsSnap, interestsSnap] = await Promise.all([
  getDocs(collection(db, 'canonicalTerms')),
  getDocs(collection(db, 'userInsights')),
  getDocs(collection(db, 'interests')),
]);
console.log(`기존 canonicalTerms=${termsSnap.size}, userInsights=${insightsSnap.size}, interests=${interestsSnap.size}`);

// 2. 모든 unique keyword 수집 (insights + interests에서)
const allKeywords = new Set();
insightsSnap.docs.forEach(d => { const k = d.data().keyword; if (k) allKeywords.add(k); });
interestsSnap.docs.forEach(d => { const k = d.data().keyword; if (k) allKeywords.add(k); });
const keywords = Array.from(allKeywords);
console.log(`고유 키워드: ${keywords.length}개`);

// 3. 각 키워드에 대해 임베딩 계산 + 유사도로 클러스터링
const kwEmb = new Map();
for (const kw of keywords) {
  const e = await getEmbedding(kw);
  if (e) kwEmb.set(kw, e);
  process.stdout.write('.');
}
console.log(`\n임베딩 완료: ${kwEmb.size}/${keywords.length}`);

// 4. Union-Find 클러스터링 (0.75)
const parent = {};
keywords.forEach(k => parent[k] = k);
function find(x){ if (parent[x]!==x) parent[x]=find(parent[x]); return parent[x]; }
function union(a,b){ const ra=find(a), rb=find(b); if (ra!==rb) parent[rb]=ra; }

for (let i=0;i<keywords.length;i++) {
  for (let j=i+1;j<keywords.length;j++) {
    const ea = kwEmb.get(keywords[i]);
    const eb = kwEmb.get(keywords[j]);
    if (!ea || !eb) continue;
    if (cos(ea,eb) > THRESHOLD) union(keywords[i], keywords[j]);
  }
}

// 5. 클러스터 → 대표 키워드 결정 (등장 빈도 높은 쪽)
const freq = new Map();
insightsSnap.docs.forEach(d => { const k=d.data().keyword; freq.set(k,(freq.get(k)||0)+1); });
interestsSnap.docs.forEach(d => { const k=d.data().keyword; freq.set(k,(freq.get(k)||0)+1); });

const clusters = new Map(); // root → members[]
keywords.forEach(k => {
  const r = find(k);
  if (!clusters.has(r)) clusters.set(r, []);
  clusters.get(r).push(k);
});

// 각 클러스터에서 freq 최고 or 가장 긴 keyword 를 대표로
const kwToCanonical = new Map(); // keyword → { canonicalId, term, embedding }
for (const [, members] of clusters) {
  members.sort((a,b) => (freq.get(b)||0) - (freq.get(a)||0) || b.length - a.length);
  const rep = members[0];
  const canonicalId = `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}_${rep.replace(/[^a-zA-Z0-9가-힣]/g,'').slice(0,20)}`;
  const embedding = kwEmb.get(rep);
  members.forEach(m => kwToCanonical.set(m, { canonicalId, term: rep, embedding }));
}
console.log(`클러스터: ${clusters.size}개`);
clusters.forEach((members, root) => {
  if (members.length > 1) console.log(`  [${find(root)}] ${members.join(' / ')}`);
});

// 6. 기존 canonicalTerms 전부 삭제
console.log('\n--- 기존 canonicalTerms 삭제 ---');
{
  const docs = termsSnap.docs;
  for (let i=0;i<docs.length;i+=500) {
    const batch = writeBatch(db);
    docs.slice(i,i+500).forEach(d => batch.delete(doc(db,'canonicalTerms',d.id)));
    await batch.commit();
  }
  console.log(`  삭제: ${docs.length}건`);
}

// 7. 새 canonicalTerms 작성
console.log('--- 새 canonicalTerms 작성 ---');
{
  const uniqueCanons = new Map();
  for (const v of kwToCanonical.values()) {
    if (!uniqueCanons.has(v.canonicalId)) uniqueCanons.set(v.canonicalId, v);
  }
  const entries = Array.from(uniqueCanons.values());
  for (let i=0;i<entries.length;i+=500) {
    const batch = writeBatch(db);
    entries.slice(i,i+500).forEach(v => {
      batch.set(doc(db,'canonicalTerms',v.canonicalId),
        v.embedding ? { id:v.canonicalId, term:v.term, embedding:v.embedding } : { id:v.canonicalId, term:v.term });
    });
    await batch.commit();
  }
  console.log(`  작성: ${entries.length}건`);
}

// 8. userInsights / interests 의 canonicalId 업데이트
async function patchCollection(colName, snap) {
  const docs = snap.docs;
  for (let i=0;i<docs.length;i+=500) {
    const batch = writeBatch(db);
    docs.slice(i,i+500).forEach(d => {
      const data = d.data();
      const canon = kwToCanonical.get(data.keyword);
      if (canon) batch.set(doc(db,colName,d.id), { ...data, canonicalId: canon.canonicalId });
    });
    await batch.commit();
  }
  console.log(`  ${colName}: ${docs.length}건 업데이트`);
}
console.log('--- insights/interests canonicalId 갱신 ---');
await patchCollection('userInsights', insightsSnap);
await patchCollection('interests', interestsSnap);

console.log('\n✓ 마이그레이션 완료');
process.exit(0);
