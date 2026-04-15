import { useState, useMemo } from 'react';
import { useStore, UserInsight } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import NotificationBell from './NotificationBell';

interface InsightViewProps {
  onBack?: () => void;
  onLogout?: () => void;
  onProfileClick?: () => void;
  onNotificationClick?: () => void;
  adminCourseId?: string;
}

export default function InsightView({ onBack, onLogout, onProfileClick, onNotificationClick, adminCourseId }: InsightViewProps) {
  const { currentUser, db, saveUserInsight, toggleInsightLike } = useStore();
  const effectiveCourseId = adminCourseId || currentUser?.courseId;

  const [activeTab, setActiveTab] = useState<'my' | 'classroom'>(adminCourseId ? 'classroom' : 'my');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [classroomSessionId, setClassroomSessionId] = useState<string>(db.sessions.find(s => s.courseId === effectiveCourseId)?.id || '');
  
  const [keyword, setKeyword] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKeywordDetail, setSelectedKeywordDetail] = useState<string | null>(null);
  const [revealedBubbles, setRevealedBubbles] = useState<Record<string, Set<string>>>({});

  const activeSessions = db.sessions.filter(s => s.courseId === effectiveCourseId && s.isActive);
  const userInsights = (db.userInsights || []).filter(i => i.userId === currentUser?.id);

  const handleSaveInsight = (sessionId: string) => {
    if (!keyword.trim() || !description.trim()) {
      alert('키워드와 설명을 모두 입력해주세요.');
      return;
    }

    const insight: UserInsight = {
      id: Date.now().toString(),
      userId: currentUser!.id,
      sessionId,
      keyword,
      description,
      likes: []
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

  const getKeywordColor = (str: string) => {
    const colors = ['#002c5f', '#00aad2', '#e4dcd3', '#1c1c1c', '#666666'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
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

  return (
    <div className="h-[100dvh] bg-background text-on-surface flex flex-col overflow-hidden">
      {/* Top Nav - Hidden in Admin Mode */}
      {!adminCourseId && (
        <header className="bg-white/80 backdrop-blur-xl border-b border-outline flex justify-between items-center px-4 h-12 shadow-sm shrink-0 z-50">
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
        </header>
      )}

      <main className={`flex-1 overflow-y-auto px-6 mx-auto transition-all ${adminCourseId ? 'max-w-none pt-8' : 'max-w-5xl pt-8 pb-24'}`}>
        <AnimatePresence mode="wait">
          {selectedSessionId ? (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="space-y-2">
                <button 
                  onClick={() => setSelectedSessionId(null)}
                  className="flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-secondary transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span> 목록으로 돌아가기
                </button>
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

              <div className="space-y-6 bg-surface-container-low p-6 rounded-3xl border border-outline shadow-sm">
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
                  className="w-full py-4 bg-secondary text-on-secondary font-headline font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                >
                  인사이트 등록 완료
                </button>
              </div>
            </motion.div>
          ) : activeTab === 'my' ? (
            <motion.div 
              key="my"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="space-y-2">
                <h1 className="text-[clamp(1.5rem,8vw,2.5rem)] font-headline font-black text-on-surface tracking-tighter leading-none whitespace-nowrap w-full">
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
                          <button 
                            onClick={() => startInput(session.id)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${insight ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container-highest text-on-surface-variant hover:bg-secondary/20'}`}
                          >
                            <span className="material-symbols-outlined text-sm">{insight ? 'edit' : 'add'}</span>
                          </button>
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
                    <h2 className="text-[clamp(1.25rem,6vw,2.5rem)] font-black font-headline text-primary leading-tight tracking-tighter mb-4 uppercase whitespace-nowrap w-full">
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

              {/* Bento Bubble Grid */}
              <div className="grid grid-cols-12 gap-6 items-start">
                {/* Stats Column */}
                <div className="col-span-12 md:col-span-4 space-y-6">
                  <div className="bg-surface-container-low p-6 md:p-8 rounded-xl border border-outline-variant/10">
                    <h3 className="text-primary font-headline font-bold text-lg md:text-xl mb-6">Semantic Density</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant font-medium text-sm">Unique Keywords</span>
                        <span className="text-primary font-bold text-lg">{classroomData.length}</span>
                      </div>
                      <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                        <div className="bg-secondary h-full" style={{ width: `${Math.min(100, (classroomData.length / 20) * 100)}%` }}></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-on-surface-variant font-medium text-sm">Total Insights</span>
                        <span className="text-primary font-bold text-lg">
                          {classroomData.reduce((acc, curr) => acc + curr.count, 0)}
                        </span>
                      </div>
                      <div className="w-full bg-surface-variant h-1 rounded-full overflow-hidden">
                        <div className="bg-secondary h-full" style={{ width: `${Math.min(100, (classroomData.reduce((acc, curr) => acc + curr.count, 0) / 50) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content Column */}
                <div className="col-span-12 md:col-span-8 space-y-6">
                  {/* Best Insights Section (formerly Active Insight) */}
                  <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/10 shadow-sm">
                    <h3 className="text-primary font-headline font-bold text-lg md:text-xl mb-6">BEST INSIGHTS</h3>
                    
                    <div className="space-y-8">
                      {bestComments.length > 0 ? (
                        <div className="grid grid-cols-1 gap-8">
                          {bestComments.map((comment, idx) => {
                            const user = db.users.find(u => u.id === comment.userId);
                            return (
                              <div key={comment.id} className="relative">
                                <span className="absolute -top-4 -left-2 text-6xl font-serif text-primary/10 select-none">“</span>
                                <div className="pl-8 pr-4">
                                  <p className="text-lg font-bold text-on-surface leading-snug italic mb-4 break-keep">
                                    {comment.description}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-secondary uppercase tracking-widest">#{comment.keyword}</span>
                                      <span className="text-[10px] text-on-surface-variant font-medium">
                                        — {user ? `${user.company} | ${user.department} | ${user.name} | ${user.title}` : 'Anonymous'}
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

                  {/* Bubble Chart Section */}
                  <div className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/10 relative overflow-hidden">
                    <h3 className="text-primary font-headline font-bold text-lg md:text-xl mb-6">INSIGHT BUBBLE</h3>
                    
                    <div className="min-h-[500px] flex items-center justify-center relative">
                      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                      
                      {classroomData.length === 0 ? (
                        <div className="text-center space-y-4 opacity-40">
                          <span className="material-symbols-outlined text-6xl">bubble_chart</span>
                          <p className="font-headline font-bold">데이터가 부족합니다</p>
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex flex-wrap justify-center items-center gap-6 p-4">
                          {classroomData.map((data) => {
                            const size = 80 + (data.count / maxCount) * 120;
                            const bgColor = getKeywordColor(data.name);
                            const textColor = getContrastColor(bgColor);
                            const isRevealed = revealedBubbles[classroomSessionId]?.has(data.id);
    
                            return (
                              <motion.div
                                key={data.name}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                whileHover={{ scale: 1.05 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isRevealed) {
                                    const next = { ...revealedBubbles };
                                    const sessionSet = new Set(next[classroomSessionId] || []);
                                    sessionSet.add(data.id);
                                    next[classroomSessionId] = sessionSet;
                                    setRevealedBubbles(next);
                                  } else {
                                    setSelectedKeywordDetail(data.id);
                                  }
                                }}
                                className={`bubble-float rounded-full flex items-center justify-center shadow-xl cursor-pointer text-center p-4 transition-all duration-500 ${!isRevealed ? 'blur-md grayscale opacity-60 scale-95' : 'blur-0 grayscale-0 opacity-100 scale-100'}`}
                                style={{ 
                                  width: size, 
                                  height: size,
                                  backgroundColor: bgColor,
                                  color: textColor
                                }}
                              >
                                <div>
                                  <span className="block font-headline font-black leading-tight" style={{ fontSize: size * 0.18 }}>{data.name}</span>
                                  <span className="block opacity-80 font-bold mt-1" style={{ fontSize: size * 0.08 }}>{data.count} Insights</span>
                                </div>
                                {!isRevealed && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white/50 text-2xl">lock</span>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Keyword Hashtag Section */}
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
            onClick={() => setActiveTab('my')}
            className={`flex items-center justify-center gap-2 transition-colors active:scale-95 px-4 py-2 rounded-full ${activeTab === 'my' ? 'text-secondary bg-secondary/10' : 'text-on-surface-variant/40 hover:text-secondary'}`}
          >
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: activeTab === 'my' ? "'FILL' 1" : "'FILL' 0" }}>psychology</span>
            <span className="font-label text-[10px] uppercase tracking-widest font-medium">My Insight</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('classroom')}
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
