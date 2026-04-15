import React, { useState, useMemo, useRef, useEffect, CSSProperties } from 'react';
import { useStore, UserInsight } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import NotificationBell from './NotificationBell';
import * as d3 from 'd3';

interface InsightViewProps {
  onBack?: () => void;
  onLogout?: () => void;
  onProfileClick?: () => void;
  onNotificationClick?: () => void;
  adminCourseId?: string;
}

export default function InsightView({ onBack, onLogout, onProfileClick, onNotificationClick, adminCourseId }: InsightViewProps) {
  const { currentUser, db, saveUserInsight, toggleInsightLike, fetchData } = useStore();
  const effectiveCourseId = adminCourseId || currentUser?.courseId;

  const [activeTab, setActiveTab] = useState<'my' | 'classroom'>(adminCourseId ? 'classroom' : 'my');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [classroomSessionId, setClassroomSessionId] = useState<string>(db.sessions.find(s => s.courseId === effectiveCourseId)?.id || '');

  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKeywordDetail, setSelectedKeywordDetail] = useState<string | null>(null);
  const [revealedBubbles, setRevealedBubbles] = useState<Record<string, Set<string>>>({});

  // Bubble chart simulation state
  const [bubblePositions, setBubblePositions] = useState<Record<string, {x: number, y: number, r: number}>>({});
  const [isBubbleFullScreen, setIsBubbleFullScreen] = useState(false);
  // useRef 대신 state 콜백 ref 사용:
  // AnimatePresence mode="wait" 때문에 activeTab 변경 시점에는 아직 DOM에 없음.
  // 요소가 실제로 마운트/언마운트될 때 state가 변경되어 useEffect를 재트리거.
  const [bubbleContainerEl, setBubbleContainerEl] = useState<HTMLDivElement | null>(null);
  const bubbleWrapRef = useRef<HTMLDivElement>(null);

  // Zoom / Pan state
  const [bubbleZoom, setBubbleZoom] = useState(1);
  const [bubblePan, setBubblePan]   = useState({ x: 0, y: 0 });
  const [isRefreshing, setIsRefreshing]       = useState(false);
  const [isBubbleDragging, setIsBubbleDragging] = useState(false);
  const bubbleDragRef   = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const bubbleDragDist  = useRef(0);
  const activePointers  = useRef(new Set<number>());

  const activeSessions = db.sessions.filter(s => s.courseId === effectiveCourseId && s.isActive);
  const userInsights = (db.userInsights || []).filter(i => i.userId === currentUser?.id);

  // Prevent duplicate: reuse existing insight ID if one exists for this session
  const handleSaveInsight = (sessionId: string) => {
    if (!keyword.trim() || !description.trim()) {
      alert('키워드와 설명을 모두 입력해주세요.');
      return;
    }

    const existing = userInsights.find(i => i.sessionId === sessionId);
    const insight: UserInsight = {
      id: existing ? existing.id : Date.now().toString(),
      userId: currentUser!.id,
      sessionId,
      keyword,
      description,
      likes: existing?.likes || []
    };

    saveUserInsight(insight);
    setSelectedSessionId(null);
    setKeyword('');
    setDescription('');
  };

  const startInput = (sessionId: string) => {
    const existing = userInsights.find(i => i.sessionId === sessionId);
    if (existing) {
      setKeyword(existing.keyword);
      setDescription(existing.description);
    } else {
      setKeyword('');
      setDescription('');
    }
    setSelectedSessionId(sessionId);
  };

  // Class Room Logic: Grouping and Frequency
  const classroomData = useMemo(() => {
    if (!classroomSessionId) return [];
    const sessionInsights = (db.userInsights || []).filter(i => i.sessionId === classroomSessionId);

    const groups: Record<string, { count: number, originalKeywords: string[], insights: UserInsight[] }> = {};

    sessionInsights.forEach(insight => {
      const repId = insight.canonicalId || insight.keyword;
      const term = db.canonicalTerms?.find(t => t.id === repId);
      const repName = term ? term.term : insight.keyword;

      if (!groups[repId]) {
        groups[repId] = { count: 0, originalKeywords: [], insights: [] };
      }
      groups[repId].count += 1;
      if (!groups[repId].originalKeywords.includes(insight.keyword)) {
        groups[repId].originalKeywords.push(insight.keyword);
      }
      groups[repId].insights.push(insight);
    });

    return Object.entries(groups).map(([id, data]) => {
      const term = db.canonicalTerms?.find(t => t.id === id);
      return {
        id,
        name: term ? term.term : id,
        ...data
      };
    }).sort((a, b) => b.count - a.count);
  }, [db.userInsights, db.canonicalTerms, classroomSessionId]);

  const maxCount = useMemo(() => Math.max(...classroomData.map(d => d.count), 1), [classroomData]);

  const aggregatedKeywords = useMemo(() => {
    if (!classroomSessionId) return [];
    const sessionInsights = (db.userInsights || []).filter(i => i.sessionId === classroomSessionId);
    const counts: Record<string, number> = {};
    sessionInsights.forEach(i => {
      const k = i.keyword.trim();
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count);
  }, [db.userInsights, classroomSessionId]);

  const bestComments = useMemo(() => {
    if (!classroomSessionId) return [];
    const sessionInsights = (db.userInsights || []).filter(i => i.sessionId === classroomSessionId);
    return [...sessionInsights]
      .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
      .slice(0, 3);
  }, [db.userInsights, classroomSessionId]);

  // 현대자동차그룹 브랜드 컬러 팔레트 (인덱스 기반 — 순서대로 다른 색상 보장)
  const HMG_COLORS = [
    '#002c5f', // HMC Navy
    '#c3001e', // HMC Red
    '#00aad2', // HMC Sky Blue
    '#b5944c', // Genesis Gold
    '#00797f', // Dark Teal (EV/Eco)
    '#596c7d', // Steel Blue-Gray
    '#bb162b', // Kia Red
    '#0064d2', // Ioniq Blue
    '#3d4757', // Dark Slate
    '#c8723a', // Warm Amber
    '#1a6faf', // Mid Blue
    '#7a4f7d', // Plum (Modern HMG)
  ];

  const getKeywordColor = (_str: string, index?: number) => {
    const idx = index !== undefined ? index : 0;
    return HMG_COLORS[idx % HMG_COLORS.length];
  };

  const getContrastColor = (hexcolor: string) => {
    if (hexcolor.startsWith('#')) {
      const r = parseInt(hexcolor.slice(1, 3), 16);
      const g = parseInt(hexcolor.slice(3, 5), 16);
      const b = parseInt(hexcolor.slice(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#1c1c1c' : 'white';
    }
    return 'white';
  };

  // 입체감 있는 버블 스타일 생성 (구체 효과)
  const get3DBubbleStyle = (hexColor: string): CSSProperties => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const lighter = `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)},0.85)`;
    const darker  = `rgb(${Math.max(0, r - 45)},${Math.max(0, g - 45)},${Math.max(0, b - 45)})`;
    return {
      background: `radial-gradient(circle at 33% 28%, ${lighter} 0%, ${hexColor} 48%, ${darker} 100%)`,
      boxShadow: `inset -4px -5px 14px rgba(0,0,0,0.38), inset 4px 4px 10px rgba(255,255,255,0.22), 0 8px 28px rgba(0,0,0,0.32)`,
    };
  };

  // ── D3 bubble force simulation ──────────────────────────────────────────────
  useEffect(() => {
    if (!classroomData.length || !bubbleContainerEl) return;

    let currentSim: d3.Simulation<any, any> | null = null;

    const runSimulation = (W: number, H: number) => {
      // 컨테이너 너비 기준으로 버블 반지름을 비례 조정 (기준: 500px)
      const scale    = Math.min(1, W / 500);
      const minR     = Math.max(16, Math.round(38 * scale));
      const maxExtra = Math.max(14, Math.round(58 * scale));

      if (currentSim) currentSim.stop();

      const nodes: any[] = classroomData.map(d => ({
        id: d.id,
        r: minR + (d.count / maxCount) * maxExtra,
        x: W / 2 + (Math.random() - 0.5) * 20,
        y: H / 2 + (Math.random() - 0.5) * 20,
      }));

      currentSim = d3.forceSimulation(nodes)
        .force('center', d3.forceCenter(W / 2, H / 2).strength(0.8))
        .force('collision', d3.forceCollide().radius((d: any) => d.r + 2).strength(1).iterations(6))
        .force('x', d3.forceX(W / 2).strength(0.06))
        .force('y', d3.forceY(H / 2).strength(0.06))
        .alphaDecay(0.015)
        .on('tick', () => {
          const pos: Record<string, { x: number; y: number; r: number }> = {};
          nodes.forEach((n: any) => { pos[n.id] = { x: n.x, y: n.y, r: n.r }; });
          setBubblePositions({ ...pos });
        });
    };

    // ResizeObserver가 초기 크기도 보고하므로 여기서 최초 실행 포함
    const ro = new ResizeObserver(entries => {
      const { width: W, height: H } = entries[0].contentRect;
      if (W > 0) runSimulation(W, H || 420);
    });
    ro.observe(bubbleContainerEl);

    return () => {
      currentSim?.stop();
      ro.disconnect();
    };
  }, [classroomData, classroomSessionId, maxCount, bubbleContainerEl]);

  // ── Bubble fullscreen ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setIsBubbleFullScreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  const toggleBubbleFullScreen = () => {
    const el = bubbleWrapRef.current as any;
    if (!isBubbleFullScreen) {
      try {
        if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch {}
    } else {
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      } catch {}
    }
  };

  // ── 세션 변경 시 zoom/pan 초기화 ─────────────────────────────────────────────
  useEffect(() => {
    setBubbleZoom(1);
    setBubblePan({ x: 0, y: 0 });
  }, [classroomSessionId]);

  // ── 마우스 휠 줌 (non-passive) ────────────────────────────────────────────────
  useEffect(() => {
    if (!bubbleContainerEl) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setBubbleZoom(z => Math.min(5, Math.max(0.2, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    bubbleContainerEl.addEventListener('wheel', onWheel, { passive: false });
    return () => bubbleContainerEl.removeEventListener('wheel', onWheel);
  }, [bubbleContainerEl]);

  // ── 터치 핀치 줌 (non-passive) ────────────────────────────────────────────────
  useEffect(() => {
    if (!bubbleContainerEl) return;
    let lastDist: number | null = null;
    const getTouchDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) lastDist = getTouchDist(e.touches);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || lastDist === null) return;
      e.preventDefault();
      const d = getTouchDist(e.touches);
      setBubbleZoom(z => Math.min(5, Math.max(0.2, z * (d / lastDist!))));
      lastDist = d;
    };
    const onTouchEnd = () => { lastDist = null; };
    bubbleContainerEl.addEventListener('touchstart', onTouchStart, { passive: false });
    bubbleContainerEl.addEventListener('touchmove',  onTouchMove,  { passive: false });
    bubbleContainerEl.addEventListener('touchend',   onTouchEnd);
    return () => {
      bubbleContainerEl.removeEventListener('touchstart', onTouchStart);
      bubbleContainerEl.removeEventListener('touchmove',  onTouchMove);
      bubbleContainerEl.removeEventListener('touchend',   onTouchEnd);
    };
  }, [bubbleContainerEl]);

  // ── 새로고침 ──────────────────────────────────────────────────────────────────
  const handleBubbleRefresh = async () => {
    setIsRefreshing(true);
    setBubblePositions({});
    try { await fetchData(); } finally { setIsRefreshing(false); }
  };

  // ── 드래그 (패닝) ─────────────────────────────────────────────────────────────
  // setPointerCapture 미사용: 캔버스가 포인터를 독점하면 버블 onClick에 도달 불가.
  // 대신 window 이벤트로 드래그 추적 → 버블 클릭은 정상 전파.
  const handleBubblePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1 || e.button !== 0) return;

    const pid = e.pointerId;
    setIsBubbleDragging(true);
    bubbleDragDist.current = 0;
    bubbleDragRef.current = { x: e.clientX, y: e.clientY, px: bubblePan.x, py: bubblePan.y };

    const onMove = (me: PointerEvent) => {
      if (activePointers.current.size > 1) return;
      const dx = me.clientX - bubbleDragRef.current.x;
      const dy = me.clientY - bubbleDragRef.current.y;
      bubbleDragDist.current = Math.sqrt(dx * dx + dy * dy);
      setBubblePan({ x: bubbleDragRef.current.px + dx, y: bubbleDragRef.current.py + dy });
    };
    const onUp = () => {
      activePointers.current.delete(pid);
      setIsBubbleDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // 드래그였으면 버블 클릭 무시 (캡처 단계에서 차단)
  const handleBubbleClickCapture = (e: React.MouseEvent) => {
    if (bubbleDragDist.current > 5) {
      e.stopPropagation();
      bubbleDragDist.current = 0;
    }
  };

  return (
    <div className="absolute inset-0 bg-background text-on-surface flex flex-col overflow-hidden">
      {/* Top Nav - Hidden in Admin Mode */}
      {!adminCourseId && (
        <header className="header-safe bg-white/80 backdrop-blur-xl border-b border-outline shadow-sm shrink-0 z-50">
          <div className="h-12 flex justify-between items-center px-4">
            <div className="flex items-center gap-2">
              <button onClick={() => onBack?.()} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant text-xl">arrow_back</span>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <NotificationBell onNotificationClick={onNotificationClick} />
              <button
                onClick={() => onProfileClick?.()}
                className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest flex items-center justify-center hover:scale-105 transition-transform"
                title="내 프로필"
              >
                {currentUser?.profilePic ? (
                  currentUser.profilePic.length < 5 ? (
                    <span className="text-sm">{currentUser.profilePic}</span>
                  ) : (
                    <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )
                ) : (
                  <span className="material-symbols-outlined text-xl text-secondary/40">face</span>
                )}
              </button>
              <div className="w-px h-3 bg-outline/30 mx-1" />
              <button
                onClick={() => onLogout?.()}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                title="로그아웃"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto px-4 sm:px-6 mx-auto transition-all ${adminCourseId ? 'max-w-none pt-8 pb-[env(safe-area-inset-bottom)]' : 'max-w-5xl pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))]'}`}>
        <AnimatePresence mode="wait">
          {selectedSessionId ? (
            /* ── Input View ────────────────────────────────────────────────── */
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedSessionId(null)}
                    className="flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span> 목록으로 돌아가기
                  </button>
                  {/* Navigate to KEYWORD BUBBLE */}
                  <button
                    onClick={() => { setSelectedSessionId(null); setActiveTab('classroom'); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/70 transition-colors bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-full"
                  >
                    <span className="material-symbols-outlined text-sm">bubble_chart</span>
                    KEYWORD BUBBLE 보기
                  </button>
                </div>
                <h2 className="text-xl md:text-2xl font-headline font-bold text-on-surface break-keep">
                  {db.sessions.find(s => s.id === selectedSessionId)?.name}
                </h2>
                <p className="text-xs text-on-surface-variant">이 세션에서 얻은 핵심 인사이트를 기록해주세요.</p>
              </div>

              {/* Session Info Display */}
              <div className="bg-surface-container p-6 rounded-3xl border border-outline-variant/20 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-secondary">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <span className="text-xs font-bold uppercase tracking-wider">세션 상세 정보</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {db.sessions.find(s => s.id === selectedSessionId)?.instructor && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">강사</p>
                      <p className="text-sm font-medium text-on-surface">{db.sessions.find(s => s.id === selectedSessionId)?.instructor}</p>
                    </div>
                  )}
                  {db.sessions.find(s => s.id === selectedSessionId)?.objectives && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">학습 목표</p>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{db.sessions.find(s => s.id === selectedSessionId)?.objectives}</p>
                    </div>
                  )}
                  {db.sessions.find(s => s.id === selectedSessionId)?.contents && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase">주요 내용</p>
                      <p className="text-sm text-on-surface-variant leading-relaxed">{db.sessions.find(s => s.id === selectedSessionId)?.contents}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Input Form */}
              {(() => {
                const isEditing = !!userInsights.find(i => i.sessionId === selectedSessionId);
                return (
                  <div className="space-y-6 bg-surface-container-low p-6 rounded-3xl border border-outline shadow-sm">
                    {isEditing && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-secondary/10 border border-secondary/20 rounded-xl">
                        <span className="material-symbols-outlined text-secondary text-sm">edit_note</span>
                        <p className="text-xs font-bold text-secondary">이미 등록된 인사이트를 수정합니다.</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">key</span> 핵심 키워드 (1개)
                      </label>
                      <input
                        type="text"
                        value={keyword}
                        onChange={e => setKeyword(e.target.value)}
                        placeholder="예: 생성형 AI 활용"
                        className="w-full bg-surface border border-outline rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:border-secondary transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">description</span> 상세 설명
                      </label>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="학습한 내용과 인사이트를 자유롭게 적어주세요."
                        rows={5}
                        className="w-full bg-surface border border-outline rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:border-secondary transition-all resize-none"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveInsight(selectedSessionId)}
                      className="w-full py-4 bg-secondary text-on-secondary font-headline font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">{isEditing ? 'edit' : 'check_circle'}</span>
                      {isEditing ? '수정 완료' : '인사이트 등록 완료'}
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          ) : activeTab === 'my' ? (
            /* ── MY INSIGHT Tab ─────────────────────────────────────────────── */
            <motion.div
              key="my"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-[clamp(1.5rem,8vw,2.5rem)] font-headline font-black text-on-surface tracking-tighter leading-none break-keep w-full">
                  be Giver be Taker
                </h1>
                <p className="text-on-surface-variant text-sm leading-relaxed font-medium">
                  참여한 세션별로 핵심 키워드와 학습 내용을 기록해보세요.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {activeSessions.length === 0 ? (
                  <div className="p-12 bg-white rounded-xl border border-dashed border-outline text-center space-y-4">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">event_busy</span>
                    <p className="text-sm text-on-surface-variant font-medium">현재 활성화된 세션이 없습니다.</p>
                  </div>
                ) : (
                  activeSessions.map((session, idx) => {
                    const insight = userInsights.find(i => i.sessionId === session.id);
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white border border-outline rounded-xl p-6 shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black bg-secondary/10 text-secondary px-2 py-0.5 rounded-md border border-secondary/20 uppercase tracking-widest">{session.module}</span>
                              <span className="text-[10px] font-black bg-on-surface-variant/10 text-on-surface-variant px-2 py-0.5 rounded-md uppercase tracking-widest">{session.day}</span>
                            </div>
                            <h2 className="text-lg font-headline font-black text-on-surface uppercase tracking-tight">{session.name}</h2>
                          </div>
                          {/* Edit / Add button */}
                          {insight ? (
                            <button
                              onClick={() => startInput(session.id)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-on-secondary text-xs font-bold shadow-md active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span>
                              수정하기
                            </button>
                          ) : (
                            <button
                              onClick={() => startInput(session.id)}
                              className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-container-highest text-on-surface-variant hover:bg-secondary/20 transition-all"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                          )}
                        </div>

                        {insight ? (
                          <div className="space-y-3 pt-3 border-t border-outline/50">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-xs text-secondary">stars</span>
                              <span className="text-sm font-black text-secondary uppercase tracking-tight">{insight.keyword}</span>
                            </div>
                            <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2 font-medium">{insight.description}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant/50 italic font-medium">아직 등록된 인사이트가 없습니다.</p>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          ) : (
            /* ── CLASSROOM / BUBBLE CHART Tab ───────────────────────────────── */
            <motion.div
              key="classroom"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              {/* Editorial Header */}
              <section>
                <p className="text-secondary font-black tracking-widest uppercase text-[10px] mb-2 font-label">Knowledge Mapping</p>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className={adminCourseId ? "" : "max-w-2xl"}>
                    <h2 className="text-[clamp(1.25rem,6vw,2.5rem)] font-black font-headline text-primary leading-tight tracking-tighter mb-4 uppercase break-keep w-full">
                      Learning Insight Dashboard
                    </h2>
                    <p className="text-on-surface-variant text-sm md:text-lg leading-relaxed max-w-xl font-medium break-keep">
                      우리 클래스 리더들의 학습 인사이트를 시각화한 대시보드입니다. <br className="block md:hidden" />세션별 핵심 키워드의 흐름을 확인해보세요.
                    </p>
                  </div>
                  <div className="relative w-full md:w-72">
                    <select
                      value={classroomSessionId}
                      onChange={e => setClassroomSessionId(e.target.value)}
                      className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm font-black text-primary outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer uppercase tracking-tight"
                    >
                      {db.sessions.filter(s => s.courseId === effectiveCourseId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">expand_more</span>
                  </div>
                </div>
              </section>

              <div className="space-y-6">

                {/* ── 1. KEYWORD BUBBLE (first) ───────────────────────────── */}
                <div
                  ref={bubbleWrapRef}
                  className={`bg-surface-container-low rounded-xl border border-outline-variant/10 relative overflow-hidden ${isBubbleFullScreen ? 'fixed inset-0 z-[9999] rounded-none' : ''}`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 pt-6 pb-3 gap-4">
                    <div className="min-w-0">
                      <h3 className="text-primary font-headline font-bold text-lg md:text-xl whitespace-nowrap">KEYWORD BUBBLE</h3>
                      <p className="text-[10px] text-on-surface-variant mt-0.5 whitespace-nowrap">탭 → 키워드 공개 · 스크롤/핀치 → 줌 · 드래그 → 이동</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* 새로고침 */}
                      <button
                        onClick={handleBubbleRefresh}
                        disabled={isRefreshing}
                        className="w-8 h-8 rounded-full bg-white/80 border border-outline flex items-center justify-center shadow-sm hover:bg-white transition-all text-on-surface-variant"
                        title="새로고침"
                      >
                        <span className={`material-symbols-outlined text-base ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Bubble canvas */}
                  <div
                    ref={setBubbleContainerEl}
                    className={`relative w-full ${isBubbleFullScreen ? 'h-[calc(100dvh-72px)]' : 'min-h-[55vw] sm:min-h-[420px]'} overflow-hidden`}
                    style={{ touchAction: 'none', cursor: isBubbleDragging ? 'grabbing' : 'grab' }}
                    onPointerDown={handleBubblePointerDown}
                    onClickCapture={handleBubbleClickCapture}
                  >
                    {/* 줌 퍼센트 표시 + 초기화 — 캔버스 좌상단 오버레이 */}
                    {Math.round(bubbleZoom * 100) !== 100 && (
                      <button
                        onClick={() => { setBubbleZoom(1); setBubblePan({ x: 0, y: 0 }); }}
                        className="absolute top-3 left-3 z-10 h-7 px-2.5 rounded-full bg-white/90 border border-outline text-[10px] font-bold text-primary shadow-sm hover:bg-white transition-all"
                        title="줌 초기화"
                      >
                        {Math.round(bubbleZoom * 100)}% ↺
                      </button>
                    )}
                    {classroomData.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/40 gap-3">
                        <span className="material-symbols-outlined text-6xl">bubble_chart</span>
                        <p className="font-headline font-bold">데이터가 부족합니다</p>
                      </div>
                    ) : (
                      /* zoom/pan transform wrapper */
                      <div
                        style={{
                          position: 'absolute', inset: 0,
                          transform: `translate(${bubblePan.x}px, ${bubblePan.y}px) scale(${bubbleZoom})`,
                          transformOrigin: '50% 50%',
                        }}
                      >
                      {classroomData.map((data, idx) => {
                        const pos = bubblePositions[data.id];
                        if (!pos) return null;
                        const { x, y, r } = pos;
                        const bgColor = getKeywordColor(data.name, idx);
                        const textColor = getContrastColor(bgColor);
                        const isRevealed = revealedBubbles[classroomSessionId]?.has(data.id);
                        const fontSize = Math.max(9, r * 0.2);
                        const countFontSize = Math.max(8, r * 0.1);
                        const bubbleStyle = get3DBubbleStyle(bgColor);

                        return (
                          <motion.div
                            key={data.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            whileHover={{ scale: 1.06 }}
                            onClick={() => {
                              if (!isRevealed) {
                                // First click: reveal keyword
                                setRevealedBubbles(prev => {
                                  const sessionSet = new Set(prev[classroomSessionId] || []);
                                  sessionSet.add(data.id);
                                  return { ...prev, [classroomSessionId]: sessionSet };
                                });
                              } else {
                                // Second click: open detail
                                setSelectedKeywordDetail(data.id);
                              }
                            }}
                            className="absolute rounded-full flex items-center justify-center cursor-pointer select-none transition-shadow"
                            style={{
                              left: x - r,
                              top: y - r,
                              width: r * 2,
                              height: r * 2,
                              ...bubbleStyle,
                            }}
                          >
                            {isRevealed ? (
                              /* Revealed: show keyword + count */
                              <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center px-2"
                                style={{ color: textColor }}
                              >
                                <span className="block font-headline font-black leading-tight" style={{ fontSize }}>{data.name}</span>
                                <span className="block opacity-70 font-bold mt-0.5" style={{ fontSize: countFontSize }}>{data.count} Insights</span>
                              </motion.div>
                            ) : (
                              /* Unrevealed: show only tap icon */
                              <div className="flex flex-col items-center gap-0.5" style={{ color: textColor }}>
                                <span
                                  className="material-symbols-outlined opacity-60"
                                  style={{ fontSize: Math.max(14, r * 0.35) }}
                                >
                                  touch_app
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                      </div>
                    )}
                  </div>

                  <div className="px-8 pb-6 pt-2 flex items-center gap-2 text-[10px] text-on-surface-variant/60">
                    <span className="material-symbols-outlined text-xs">info</span>
                    버블 크기 = 언급 빈도 · 탭 → 키워드 공개 · 재탭 → 상세 인사이트
                  </div>
                </div>

                {/* ── 2. BEST INSIGHTS (second) ───────────────────────────── */}
                <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-sm">
                  <h3 className="text-primary font-headline font-bold text-lg md:text-xl mb-6">BEST INSIGHTS</h3>

                  <div className="space-y-8">
                    {bestComments.length > 0 ? (
                      <div className="grid grid-cols-1 gap-8">
                        {bestComments.map((comment, idx) => {
                          const user = db.users.find(u => u.id === comment.userId);
                          return (
                            <div key={comment.id} className="relative">
                              <span className="absolute -top-4 -left-2 text-6xl font-serif text-primary/10 select-none">"</span>
                              <div className="pl-8 pr-4">
                                <p className="text-lg font-bold text-on-surface leading-snug italic mb-4 break-keep">
                                  {comment.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-secondary uppercase tracking-widest">#{comment.keyword}</span>
                                    <span className="text-[10px] text-on-surface-variant font-medium">
                                      {user ? `${user.company} ${user.department} ${user.name} ${user.title}` : 'Anonymous'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-error">
                                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                    <span className="text-[10px] font-bold">{comment.likes?.length || 0}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-on-surface leading-snug font-medium italic text-sm">
                        {classroomData.length > 0
                          ? `"${classroomData[0].name}" 키워드가 이번 세션에서 가장 많은 공감을 얻고 있습니다.`
                          : "아직 등록된 인사이트가 없습니다."}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── 3. Keyword Hashtag ──────────────────────────────────── */}
                <div className="bg-surface-container-low p-5 rounded-xl border border-outline-variant/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-secondary text-sm">tag</span>
                    <span className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Keyword Hashtag</span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto scrollbar-hide pr-2">
                    {aggregatedKeywords.length === 0 ? (
                      <p className="text-xs text-on-surface-variant/50 italic">등록된 키워드가 없습니다.</p>
                    ) : (
                      aggregatedKeywords.map(({ keyword, count }) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-highest text-secondary text-[11px] font-bold border border-outline-variant/20 hover:bg-secondary/10 transition-colors"
                        >
                          #{keyword}{count > 1 ? `(${count})` : ''}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Legend Section */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-12 border-t border-outline-variant/20 pt-12">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-primary text-3xl">auto_awesome</span>
                  <div>
                    <h4 className="font-headline font-bold text-on-surface">AI Synthesis</h4>
                    <p className="text-xs text-on-surface-variant">NLP 클러스터링을 통해 유사한 의미의 키워드를 자동으로 그룹화합니다.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary text-3xl">query_stats</span>
                  <div>
                    <h4 className="font-headline font-bold text-on-surface">Frequency Heatmap</h4>
                    <p className="text-xs text-on-surface-variant">버블의 크기는 해당 키워드가 언급된 빈도에 비례하여 커집니다.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-tertiary-container text-3xl">hub</span>
                  <div>
                    <h4 className="font-headline font-bold text-on-surface">Network Links</h4>
                    <p className="text-xs text-on-surface-variant">버블을 탭하여 해당 키워드와 관련된 리더들의 상세 인사이트를 확인하세요.</p>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Keyword Detail Popup */}
        <AnimatePresence>
          {selectedKeywordDetail && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedKeywordDetail(null)}
                className="absolute inset-0 bg-on-background/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-2xl bg-surface rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-headline font-black text-primary">
                      {db.canonicalTerms?.find(t => t.id === selectedKeywordDetail)?.term || selectedKeywordDetail}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {classroomData.find(d => d.id === selectedKeywordDetail)?.originalKeywords.map(k => (
                        <span key={k} className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">#{k}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedKeywordDetail(null)}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {(classroomData.find(d => d.id === selectedKeywordDetail)?.insights || [])
                    .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
                    .map((insight) => {
                      const user = db.users.find(u => u.id === insight.userId);
                      const isLiked = insight.likes?.includes(currentUser?.id || '');

                    return (
                      <div key={insight.id} className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/10 space-y-4 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden">
                              {user?.profilePic ? (
                                user.profilePic.length < 5 ? (
                                  <span className="text-xl">{user.profilePic}</span>
                                ) : (
                                  <img src={user.profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                )
                              ) : (
                                <span className="text-xs font-bold text-primary">{user?.name?.charAt(0)}</span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-on-surface">{user?.name}</p>
                              <p className="text-[10px] text-on-surface-variant font-medium">
                                {user?.company} | {user?.department} | {user?.title}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentUser) toggleInsightLike(insight.id, currentUser.id);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${isLiked ? 'bg-error/10 border-error text-error' : 'bg-surface-container-highest border-outline-variant/30 text-on-surface-variant hover:bg-error/5 hover:border-error/30 hover:text-error'}`}
                          >
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                            <span className="text-xs font-bold">{insight.likes?.length || 0}</span>
                          </button>
                        </div>
                        <p className="text-sm text-on-surface-variant leading-relaxed bg-surface-container-low/50 p-4 rounded-xl italic">
                          "{insight.description}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav - Hidden in Admin Mode */}
      {!adminCourseId && (
        <nav className="z-50 flex justify-around items-center h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-4 bg-surface/90 backdrop-blur-2xl border-t border-outline shadow-lg shrink-0">
          <button
            onClick={() => { setSelectedSessionId(null); setActiveTab('my'); }}
            className={`flex items-center justify-center gap-2 transition-colors active:scale-95 px-4 py-2 rounded-full ${activeTab === 'my' && !selectedSessionId ? 'text-secondary bg-secondary/10' : 'text-on-surface-variant/40 hover:text-secondary'}`}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: activeTab === 'my' ? "'FILL' 1" : "'FILL' 0" }}>psychology</span>
            <span className="font-label text-[10px] uppercase tracking-widest font-medium">My Insight</span>
          </button>

          <button
            onClick={() => { setSelectedSessionId(null); setActiveTab('classroom'); }}
            className={`flex items-center justify-center gap-2 transition-colors active:scale-95 px-4 py-2 rounded-full ${activeTab === 'classroom' ? 'text-secondary bg-secondary/10' : 'text-on-surface-variant/40 hover:text-secondary'}`}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: activeTab === 'classroom' ? "'FILL' 1" : "'FILL' 0" }}>bubble_chart</span>
            <span className="font-label text-[10px] uppercase tracking-widest font-medium">Bubble Chart</span>
          </button>
        </nav>
      )}
    </div>
  );
}
