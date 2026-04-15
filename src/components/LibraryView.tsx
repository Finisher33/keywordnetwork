import { useState, useMemo } from 'react';
import { useStore, User, Interest } from '../store';

// ── Library 전용 티타임 모달 (다른 페이지의 TeaTimeModal과 완전 분리) ──────────
function LibraryTeaTimeModal({
  targetUser,
  myInterests,
  onSend,
  onClose,
}: {
  targetUser: User;
  myInterests: Interest[];
  onSend: (message: string) => void;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState('');

  const handleSend = () => {
    if (!msg.trim()) { alert('메시지를 입력해주세요.'); return; }
    const hashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
    onSend(hashtags ? `${hashtags}\n\n${msg}` : msg);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline"
        onClick={e => e.stopPropagation()}
      >
        {/* 상대방 프로필 */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center border border-outline bg-surface-container-low shrink-0">
            {targetUser.profilePic
              ? <img src={targetUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : <span className="font-bold text-primary text-sm">{targetUser.name.charAt(0)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-on-surface-variant truncate uppercase font-medium">{targetUser.company} · {targetUser.department}</p>
            <p className="font-bold text-on-surface text-sm">{targetUser.name}</p>
            <p className="text-[10px] text-primary font-medium truncate">{targetUser.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-highest shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
          </button>
        </div>

        {/* 티타임 요청 폼 */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-on-surface uppercase tracking-widest">티타임 요청</p>
          {myInterests.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {myInterests.map(i => (
                <span key={i.id} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20">
                  #{i.keyword}
                </span>
              ))}
            </div>
          )}
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder={`${targetUser.name}님에게 보낼 메시지를 작성하세요...`}
            rows={4}
            className="w-full bg-surface-container-low border border-outline rounded-xl p-3 text-sm resize-none outline-none focus:border-primary"
          />
          <button
            onClick={handleSend}
            className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all"
          >
            요청 보내기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LibraryView() {
  const { db, currentUser, sendTeaTimeRequest } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  const courseUsers = useMemo(() =>
    db.users.filter(u => u.courseId === currentUser?.courseId),
    [db.users, currentUser]
  );

  const myInterests = useMemo(() =>
    db.interests.filter(i => i.userId === currentUser?.id),
    [db.interests, currentUser]
  );

  // 과정 참여자 전체 키워드 목록 (중복 제거, 빈도순 정렬)
  const allKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    const courseUserIds = new Set(courseUsers.map(u => u.id));
    db.interests
      .filter((i: Interest) => courseUserIds.has(i.userId))
      .forEach((i: Interest) => {
        const kw = i.keyword.trim();
        if (kw) counts[kw] = (counts[kw] || 0) + 1;
      });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, count]) => ({ keyword, count }));
  }, [courseUsers, db.interests]);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });
  };

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return courseUsers
      .filter(u => {
        if (q) {
          const matches =
            u.name.toLowerCase().includes(q) ||
            u.company.toLowerCase().includes(q) ||
            u.department.toLowerCase().includes(q) ||
            u.title.toLowerCase().includes(q) ||
            db.interests.some((i: Interest) =>
              i.userId === u.id && i.keyword.toLowerCase().includes(q)
            );
          if (!matches) return false;
        }
        if (selectedKeywords.size > 0) {
          const userKeywords = new Set(
            db.interests
              .filter((i: Interest) => i.userId === u.id)
              .map((i: Interest) => i.keyword.trim())
          );
          const hasAll = [...selectedKeywords].every(kw => userKeywords.has(kw));
          if (!hasAll) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [courseUsers, search, selectedKeywords, db.interests]);

  const handleSend = (toUserId: string, message: string) => {
    sendTeaTimeRequest({
      id: Date.now().toString(),
      fromUserId: currentUser!.id,
      toUserId,
      message,
      status: 'pending',
    });
    alert('티타임 요청을 보냈습니다.');
    setSelectedUser(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="pb-3 border-b-2 border-primary/30">
        <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">LEADER LIBRARY</h1>
        <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
          이번 과정에 참여하는 모든 리더 · {courseUsers.length}명
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이름, 소속, 키워드로 검색..."
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-outline rounded-xl text-sm outline-none focus:border-primary"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Keyword Hashtag Filter */}
      {allKeywords.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">키워드로 필터</p>
            {selectedKeywords.size > 0 && (
              <button
                onClick={() => setSelectedKeywords(new Set())}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                초기화
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allKeywords.map(({ keyword, count }) => {
              const active = selectedKeywords.has(keyword);
              return (
                <button
                  key={keyword}
                  onClick={() => toggleKeyword(keyword)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all ${
                    active
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface text-on-surface-variant border-outline hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  <span>#{keyword}</span>
                  <span className={`text-[9px] ${active ? 'text-on-primary/70' : 'text-on-surface-variant/60'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Result count */}
      {(search || selectedKeywords.size > 0) && (
        <p className="text-xs text-on-surface-variant">
          검색 결과 <span className="font-bold text-primary">{filteredUsers.length}</span>명
          {selectedKeywords.size > 0 && (
            <span className="ml-1">· 선택된 키워드 {selectedKeywords.size}개</span>
          )}
        </p>
      )}

      {/* Gallery Grid */}
      {filteredUsers.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant text-sm">
          <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">group_off</span>
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(u => {
            const uInterests = db.interests.filter((i: Interest) => i.userId === u.id);
            const givers = uInterests.filter((i: Interest) => i.type === 'giver');
            const takers = uInterests.filter((i: Interest) => i.type === 'taker');
            const isMe = u.id === currentUser?.id;

            return (
              <div
                key={u.id}
                className={`bg-surface rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 ${
                  isMe ? 'border-primary/40 bg-primary/5' : 'border-outline'
                }`}
              >
                {/* Profile header */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => !isMe && setSelectedUser(u)}
                    className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center border shrink-0 ${
                      isMe ? 'border-primary/30 bg-primary/10 cursor-default' : 'border-outline bg-surface-container-low hover:opacity-80 transition-opacity'
                    }`}
                  >
                    {u.profilePic ? (
                      <img src={u.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-base font-bold text-primary">{u.name.charAt(0)}</span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-on-surface-variant truncate font-medium uppercase">{u.company}</p>
                    <p className="text-[10px] text-on-surface-variant truncate font-medium">{u.department}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-on-surface truncate">{u.name}</p>
                      {isMe && <span className="text-[8px] font-black bg-primary text-on-primary px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">나</span>}
                    </div>
                    <p className="text-[10px] text-primary font-medium truncate">{u.title}</p>
                  </div>
                </div>

                {/* 담당조직 소개 placeholder – 추후 데이터 연동 */}
                {/* {u.deptDescription && (
                  <p className="text-xs text-on-surface-variant border-l-2 border-outline pl-3 leading-relaxed">
                    {u.deptDescription}
                  </p>
                )} */}

                {/* Keywords */}
                {uInterests.length > 0 ? (
                  <div className="space-y-2 flex-1">
                    {givers.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Giver</p>
                        <div className="space-y-1">
                          {givers.map((i: Interest) => (
                            <div key={i.id} className="bg-primary/5 border border-primary/15 rounded-lg px-2.5 py-1.5">
                              <p className="text-[10px] font-bold text-primary">#{i.keyword}</p>
                              {i.description && (
                                <p className="text-[9px] text-on-surface-variant leading-relaxed mt-0.5 line-clamp-2">{i.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {takers.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-secondary uppercase tracking-widest">Taker</p>
                        <div className="space-y-1">
                          {takers.map((i: Interest) => (
                            <div key={i.id} className="bg-secondary/5 border border-secondary/15 rounded-lg px-2.5 py-1.5">
                              <p className="text-[10px] font-bold text-secondary">#{i.keyword}</p>
                              {i.description && (
                                <p className="text-[9px] text-on-surface-variant leading-relaxed mt-0.5 line-clamp-2">{i.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">등록된 관심사 없음</p>
                )}

                {/* Tea time button */}
                {!isMe && (
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="w-full py-2 text-xs font-bold bg-primary/10 text-primary border border-primary/20 rounded-xl hover:bg-primary/20 active:scale-95 transition-all mt-auto"
                  >
                    티타임 요청
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Library 전용 티타임 요청 모달 — be Giver/Taker 정보 없이 요청 폼만 표시 */}
      {selectedUser && currentUser && (
        <LibraryTeaTimeModal
          targetUser={selectedUser}
          myInterests={myInterests}
          onSend={(msg) => handleSend(selectedUser.id, msg)}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
