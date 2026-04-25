import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, TeaTimeRequest } from '../store';

type NotifKind = 'incoming' | 'response';
interface Notif {
  kind: NotifKind;
  req: TeaTimeRequest;
  // 응답 알림에 대한 고유 키 (status까지 반영해서, 같은 요청의 추후 상태 변동도 분리)
  key: string;
}

export default function NotificationBell({ onNotificationClick }: { onNotificationClick?: () => void }) {
  const { currentUser, db, updateTeaTimeRequest } = useStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenIncomingIds, setSeenIncomingIds] = useState<string[]>([]);
  const [seenResponseKeys, setSeenResponseKeys] = useState<string[]>([]);
  const [panelNotifs, setPanelNotifs] = useState<Notif[]>([]);
  const [replyingTo, setReplyingTo] = useState<TeaTimeRequest | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    if (currentUser) {
      const incoming = localStorage.getItem(`seenRequests_${currentUser.id}`);
      setSeenIncomingIds(incoming ? JSON.parse(incoming) : []);
      const responses = localStorage.getItem(`seenResponses_${currentUser.id}`);
      setSeenResponseKeys(responses ? JSON.parse(responses) : []);
    } else {
      setSeenIncomingIds([]);
      setSeenResponseKeys([]);
    }
  }, [currentUser]);

  // 받은 요청 중 미응답
  const incomingPending = db.teaTimeRequests.filter(
    (r) => r.toUserId === currentUser?.id && r.status === 'pending'
  );
  // 내가 보낸 요청 중 응답이 도착한 것 (accepted / rejected)
  const myResponses = db.teaTimeRequests.filter(
    (r) => r.fromUserId === currentUser?.id && (r.status === 'accepted' || r.status === 'rejected')
  );

  const unseenIncoming = incomingPending.filter((r) => !seenIncomingIds.includes(r.id));
  const unseenResponses = myResponses.filter((r) => !seenResponseKeys.includes(`${r.id}:${r.status}`));
  const hasNewNotifications = unseenIncoming.length + unseenResponses.length > 0;

  const handleBellClick = () => {
    if (!showNotifications) {
      const toShow: Notif[] = [
        ...unseenIncoming.map((r) => ({ kind: 'incoming' as const, req: r, key: r.id })),
        ...unseenResponses.map((r) => ({ kind: 'response' as const, req: r, key: `${r.id}:${r.status}` })),
      ];
      setPanelNotifs(toShow);
      // 즉시 읽음 처리 (incoming)
      if (unseenIncoming.length > 0) {
        const newIds = [...new Set([...seenIncomingIds, ...unseenIncoming.map((r) => r.id)])];
        setSeenIncomingIds(newIds);
        localStorage.setItem(`seenRequests_${currentUser?.id}`, JSON.stringify(newIds));
      }
      // 즉시 읽음 처리 (response)
      if (unseenResponses.length > 0) {
        const newKeys = [
          ...new Set([...seenResponseKeys, ...unseenResponses.map((r) => `${r.id}:${r.status}`)]),
        ];
        setSeenResponseKeys(newKeys);
        localStorage.setItem(`seenResponses_${currentUser?.id}`, JSON.stringify(newKeys));
      }
    }
    setShowNotifications((prev) => !prev);
  };

  const handleReply = async (status: 'accepted' | 'rejected') => {
    if (!replyingTo) return;
    await updateTeaTimeRequest(replyingTo.id, status, replyMessage);
    setReplyingTo(null);
    setReplyMessage('');
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={handleBellClick}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${hasNewNotifications ? 'text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
        >
          <motion.span
            animate={hasNewNotifications ? { scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] } : {}}
            transition={hasNewNotifications ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } : {}}
            className="material-symbols-outlined"
            style={{ fontVariationSettings: hasNewNotifications ? "'FILL' 1" : "'FILL' 0" }}
          >
            notifications
          </motion.span>
          {hasNewNotifications && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border border-white"></span>
          )}
        </button>

        <AnimatePresence>
          {showNotifications && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNotifications(false)}
                className="fixed inset-0 z-[-1]"
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute md:right-0 -right-28 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-outline rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-outline bg-surface-container-low flex justify-between items-center">
                  <span className="text-sm font-black text-primary uppercase tracking-tight">알림</span>
                  {panelNotifs.length > 0 && (
                    <span className="text-[10px] font-bold text-on-surface-variant/60">
                      {panelNotifs.length}건의 새 알림
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {panelNotifs.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">notifications_off</span>
                      <p className="text-xs text-on-surface-variant font-medium">새로운 알림이 없습니다.</p>
                    </div>
                  ) : (
                    panelNotifs.map((n) => {
                      if (n.kind === 'incoming') {
                        const fromUser = db.users.find((u) => u.id === n.req.fromUserId);
                        return (
                          <div
                            key={n.key}
                            onClick={() => {
                              setShowNotifications(false);
                              onNotificationClick?.();
                            }}
                            className="p-4 border-b border-outline hover:bg-surface-container-lowest transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden">
                                {fromUser?.profilePic ? (
                                  fromUser.profilePic.length < 5 ? (
                                    <span className="text-sm">{fromUser.profilePic}</span>
                                  ) : (
                                    <img src={fromUser.profilePic} alt="" className="w-full h-full object-cover" />
                                  )
                                ) : (
                                  <span className="text-xs font-bold text-primary">{fromUser?.name?.charAt(0)}</span>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-on-surface">{fromUser?.name} 리더님</p>
                                <p className="text-[10px] text-on-surface-variant font-medium">티타임 요청을 보냈습니다.</p>
                              </div>
                            </div>
                            <div className="bg-surface-container-low/50 p-2 rounded-lg space-y-1">
                              {n.req.message.includes('\n\n') ? (
                                <>
                                  <div className="flex flex-wrap gap-1">
                                    {n.req.message
                                      .split('\n\n')[0]
                                      .split(' ')
                                      .filter((tag) => tag.startsWith('#'))
                                      .map((tag, idx) => (
                                        <span key={idx} className="text-[8px] font-black text-primary bg-primary/5 px-1 rounded border border-primary/10 uppercase tracking-tight italic">
                                          {tag}
                                        </span>
                                      ))}
                                  </div>
                                  <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-2 italic">
                                    "{n.req.message.split('\n\n')[1]}"
                                  </p>
                                </>
                              ) : (
                                <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-2 italic">
                                  "{n.req.message}"
                                </p>
                              )}
                            </div>
                            <div className="mt-2 flex justify-end">
                              <span className="text-[10px] font-black text-primary uppercase tracking-tight group-hover:underline">
                                상세보기
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        // response 알림
                        const toUser = db.users.find((u) => u.id === n.req.toUserId);
                        const accepted = n.req.status === 'accepted';
                        return (
                          <div
                            key={n.key}
                            onClick={() => {
                              setShowNotifications(false);
                              onNotificationClick?.();
                            }}
                            className="p-4 border-b border-outline hover:bg-surface-container-lowest transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden ${accepted ? 'bg-success/10 border-success/20' : 'bg-error/10 border-error/20'}`}
                              >
                                {toUser?.profilePic ? (
                                  toUser.profilePic.length < 5 ? (
                                    <span className="text-sm">{toUser.profilePic}</span>
                                  ) : (
                                    <img src={toUser.profilePic} alt="" className="w-full h-full object-cover" />
                                  )
                                ) : (
                                  <span
                                    className={`material-symbols-outlined text-base ${accepted ? 'text-success' : 'text-error'}`}
                                  >
                                    {accepted ? 'check_circle' : 'cancel'}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-on-surface">
                                  {toUser?.name} 리더님이 {accepted ? '수락' : '거절'}했어요
                                </p>
                                <p
                                  className={`text-[10px] font-bold uppercase tracking-widest ${accepted ? 'text-success' : 'text-error'}`}
                                >
                                  {accepted ? '티타임 수락 회신' : '티타임 거절 회신'}
                                </p>
                              </div>
                            </div>
                            {n.req.responseMessage && (
                              <div className="bg-surface-container-low/50 p-2 rounded-lg">
                                <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-3 italic">
                                  "{n.req.responseMessage}"
                                </p>
                              </div>
                            )}
                            <div className="mt-2 flex justify-end">
                              <span className="text-[10px] font-black text-primary uppercase tracking-tight group-hover:underline">
                                상세보기
                              </span>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Reply Modal */}
      <AnimatePresence>
        {replyingTo && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReplyingTo(null)}
              className="absolute inset-0 bg-on-background/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-primary uppercase tracking-tight">티타임 요청 회신</h3>
                <button onClick={() => setReplyingTo(null)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-surface-container-low p-4 rounded-2xl border border-outline space-y-2">
                  <p className="text-[10px] font-black text-on-surface-variant/60 uppercase mb-1 tracking-widest">요청 메시지</p>
                  {replyingTo.message.includes('\n\n') ? (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {replyingTo.message
                          .split('\n\n')[0]
                          .split(' ')
                          .filter((tag) => tag.startsWith('#'))
                          .map((tag, idx) => (
                            <span key={idx} className="text-[9px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 uppercase tracking-widest italic">
                              {tag}
                            </span>
                          ))}
                      </div>
                      <p className="text-sm text-on-surface font-medium italic">"{replyingTo.message.split('\n\n')[1]}"</p>
                    </>
                  ) : (
                    <p className="text-sm text-on-surface font-medium italic">"{replyingTo.message}"</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest">회신 메시지</label>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="수락 또는 거절 메시지를 입력해주세요."
                    rows={4}
                    className="w-full bg-surface border border-outline rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:border-primary transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleReply('rejected')}
                    className="py-4 border-2 border-outline text-on-surface-variant font-black rounded-xl hover:bg-surface-container-low transition-all uppercase tracking-widest text-xs"
                  >
                    거절하기
                  </button>
                  <button
                    onClick={() => handleReply('accepted')}
                    className="py-4 bg-primary text-on-primary font-black rounded-xl shadow-lg hover:bg-primary/90 transition-all uppercase tracking-widest text-xs"
                  >
                    수락하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
