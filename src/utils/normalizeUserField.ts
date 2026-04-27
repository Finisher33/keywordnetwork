// 유저 식별 필드 (이름·회사·과정명 등) 표면 정규화.
// 의도: NFC + zero-width 제거 + 양쪽 trim + 연속 공백 1칸으로 압축.
// 형태소·조사 제거는 하지 않음 (사람 이름이 깨지면 안 되기 때문).
const ZW_RE = /[​-‍﻿ ]/g;

export function normalizeUserField(s: string | undefined | null): string {
  if (!s) return '';
  let v = s;
  try { v = v.normalize('NFC'); } catch { /* 미지원 환경 fallback */ }
  v = v.replace(ZW_RE, '');
  v = v.trim().replace(/\s+/g, ' ');
  return v;
}
