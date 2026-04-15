import { useState } from 'react';
import { User, Interest } from '../store';

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

  const handleSend = () => {
    if (!msg.trim()) { alert('메시지를 입력해주세요.'); return; }
    const myHashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
    onSend(targetUser.id, `${myHashtags}\n\n${msg}`);
    onClose();
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
            onChange={e => setMsg(e.target.value)}
            placeholder={`${targetUser.name}님에게 보낼 메시지를 작성하세요...`}
            className="w-full bg-surface-container-low border border-outline rounded-xl p-4 text-sm resize-none outline-none focus:border-primary"
            rows={4}
          />
          <button
            onClick={handleSend}
            className="w-full py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all"
          >
            요청 보내기
          </button>
        </div>
      </div>
    </div>
  );
}
