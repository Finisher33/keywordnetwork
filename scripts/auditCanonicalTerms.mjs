// canonicalTerms / userInsights 진단 스크립트
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
await signInAnonymously(auth);

const termsSnap = await getDocs(collection(db, 'canonicalTerms'));
const insightsSnap = await getDocs(collection(db, 'userInsights'));

const terms = termsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const insights = insightsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log(`=== canonicalTerms: ${terms.length}건 ===`);
const withEmb = terms.filter(t => Array.isArray(t.embedding) && t.embedding.length > 0);
const noEmb = terms.filter(t => !Array.isArray(t.embedding) || t.embedding.length === 0);
console.log(`  embedding 있음: ${withEmb.length}`);
console.log(`  embedding 없음: ${noEmb.length}`);
if (noEmb.length > 0) {
  console.log('  ↳ no-embedding terms:');
  noEmb.slice(0, 20).forEach(t => console.log(`    - id="${t.id}" term="${t.term}"`));
}

console.log(`\n=== 관심 키워드(Physical AI 계열) ===`);
const targets = terms.filter(t =>
  /physical\s*ai|피지컬|로봇\s*ai|robot/i.test(t.term || '')
);
targets.forEach(t => {
  console.log(`  term="${t.term}" id="${t.id}" hasEmb=${Array.isArray(t.embedding)} dim=${t.embedding?.length || 0}`);
});

console.log(`\n=== userInsights: ${insights.length}건 ===`);
const noCanon = insights.filter(i => !i.canonicalId);
console.log(`  canonicalId 없음: ${noCanon.length}`);
if (noCanon.length > 0) {
  console.log('  ↳ 샘플 10건:');
  noCanon.slice(0, 10).forEach(i => console.log(`    - keyword="${i.keyword}" sessionId="${i.sessionId}"`));
}

const aiInsights = insights.filter(i => /physical\s*ai|피지컬|로봇|robot/i.test(i.keyword || ''));
console.log(`\n=== AI 관련 insights (${aiInsights.length}건) ===`);
aiInsights.forEach(i => {
  const t = terms.find(tt => tt.id === i.canonicalId);
  console.log(`  keyword="${i.keyword}" canonicalId="${i.canonicalId}" → term="${t?.term || '(없음)'}"`);
});

process.exit(0);
