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

const snap = await getDocs(collection(db, 'canonicalTerms'));
const terms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
console.log(`[total] ${terms.length} canonicalTerms\n`);
terms.sort((a, b) => (a.term || '').localeCompare(b.term || ''));
for (const t of terms) {
  const hasEmb = Array.isArray(t.embedding) ? `emb=${t.embedding.length}` : 'no-emb';
  console.log(`  ${t.id.padEnd(32)} "${t.term}"  (${hasEmb})`);
}
process.exit(0);
