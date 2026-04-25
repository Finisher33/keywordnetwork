import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, User, Interest } from '../store';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { buildInterestKeyIndex } from '../utils/networkUtils';
import { genId } from '../utils/genId';

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  radius: number;
  color: string;
  count: number;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'user' | 'keyword';
  label: string;
  color: string;
  data?: any;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  type: 'giver' | 'taker';
}

export default function NetworkMap({ adminCourseId }: { adminCourseId?: string }) {
  const { db, currentUser, sendTeaTimeRequest, synonymLevel, fetchData } = useStore();
  const effectiveCourseId = adminCourseId || currentUser?.courseId;
  const { toast, showToast } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const toggleFullScreen = () => {
    if (!containerRef.current) return;
    
    const el = containerRef.current as any;
    
    if (!isFullScreen) {
      // Try native if available
      try {
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
          el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
          el.msRequestFullscreen();
        }
      } catch (err) {
        console.warn("Native fullscreen request failed:", err);
      }
      // Always set state for CSS fallback
      setIsFullScreen(true);
    } else {
      // Exit native if in it
      try {
        if (document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          } else if ((document as any).mozCancelFullScreen) {
            (document as any).mozCancelFullScreen();
          } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
          }
        }
      } catch (err) {
        console.warn("Native fullscreen exit failed:", err);
      }
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullScreenChange);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [showPersonalNetwork, setShowPersonalNetwork] = useState(false);
  const [teaTimeMsg, setTeaTimeMsg] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: 'type' | 'name', direction: 'asc' | 'desc' }>({ key: 'type', direction: 'asc' });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);
  const [networkNodes, setNetworkNodes] = useState<NetworkNode[]>([]);
  const [networkLinks, setNetworkLinks] = useState<NetworkLink[]>([]);
  
  const [transform, setTransform] = useState(d3.zoomIdentity);

  // Get all users in the same course — 관심사를 등록한 유저만 표시
  const courseUsers = useMemo(() => {
    const usersWithInterests = new Set(db.interests.map(i => i.userId));
    return db.users.filter(u => u.courseId === effectiveCourseId && usersWithInterests.has(u.id));
  }, [db.users, db.interests, effectiveCourseId]);

  // Get all interests for these users
  const courseInterests = useMemo(() => {
    const userIds = new Set(courseUsers.map(u => u.id));
    return db.interests.filter(i => userIds.has(i.userId));
  }, [db.interests, courseUsers]);

  // 표시-친화 그룹 인덱스: canonicalId race / 누락 / 마이그레이션 ID 변경에도
  // 같은 키워드는 단일 노드로 통합.
  const interestIndex = useMemo(
    () => buildInterestKeyIndex(courseInterests, db.canonicalTerms),
    [courseInterests, db.canonicalTerms]
  );

  // 그룹 루트키 → 키워드 변형 목록
  const keywordGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    interestIndex.groups.forEach((g, key) => { groups[key] = [...g.originals]; });
    return groups;
  }, [interestIndex]);

  const getKeywordName = (id: string) =>
    interestIndex.groups.get(id)?.displayName || id;

  // interest 한 건 → 그룹 루트키 (selectedKeyword 비교 시 사용)
  const groupKeyOf = (i: Interest): string => interestIndex.groupOf(i.id);

  const getKeywordColor = (str: string) => {
    const colors = ['#002c5f', '#00aad2', '#e4dcd3', '#1c1c1c', '#666666'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getContrastColor = (hexcolor: string) => {
    // If it's a hex color, calculate brightness
    if (hexcolor.startsWith('#')) {
      const r = parseInt(hexcolor.slice(1, 3), 16);
      const g = parseInt(hexcolor.slice(3, 5), 16);
      const b = parseInt(hexcolor.slice(5, 7), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#1c1c1c' : 'white';
    }
    return 'white';
  };

  // Simulation for Network Map
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const nodes: NetworkNode[] = [];
    const links: NetworkLink[] = [];

    // Add User Nodes
    courseUsers.forEach(u => {
      const isMe = u.id === currentUser?.id;
      nodes.push({
        id: `user-${u.id}`,
        type: 'user',
        label: u.name,
        color: isMe ? '#000080' : '#000080', // Navy for all users as requested, but we'll highlight 'me' later
        data: u
      });
    });

    // Add Keyword Nodes (grouped). 그룹 키 중복 방지: Set 으로 한번 더 dedupe.
    const keywordIdSet = new Set<string>();
    (Object.entries(keywordGroups) as [string, string[]][]).forEach(([id]) => {
      if (!keywordIdSet.has(id)) {
        keywordIdSet.add(id);
        const name = getKeywordName(id);
        nodes.push({
          id: `kw-${id}`,
          type: 'keyword',
          label: name,
          color: '#87CEEB' // Sky blue for all keywords
        });
      }
    });

    // Create links — 인덱스의 groupOf 결과로 무조건 단일 키워드 노드에 연결
    courseInterests.forEach(i => {
      const gk = groupKeyOf(i);
      if (!keywordIdSet.has(gk)) return; // 안전장치
      links.push({
        source: `user-${i.userId}`,
        target: `kw-${gk}`,
        type: i.type as 'giver' | 'taker'
      });
    });

    // 디버그(개발 환경에서만): 그룹/노드/링크 통계
    if (typeof window !== 'undefined' && (window as any).__NW_DEBUG) {
      console.log('[NetworkMap] users=%d, keywordGroups=%d, links=%d',
        courseUsers.length, keywordIdSet.size, links.length);
    }

    // 이전 simulation 잔존 상태 초기화 → 새 데이터로 깨끗하게 다시 그림
    setNetworkNodes([]);
    setNetworkLinks([]);

    const simulation = d3.forceSimulation<NetworkNode>(nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))
      .alphaTarget(0)        // 안정화되면 정지 (50명 동시 접속 시 CPU 절약)
      .alphaDecay(0.04)
      .on('tick', () => {
        setNetworkNodes([...nodes]);
        setNetworkLinks([...links]);
      });

    simulationRef.current = simulation;

    // Responsive center update
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width: newWidth, height: newHeight } = entries[0].contentRect;
        simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
        simulation.alpha(0.3).restart();
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      simulation.stop();
      resizeObserver.disconnect();
    };
  }, [courseUsers, courseInterests, keywordGroups]);

  // Zoom behavior
  useEffect(() => {
    if (!svgRef.current) return;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    zoomRef.current = zoom;
    d3.select(svgRef.current).call(zoom);

    // Initial centering if needed
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      // We don't force a transform here to let the simulation center naturally,
      // but we could use zoom.transform to set an initial state.
    }
  }, []);

  const handleSendTeaTime = (toUserId: string, message?: string) => {
    const finalMsg = message || teaTimeMsg;
    if (!finalMsg.trim()) {
      showToast('메시지를 입력해주세요.', 'error');
      return;
    }
    sendTeaTimeRequest({
      id: genId('tt'),
      fromUserId: currentUser!.id,
      toUserId,
      message: finalMsg,
      status: 'pending'
    });
    setTeaTimeMsg('');
    setSelectedUser(null);
    showToast('티타임 요청을 보냈습니다.', 'success');
  };

  const selectedKeywordInterests = useMemo(() => {
    if (!selectedKeyword) return [];
    const interests = courseInterests.filter(i => groupKeyOf(i) === selectedKeyword);
    
    return [...interests].sort((a, b) => {
      // 1순위: 본인 데이터 (Current User First)
      if (a.userId === currentUser?.id && b.userId !== currentUser?.id) return -1;
      if (a.userId !== currentUser?.id && b.userId === currentUser?.id) return 1;

      // 2순위: 정렬 설정
      if (sortConfig.key === 'type') {
        const order = sortConfig.direction === 'asc' ? 1 : -1;
        return a.type.localeCompare(b.type) * order;
      } else {
        const uA = courseUsers.find(u => u.id === a.userId)?.name || '';
        const uB = courseUsers.find(u => u.id === b.userId)?.name || '';
        const order = sortConfig.direction === 'asc' ? 1 : -1;
        return uA.localeCompare(uB) * order;
      }
    });
  }, [selectedKeyword, courseInterests, currentUser, sortConfig, courseUsers]);

  const selectedUserInterests = useMemo(() => {
    if (!selectedUser) return [];
    return db.interests.filter(i => i.userId === selectedUser.id);
  }, [selectedUser, db.interests]);

  const handleNodePointerDown = (e: React.PointerEvent, node: NetworkNode) => {
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialFx = node.x!;
    const initialFy = node.y!;

    node.fx = initialFx;
    node.fy = initialFy;
    simulationRef.current?.alphaTarget(0.3).restart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / transform.k;
      const dy = (moveEvent.clientY - startY) / transform.k;
      node.fx = initialFx + dx;
      node.fy = initialFy + dy;
    };

    const handlePointerUp = () => {
      simulationRef.current?.alphaTarget(0.1); // Keep moving at base speed
      node.fx = null;
      node.fy = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.75);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen bg-background' : `relative w-full ${adminCourseId ? 'h-[800px]' : 'h-full'}`} bg-background overflow-hidden select-none touch-none`}
    >
      <Toast toast={toast} />
      {/* Visualization Area */}
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <defs>
          <marker
            id="arrow-giver"
            viewBox="0 0 10 10"
            refX="24"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M2,2 L8,5 L2,8" fill="none" stroke="#002c5f" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <marker
            id="arrow-taker"
            viewBox="0 0 10 10"
            refX="19"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M2,2 L8,5 L2,8" fill="none" stroke="#00aad2" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>
        <g transform={transform.toString()}>
          {/* Links */}
          {networkLinks.map((link, i) => {
            const source = link.source as NetworkNode;
            const target = link.target as NetworkNode;
            
            // GIVER: User -> Keyword (Arrow points to Keyword)
            // TAKER: Keyword -> User (Arrow points to User)
            const isGiver = link.type === 'giver';
            const x1 = isGiver ? source.x : target.x;
            const y1 = isGiver ? source.y : target.y;
            const x2 = isGiver ? target.x : source.x;
            const y2 = isGiver ? target.y : source.y;

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isGiver ? '#002c5f' : '#00aad2'}
                strokeWidth={0.75}
                strokeOpacity={0.6}
                markerEnd={isGiver ? "url(#arrow-giver)" : "url(#arrow-taker)"}
              />
            );
          })}
          {/* Nodes */}
          {networkNodes.map(node => (
            <g 
              key={node.id} 
              transform={`translate(${node.x},${node.y})`}
              className="group"
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                simulationRef.current?.alphaTarget(0.2).restart();
                if (node.type === 'user') {
                  if (node.data.id === currentUser?.id) {
                    setShowPersonalNetwork(true);
                  } else {
                    setSelectedUser(node.data);
                  }
                } else {
                  // Extract canonical ID from node.id (which is "kw-{id}")
                  const id = node.id.replace('kw-', '');
                  setSelectedKeyword(id);
                }
                // Reset alpha target after a short delay to keep it moving
                setTimeout(() => simulationRef.current?.alphaTarget(0.1), 500);
              }}
            >
              {node.type === 'user' && node.data?.id === currentUser?.id && (
                <circle
                  r={22}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth={2}
                  className="animate-pulse"
                />
              )}
              <circle
                r={node.type === 'user'
                  ? (node.data?.id === currentUser?.id ? 16 : 8)
                  : 12}
                fill={node.type === 'user' && node.data?.id === currentUser?.id ? '#22c55e' : node.color}
                fillOpacity={0.9}
                stroke="white"
                strokeWidth={2}
                className="transition-transform duration-200 group-hover:scale-110"
              />
              <text
                textAnchor="middle"
                dy={node.type === 'user'
                  ? (node.data?.id === currentUser?.id ? 30 : 20)
                  : 25}
                className={`text-xs font-sans font-bold pointer-events-none uppercase tracking-tight ${node.type === 'user' && node.data?.id === currentUser?.id ? 'fill-green-600' : 'fill-on-surface'}`}
                style={{ 
                  paintOrder: 'stroke',
                  stroke: '#ffffff',
                  strokeWidth: '3px',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round'
                }}
              >
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Refresh & FullScreen Buttons */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button 
          onClick={toggleFullScreen}
          className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-outline flex items-center justify-center shadow-lg hover:bg-white transition-all text-on-surface-variant"
          title={isFullScreen ? "전체화면 나가기" : "전체화면"}
        >
          <span className="material-symbols-outlined">
            {isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-outline flex items-center justify-center shadow-lg hover:bg-white transition-all ${isRefreshing ? 'animate-spin' : ''}`}
          title="새로고침"
        >
          <span className="material-symbols-outlined text-on-surface-variant">refresh</span>
        </button>
      </div>

      {/* Legend & Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 z-30">
        <div className="bg-white/80 backdrop-blur-md px-4 py-3 rounded-xl border border-outline shadow-sm">
          <div className="text-xs uppercase tracking-widest text-on-surface-variant font-black mb-2">
            Network Map
          </div>
          <div className="flex items-center gap-4">
            <>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-primary relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 border-t border-r border-primary rotate-45"></div>
                </div>
                <span className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Giver</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-secondary relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 border-t border-r border-secondary rotate-45"></div>
                </div>
                <span className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Taker</span>
              </div>
            </>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-outline/20 shadow-sm flex flex-col gap-2 w-fit">
          <button 
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
            title="Zoom In"
          >
            <span className="material-symbols-outlined text-xl">add</span>
          </button>
          <div className="h-px bg-outline/10 mx-1"></div>
          <button 
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined text-xl">remove</span>
          </button>
          <div className="h-px bg-outline/10 mx-1"></div>
          <button 
            onClick={handleReset}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant"
            title="Reset"
          >
            <span className="material-symbols-outlined text-xl">restart_alt</span>
          </button>
          <div className="text-[11px] font-bold text-center text-on-surface-variant/60">{Math.round(transform.k * 100)}%</div>
        </div>
      </div>

      {/* Keyword Popup */}
      <AnimatePresence>
        {selectedKeyword && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedKeyword(null)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-surface w-full max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-outline">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-headline font-black text-3xl text-primary uppercase tracking-tight">#{getKeywordName(selectedKeyword)}</h3>
                      {adminCourseId && (
                        <div className="flex gap-2">
                          <span className="bg-primary text-on-primary text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest">Admin View</span>
                          <div className="flex items-center gap-2 bg-surface-container-highest px-2 py-0.5 rounded border border-outline">
                            <span className="text-[11px] font-black text-primary">G: {courseInterests.filter(i => groupKeyOf(i) === selectedKeyword && i.type === 'giver').length}</span>
                            <span className="text-[11px] font-black text-secondary">T: {courseInterests.filter(i => groupKeyOf(i) === selectedKeyword && i.type === 'taker').length}</span>
                          </div>
                        </div>
                      )}
                      <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-md">
                        <p className="text-xs font-black text-primary flex items-center gap-1.5 uppercase tracking-widest">
                          <span className="material-symbols-outlined text-[14px]">tips_and_updates</span>
                          {(() => {
                            const interests = courseInterests.filter(i => groupKeyOf(i) === selectedKeyword && i.userId !== currentUser?.id);
                            if (interests.length === 0) return '캐쥬얼한 모임 추천';
                            const giverCount = interests.filter(i => i.type === 'giver').length;
                            const takerCount = interests.filter(i => i.type === 'taker').length;
                            const total = interests.length;
                            if (takerCount / total >= 0.75) return '전문가를 섭외하는 학습 모임 추천';
                            if (giverCount / total >= 0.75) return '업무 노하우를 적극 공유하는 심화 논의, 컨퍼런스 추천';
                            return '캐쥬얼한 모임 추천';
                          })()}
                        </p>
                      </div>
                    </div>
                    {/* Hashtags of related keywords */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {((keywordGroups[selectedKeyword] || []) as string[]).map(kw => (
                        <span key={kw} className="text-xs bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-md border border-outline font-black uppercase tracking-widest">#{kw}</span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setSelectedKeyword(null)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                    <span className="material-symbols-outlined text-on-surface-variant">close</span>
                  </button>
                </div>
              </div>

              {/* Content List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-on-surface-variant uppercase tracking-widest">참여 리더 리스트</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSortConfig({ key: 'type', direction: sortConfig.key === 'type' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className={`text-xs font-black px-2 py-1 rounded-md border transition-colors uppercase tracking-widest ${sortConfig.key === 'type' ? 'bg-primary text-on-primary border-primary' : 'bg-white border-outline text-on-surface-variant'}`}
                    >
                      구분 {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </button>
                    <button 
                      onClick={() => setSortConfig({ key: 'name', direction: sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                      className={`text-xs font-black px-2 py-1 rounded-md border transition-colors uppercase tracking-widest ${sortConfig.key === 'name' ? 'bg-primary text-on-primary border-primary' : 'bg-white border-outline text-on-surface-variant'}`}
                    >
                      이름 {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </button>
                  </div>
                </div>

                {selectedKeywordInterests.map(interest => {
                  const u = courseUsers.find(user => user.id === interest.userId);
                  if (!u) return null;
                  const isMe = u.id === currentUser?.id;
                  return (
                    <div 
                      key={interest.id} 
                      className={`${isMe ? 'bg-primary/5 border-primary shadow-lg ring-1 ring-primary/20' : 'bg-white border-outline shadow-sm'} rounded-xl border p-4 hover:border-primary transition-all group cursor-pointer`}
                      onClick={() => { setSelectedUser(u); setSelectedKeyword(null); }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${isMe ? 'bg-primary/10 border-primary/20' : 'bg-surface-container-low border-outline'} overflow-hidden flex items-center justify-center border`}>
                            {u.profilePic ? (
                              <img src={u.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="material-symbols-outlined text-5xl text-primary/40">face</span>
                            )}
                          </div>
                            <div>
                              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">{u.company} • {u.department}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-base font-black text-on-surface">{u.name}</p>
                                {isMe && <span className="text-[11px] font-black bg-primary text-on-primary px-1.5 py-0.5 rounded uppercase tracking-widest">나</span>}
                              </div>
                              <p className="text-xs text-on-surface-variant font-medium uppercase tracking-widest">{u.title}</p>
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-md font-black text-xs uppercase border ${interest.type === 'giver' ? 'bg-primary text-on-primary border-primary' : 'bg-secondary text-on-secondary border-secondary'}`}>
                          {interest.type === 'giver' ? 'Giver' : 'Taker'}
                        </span>
                      </div>
                      <div className={`${isMe ? 'bg-white/60' : 'bg-surface-container-low'} rounded-lg p-3 border border-outline`}>
                        <p className="text-xs font-black text-primary mb-1 uppercase tracking-widest">#{interest.keyword}</p>
                        <p className="text-sm text-on-surface-variant leading-relaxed font-medium">
                          {interest.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Detail Popup */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
            onClick={() => setSelectedUser(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-xl border-t-8 border-primary max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline">
                    {selectedUser.profilePic ? (
                      <img src={selectedUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="material-symbols-outlined text-8xl text-primary/40">face</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-on-surface-variant uppercase font-bold tracking-widest">{selectedUser.company} • {selectedUser.department}</p>
                    <h3 className="font-headline font-black text-3xl text-on-surface uppercase tracking-tight">{selectedUser.name}</h3>
                    <p className="text-base text-secondary font-black uppercase tracking-widest">{selectedUser.title}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant">close</span>
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="flex items-center gap-1.5 min-w-0 overflow-hidden text-primary">
                    <span className="material-symbols-outlined text-base shrink-0">volunteer_activism</span>
                    <span className="text-xs font-black uppercase tracking-widest shrink-0">Giver</span>
                    <span className="text-[11px] font-normal normal-case tracking-normal text-on-surface-variant truncate">· 도움을 드릴 수 있어요.</span>
                  </h4>
                  <div className="grid gap-3">
                    {selectedUserInterests.filter(i => i.type === 'giver').map(i => (
                      <div key={i.id} className="bg-white p-4 rounded-lg border border-outline shadow-sm">
                        <p className="text-xs font-black text-primary mb-1 uppercase tracking-widest">#{i.keyword}</p>
                        <p className="text-sm text-on-surface-variant font-medium leading-relaxed">{i.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="flex items-center gap-1.5 min-w-0 overflow-hidden text-secondary">
                    <span className="material-symbols-outlined text-base shrink-0">pan_tool</span>
                    <span className="text-xs font-black uppercase tracking-widest shrink-0">Taker</span>
                    <span className="text-[11px] font-normal normal-case tracking-normal text-on-surface-variant truncate">· 도움을 받고 싶어요.</span>
                  </h4>
                  <div className="grid gap-3">
                    {selectedUserInterests.filter(i => i.type === 'taker').map(i => (
                      <div key={i.id} className="bg-white p-4 rounded-lg border border-outline shadow-sm">
                        <p className="text-xs font-black text-secondary mb-1 uppercase tracking-widest">#{i.keyword}</p>
                        <p className="text-sm text-on-surface-variant font-medium leading-relaxed">{i.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {selectedUser.id !== currentUser?.id && (
                  <div className="space-y-4 pt-6 border-t border-outline">
                    <h4 className="text-xs font-black text-on-surface uppercase tracking-widest">티타임 요청</h4>
                    <p className="text-xs text-on-surface-variant font-medium mb-2">
                      {selectedUser.name}님에게 구체적인 일정과 장소를 기재하여 티타임을 제안해보세요.
                    </p>
                    <textarea 
                      value={teaTimeMsg}
                      onChange={e => setTeaTimeMsg(e.target.value)}
                      placeholder={`${selectedUser.name}님에게 보낼 짧은 메시지를 작성하세요...`}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-4 text-base resize-none outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                      rows={4}
                    />
                    <div className="flex flex-wrap gap-2">
                      {db.interests.filter((i: any) => i.userId === currentUser?.id).map((i: any) => (
                        <span key={i.id} className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md border border-primary/20">
                          #{i.keyword}
                        </span>
                      ))}
                    </div>
                    <button 
                      onClick={() => {
                        const myInterests = db.interests.filter((i: any) => i.userId === currentUser?.id);
                        const myHashtags = myInterests.map((i: any) => `#${i.keyword}`).join(' ');
                        const finalMsg = `${myHashtags}\n\n${teaTimeMsg}`;
                        handleSendTeaTime(selectedUser.id, finalMsg);
                      }}
                      className="w-full py-4 bg-primary text-on-primary font-black rounded-lg shadow-lg hover:bg-secondary transition-all uppercase tracking-widest"
                    >
                      요청 보내기
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Personal Network Map Popup */}
      <AnimatePresence>
        {showPersonalNetwork && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setShowPersonalNetwork(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-outline flex justify-between items-center bg-surface-container-low">
                <div>
                  <h3 className="font-headline font-black text-2xl text-primary uppercase tracking-tight">Personal Network Map</h3>
                  <p className="text-sm text-on-surface-variant font-medium">나와 연결된 키워드와 동료들을 한눈에 확인해보세요.</p>
                </div>
                <button onClick={() => setShowPersonalNetwork(false)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="flex-1 relative bg-background">
                <PersonalNetworkMap 
                  currentUser={currentUser!} 
                  db={db} 
                  onSelectUser={setSelectedUser}
                  onSelectKeyword={setSelectedKeyword}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PersonalNetworkMap({ currentUser, db, onSelectUser, onSelectKeyword }: { 
  currentUser: User, 
  db: any,
  onSelectUser: (user: User) => void,
  onSelectKeyword: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const simulationRef = useRef<d3.Simulation<NetworkNode, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const initSimulation = () => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. 같은 과정 interest 만 사용해 도메인-스코프된 그룹 인덱스 빌드
    const courseInterests = db.interests.filter((i: any) => {
      const u = db.users.find((x: any) => x.id === i.userId);
      return u && u.courseId === currentUser.courseId;
    });
    const idx = buildInterestKeyIndex(courseInterests, db.canonicalTerms);

    const myInterests = courseInterests.filter((i: any) => i.userId === currentUser.id);
    const myKeywordIds = new Set(myInterests.map((i: any) => idx.groupOf(i.id)));

    const simulationNodes: NetworkNode[] = [];
    const simulationLinks: NetworkLink[] = [];

    // Add Me
    simulationNodes.push({
      id: `user-${currentUser.id}`,
      type: 'user',
      label: currentUser.name,
      color: '#000080',
      data: currentUser
    });

    // Add Keywords
    myKeywordIds.forEach((id: any) => {
      const name = idx.groups.get(id)?.displayName || id;
      simulationNodes.push({
        id: `kw-${id}`,
        type: 'keyword',
        label: name,
        color: '#87CEEB'
      });

      // Link me to keyword
      const myInt = myInterests.find((i: any) => idx.groupOf(i.id) === id);
      if (myInt) {
        simulationLinks.push({
          source: `user-${currentUser.id}`,
          target: `kw-${id}`,
          type: myInt.type
        });
      }

      // Add other users connected to this keyword (same group)
      courseInterests.forEach((i: any) => {
        if (idx.groupOf(i.id) === id && i.userId !== currentUser.id) {
          const u = db.users.find((user: any) => user.id === i.userId);
          if (u) {
            if (!simulationNodes.find(n => n.id === `user-${u.id}`)) {
              simulationNodes.push({
                id: `user-${u.id}`,
                type: 'user',
                label: u.name,
                color: '#000080',
                data: u
              });
            }
            simulationLinks.push({
              source: `kw-${id}`,
              target: `user-${u.id}`,
              type: i.type
            });
          }
        }
      });
    });

    if (simulationRef.current) simulationRef.current.stop();

    const simulation = d3.forceSimulation<NetworkNode>(simulationNodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(simulationLinks).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60))
      .on('tick', () => {
        setNodes([...simulationNodes]);
        setLinks([...simulationLinks]);
      });

    simulationRef.current = simulation;
  };

  useEffect(() => {
    initSimulation();

    if (svgRef.current && gRef.current) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', (event) => {
          d3.select(gRef.current).attr('transform', event.transform);
        });
      
      d3.select(svgRef.current).call(zoom);
      zoomRef.current = zoom;
    }

    return () => simulationRef.current?.stop();
  }, [currentUser, db]);

  const handleZoom = (delta: number) => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(zoomRef.current.scaleBy as any, delta);
    }
  };

  const handleRefresh = () => {
    initSimulation();
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  const handleNodePointerDown = (e: React.PointerEvent, node: NetworkNode) => {
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialFx = node.x!;
    const initialFy = node.y!;

    node.fx = initialFx;
    node.fy = initialFy;
    simulationRef.current?.alphaTarget(0.3).restart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!svgRef.current) return;
      const t = d3.zoomTransform(svgRef.current);
      const dx = (moveEvent.clientX - startX) / t.k;
      const dy = (moveEvent.clientY - startY) / t.k;
      node.fx = initialFx + dx;
      node.fy = initialFy + dy;
    };

    const handlePointerUp = () => {
      simulationRef.current?.alphaTarget(0);
      node.fx = null;
      node.fy = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleNodeClick = (e: React.MouseEvent, node: NetworkNode) => {
    e.stopPropagation();
    if (node.type === 'user') {
      if (node.data.id !== currentUser.id) {
        onSelectUser(node.data);
      }
    } else {
      const id = node.id.replace('kw-', '');
      onSelectKeyword(id);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <g ref={gRef}>
          {links.map((link, i) => {
            const source = link.source as NetworkNode;
            const target = link.target as NetworkNode;
            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={link.type === 'giver' ? '#000080' : '#87CEEB'}
                strokeWidth={1}
                strokeOpacity={0.4}
              />
            );
          })}
          {nodes.map(node => (
            <g 
              key={node.id} 
              transform={`translate(${node.x},${node.y})`}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              onClick={(e) => handleNodeClick(e, node)}
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
            >
              {node.type === 'user' && node.data?.id === currentUser.id && (
                <circle r={26} fill="none" stroke="#22c55e" strokeWidth={2} className="animate-pulse" />
              )}
              <circle
                r={node.type === 'user'
                  ? (node.data?.id === currentUser.id ? 20 : 10)
                  : 14}
                fill={node.type === 'user' && node.data?.id === currentUser.id ? '#22c55e' : node.color}
                stroke="white"
                strokeWidth={2}
              />
              <text
                textAnchor="middle"
                dy={node.type === 'user'
                  ? (node.data?.id === currentUser.id ? 34 : 22)
                  : 28}
                className={`text-xs font-bold fill-on-surface pointer-events-none uppercase tracking-tight ${node.type === 'user' && node.data?.id === currentUser.id ? 'fill-green-600' : ''}`}
                style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: '3px' }}
              >
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button 
          onClick={() => handleZoom(1.2)}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-surface-container-low transition-colors border border-outline"
        >
          <span className="material-symbols-outlined text-on-surface">add</span>
        </button>
        <button 
          onClick={() => handleZoom(0.8)}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-surface-container-low transition-colors border border-outline"
        >
          <span className="material-symbols-outlined text-on-surface">remove</span>
        </button>
        <button 
          onClick={handleRefresh}
          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-surface-container-low transition-colors border border-outline"
        >
          <span className="material-symbols-outlined text-on-surface">refresh</span>
        </button>
      </div>
    </div>
  );
}
