// Firestore document ID 생성 — 동시 50명 접속 시 Date.now() 충돌 방지
//   crypto.randomUUID 가능 시 사용 (RFC 4122 v4 — 충돌 사실상 0)
//   미지원 환경: timestamp + Math.random 조합으로 충돌 회피
export function genId(prefix?: string): string {
  let core: string;
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    core = (crypto as any).randomUUID().replace(/-/g, '');
  } else {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 10);
    const rnd2 = Math.random().toString(36).slice(2, 6);
    core = `${ts}_${rnd}${rnd2}`;
  }
  return prefix ? `${prefix}_${core}` : core;
}
