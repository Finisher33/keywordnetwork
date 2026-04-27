import type { Session } from '../store';

// 세션 정렬 — order 필드 우선, 미설정/동률 시 day → time → name 순.
export function sortSessions<T extends Session>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const ao = typeof a.order === 'number' ? a.order : Number.POSITIVE_INFINITY;
    const bo = typeof b.order === 'number' ? b.order : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    // fallback: day → time → name
    const ad = (a.day || '').localeCompare(b.day || '');
    if (ad !== 0) return ad;
    const at = (a.time || '').localeCompare(b.time || '');
    if (at !== 0) return at;
    return (a.name || '').localeCompare(b.name || '');
  });
}
