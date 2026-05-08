import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { sortSessions } from '../utils/sortSessions';

interface Props {
  courseId: string;
}

/**
 * 인사이트 다운로드 페이지
 *
 * - 선택된 과정의 모든 유저 × 모든 세션 조합으로 입력된 인사이트(키워드 + 코멘트)를 종합 표시.
 * - 좌측 고정 컬럼: 소속 / 성명 / 직급
 * - 이후 컬럼: 세션 순서대로 (세션이름 - 키워드, 세션이름 - 코멘트) 페어
 * - 미입력 셀은 빈 문자열로 처리.
 * - "CSV 다운로드" 버튼: UTF-8 BOM + CRLF 로 Excel 한글 호환 보장.
 */
export default function InsightDownload({ courseId }: Props) {
  const { db } = useStore();
  const [downloading, setDownloading] = useState(false);

  const course = db.courses.find(c => c.id === courseId);

  // 세션: order 기준 정렬, 활성/비활성 모두 포함 (관리자가 종합 데이터 다운로드 목적이므로 비활성 세션도 표시)
  const sessions = useMemo(
    () => sortSessions(db.sessions.filter(s => s.courseId === courseId)),
    [db.sessions, courseId]
  );

  // 유저: 해당 과정 가입자 (성명 가나다 정렬)
  const users = useMemo(
    () => db.users
      .filter(u => u.courseId === courseId)
      .sort((a, b) => (a.company || '').localeCompare(b.company || '') || (a.name || '').localeCompare(b.name || '')),
    [db.users, courseId]
  );

  // (userId, sessionId) → UserInsight 맵
  const insightMap = useMemo(() => {
    const m = new Map<string, { keyword: string; description: string }>();
    db.userInsights.forEach(i => {
      m.set(`${i.userId}__${i.sessionId}`, { keyword: i.keyword || '', description: i.description || '' });
    });
    return m;
  }, [db.userInsights]);

  // 헤더: 고정 3개 + 세션별 (키워드, 코멘트) 페어
  const headers = useMemo(() => {
    const base = ['소속', '성명', '직급'];
    sessions.forEach(s => {
      const label = s.name || '(이름 없음)';
      base.push(`${label} - 키워드`);
      base.push(`${label} - 코멘트`);
    });
    return base;
  }, [sessions]);

  // 행: 유저 단위
  const rows = useMemo(() => {
    return users.map(u => {
      const cells: string[] = [u.company || '', u.name || '', u.title || ''];
      sessions.forEach(s => {
        const it = insightMap.get(`${u.id}__${s.id}`);
        cells.push(it?.keyword || '');
        cells.push(it?.description || '');
      });
      return cells;
    });
  }, [users, sessions, insightMap]);

  // CSV 셀 이스케이프: 쉼표/줄바꿈/큰따옴표 포함 시 큰따옴표로 감싸고 내부 따옴표는 두 번 반복
  const escapeCsv = (v: string) => {
    if (v == null) return '';
    const needs = /[",\r\n]/.test(v);
    const esc = v.replace(/"/g, '""');
    return needs ? `"${esc}"` : esc;
  };

  const downloadCsv = () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const lines: string[] = [];
      lines.push(headers.map(escapeCsv).join(','));
      rows.forEach(r => lines.push(r.map(escapeCsv).join(',')));
      // Excel 한글 호환: UTF-8 BOM + CRLF
      const csv = '﻿' + lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const safeName = (course?.name || 'course').replace(/[\\/:*?"<>|]/g, '_');
      const filename = `인사이트_${safeName}_${yyyy}${mm}${dd}.csv`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // 인사이트가 한 건이라도 있는 유저 수 (안내 텍스트용)
  const filledUserCount = useMemo(() => {
    return rows.filter(r => r.slice(3).some(cell => cell && cell.trim())).length;
  }, [rows]);

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* 헤더 + 다운로드 버튼 */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl sm:text-2xl font-black text-on-surface">인사이트 다운로드</h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            {course ? <span className="font-bold text-on-surface">{course.name}</span> : '선택된 과정'} 의 세션별 키워드 · 코멘트를 종합한 데이터를 표로 확인하고 CSV 로 받을 수 있습니다.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
            <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">
              참가자 <b className="text-on-surface">{users.length}</b>명
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">
              세션 <b className="text-on-surface">{sessions.length}</b>개
            </span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">
              인사이트 입력 참가자 <b className="text-on-surface">{filledUserCount}</b>명
            </span>
          </div>
        </div>
        <button
          onClick={downloadCsv}
          disabled={downloading || users.length === 0 || sessions.length === 0}
          className="self-start md:self-auto inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          {downloading ? '내려받는 중...' : 'CSV 다운로드'}
        </button>
      </div>

      {/* 미리보기 표 */}
      {users.length === 0 || sessions.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/20 p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-40">inbox</span>
          <p className="text-sm font-bold">
            {users.length === 0 ? '이 과정에 등록된 참가자가 없습니다.' : '이 과정에 등록된 세션이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-outline-variant/20 bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-surface-container-high sticky top-0 z-10">
              <tr>
                {headers.map((h, idx) => {
                  const isFixed = idx < 3;
                  // 세션 페어 컬러링: (idx-3) 기준 페어 인덱스 → 짝/홀로 옅은 배경 alternation
                  const pairIdx = isFixed ? -1 : Math.floor((idx - 3) / 2);
                  const isKeyword = !isFixed && (idx - 3) % 2 === 0;
                  return (
                    <th
                      key={idx}
                      className={`px-3 py-2.5 text-left font-black text-[10px] uppercase tracking-widest border-b border-outline-variant/30 whitespace-nowrap
                        ${isFixed ? 'text-primary bg-primary/5 sticky left-0 z-20' : ''}
                        ${!isFixed && pairIdx % 2 === 0 ? 'bg-surface-container-high' : ''}
                        ${!isFixed && pairIdx % 2 === 1 ? 'bg-surface-container' : ''}
                        ${!isFixed ? (isKeyword ? 'text-secondary' : 'text-on-surface-variant') : ''}
                      `}
                      style={isFixed ? { left: idx === 0 ? 0 : idx === 1 ? 96 : 240 } : undefined}
                    >
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="even:bg-surface-container-lowest hover:bg-primary/5 transition-colors">
                  {r.map((cell, ci) => {
                    const isFixed = ci < 3;
                    const isKeyword = !isFixed && (ci - 3) % 2 === 0;
                    return (
                      <td
                        key={ci}
                        className={`px-3 py-2 align-top border-b border-outline-variant/15
                          ${isFixed ? 'sticky left-0 z-10 bg-inherit font-bold text-on-surface whitespace-nowrap' : ''}
                          ${!isFixed && isKeyword ? 'font-bold text-secondary whitespace-nowrap' : ''}
                          ${!isFixed && !isKeyword ? 'text-on-surface-variant max-w-[320px] whitespace-pre-wrap break-words' : ''}
                        `}
                        style={isFixed ? { left: ci === 0 ? 0 : ci === 1 ? 96 : 240 } : undefined}
                      >
                        {cell || <span className="text-on-surface-variant/30">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-on-surface-variant/70 italic">
        ※ Excel 에서 한글이 깨진다면, 빈 시트에서 [데이터 → 텍스트/CSV 가져오기] 로 UTF-8 인코딩 지정 후 열어주세요.
      </p>
    </div>
  );
}
