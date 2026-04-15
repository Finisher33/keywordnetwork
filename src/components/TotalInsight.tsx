import { useMemo, useState, useRef, useEffect } from 'react';
import { useStore, UserInsight } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeInsights } from '../services/geminiService';

interface TotalInsightProps {
  courseId: string;
}

export default function TotalInsight({ courseId }: TotalInsightProps) {
  const { db, fetchData } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 1. Network Insights - Tea Time
  const teaTimeStats = useMemo(() => {
    const courseRequests = db.teaTimeRequests.filter(r => userIds.has(r.fromUserId) || userIds.has(r.toUserId));
    const total = courseRequests.length;
    const accepted = courseRequests.filter(r => r.status === 'accepted').length;
    const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
    return { total, accepted, rate };
  }, [db.teaTimeRequests, userIds]);

  // Keyword Normalization Helper
  const normalize = (kw: string) => kw.toLowerCase().replace(/\s+/g, '').trim();

  // 2. Interest Keywords Top 10 & Advanced Network Analysis
  const networkStats = useMemo(() => {
    const courseInterests = db.interests.filter(i => userIds.has(i.userId));
    
    // Top 10 Keywords with Giver/Taker Ratios
    const kwCounts: Record<string, { count: number, items: any[], givers: number, takers: number }> = {};
    courseInterests.forEach(i => {
      const id = i.canonicalId || i.keyword;
      if (!kwCounts[id]) {
        kwCounts[id] = { count: 0, items: [], givers: 0, takers: 0 };
      }
      kwCounts[id].count += 1;
      kwCounts[id].items.push(i);
      if (i.type === 'giver') kwCounts[id].givers += 1;
      else kwCounts[id].takers += 1;
    });

    const top10 = Object.entries(kwCounts)
      .map(([id, data]) => {
        const total = data.givers + data.takers;
        const term = db.canonicalTerms?.find(t => t.id === id);
        return {
          id,
          keyword: term ? term.term : id,
          ...data,
          giverRate: Math.round((data.givers / total) * 100),
          takerRate: Math.round((data.takers / total) * 100)
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Connection Logic & Centrality
    const userKeywords: Record<string, Set<string>> = {};
    courseUsers.forEach(u => {
      const kws = courseInterests.filter(i => i.userId === u.id).map(i => i.canonicalId || i.keyword);
      userKeywords[u.id] = new Set(kws);
    });

    const users = Array.from(userIds) as string[];
    const userPairs: { u1: string, u2: string, weight: number }[] = [];
    let totalDegree = 0;

    users.forEach((uId, i) => {
      let degree = 0;
      const myKws = userKeywords[uId];
      if (!myKws || myKws.size === 0) return;

      users.forEach((otherId, j) => {
        if (uId === otherId) return;
        const otherKws = userKeywords[otherId];
        if (!otherKws) return;

        // Calculate Weight (Intersection Size)
        const intersection = Array.from(myKws).filter(kw => otherKws.has(kw));
        if (intersection.length > 0) {
          degree += 1;
          if (i < j) {
            userPairs.push({ u1: uId, u2: otherId, weight: intersection.length });
          }
        }
      });
      totalDegree += degree;
    });

    // Top 3 Partners (Connection Strength)
    const topPartners = userPairs
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(p => {
        const myKws = userKeywords[p.u1];
        const otherKws = userKeywords[p.u2];
        const intersection = Array.from(myKws).filter(kw => otherKws.has(kw));
        const sharedKeywords = intersection.map(id => {
          const term = db.canonicalTerms?.find(t => t.id === id);
          return term ? term.term : id;
        });

        return {
          user1: db.users.find(u => u.id === p.u1),
          user2: db.users.find(u => u.id === p.u2),
          weight: p.weight,
          sharedKeywords
        };
      });

    // Degree Centrality: Super Keyword & Heavy User
    const superKeyword = top10[0];
    const heavyUser = courseUsers
      .map(u => ({ user: u, count: userKeywords[u.id]?.size || 0 }))
      .sort((a, b) => b.count - a.count)[0];

    // Bridge Keyword (Heuristic)
    // A keyword shared by users who have the most diverse 'other' interests
    const bridgeKeyword = Object.entries(kwCounts)
      .map(([id, data]) => {
        const term = db.canonicalTerms?.find(t => t.id === id);
        const keywordUsers = Array.from(new Set(data.items.map(i => i.userId)));
        if (keywordUsers.length < 2) return { id, keyword: term ? term.term : id, score: 0 };

        // Calculate diversity score: average Jaccard distance of other interests
        let totalDistance = 0;
        let pairs = 0;
        for (let i = 0; i < keywordUsers.length; i++) {
          for (let j = i + 1; j < keywordUsers.length; j++) {
            const kws1 = new Set(userKeywords[keywordUsers[i]]);
            const kws2 = new Set(userKeywords[keywordUsers[j]]);
            kws1.delete(id);
            kws2.delete(id);
            
            const union = new Set([...kws1, ...kws2]);
            if (union.size === 0) continue;
            const intersection = Array.from(kws1).filter(k => kws2.has(k));
            const jaccard = intersection.length / union.size;
            totalDistance += (1 - jaccard);
            pairs++;
          }
        }
        return { id, keyword: term ? term.term : id, score: pairs > 0 ? totalDistance / pairs : 0 };
      })
      .sort((a, b) => b.score - a.score)[0];

    return { 
      top10, 
      totalConnections: totalDegree, 
      topPartners,
      superKeyword,
      heavyUser,
      bridgeKeyword
    };
  }, [db.interests, userIds, courseUsers, db.users, db.canonicalTerms]);

  const sessionStats = useMemo(() => {
    const courseSessions = db.sessions.filter(s => s.courseId === courseId);
    const sessionIds = new Set(courseSessions.map(s => s.id));
    const courseInsights = db.userInsights.filter(i => sessionIds.has(i.sessionId));
    const totalInsightCount = courseInsights.length;

    const groups: Record<string, { count: number, insights: any[], repKeyword: string }> = {};
    courseInsights.forEach(i => {
      const id = i.canonicalId || i.keyword;
      if (!groups[id]) {
        const term = db.canonicalTerms?.find(t => t.id === id);
        groups[id] = { count: 0, insights: [], repKeyword: term ? term.term : i.keyword };
      }
      groups[id].count += 1;
      groups[id].insights.push(i);
    });

    const sorted = Object.entries(groups)
      .map(([id, data]) => {
        const topInsights = data.insights
          .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
          .slice(0, 2);
        
        // Improved heuristic for "Core Insight" summary
        const descriptions = data.insights.map(i => i.description).filter(d => d && d.length > 5);
        let coreInsight = "";
        if (descriptions.length > 0) {
          const mainPoint = descriptions[0].split('.')[0];
          coreInsight = `${data.repKeyword} 키워드에서 학습자분들은 공통적으로 ${mainPoint} 등의 인사이트를 얻으신 것으로 파악됩니다.`;
          if (descriptions.length > 1) {
            const secondPoint = descriptions[1].split('.')[0];
            coreInsight += ` 또한, ${secondPoint}라는 새로운 시각의 의견도 있었습니다.`;
          }
        } else {
          coreInsight = `${data.repKeyword} 관련 핵심 인사이트가 집계 중입니다.`;
        }

        return { 
          id,
          keyword: data.repKeyword, 
          count: data.count, 
          coreInsight,
          topInsights
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const sessionCounts = courseSessions.map(s => {
      const count = courseInsights.filter(i => i.sessionId === s.id).length;
      return { name: s.name, instructor: s.instructor || 'N/A', count };
    }).filter(s => s.count > 0);

    const bestComments = [...courseInsights]
      .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0))
      .slice(0, 3)
      .map(c => {
        const user = db.users.find(u => u.id === c.userId);
        return {
          ...c,
          userName: user?.name || 'Anonymous',
          userCompany: user?.company || 'N/A',
          userDept: user?.department || 'N/A',
          userTitle: user?.title || 'Leader'
        };
      });

    return { top10: sorted, totalInsightCount, sessionCounts, bestComments };
  }, [db.sessions, db.userInsights, db.canonicalTerms, courseId, db.users]);

  // AI Summarization Effect
  useEffect(() => {
    const generateSummaries = async () => {
      if (selectedAnalysisView !== '02' || isSummarizing) return;
      
      const top3 = sessionStats.top10.slice(0, 3);
      const toSummarize = top3.filter(item => !aiSummaries[item.id]);
      
      if (toSummarize.length === 0) return;
      
      setIsSummarizing(true);
      const newSummaries = { ...aiSummaries };
      
      for (const item of toSummarize) {
        const insights = item.topInsights.map((i: any) => i.description);
        const summary = await summarizeInsights(item.keyword, insights);
        newSummaries[item.id] = summary;
      }
      
      setAiSummaries(newSummaries);
      setIsSummarizing(false);
    };
    
    generateSummaries();
  }, [selectedAnalysisView, sessionStats.top10]);

  const selectedInterestKeywordData = useMemo(() => {
    return networkStats.top10.find(k => k.id === selectedInterestKeyword);
  }, [networkStats.top10, selectedInterestKeyword]);

  const selectedKeywordForPopupData = useMemo(() => {
    if (!selectedKeywordForPopup) return null;
    return sessionStats.top10.find(k => k.id === selectedKeywordForPopup);
  }, [sessionStats.top10, selectedKeywordForPopup]);

  return (
    <div 
      ref={containerRef}
      className={`${isFullScreen ? 'fixed inset-0 z-[9999] w-screen h-screen overflow-y-auto' : 'relative p-12 min-h-full'} bg-background text-on-surface font-sans selection:bg-primary selection:text-white`}
    >
      {/* Action Buttons */}
      <div className={`absolute ${isFullScreen ? 'top-4 right-4' : 'top-8 right-12'} z-50 flex gap-3`}>
        <button 
          onClick={toggleFullScreen}
          className="w-12 h-12 rounded-full bg-white border-2 border-primary flex items-center justify-center shadow-xl hover:bg-surface-container-low transition-all text-primary"
          title={isFullScreen ? "전체화면 나가기" : "전체화면"}
        >
          <span className="material-symbols-outlined text-3xl">
            {isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`w-12 h-12 rounded-full bg-white border-2 border-primary flex items-center justify-center shadow-xl hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`}
          title="새로고침"
        >
          <span className="material-symbols-outlined text-primary text-3xl">refresh</span>
        </button>
      </div>

      {/* Hyundai Style Header */}
      <header className="mb-24 border-b-8 border-primary pb-12">
        <h1 className="text-8xl font-black uppercase tracking-tighter leading-[0.85] text-primary">
          Total<br/>Insight
        </h1>
        <div className="mt-10 flex justify-between items-end">
          <p className="text-lg font-bold uppercase tracking-[0.2em] text-on-surface-variant">Course Analysis Report / {courseId}</p>
          <div className="text-right">
            <p className="text-base font-bold uppercase tracking-widest text-secondary">Hyundai Motor Group</p>
            <p className="text-base font-bold uppercase tracking-widest text-primary">Data Intelligence Dashboard</p>
          </div>
        </div>
      </header>

      <div className="mb-12 flex justify-end">
        <div className="relative w-64">
          <select 
            value={selectedAnalysisView}
            onChange={(e) => setSelectedAnalysisView(e.target.value as '01' | '02')}
            className="w-full bg-white border-2 border-primary rounded-xl px-4 py-3 text-sm font-black text-primary outline-none appearance-none cursor-pointer uppercase tracking-widest shadow-sm"
          >
            <option value="01">01. Network Analysis</option>
            <option value="02">02. Learning Insight</option>
          </select>
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-primary">expand_more</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-12">
        
        {/* Network Insights Section */}
        {selectedAnalysisView === '01' && (
          <section className="col-span-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-baseline justify-between border-b-4 border-primary/20 pb-6">
              <h2 className="text-4xl font-black uppercase tracking-tight text-primary">01. Network Analysis</h2>
              {!isNetworkRevealed && (
                <button 
                  onClick={() => setIsNetworkRevealed(true)}
                  className="px-8 py-3 bg-primary text-on-primary text-sm font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 rounded-lg"
                >
                  Reveal Data
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 shadow-sm border border-outline rounded-xl">
                <div className="flex items-center gap-2 mb-8">
                  <span className="material-symbols-outlined text-primary text-sm">send</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">티타임 요청</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-on-surface-variant uppercase">총</span>
                  <span className="text-7xl font-black tracking-tighter tabular-nums text-primary">{teaTimeStats.total}</span>
                  <span className="text-2xl font-bold text-on-surface-variant">회</span>
                </div>
              </div>
              <button 
                onClick={() => setIsTeaTimeModalOpen(true)}
                className="bg-primary text-white p-8 shadow-md rounded-xl hover:bg-primary/90 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2 mb-8">
                  <span className="material-symbols-outlined text-secondary text-sm">task_alt</span>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">티타임 수락률</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-7xl font-black tracking-tighter tabular-nums">{teaTimeStats.rate}%</span>
                  <span className="text-xl font-bold uppercase opacity-80">({teaTimeStats.accepted}회)</span>
                </div>
              </button>

              {/* Connection Strength Analysis */}
              <div className="md:col-span-2 bg-white p-10 border-t-4 border-secondary shadow-sm rounded-xl">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">01-1. 연결강도 분석 (Top 3 Partners)</p>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Shared Keywords Weight</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-8 leading-relaxed">
                  * 연결강도는 두 리더가 공유하는 관심 키워드의 개수를 의미합니다. 공통 관심사가 많을수록 협업 및 지식 공유의 가능성이 높은 '최적의 파트너'로 매칭됩니다.
                </p>
                <div className="space-y-6">
                  {networkStats.topPartners.map((pair, idx) => (
                    <div key={idx} className="bg-surface-container-low p-6 rounded-lg border border-outline/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-black text-primary">0{idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm font-black text-on-surface">{pair.user1?.name}</p>
                              <p className="text-[9px] text-on-surface-variant uppercase">{pair.user1?.company}</p>
                            </div>
                            <span className="material-symbols-outlined text-secondary text-sm">link</span>
                            <div className="text-left">
                              <p className="text-sm font-black text-on-surface">{pair.user2?.name}</p>
                              <p className="text-[9px] text-on-surface-variant uppercase">{pair.user2?.company}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-primary tabular-nums">{pair.weight}</span>
                          <span className="text-[10px] font-bold text-on-surface-variant ml-1">KWs</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-outline/20">
                        {pair.sharedKeywords.map((kw, kIdx) => (
                          <span key={kIdx} className="text-[9px] font-black text-secondary bg-white px-2 py-0.5 rounded border border-secondary/20">#{kw}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {networkStats.topPartners.length === 0 && (
                    <p className="text-sm text-on-surface-variant italic text-center py-4">분석 가능한 연결 데이터가 부족합니다.</p>
                  )}
                </div>
              </div>

              {/* Centrality Analysis */}
              <div className="md:col-span-2 bg-white p-10 border-t-4 border-primary shadow-sm rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-widest mb-4 text-on-surface-variant">01-2. 중심성 분석 (Centrality Analysis)</p>
                <p className="text-[11px] text-on-surface-variant mb-8 leading-relaxed">
                  * 중심성 분석은 네트워크 내에서 특정 키워드나 유저가 가지는 영향력을 측정합니다. 누가, 혹은 무엇이 전체 흐름을 주도하고 연결하는지 파악할 수 있습니다.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-sm">hub</span>
                      <h4 className="text-xs font-black uppercase tracking-widest">연결 중심성 (Degree)</h4>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-surface-container-low p-4 rounded-lg">
                        <p className="text-[9px] font-black text-on-surface-variant uppercase mb-1">Super Keyword</p>
                        <p className="text-lg font-black text-primary">#{networkStats.superKeyword?.keyword || 'N/A'}</p>
                        <p className="text-[10px] text-on-surface-variant mt-1 leading-tight">
                          가장 많은 리더들이 선택한 핵심 관심사로, 조직 내 지식 공유의 가장 큰 접점입니다.
                        </p>
                      </div>
                      <div className="bg-surface-container-low p-4 rounded-lg">
                        <p className="text-[9px] font-black text-on-surface-variant uppercase mb-1">Heavy User</p>
                        <p className="text-lg font-black text-primary">{networkStats.heavyUser?.user.name || 'N/A'}</p>
                        <p className="text-[10px] text-on-surface-variant mt-1 leading-tight">
                          가장 넓은 범위의 관심사를 보유하여 네트워크 확장의 핵심이 되는 리더입니다.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 overflow-hidden">
                    <div className="flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-sm">bridge</span>
                      <h4 className="text-xs font-black uppercase tracking-widest truncate">매개 중심성 (Betweenness)</h4>
                    </div>
                    <div className="bg-surface-container-low p-4 rounded-lg h-full flex flex-col justify-center overflow-hidden">
                      <p className="text-[9px] font-black text-on-surface-variant uppercase mb-2">Bridge Keyword</p>
                      <p className="text-xl font-black text-secondary truncate">#{networkStats.bridgeKeyword?.keyword || 'N/A'}</p>
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-bold text-on-surface leading-tight">
                          * 활용 제안:
                        </p>
                        <p className="text-[10px] text-on-surface-variant leading-tight line-clamp-4">
                          서로 다른 관심사 그룹을 이어주는 핵심 매개체입니다. 이 키워드를 주제로 세미나를 개최하면 이질적인 그룹 간의 자연스러운 융합을 유도할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative bg-white border border-outline shadow-sm rounded-xl overflow-hidden">
              <div className="p-8 bg-surface-container-low border-b border-outline flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase tracking-tight text-primary">Top 10 Interest Keywords</h3>
                <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Giver / Taker Ratio</span>
              </div>
              
              <div className={`transition-all duration-1000 ${!isNetworkRevealed ? 'blur-2xl grayscale opacity-20 pointer-events-none' : ''}`}>
                {networkStats.top10.map((item, idx) => (
                  <button 
                    key={item.id} 
                    onClick={() => setSelectedInterestKeyword(item.id)}
                    className="w-full grid grid-cols-12 items-center p-6 border-b border-outline last:border-b-0 hover:bg-surface-container-low transition-colors group text-left"
                  >
                    <div className="col-span-1 text-xl font-bold text-outline group-hover:text-primary">{(idx + 1).toString().padStart(2, '0')}</div>
                    <div className="col-span-4">
                      <span className="text-xl font-bold uppercase tracking-tight text-on-surface">#{item.keyword}</span>
                    </div>
                    <div className="col-span-5 flex flex-col items-end pr-8">
                      <div className="flex gap-6 text-xl font-bold uppercase tracking-tight mb-2">
                        <span className="text-primary">Giver {item.giverRate}%</span>
                        <span className="text-secondary">Taker {item.takerRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-outline/30 flex rounded-full overflow-hidden">
                        <div className="bg-primary h-full" style={{ width: `${item.giverRate}%` }}></div>
                        <div className="bg-secondary h-full" style={{ width: `${item.takerRate}%` }}></div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-xl font-bold tabular-nums text-primary">{item.count}명</span>
                    </div>
                  </button>
                ))}
              </div>

              {!isNetworkRevealed && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/60 backdrop-blur-sm">
                  <button 
                    onClick={() => setIsNetworkRevealed(true)}
                    className="px-12 py-4 bg-primary text-on-primary font-black uppercase tracking-widest hover:bg-secondary transition-all shadow-xl rounded-lg"
                  >
                    Unlock 01
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Keyword Insights Section */}
        {selectedAnalysisView === '02' && (
          <section className="col-span-12 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-baseline justify-between border-b-4 border-primary/20 pb-6">
              <h2 className="text-4xl font-black uppercase tracking-tight text-primary">02. Learning Insight</h2>
              {!isKeywordRevealed && (
                <button 
                  onClick={() => setIsKeywordRevealed(true)}
                  className="px-8 py-3 bg-primary text-on-primary text-sm font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 rounded-lg"
                >
                  Reveal Data
                </button>
              )}
            </div>

            {/* Insight Count Display */}
            <div className="space-y-8">
              <div className="bg-primary/5 border-l-8 border-primary p-10 rounded-r-2xl shadow-sm">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-5xl font-black text-white tabular-nums">{sessionStats.totalInsightCount}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-black text-on-surface leading-tight">
                      현재 과정에서 총 <span className="text-primary">{sessionStats.totalInsightCount}개</span>의 소중한 리더분들의 인사이트가 기록됐습니다.
                    </p>
                    <p className="text-sm text-on-surface-variant font-medium uppercase tracking-widest">Classroom Insight Statistics</p>
                  </div>
                </div>
              </div>

              {/* Session Bar Graph */}
              <div className="bg-white border border-outline p-8 rounded-xl shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-on-surface-variant mb-8">Session-wise Insight Distribution</h3>
                <div className="space-y-6">
                  {sessionStats.sessionCounts.map((session, idx) => {
                    const maxCount = Math.max(...sessionStats.sessionCounts.map(s => s.count));
                    const width = (session.count / maxCount) * 100;
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="flex flex-col max-w-[70%]">
                            <span className="text-xs font-black uppercase tracking-tight text-on-surface truncate">{session.name}</span>
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Instructor: {session.instructor}</span>
                          </div>
                          <span className="text-xs font-black text-primary tabular-nums">{session.count} Keywords</span>
                        </div>
                        <div className="h-3 bg-surface-container-low rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${width}%` }}
                            transition={{ duration: 1, delay: idx * 0.1 }}
                            className="h-full bg-primary"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="relative bg-white border border-outline shadow-sm rounded-xl overflow-hidden">
              <div className="p-6 bg-surface-container-low border-b border-outline">
                <h3 className="text-lg font-black uppercase tracking-tight text-primary">Integrated Keywords</h3>
              </div>
              <div className={`p-12 transition-all duration-1000 ${!isKeywordRevealed ? 'blur-2xl grayscale opacity-20 pointer-events-none' : ''}`}>
                {/* Bubble Chart Implementation */}
                <div className="flex flex-wrap items-center justify-center gap-6 min-h-[400px]">
                  {sessionStats.top10.map((item, idx) => {
                    const maxCount = Math.max(...sessionStats.top10.map(s => s.count));
                    const minCount = Math.min(...sessionStats.top10.map(s => s.count));
                    const range = maxCount - minCount || 1;
                    // Size from 80px to 200px
                    const size = 80 + ((item.count - minCount) / range) * 120;
                    
                    return (
                      <motion.button 
                        key={item.id}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12, delay: idx * 0.05 }}
                        onClick={() => setSelectedKeywordForPopup(item.id)}
                        style={{ width: size, height: size }}
                        className={`rounded-full flex flex-col items-center justify-center p-4 transition-all shadow-lg border-4 ${
                          selectedTopKeyword === item.id 
                            ? 'bg-primary border-primary text-white scale-110 z-10' 
                            : 'bg-white border-outline text-on-surface-variant hover:border-primary hover:text-primary'
                        }`}
                      >
                        <span className="text-[10px] font-black opacity-40 mb-1">{(idx + 1).toString().padStart(2, '0')}</span>
                        <span className="text-sm font-black uppercase tracking-tighter text-center leading-none mb-2">#{item.keyword}</span>
                        <span className={`text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full ${selectedTopKeyword === item.id ? 'bg-white/20' : 'bg-surface-container-low'}`}>
                          {item.count}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {!isKeywordRevealed && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-white/60 backdrop-blur-sm">
                  <button 
                    onClick={() => setIsKeywordRevealed(true)}
                    className="px-12 py-4 bg-primary text-on-primary font-black uppercase tracking-widest hover:bg-secondary transition-all shadow-xl rounded-lg"
                  >
                    Unlock 02
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-12">
              <div className="space-y-8">
                <h3 className="text-xl font-black uppercase tracking-widest text-secondary">Top 03 Key Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {sessionStats.top10.slice(0, 3).map((item, idx) => (
                    <div key={item.keyword} className="bg-white p-8 space-y-8 shadow-sm border border-outline rounded-xl flex flex-col h-full">
                      <div className="flex items-center justify-between border-b-2 border-primary pb-4">
                        <div className="flex items-center gap-4">
                          <span className="text-3xl font-black text-primary">0{idx + 1}</span>
                          <h4 className="text-2xl font-black uppercase tracking-tight text-on-surface">#{item.keyword}</h4>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-primary text-on-primary px-3 py-1.5 rounded">
                          {item.count} Opinions
                        </span>
                      </div>
                      
                      {/* Core Insight Section */}
                      <div className="bg-surface-container-low p-6 border-l-4 border-primary rounded-r-lg flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">AI 핵심 요약</p>
                        <p className="text-lg font-bold text-on-surface leading-tight">
                          {aiSummaries[item.id] || "AI가 인사이트를 분석 중입니다..."}
                        </p>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-outline/20">
                        {item.topInsights.map((insight: any) => {
                          const user = db.users.find(u => u.id === insight.userId);
                          return (
                            <div key={insight.id} className="border-l-2 border-secondary pl-6 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                                  {user ? `${user.company} | ${user.department} | ${user.name} | ${user.title}` : 'Anonymous'}
                                </span>
                                <div className="flex items-center gap-1.5 text-secondary">
                                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                                  <span className="text-sm font-bold tabular-nums">{insight.likes?.length || 0}</span>
                                </div>
                              </div>
                              <p className="text-lg font-medium leading-snug uppercase italic text-on-surface line-clamp-3">
                                "{insight.description}"
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Best Comments Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-outline"></div>
                  <h3 className="text-xl font-black uppercase tracking-[0.3em] text-primary">Best Comments</h3>
                  <div className="h-px flex-1 bg-outline"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {sessionStats.bestComments.map((comment, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -top-6 -left-4 text-8xl font-serif text-primary/10 select-none">“</div>
                      <div className="bg-white p-10 border-2 border-primary/10 rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 flex flex-col h-full">
                        <div className="mb-6">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-secondary text-on-secondary px-3 py-1 rounded">
                            #{comment.keyword}
                          </span>
                        </div>
                        
                        <blockquote className="flex-1">
                          <p className="text-xl font-bold text-on-surface leading-relaxed italic mb-8">
                            "{comment.description}"
                          </p>
                        </blockquote>
                        
                        <div className="pt-6 border-t border-outline flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-black uppercase tracking-tight text-primary">{comment.userName}</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                              {comment.userCompany} | {comment.userDept} | {comment.userTitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-secondary">
                            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                            <span className="text-lg font-black tabular-nums">{comment.likes?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="absolute -bottom-4 -right-2 text-8xl font-serif text-primary/10 select-none rotate-180">“</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

      </div>

      {/* Tea Time Detail Modal */}
      <AnimatePresence>
        {isTeaTimeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-primary/20 backdrop-blur-md"
            onClick={() => setIsTeaTimeModalOpen(null as any)}
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white text-on-surface w-full max-w-5xl max-h-[80vh] overflow-hidden flex flex-col border-t-8 border-primary shadow-2xl rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-outline flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">Tea Time History / 01</p>
                  <h2 className="text-5xl font-black uppercase tracking-tight text-primary mb-4">티타임 매칭 현황</h2>
                  <p className="text-sm font-bold text-on-surface-variant">과정 내 리더들 간의 티타임 수락이 완료된 내역입니다.</p>
                </div>
                <button 
                  onClick={() => setIsTeaTimeModalOpen(false)}
                  className="text-3xl font-light hover:text-secondary transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-surface-container-low">
                <div className="space-y-6">
                  {db.teaTimeRequests
                    .filter(r => (userIds.has(r.fromUserId) || userIds.has(r.toUserId)) && r.status === 'accepted')
                    .sort((a, b) => b.id.localeCompare(a.id))
                    .map((req) => {
                      const fromUser = db.users.find(u => u.id === req.fromUserId);
                      const toUser = db.users.find(u => u.id === req.toUserId);
                      
                      return (
                        <div key={req.id} className="bg-white p-8 border border-outline shadow-sm rounded-xl space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-8">
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-lg font-black text-on-surface">{fromUser?.name || 'Unknown'}</p>
                                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">{fromUser?.company}</p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
                                  <span className="material-symbols-outlined text-primary">send</span>
                                </div>
                              </div>
                              
                              <span className="material-symbols-outlined text-outline text-4xl">arrow_forward</span>
                              
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-secondary/5 flex items-center justify-center border border-secondary/10">
                                  <span className="material-symbols-outlined text-secondary">person</span>
                                </div>
                                <div className="text-left">
                                  <p className="text-lg font-black text-on-surface">{toUser?.name || 'Unknown'}</p>
                                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{toUser?.company}</p>
                                </div>
                              </div>
                            </div>
                            
                            <div className={`px-4 py-2 rounded-full border-2 font-black text-xs uppercase tracking-widest ${
                              req.status === 'accepted' ? 'bg-success/10 border-success text-success' :
                              req.status === 'rejected' ? 'bg-error/10 border-error text-error' :
                              'bg-surface-container-highest border-outline text-on-surface-variant'
                            }`}>
                              {req.status}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-outline/20">
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                <span className="material-symbols-outlined text-xs">chat_bubble</span> 보낸 메시지
                              </p>
                              <div className="bg-surface-container-low p-4 rounded-lg italic text-sm text-on-surface leading-relaxed">
                                "{req.message}"
                              </div>
                            </div>
                            
                            {req.responseMessage && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                                  <span className="material-symbols-outlined text-xs">reply</span> 받은 답변
                                </p>
                                <div className="bg-secondary/5 p-4 rounded-lg italic text-sm text-on-surface leading-relaxed border border-secondary/10">
                                  "{req.responseMessage}"
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {db.teaTimeRequests.filter(r => (userIds.has(r.fromUserId) || userIds.has(r.toUserId)) && r.status === 'accepted').length === 0 && (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-outline">
                      <span className="material-symbols-outlined text-6xl text-outline mb-4">history</span>
                      <p className="text-lg font-bold text-on-surface-variant">아직 수락된 티타임 내역이 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Hyundai Motor Group Analysis / Tea Time History</p>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total {db.teaTimeRequests.filter(r => (userIds.has(r.fromUserId) || userIds.has(r.toUserId)) && r.status === 'accepted').length} Matches</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integrated Keyword Detail Modal */}
      <AnimatePresence>
        {selectedKeywordForPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-primary/20 backdrop-blur-md"
            onClick={() => setSelectedKeywordForPopup(null)}
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white text-on-surface w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col border-t-8 border-primary shadow-2xl rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-outline flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">Learning Insight / Keyword Detail</p>
                  <h2 className="text-5xl font-black uppercase tracking-tight text-primary mb-4">#{selectedKeywordForPopupData?.keyword}</h2>
                  <p className="text-sm font-bold text-on-surface-variant">해당 키워드에 대해 리더분들이 남겨주신 모든 의견입니다.</p>
                </div>
                <button 
                  onClick={() => setSelectedKeywordForPopup(null)}
                  className="text-3xl font-light hover:text-secondary transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-surface-container-low">
                <div className="space-y-6">
                  {db.userInsights
                    .filter(i => (i.canonicalId || i.keyword) === selectedKeywordForPopup)
                    .map((insight, idx) => {
                      const user = db.users.find(u => u.id === insight.userId);
                      return (
                        <div key={idx} className="bg-white p-8 border border-outline shadow-sm rounded-xl space-y-4">
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-lg font-black text-primary">{user?.name || 'Anonymous'}</span>
                              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                                {user ? `${user.company} | ${user.department} | ${user.title}` : 'N/A'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-secondary">
                              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                              <span className="text-lg font-black tabular-nums">{insight.likes?.length || 0}</span>
                            </div>
                          </div>
                          <p className="text-xl font-medium leading-relaxed text-on-surface italic">
                            "{insight.description}"
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
              
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Hyundai Motor Group Analysis / Integrated Keywords</p>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total {db.userInsights.filter(i => (i.canonicalId || i.keyword) === selectedKeywordForPopup).length} Opinions</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interest Keyword Detail Modal */}
      <AnimatePresence>
        {selectedInterestKeyword && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-primary/20 backdrop-blur-md"
            onClick={() => setSelectedInterestKeyword(null)}
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-white text-on-surface w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col border-t-8 border-primary shadow-2xl rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-outline flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">Keyword Detail / 01</p>
                  <h2 className="text-5xl font-black uppercase tracking-tight text-primary mb-4">#{selectedInterestKeywordData?.keyword}</h2>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(selectedInterestKeywordData?.items.map((i: any) => i.keyword))).map((kw: any, idx: number) => (
                      <span key={idx} className="text-[10px] font-black text-secondary bg-secondary/10 px-2 py-1 rounded-full border border-secondary/20">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedInterestKeyword(null)}
                  className="text-3xl font-light hover:text-secondary transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-surface-container-low">
                <div className="grid grid-cols-12 gap-8">
                  <div className="col-span-12 space-y-6">
                    {selectedInterestKeywordData?.items.map((interest: any, idx: number) => {
                      const user = db.users.find(u => u.id === interest.userId);
                      return (
                        <div key={idx} className="bg-white p-6 border border-outline shadow-sm rounded-lg">
                          <div className="flex justify-between items-baseline mb-4">
                            <div className="flex items-baseline gap-4">
                              <span className="text-xl font-bold uppercase tracking-tight text-primary">{user?.name || 'Anonymous'}</span>
                              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{user?.company || user?.position || 'Leader'}</span>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded ${
                              interest.type === 'giver' ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'
                            }`}>
                              {interest.type}
                            </span>
                          </div>
                          <div className="space-y-4">
                            <div className="flex gap-4 items-baseline">
                              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-12">Input:</span>
                              <span className="text-lg font-bold uppercase text-on-surface">"{interest.keyword}"</span>
                            </div>
                            <div className="flex gap-4 items-start">
                              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant w-12 mt-1">Detail:</span>
                              <p className="text-lg font-medium leading-tight uppercase italic text-on-surface/80">
                                {interest.description || 'No detailed description provided.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Hyundai Motor Group Analysis / Objective Data</p>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total {selectedInterestKeywordData?.count || 0} Entries</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
