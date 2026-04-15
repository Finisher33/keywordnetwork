import { useMemo, useState, useRef } from 'react';
import { useStore, User, Interest } from '../store';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import UserReportPDF from './UserReportPDF';
import { calculateUserNetworkData, calculateSNAScores, calculateHotKeywords, HotKeyword } from '../utils/networkUtils';
import TeaTimeModal from './TeaTimeModal';

interface MyNetworkProps {
  targetUser?: User;
  hideActions?: boolean;
}

// ─── Shared section title component ─────────────────────────────────────────
function SectionTitle({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-outline/40">
      <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
      <h2 className="font-headline text-base font-black uppercase tracking-widest text-on-surface">{title}</h2>
      {badge && (
        <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold border border-primary/20 ml-1">{badge}</span>
      )}
    </div>
  );
}

export default function MyNetwork({ targetUser, hideActions = false }: MyNetworkProps) {
  const { db, currentUser: storeUser, updateTeaTimeRequest, sendTeaTimeRequest, fetchData } = useStore();
  const currentUser = targetUser || storeUser;

  // ── state ──────────────────────────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [replyMsg, setReplyMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<HotKeyword | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const pdfReportRef = useRef<HTMLDivElement>(null);

  // ── data ───────────────────────────────────────────────────────────────────
  const networkData = useMemo(() => {
    if (!currentUser) return null;
    return calculateUserNetworkData(currentUser, db);
  }, [currentUser, db]);

  const snaResult = useMemo(() => {
    if (!currentUser) return null;
    return calculateSNAScores(currentUser, db);
  }, [currentUser, db]);

  const hotKeywords = useMemo(() => {
    if (!currentUser) return [];
    return calculateHotKeywords(currentUser, db, 5);
  }, [currentUser, db]);

  const { groupedNetwork, summary, keywordGroups, myInterests, recommendedLeaders } = networkData || {
    groupedNetwork: [],
    summary: { total: 0, givers: 0, takers: 0, receivedCount: 0, sentCount: 0 },
    keywordGroups: {},
    myInterests: [],
    recommendedLeaders: [],
  };

  const receivedRequests = useMemo(
    () => db.teaTimeRequests.filter(r => r.toUserId === currentUser?.id),
    [db.teaTimeRequests, currentUser]
  );
  const sentRequests = useMemo(
    () => db.teaTimeRequests.filter(r => r.fromUserId === currentUser?.id),
    [db.teaTimeRequests, currentUser]
  );

  const selectedUserInterests = useMemo(
    () => (selectedUser ? db.interests.filter(i => i.userId === selectedUser.id) : []),
    [db.interests, selectedUser]
  );

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await fetchData(); } finally { setIsRefreshing(false); }
  };

  const handleAccept = (reqId: string) => {
    updateTeaTimeRequest(reqId, 'accepted', replyMsg);
    setReplyingTo(null); setReplyMsg('');
  };
  const handleReject = (reqId: string) => {
    updateTeaTimeRequest(reqId, 'rejected', replyMsg);
    setReplyingTo(null); setReplyMsg('');
  };

  const handleSendTeaTime = (toUserId: string, message: string) => {
    sendTeaTimeRequest({ id: Date.now().toString(), fromUserId: currentUser!.id, toUserId, message, status: 'pending' });
    alert('티타임 요청을 보냈습니다.');
    setSelectedUser(null);
  };

  const handleDownloadPDF = async () => {
    if (!pdfReportRef.current) return;
    setIsDownloading(true);
    try {
      const element = pdfReportRef.current;
      const images = Array.from(element.getElementsByTagName('img')) as HTMLImageElement[];
      await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false,
        onclone: (clonedDoc) => {
          const styles = clonedDoc.getElementsByTagName('style');
          const links = clonedDoc.getElementsByTagName('link');
          Array.from(styles).forEach(s => s.remove());
          Array.from(links).forEach(l => { if (l.rel === 'stylesheet') l.remove(); });
          const style = clonedDoc.createElement('style');
          style.innerHTML = `* { font-family: 'Inter', sans-serif !important; box-sizing: border-box !important; }`;
          clonedDoc.head.appendChild(style);
        }
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginX = 10, marginY = 20;
      const contentWidth = pdfWidth - marginX * 2;
      const contentHeight = pdfHeight - marginY * 2;
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = contentWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      let currentOffset = 0;
      while (currentOffset < imgHeight) {
        if (currentOffset > 0) {
          if (imgHeight - currentOffset < 15) break;
          pdf.addPage();
        }
        pdf.addImage(imgData, 'JPEG', marginX, marginY - currentOffset, imgWidth, imgHeight);
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, marginY, 'F');
        pdf.rect(0, pdfHeight - marginY, pdfWidth, marginY, 'F');
        currentOffset += contentHeight;
      }
      pdf.save(`NetworkReport_${currentUser?.name || 'User'}.pdf`);
    } catch (e) {
      console.error(e);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10" ref={contentRef}>

      {/* ── Page Header ── */}
      <div className="pb-3 border-b-2 border-primary/30 flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">MY NETWORK</h1>
          <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{currentUser?.name}님의 소셜 네트워크 분석</p>
        </div>
        {!hideActions && (
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadPDF} disabled={isDownloading}
              className={`w-9 h-9 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isDownloading ? 'opacity-50' : ''}`}
              title="PDF 다운로드">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">{isDownloading ? 'sync' : 'download'}</span>
            </button>
            <button onClick={handleRefresh} disabled={isRefreshing}
              className={`w-9 h-9 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`}
              title="새로고침">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          1. SNA 종합 분석
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionTitle icon="analytics" title="SNA 종합 분석" />

        {!snaResult ? (
          <p className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">
            분석하기에 데이터가 부족합니다. 관심사를 등록하고 동료들과 연결되면 분석 결과를 확인할 수 있습니다.
          </p>
        ) : (
          <>
            {/* Dominant type card */}
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 flex gap-4 items-start">
              <div className="text-4xl shrink-0">{snaResult.dominant.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-0.5">{snaResult.dominant.metricName} 최고</p>
                <h3 className="text-xl font-black text-primary mb-2">{snaResult.dominant.type} 유형</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{snaResult.dominant.description}</p>
                <p className="text-[10px] text-primary/70 font-medium mt-2">{snaResult.dominant.detail}</p>
              </div>
            </div>

            {/* 3 metric bars */}
            <div className="space-y-4">
              {snaResult.types.map((t, idx) => (
                <div key={idx} className="bg-surface border border-outline rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{t.icon}</span>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{t.type}</p>
                        <p className="text-[9px] text-on-surface-variant uppercase tracking-widest">{t.metricName}</p>
                      </div>
                    </div>
                    <span className={`text-base font-black ${t.type === snaResult.dominant.type ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {t.score.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${t.type === snaResult.dominant.type ? 'bg-primary' : 'bg-on-surface-variant/30'}`}
                      style={{ width: `${Math.max(2, t.score)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1.5">{t.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          2. 티타임 현황
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionTitle icon="coffee_maker" title="티타임 현황" />

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div className="bg-surface p-4 rounded-xl border border-outline/50 text-center">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">받은 요청</p>
            <span className="text-2xl font-bold text-tertiary">{receivedRequests.length}</span>
            <p className="text-[10px] text-on-surface-variant mt-0.5">회</p>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-outline/50 text-center">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">보낸 요청</p>
            <span className="text-2xl font-bold text-secondary">{sentRequests.length}</span>
            <p className="text-[10px] text-on-surface-variant mt-0.5">회</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Received */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">call_received</span> 받은 요청
            </h3>
            {receivedRequests.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">받은 요청이 없습니다.</p>
            ) : (
              receivedRequests.map(req => {
                const fromUser = db.users.find(u => u.id === req.fromUserId);
                if (!fromUser) return null;
                const isHandled = req.status !== 'pending';
                return (
                  <div key={req.id} className={`p-4 rounded-2xl border border-outline shadow-sm space-y-3 transition-opacity ${isHandled ? 'bg-surface/50 opacity-80' : 'bg-surface'}`}>
                    <div className="flex gap-3 items-start">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center shrink-0 border border-outline">
                        {fromUser.profilePic
                          ? <img src={fromUser.profilePic} className="w-full h-full object-cover" />
                          : <span className="font-bold text-primary text-xs">{fromUser.name.charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-on-surface text-xs truncate">{fromUser.name}</h3>
                          {isHandled && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${req.status === 'accepted' ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                              {req.status === 'accepted' ? '수락됨' : '거절됨'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant truncate">{fromUser.title}</p>
                        <div className="mt-1 space-y-1">
                          {req.message.includes('\n\n') ? (
                            <>
                              <div className="flex flex-wrap gap-1">
                                {req.message.split('\n\n')[0].split(' ').filter(t => t.startsWith('#')).map((tag, idx) => (
                                  <span key={idx} className="text-[9px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 uppercase">{tag}</span>
                                ))}
                              </div>
                              <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message.split('\n\n')[1]}"</p>
                            </>
                          ) : (
                            <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message}"</p>
                          )}
                        </div>
                        {isHandled && req.responseMessage && (
                          <div className="mt-2 p-2 bg-surface-container-low rounded-lg border border-outline/30">
                            <p className="text-[9px] font-bold text-primary mb-0.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">reply</span> 나의 응답
                            </p>
                            <p className="text-[10px] text-on-surface italic">"{req.responseMessage}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {!isHandled && (
                      replyingTo === req.id ? (
                        <div className="space-y-2 pt-2 border-t border-outline">
                          <textarea value={replyMsg} onChange={e => setReplyMsg(e.target.value)} placeholder="응답 메시지..." className="w-full bg-surface-container-low border border-outline rounded-lg p-2 text-xs outline-none focus:border-primary" rows={2} />
                          <div className="flex gap-2">
                            <button onClick={() => setReplyingTo(null)} className="flex-1 py-1.5 text-[10px] font-bold border border-outline rounded-lg">취소</button>
                            <button onClick={() => handleAccept(req.id)} className="flex-1 py-1.5 text-[10px] font-bold bg-primary text-on-primary rounded-lg">수락</button>
                            <button onClick={() => handleReject(req.id)} className="flex-1 py-1.5 text-[10px] font-bold border border-outline rounded-lg">거절</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => setReplyingTo(req.id)} className="flex-1 py-1.5 text-[10px] font-bold bg-primary text-on-primary rounded-lg">응답하기</button>
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sent */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">call_made</span> 보낸 요청
            </h3>
            {sentRequests.length === 0 ? (
              <p className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">보낸 요청이 없습니다.</p>
            ) : (
              sentRequests.map(req => {
                const toUser = db.users.find(u => u.id === req.toUserId);
                if (!toUser) return null;
                return (
                  <div key={req.id} className="p-4 rounded-2xl border border-outline bg-surface shadow-sm space-y-3">
                    <div className="flex gap-3 items-start">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center shrink-0 border border-outline">
                        {toUser.profilePic
                          ? <img src={toUser.profilePic} className="w-full h-full object-cover" />
                          : <span className="font-bold text-primary text-xs">{toUser.name.charAt(0)}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="font-bold text-on-surface text-xs truncate">{toUser.name}</h3>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${req.status === 'accepted' ? 'bg-primary/10 text-primary' : req.status === 'rejected' ? 'bg-surface-variant text-on-surface-variant' : 'bg-tertiary/10 text-tertiary'}`}>
                            {req.status === 'accepted' ? '수락됨' : req.status === 'rejected' ? '거절됨' : '대기 중'}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant truncate">{toUser.title}</p>
                        <div className="mt-1">
                          {req.message.includes('\n\n') ? (
                            <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message.split('\n\n')[1]}"</p>
                          ) : (
                            <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message}"</p>
                          )}
                        </div>
                        {req.status !== 'pending' && req.responseMessage && (
                          <div className="mt-2 p-2 bg-surface-container-low rounded-lg border border-outline/30">
                            <p className="text-[9px] font-bold text-secondary mb-0.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px]">chat_bubble</span> 상대방의 응답
                            </p>
                            <p className="text-[10px] text-on-surface italic">"{req.responseMessage}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          3. 네트워크 추천 리더
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionTitle icon="star" title="네트워크 추천 리더" badge="연결 키워드 2개 이상" />
        <p className="text-xs text-on-surface-variant font-medium -mt-2">
          {currentUser?.name}님과 공통 키워드가 2개 이상인 리더입니다. 아이콘을 클릭해 티타임을 요청해보세요.
        </p>

        {recommendedLeaders.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic p-4 bg-surface-container rounded-xl border border-outline-variant/10">
            아직 2개 이상 공통 키워드를 가진 리더가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {recommendedLeaders.map(({ user: u, count, keywords }) => {
              const uInterests = db.interests.filter((i: Interest) => i.userId === u.id);
              return (
                <div key={u.id} className="bg-surface rounded-2xl border-2 border-primary/25 p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-4">
                    {/* 아이콘 클릭 → 티타임 요청 */}
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="w-12 h-12 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline shrink-0 hover:border-primary/50 hover:scale-105 transition-all"
                      title="티타임 요청"
                    >
                      {u.profilePic
                        ? <img src={u.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        : <span className="text-base font-bold text-primary">{u.name.charAt(0)}</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-on-surface-variant truncate uppercase font-medium">{u.company} · {u.department}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-on-surface">{u.name}</p>
                        <span className="text-[9px] font-black bg-primary text-on-primary px-2 py-0.5 rounded-full">공통 {count}개</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant truncate">{u.title}</p>
                    </div>
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="shrink-0 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      티타임 요청
                    </button>
                  </div>

                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">공통 키워드</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw, idx) => (
                        <span key={idx} className="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20 italic">{kw}</span>
                      ))}
                    </div>
                  </div>

                  {uInterests.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">등록한 관심사</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uInterests.map((i: Interest) => (
                          <span key={i.id} className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${i.type === 'giver' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-secondary/5 text-secondary border-secondary/20'}`}>
                            #{i.keyword} <span className="opacity-60">{i.type === 'giver' ? 'G' : 'T'}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          4. HOT KEYWORDS
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <SectionTitle icon="local_fire_department" title="HOT KEYWORDS" badge="Top 5" />
        <p className="text-xs text-on-surface-variant font-medium -mt-2">
          이번 과정에서 가장 많은 리더들이 관심을 가진 키워드입니다. 키워드를 클릭하면 상세 내용을 확인할 수 있어요.
        </p>

        {hotKeywords.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">키워드 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {hotKeywords.map((kw, idx) => {
              const giverCount = kw.givers.length;
              const takerCount = kw.takers.length;
              const total = kw.total;
              const giverPct = total > 0 ? Math.round((giverCount / total) * 100) : 0;
              const takerPct = 100 - giverPct;
              const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

              return (
                <button
                  key={kw.canonicalId}
                  onClick={() => setSelectedKeyword(kw)}
                  className="w-full bg-surface border border-outline rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl shrink-0">{medals[idx]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">#{kw.displayName}</h3>
                        <span className="text-[10px] text-on-surface-variant shrink-0">{total}명 관심</span>
                      </div>
                    </div>
                  </div>

                  {/* Giver / Taker bar */}
                  <div className="space-y-1.5">
                    <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                      <div className="bg-primary rounded-full transition-all duration-500" style={{ width: `${giverPct}%` }} />
                      <div className="bg-secondary rounded-full transition-all duration-500" style={{ width: `${takerPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold">
                      <span className="text-primary">Giver {giverCount}명 ({giverPct}%)</span>
                      <span className="text-secondary">Taker {takerCount}명 ({takerPct}%)</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          HOT KEYWORD 상세 팝업
      ════════════════════════════════════════════════════════════════════════ */}
      {selectedKeyword && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm" onClick={() => setSelectedKeyword(null)}>
          <div className="bg-surface p-6 rounded-2xl border border-outline max-w-md w-full shadow-2xl max-h-[85vh] overflow-y-auto scrollbar-hide" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-5">
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-0.5">HOT KEYWORD</p>
                <h3 className="text-xl font-black text-primary">#{selectedKeyword.displayName}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">총 {selectedKeyword.total}명 관심</p>
              </div>
              <button onClick={() => setSelectedKeyword(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* Givers */}
              {selectedKeyword.givers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">volunteer_activism</span>
                    Giver ({selectedKeyword.givers.length}명)
                  </h4>
                  <div className="space-y-2">
                    {selectedKeyword.givers.map(i => {
                      const user = db.users.find((u: User) => u.id === i.userId);
                      if (!user) return null;
                      return (
                        <div key={i.id} className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 overflow-hidden flex items-center justify-center shrink-0 border border-primary/20">
                              {user.profilePic
                                ? <img src={user.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                : <span className="text-xs font-bold text-primary">{user.name.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate">{user.name}</p>
                              <p className="text-[9px] text-on-surface-variant truncate">{user.company} · {user.title}</p>
                            </div>
                          </div>
                          {i.description && <p className="text-[10px] text-on-surface-variant leading-relaxed italic">"{i.description}"</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Takers */}
              {selectedKeyword.takers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">pan_tool</span>
                    Taker ({selectedKeyword.takers.length}명)
                  </h4>
                  <div className="space-y-2">
                    {selectedKeyword.takers.map(i => {
                      const user = db.users.find((u: User) => u.id === i.userId);
                      if (!user) return null;
                      return (
                        <div key={i.id} className="bg-secondary/5 border border-secondary/15 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-secondary/10 overflow-hidden flex items-center justify-center shrink-0 border border-secondary/20">
                              {user.profilePic
                                ? <img src={user.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                : <span className="text-xs font-bold text-secondary">{user.name.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-on-surface truncate">{user.name}</p>
                              <p className="text-[9px] text-on-surface-variant truncate">{user.company} · {user.title}</p>
                            </div>
                          </div>
                          {i.description && <p className="text-[10px] text-on-surface-variant leading-relaxed italic">"{i.description}"</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          티타임 요청 팝업 (추천 리더 클릭)
      ════════════════════════════════════════════════════════════════════════ */}
      {selectedUser && currentUser && (
        <TeaTimeModal
          targetUser={selectedUser}
          currentUser={currentUser}
          myInterests={myInterests}
          targetInterests={selectedUserInterests}
          onSend={handleSendTeaTime}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* PDF Report (hidden) */}
      <div className="fixed left-[-9999px] top-0 overflow-hidden bg-white" style={{ width: '210mm' }}>
        <div ref={pdfReportRef}>
          {currentUser && (
            <UserReportPDF
              user={currentUser}
              interests={db.interests}
              canonicalTerms={db.canonicalTerms || []}
              allUsers={db.users}
              teaTimeRequests={db.teaTimeRequests}
              groupedNetwork={groupedNetwork}
              summary={summary}
            />
          )}
        </div>
      </div>
    </div>
  );
}
