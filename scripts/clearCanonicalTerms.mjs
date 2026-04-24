// Firestore canonicalTerms 컬렉션 전체 삭제
// 익명 인증 → 모든 문서 나열 → 일괄 삭제
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

await signInAnonymously(auth);
console.log('✓ 익명 로그인 성공');

const snap = await getDocs(collection(db, 'canonicalTerms'));
console.log(`대상 문서 수: ${snap.size}`);

if (snap.size === 0) {
  console.log('삭제할 문서 없음. 종료.');
  process.exit(0);
}

// Firestore writeBatch 최대 500건
const docs = snap.docs;
let deleted = 0;
for (let i = 0; i < docs.length; i += 500) {
  const batch = writeBatch(db);
  const chunk = docs.slice(i, i + 500);
  chunk.forEach(d => batch.delete(doc(db, 'canonicalTerms', d.id)));
  await batch.commit();
  deleted += chunk.length;
  console.log(`  진행: ${deleted}/${docs.length}`);
}

console.log(`✓ 완료: canonicalTerms ${deleted}건 삭제`);
process.exit(0);
