import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, User, Interest } from '../store';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
interface PeopleNode extends d3.SimulationNodeDatum {
  id: string;        // user id
  label: string;
  isMe: boolean;
  data: User;
}

interface PeopleLink extends d3.SimulationLinkDatum<PeopleNode> {
  weight: number;    // 공유 키워드 수
}

export default function PeopleMap({ adminCourseId }: { adminCourseId?: string }) {
  const { db, currentUser, sendTeaTimeRequest, fetchData } = useStore();
  const effectiveCourseId = adminCourseId || currentUser?.courseId;

  // ── refs & state ────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<PeopleNode, PeopleLink> | null>(null);

  const [nodes, setNodes] = useState<PeopleNode[]>([]);
  const [links, setLinks] = useState<PeopleLink[]>([]);
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [teaTimeMsg, setTeaTimeMsg] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── data ───────────────────────────────────────────────────────────────────
  const courseUsers = useMemo(
    () => db.users.filter(u => u.courseId === effectiveCourseId),
    [db.users, effectiveCourseId]
  );

  const courseInterests = useMemo(() => {
    const ids = new Set(courseUsers.map(u => u.id));
    return db.interests.filter((i: Interest) => ids.has(i.userId));
  }, [db.interests, courseUsers]);

  const myInterests = useMemo(
    () => db.interests.filter((i: Interest) => i.userId === currentUser?.id),
    [db.interests, currentUser]
  );

  const selectedUserInterests = useMemo(
    () => (selectedUser ? db.interests.filter((i: Interest) => i.userId === selectedUser.id) : []),
    [db.interests, selectedUser]
  );

  // ── build graph ─────────────────────────────────────────────────────────────
  /** 유저별 정규화 키워드 Set */
  const userKeywordMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    courseUsers.forEach(u => {
      map.set(u.id, new Set(
        courseInterests
          .filter((i: Interest) => i.userId === u.id)
          .map((i: Interest) => (i.canonicalId || i.keyword) as string)
      ));
    });
    return map;
  }, [courseUsers, courseInterests]);

  // ── D3 simulation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || courseUsers.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Build nodes
    const simNodes: PeopleNode[] = courseUsers.map(u => ({
      id: u.id,
      label: u.name,
      isMe: u.id === currentUser?.id,
      data: u,
    }));

    // Build links: connect every pair sharing ≥1 keyword
    const simLinks: PeopleLink[] = [];
    for (let i = 0; i < courseUsers.length; i++) {
      for (let j = i + 1; j < courseUsers.length; j++) {
        const kwA = userKeywordMap.get(courseUsers[i].id) || new Set<string>();
        const kwB = userKeywordMap.get(courseUsers[j].id) || new Set<string>();
        let shared = 0;
        for (const kw of kwA) { if (kwB.has(kw)) shared++; }
        if (shared > 0) {
          simLinks.push({ source: courseUsers[i].id, target: courseUsers[j].id, weight: shared });
        }
      }
    }

    const maxWeight = Math.max(1, ...simLinks.map(l => l.weight));

    const simulation = d3.forceSimulation<PeopleNode, PeopleLink>(simNodes)
      .force('link', d3.forceLink<PeopleNode, PeopleLink>(simLinks)
        .id(d => d.id)
        .distance(d => Math.max(60, 160 - d.weight * 20))
        .strength(d => Math.min(1, 0.2 + d.weight * 0.1))
      )
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(28))
      .alphaTarget(0.05)
      .on('tick', () => {
        setNodes([...simNodes]);
        setLinks([...simLinks]);
      });

    simulationRef.current = simulation;

    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect;
      simulation.force('center', d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.3).restart();
    });
    ro.observe(containerRef.current);

    return () => { simulation.stop(); ro.disconnect(); };
  }, [courseUsers, userKeywordMap, currentUser]);

  // ── zoom ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', e => setTransform(e.transform));
    zoomRef.current = zoom;
    d3.select(svgRef.current).call(zoom);
  }, []);

  // ── fullscreen ─────────────────────────────────────────────────────────────
  const toggleFullScreen = () => {
    const el = containerRef.current as any;
    if (!isFullScreen) {
      try {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } catch {}
      setIsFullScreen(true);
    } else {
      try {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      } catch {}
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullScreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // ── zoom controls ──────────────────────────────────────────────────────────
  const handleZoomIn  = () => svgRef.current && zoomRef.current && d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  const handleZoomOut = () => svgRef.current && zoomRef.current && d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  const handleReset   = () => svgRef.current && zoomRef.current && d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);

  // ── drag ───────────────────────────────────────────────────────────────────
  const handleNodePointerDown = (e: React.PointerEvent, node: PeopleNode) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const initFx = node.x!, initFy = node.y!;
    node.fx = initFx; node.fy = initFy;
    simulationRef.current?.alphaTarget(0.3).restart();

    const onMove = (me: PointerEvent) => {
      node.fx = initFx + (me.clientX - startX) / transform.k;
      node.fy = initFy + (me.clientY - startY) / transform.k;
    };
    const onUp = () => {
      simulationRef.current?.alphaTarget(0.05);
      node.fx = null; node.fy = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── tea time ───────────────────────────────────────────────────────────────
  const handleSendTeaTime = (toUserId: string) => {
    if (!teaTimeMsg.trim()) { alert('메시지를 입력해주세요.'); return; }
    const hashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
    sendTeaTimeRequest({ id: Date.now().toString(), fromUserId: currentUser!.id, toUserId, message: `${hashtags}\n\n${teaTimeMsg}`, status: 'pending' });
    alert('티타임 요청을 보냈습니다.');
    setTeaTimeMsg('');
    setSelectedUser(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await fetchData(); } finally { setIsRefreshing(false); }
  };

  // ── edge stroke scale ──────────────────────────────────────────────────────
  const maxWeight = Math.max(1, ...links.map(l => l.weight));
  const edgeStroke = (w: number) => Math.max(1, (w / maxWeight) * 10);
  const edgeOpacity = (w: number) => Math.min(0.9, 0.2 + (w / maxWeight) * 0.7);

  // ── node color ─────────────────────────────────────────────────────────────
  const nodeColor = (node: PeopleNode) => node.isMe ? '#1d4ed8' : '#002c5f';

  return (
    <div
      ref={containerRef}
      className={`${isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : `relative w-full ${adminCourseId ? 'h-[800px]' : 'h-full'}`} bg-background overflow-hidden select-none touch-none`}
    >
      {/* SVG canvas */}
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <g transform={transform.toString()}>
          {/* Edges */}
          {links.map((link, i) => {
            const s = link.source as PeopleNode;
            const t = link.target as PeopleNode;
            if (!s.x || !t.x) return null;
            const mx = (s.x + t.x) / 2;
            const my = (s.y! + t.y!) / 2;
            return (
              <g key={i}>
                <line
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke="#00aad2"
                  strokeWidth={edgeStroke(link.weight)}
                  strokeOpacity={edgeOpacity(link.weight)}
                  strokeLinecap="round"
                />
                {/* 공유 키워드 수 라벨 */}
                {link.weight >= 2 && (
                  <text
                    x={mx} y={my}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fontWeight="bold"
                    fill="#00aad2"
                    style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: '2px' }}
                  >
                    {link.weight}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
              style={{ cursor: 'pointer', pointerEvents: 'all' }}
              onPointerDown={e => handleNodePointerDown(e, node)}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                simulationRef.current?.alphaTarget(0.2).restart();
                setSelectedUser(node.data);
                setTimeout(() => simulationRef.current?.alphaTarget(0.05), 500);
              }}
            >
              {/* "나" 강조 링 */}
              {node.isMe && (
                <circle r={17} fill="none" stroke="#3b82f6" strokeWidth={2.5} className="animate-pulse" />
              )}
              <circle
                r={13}
                fill={nodeColor(node)}
                fillOpacity={0.9}
                stroke="white"
                strokeWidth={2.5}
              />
              {/* 프로필 이니셜 */}
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontWeight="bold"
                fill="white"
                pointerEvents="none"
              >
                {node.label.charAt(0)}
              </text>
              {/* 이름 라벨 */}
              <text
                textAnchor="middle"
                dy={26}
                fontSize={10}
                fontWeight="bold"
                fill={node.isMe ? '#1d4ed8' : '#1c1c1c'}
                pointerEvents="none"
                style={{ paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: '3px', strokeLinecap: 'round', strokeLinejoin: 'round' }}
              >
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Top-right: Fullscreen + Refresh */}
      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button onClick={toggleFullScreen}
          className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-outline flex items-center justify-center shadow-lg hover:bg-white transition-all text-on-surface-variant"
          title={isFullScreen ? '전체화면 나가기' : '전체화면'}>
          <span className="material-symbols-outlined">{isFullScreen ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
        <button onClick={handleRefresh} disabled={isRefreshing}
          className={`w-10 h-10 rounded-full bg-white/80 backdrop-blur-md border border-outline flex items-center justify-center shadow-lg hover:bg-white transition-all ${isRefreshing ? 'animate-spin' : ''}`}
          title="새로고침">
          <span className="material-symbols-outlined text-on-surface-variant">refresh</span>
        </button>
      </div>

      {/* Top-left: Legend + Zoom controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 z-30">
        {/* Legend */}
        <div className="bg-white/80 backdrop-blur-md px-4 py-3 rounded-xl border border-outline shadow-sm space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-black">People Map</div>
          <div className="flex flex-col gap-1.5 text-[10px] text-on-surface-variant font-medium">
            <div className="flex items-center gap-2">
              <div className="w-8 h-1 rounded-full bg-[#00aad2]" style={{ opacity: 0.9 }} />
              <span>굵을수록 공유 키워드 多</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#002c5f] border-2 border-white shadow-sm" />
              <span>리더</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#1d4ed8] border-2 border-white shadow-sm" />
              <span>나</span>
            </div>
          </div>
        </div>

        {/* Zoom buttons */}
        <div className="bg-white/80 backdrop-blur-md p-2 rounded-xl border border-outline/20 shadow-sm flex flex-col gap-2 w-fit">
          <button onClick={handleZoomIn} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant" title="Zoom In">
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
          <div className="h-px bg-outline/10 mx-1" />
          <button onClick={handleZoomOut} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant" title="Zoom Out">
            <span className="material-symbols-outlined text-lg">remove</span>
          </button>
          <div className="h-px bg-outline/10 mx-1" />
          <button onClick={handleReset} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container-highest transition-colors text-on-surface-variant" title="Reset">
            <span className="material-symbols-outlined text-lg">restart_alt</span>
          </button>
          <div className="text-[9px] font-bold text-center text-on-surface-variant/60">{Math.round(transform.k * 100)}%</div>
        </div>
      </div>

      {/* Empty state */}
      {courseUsers.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant/40 gap-3">
          <span className="material-symbols-outlined text-6xl">group_off</span>
          <p className="text-sm font-bold">등록된 리더가 없습니다.</p>
        </div>
      )}

      {/* User detail popup + Tea time */}
      <AnimatePresence>
        {selectedUser && currentUser && (
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
              {/* Profile header */}
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline">
                    {selectedUser.profilePic
                      ? <img src={selectedUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="material-symbols-outlined text-6xl text-primary/40">face</span>}
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">{selectedUser.company} · {selectedUser.department}</p>
                    <h3 className="font-headline font-black text-xl text-on-surface uppercase tracking-tight">{selectedUser.name}</h3>
                    <p className="text-sm text-secondary font-black uppercase tracking-widest">{selectedUser.title}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                  <span className="material-symbols-outlined text-on-surface-variant">close</span>
                </button>
              </div>

              {/* 공유 키워드 수 표시 */}
              {selectedUser.id !== currentUser.id && (() => {
                const myKws = userKeywordMap.get(currentUser.id) || new Set<string>();
                const theirKws = userKeywordMap.get(selectedUser.id) || new Set<string>();
                const shared = [...myKws].filter(k => theirKws.has(k)).length;
                return shared > 0 ? (
                  <div className="mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="text-xs font-bold text-primary">
                      나와 공유 키워드 <span className="text-lg">{shared}</span>개
                    </p>
                  </div>
                ) : null;
              })()}

              {/* Interests */}
              <div className="space-y-4 mb-6">
                {(['giver', 'taker'] as const).map(type => {
                  const items = selectedUserInterests.filter(i => i.type === type);
                  if (items.length === 0) return null;
                  return (
                    <div key={type} className="space-y-2">
                      <h4 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${type === 'giver' ? 'text-primary' : 'text-secondary'}`}>
                        <span className="material-symbols-outlined text-sm">{type === 'giver' ? 'volunteer_activism' : 'pan_tool'}</span>
                        {type === 'giver' ? 'be Giver' : 'be Taker'}
                      </h4>
                      {items.map(i => (
                        <div key={i.id} className="bg-surface-container-low p-3 rounded-xl border border-outline">
                          <p className={`text-sm font-bold mb-1 ${type === 'giver' ? 'text-primary' : 'text-secondary'}`}>#{i.keyword}</p>
                          <p className="text-xs text-on-surface-variant">{i.description}</p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Tea time request (inline) */}
              {selectedUser.id !== currentUser.id && (
                <div className="space-y-3 pt-4 border-t border-outline">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">티타임 요청</h4>
                  <p className="text-[10px] text-on-surface-variant">
                    {selectedUser.name}님에게 구체적인 일정과 장소를 기재하여 티타임을 제안해보세요.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {myInterests.map(i => (
                      <span key={i.id} className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20">#{i.keyword}</span>
                    ))}
                  </div>
                  <textarea
                    value={teaTimeMsg}
                    onChange={e => setTeaTimeMsg(e.target.value)}
                    placeholder={`${selectedUser.name}님에게 보낼 메시지를 작성하세요...`}
                    className="w-full bg-surface-container-low border border-outline rounded-xl p-4 text-sm resize-none outline-none focus:border-primary"
                    rows={3}
                  />
                  <button
                    onClick={() => handleSendTeaTime(selectedUser.id)}
                    className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                  >
                    요청 보내기
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
