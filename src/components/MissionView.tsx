import { useState, useMemo, Key } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, User, Interest, TeaTimeRequest } from '../store';
import { computeGroups } from '../utils/missionUtils';

// ─── 공통 관심사 & 대화 주제 ──────────────────────────────────────────────────

function getSharedKeywords(group: User[], allInterests: Interest[]): string[] {
  const kwCount: Record<string, number> = {};
  group.forEach(u => {
    allInterests.filter(i => i.userId === u.id).forEach(i => {
      const k = i.keyword.toLowerCase().trim();
      kwCount[k] = (kwCount[k] || 0) + 1;
    });
  });
  return Object.entries(kwCount)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

function generateTopics(group: User[], allInterests: Interest[], me: User): string[] {
  const topics: string[] = [];
  const partners = group.filter(u => u.id !== me.id);
  const myI = allInterests.filter(i => i.userId === me.id);
  for (const p of partners) {
    const pI = allInterests.filter(i => i.userId === p.id);
    for (const m of myI) {
      for (const pi of pI) {
        if (m.keyword.toLowerCase() === pi.keyword.toLowerCase()) {
          if (m.type === 'giver' && pi.type === 'taker')
            topics.push(`${me.name}님의 #${m.keyword} 경험을 ${p.name}님과 나눠보세요`);
          else if (m.type === 'taker' && pi.type === 'giver')
            topics.push(`${p.name}님의 #${pi.keyword} 노하우를 여쭤보세요`);
        }
      }
    }
  }
  const shared = getSharedKeywords(group, allInterests);
  shared.slice(0, 2).forEach(kw => topics.push(`공통 관심사 #${kw}에 대한 각자의 인사이트를 나눠보세요`));
  if (topics.length < 2) {
    topics.push('각자의 현업에서 가장 도전적인 순간과 극복 경험을 나눠보세요');
    topics.push('이번 과정에서 현업에 적용하고 싶은 아이디어를 서로 공유해보세요');
  }
  return [...new Set(topics)].slice(0, 4);
}

// ─── 파트너 카드 컴포넌트 ─────────────────────────────────────────────────────

const isUrl = (s?: string) =>
  !!s && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/'));

function PartnerCard({
  partner,
  allInterests,
  currentUser,
  index,
}: {
  key?: Key;
  partner: User;
  allInterests: Interest[];
  currentUser: User;
  index: number;
}) {
  const myKws = new Set(
    allInterests.filter(i => i.userId === currentUser.id).map(i => i.keyword.toLowerCase().trim())
  );
  const partnerKws = allInterests.filter(i => i.userId === partner.id).map(i => i.keyword.toLowerCase().trim());
  const sharedWith = partnerKws.filter(k => myKws.has(k));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      className="bg-surface rounded-xl border border-outline/40 p-4 flex gap-3 items-start"
    >
      <div className="shrink-0">
        {isUrl(partner.profilePic) ? (
          <img
            src={partner.profilePic}
            alt={partner.name}
            className="w-12 h-12 rounded-full object-cover border border-outline/30"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary font-black text-lg">{partner.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-on-surface">{partner.name}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          {partner.company}{partner.department ? ` · ${partner.department}` : ''}
        </p>
        {partner.title && (
          <p className="text-[11px] text-on-surface-variant/70">{partner.title}</p>
        )}
        {sharedWith.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {sharedWith.map(kw => (
              <span key={kw} className="bg-primary/10 text-primary text-[10px] font-bold rounded-md px-2 py-0.5">
                #{kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── 파트너 매칭 섹션 ─────────────────────────────────────────────────────────

function PartnerMatchSection({
  missionLabel,
  partners,
  group,
  allInterests,
  currentUser,
  revealed,
  loading,
  onReveal,
  isConfirmed,
}: {
  missionLabel: string;
  partners: User[];
  group: User[];
  allInterests: Interest[];
  currentUser: User;
  revealed: boolean;
  loading: boolean;
  onReveal: () => void;
  isConfirmed: boolean;
}) {
  const topics = useMemo(
    () => generateTopics(group, allInterests, currentUser),
    [group, allInterests, currentUser]
  );
  const sharedKws = useMemo(
    () => getSharedKeywords(group, allInterests),
    [group, allInterests]
  );

  return (
    <div className="mt-5">
      <div className="h-px bg-outline/30 mb-5" />
      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">파트너 매칭</p>

      {!revealed && !loading && !isConfirmed && (
        <div className="w-full bg-surface-container-low border border-outline/40 rounded-xl py-4 px-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-on-surface-variant/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-surface-variant text-base">schedule</span>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface-variant">파트너 매칭 준비중</p>
            <p className="text-[10px] text-on-surface-variant/60 mt-0.5">관리자가 파트너를 확정하면 확인할 수 있습니다.</p>
          </div>
        </div>
      )}

      {!revealed && !loading && isConfirmed && (
        <button
          onClick={onReveal}
          className="w-full bg-gradient-to-r from-primary to-primary/70 text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity active:scale-95"
        >
          파트너 확인하기 →
        </button>
      )}

      {loading && (
        <div className="w-full bg-gradient-to-r from-primary to-primary/70 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>매칭 중...</span>
        </div>
      )}

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <p className="text-sm font-black text-on-surface">나의 {missionLabel} 파트너</p>
              <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                {partners.length}명
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {partners.map((p, idx) => (
                <PartnerCard key={p.id} partner={p} allInterests={allInterests} currentUser={currentUser} index={idx} />
              ))}
            </div>
            {sharedKws.length > 0 && (
              <div className="bg-surface-container-low rounded-xl px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">그룹 공통 관심사</p>
                <div className="flex flex-wrap gap-1.5">
                  {sharedKws.map(kw => (
                    <span key={kw} className="bg-primary/10 text-primary text-[10px] font-bold rounded-md px-2 py-0.5">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-surface-container-low rounded-xl px-4 py-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">추천 대화 주제</p>
              {topics.map((topic, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary text-sm mt-0.5">💬</span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{topic}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 티타임 미션 전용 모달 ────────────────────────────────────────────────────

function TeaTimeMissionModal({
  targetUser,
  myInterests,
  onSend,
  onClose,
}: {
  targetUser: User;
  myInterests: Interest[];
  onSend: (message: string) => Promise<void>;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!msg.trim()) { alert('메시지를 입력해주세요.'); return; }
    setSending(true);
    try {
      const hashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
      await onSend(hashtags ? `${hashtags}\n\n${msg}` : msg);
      onClose();
    } finally {
      setSending(false);
    }
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
            {isUrl(targetUser.profilePic)
              ? <img src={targetUser.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              : <span className="font-bold text-primary text-sm">{targetUser.name.charAt(0)}</span>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-on-surface-variant truncate uppercase font-medium">
              {targetUser.company}{targetUser.department ? ` · ${targetUser.department}` : ''}
            </p>
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
            disabled={sending}
            className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sending
              ? <><span className="material-symbols-outlined text-base animate-spin">sync</span> 전송 중...</>
              : '요청 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 티타임 추천 리더 카드 ────────────────────────────────────────────────────

type TeaReqStatus = 'none' | 'pending' | 'accepted' | 'rejected';

const TEA_STATUS_CONFIG: Record<TeaReqStatus, { label: string; icon: string; cls: string } | null> = {
  none: null,
  pending: {
    label: '신청 완료',
    icon: 'schedule',
    cls: 'bg-blue-50 text-blue-600 border border-blue-200',
  },
  accepted: {
    label: '수락됨 ✓',
    icon: 'check_circle',
    cls: 'bg-green-50 text-green-700 border border-green-300',
  },
  rejected: {
    label: '거절됨',
    icon: 'cancel',
    cls: 'bg-surface-container text-on-surface-variant border border-outline/40',
  },
};

function TeaTimeUserCard({
  user,
  allInterests,
  myKws,
  matchType,
  reqStatus,
  responseMessage,
  onRequest,
  index,
}: {
  key?: Key | null;
  user: User;
  allInterests: Interest[];
  myKws: Set<string>;
  matchType: 'keyword' | 'location';
  reqStatus: TeaReqStatus;
  responseMessage?: string;
  onRequest: () => void;
  index: number;
}) {
  const uKws = allInterests.filter(i => i.userId === user.id).map(i => i.keyword.toLowerCase().trim());
  const sharedKws = uKws.filter(k => myKws.has(k));
  const statusCfg = TEA_STATUS_CONFIG[reqStatus];
  const showResponse = reqStatus === 'accepted' && !!responseMessage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className="bg-surface rounded-xl border border-outline/40 p-3.5 space-y-2"
    >
      <div className="flex gap-3 items-center">
        <div className="shrink-0">
          {isUrl(user.profilePic) ? (
            <img src={user.profilePic} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-outline/30" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center border border-secondary/25">
              <span className="text-secondary font-black text-sm">{user.name.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-on-surface leading-tight">{user.name}</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">
            {user.company}{user.department ? ` · ${user.department}` : ''}
          </p>
          {matchType === 'keyword' && sharedKws.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {sharedKws.map(kw => (
                <span key={kw} className="bg-secondary/10 text-secondary text-[9px] font-bold rounded px-1.5 py-0.5">
                  #{kw}
                </span>
              ))}
            </div>
          )}
          {matchType === 'location' && user.location && (
            <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
              <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">location_on</span>
              {user.location}
            </p>
          )}
        </div>

        {/* 상태 배지 or 요청 버튼 */}
        {statusCfg ? (
          <span className={`shrink-0 flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-lg whitespace-nowrap ${statusCfg.cls}`}>
            <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {statusCfg.icon}
            </span>
            {statusCfg.label}
          </span>
        ) : (
          <button
            onClick={onRequest}
            className="shrink-0 text-[10px] font-black px-3 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 active:scale-95 transition-all whitespace-nowrap"
          >
            티타임 요청
          </button>
        )}
      </div>

      {/* 수락 시 답변 메시지 */}
      {showResponse && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 ml-[52px]">
          <p className="text-[10px] text-on-surface-variant leading-relaxed">
            <span className="font-black text-green-700">답변 · </span>{responseMessage}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ─── 티타임 미션 섹션 ─────────────────────────────────────────────────────────

function TeaTimeMissionSection({
  currentUser,
  courseUsers,
  allInterests,
  teaTimeRequests,
  onRequest,
}: {
  currentUser: User;
  courseUsers: User[];
  allInterests: Interest[];
  teaTimeRequests: TeaTimeRequest[];
  onRequest: (toUser: User, message: string) => Promise<void>;
}) {
  const [modalUser, setModalUser] = useState<User | null>(null);

  const myInterests = useMemo(
    () => allInterests.filter(i => i.userId === currentUser.id),
    [allInterests, currentUser.id]
  );

  const myKws = useMemo(
    () => new Set(myInterests.map(i => i.keyword.toLowerCase().trim())),
    [myInterests]
  );

  const others = useMemo(
    () => courseUsers.filter(u => u.id !== currentUser.id),
    [courseUsers, currentUser.id]
  );

  // 키워드 1개 이상 공유
  const keywordMatched = useMemo(
    () => others.filter(u => {
      const uKws = allInterests.filter(i => i.userId === u.id).map(i => i.keyword.toLowerCase().trim());
      return uKws.filter(k => myKws.has(k)).length >= 1;
    }),
    [others, allInterests, myKws]
  );

  // 근무지 동일 (키워드 매칭과 중복 제외)
  const keywordMatchedIds = useMemo(() => new Set(keywordMatched.map(u => u.id)), [keywordMatched]);
  const locationMatched = useMemo(
    () => others.filter(u =>
      !keywordMatchedIds.has(u.id) &&
      u.location &&
      currentUser.location &&
      u.location === currentUser.location
    ),
    [others, keywordMatchedIds, currentUser.location]
  );

  // DB 기반 상태 맵: toUserId → 가장 최근 요청의 status
  const reqMap = useMemo(() => {
    const map = new Map<string, TeaReqStatus>();
    teaTimeRequests
      .filter(r => r.fromUserId === currentUser.id)
      .sort((a, b) => a.id.localeCompare(b.id)) // id에 timestamp 포함 → 오름차순 → 마지막이 최신
      .forEach(r => {
        map.set(r.toUserId, r.status as TeaReqStatus);
      });
    return map;
  }, [teaTimeRequests, currentUser.id]);

  // 수락된 요청의 답변 메시지 맵: toUserId → responseMessage
  const respMap = useMemo(() => {
    const map = new Map<string, string>();
    teaTimeRequests
      .filter(r => r.fromUserId === currentUser.id && r.status === 'accepted' && r.responseMessage)
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach(r => { map.set(r.toUserId, r.responseMessage!); });
    return map;
  }, [teaTimeRequests, currentUser.id]);

  // 신청 건수 (pending + accepted) → 미션 진행 기준
  const sentCount = reqMap.size;
  // 수락 건수
  const acceptedCount = useMemo(
    () => [...reqMap.values()].filter(s => s === 'accepted').length,
    [reqMap]
  );
  const missionComplete = sentCount >= 2;

  const handleModalSend = async (message: string) => {
    if (!modalUser) return;
    await onRequest(modalUser, message);
  };

  const renderSection = (label: string, desc: string, users: User[], matchType: 'keyword' | 'location') => (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-secondary">{label}</p>
        <p className="text-[10px] text-on-surface-variant mt-0.5">{desc}</p>
      </div>
      {users.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl px-4 py-4 text-center">
          <p className="text-xs text-on-surface-variant/50 italic">매칭되는 리더가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u, i) => {
            const status = reqMap.get(u.id) ?? 'none';
            return (
              <TeaTimeUserCard
                key={u.id}
                user={u}
                allInterests={allInterests}
                myKws={myKws}
                matchType={matchType}
                reqStatus={status}
                responseMessage={respMap.get(u.id)}
                onRequest={() => status === 'none' && setModalUser(u)}
                index={i}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-5 space-y-5">
      <div className="h-px bg-outline/30" />

      {/* 안내 문구 */}
      <div className="bg-secondary/8 border border-secondary/25 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <span className="material-symbols-outlined text-secondary text-base mt-0.5 shrink-0">tips_and_updates</span>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          과정 진행 중에 최소 <span className="font-black text-on-surface">2명 이상</span>의 리더에게 티타임을 먼저 제안해보세요.
        </p>
      </div>

      {/* 미션 진행 상태 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">미션 진행 현황</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
              신청 {sentCount}건
            </span>
            <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-300 px-2 py-0.5 rounded-md">
              수락 {acceptedCount}건
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${missionComplete ? 'bg-green-500/15 text-green-600' : 'bg-surface-container-high text-on-surface-variant'}`}>
              {sentCount} / 2
            </span>
          </div>
        </div>
        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${missionComplete ? 'bg-green-500' : 'bg-secondary'}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(sentCount / 2 * 100, 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Mission Complete 배지 */}
      <AnimatePresence>
        {missionComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: 'backOut' }}
            className="rounded-xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #22c55e, #10b981)' }}
          >
            <div className="px-4 py-3.5 flex items-center gap-3">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
              <div className="flex-1">
                <p className="font-black text-sm text-white uppercase tracking-wide">Mission Complete!</p>
                <p className="text-[10px] text-white/80 mt-0.5">
                  {sentCount}명에게 신청 · {acceptedCount}명 수락 — 멋진 연결을 만들고 있어요! 🎉
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 미션 진행 중 응원 문구 */}
      {!missionComplete && (
        <div className="flex items-center gap-2.5 bg-secondary/6 border border-secondary/20 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-secondary text-base shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
          <p className="text-xs text-secondary font-medium leading-relaxed">관심있는 리더에게 티타임을 제안해보세요.</p>
        </div>
      )}

      {/* 키워드 매칭 */}
      {renderSection('키워드 매칭', '관심사 키워드가 1개 이상 겹치는 리더', keywordMatched, 'keyword')}

      {/* 근무지 매칭 */}
      {renderSection('근무지 매칭', '근무지가 동일한 리더', locationMatched, 'location')}

      {/* 티타임 요청 모달 */}
      {modalUser && (
        <TeaTimeMissionModal
          targetUser={modalUser}
          myInterests={myInterests}
          onSend={handleModalSend}
          onClose={() => setModalUser(null)}
        />
      )}
    </div>
  );
}

// ─── 미션 카드 (아코디언) ─────────────────────────────────────────────────────

interface MissionConfig {
  id: string;
  title: string;
  icon: string;
  badge: string;
  badgeColor: string;
  summary: string;
  sections: { heading: string; body: string }[];
  hasPartnerMatch: boolean;
  hasTeaTimeMatch: boolean;
}

const MISSIONS: MissionConfig[] = [
  {
    id: 'lunch',
    title: '런치타임 미션',
    icon: 'restaurant',
    badge: 'LUNCH MISSION',
    badgeColor: 'bg-primary/10 text-primary border-primary/20',
    summary: '점심 식사 시간을 활용해 새로운 리더와 연결되는 미션입니다.',
    sections: [
      {
        heading: '미션 목표',
        body: '이번 과정에서 아직 대화를 나누지 않은 리더와 점심을 함께하며 서로의 Giver/Taker 관심사를 공유하세요.',
      },
      {
        heading: '미션 방법',
        body: '1. 매칭된 파트너를 확인하고 미리 LEADER LIBRARY에서 프로필을 살펴보세요.\n2. 점심 자리에서 상대방의 Giver 키워드에 관한 질문을 최소 2개 이상 나눠보세요.',
      },
      {
        heading: '미션 포인트',
        body: '서로 다른 계열사 리더와의 대화에서 예상치 못한 협업 아이디어를 발견할 수 있습니다. 열린 마음으로 귀 기울여보세요.',
      },
    ],
    hasPartnerMatch: true,
    hasTeaTimeMatch: false,
  },
  {
    id: 'evening',
    title: '저녁 교류회 미션',
    icon: 'nightlife',
    badge: 'EVENING MISSION',
    badgeColor: 'bg-[#b5944c]/10 text-[#b5944c] border-[#b5944c]/30',
    summary: '런치타임과 다른 멤버들과의 저녁 교류회로 네트워킹을 확장하세요.',
    sections: [
      {
        heading: '미션 목표',
        body: '런치타임과 다른 구성의 리더들과 저녁 교류회에서 더 깊은 네트워킹을 경험해보세요.',
      },
      {
        heading: '미션 방법',
        body: '1. 런치타임과 다른 파트너들로 구성된 나의 저녁 그룹을 확인하세요.\n2. 자신의 Giver 키워드를 중심으로 서로의 고민과 해결 경험을 나눠보세요.',
      },
      {
        heading: '미션 포인트',
        body: '저녁 교류회는 더 편안한 분위기에서 진행됩니다. 런치에서 나누지 못한 이야기들을 이어가 보세요.',
      },
    ],
    hasPartnerMatch: true,
    hasTeaTimeMatch: false,
  },
  {
    id: 'teatime',
    title: '티타임 제안 미션',
    icon: 'coffee',
    badge: 'TEA TIME MISSION',
    badgeColor: 'bg-secondary/10 text-secondary border-secondary/20',
    summary: 'be Giver 정신으로 내가 먼저 티타임을 제안하는 미션입니다.',
    sections: [
      {
        heading: '미션 목표',
        body: '과정 진행 중에 최소 2명 이상의 리더에게 티타임을 먼저 제안하여, 본 과정에서 만들어진 리더간의 느슨한 연결이 좀 더 지속적인 연결로 이어질 수 있도록 실천하는 것.',
      },
      {
        heading: '미션 방법',
        body: '1. 아래 추천 리더 목록에서 나와 키워드 또는 근무지가 매칭되는 리더를 확인하세요.\n2. 티타임 요청 버튼을 눌러 리더에게 티타임을 제안하세요.\n3. 티타임 일정을 구체적으로 조율하고, 여유가 되신다면 식사도 함께하세요.',
      },
      {
        heading: '미션 포인트',
        body: '교육장에서의 만남과 실제 현업에서의 만남은 또 다른 의미와 경험이 될 것 입니다. 서로의 제안을 소중히 여기시고, 실제 일정에 등록함으로써 소중한 만남을 가져주시면 감사하겠습니다.',
      },
    ],
    hasPartnerMatch: false,
    hasTeaTimeMatch: true,
  },
];

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function MissionView() {
  const { db, currentUser, sendTeaTimeRequest } = useStore();

  const [openId, setOpenId] = useState<string | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  const handleReveal = (missionId: string) => {
    setLoadingMap(prev => ({ ...prev, [missionId]: true }));
    setTimeout(() => {
      setLoadingMap(prev => ({ ...prev, [missionId]: false }));
      setRevealedMap(prev => ({ ...prev, [missionId]: true }));
    }, 1500);
  };

  // 같은 courseId 유저들 필터링
  const courseUsers = useMemo(() => {
    if (!currentUser) return [];
    return db.users.filter(u => u.courseId === currentUser.courseId);
  }, [db.users, currentUser]);

  // 확정된 DB 그룹 조회
  const confirmedLunchGroup = useMemo(() => {
    if (!currentUser) return null;
    return db.missionGroups.find(g => g.courseId === currentUser.courseId && g.type === 'lunch') ?? null;
  }, [db.missionGroups, currentUser]);

  const confirmedEveningGroup = useMemo(() => {
    if (!currentUser) return null;
    return db.missionGroups.find(g => g.courseId === currentUser.courseId && g.type === 'evening') ?? null;
  }, [db.missionGroups, currentUser]);

  // 확정된 그룹에서 내 파트너 찾기
  const getMyConfirmedGroup = (confirmedGroups: string[][]): User[] => {
    if (!currentUser) return [];
    const myGroup = confirmedGroups.find(g => g.includes(currentUser.id));
    if (!myGroup) return [];
    return myGroup.map(uid => db.users.find(u => u.id === uid)).filter(Boolean) as User[];
  };

  const lunchGroup = useMemo(
    () => confirmedLunchGroup ? getMyConfirmedGroup(confirmedLunchGroup.groups) : [],
    [confirmedLunchGroup, db.users, currentUser]
  );
  const lunchPartners = lunchGroup.filter(u => u.id !== currentUser?.id);

  const eveningGroup = useMemo(
    () => confirmedEveningGroup ? getMyConfirmedGroup(confirmedEveningGroup.groups) : [],
    [confirmedEveningGroup, db.users, currentUser]
  );
  const eveningPartners = eveningGroup.filter(u => u.id !== currentUser?.id);

  // 티타임 요청 핸들러
  const handleTeaTimeRequest = async (toUser: User, message: string) => {
    if (!currentUser) return;
    const req: TeaTimeRequest = {
      id: `${currentUser.id}_${toUser.id}_${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId: toUser.id,
      message,
      status: 'pending',
    };
    await sendTeaTimeRequest(req);
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="pb-3 border-b-2 border-primary/30">
        <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">MISSION</h1>
        <p className="text-xs text-on-surface-variant mt-0.5 font-medium">과정 중 도전해볼 네트워킹 미션</p>
      </div>

      {/* 미션 카드 목록 */}
      <div className="space-y-4">
        {MISSIONS.map(mission => {
          const isOpen = openId === mission.id;
          const revealed = revealedMap[mission.id] ?? false;
          const loading = loadingMap[mission.id] ?? false;

          const isLunch = mission.id === 'lunch';
          const isEvening = mission.id === 'evening';
          const partners = isLunch ? lunchPartners : isEvening ? eveningPartners : [];
          const group = isLunch ? lunchGroup : isEvening ? eveningGroup : [];
          const isConfirmed = isLunch ? !!confirmedLunchGroup : isEvening ? !!confirmedEveningGroup : false;

          // 티타임 미션 완료 여부 (카드 헤더 배지용)
          const isTeatime = mission.id === 'teatime';
          const teatimeSentCount = isTeatime
            ? new Set(db.teaTimeRequests.filter(r => r.fromUserId === currentUser.id).map(r => r.toUserId)).size
            : 0;
          const teatimeComplete = isTeatime && teatimeSentCount >= 2;

          return (
            <div
              key={mission.id}
              className={`bg-surface rounded-2xl border shadow-sm transition-all duration-300 overflow-hidden ${
                isOpen ? 'border-primary/40 shadow-md' : 'border-outline hover:border-primary/25'
              }`}
            >
              {/* 카드 헤더 */}
              <button
                onClick={() => toggle(mission.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isOpen ? 'bg-primary text-on-primary' : 'bg-primary/8 text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{mission.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${mission.badgeColor}`}>
                      {mission.badge}
                    </span>
                    {teatimeComplete && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border bg-green-500/10 text-green-600 border-green-500/30">
                        ✓ COMPLETE
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-black text-on-surface mt-0.5">{mission.title}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">{mission.summary}</p>
                </div>
                <span
                  className={`material-symbols-outlined text-on-surface-variant text-xl shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>

              {/* 상세 내용 */}
              {isOpen && (
                <div className="px-5 pb-6 space-y-5 border-t border-outline/40 pt-4">
                  {mission.sections.map(sec => (
                    <div key={sec.heading} className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">{sec.heading}</p>
                      <div className="bg-surface-container-low rounded-xl px-4 py-3">
                        {sec.body.split('\n').map((line, i) => (
                          <p key={i} className={`text-xs text-on-surface-variant leading-relaxed ${i > 0 ? 'mt-1' : ''}`}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* 파트너 매칭 (런치 & 저녁) */}
                  {mission.hasPartnerMatch && (
                    <PartnerMatchSection
                      missionLabel={mission.title}
                      partners={partners}
                      group={group}
                      allInterests={db.interests}
                      currentUser={currentUser}
                      revealed={revealed}
                      loading={loading}
                      onReveal={() => handleReveal(mission.id)}
                      isConfirmed={isConfirmed}
                    />
                  )}

                  {/* 티타임 추천 매칭 */}
                  {mission.hasTeaTimeMatch && (
                    <TeaTimeMissionSection
                      currentUser={currentUser}
                      courseUsers={courseUsers}
                      allInterests={db.interests}
                      teaTimeRequests={db.teaTimeRequests}
                      onRequest={handleTeaTimeRequest}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
