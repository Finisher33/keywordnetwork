// 한국어 서베이 단어 정규화 — 표면 변형(조사·어미·공백·대소문자)만 흡수해
// 같은 의미를 한 그룹으로 묶기 위한 키를 만든다.
// 외부 API / npm 패키지 의존성 없음 — 모두 JS 내장 기능 사용.
//
// 예시:
//   "두려움이"  → "두려움"
//   "두려움 "   → "두려움"
//   "성장하기"  → "성장"
//   "stress."   → "stress"
//   "Fear"      → "fear"
//
// 단음절 단어 보호: 정규화 후 길이가 2 미만이 되면 해당 단계 적용 X.
//   "사이" 의 끝 '이' 를 조사로 오인하지 않도록.

const ZERO_WIDTH_RE = /[​‌‍﻿ ]/g;
const PUNCTUATION_RE = /[.,!?"'`~()\[\]{}<>+*/=:;|\\@#$%^&、。「」，．！？]/g;

// 어미 / 조사 — 길이 긴 패턴부터 매칭 (greedy 우선)
const SUFFIX_PATTERNS: RegExp[] = [
  // 동사·형용사 어미 (~하다, ~합니다 등)
  /(합니다|했습니다|하다가|하더라|하더니|하면서|한다는|한다면|할까요|할게요)$/,
  /(하다|한다|하면|하기|하는|하여|해서|해도|함이|함은|함을)$/,
  /(되다|된다|되면|되기|되는|되어|됨이|됨은|됨을)$/,
  /(입니다|입니까|이라서|이라고|이라며|이라면|이라는)$/,

  // 부사·접속 (~으로서/~으로써, ~로서/~로써)
  /(으로서|으로써|로서|로써)$/,

  // 조사 — 2글자
  /(에게|에서|부터|까지|마저|조차|처럼|보다|같이|이라|라서|라고|이며|보다는)$/,

  // 단일 음절 조사 (가장 마지막에)
  /(이|가|을|를|은|는|에|의|도|만|들|과|와|로|랑|뿐|만큼)$/,
];

export function normalizeKoreanSurveyWord(raw: string): string {
  if (!raw) return '';
  let s = raw;

  // 1) 유니코드 정규화 (한글 NFD → NFC)
  try { s = s.normalize('NFC'); } catch { /* 미지원 환경 fallback */ }

  // 2) 공백·zero-width 제거 + 소문자
  s = s.trim().toLowerCase();
  s = s.replace(ZERO_WIDTH_RE, '');
  s = s.replace(/\s+/g, '');

  // 3) 구두점 제거
  s = s.replace(PUNCTUATION_RE, '');

  if (!s) return '';

  // 4) 어미/조사 반복 제거 — "두려움이라서" → "두려움이라" → "두려움"
  //    각 단계에서 결과가 2글자 미만이 되면 적용 취소 (단음절 단어 보호).
  const MAX_PASSES = 3;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const p of SUFFIX_PATTERNS) {
      if (s.length <= 2) break;
      const next = s.replace(p, '');
      if (next.length >= 2 && next !== s) {
        s = next;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  return s;
}

/**
 * 단어 배열을 정규화 키 기준으로 그룹화. 같은 그룹 내에서는 표면 변형 중
 * 가장 자주 등장한 형태(동률이면 가장 짧은 형태) 를 대표로 노출.
 *
 * @returns [{ key, display, count }, ...]  count 내림차순
 */
export function groupByNormalizedKorean(
  words: string[]
): { key: string; display: string; count: number }[] {
  const groups = new Map<string, { variants: Map<string, number>; total: number }>();
  for (const raw of words) {
    if (typeof raw !== 'string') continue;
    const surface = raw.trim();
    if (!surface) continue;
    const key = normalizeKoreanSurveyWord(surface);
    if (!key) continue;
    const grp = groups.get(key) || { variants: new Map(), total: 0 };
    grp.variants.set(surface, (grp.variants.get(surface) || 0) + 1);
    grp.total += 1;
    groups.set(key, grp);
  }
  return Array.from(groups.entries())
    .map(([key, g]) => {
      // 대표 표면 변형: 빈도 1순위, 동률이면 가장 짧은 형태
      const display = Array.from(g.variants.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].length - b[0].length
      )[0][0];
      return { key, display, count: g.total };
    })
    .sort((a, b) => b.count - a.count);
}
