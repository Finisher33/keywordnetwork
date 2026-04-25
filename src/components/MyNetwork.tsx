import { useMemo, useState, useRef } from 'react';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import { useStore, User, Interest } from '../store';
import { calculateUserNetworkData, calculateHotKeywords, HotKeyword, buildInterestKeyIndex } from '../utils/networkUtils';
import TeaTimeModal, { TeaReplyModal } from './TeaTimeModal';
import { genId } from '../utils/genId';
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

export default function MyNetwork({ targetUser, hideActions = false }: MyNetworkProps) {
  const { db, currentUser: storeUser, fetchData, updateTeaTimeRequest, sendTeaTimeRequest } = useStore();
  const currentUser = targetUser || storeUser;
  const { toast, showToast } = useToast();

  // ── state ──────────────────────────────────────────────────────────────────
  const [selectedKeyword, setSelectedKeyword] = useState<HotKeyword | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [replyingToReq, setReplyingToReq] = useState<TeaTimeRequest | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── data ───────────────────────────────────────────────────────────────────
  const networkData = useMemo(() => {
    if (!currentUser) return null;
    return calculateUserNetworkData(currentUser, db);
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
  const handleSendTeaTime = async (toUserId: string, message: string) => {
    if (!currentUser) return;
    await sendTeaTimeRequest({
      id: genId('tt'),
      fromUserId: currentUser.id,
      toUserId,
      message,
      status: 'pending'
    });
    setSelectedUser(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await fetchData(); } finally { setIsRefreshing(false); }
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
            <button onClick={handleRefresh} disabled={isRefreshing}
              className={`w-9 h-9 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`}
              title="새로고침">
              <span className="material-symbols-outlined text-on-surface-variant text-lg">refresh</span>
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          1. 네트워크 추천 리더
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
            {recommendedLeaders.map(({ user: u, count }) => {
              const uInterests = db.interests.filter((i: Interest) => i.userId === u.id);
              const myUserInterests = db.interests.filter((i: Interest) => i.userId === currentUser?.id);
              // 본인 + 상대 interest 합쳐 그룹 인덱스 만들기 → 공통 그룹 도출
              const idxLocal = buildInterestKeyIndex([...uInterests, ...myUserInterests], db.canonicalTerms);
              const myGroupKeys = new Set(myUserInterests.map(i => idxLocal.groupOf(i.id)));
              // 상대가 입력한 interest 들 중 공통 그룹에 속한 것만 → 표시 대상
              const commonInterests = uInterests.filter(i => myGroupKeys.has(idxLocal.groupOf(i.id)));
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

                  {/* 공통 키워드별 입력 내용 */}
                  {commonInterests.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                        공통 키워드 · 입력 내용
                      </p>
                      <ul className="space-y-2.5">
                        {commonInterests.map((i: Interest) => {
                          const isGiver = i.type === 'giver';
                          return (
                            <li
                              key={i.id}
                              className={`relative pl-3.5 pr-3 py-3 rounded-xl border-l-4 border ${
                                isGiver
                                  ? 'bg-primary/[0.06] border-l-primary border-primary/15'
                                  : 'bg-secondary/[0.06] border-l-secondary border-secondary/15'
                              }`}
                            >
                              {/* 1단: 공통 키워드 — 가장 크고 진하게 강조 */}
                              <p
                                className={`text-[16px] font-black tracking-tight leading-tight ${
                                  isGiver ? 'text-primary' : 'text-secondary'
                                }`}
                              >
                                #{i.keyword}
                              </p>

                              {/* 2단: 유형 + 보조 안내 — 작고 차분하게 (텍스트형) */}
                              <div className="mt-1 mb-2 flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider ${
                                    isGiver ? 'text-primary/70' : 'text-secondary/70'
                                  }`}
                                >
                                  {isGiver ? 'Giver' : 'Taker'}
                                </span>
                                <span className="text-[10px] text-on-surface-variant/60">·</span>
                                <span className="text-[10px] text-on-surface-variant/80 font-medium">
                                  {isGiver ? '도움을 드릴 수 있어요.' : '도움을 받고 싶어요.'}
                                </span>
                              </div>

                              {/* 3단: 작성 의견 — 카드 본문으로 강조 */}
                              <p className="text-[13px] text-on-surface leading-relaxed font-medium">
                                "{i.description?.trim() || '(설명 없음)'}"
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          2. HOT KEYWORDS
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
                      const isSelf = user.id === currentUser?.id;
                      const sentReq = !isSelf
                        ? db.teaTimeRequests.find(r => r.fromUserId === currentUser?.id && r.toUserId === user.id)
                        : undefined;
                      const receivedReq = !isSelf && !sentReq
                        ? db.teaTimeRequests.find(r => r.fromUserId === user.id && r.toUserId === currentUser?.id)
                        : undefined;
                      return (
                        <div key={i.id} className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 overflow-hidden flex items-center justify-center shrink-0 border border-primary/20">
                              {user.profilePic
                                ? <img src={user.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                : <span className="text-xs font-bold text-primary">{user.name.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-on-surface truncate">{user.name}{isSelf && <span className="ml-1 text-[9px] font-bold text-on-surface-variant">(나)</span>}</p>
                              <p className="text-[10px] text-on-surface-variant truncate">{user.company} · {user.department} · {user.title}</p>
                            </div>
                            {!isSelf && (
                              sentReq ? (
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border ${
                                  sentReq.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' :
                                  sentReq.status === 'rejected' ? 'bg-surface-container text-on-surface-variant border-outline/40' :
                                  'bg-blue-50 text-blue-600 border-blue-200'
                                }`}>
                                  {sentReq.status === 'accepted' ? '수락됨 ✓' : sentReq.status === 'rejected' ? '거절됨' : '신청 완료'}
                                </span>
                              ) : receivedReq ? (
                                <button
                                  onClick={() => setReplyingToReq(receivedReq)}
                                  className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                                    receivedReq.status === 'pending'
                                      ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                                      : receivedReq.status === 'accepted'
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-surface-container text-on-surface-variant border-outline/40'
                                  }`}
                                >
                                  {receivedReq.status === 'pending' ? '응답하기' : receivedReq.status === 'accepted' ? '수락함 ✓' : '거절함'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSelectedUser(user)}
                                  className="shrink-0 text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md hover:bg-primary/20 transition-colors"
                                >
                                  티타임 요청
                                </button>
                              )
                            )}
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
                      const isSelf = user.id === currentUser?.id;
                      const sentReq = !isSelf
                        ? db.teaTimeRequests.find(r => r.fromUserId === currentUser?.id && r.toUserId === user.id)
                        : undefined;
                      const receivedReq = !isSelf && !sentReq
                        ? db.teaTimeRequests.find(r => r.fromUserId === user.id && r.toUserId === currentUser?.id)
                        : undefined;
                      return (
                        <div key={i.id} className="bg-secondary/5 border border-secondary/15 rounded-xl p-3">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-secondary/10 overflow-hidden flex items-center justify-center shrink-0 border border-secondary/20">
                              {user.profilePic
                                ? <img src={user.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                : <span className="text-xs font-bold text-secondary">{user.name.charAt(0)}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-on-surface truncate">{user.name}{isSelf && <span className="ml-1 text-[9px] font-bold text-on-surface-variant">(나)</span>}</p>
                              <p className="text-[10px] text-on-surface-variant truncate">{user.company} · {user.department} · {user.title}</p>
                            </div>
                            {!isSelf && (
                              sentReq ? (
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border ${
                                  sentReq.status === 'accepted' ? 'bg-green-50 text-green-700 border-green-200' :
                                  sentReq.status === 'rejected' ? 'bg-surface-container text-on-surface-variant border-outline/40' :
                                  'bg-blue-50 text-blue-600 border-blue-200'
                                }`}>
                                  {sentReq.status === 'accepted' ? '수락됨 ✓' : sentReq.status === 'rejected' ? '거절됨' : '신청 완료'}
                                </span>
                              ) : receivedReq ? (
                                <button
                                  onClick={() => setReplyingToReq(receivedReq)}
                                  className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                                    receivedReq.status === 'pending'
                                      ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                                      : receivedReq.status === 'accepted'
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-surface-container text-on-surface-variant border-outline/40'
                                  }`}
                                >
                                  {receivedReq.status === 'pending' ? '응답하기' : receivedReq.status === 'accepted' ? '수락함 ✓' : '거절함'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSelectedUser(user)}
                                  className="shrink-0 text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20 px-2 py-1 rounded-md hover:bg-secondary/20 transition-colors"
                                >
                                  티타임 요청
                                </button>
                              )
                            )}
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
          compact
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

    </div>
  );
}
