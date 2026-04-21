import { useMemo, useState, useRef } from 'react';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { useStore, User, Interest } from '../store';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import UserReportPDF from './UserReportPDF';
import { calculateUserNetworkData, calculateSNAScores, calculateHotKeywords, HotKeyword } from '../utils/networkUtils';
import TeaTimeModal, { TeaReplyModal } from './TeaTimeModal';
import { TeaTimeRequest } from '../store';

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
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold border border-primary/20 ml-1">{badge}</span>
      )}
    </div>
  );
}

// ─── SNA 유형별 설명 ────────────────────────────────────────────────────────
const SNA_DESCRIPTIONS: Record<string, { leader: string; property: string; analogy: string }> = {
  '안테나': {
    leader: '리더님은 근접 중심성이 높은 안테나형 리더입니다.',
    property: '근접 중심성만의 고유한 속성은 독립적인 전파 속도로, 근접 중심성이 높을수록 남에게 의존하지 않고 모든 노드에 빠르게 연결될 수 있습니다.',
    analogy: '안테나 유형을 비유하자면 119 소방서나 쿠팡 물류센터와 같습니다. 네트워크 내에서 특정 길목을 막고 서 있는 건 아니지만, 사고가 나거나 배송을 할 때 도시 어느 지점이든 가장 짧은 시간 안에 도착할 수 있는 최적의 입지에 있는 것입니다. 즉, 다른 리더분들께 최단 거리로 도달할 수 있는 강점이 있는 유형입니다.',
  },
  '마당발(인플루언서)': {
    leader: '리더님은 연결 중심성이 높은 마당발(인플루언서)형 리더입니다.',
    property: '연결 중심성만의 고유한 속성은 가시적인 활동성으로, 당장 내 주변에 많은 사람이 연결되어 있을수록 연결중심성은 높게 측정됩니다.',
    analogy: '마당발 유형을 비유하자면 수많은 팔로워를 거느린 대형 유튜버나 대학 축제 때 가장 많은 사람을 불러 모으는 인기 과대표와 같습니다. 복잡한 전략 없이도 오직 숫자의 힘만으로 네트워크 내에서 가장 큰 목소리를 낼 수 있습니다.',
  },
  '게이트키퍼': {
    leader: '리더님은 매개 중심성이 높은 게이트키퍼형 리더입니다.',
    property: '매개 중심성만의 고유한 속성은 대체 불가능성입니다. 단순히 중심에 있는 것이 아니라, 서로 다른 두 세계(클러스터)를 잇는 중요한 위치에 있을수록 매개 중심성은 높게 측정됩니다.',
    analogy: '게이트키퍼형을 비유하자면 서울과 부산을 잇는 유일한 고속도로의 휴게소와 같습니다. 모두가 그곳을 거쳐야만 하기에, 휴게소 주인은 정보와 흐름을 통제하거나 원활하게 하는 역할이 가능합니다.',
  },
};

export default function MyNetwork({ targetUser, hideActions = false }: MyNetworkProps) {
  const { db, currentUser: storeUser, fetchData, updateTeaTimeRequest, sendTeaTimeRequest } = useStore();
  const currentUser = targetUser || storeUser;
  const { toast, showToast } = useToast();

  // ── state ──────────────────────────────────────────────────────────────────
  const [selectedKeyword, setSelectedKeyword] = useState<HotKeyword | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [replyingToReq, setReplyingToReq] = useState<TeaTimeRequest | null>(null);
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
    return calculateHotKeywords(currentUser, db, 10);
  }, [currentUser, db]);

  const selectedUserInterests = useMemo(() => {
    if (!selectedUser) return [];
    return db.interests.filter((i: Interest) => i.userId === selectedUser.id);
  }, [selectedUser, db.interests]);

  const { groupedNetwork, summary, myInterests, recommendedLeaders } = networkData || {
    groupedNetwork: [],
    summary: { total: 0, givers: 0, takers: 0, receivedCount: 0, sentCount: 0 },
    myInterests: [],
    recommendedLeaders: [],
  };

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleSendTeaTime = async (message: string) => {
    if (!selectedUser || !currentUser) return;
    await sendTeaTimeRequest({
      id: Date.now().toString(),
      fromUserId: currentUser.id,
      toUserId: selectedUser.id,
      message,
      status: 'pending'
    });
    setSelectedUser(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await fetchData(); } finally { setIsRefreshing(false); }
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
      showToast('PDF 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10" ref={contentRef}>
      <Toast toast={toast} />

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
          1. SNA 유형 분석
      ════════════════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        {/* 타이틀 */}
        <div className="flex items-center gap-2 pb-2 border-b border-outline/40">
          <span className="material-symbols-outlined text-primary text-xl">analytics</span>
          <h2 className="font-headline text-base font-black uppercase tracking-widest text-on-surface leading-tight">
            SNA
            <span className="text-[0.55em] font-semibold normal-case tracking-normal text-on-surface/60"> (Social Network Analysis)</span>
            {' '}유형 분석
          </h2>
        </div>

        {/* 소개 문구 */}
        <div className="bg-surface-container-low border border-outline/40 rounded-xl px-4 py-3 space-y-1.5">
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            소셜 네트워크 분석이란 사람/객체간의 속성(나이, 성별 등)보다는 그들 간의 <span className="font-bold text-on-surface">'관계(Relationship)'와 '구조(Structure)'</span>에 집중하여 사회적 현상을 정량적으로 분석하는 기법입니다.
          </p>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            점(Node)과 선(Link)으로 이루어진 데이터를 통해 집단 내의 정보 흐름이나 권력 지도를 시각화하고 통계적으로 확인합니다.
          </p>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            리더님께서 입력한 관심사와 본 과정에 참여한 리더분들이 입력한 관심사 간의 데이터를 종합 분석 결과, <span className="font-bold text-primary">{currentUser?.name}</span>님의 네트워크 유형은{' '}
            {snaResult && !snaResult.allZero && snaResult.dominant
              ? <><span className="font-bold text-primary">{snaResult.dominant.type}</span> 유형입니다.</>
              : '아직 분석 중입니다.'
            }
          </p>
        </div>

        {!snaResult ? (
          <p className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">
            분석하기에 데이터가 부족합니다. 관심사를 등록하고 동료들과 연결되면 분석 결과를 확인할 수 있습니다.
          </p>
        ) : snaResult.allZero ? (
          /* 모든 점수가 0 → 유형 미결정 안내 */
          <div className="bg-surface-container-low border border-outline rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔍</span>
              <div>
                <p className="text-sm font-bold text-on-surface">아직 유형을 특정하기 어렵습니다</p>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  데이터가 부족하여 네트워크 유형 분석이 불가합니다.<br />
                  관심 키워드를 등록하고 다른 리더들과 연결되면 정확한 유형을 확인할 수 있습니다.
                </p>
              </div>
            </div>
            {/* 점수 바 (모두 0) */}
            <div className="space-y-3 pt-2 border-t border-outline/30">
              {snaResult.types.map((t, idx) => (
                <div key={idx} className="bg-surface border border-outline/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{t.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-on-surface/50">{t.type}</p>
                        <p className="text-[10px] text-on-surface-variant/50 uppercase tracking-widest">{t.metricName}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-on-surface-variant/40">0</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-low rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Dominant type card */}
            {(() => {
              const desc = SNA_DESCRIPTIONS[snaResult.dominant!.type];
              return (
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4">
                  <div className="flex gap-4 items-start">
                    <div className="text-5xl shrink-0">{snaResult.dominant!.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-primary/60 uppercase tracking-widest mb-0.5">{snaResult.dominant!.metricName} 최고</p>
                      <div className="flex items-baseline gap-2 mb-1">
                        <h3 className="text-xl font-black text-primary">{snaResult.dominant!.type} 유형</h3>
                        <span className="text-2xl font-black text-primary">{snaResult.dominant!.score.toFixed(0)}</span>
                        <span className="text-[11px] text-primary/50 font-bold">/ 100</span>
                      </div>
                      <p className="text-[11px] text-primary/60 mt-1">{snaResult.dominant!.detail}</p>
                    </div>
                  </div>
                  {desc && (
                    <div className="space-y-2 pt-2 border-t border-primary/20">
                      <p className="text-[11px] font-bold text-primary/80 leading-relaxed">{desc.leader}</p>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{desc.property}</p>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{desc.analogy}</p>
                    </div>
                  )}
                </div>
              );
            })()}

          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          2. 네트워크 추천 리더
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
              const sentReq = db.teaTimeRequests.find(r => r.fromUserId === currentUser?.id && r.toUserId === u.id);
              const receivedReq = !sentReq ? db.teaTimeRequests.find(r => r.fromUserId === u.id && r.toUserId === currentUser?.id) : undefined;
              return (
                <div key={u.id} className="bg-surface rounded-2xl border-2 border-primary/25 p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-4">
                    <button
                      onClick={() => receivedReq ? setReplyingToReq(receivedReq) : (!sentReq && setSelectedUser(u))}
                      className="w-12 h-12 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline shrink-0 hover:border-primary/50 hover:scale-105 transition-all"
                    >
                      {u.profilePic
                        ? <img src={u.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        : <span className="text-base font-bold text-primary">{u.name.charAt(0)}</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-on-surface-variant truncate uppercase font-medium">{u.company} · {u.department}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-on-surface">{u.name}</p>
                        <span className="text-[10px] font-black bg-primary text-on-primary px-2 py-0.5 rounded-full">공통 {count}개</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate">{u.title}</p>
                    </div>
                    {sentReq ? (
                      <span className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
                        sentReq.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' :
                        sentReq.status === 'rejected' ? 'bg-surface-container text-on-surface-variant border-outline/40' :
                        'bg-blue-50 text-blue-600 border-blue-200'
                      }`}>
                        {sentReq.status === 'accepted' ? '수락됨 ✓' : sentReq.status === 'rejected' ? '거절됨' : '신청 완료'}
                      </span>
                    ) : receivedReq ? (
                      <button
                        onClick={() => setReplyingToReq(receivedReq)}
                        className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                          receivedReq.status === 'pending'
                            ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                            : receivedReq.status === 'accepted'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-surface-container text-on-surface-variant border-outline/40'
                        }`}
                      >
                        {receivedReq.status === 'pending' ? '받은 요청 · 응답' : receivedReq.status === 'accepted' ? '수락함 ✓' : '거절함'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="shrink-0 text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        티타임 요청
                      </button>
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">공통 키워드</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw, idx) => (
                        <span key={idx} className="text-[11px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20 italic">{kw}</span>
                      ))}
                    </div>
                  </div>

                  {uInterests.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">등록한 관심사</p>
                      <div className="flex flex-wrap gap-1.5">
                        {uInterests.map((i: Interest) => (
                          <span key={i.id} className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${i.type === 'giver' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-secondary/5 text-secondary border-secondary/20'}`}>
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
        <SectionTitle icon="local_fire_department" title="HOT KEYWORD 10" />
        <p className="text-xs text-on-surface-variant font-medium -mt-2">
          이번 과정에서 가장 많은 리더들이 관심을 가진 키워드입니다. 키워드를 클릭하면 상세 내용을 확인할 수 있어요.
        </p>

        {hotKeywords.length === 0 ? (
          <p className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">키워드 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {(() => {
              const rankIcons: Record<number, string> = {
                1: '1️⃣', 2: '2️⃣', 3: '3️⃣',
                4: '4️⃣', 5: '5️⃣', 6: '6️⃣', 7: '7️⃣',
                8: '8️⃣', 9: '9️⃣', 10: '🔟',
              };
              // 동점 동순위 계산
              const ranks: number[] = [];
              let rank = 1;
              for (let i = 0; i < hotKeywords.length; i++) {
                if (i > 0 && hotKeywords[i].total < hotKeywords[i - 1].total) rank = i + 1;
                ranks.push(rank);
              }
              return hotKeywords.map((kw, idx) => {
              const giverCount = kw.givers.length;
              const takerCount = kw.takers.length;
              const total = kw.total;
              const giverPct = total > 0 ? Math.round((giverCount / total) * 100) : 0;
              const takerPct = 100 - giverPct;
              const medal = rankIcons[ranks[idx]] ?? `${ranks[idx]}위`;

              return (
                <button
                  key={kw.canonicalId}
                  onClick={() => setSelectedKeyword(kw)}
                  className="w-full bg-surface border border-outline rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl shrink-0">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-on-surface text-sm group-hover:text-primary transition-colors">#{kw.displayName}</h3>
                        <span className="text-[11px] text-on-surface-variant shrink-0">{total}명 관심</span>
                      </div>
                    </div>
                  </div>

                  {/* Giver / Taker bar */}
                  <div className="space-y-1.5">
                    <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                      <div className="bg-primary rounded-full transition-all duration-500" style={{ width: `${giverPct}%` }} />
                      <div className="bg-secondary rounded-full transition-all duration-500" style={{ width: `${takerPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-primary">Giver {giverCount}명 ({giverPct}%)</span>
                      <span className="text-secondary">Taker {takerCount}명 ({takerPct}%)</span>
                    </div>
                  </div>
                </button>
              );
            });
            })()}
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
                <p className="text-[11px] text-on-surface-variant uppercase tracking-widest font-bold mb-0.5">HOT KEYWORD</p>
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
                              <p className="text-[10px] text-on-surface-variant truncate">{user.company} · {user.department} · {user.title}</p>
                            </div>
                          </div>
                          {i.description && <p className="text-[11px] text-on-surface-variant leading-relaxed italic">"{i.description}"</p>}
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
                              <p className="text-[10px] text-on-surface-variant truncate">{user.company} · {user.department} · {user.title}</p>
                            </div>
                          </div>
                          {i.description && <p className="text-[11px] text-on-surface-variant leading-relaxed italic">"{i.description}"</p>}
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

      {replyingToReq && (() => {
        const fromUser = db.users.find(u => u.id === replyingToReq.fromUserId);
        if (!fromUser) return null;
        return (
          <TeaReplyModal
            request={replyingToReq}
            fromUser={fromUser}
            onReply={async (status, msg) => {
              await updateTeaTimeRequest(replyingToReq.id, status, msg);
              setReplyingToReq(null);
            }}
            onClose={() => setReplyingToReq(null)}
          />
        );
      })()}

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
