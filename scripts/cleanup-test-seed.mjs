// 테스트 시드 데이터 삭제: TEST_bubbletest_* users + ui_bubbletest_* insights
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
const { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } = await import('firebase/firestore');

const app = initializeApp(cfg);
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

const [usersSnap, insightsSnap, sessionsSnap] = await Promise.all([
  getDocs(collection(db, 'users')),
  getDocs(collection(db, 'userInsights')),
  getDocs(collection(db, 'sessions')),
]);

const testUsers = usersSnap.docs.filter(d => /TEST_bubbletest_/.test(d.id));
const testInsights = insightsSnap.docs.filter(d => /^ui_bubbletest_/.test(d.id));
const testSessions = sessionsSnap.docs.filter(d => /^s_test_/.test(d.id) || (d.data().name === '버블 테스트 세션'));

console.log(`[삭제 대상]`);
console.log(`  users: ${testUsers.length}`);
console.log(`  userInsights: ${testInsights.length}`);
console.log(`  sessions: ${testSessions.length}`);

async function batchDelete(name, docs) {
  for (let i = 0; i < docs.length; i += 500) {
    const batch = writeBatch(db);
    docs.slice(i, i + 500).forEach(d => batch.delete(doc(db, name, d.id)));
    await batch.commit();
  }
  console.log(`  ✓ ${name}: ${docs.length}건 삭제`);
}

console.log('\n[삭제 진행]');
await batchDelete('userInsights', testInsights);
await batchDelete('users', testUsers);
await batchDelete('sessions', testSessions);
console.log('\n[완료]');
process.exit(0);
