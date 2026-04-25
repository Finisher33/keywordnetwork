import { useState } from 'react';
import { User, Interest, TeaTimeRequest } from '../store';

interface TeaTimeModalProps {
  targetUser: User;
  currentUser: User;
  myInterests: Interest[];
  targetInterests: Interest[];
  onSend: (toUserId: string, message: string) => void;
  onClose: () => void;
}

export default function TeaTimeModal({ targetUser, currentUser, myInterests, targetInterests, onSend, onClose }: TeaTimeModalProps) {
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (isSending) return; // 더블클릭 / 빠른 연타 차단
    if (!msg.trim()) { setMsgError(true); return; }
    setMsgError(false);
    setIsSending(true);
    try {
      const myHashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
      await onSend(targetUser.id, `${myHashtags}\n\n${msg}`);
    } finally {
      setIsSending(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface p-6 rounded-2xl border border-outline max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline">
              {targetUser.profilePic ? (
                <img src={targetUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="material-symbols-outlined text-5xl text-primary/40">face</span>
              )}
            </div>
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">
                {targetUser.company} · {targetUser.department}
              </p>
              <h3 className="font-bold text-xl text-on-surface">{targetUser.name}</h3>
              <p className="text-sm text-primary font-medium">{targetUser.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Target user interests */}
        {targetInterests.length > 0 && (
          <div className="space-y-4 mb-6">
            {['giver', 'taker'].map(type => {
              const items = targetInterests.filter(i => i.type === type);
              if (items.length === 0) return null;
              return (
                <div key={type} className="space-y-2">
                  <h4 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${type === 'giver' ? 'text-primary' : 'text-secondary'}`}>
                    <span className="material-symbols-outlined text-sm">
                      {type === 'giver' ? 'volunteer_activism' : 'pan_tool'}
                    </span>
                    {type === 'giver' ? 'be Giver' : 'be Taker'}
                  </h4>
                  <div className="grid gap-2">
                    {items.map(i => (
                      <div key={i.id} className="bg-surface-container-low p-3 rounded-xl border border-outline">
                        <p className={`text-sm font-bold mb-1 ${type === 'giver' ? 'text-primary' : 'text-secondary'}`}>#{i.keyword}</p>
                        <p className="text-xs text-on-surface-variant">{i.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tea time request form */}
        <div className="space-y-3 pt-4 border-t border-outline">
          <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">티타임 요청</h4>
          <p className="text-[10px] text-on-surface-variant font-medium">
            {targetUser.name}님에게 구체적인 일정과 장소를 기재하여 티타임을 제안해보세요.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {myInterests.map(i => (
              <span key={i.id} className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20">
                #{i.keyword}
              </span>
            ))}
          </div>
          <textarea
            value={msg}
            onChange={e => { setMsg(e.target.value); if (e.target.value.trim()) setMsgError(false); }}
            placeholder={`${targetUser.name}님에게 보낼 메시지를 작성하세요...`}
            className={`w-full bg-surface-container-low border rounded-xl p-4 text-sm resize-none outline-none focus:border-primary ${msgError ? 'border-error' : 'border-outline'}`}
            rows={4}
          />
          {msgError && (
            <p className="text-[11px] text-error font-medium flex items-center gap-1 -mt-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              메시지를 입력해주세요.
            </p>
          )}
          <button
            onClick={handleSend}
            disabled={isSending}
            className="w-full py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSending ? '보내는 중...' : '요청 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 티타임 응답 모달 (받은 요청에 수락/거절) ─────────────────────────────────
export function TeaReplyModal({
  request,
  fromUser,
  onReply,
  onClose,
}: {
  request: TeaTimeRequest;
  fromUser: User;
  onReply: (status: 'accepted' | 'rejected', message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [replyMsg, setReplyMsg] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async (status: 'accepted' | 'rejected') => {
    setSending(true);
    try { await onReply(status, replyMsg); } finally { setSending(false); }
  };

  const parts = request.message.includes('\n\n') ? request.message.split('\n\n') : [null, request.message];
  const hashtags = parts[0] ? parts[0].split(' ').filter(t => t.startsWith('#')) : [];
  const mainMsg = parts.length > 1 ? parts[1] : parts[0] || '';

  const isPending = request.status === 'pending';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface p-6 rounded-2xl border border-outline max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center border border-outline bg-surface-container-low shrink-0">
            {fromUser.profilePic && fromUser.profilePic.length > 4
              ? <img src={fromUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : <span className="font-bold text-primary text-sm">{fromUser.name.charAt(0)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-on-surface-variant truncate uppercase font-medium">{fromUser.company}{fromUser.department ? ` · ${fromUser.department}` : ''}</p>
            <p className="font-bold text-on-surface text-sm">{fromUser.name}</p>
            <p className="text-[10px] text-primary font-medium truncate">{fromUser.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-highest shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
          </button>
        </div>

        {/* 받은 메시지 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 space-y-1.5">
          <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">받은 티타임 제안</p>
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, i) => (
                <span key={i} className="text-[9px] font-bold text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">{tag}</span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-on-surface-variant leading-relaxed whitespace-pre-line">{mainMsg}</p>
        </div>

        {/* 이미 응답한 경우 */}
        {!isPending ? (
          <div className={`rounded-xl px-4 py-3 text-center ${request.status === 'accepted' ? 'bg-green-50 border border-green-200' : 'bg-surface-container border border-outline/40'}`}>
            <p className={`text-sm font-black ${request.status === 'accepted' ? 'text-green-700' : 'text-on-surface-variant'}`}>
              {request.status === 'accepted' ? '✓ 수락한 요청입니다' : '거절한 요청입니다'}
            </p>
            {request.responseMessage && <p className="text-[10px] text-on-surface-variant mt-1 italic">"{request.responseMessage}"</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-on-surface uppercase tracking-widest">회신 메시지 (선택)</p>
            <textarea
              value={replyMsg}
              onChange={e => setReplyMsg(e.target.value)}
              placeholder="티타임 요청에 대한 답변을 입력해주세요."
              rows={3}
              className="w-full bg-surface-container-low border border-outline rounded-xl p-3 text-sm resize-none outline-none focus:border-primary"
            />
            <button onClick={() => handleReply('accepted')} disabled={sending}
              className="w-full py-3 bg-primary text-on-primary font-black rounded-xl shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 text-xs">
              수락하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
