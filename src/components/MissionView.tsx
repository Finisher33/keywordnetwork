import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, User, TeaTimeRequest } from '../store';
import { TeaReplyModal } from './TeaTimeModal';

const isUrl = (s?: string) =>
  !!s && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/'));

export default function MissionView({
  onNavigateToLibrary,
  onNavigateToNetwork,
}: {
  onNavigateToLibrary?: () => void;
  onNavigateToNetwork?: () => void;
}) {
  const { db, currentUser, fetchData, updateTeaTimeRequest } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [replyingToReq, setReplyingToReq] = useState<TeaTimeRequest | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await fetchData(); } finally { setIsRefreshing(false); }
  };

  const sentRequests = useMemo(
    () => !currentUser ? [] : db.teaTimeRequests
      .filter(r => r.fromUserId === currentUser.id)
      .sort((a, b) => b.id.localeCompare(a.id)),
    [db.teaTimeRequests, currentUser]
  );

  const receivedRequests = useMemo(
    () => !currentUser ? [] : db.teaTimeRequests
      .filter(r => r.toUserId === currentUser.id)
      .sort((a, b) => b.id.localeCompare(a.id)),
    [db.teaTimeRequests, currentUser]
  );

  const sentCount = new Set(sentRequests.map(r => r.toUserId)).size;
  const receivedCount = new Set(receivedRequests.map(r => r.fromUserId)).size;
  const concludedCount = useMemo(() => {
    const acceptedSent = sentRequests.filter(r => r.status === 'accepted').length;
    const acceptedReceived = receivedRequests.filter(r => r.status === 'accepted').length;
    return acceptedSent + acceptedReceived;
  }, [sentRequests, receivedRequests]);

  if (!currentUser) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="pb-3 border-b-2 border-primary/30">
        <h1 className="font-headline text-xl font-black uppercase tracking-widest text-primary">TEA TIME</h1>
        <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">티타임 제안/수신 현황</p>
      </div>

      {/* 안내 문구 */}
      <div className="bg-secondary/6 border border-secondary/20 rounded-xl px-4 py-4 space-y-2">
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          관심있는 리더분을 탐색하고, 티타임을 제안해보세요. 제안받은 티타임은 내용을 읽고 응답해주세요.
        </p>
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          본 과정 기간 중에 혹은 과정 종료 후에도 티타임을 통해 유익한 시간을 보내시기를 바랍니다. :)
        </p>
      </div>

      {/* 새로고침 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant border border-outline/60 rounded-lg px-3 py-1.5 hover:bg-surface-container-low transition-all ${isRefreshing ? 'opacity-60' : ''}`}
        >
          <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
          {isRefreshing ? '업데이트 중...' : '최신 데이터로 업데이트'}
        </button>
      </div>

      {/* 티타임 진행 현황 */}
      <div className="bg-surface-container-low border border-outline/40 rounded-xl px-4 py-3 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">티타임 진행 현황</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg">
            제안 {sentCount}건
          </span>
          <span className="text-[11px] font-bold text-secondary bg-secondary/8 border border-secondary/25 px-3 py-1 rounded-lg">
            수신 {receivedCount}건
          </span>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-lg border ${concludedCount > 0 ? 'text-green-700 bg-green-50 border-green-200' : 'text-on-surface-variant bg-surface-container border-outline/40'}`}>
            성사 {concludedCount}건
          </span>
        </div>
      </div>

      {/* 내가 제안한 티타임 */}
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
          내가 제안한 티타임{sentRequests.length > 0 ? ` (${sentCount}명)` : ''}
        </p>
        {sentRequests.length === 0 ? (
          <div className="bg-surface-container rounded-xl border border-outline/30 px-4 py-5 text-center space-y-2">
            <p className="text-[11px] text-on-surface-variant/60">아직 제안한 티타임이 없습니다.</p>
            <button
              onClick={onNavigateToLibrary}
              className="text-[11px] font-bold text-primary underline underline-offset-2"
            >
              LIBRARY에서 리더 탐색하기 →
            </button>
          </div>
        ) : (
          sentRequests.map((req, idx) => {
            const toUser = db.users.find((u: User) => u.id === req.toUserId);
            if (!toUser) return null;
            const statusLabel =
              req.status === 'accepted' ? { text: '수락됨 ✓', cls: 'bg-green-50 text-green-700 border-green-200' } :
              req.status === 'rejected' ? { text: '거절됨', cls: 'bg-surface-container text-on-surface-variant border-outline/40' } :
              { text: '대기 중', cls: 'bg-blue-50 text-blue-600 border-blue-200' };
            const displayMsg = req.message.includes('\n\n') ? req.message.split('\n\n')[1] : req.message;

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                className="bg-surface rounded-xl border border-outline/40 p-4 space-y-3"
              >
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center shrink-0 border border-outline">
                    {isUrl(toUser.profilePic)
                      ? <img src={toUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="font-bold text-secondary text-[11px]">{toUser.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-on-surface truncate">{toUser.name}</p>
                        <p className="text-[11px] text-on-surface-variant truncate">
                          {toUser.company}{toUser.department ? ` · ${toUser.department}` : ''}
                        </p>
                        {toUser.title && <p className="text-[11px] text-on-surface-variant/70 truncate">{toUser.title}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${statusLabel.cls}`}>
                        {statusLabel.text}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-primary/6 border border-primary/20 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">내 제안</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{displayMsg}</p>
                </div>
                {req.responseMessage && (
                  <div className={`rounded-xl px-3 py-2.5 border ${req.status === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-surface-container border-outline/40'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${req.status === 'accepted' ? 'text-green-700' : 'text-on-surface-variant'}`}>
                      {toUser.name}님의 응답
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{req.responseMessage}</p>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* 내가 요청받은 티타임 */}
      <div className="space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
          내가 요청받은 티타임{receivedRequests.length > 0 ? ` (${receivedRequests.length}건)` : ''}
        </p>
        {receivedRequests.length === 0 ? (
          <div className="bg-surface-container rounded-xl border border-outline/30 px-4 py-5 text-center">
            <p className="text-[11px] text-on-surface-variant/60">아직 받은 티타임 요청이 없습니다.</p>
          </div>
        ) : (
          receivedRequests.map((req, idx) => {
            const fromUser = db.users.find((u: User) => u.id === req.fromUserId);
            if (!fromUser) return null;
            const statusLabel =
              req.status === 'accepted' ? { text: '수락함 ✓', cls: 'bg-green-50 text-green-700 border-green-200' } :
              req.status === 'rejected' ? { text: '거절함', cls: 'bg-surface-container text-on-surface-variant border-outline/40' } :
              { text: '응답 대기', cls: 'bg-amber-50 text-amber-600 border-amber-200' };
            const displayMsg = req.message.includes('\n\n') ? req.message.split('\n\n')[1] : req.message;

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                className="bg-surface rounded-xl border border-outline/40 p-4 space-y-3"
              >
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center shrink-0 border border-outline">
                    {isUrl(fromUser.profilePic)
                      ? <img src={fromUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      : <span className="font-bold text-secondary text-[11px]">{fromUser.name.charAt(0)}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-on-surface truncate">{fromUser.name}</p>
                        <p className="text-[11px] text-on-surface-variant truncate">
                          {fromUser.company}{fromUser.department ? ` · ${fromUser.department}` : ''}
                        </p>
                        {fromUser.title && <p className="text-[11px] text-on-surface-variant/70 truncate">{fromUser.title}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${statusLabel.cls}`}>
                        {statusLabel.text}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-secondary/6 border border-secondary/20 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest mb-1">{fromUser.name}님의 제안</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{displayMsg}</p>
                </div>
                {req.responseMessage ? (
                  <div className={`rounded-xl px-3 py-2.5 border ${req.status === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-surface-container border-outline/40'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${req.status === 'accepted' ? 'text-green-700' : 'text-on-surface-variant'}`}>
                      내 응답
                    </p>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">{req.responseMessage}</p>
                  </div>
                ) : req.status === 'pending' ? (
                  <button
                    onClick={() => setReplyingToReq(req)}
                    className="w-full py-2.5 bg-amber-500 text-white font-bold text-xs rounded-xl hover:bg-amber-600 active:scale-95 transition-all"
                  >
                    응답하기
                  </button>
                ) : null}
              </motion.div>
            );
          })
        )}
      </div>

      {/* 탐색 버튼 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNavigateToNetwork}
          className="py-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs border border-primary/20"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>diversity_2</span>
          MY NETWORK
        </button>
        <button
          onClick={onNavigateToLibrary}
          className="py-3 bg-secondary text-on-secondary font-bold rounded-xl hover:bg-secondary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
          LIBRARY
        </button>
      </div>

      {/* 응답 모달 */}
      <AnimatePresence>
        {replyingToReq && (() => {
          const fromUser = db.users.find((u: User) => u.id === replyingToReq.fromUserId);
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
      </AnimatePresence>
    </div>
  );
}
