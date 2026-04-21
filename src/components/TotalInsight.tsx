import React, { useMemo, useState, useRef, useEffect, type ReactNode } from 'react';
import { useStore, User, UserInsight } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeInsights } from '../services/geminiService';

// ─── 팔레트 ───────────────────────────────────────────────────────────────────

const BUBBLE_PALETTE = [
  { light: ['#ff9a9e', '#ff6b9d', '#c44569'], dark: ['#c44569', '#8e2040', '#5a0e28'], text: '#fff' },
  { light: ['#ffecd2', '#fcb69f', '#e8825c'], dark: ['#e8825c', '#b85a38', '#7a3520'], text: '#fff' },
  { light: ['#a8edea', '#6ec6c4', '#3aafa9'], dark: ['#3aafa9', '#1f7a76', '#0d4f4c'], text: '#fff' },
  { light: ['#c2e9fb', '#81c8f5', '#4facde'], dark: ['#4facde', '#2778b0', '#0e4d80'], text: '#fff' },
  { light: ['#d4fc79', '#a8e063', '#6abf4b'], dark: ['#6abf4b', '#3e8c2a', '#205e14'], text: '#fff' },
  { light: ['#e0c3fc', '#c084fc', '#9333ea'], dark: ['#9333ea', '#6b21a8', '#4a0e7a'], text: '#fff' },
  { light: ['#fbc2eb', '#f472b6', '#db2777'], dark: ['#db2777', '#9d174d', '#6b0f35'], text: '#fff' },
  { light: ['#ffd89b', '#f9b95c', '#f09320'], dark: ['#f09320', '#b86a0a', '#7a4300'], text: '#fff' },
  { light: ['#a1c4fd', '#6fa3fb', '#3b82f6'], dark: ['#3b82f6', '#1d4ed8', '#1e3a8a'], text: '#fff' },
  { light: ['#84fab0', '#4dd98a', '#22c55e'], dark: ['#22c55e', '#15803d', '#0d5028'], text: '#fff' },
];

const AVATAR_BG = [
  ['#dbeafe', '#1d4ed8'], ['#fce7f3', '#be185d'], ['#d1fae5', '#065f46'],
  ['#fef3c7', '#92400e'], ['#ede9fe', '#5b21b6'], ['#fee2e2', '#991b1b'],
  ['#e0f2fe', '#0369a1'], ['#f0fdf4', '#166534'], ['#fff7ed', '#9a3412'],
  ['#f5f3ff', '#4c1d95'],
];

function avatarColors(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % AVATAR_BG.length;
  return { bg: AVATAR_BG[idx][0], text: AVATAR_BG[idx][1] };
}

// ─── 유저 아바타 ──────────────────────────────────────────────────────────────

function Avatar({ user, size = 40 }: { user?: User | null; size?: number }) {
  const colors = avatarColors(user?.id || 'x');
  const isUrl = (s?: string) => !!s && (s.startsWith('http') || s.startsWith('/'));
  const fontSize = size * 0.38;
  return (
    <div
      style={{ width: size, height: size, background: colors.bg, flexShrink: 0 }}
      className="rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm"
    >
      {isUrl(user?.profilePic) ? (
        <img src={user!.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : user?.profilePic && user.profilePic.length < 5 ? (
        <span style={{ fontSize: fontSize * 1.1 }}>{user.profilePic}</span>
      ) : (
        <span style={{ fontSize, color: colors.text, fontWeight: 900, lineHeight: 1 }}>
          {(user?.name || '?').charAt(0)}
        </span>
      )}
    </div>
  );
}

// ─── 유저 칩 ──────────────────────────────────────────────────────────────────

function UserChip({ user, sub }: { user?: User | null; sub?: string }) {
  const colors = avatarColors(user?.id || 'x');
  return (
    <div className="flex items-center gap-2">
      <Avatar user={user} size={32} />
      <div className="min-w-0">
        <p className="text-sm font-black text-on-surface leading-none">{user?.name || 'N/A'}</p>
        <p className="text-[10px] font-bold mt-0.5 leading-none" style={{ color: colors.text }}>
          {sub || user?.company || ''}
        </p>
      </div>
    </div>
  );
}

// ─── 버블 차트 ────────────────────────────────────────────────────────────────

interface BubbleItem { id: string; keyword: string; count: number; }

function BubbleChart({ items, selectedId, onSelect }: {
  items: BubbleItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(600);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const dragDist = useRef(0);
  const activePointers = useRef(new Set<number>());

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(5, Math.max(0.2, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1 || e.button !== 0) return;
    const pid = e.pointerId;
    setIsDragging(true);
    dragDist.current = 0;
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    const onMove = (me: PointerEvent) => {
      if (activePointers.current.size > 1) return;
      const dx = me.clientX - dragRef.current.x;
      const dy = me.clientY - dragRef.current.y;
      dragDist.current = Math.sqrt(dx * dx + dy * dy);
      setPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
    };
    const onUp = () => {
      activePointers.current.delete(pid);
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (dragDist.current > 5) { e.stopPropagation(); dragDist.current = 0; }
  };

  if (items.length === 0) return null;
  const maxCount = Math.max(...items.map(s => s.count));
  const minCount = Math.min(...items.map(s => s.count));
  const range = maxCount - minCount || 1;
  const maxSize = Math.min(containerWidth * 0.32, 180);
  const minSize = Math.max(containerWidth * 0.12, 64);

  const btnCls = 'w-8 h-8 rounded-full bg-white border border-outline/60 flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all text-on-surface-variant font-black text-lg';

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button onClick={() => setZoom(z => Math.max(0.2, z / 1.3))} className={btnCls} title="줌 아웃">−</button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="h-8 px-2.5 rounded-full bg-white border border-outline/60 flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all text-[10px] font-bold text-primary min-w-[48px]"
          title="줌 초기화"
        >{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(z => Math.min(5, z * 1.3))} className={btnCls} title="줌 인">+</button>
      </div>
      <div
        ref={outerRef}
        className="w-full min-h-[320px] sm:min-h-[420px] overflow-hidden relative"
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
      >
        <div
          ref={containerRef}
          style={{
            position: 'absolute', inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '50% 50%',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
            gap: '12px', padding: '16px',
          }}
        >
          {items.map((item, idx) => {
            const palette = BUBBLE_PALETTE[idx % BUBBLE_PALETTE.length];
            const t = (item.count - minCount) / range;
            const size = minSize + t * (maxSize - minSize);
            const isSelected = selectedId === item.id;
            const bg = isSelected
              ? `radial-gradient(circle at 38% 32%, ${palette.dark[0]} 0%, ${palette.dark[1]} 55%, ${palette.dark[2]} 100%)`
              : `radial-gradient(circle at 38% 32%, ${palette.light[0]} 0%, ${palette.light[1]} 45%, ${palette.light[2]} 100%)`;
            const shadow = isSelected
              ? `inset -3px -4px 10px rgba(0,0,0,0.3), inset 3px 3px 8px rgba(255,255,255,0.15), 4px 8px 20px rgba(0,0,0,0.4)`
              : `inset -3px -4px 10px rgba(0,0,0,0.1), inset 3px 3px 8px rgba(255,255,255,0.85), 4px 8px 20px rgba(0,0,0,0.2)`;
            const fontSize = Math.max(size * 0.085, 9);
            const countSize = Math.max(size * 0.065, 8);
            return (
              <motion.button
                key={item.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200, delay: idx * 0.04 }}
                onClick={() => onSelect(item.id)}
                style={{ width: size, height: size, background: bg, boxShadow: shadow, border: isSelected ? '2px solid rgba(255,255,255,0.2)' : `2px solid ${palette.light[1]}55`, flexShrink: 0 }}
                className={`rounded-full flex flex-col items-center justify-center transition-transform active:scale-95 ${isSelected ? 'scale-110 z-10' : 'hover:scale-105'}`}
              >
                <span style={{ fontSize: countSize, color: 'rgba(255,255,255,0.5)', fontWeight: 900, lineHeight: 1 }}>
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <span style={{ fontSize, color: palette.text, fontWeight: 900, lineHeight: 1.1, textAlign: 'center', padding: '0 12%', wordBreak: 'break-all' }}>
                  #{item.keyword}
                </span>
                <span style={{ fontSize: countSize, color: palette.text, fontWeight: 900, background: 'rgba(0,0,0,0.18)', borderRadius: 99, padding: '1px 6px', marginTop: 3 }}>
                  {item.count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 메달 배지 ────────────────────────────────────────────────────────────────

function MedalBadge({ rank }: { rank: number }) {
  const medals = [
    { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '🥇', shadow: '0 4px 14px rgba(245,158,11,0.5)' },
    { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', icon: '🥈', shadow: '0 4px 14px rgba(148,163,184,0.5)' },
    { bg: 'linear-gradient(135deg, #cd7c4c, #a65e32)', icon: '🥉', shadow: '0 4px 14px rgba(205,124,76,0.5)' },
  ];
  const m = medals[rank - 1] || medals[2];
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
      style={{ background: m.bg, boxShadow: m.shadow }}
    >
      {m.icon}
    </div>
  );
}

// ─── 유저 부제 헬퍼 ──────────────────────────────────────────────────────────

function userSubtitle(user?: User | null): string {
  if (!user) return '';
  return [user.company, user.department, user.title].filter(Boolean).join(' · ');
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/60 mb-1">
      {children}
    </p>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface TotalInsightProps { courseId: string; }

export default function TotalInsight({ courseId }: TotalInsightProps) {
  const { db, fetchData } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    const el = containerRef.current as any;
    if (!isFullScreen) {
      try {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch (e) {}
      setIsFullScreen(true);
    } else {
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      } catch (e) {}
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullScreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => { document.removeEventListener('fullscreenchange', handler); document.removeEventListener('webkitfullscreenchange', handler); };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await fetchData(); } finally { setIsRefreshing(false); }
  };

  const [selectedTopKeyword, setSelectedTopKeyword] = useState<string | null>(null);
  const [selectedKeywordForPopup, setSelectedKeywordForPopup] = useState<string | null>(null);
  const [selectedInterestKeyword, setSelectedInterestKeyword] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTeaTimeModalOpen, setIsTeaTimeModalOpen] = useState(false);
  const [isNetworkRevealed, setIsNetworkRevealed] = useState(false);
  const [isKeywordRevealed, setIsKeywordRevealed] = useState(false);
  const [selectedAnalysisView, setSelectedAnalysisView] = useState<'01' | '02'>('01');

  const courseUsers = useMemo(() => db.users.filter(u => u.courseId === courseId), [db.users, courseId]);
  const userIds = useMemo(() => new Set<string>(courseUsers.map(u => u.id)), [courseUsers]);

  const teaTimeStats = useMemo(() => {
    const courseRequests = db.teaTimeRequests.filter(r => userIds.has(r.fromUserId) || userIds.has(r.toUserId));
    const total = courseRequests.length;
    const accepted = courseRequests.filter(r => r.status === 'accepted').length;
    const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    return { total, accepted, rate };
  }, [db.teaTimeRequests, userIds]);

  const networkStats = useMemo(() => {
    const courseInterests = db.interests.filter(i => userIds.has(i.userId));
    const kwData: Record<string, { users: Set<string>; givers: Set<string>; takers: Set<string>; items: any[] }> = {};
    courseInterests.forEach(i => {
      const id = i.canonicalId || i.keyword;
      if (!kwData[id]) kwData[id] = { users: new Set(), givers: new Set(), takers: new Set(), items: [] };
      kwData[id].users.add(i.userId);
      kwData[id].items.push(i);
      if (i.type === 'giver') kwData[id].givers.add(i.userId);
      else kwData[id].takers.add(i.userId);
    });
    const top10 = Object.entries(kwData).map(([id, data]) => {
      const count = data.users.size;
      const givers = data.givers.size;
      const takers = data.takers.size;
      const term = db.canonicalTerms?.find(t => t.id === id);
      const giverRate = count > 0 ? Math.round((givers / count) * 100) : 0;
      return { id, keyword: term ? term.term : id, count, items: data.items, givers, takers, giverRate, takerRate: 100 - giverRate };
    }).sort((a, b) => b.count - a.count).slice(0, 10);

    const userKeywords: Record<string, Set<string>> = {};
    courseUsers.forEach(u => {
      userKeywords[u.id] = new Set(courseInterests.filter(i => i.userId === u.id).map(i => i.canonicalId || i.keyword));
    });
    const users = Array.from(userIds) as string[];
    const userPairs: { u1: string; u2: string; weight: number }[] = [];
    let totalDegree = 0;
    users.forEach((uId, i) => {
      let degree = 0;
      const myKws = userKeywords[uId];
      if (!myKws || myKws.size === 0) return;
      users.forEach((otherId, j) => {
        if (uId === otherId) return;
        const otherKws = userKeywords[otherId];
        if (!otherKws) return;
        const inter = Array.from(myKws).filter(kw => otherKws.has(kw));
        if (inter.length > 0) { degree += 1; if (i < j) userPairs.push({ u1: uId, u2: otherId, weight: inter.length }); }
      });
      totalDegree += degree;
    });
    const topPartners = userPairs.sort((a, b) => b.weight - a.weight).slice(0, 3).map(p => {
      const sharedKeywords = Array.from(userKeywords[p.u1]).filter(kw => userKeywords[p.u2].has(kw)).map(id => {
        const term = db.canonicalTerms?.find(t => t.id === id);
        return term ? term.term : id;
      });
      return { user1: db.users.find(u => u.id === p.u1), user2: db.users.find(u => u.id === p.u2), weight: p.weight, sharedKeywords };
    });
    const superKeyword = top10[0];
    const heavyUser = courseUsers.map(u => ({ user: u, count: userKeywords[u.id]?.size || 0 })).sort((a, b) => b.count - a.count)[0];
    const bridgeKeyword = Object.entries(kwData).map(([id, data]) => {
      const term = db.canonicalTerms?.find(t => t.id === id);
      const kwUsers = Array.from(new Set(data.items.map(i => i.userId)));
      if (kwUsers.length < 2) return { id, keyword: term ? term.term : id, score: 0 };
      let totalDist = 0, pairs = 0;
      for (let i = 0; i < kwUsers.length; i++) {
        for (let j = i + 1; j < kwUsers.length; j++) {
          const s1 = new Set(userKeywords[kwUsers[i]]); s1.delete(id);
          const s2 = new Set(userKeywords[kwUsers[j]]); s2.delete(id);
          const union = new Set([...s1, ...s2]);
          if (union.size === 0) continue;
          const inter = Array.from(s1).filter(k => s2.has(k));
          totalDist += 1 - inter.length / union.size; pairs++;
        }
      }
      return { id, keyword: term ? term.term : id, score: pairs > 0 ? totalDist / pairs : 0 };
    }).sort((a, b) => b.score - a.score)[0];
    return { top10, totalConnections: totalDegree, topPartners, superKeyword, heavyUser, bridgeKeyword };
  }, [db.interests, userIds, courseUsers, db.users, db.canonicalTerms]);

  const sessionStats = useMemo(() => {
    const courseSessions = db.sessions.filter(s => s.courseId === courseId);
    const sessionIds = new Set(courseSessions.map(s => s.id));
    const courseInsights = db.userInsights.filter(i => sessionIds.has(i.sessionId));
    const totalInsightCount = courseInsights.length;
    const groups: Record<string, { count: number; insights: any[]; repKeyword: string }> = {};
    courseInsights.forEach(i => {
      const id = i.canonicalId || i.keyword;
      if (!groups[id]) { const term = db.canonicalTerms?.find(t => t.id === id); groups[id] = { count: 0, insights: [], repKeyword: term ? term.term : i.keyword }; }
      groups[id].count += 1; groups[id].insights.push(i);
    });
    const sorted = Object.entries(groups).map(([id, data]) => {
      const topInsights = data.insights.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)).slice(0, 2);
      const descriptions = data.insights.map(i => i.description).filter(d => d && d.length > 5);
      let coreInsight = descriptions.length > 0
        ? `${data.repKeyword} 키워드에서 학습자분들은 공통적으로 ${descriptions[0].split('.')[0]} 등의 인사이트를 얻으신 것으로 파악됩니다.${descriptions.length > 1 ? ` 또한, ${descriptions[1].split('.')[0]}라는 새로운 시각의 의견도 있었습니다.` : ''}`
        : `${data.repKeyword} 관련 핵심 인사이트가 집계 중입니다.`;
      return { id, keyword: data.repKeyword, count: data.count, coreInsight, topInsights };
    }).sort((a, b) => b.count - a.count).slice(0, 10);
    const sessionCounts = courseSessions.map(s => ({ name: s.name, instructor: s.instructor || 'N/A', count: courseInsights.filter(i => i.sessionId === s.id).length })).filter(s => s.count > 0);
    const bestComments = [...courseInsights].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)).slice(0, 3).map(c => {
      const user = db.users.find(u => u.id === c.userId);
      return { ...c, user, userName: user?.name || 'Anonymous', userCompany: user?.company || 'N/A', userDept: user?.department || 'N/A', userTitle: user?.title || 'Leader' };
    });
    return { top10: sorted, totalInsightCount, sessionCounts, bestComments };
  }, [db.sessions, db.userInsights, db.canonicalTerms, courseId, db.users]);

  useEffect(() => {
    const run = async () => {
      if (selectedAnalysisView !== '02' || isSummarizing) return;
      const top3 = sessionStats.top10.slice(0, 3);
      const toSummarize = top3.filter(item => !aiSummaries[item.id]);
      if (toSummarize.length === 0) return;
      setIsSummarizing(true);
      const newSummaries = { ...aiSummaries };
      for (const item of toSummarize) {
        newSummaries[item.id] = await summarizeInsights(item.keyword, item.topInsights.map((i: any) => i.description));
      }
      setAiSummaries(newSummaries);
      setIsSummarizing(false);
    };
    run();
  }, [selectedAnalysisView, sessionStats.top10]);

  const selectedInterestKeywordData = useMemo(() => networkStats.top10.find(k => k.id === selectedInterestKeyword), [networkStats.top10, selectedInterestKeyword]);
  const selectedKeywordForPopupData = useMemo(() => selectedKeywordForPopup ? sessionStats.top10.find(k => k.id === selectedKeywordForPopup) : null, [sessionStats.top10, selectedKeywordForPopup]);

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`${isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto' : 'relative p-10 min-h-full'} bg-[#f8f9fc] text-on-surface font-sans selection:bg-primary selection:text-white`}
    >
      {/* 액션 버튼 */}
      <div className={`absolute ${isFullScreen ? 'top-4 right-4' : 'top-8 right-10'} z-50 flex gap-2`}>
        <button onClick={toggleFullScreen} className="w-10 h-10 rounded-xl bg-white border border-outline/50 flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all text-primary" title={isFullScreen ? '전체화면 나가기' : '전체화면'}>
          <span className="material-symbols-outlined text-xl">{isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
        <button onClick={handleRefresh} disabled={isRefreshing} className={`w-10 h-10 rounded-xl bg-white border border-outline/50 flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`} title="새로고침">
          <span className="material-symbols-outlined text-primary text-xl">refresh</span>
        </button>
      </div>

      {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
      <header className="mb-16">
        <div className="flex items-end justify-between border-b-4 border-primary pb-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/50 mb-3">Hyundai Motor Group · Data Intelligence</p>
            <h1 className="font-black uppercase tracking-tighter leading-none text-primary" style={{ fontSize: 'clamp(3rem,8vw,6rem)' }}>
              Total<br/><span className="text-on-surface">Insight</span>
            </h1>
          </div>
          <div className="text-right pb-1">
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant/50">Course ID</p>
            <p className="text-2xl font-black text-on-surface tracking-tight">{courseId}</p>
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase mt-1">Analysis Report</p>
          </div>
        </div>

        {/* KPI 요약 */}
        <div className="grid grid-cols-3 gap-5 mt-8">
          {[
            { icon: 'group', label: '참여 리더', value: `${courseUsers.length}명`, color: '#3b82f6' },
            { icon: 'coffee', label: '티타임 요청', value: `${teaTimeStats.total}회`, color: '#8b5cf6' },
            { icon: 'lightbulb', label: '등록 인사이트', value: `${sessionStats.totalInsightCount}개`, color: '#10b981' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-2xl p-5 border border-outline/30 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${kpi.color}18` }}>
                <span className="material-symbols-outlined text-xl" style={{ color: kpi.color, fontVariationSettings: "'FILL' 1" }}>{kpi.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">{kpi.label}</p>
                <p className="text-2xl font-black leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* ── 탭 ──────────────────────────────────────────────────────────── */}
      <div className="mb-10 flex gap-3">
        {(['01', '02'] as const).map(v => (
          <button
            key={v}
            onClick={() => setSelectedAnalysisView(v)}
            className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all border ${
              selectedAnalysisView === v
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-white text-on-surface-variant border-outline/40 hover:border-primary/40'
            }`}
          >
            {v === '01' ? '01. Social Network Analysis' : '02. Learning Insight'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 01. NETWORK ANALYSIS */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {selectedAnalysisView === '01' && (
        <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* 섹션 타이틀 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-10 bg-primary rounded-full" />
              <h2 className="text-3xl font-black uppercase tracking-tight text-on-surface">01. Social Network Analysis</h2>
            </div>
            {!isNetworkRevealed && (
              <button onClick={() => setIsNetworkRevealed(true)} className="px-6 py-2.5 bg-primary text-white text-sm font-black uppercase tracking-widest rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">lock_open</span> Reveal Data
              </button>
            )}
          </div>

          {/* 티타임 KPI 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 요청 수 */}
            <div className="bg-white rounded-2xl p-7 border border-outline/30 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/5 -translate-y-8 translate-x-8" />
              <SectionLabel>티타임 요청 현황</SectionLabel>
              <div className="flex items-end gap-3 mt-2">
                <span className="font-black tabular-nums text-primary leading-none" style={{ fontSize: 'clamp(3rem,8vw,5rem)' }}>{teaTimeStats.total}</span>
                <span className="text-xl font-bold text-on-surface-variant mb-2">건</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-2 font-medium">과정 내 리더 간 총 티타임 요청 횟수</p>
            </div>

            {/* 수락률 */}
            <button onClick={() => setIsTeaTimeModalOpen(true)} className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-7 shadow-lg shadow-primary/25 text-left hover:scale-[1.01] transition-transform overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
              <SectionLabel><span className="text-white/60">티타임 수락률</span></SectionLabel>
              <div className="flex items-end gap-3 mt-2">
                <span className="font-black tabular-nums text-white leading-none" style={{ fontSize: 'clamp(3rem,8vw,5rem)' }}>{teaTimeStats.rate}%</span>
                <span className="text-white/70 text-lg font-bold mb-2">({teaTimeStats.accepted}회)</span>
              </div>
              <p className="text-white/60 text-xs mt-2 font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs">open_in_new</span>상세 내역 보기
              </p>
            </button>
          </div>

          {/* 01-1 연결강도 */}
          <div className="bg-white rounded-2xl border border-outline/30 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-outline/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
                </div>
                <div>
                  <p className="text-base font-black uppercase tracking-tight text-on-surface">01-1. 연결강도 분석</p>
                  <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">Top 3 Partners by Shared Keywords</p>
                </div>
              </div>
            </div>
            <div className="px-8 py-4 bg-secondary/5 border-b border-outline/10">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                연결강도는 두 리더가 공유하는 관심 키워드 수를 의미합니다. 공통 관심사가 많을수록 협업 및 지식 공유 가능성이 높은 최적 파트너입니다.
              </p>
            </div>
            <div className="divide-y divide-outline/20">
              {networkStats.topPartners.length === 0 ? (
                <div className="p-10 text-center text-on-surface-variant/50 italic text-sm">분석 가능한 연결 데이터가 부족합니다.</div>
              ) : networkStats.topPartners.map((pair, idx) => (
                <div key={idx} className="p-6 hover:bg-surface-container-lowest/50 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-primary">0{idx + 1}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <UserChip user={pair.user1} sub={userSubtitle(pair.user1)} />
                      <div className="flex flex-col items-center gap-1 px-3">
                        <div className="flex items-center gap-1">
                          {[...Array(Math.min(pair.weight, 6))].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-secondary" />
                          ))}
                        </div>
                        <span className="text-[9px] font-black text-secondary uppercase tracking-widest">{pair.weight} KW</span>
                      </div>
                      <UserChip user={pair.user2} sub={userSubtitle(pair.user2)} />
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {pair.sharedKeywords.slice(0, 4).map((kw, ki) => (
                        <span key={ki} className="text-[9px] font-black text-secondary bg-secondary/8 px-2 py-0.5 rounded border border-secondary/20">#{kw}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 01-2 중심성 분석 */}
          <div className="bg-white rounded-2xl border border-outline/30 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-outline/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
              </div>
              <div>
                <p className="text-base font-black uppercase tracking-tight text-on-surface">01-2. 중심성 분석</p>
                <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest">Centrality Analysis</p>
              </div>
            </div>
            <div className="px-8 py-4 bg-primary/5 border-b border-outline/10">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                네트워크 내에서 특정 키워드나 유저가 가지는 영향력을 측정합니다. 전체 흐름을 주도하고 연결하는 핵심 요소를 파악합니다.
              </p>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Super Keyword */}
              <div className="rounded-2xl p-6 border-2 border-primary/20 bg-primary/5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Super Keyword</p>
                </div>
                <p className="text-2xl font-black text-primary leading-tight">#{networkStats.superKeyword?.keyword || 'N/A'}</p>
                <div className="flex items-center gap-2 text-[10px] text-on-surface-variant font-bold">
                  <span className="material-symbols-outlined text-xs">people</span>
                  {networkStats.superKeyword?.count || 0}명 선택
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  가장 많은 리더들이 선택한 핵심 관심사로, 조직 내 지식 공유의 가장 큰 접점입니다.
                </p>
              </div>
              {/* Heavy User */}
              <div className="rounded-2xl p-6 border-2 border-secondary/20 bg-secondary/5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>social_leaderboard</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Heavy User</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <Avatar user={networkStats.heavyUser?.user} size={48} />
                  <div>
                    <p className="text-xl font-black text-on-surface leading-tight">{networkStats.heavyUser?.user.name || 'N/A'}</p>
                    <p className="text-[10px] text-on-surface-variant font-bold leading-snug">{userSubtitle(networkStats.heavyUser?.user)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-secondary font-bold">
                  <span className="material-symbols-outlined text-xs">tag</span>
                  관심사 {networkStats.heavyUser?.count || 0}개 보유
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  가장 넓은 관심사를 보유한 네트워크 확장의 핵심 리더입니다.
                </p>
              </div>
              {/* Bridge Keyword */}
              <div className="rounded-2xl p-6 border-2 border-outline/30 bg-surface-container-lowest space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-base" style={{ fontVariationSettings: "'FILL' 1" }}>device_hub</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Bridge Keyword</p>
                </div>
                <p className="text-2xl font-black text-on-surface leading-tight">#{networkStats.bridgeKeyword?.keyword || 'N/A'}</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  서로 다른 관심사 그룹을 이어주는 매개체입니다. 이 키워드로 세미나를 개최하면 이질적인 그룹 간 자연스러운 융합이 가능합니다.
                </p>
              </div>
            </div>
          </div>

          {/* Top 10 Interest Keywords */}
          <div className="bg-white rounded-2xl border border-outline/30 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-outline/20 flex items-center justify-between">
              <div>
                <p className="text-xl font-black uppercase tracking-tight text-on-surface">HOT KEYWORD 10</p>
                <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest mt-0.5">Giver / Taker Ratio</p>
              </div>
              {isNetworkRevealed && <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full">클릭하면 상세 보기</span>}
            </div>
            <div className={`transition-all duration-1000 ${!isNetworkRevealed ? 'blur-2xl grayscale opacity-10 pointer-events-none' : ''}`}>
              {(() => {
                const rankIcons: Record<number, string> = {
                  1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣',
                  6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 10: '🔟',
                };
                const ranks: number[] = [];
                let rank = 1;
                for (let i = 0; i < networkStats.top10.length; i++) {
                  if (i > 0 && networkStats.top10[i].count < networkStats.top10[i - 1].count) rank = i + 1;
                  ranks.push(rank);
                }
                return networkStats.top10.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedInterestKeyword(item.id)}
                    className="w-full flex items-center gap-5 px-6 py-4 border-b border-outline/20 last:border-b-0 hover:bg-surface-container-lowest/60 transition-colors text-left group"
                  >
                    <span className="text-xl shrink-0">{rankIcons[ranks[idx]] ?? `${ranks[idx]}위`}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-black text-on-surface group-hover:text-primary transition-colors truncate">#{item.keyword}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-2 bg-outline/20 rounded-full overflow-hidden flex">
                          <div className="bg-primary h-full transition-all" style={{ width: `${item.giverRate}%` }} />
                          <div className="bg-secondary h-full transition-all" style={{ width: `${item.takerRate}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-primary shrink-0">Giver {item.giverRate}%</span>
                        <span className="text-[10px] font-bold text-secondary shrink-0">Taker {item.takerRate}%</span>
                      </div>
                    </div>
                    <span className="text-lg font-black tabular-nums text-primary shrink-0">{item.count}<span className="text-sm font-bold text-on-surface-variant ml-0.5">명</span></span>
                  </button>
                ));
              })()}
            </div>
            {!isNetworkRevealed && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/70 backdrop-blur-sm rounded-2xl">
                <button onClick={() => setIsNetworkRevealed(true)} className="px-10 py-4 bg-primary text-white font-black uppercase tracking-widest rounded-xl shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined">lock_open</span> Unlock 01
                </button>
              </div>
            )}
          </div>

        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 02. LEARNING INSIGHT */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {selectedAnalysisView === '02' && (
        <section className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* 섹션 타이틀 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-10 bg-secondary rounded-full" />
              <h2 className="text-3xl font-black uppercase tracking-tight text-on-surface">02. Learning Insight</h2>
            </div>
            {!isKeywordRevealed && (
              <button onClick={() => setIsKeywordRevealed(true)} className="px-6 py-2.5 bg-secondary text-on-secondary text-sm font-black uppercase tracking-widest rounded-xl hover:bg-secondary/90 transition-all shadow-md flex items-center gap-2">
                <span className="material-symbols-outlined text-base">lock_open</span> Reveal Data
              </button>
            )}
          </div>

          {/* 총 인사이트 히어로 */}
          <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 60%, #06b6d4 100%)' }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)' }} />
            <div className="px-10 py-10 flex items-center gap-8 relative z-10">
              <div className="w-24 h-24 bg-white/15 rounded-3xl flex flex-col items-center justify-center border border-white/20 shrink-0">
                <span className="text-4xl font-black text-white tabular-nums leading-none">{sessionStats.totalInsightCount}</span>
                <span className="text-[10px] text-white/70 font-bold uppercase mt-1">Insights</span>
              </div>
              <div>
                <p className="text-2xl font-black text-white leading-snug">
                  현재 과정에서 총 <span className="text-yellow-300">{sessionStats.totalInsightCount}개</span>의<br/>소중한 인사이트가 기록됐습니다.
                </p>
                <p className="text-sm text-white/60 font-bold uppercase tracking-widest mt-2">Classroom Insight Statistics</p>
              </div>
            </div>
          </div>

          {/* 세션별 분포 */}
          {sessionStats.sessionCounts.length > 0 && (
            <div className="bg-white rounded-2xl border border-outline/30 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-7">
                <div className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bar_chart</span>
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-on-surface">Session-wise Insight Distribution</p>
              </div>
              <div className="space-y-5">
                {sessionStats.sessionCounts.map((session, idx) => {
                  const maxCount = Math.max(...sessionStats.sessionCounts.map(s => s.count));
                  const pct = (session.count / maxCount) * 100;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-baseline mb-2">
                        <div>
                          <p className="text-sm font-black text-on-surface">{session.name}</p>
                          <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest">Instructor: {session.instructor}</p>
                        </div>
                        <span className="text-sm font-black text-secondary tabular-nums">{session.count}</span>
                      </div>
                      <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.08, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, #3b82f6, #06b6d4)` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 버블 차트 */}
          <div className="bg-white rounded-2xl border border-outline/30 shadow-sm overflow-hidden relative">
            <div className="px-8 py-5 border-b border-outline/20 flex items-center justify-between">
              <div>
                <p className="text-xl font-black uppercase tracking-tight text-on-surface">Integrated Keywords</p>
                <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest mt-0.5">버블 클릭 시 상세 인사이트 확인</p>
              </div>
              {isKeywordRevealed && <span className="text-[10px] font-black bg-secondary/10 text-secondary px-3 py-1 rounded-full">버블 크기 = 언급 빈도</span>}
            </div>
            <div className={`p-6 sm:p-10 transition-all duration-1000 ${!isKeywordRevealed ? 'blur-2xl grayscale opacity-10 pointer-events-none' : ''}`}>
              <BubbleChart items={sessionStats.top10} selectedId={selectedTopKeyword} onSelect={(id) => setSelectedKeywordForPopup(id)} />
            </div>
            {!isKeywordRevealed && (
              <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/70 backdrop-blur-sm">
                <button onClick={() => setIsKeywordRevealed(true)} className="px-10 py-4 bg-secondary text-on-secondary font-black uppercase tracking-widest rounded-xl shadow-xl hover:bg-secondary/90 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined">lock_open</span> Unlock 02
                </button>
              </div>
            )}
          </div>

          {/* Top 3 Key Insights */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 bg-primary rounded-full" />
              <h3 className="text-xl font-black uppercase tracking-widest text-on-surface">Top 03 Key Insights</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sessionStats.top10.slice(0, 3).map((item, idx) => (
                <div key={item.keyword} className="bg-white rounded-2xl border border-outline/30 shadow-sm overflow-hidden flex flex-col">
                  {/* 카드 헤더 */}
                  <div className="px-6 py-5 border-b border-outline/20 flex items-center gap-3">
                    <MedalBadge rank={idx + 1} />
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-black text-on-surface truncate">#{item.keyword}</p>
                      <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">{item.count} Opinions</span>
                    </div>
                  </div>
                  {/* AI 요약 */}
                  <div className="px-6 py-4 bg-primary/5 border-b border-outline/10 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span> AI 핵심 요약
                    </p>
                    <p className="text-sm font-bold text-on-surface leading-relaxed">
                      {aiSummaries[item.id] || 'AI가 인사이트를 분석 중입니다...'}
                    </p>
                  </div>
                  {/* 인사이트 */}
                  <div className="px-6 py-4 space-y-4">
                    {item.topInsights.map((insight: any, iIdx: number) => {
                      const user = db.users.find(u => u.id === insight.userId);
                      return (
                        <div key={insight.id} className="flex gap-3">
                          <Avatar user={user} size={34} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-1 mb-1">
                              <p className="text-xs font-black text-on-surface truncate">{user?.name || 'Anonymous'}</p>
                              <div className="flex items-center gap-0.5 text-secondary shrink-0">
                                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                <span className="text-xs font-bold">{insight.likes?.length || 0}</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-on-surface-variant mb-1.5">{userSubtitle(user)}</p>
                            <p className="text-sm font-medium text-on-surface leading-relaxed italic line-clamp-3">"{insight.description}"</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Best Comments */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-outline/40" />
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-outline/30 shadow-sm">
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Best Comments</h3>
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-outline/40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sessionStats.bestComments.map((comment: any, idx: number) => (
                <div key={idx} className="bg-white rounded-2xl border border-outline/30 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all p-7 flex flex-col gap-5 relative overflow-hidden">
                  <div className="absolute top-4 right-6 text-7xl font-serif text-primary/6 select-none leading-none">"</div>
                  <span className="text-[10px] font-black bg-secondary/10 text-secondary px-3 py-1 rounded-full self-start">#{comment.keyword}</span>
                  <p className="text-base font-bold text-on-surface leading-relaxed italic flex-1">
                    "{comment.description}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-outline/20">
                    <Avatar user={comment.user} size={38} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-on-surface leading-tight truncate">{comment.userName}</p>
                      <p className="text-[10px] text-on-surface-variant/70 font-bold truncate">{userSubtitle(comment.user)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-secondary shrink-0">
                      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                      <span className="text-base font-black tabular-nums">{comment.likes?.length || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
              {sessionStats.bestComments.length === 0 && (
                <div className="md:col-span-3 py-16 text-center text-on-surface-variant/50 italic text-sm bg-white rounded-2xl border border-dashed border-outline/40">
                  등록된 인사이트가 없습니다.
                </div>
              )}
            </div>
          </div>

        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 모달: 티타임 현황 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isTeaTimeModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-8 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsTeaTimeModalOpen(false)}
          >
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-8 py-6 border-b border-outline/20 flex items-start justify-between bg-gradient-to-r from-primary/5 to-transparent">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Tea Time History</p>
                  <h2 className="text-2xl font-black text-on-surface">티타임 매칭 현황</h2>
                  <p className="text-sm text-on-surface-variant mt-1">수락이 완료된 티타임 내역입니다.</p>
                </div>
                <button onClick={() => setIsTeaTimeModalOpen(false)} className="w-9 h-9 rounded-xl hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant transition-colors">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {db.teaTimeRequests.filter(r => (userIds.has(r.fromUserId) || userIds.has(r.toUserId)) && r.status === 'accepted').length === 0 ? (
                  <div className="py-16 text-center text-on-surface-variant/50 italic text-sm bg-surface-container-low rounded-2xl">아직 수락된 티타임 내역이 없습니다.</div>
                ) : db.teaTimeRequests.filter(r => (userIds.has(r.fromUserId) || userIds.has(r.toUserId)) && r.status === 'accepted').sort((a, b) => b.id.localeCompare(a.id)).map(req => {
                  const fromUser = db.users.find(u => u.id === req.fromUserId);
                  const toUser = db.users.find(u => u.id === req.toUserId);
                  return (
                    <div key={req.id} className="bg-surface-container-low rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-4">
                        <UserChip user={fromUser} sub={userSubtitle(fromUser)} />
                        <div className="flex-1 flex items-center justify-center gap-2">
                          <div className="flex-1 h-px bg-outline/30" />
                          <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
                          <div className="flex-1 h-px bg-outline/30" />
                        </div>
                        <UserChip user={toUser} sub={userSubtitle(toUser)} />
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 border border-green-500/25 shrink-0">accepted</span>
                      </div>
                      {req.message && (
                        <div className="bg-white rounded-xl px-4 py-3 border border-outline/20">
                          <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5">메시지</p>
                          <p className="text-sm text-on-surface italic leading-relaxed">"{req.message}"</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-8 py-4 border-t border-outline/20 bg-primary/5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">HMG · Tea Time History</p>
                <p className="text-[10px] font-black text-primary">총 {db.teaTimeRequests.filter(r => (userIds.has(r.fromUserId) || userIds.has(r.toUserId)) && r.status === 'accepted').length}건</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 모달: 인사이트 키워드 상세 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedKeywordForPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-8 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedKeywordForPopup(null)}
          >
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-8 py-6 border-b border-outline/20 flex items-start justify-between bg-gradient-to-r from-secondary/5 to-transparent">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary/60 mb-1">Learning Insight · Keyword Detail</p>
                  <h2 className="text-2xl font-black text-on-surface">#{selectedKeywordForPopupData?.keyword}</h2>
                  <p className="text-sm text-on-surface-variant mt-1">리더분들이 남겨주신 모든 의견입니다.</p>
                </div>
                <button onClick={() => setSelectedKeywordForPopup(null)} className="w-9 h-9 rounded-xl hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {db.userInsights.filter(i => (i.canonicalId || i.keyword) === selectedKeywordForPopup).map((insight, idx) => {
                  const user = db.users.find(u => u.id === insight.userId);
                  return (
                    <div key={idx} className="bg-surface-container-low rounded-2xl p-5 flex gap-4">
                      <Avatar user={user} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <div>
                            <span className="text-sm font-black text-on-surface">{user?.name || 'Anonymous'}</span>
                            <span className="text-[10px] text-on-surface-variant ml-2">{userSubtitle(user)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-secondary shrink-0">
                            <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                            <span className="text-xs font-bold">{insight.likes?.length || 0}</span>
                          </div>
                        </div>
                        <p className="text-sm text-on-surface leading-relaxed italic">"{insight.description}"</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-8 py-4 border-t border-outline/20 bg-secondary/5 flex justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">HMG · Integrated Keywords</p>
                <p className="text-[10px] font-black text-secondary">총 {db.userInsights.filter(i => (i.canonicalId || i.keyword) === selectedKeywordForPopup).length}개 의견</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* 모달: 관심사 키워드 상세 */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedInterestKeyword && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-8 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedInterestKeyword(null)}
          >
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-white w-full sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col rounded-t-3xl sm:rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-8 py-6 border-b border-outline/20 flex items-start justify-between bg-gradient-to-r from-primary/5 to-transparent">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Keyword Detail · Network Analysis</p>
                  <h2 className="text-2xl font-black text-on-surface">#{selectedInterestKeywordData?.keyword}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full">Giver {selectedInterestKeywordData?.giverRate}%</span>
                    <span className="text-[10px] font-black bg-secondary/10 text-secondary px-2.5 py-1 rounded-full">Taker {selectedInterestKeywordData?.takerRate}%</span>
                    <span className="text-[10px] font-black text-on-surface-variant">{selectedInterestKeywordData?.count}명</span>
                  </div>
                </div>
                <button onClick={() => setSelectedInterestKeyword(null)} className="w-9 h-9 rounded-xl hover:bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {selectedInterestKeywordData?.items.map((interest: any, idx: number) => {
                  const user = db.users.find(u => u.id === interest.userId);
                  return (
                    <div key={idx} className="bg-surface-container-low rounded-2xl p-5 flex gap-4">
                      <Avatar user={user} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                          <div>
                            <span className="text-sm font-black text-on-surface">{user?.name || 'Anonymous'}</span>
                            <span className="text-[10px] text-on-surface-variant ml-2">{userSubtitle(user)}</span>
                          </div>
                          <span className={`text-[9px] font-black px-2.5 py-1 rounded-full shrink-0 ${interest.type === 'giver' ? 'bg-primary text-white' : 'bg-secondary text-on-secondary'}`}>
                            {interest.type === 'giver' ? '🙋 Giver' : '🤲 Taker'}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface leading-relaxed">{interest.description || '설명이 없습니다.'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-8 py-4 border-t border-outline/20 bg-primary/5 flex justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/50">HMG · Interest Keyword</p>
                <p className="text-[10px] font-black text-primary">총 {selectedInterestKeywordData?.count || 0}개 항목</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
