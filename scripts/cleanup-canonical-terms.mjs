// canonicalTerms 컬렉션의 노이즈 프리셋 삭제
// 대상: 의미 없는 자음 반복, 문장형, 명백한 장난성 단어
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
const { getFirestore, collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');

const app = initializeApp(cfg);
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

// 명시적 노이즈 단어 (사용자 지정 + 자음반복 + 문장형 + 장난성)
const NOISE_TERMS = new Set([
  '공룡',
  'ㅇㅇㅇ',
  'ㄴㅇㄹㅇㄴ',
  'ㅇㄴㄹㅇ',
  'ㅇㄴㄹㅇㄴㅇㄴ',
  'ㅇㄹㄴㄹ',
  '기회가 아니라 위협',  // 문장 — 키워드가 아님
  '사랑',                // 너무 추상적 + 테스트성
]);

// 자동 감지 패턴 (한글 자음만 반복)
const isJamoOnly = (s) => /^[ㄱ-ㅎㅏ-ㅣ\s]+$/.test(s);

const snap = await getDocs(collection(db, 'canonicalTerms'));
const terms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`[total] ${terms.length} canonicalTerms`);

const toDelete = terms.filter(t => {
  const term = (t.term || '').trim();
  if (NOISE_TERMS.has(term)) return true;
  if (isJamoOnly(term)) return true;
  return false;
});

console.log(`\n[삭제 대상] ${toDelete.length}건:`);
for (const t of toDelete) console.log(`  - "${t.term}"  (${t.id})`);

console.log(`\n[삭제 진행중...]`);
let ok = 0, fail = 0;
for (const t of toDelete) {
  try {
    await deleteDoc(doc(db, 'canonicalTerms', t.id));
    console.log(`  ✓ deleted "${t.term}"`);
    ok++;
  } catch (e) {
    console.error(`  ✗ failed "${t.term}":`, e.message);
    fail++;
  }
}
console.log(`\n[완료] ok=${ok} fail=${fail}, 남은 canonicalTerms=${terms.length - ok}`);
process.exit(0);
