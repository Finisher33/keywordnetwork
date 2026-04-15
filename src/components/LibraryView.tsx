import { useState, useMemo } from 'react';
import { useStore, User, Interest } from '../store';
import TeaTimeModal from './TeaTimeModal';

export default function LibraryView() {
  const { db, currentUser, sendTeaTimeRequest } = useStore();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'giver' | 'taker'>('all');

  const courseUsers = useMemo(() =>
    db.users.filter(u => u.courseId === currentUser?.courseId),
    [db.users, currentUser]
  );

  const myInterests = useMemo(() =>
    db.interests.filter(i => i.userId === currentUser?.id),
    [db.interests, currentUser]
  );

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return courseUsers.filter(u => {
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
      if (filterType !== 'all') {
        const hasType = db.interests.some((i: Interest) => i.userId === u.id && i.type === filterType);
        if (!hasType) return false;
      }
      return true;
    });
  }, [courseUsers, search, filterType, db.interests]);

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
        <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">LIBRARY</h1>
        <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
          이번 과정에 참여하는 모든 리더 · {courseUsers.length}명
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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
        <div className="flex gap-2 shrink-0">
          {(['all', 'giver', 'taker'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                filterType === f
                  ? f === 'giver' ? 'bg-primary text-on-primary border-primary'
                    : f === 'taker' ? 'bg-secondary text-on-secondary border-secondary'
                    : 'bg-on-surface text-surface border-on-surface'
                  : 'bg-surface text-on-surface-variant border-outline hover:border-on-surface-variant'
              }`}
            >
              {f === 'all' ? '전체' : f === 'giver' ? 'Giver' : 'Taker'}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {(search || filterType !== 'all') && (
        <p className="text-xs text-on-surface-variant">
          검색 결과 <span className="font-bold text-primary">{filteredUsers.length}</span>명
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

      {/* Tea Time Modal */}
      {selectedUser && currentUser && (
        <TeaTimeModal
          targetUser={selectedUser}
          currentUser={currentUser}
          myInterests={myInterests}
          targetInterests={db.interests.filter((i: Interest) => i.userId === selectedUser.id)}
          onSend={handleSend}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
