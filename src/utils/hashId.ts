// 결정적 단문 해시 — 같은 입력은 항상 같은 결과를 반환.
// canonicalTerm 동시 생성 race 차단용 (deterministic doc id).
// FNV-1a 32-bit + base36, 약 7자.
export function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // 추가 라운드로 충돌 가능성 더욱 낮춤
  let h2 = (h ^ 0xcafebabe) >>> 0;
  for (let i = 0; i < input.length; i++) {
    h2 ^= input.charCodeAt(i) << (i % 24);
    h2 = Math.imul(h2, 1540483477) >>> 0;
  }
  return h.toString(36) + h2.toString(36);
}
