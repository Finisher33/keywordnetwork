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
const [courses, sessions, users, insights] = await Promise.all([
  load('courses'), load('sessions'), load('users'), load('userInsights'),
]);

console.log(`\n[ALL COURSES]`);
courses.forEach(c => console.log(`  ${c.id}  "${c.name}"  isActive=${c.isActive ?? true}`));

console.log(`\n[ALL SESSIONS]`);
sessions.forEach(s => console.log(`  ${s.id}  course=${s.courseId}  active=${s.isActive}  name="${s.name}"`));

console.log(`\n[TEST USERS in DB]`);
const testUsers = users.filter(u => /TEST_bubbletest_/.test(u.id));
console.log(`  count: ${testUsers.length}`);
testUsers.slice(0,5).forEach(u => console.log(`  ${u.name}  course=${u.courseId}`));

console.log(`\n[TEST INSIGHTS in DB]`);
const testInsights = insights.filter(i => /^ui_bubbletest_/.test(i.id));
console.log(`  count: ${testInsights.length}`);

// Group by sessionId
const bySession = {};
for (const i of testInsights) bySession[i.sessionId] = (bySession[i.sessionId] || 0) + 1;
console.log(`\n[INSIGHTS BY SESSION]`);
for (const [sid, c] of Object.entries(bySession)) {
  const s = sessions.find(x => x.id === sid);
  console.log(`  ${sid}  count=${c}  → "${s?.name || 'UNKNOWN'}" (course=${s?.courseId})`);
}

console.log(`\n[ACTION] 사용자가 선택해야 할 세션:`);
for (const [sid] of Object.entries(bySession)) {
  const s = sessions.find(x => x.id === sid);
  const c = courses.find(x => x.id === s?.courseId);
  console.log(`  과정 "${c?.name}" → 세션 "${s?.name}"  (active=${s?.isActive})`);
}
process.exit(0);
