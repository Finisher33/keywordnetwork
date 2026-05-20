import { useMemo, useState } from 'react';
import { useStore, UserInsight, User, Interest } from '../store';
import { sortSessions } from '../utils/sortSessions';
import { cosineSimilarity } from '../services/embeddingService';

interface Props {
  courseId: string;
}

type SubTab = 'people' | 'keyword' | 'interests';

// ─── 공통 유틸: CSV 셀 이스케이프 + 다운로드 ─────────────────────────────────
// Claude / Excel / pandas 모두 호환되도록 ASCII filename + BOM 옵션 + utf-8.
function escapeCsv(v: string) {
  if (v == null) return '';
  const needs = /[",\r\n]/.test(v);
  const esc = String(v).replace(/"/g, '""');
  return needs ? `"${esc}"` : esc;
}

function downloadCsvFile(rows: string[][], filenameNoExt: string, opts?: { bom?: boolean }) {
  const lines = rows.map(r => r.map(escapeCsv).join(','));
  // BOM 은 Excel 한글 호환에 필요하지만 Claude.ai 업로드 검증과 충돌하는 경우가 있어 옵션화.
  const csv = (opts?.bom !== false ? '﻿' : '') + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameNoExt}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 키워드 그룹핑 (InsightView 와 동일 로직) ────────────────────────────────
// canonicalId 기준 1차 그룹핑 → 임베딩 코사인 유사도 0.78 이상이면 union-find 로 병합.
interface KwGroup {
  id: string;
  name: string;
  count: number;
  hashtags: string[];
  insights: UserInsight[];
}
function groupInsightsBySimilarity(
  insights: UserInsight[],
  canonicalTerms: { id: string; term?: string; embedding?: number[] }[] | undefined,
): KwGroup[] {
  if (insights.length === 0) return [];
  const groups: Record<string, { count: number; originalKeywords: string[]; insights: UserInsight[] }> = {};
  insights.forEach(i => {
    const repId = i.canonicalId || i.keyword;
    if (!groups[repId]) groups[repId] = { count: 0, originalKeywords: [], insights: [] };
    groups[repId].count += 1;
    if (!groups[repId].originalKeywords.includes(i.keyword)) groups[repId].originalKeywords.push(i.keyword);
    groups[repId].insights.push(i);
  });

  const ids = Object.keys(groups);
  const SIM_THRESHOLD = 0.78;
  const parent: Record<string, string> = {};
  ids.forEach(id => { parent[id] = id; });
  const find = (x: string): string => {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = canonicalTerms?.find(t => t.id === ids[i]);
      const b = canonicalTerms?.find(t => t.id === ids[j]);
      if (a?.embedding && b?.embedding) {
        if (cosineSimilarity(a.embedding, b.embedding) > SIM_THRESHOLD) {
          const ra = find(ids[i]);
          const rb = find(ids[j]);
          if (ra !== rb) {
            if ((groups[ra]?.count || 0) >= (groups[rb]?.count || 0)) parent[rb] = ra;
            else parent[ra] = rb;
          }
        }
      }
    }
  }

  const merged: Record<string, { count: number; originalKeywords: string[]; insights: UserInsight[] }> = {};
  ids.forEach(id => {
    const root = find(id);
    if (!merged[root]) merged[root] = { count: 0, originalKeywords: [], insights: [] };
    merged[root].count += groups[id].count;
    groups[id].originalKeywords.forEach(k => {
      if (!merged[root].originalKeywords.includes(k)) merged[root].originalKeywords.push(k);
    });
    merged[root].insights.push(...groups[id].insights);
  });

  return Object.entries(merged).map(([id, data]) => {
    const term = canonicalTerms?.find(t => t.id === id);
    const fallback = data.originalKeywords[0] || id;
    return {
      id,
      name: term?.term?.trim() || fallback,
      count: data.count,
      hashtags: data.originalKeywords,
      insights: data.insights,
    };
  }).sort((a, b) => b.count - a.count);
}

/**
 * 인사이트 다운로드 페이지
 *
 * - 서브탭 "인원": 유저 × 세션 매트릭스 (소속/성명/직급 + 세션별 키워드/코멘트 페어)
 * - 서브탭 "키워드": 세션 → 키워드 그룹 → 해시태그 → 코멘트 + 작성자(회사/성명/직책)
 *   각각 CSV 다운로드 가능 (Excel 호환).
 */
export default function InsightDownload({ courseId }: Props) {
  const { db } = useStore();
  const [tab, setTab] = useState<SubTab>('people');

  const course = db.courses.find(c => c.id === courseId);

  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* 헤더 + 서브탭 드롭다운 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl sm:text-2xl font-black text-on-surface">인사이트 다운로드</h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            {course ? <span className="font-bold text-on-surface">{course.name}</span> : '선택된 과정'} 의 인사이트 데이터를 표로 확인하고 CSV(Excel 호환)로 받을 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">보기 기준</label>
          <div className="relative">
            <select
              value={tab}
              onChange={e => setTab(e.target.value as SubTab)}
              className="appearance-none pl-4 pr-10 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="people">인원</option>
              <option value="keyword">키워드</option>
              <option value="interests">Giver/Taker</option>
            </select>
            <span className="material-symbols-outlined text-on-surface-variant text-lg absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>

      {tab === 'people' ? (
        <PeopleView courseId={courseId} courseName={course?.name} />
      ) : tab === 'keyword' ? (
        <KeywordView courseId={courseId} courseName={course?.name} />
      ) : (
        <InterestsView courseId={courseId} courseName={course?.name} />
      )}

      <p className="text-[10px] text-on-surface-variant/70 italic">
        ※ Excel 에서 한글이 깨진다면, 빈 시트에서 [데이터 → 텍스트/CSV 가져오기] 로 UTF-8 인코딩 지정 후 열어주세요.
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 1) 인원 뷰: 유저 행 × 세션별 (키워드/코멘트) 페어 컬럼
// ───────────────────────────────────────────────────────────────────────────
function PeopleView({ courseId, courseName }: { courseId: string; courseName?: string }) {
  const { db } = useStore();
  const [downloading, setDownloading] = useState(false);

  const sessions = useMemo(
    () => sortSessions(db.sessions.filter(s => s.courseId === courseId)),
    [db.sessions, courseId]
  );
  const users = useMemo(
    () => db.users
      .filter(u => u.courseId === courseId)
      .sort((a, b) => (a.company || '').localeCompare(b.company || '') || (a.name || '').localeCompare(b.name || '')),
    [db.users, courseId]
  );
  const insightMap = useMemo(() => {
    const m = new Map<string, { keyword: string; description: string }>();
    db.userInsights.forEach(i => {
      m.set(`${i.userId}__${i.sessionId}`, { keyword: i.keyword || '', description: i.description || '' });
    });
    return m;
  }, [db.userInsights]);

  const headers = useMemo(() => {
    const base = ['소속', '성명', '직급'];
    sessions.forEach(s => {
      const label = s.name || '(이름 없음)';
      base.push(`${label} - 키워드`);
      base.push(`${label} - 코멘트`);
    });
    return base;
  }, [sessions]);

  const rows = useMemo(() => users.map(u => {
    const cells: string[] = [u.company || '', u.name || '', u.title || ''];
    sessions.forEach(s => {
      const it = insightMap.get(`${u.id}__${s.id}`);
      cells.push(it?.keyword || '');
      cells.push(it?.description || '');
    });
    return cells;
  }), [users, sessions, insightMap]);

  const filledUserCount = useMemo(
    () => rows.filter(r => r.slice(3).some(cell => cell && cell.trim())).length,
    [rows]
  );

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const safe = (courseName || 'course').replace(/[\\/:*?"<>|\s]/g, '_');
      downloadCsvFile([headers, ...rows], `insights_people_${safe}_${todayStamp()}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
          <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">참가자 <b className="text-on-surface">{users.length}</b>명</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">세션 <b className="text-on-surface">{sessions.length}</b>개</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">인사이트 입력 참가자 <b className="text-on-surface">{filledUserCount}</b>명</span>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || users.length === 0 || sessions.length === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          {downloading ? '내려받는 중...' : 'CSV 다운로드'}
        </button>
      </div>

      {users.length === 0 || sessions.length === 0 ? (
        <EmptyState reason={users.length === 0 ? '이 과정에 등록된 참가자가 없습니다.' : '이 과정에 등록된 세션이 없습니다.'} />
      ) : (
        <div className="rounded-2xl border border-outline-variant/20 bg-white shadow-sm overflow-x-auto overflow-y-visible">
          <table className="text-xs border-collapse" style={{ minWidth: 'max-content' }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 120 }} />
              {sessions.flatMap(s => [
                <col key={`k-${s.id}`} style={{ width: 160 }} />,
                <col key={`d-${s.id}`} style={{ width: 320 }} />,
              ])}
            </colgroup>
            <thead className="bg-surface-container-high sticky top-0 z-10">
              <tr>
                {headers.map((h, idx) => {
                  const isFixed = idx < 3;
                  const pairIdx = isFixed ? -1 : Math.floor((idx - 3) / 2);
                  const isKeyword = !isFixed && (idx - 3) % 2 === 0;
                  return (
                    <th
                      key={idx}
                      className={`px-3 py-2.5 text-left font-black text-[10px] uppercase tracking-widest border-b border-outline-variant/30 whitespace-nowrap align-bottom
                        ${isFixed ? 'text-primary bg-primary/5' : ''}
                        ${!isFixed && pairIdx % 2 === 0 ? 'bg-surface-container-high' : ''}
                        ${!isFixed && pairIdx % 2 === 1 ? 'bg-surface-container' : ''}
                        ${!isFixed ? (isKeyword ? 'text-secondary' : 'text-on-surface-variant') : ''}
                      `}
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
                          ${isFixed ? 'font-bold text-on-surface whitespace-nowrap' : ''}
                          ${!isFixed && isKeyword ? 'font-bold text-secondary whitespace-pre-wrap break-words' : ''}
                          ${!isFixed && !isKeyword ? 'text-on-surface-variant whitespace-pre-wrap break-words' : ''}
                        `}
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
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 2) 키워드 뷰: 세션 → 키워드 그룹 → 해시태그/코멘트 + 작성자
// ───────────────────────────────────────────────────────────────────────────
function KeywordView({ courseId, courseName }: { courseId: string; courseName?: string }) {
  const { db } = useStore();
  const [downloading, setDownloading] = useState(false);

  const sessions = useMemo(
    () => sortSessions(db.sessions.filter(s => s.courseId === courseId)),
    [db.sessions, courseId]
  );
  const userMap = useMemo(() => {
    const m = new Map<string, User>();
    db.users.forEach(u => m.set(u.id, u));
    return m;
  }, [db.users]);

  // 세션별로 키워드 그룹핑 결과를 미리 계산
  const sessionGroups = useMemo(() => {
    return sessions.map(s => {
      const insights = (db.userInsights || []).filter(i => i.sessionId === s.id);
      const groups = groupInsightsBySimilarity(insights, db.canonicalTerms);
      return { session: s, groups };
    });
  }, [sessions, db.userInsights, db.canonicalTerms]);

  // 통계
  const stats = useMemo(() => {
    let totalGroups = 0;
    let totalEntries = 0;
    sessionGroups.forEach(sg => {
      totalGroups += sg.groups.length;
      sg.groups.forEach(g => { totalEntries += g.insights.length; });
    });
    return { totalGroups, totalEntries };
  }, [sessionGroups]);

  // CSV 행 생성 — 한 인사이트당 한 행 (flat denormalized)
  const buildCsvRows = (): string[][] => {
    const headers = ['세션', '그룹 키워드', '그룹 입력 횟수', '해시태그', '코멘트', '회사', '성명', '직책'];
    const rows: string[][] = [headers];
    sessionGroups.forEach(({ session, groups }) => {
      groups.forEach(g => {
        g.insights.forEach(ins => {
          const u = userMap.get(ins.userId);
          rows.push([
            session.name || '',
            g.name,
            String(g.count),
            ins.keyword || '',
            ins.description || '',
            u?.company || '',
            u?.name || '',
            u?.title || '',
          ]);
        });
      });
    });
    return rows;
  };

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const safe = (courseName || 'course').replace(/[\\/:*?"<>|\s]/g, '_');
      downloadCsvFile(buildCsvRows(), `insights_keywords_${safe}_${todayStamp()}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
          <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">세션 <b className="text-on-surface">{sessions.length}</b>개</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">키워드 그룹 총 <b className="text-on-surface">{stats.totalGroups}</b>개</span>
          <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">전체 인사이트 입력 <b className="text-on-surface">{stats.totalEntries}</b>건</span>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || stats.totalEntries === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          {downloading ? '내려받는 중...' : 'CSV 다운로드'}
        </button>
      </div>

      {stats.totalEntries === 0 ? (
        <EmptyState reason="아직 입력된 인사이트가 없습니다." />
      ) : (
        <div className="rounded-2xl border border-outline-variant/20 bg-white shadow-sm overflow-x-auto overflow-y-visible">
          <table className="text-xs border-collapse w-full" style={{ minWidth: 1000 }}>
            <colgroup>
              <col style={{ width: 180 }} />{/* 세션 */}
              <col style={{ width: 160 }} />{/* 그룹 키워드 */}
              <col style={{ width: 140 }} />{/* 해시태그 */}
              <col style={{ width: 360 }} />{/* 코멘트 */}
              <col style={{ width: 120 }} />{/* 회사 */}
              <col style={{ width: 90 }} />{/* 성명 */}
              <col style={{ width: 110 }} />{/* 직책 */}
            </colgroup>
            <thead className="bg-surface-container-high sticky top-0 z-10">
              <tr>
                {['세션', '그룹 키워드', '해시태그', '코멘트', '회사', '성명', '직책'].map((h, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2.5 text-left font-black text-[10px] uppercase tracking-widest border-b border-outline-variant/30 whitespace-nowrap text-primary bg-primary/5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessionGroups.map(({ session, groups }) => {
                if (groups.length === 0) {
                  return (
                    <tr key={`empty-${session.id}`} className="bg-surface-container-lowest">
                      <td className="px-3 py-2 align-top border-b border-outline-variant/15 font-bold text-on-surface whitespace-pre-wrap break-words">{session.name}</td>
                      <td colSpan={6} className="px-3 py-2 align-top border-b border-outline-variant/15 text-on-surface-variant/50 italic">— 입력된 인사이트 없음 —</td>
                    </tr>
                  );
                }
                // 세션 단위로 묶어서 렌더 (rowSpan 으로 세션명 합치기)
                const sessionRowSpan = groups.reduce((acc, g) => acc + g.insights.length, 0);
                let sessionRendered = false;
                return groups.flatMap((g, gi) => {
                  let groupRendered = false;
                  return g.insights.map((ins, ii) => {
                    const u = userMap.get(ins.userId);
                    const showSession = !sessionRendered;
                    const showGroup = !groupRendered;
                    sessionRendered = true;
                    groupRendered = true;
                    const isFirstOfGroup = ii === 0;
                    const isLastOfGroup = ii === g.insights.length - 1;
                    return (
                      <tr
                        key={`${session.id}-${g.id}-${ins.id}`}
                        className={`hover:bg-primary/5 transition-colors ${gi % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest'} ${isLastOfGroup ? 'border-b-2 border-outline-variant/30' : ''}`}
                      >
                        {showSession && (
                          <td
                            rowSpan={sessionRowSpan}
                            className="px-3 py-2 align-top border-b border-r border-outline-variant/15 font-black text-on-surface whitespace-pre-wrap break-words bg-surface-container-low"
                          >
                            <div className="sticky top-12">{session.name}</div>
                          </td>
                        )}
                        {showGroup && (
                          <td
                            rowSpan={g.insights.length}
                            className="px-3 py-2 align-top border-b border-r border-outline-variant/15 font-bold text-secondary whitespace-pre-wrap break-words bg-secondary/5"
                          >
                            <div className="flex flex-col gap-1">
                              <span>{g.name}</span>
                              <span className="text-[9px] font-bold text-on-surface-variant/70">입력 {g.count}건</span>
                            </div>
                          </td>
                        )}
                        <td className={`px-3 py-2 align-top border-b border-outline-variant/15 font-bold text-primary whitespace-pre-wrap break-words ${isFirstOfGroup ? '' : ''}`}>
                          #{ins.keyword}
                        </td>
                        <td className="px-3 py-2 align-top border-b border-outline-variant/15 text-on-surface-variant whitespace-pre-wrap break-words">
                          {ins.description || <span className="text-on-surface-variant/30">—</span>}
                        </td>
                        <td className="px-3 py-2 align-top border-b border-outline-variant/15 text-on-surface whitespace-nowrap">
                          {u?.company || <span className="text-on-surface-variant/30">—</span>}
                        </td>
                        <td className="px-3 py-2 align-top border-b border-outline-variant/15 font-bold text-on-surface whitespace-nowrap">
                          {u?.name || <span className="text-on-surface-variant/30">—</span>}
                        </td>
                        <td className="px-3 py-2 align-top border-b border-outline-variant/15 text-on-surface-variant whitespace-nowrap">
                          {u?.title || <span className="text-on-surface-variant/30">—</span>}
                        </td>
                      </tr>
                    );
                  });
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 3) Giver/Taker 뷰: 유저별 Giver / Taker 키워드 + 설명
// ───────────────────────────────────────────────────────────────────────────
function InterestsView({ courseId, courseName }: { courseId: string; courseName?: string }) {
  const { db } = useStore();
  const [downloading, setDownloading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'giver' | 'taker'>('all');

  // 유저: 해당 과정 가입자 (소속 → 성명 가나다 정렬)
  const users = useMemo(
    () => db.users
      .filter(u => u.courseId === courseId)
      .sort((a, b) => (a.company || '').localeCompare(b.company || '') || (a.name || '').localeCompare(b.name || '')),
    [db.users, courseId]
  );
  const userIds = useMemo(() => new Set(users.map(u => u.id)), [users]);

  // 관심사: 해당 과정의 유저만, 타입 필터 적용
  const interestsByUser = useMemo(() => {
    const m = new Map<string, { giver: Interest[]; taker: Interest[] }>();
    users.forEach(u => m.set(u.id, { giver: [], taker: [] }));
    (db.interests || []).forEach(it => {
      if (!userIds.has(it.userId)) return;
      const entry = m.get(it.userId);
      if (!entry) return;
      if (it.type === 'giver') entry.giver.push(it);
      else if (it.type === 'taker') entry.taker.push(it);
    });
    return m;
  }, [db.interests, users, userIds]);

  // 통계
  const stats = useMemo(() => {
    let giverCnt = 0, takerCnt = 0, filledUsers = 0;
    interestsByUser.forEach(({ giver, taker }) => {
      giverCnt += giver.length;
      takerCnt += taker.length;
      if (giver.length + taker.length > 0) filledUsers += 1;
    });
    return { giverCnt, takerCnt, filledUsers };
  }, [interestsByUser]);

  // 화면 표시용 행 — 유저 단위로 (giver 들 + taker 들) 묶어 렌더, rowSpan 으로 유저 정보 병합
  // 필터 'giver' / 'taker' 인 경우 해당 타입만 표시.
  type DisplayUserRow = { user: User; giver: Interest[]; taker: Interest[]; total: number };
  const displayRows = useMemo<DisplayUserRow[]>(() => {
    return users.map(u => {
      const e = interestsByUser.get(u.id) || { giver: [], taker: [] };
      const giver = filterType === 'taker' ? [] : e.giver;
      const taker = filterType === 'giver' ? [] : e.taker;
      return { user: u, giver, taker, total: giver.length + taker.length };
    });
  }, [users, interestsByUser, filterType]);

  // CSV 행 — flat denormalized (한 관심사 = 한 행). 미입력 유저도 빈 행으로 1줄 보존.
  const buildCsvRows = (): string[][] => {
    const headers = ['회사', '부서', '성명', '직책', '구분', '키워드', '설명'];
    const rows: string[][] = [headers];
    displayRows.forEach(({ user, giver, taker }) => {
      const all = [
        ...giver.map(g => ({ type: 'Giver', kw: g.keyword, desc: g.description })),
        ...taker.map(t => ({ type: 'Taker', kw: t.keyword, desc: t.description })),
      ];
      if (all.length === 0) {
        rows.push([user.company || '', user.department || '', user.name || '', user.title || '', '', '', '']);
        return;
      }
      all.forEach(it => {
        rows.push([
          user.company || '',
          user.department || '',
          user.name || '',
          user.title || '',
          it.type,
          it.kw || '',
          it.desc || '',
        ]);
      });
    });
    return rows;
  };

  const handleDownload = () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const safe = (courseName || 'course').replace(/[\\/:*?"<>|\s]/g, '_');
      const tag = filterType === 'all' ? 'giver_taker' : filterType;
      downloadCsvFile(buildCsvRows(), `insights_${tag}_${safe}_${todayStamp()}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 필터 + 통계 + 다운로드 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* 타입 필터 */}
          <div className="flex gap-1 p-1 bg-surface-container-highest rounded-xl">
            {([
              { v: 'all',   label: '전체',  cnt: stats.giverCnt + stats.takerCnt },
              { v: 'giver', label: 'Giver', cnt: stats.giverCnt },
              { v: 'taker', label: 'Taker', cnt: stats.takerCnt },
            ] as const).map(opt => (
              <button
                key={opt.v}
                onClick={() => setFilterType(opt.v)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                  filterType === opt.v ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {opt.label} <span className="opacity-70">({opt.cnt})</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
            <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">참가자 <b className="text-on-surface">{users.length}</b>명</span>
            <span className="px-2 py-0.5 rounded-md bg-surface-container-low border border-outline-variant/30">입력 참가자 <b className="text-on-surface">{stats.filledUsers}</b>명</span>
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || users.length === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          {downloading ? '내려받는 중...' : 'CSV 다운로드'}
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState reason="이 과정에 등록된 참가자가 없습니다." />
      ) : (
        <div className="rounded-2xl border border-outline-variant/20 bg-white shadow-sm overflow-x-auto overflow-y-visible">
          <table className="text-xs border-collapse w-full" style={{ minWidth: 1100 }}>
            <colgroup>
              <col style={{ width: 130 }} />{/* 회사 */}
              <col style={{ width: 130 }} />{/* 부서 */}
              <col style={{ width: 90 }}  />{/* 성명 */}
              <col style={{ width: 110 }} />{/* 직책 */}
              <col style={{ width: 70 }}  />{/* 구분 */}
              <col style={{ width: 150 }} />{/* 키워드 */}
              <col style={{ width: 420 }} />{/* 설명 */}
            </colgroup>
            <thead className="bg-surface-container-high sticky top-0 z-10">
              <tr>
                {['회사', '부서', '성명', '직책', '구분', '키워드', '설명'].map((h, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2.5 text-left font-black text-[10px] uppercase tracking-widest border-b border-outline-variant/30 whitespace-nowrap text-primary bg-primary/5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ user, giver, taker, total }, ui) => {
                const userRowBg = ui % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest';
                // 미입력 유저: 빈 1행 (필터 적용 시 해당 타입이 없는 유저도 동일 처리)
                if (total === 0) {
                  return (
                    <tr key={user.id} className={`${userRowBg} hover:bg-primary/5 transition-colors border-b-2 border-outline-variant/30`}>
                      <td className="px-3 py-2 align-top text-on-surface whitespace-nowrap">{user.company || <Dash />}</td>
                      <td className="px-3 py-2 align-top text-on-surface-variant whitespace-nowrap">{user.department || <Dash />}</td>
                      <td className="px-3 py-2 align-top font-bold text-on-surface whitespace-nowrap">{user.name || <Dash />}</td>
                      <td className="px-3 py-2 align-top text-on-surface-variant whitespace-nowrap">{user.title || <Dash />}</td>
                      <td colSpan={3} className="px-3 py-2 align-top text-on-surface-variant/40 italic">
                        — {filterType === 'giver' ? 'Giver' : filterType === 'taker' ? 'Taker' : '관심사'} 미입력 —
                      </td>
                    </tr>
                  );
                }
                // 입력 있음: rowSpan 으로 유저 정보 4칸 병합 후 각 관심사 1행씩.
                const items: { type: 'Giver' | 'Taker'; it: Interest }[] = [
                  ...giver.map(g => ({ type: 'Giver' as const, it: g })),
                  ...taker.map(t => ({ type: 'Taker' as const, it: t })),
                ];
                return items.map(({ type, it }, ii) => {
                  const isFirst = ii === 0;
                  const isLast = ii === items.length - 1;
                  return (
                    <tr
                      key={`${user.id}-${it.id}`}
                      className={`${userRowBg} hover:bg-primary/5 transition-colors ${isLast ? 'border-b-2 border-outline-variant/30' : ''}`}
                    >
                      {isFirst && (
                        <>
                          <td rowSpan={items.length} className="px-3 py-2 align-top border-r border-outline-variant/15 text-on-surface whitespace-nowrap">{user.company || <Dash />}</td>
                          <td rowSpan={items.length} className="px-3 py-2 align-top border-r border-outline-variant/15 text-on-surface-variant whitespace-nowrap">{user.department || <Dash />}</td>
                          <td rowSpan={items.length} className="px-3 py-2 align-top border-r border-outline-variant/15 font-bold text-on-surface whitespace-nowrap">{user.name || <Dash />}</td>
                          <td rowSpan={items.length} className="px-3 py-2 align-top border-r border-outline-variant/15 text-on-surface-variant whitespace-nowrap">{user.title || <Dash />}</td>
                        </>
                      )}
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                          type === 'Giver' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary/10 text-secondary border border-secondary/20'
                        }`}>
                          <span className="material-symbols-outlined text-[11px]">
                            {type === 'Giver' ? 'volunteer_activism' : 'pan_tool'}
                          </span>
                          {type}
                        </span>
                      </td>
                      <td className={`px-3 py-2 align-top font-bold whitespace-pre-wrap break-words ${type === 'Giver' ? 'text-primary' : 'text-secondary'}`}>
                        #{it.keyword}
                      </td>
                      <td className="px-3 py-2 align-top text-on-surface-variant whitespace-pre-wrap break-words">
                        {it.description || <Dash />}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Dash() {
  return <span className="text-on-surface-variant/30">—</span>;
}

// ─── 빈 상태 ────────────────────────────────────────────────────────────────
function EmptyState({ reason }: { reason: string }) {
  return (
    <div className="rounded-2xl bg-surface-container-low border border-outline-variant/20 p-12 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
      <span className="material-symbols-outlined text-4xl opacity-40">inbox</span>
      <p className="text-sm font-bold">{reason}</p>
    </div>
  );
}
