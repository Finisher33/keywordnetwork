// 운영 배포의 임베딩 프록시(/api/embedding) 동작 + 그룹핑 임계치 검증.
// 1) 프록시 응답 확인 (200 + 3072차원 벡터)
// 2) 동의어/무관어 페어와이즈 cosine similarity 측정
// 3) 0.78 임계치에서 정확히 분리되는지 결과 출력

const BASE = process.env.BASE || 'https://keywordnetworking.vercel.app';

async function embed(text) {
  const r = await fetch(`${BASE}/api/embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const d = await r.json();
  if (!Array.isArray(d.embedding)) throw new Error(`no embedding in response: ${JSON.stringify(d).slice(0,200)}`);
  return d.embedding;
}

function cos(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

console.log(`\n[프록시 동작 확인] ${BASE}/api/embedding`);
const t0 = Date.now();
let v0;
try {
  v0 = await embed('테스트');
  console.log(`  ✓ 200 OK · ${Date.now() - t0}ms · ${v0.length}차원 (정상=3072)`);
} catch (e) {
  console.log(`  ✗ 실패: ${e.message}`);
  process.exit(1);
}

// 동의어 / 무관어 페어와이즈 테스트
const PAIRS = {
  '동의어 (MERGE 되어야 함, > 0.78)': [
    ['Physical AI', '피지컬 AI'],
    ['리더십', 'Leadership'],
    ['커뮤니케이션', '소통'],
    ['데이터 분석', '데이터 사이언스'],
    ['AI 리스크', '인공지능 위험'],
  ],
  '무관어 (KEEP 되어야 함, < 0.78)': [
    ['브랜딩', '코딩'],
    ['전기차', '공룡'],
    ['요리', '악기연주'],
    ['낚시', '데이터분석'],
    ['리더십', '농구'],
  ],
};

const results = { merged: 0, kept: 0, wrong: 0 };
for (const [label, pairs] of Object.entries(PAIRS)) {
  console.log(`\n[${label}]`);
  for (const [a, b] of pairs) {
    try {
      const [va, vb] = await Promise.all([embed(a), embed(b)]);
      const sim = cos(va, vb);
      const isMerged = sim > 0.78;
      const expectMerged = label.includes('MERGE');
      const correct = isMerged === expectMerged;
      const verdict = correct ? '✓' : '✗';
      const action = isMerged ? 'MERGE' : 'KEEP ';
      console.log(`  ${verdict} "${a}" ↔ "${b}"  sim=${sim.toFixed(4)}  → ${action}`);
      if (correct) (isMerged ? results.merged++ : results.kept++);
      else results.wrong++;
    } catch (e) {
      console.log(`  ✗ "${a}" ↔ "${b}" 오류: ${e.message}`);
      results.wrong++;
    }
  }
}

console.log(`\n[종합]`);
console.log(`  올바른 MERGE: ${results.merged}건`);
console.log(`  올바른 KEEP : ${results.kept}건`);
console.log(`  오분류       : ${results.wrong}건`);
process.exit(results.wrong > 0 ? 1 : 0);
