import React, { useState, useMemo, useRef, useEffect, CSSProperties } from 'react';
import { useStore, UserInsight } from '../store';
import { cosineSimilarity } from '../services/embeddingService';
import { motion, AnimatePresence } from 'motion/react';
import NotificationBell from './NotificationBell';
import * as d3 from 'd3';
import { sortSessions } from '../utils/sortSessions';

interface InsightViewProps {
  onBack?: () => void;
  onLogout?: () => void;
  onProfileClick?: () => void;
  onNotificationClick?: () => void;
  adminCourseId?: string;
}

export default function InsightView({ onBack, onLogout, onProfileClick, onNotificationClick, adminCourseId }: InsightViewProps) {
  const { currentUser, db, saveUserInsight, toggleInsightLike, fetchData, refreshCanonicalTerms } = useStore();

  // 인사이트 화면 진입 시 canonicalTerms 만 가볍게 재조회 — 다른 유저가 방금
  // 만든 새 키워드 doc 이 로컬 캐시에 없어 hash ID 가 노출되는 현상 방지.
  // (50명 동시접속에도 안전한 1 컬렉션 ~50 docs read)
  useEffect(() => { refreshCanonicalTerms(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const effectiveCourseId = adminCourseId || currentUser?.courseId;

  const [activeTab, setActiveTab] = useState<'my' | 'classroom'>(adminCourseId ? 'classroom' : 'my');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // 초기 선택: 정렬된 활성 세션 중 첫 번째 (없으면 빈 문자열)
  const [classroomSessionId, setClassroomSessionId] = useState<string>(() => {
    const list = sortSessions(db.sessions.filter(s => s.courseId === effectiveCourseId && s.isActive));
    return list[0]?.id || '';
  });

  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [insightInputError, setInsightInputError] = useState(false);
  const [isSavingInsight, setIsSavingInsight] = useState(false);
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
  // Direct DOM ref for smooth drag (no React re-render during movement)
  const panLayerRef = useRef<HTMLDivElement>(null);
  const liveState   = useRef({ x: 0, y: 0, zoom: 1 });

  const activeSessions = sortSessions(db.sessions.filter(s => s.courseId === effectiveCourseId && s.isActive));
  const userInsights = (db.userInsights || []).filter(i => i.userId === currentUser?.id);

  // Prevent duplicate: reuse existing insight ID if one exists for this session
  const handleSaveInsight = async (sessionId: string) => {
    if (isSavingInsight) return;
    if (!keyword.trim() || !description.trim()) {
      setInsightInputError(true);
      return;
    }
    setInsightInputError(false);

    const existing = userInsights.find(i => i.sessionId === sessionId);
    // 결정적 ID: 같은 (userId, sessionId) 는 항상 같은 doc 으로 매핑 → 동시 다중 입력 시
    // 중복 doc 생성 / Date.now() 충돌 / 새로고침 후 또 다른 doc 생성 모두 차단.
    const safeUid = currentUser!.id.replace(/[\/\x00-\x1F\x7F]/g, '_').slice(0, 100);
    const safeSid = sessionId.replace(/[\/\x00-\x1F\x7F]/g, '_').slice(0, 100);
    const deterministicId = `ui_${safeUid}__${safeSid}`;
    const insight: UserInsight = {
      id: existing?.id || deterministicId,
      userId: currentUser!.id,
      sessionId,
      keyword,
      description,
      likes: existing?.likes || []
    };

    setIsSavingInsight(true);
    try {
      await saveUserInsight(insight);
      // 저장 직후 canonicalTerms 캐시 갱신 — 같은 시점 다른 유저가 만든 doc 도 함께 동기화.
      // 비동기 백그라운드로 실행해 UI 블로킹 X.
      refreshCanonicalTerms();
      setSelectedSessionId(null);
      setKeyword('');
      setDescription('');
    } catch (e) {
      console.error('인사이트 저장 실패', e);
    } finally {
      setIsSavingInsight(false);
    }
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

    // Step 1: Initial grouping by stored canonicalId
    const groups: Record<string, { count: number, originalKeywords: string[], insights: UserInsight[] }> = {};
    sessionInsights.forEach(insight => {
      const repId = insight.canonicalId || insight.keyword;
      if (!groups[repId]) {
        groups[repId] = { count: 0, originalKeywords: [], insights: [] };
      }
      groups[repId].count += 1;
      if (!groups[repId].originalKeywords.includes(insight.keyword)) {
        groups[repId].originalKeywords.push(insight.keyword);
      }
      groups[repId].insights.push(insight);
    });

    const ids = Object.keys(groups);

    // Step 2: Union-Find re-grouping using stored embeddings.
    // 임계치는 store.tsx 의 canonicalizeKeyword 와 동일하게 0.78 사용.
    // (이전 0.55 는 한국어 anisotropy 로 인해 무관 키워드까지 동일 버블로 합쳐버림 —
    //  예: "효율경제" ↔ "혁신 비용", "AI리스크" 등이 모두 한 그룹이 되는 문제)
    const SIM_THRESHOLD = 0.78;
    const parent: Record<string, string> = {};
    ids.forEach(id => { parent[id] = id; });

    const find = (x: string): string => {
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const termA = db.canonicalTerms?.find(t => t.id === ids[i]);
        const termB = db.canonicalTerms?.find(t => t.id === ids[j]);
        if (termA?.embedding && termB?.embedding) {
          if (cosineSimilarity(termA.embedding, termB.embedding) > SIM_THRESHOLD) {
            // Union: lower-count group absorbs into higher-count root
            const ra = find(ids[i]);
            const rb = find(ids[j]);
            if (ra !== rb) {
              if ((groups[ra]?.count || 0) >= (groups[rb]?.count || 0)) {
                parent[rb] = ra;
              } else {
                parent[ra] = rb;
              }
            }
          }
        }
      }
    }

    // Step 3: Merge groups according to union-find result
    const merged: Record<string, { count: number, originalKeywords: string[], insights: UserInsight[] }> = {};
    ids.forEach(id => {
      const root = find(id);
      if (!merged[root]) {
        merged[root] = { count: 0, originalKeywords: [], insights: [] };
      }
      merged[root].count += groups[id].count;
      groups[id].originalKeywords.forEach(k => {
        if (!merged[root].originalKeywords.includes(k)) merged[root].originalKeywords.push(k);
      });
      merged[root].insights.push(...groups[id].insights);
    });

    return Object.entries(merged).map(([id, data]) => {
      const term = db.canonicalTerms?.find(t => t.id === id);
      // 폴백 우선순위: canonicalTerm.term → 원본 keyword 텍스트 → id (최후의 보루)
      // canonicalTerm 이 로컬 캐시에 없을 때(다른 유저가 방금 생성한 경우 등)
      // 해시 ID 가 화면에 노출되지 않도록 보호.
      const fallback = data.originalKeywords[0] || id;
      return {
        id,
        name: term?.term?.trim() || fallback,
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
        .force('center', d3.forceCenter(W / 2, H / 2).strength(0.6))
        .force('collision', d3.forceCollide().radius((d: any) => d.r + 4).strength(1).iterations(6))
        .force('x', d3.forceX(W / 2).strength(0.04))
        .force('y', d3.forceY(H / 2).strength(0.04))
        // 안정화되면 정지 (50명 동시 접속 시 CPU 절약). alphaMin 기본 0.001
        .alphaTarget(0)
        .alphaDecay(0.03)
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

  // ── React state → liveState + DOM 동기화 (버튼/세션변경 등 드래그 외 변경) ─────
  useEffect(() => {
    liveState.current = { x: bubblePan.x, y: bubblePan.y, zoom: bubbleZoom };
    if (panLayerRef.current) {
      panLayerRef.current.style.transform = `translate(${bubblePan.x}px, ${bubblePan.y}px) scale(${bubbleZoom})`;
    }
  }, [bubblePan, bubbleZoom]);

  // ── 마우스 휠 줌 (non-passive, 직접 DOM 업데이트) ─────────────────────────────
  useEffect(() => {
    if (!bubbleContainerEl) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.min(5, Math.max(0.2, liveState.current.zoom * factor));
      liveState.current.zoom = newZoom;
      if (panLayerRef.current) {
        panLayerRef.current.style.transform = `translate(${liveState.current.x}px, ${liveState.current.y}px) scale(${newZoom})`;
      }
      setBubbleZoom(newZoom);
    };
    bubbleContainerEl.addEventListener('wheel', onWheel, { passive: false });
    return () => bubbleContainerEl.removeEventListener('wheel', onWheel);
  }, [bubbleContainerEl]);

  // ── 터치: 핀치 줌 + 단일 터치 패닝 (non-passive, 직접 DOM 업데이트) ────────────
  useEffect(() => {
    if (!bubbleContainerEl) return;
    let lastDist: number | null = null;
    // 단일 터치 패닝용 기준점
    let touchPanStart: { x: number; y: number; px: number; py: number } | null = null;

    const getTouchDist = (t: TouchList) => {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastDist = getTouchDist(e.touches);
        touchPanStart = null; // 핀치 시작 시 패닝 취소
      } else if (e.touches.length === 1) {
        touchPanStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          px: liveState.current.x,
          py: liveState.current.y,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastDist !== null) {
        // 핀치 줌
        const d = getTouchDist(e.touches);
        const newZoom = Math.min(5, Math.max(0.2, liveState.current.zoom * (d / lastDist)));
        liveState.current.zoom = newZoom;
        if (panLayerRef.current) {
          panLayerRef.current.style.transform = `translate(${liveState.current.x}px, ${liveState.current.y}px) scale(${newZoom})`;
        }
        setBubbleZoom(newZoom);
        lastDist = d;
      } else if (e.touches.length === 1 && touchPanStart !== null) {
        // 단일 터치 패닝
        const dx = e.touches[0].clientX - touchPanStart.x;
        const dy = e.touches[0].clientY - touchPanStart.y;
        const nx = touchPanStart.px + dx;
        const ny = touchPanStart.py + dy;
        liveState.current.x = nx;
        liveState.current.y = ny;
        if (panLayerRef.current) {
          panLayerRef.current.style.transform = `translate(${nx}px, ${ny}px) scale(${liveState.current.zoom})`;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) lastDist = null;
      if (e.touches.length === 0) {
        // 패닝 종료 시 React state 동기화
        setBubblePan({ x: liveState.current.x, y: liveState.current.y });
        touchPanStart = null;
      }
    };

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
  // onPointerDownCapture: 캡처 단계에서 실행 → Framer Motion의 버블 stopPropagation보다 먼저 실행
  // 모바일에서 버블 위를 터치해도 드래그가 정상 동작하는 핵심 이유
  const handleBubblePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 멀티터치(핀치) 시작 시 패닝 무시
    if (e.button !== 0) return;
    activePointers.current.add(e.pointerId);
    if (activePointers.current.size > 1) return;

    const pid = e.pointerId;
    setIsBubbleDragging(true);
    bubbleDragDist.current = 0;
    bubbleDragRef.current = { x: e.clientX, y: e.clientY, px: liveState.current.x, py: liveState.current.y };

    const onMove = (me: PointerEvent) => {
      if (me.pointerId !== pid) return;
      if (activePointers.current.size > 1) return;
      const dx = me.clientX - bubbleDragRef.current.x;
      const dy = me.clientY - bubbleDragRef.current.y;
      bubbleDragDist.current = Math.sqrt(dx * dx + dy * dy);
      const nx = bubbleDragRef.current.px + dx;
      const ny = bubbleDragRef.current.py + dy;
      liveState.current.x = nx;
      liveState.current.y = ny;
      if (panLayerRef.current) {
        panLayerRef.current.style.transform = `translate(${nx}px, ${ny}px) scale(${liveState.current.zoom})`;
      }
    };

    const cleanup = () => {
      activePointers.current.delete(pid);
      setIsBubbleDragging(false);
      setBubblePan({ x: liveState.current.x, y: liveState.current.y });
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    const onUp = (ue: PointerEvent) => {
      if (ue.pointerId !== pid) return;
      cleanup();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // pointercancel: 모바일 브라우저가 제스처를 강제 취소할 때 cleanup
    window.addEventListener('pointercancel', onUp);
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

      <main className={`flex-1 overflow-y-auto overflow-x-hidden w-full px-4 sm:px-6 mx-auto transition-all ${adminCourseId ? 'max-w-none pt-8 pb-[env(safe-area-inset-bottom)]' : 'max-w-5xl pt-8 pb-[calc(6rem+env(safe-area-inset-bottom))]'}`}>
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
              {/* Back + Session header */}
              {(() => {
                const session = db.sessions.find(s => s.id === selectedSessionId);
                return (
                  <div>
                    <button
                      onClick={() => setSelectedSessionId(null)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest transition-colors mb-4"
                    >
                      <span className="material-symbols-outlined text-xl">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-black text-secondary/60 uppercase tracking-widest">{session?.module}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-on-surface-variant/30" />
                      <span className="text-[9px] font-medium text-on-surface-variant/40 uppercase tracking-widest">{session?.day}</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-headline font-black text-on-surface break-keep leading-tight">
                      {session?.name}
                    </h2>
                    {session?.time && (
                      <p className="text-[11px] text-on-surface-variant/50 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        {session.time}
                      </p>
                    )}
                    <p className="text-xs text-on-surface-variant/60 mt-1.5">이 세션에서 얻은 핵심 인사이트를 기록해주세요.</p>
                  </div>
                );
              })()}

              {/* Session Info — minimal row layout (학습목표 노출 제외) */}
              {(() => {
                const session = db.sessions.find(s => s.id === selectedSessionId);
                const hasInfo = session?.instructor || session?.contents;
                if (!hasInfo) return null;
                return (
                  <div className="divide-y divide-outline/15">
                    {session?.instructor && (
                      <div className="py-3 flex gap-5">
                        <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest w-14 shrink-0 pt-0.5">강사</span>
                        <p className="text-sm font-semibold text-on-surface">{session.instructor}</p>
                      </div>
                    )}
                    {session?.contents && (
                      <div className="py-3 flex gap-5">
                        <span className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-widest w-14 shrink-0 pt-0.5">내용</span>
                        <p className="text-sm text-on-surface-variant/80 leading-relaxed">{session.contents}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

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
                    {insightInputError && (
                      <p className="text-[11px] text-error font-medium flex items-center gap-1 bg-error/5 border border-error/20 rounded-xl px-3 py-2">
                        <span className="material-symbols-outlined text-sm">warning</span>
                        인사이트 키워드와 키워드 작성 이유를 모두 입력해주세요.
                      </p>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">key</span> 인사이트 키워드 (1개)
                      </label>
                      <input
                        type="text"
                        value={keyword}
                        onChange={e => { setKeyword(e.target.value); if (e.target.value.trim()) setInsightInputError(false); }}
                        placeholder="기억에 남는 한단어를 기재해주세요."
                        className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:border-secondary transition-all ${insightInputError && !keyword.trim() ? 'border-error' : 'border-outline'}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">description</span> 키워드 작성 이유
                      </label>
                      <textarea
                        value={description}
                        onChange={e => { setDescription(e.target.value); if (e.target.value.trim()) setInsightInputError(false); }}
                        placeholder="위에서 키워드를 입력하신 이유와 소감을 상세히 기재해주세요. 다른 리더분들과 입력된 내용을 공유합니다."
                        rows={5}
                        className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:border-secondary transition-all resize-none ${insightInputError && !description.trim() ? 'border-error' : 'border-outline'}`}
                      />
                    </div>
                    <button
                      onClick={() => handleSaveInsight(selectedSessionId)}
                      disabled={isSavingInsight}
                      className="w-full py-4 bg-secondary text-on-secondary font-headline font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-sm">{isSavingInsight ? 'progress_activity' : (isEditing ? 'edit' : 'check_circle')}</span>
                      {isSavingInsight ? '저장 중...' : (isEditing ? '수정 완료' : '인사이트 등록 완료')}
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
              <div className="pb-3 border-b-2 border-primary/30">
                <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">MY INSIGHT</h1>
                <p className="text-xs text-on-surface-variant mt-0.5 font-medium">참여한 세션별로 핵심 키워드와 학습 내용을 기록해보세요.</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {activeSessions.length === 0 ? (
                  <div className="p-12 bg-white rounded-2xl border border-dashed border-outline text-center space-y-3">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">event_busy</span>
                    <p className="text-sm text-on-surface-variant/60 font-medium">현재 활성화된 세션이 없습니다.</p>
                  </div>
                ) : (
                  activeSessions.map((session, idx) => {
                    const insight = userInsights.find(i => i.sessionId === session.id);
                    return (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`relative bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${insight ? 'border-secondary/25' : 'border-outline/50'}`}
                      >
                        {/* Top accent line */}
                        <div className={`h-[3px] w-full ${insight ? 'bg-gradient-to-r from-secondary via-secondary/60 to-transparent' : 'bg-gradient-to-r from-outline/30 to-transparent'}`} />

                        <div className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[9px] font-black text-secondary/60 uppercase tracking-widest">{session.module}</span>
                                <span className="w-0.5 h-0.5 rounded-full bg-on-surface-variant/30" />
                                <span className="text-[9px] font-medium text-on-surface-variant/40 uppercase tracking-widest">{session.day}</span>
                              </div>
                              <h2 className="text-[15px] font-headline font-black text-on-surface leading-snug">{session.name}</h2>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {session.time && (
                                  <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/50 font-medium">
                                    <span className="material-symbols-outlined text-xs">schedule</span>
                                    {session.time}
                                  </span>
                                )}
                                {session.instructor && (
                                  <span className="flex items-center gap-1 text-[10px] text-on-surface-variant/50 font-medium">
                                    <span className="material-symbols-outlined text-xs">person</span>
                                    {session.instructor}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => startInput(session.id)}
                              className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 ${insight ? 'text-secondary bg-secondary/8 hover:bg-secondary/15' : 'text-on-surface-variant/40 bg-surface-container hover:bg-primary/10 hover:text-primary'}`}
                              title={insight ? '수정하기' : '작성하기'}
                            >
                              <span className="material-symbols-outlined text-lg">{insight ? 'edit_note' : 'add_circle'}</span>
                            </button>
                          </div>

                          {insight ? (
                            <div className="mt-3 pt-3 border-t border-outline/20">
                              <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[8px] font-black text-secondary/40 uppercase tracking-widest shrink-0">KEYWORD</span>
                                <span className="text-base font-black text-secondary tracking-tight leading-none">{insight.keyword}</span>
                              </div>
                              <p className="text-[11px] text-on-surface-variant/60 leading-relaxed line-clamp-2">{insight.description}</p>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-outline/15 flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-on-surface-variant/20">add</span>
                              <p className="text-[11px] text-on-surface-variant/30 italic">인사이트 키워드를 등록해주세요.</p>
                            </div>
                          )}
                        </div>
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
              className="space-y-12 w-full min-w-0"
            >
              {/* Editorial Header */}
              <section>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className={adminCourseId ? "" : "max-w-2xl"}>
                    <div className="pb-3 border-b-2 border-primary/30 mb-4">
                      <h2 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">KEYWORD BUBBLE CHART</h2>
                      <p className="text-xs text-on-surface-variant mt-0.5 font-medium">세션별 핵심 키워드의 흐름을 확인해보세요.</p>
                    </div>
                  </div>
                  <div className="relative w-full md:w-72">
                    <select
                      value={classroomSessionId}
                      onChange={e => setClassroomSessionId(e.target.value)}
                      className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm font-black text-primary outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer uppercase tracking-tight"
                    >
                      {/* 어드민 활성화 토글된 세션만 어드민 설정 순서대로 노출. */}
                      {activeSessions.map(s => (
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
                  <div className="flex items-start justify-between px-4 sm:px-6 pt-5 pb-3 gap-2 min-w-0">
                    {/* 왼쪽: 타이틀 + 줌 버튼 */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h3 className="text-primary font-headline font-bold text-base sm:text-xl shrink-0">KEYWORD BUBBLE</h3>
                      {/* 줌 아웃 */}
                      <button
                        onClick={() => setBubbleZoom(z => { const nz = Math.max(0.2, z / 1.3); liveState.current.zoom = nz; return nz; })}
                        className="w-8 h-8 rounded-full bg-white/80 border border-outline flex items-center justify-center shadow-sm hover:bg-white transition-all text-on-surface-variant font-black text-lg shrink-0"
                        title="줌 아웃"
                      >−</button>
                      {/* 줌 인 */}
                      <button
                        onClick={() => setBubbleZoom(z => { const nz = Math.min(5, z * 1.3); liveState.current.zoom = nz; return nz; })}
                        className="w-8 h-8 rounded-full bg-white/80 border border-outline flex items-center justify-center shadow-sm hover:bg-white transition-all text-on-surface-variant font-black text-lg shrink-0"
                        title="줌 인"
                      >+</button>
                    </div>
                    {/* 오른쪽: 새로고침 + 전체화면 (모바일에서 세로 배치) */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                      {/* 새로고침 */}
                      <button
                        onClick={handleBubbleRefresh}
                        disabled={isRefreshing}
                        className="w-8 h-8 rounded-full bg-white/80 border border-outline flex items-center justify-center shadow-sm hover:bg-white transition-all text-on-surface-variant"
                        title="새로고침"
                      >
                        <span className={`material-symbols-outlined text-base ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                      </button>
                      {/* 전체화면 */}
                      <button
                        onClick={toggleBubbleFullScreen}
                        className="w-8 h-8 rounded-full bg-white/80 border border-outline flex items-center justify-center shadow-sm hover:bg-white transition-all text-on-surface-variant"
                        title={isBubbleFullScreen ? '전체화면 종료' : '전체화면'}
                      >
                        <span className="material-symbols-outlined text-base">{isBubbleFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Bubble canvas */}
                  <div
                    ref={setBubbleContainerEl}
                    className={`relative w-full ${isBubbleFullScreen ? 'h-[calc(100dvh-72px)]' : 'min-h-[55vw] sm:min-h-[420px]'} overflow-hidden`}
                    style={{ touchAction: 'none', cursor: isBubbleDragging ? 'grabbing' : 'grab' }}
                    onPointerDownCapture={handleBubblePointerDown}
                    onClickCapture={handleBubbleClickCapture}
                  >
                    {classroomData.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/40 gap-3">
                        <span className="material-symbols-outlined text-6xl">bubble_chart</span>
                        <p className="font-headline font-bold">데이터가 부족합니다</p>
                      </div>
                    ) : (
                      /* zoom/pan transform wrapper — controlled via panLayerRef for smooth drag */
                      <div
                        ref={panLayerRef}
                        style={{
                          position: 'absolute', inset: 0,
                          transform: `translate(${bubblePan.x}px, ${bubblePan.y}px) scale(${bubbleZoom})`,
                          transformOrigin: '50% 50%',
                          willChange: 'transform',
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
                      // 해당 리더가 세션마다 작성한 인사이트 키워드 = 해시태그
                      // (관심사가 아닌 학습 인사이트 키워드를 노출 — 동일 인사이트는 1회만 표시)
                      // 해당 유저가 "이 세션" 에 작성한 인사이트 키워드 1건만 노출.
                      // (이전: 모든 세션의 키워드를 표시)
                      const userInsightTags = insight.keyword?.trim()
                        ? [{ keyword: insight.keyword.trim(), isCurrent: true }]
                        : [];

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

                        {/* 리더의 인사이트 키워드 해시태그 (세션별 입력) */}
                        {userInsightTags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {userInsightTags.map((h, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  h.isCurrent
                                    ? 'bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/20'
                                    : 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                                }`}
                                title={h.isCurrent ? '현재 세션 인사이트 키워드' : '다른 세션 인사이트 키워드'}
                              >
                                #{h.keyword}
                              </span>
                            ))}
                          </div>
                        )}

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
