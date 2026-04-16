import { useState, useMemo, Key } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore, User, Interest } from '../store';

// ─── 결정론적 매칭 유틸리티 ───────────────────────────────────────────────────

function stringToSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    const j = (s >>> 0) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeGroups(
  users: User[],
  interests: Interest[],
  seedStr: string,
  avoidGroups?: number[][]
): number[][] {
  if (users.length === 0) return [];
  const sorted = [...users].sort((a, b) => a.id.localeCompare(b.id));
  const n = sorted.length;
  const kwSets = sorted.map(u =>
    new Set(interests.filter(i => i.userId === u.id).map(i => i.keyword.toLowerCase().trim()))
  );
  const pairSim = (i: number, j: number) => {
    let s = 0;
    kwSets[i].forEach(k => { if (kwSets[j].has(k)) s++; });
    return s;
  };
  const avoidSet = new Set<string>();
  if (avoidGroups) {
    avoidGroups.forEach(g => g.forEach(a => g.forEach(b => { if (a !== b) avoidSet.add(`${a}_${b}`); })));
  }
  const seed = stringToSeed(seedStr);
  const order = seededShuffle(sorted.map((_, i) => i), seed);
  const assigned = new Set<number>();
  const groups: number[][] = [];
  for (const anchor of order) {
    if (assigned.has(anchor)) continue;
    const group = [anchor];
    assigned.add(anchor);
    const remaining = order.filter(i => !assigned.has(i));
    const scored = remaining.map(i => {
      let score = 0;
      group.forEach(g => { score += pairSim(g, i); if (avoidSet.has(`${g}_${i}`)) score -= 50; });
      return { i, score };
    }).sort((a, b) => b.score - a.score || a.i - b.i);
    const targetExtra = ((seed ^ anchor) & 1) ? 3 : 2;
    for (let k = 0; k < Math.min(targetExtra, scored.length); k++) {
      group.push(scored[k].i);
      assigned.add(scored[k].i);
    }
    groups.push(group);
  }
  // n 변수를 사용하는 dummy expression으로 lint 경고 방지
  void n;
  return groups;
}

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

  const isUrl = (s?: string) => s && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/'));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      className="bg-surface rounded-xl border border-outline/40 p-4 flex gap-3 items-start"
    >
      {/* 프로필 이미지 */}
      <div className="shrink-0">
        {isUrl(partner.profilePic) ? (
          <img
            src={partner.profilePic}
            alt={partner.name}
            className="w-12 h-12 rounded-full object-cover border border-outline/30"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary font-black text-lg">
              {partner.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-on-surface">{partner.name}</p>
        <p className="text-[11px] text-on-surface-variant mt-0.5">
          {partner.company}
          {partner.department ? ` · ${partner.department}` : ''}
        </p>
        {partner.title && (
          <p className="text-[11px] text-on-surface-variant/70">{partner.title}</p>
        )}
        {sharedWith.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {sharedWith.map(kw => (
              <span
                key={kw}
                className="bg-primary/10 text-primary text-[10px] font-bold rounded-md px-2 py-0.5"
              >
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
}: {
  missionLabel: string;
  partners: User[];
  group: User[];
  allInterests: Interest[];
  currentUser: User;
  revealed: boolean;
  loading: boolean;
  onReveal: () => void;
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
      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">
        파트너 매칭
      </p>

      {!revealed && !loading && (
        <button
          onClick={onReveal}
          className="w-full bg-gradient-to-r from-primary to-primary/70 text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity active:scale-95"
        >
          파트너 확인하기 →
        </button>
      )}

      {loading && (
        <div className="w-full bg-gradient-to-r from-primary to-primary/70 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
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
            {/* 파트너 헤더 */}
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <p className="text-sm font-black text-on-surface">
                나의 {missionLabel} 파트너
              </p>
              <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                {partners.length}명
              </span>
            </div>

            {/* 파트너 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {partners.map((p, idx) => (
                <PartnerCard
                  key={p.id}
                  partner={p}
                  allInterests={allInterests}
                  currentUser={currentUser}
                  index={idx}
                />
              ))}
            </div>

            {/* 공통 관심사 */}
            {sharedKws.length > 0 && (
              <div className="bg-surface-container-low rounded-xl px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                  그룹 공통 관심사
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sharedKws.map(kw => (
                    <span
                      key={kw}
                      className="bg-primary/10 text-primary text-[10px] font-bold rounded-md px-2 py-0.5"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 대화 주제 추천 */}
            <div className="bg-surface-container-low rounded-xl px-4 py-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                추천 대화 주제
              </p>
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
        body: '1. 매칭된 파트너를 확인하고 미리 LEADER LIBRARY에서 프로필을 살펴보세요.\n2. 점심 자리에서 상대방의 Giver 키워드에 관한 질문을 최소 2개 이상 나눠보세요.\n3. 대화에서 얻은 인사이트를 MY INSIGHT에 기록해보세요.',
      },
      {
        heading: '미션 포인트',
        body: '서로 다른 계열사 리더와의 대화에서 예상치 못한 협업 아이디어를 발견할 수 있습니다. 열린 마음으로 귀 기울여보세요.',
      },
    ],
    hasPartnerMatch: true,
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
        body: '1. 런치타임과 다른 파트너들로 구성된 나의 저녁 그룹을 확인하세요.\n2. 자신의 Giver 키워드를 중심으로 서로의 고민과 해결 경험을 나눠보세요.\n3. 교류회에서 나온 아이디어를 MY INSIGHT에 기록해보세요.',
      },
      {
        heading: '미션 포인트',
        body: '저녁 교류회는 더 편안한 분위기에서 진행됩니다. 런치에서 나누지 못한 이야기들을 이어가 보세요.',
      },
    ],
    hasPartnerMatch: true,
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
        body: '과정 기간 중 최소 3명의 리더에게 티타임을 먼저 제안하고, 자신의 Giver 키워드를 바탕으로 실질적인 도움을 나눠보세요.',
      },
      {
        heading: '미션 방법',
        body: '1. MY NETWORK에서 나의 Giver 키워드와 상대방의 Taker 키워드가 매칭되는 리더를 찾아보세요.\n2. LIBRARY에서 해당 리더에게 티타임 요청을 보내세요.\n3. 티타임에서 자신의 경험과 노하우를 진정성 있게 나눠보세요.\n4. 대화 후 MY INSIGHT에 배운 점을 기록해보세요.',
      },
      {
        heading: '미션 포인트',
        body: '주는 것(Giver)이 곧 받는 것(Taker)이 됩니다. 내가 먼저 가치를 제공함으로써 신뢰 기반의 네트워크가 형성됩니다. 과정이 끝난 후에도 이어지는 관계를 만들어보세요.',
      },
    ],
    hasPartnerMatch: false,
  },
];

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function MissionView() {
  const { db, currentUser } = useStore();

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

  // 런치 그룹 계산
  const lunchGroups = useMemo(() => {
    if (!currentUser) return [];
    return computeGroups(courseUsers, db.interests, currentUser.courseId + 'lunch');
  }, [courseUsers, db.interests, currentUser]);

  // 저녁 그룹 계산 (런치 그룹 회피)
  const eveningGroups = useMemo(() => {
    if (!currentUser) return [];
    return computeGroups(courseUsers, db.interests, currentUser.courseId + 'evening', lunchGroups);
  }, [courseUsers, db.interests, currentUser, lunchGroups]);

  // 내 그룹 멤버 찾기
  const getMyGroup = (groups: number[][], sortedUsers: User[]): User[] => {
    if (!currentUser) return [];
    const sorted = [...sortedUsers].sort((a, b) => a.id.localeCompare(b.id));
    const myIdx = sorted.findIndex(u => u.id === currentUser.id);
    if (myIdx === -1) return [];
    const myGroup = groups.find(g => g.includes(myIdx));
    if (!myGroup) return [];
    return myGroup.map(i => sorted[i]);
  };

  const sortedCourseUsers = useMemo(
    () => [...courseUsers].sort((a, b) => a.id.localeCompare(b.id)),
    [courseUsers]
  );

  const lunchGroup = useMemo(
    () => getMyGroup(lunchGroups, courseUsers),
    [lunchGroups, courseUsers, currentUser]
  );
  const lunchPartners = lunchGroup.filter(u => u.id !== currentUser?.id);

  const eveningGroup = useMemo(
    () => getMyGroup(eveningGroups, courseUsers),
    [eveningGroups, courseUsers, currentUser]
  );
  const eveningPartners = eveningGroup.filter(u => u.id !== currentUser?.id);

  void sortedCourseUsers; // used via getMyGroup

  if (!currentUser) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* 헤더 */}
      <div className="pb-3 border-b-2 border-primary/30">
        <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">
          MISSION
        </h1>
        <p className="text-xs text-on-surface-variant mt-0.5 font-medium">
          과정 중 도전해볼 네트워킹 미션
        </p>
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

          return (
            <div
              key={mission.id}
              className={`bg-surface rounded-2xl border shadow-sm transition-all duration-300 overflow-hidden ${
                isOpen
                  ? 'border-primary/40 shadow-md'
                  : 'border-outline hover:border-primary/25'
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
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${mission.badgeColor}`}
                    >
                      {mission.badge}
                    </span>
                  </div>
                  <p className="text-sm font-black text-on-surface mt-0.5">{mission.title}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5 line-clamp-1">
                    {mission.summary}
                  </p>
                </div>
                <span
                  className={`material-symbols-outlined text-on-surface-variant text-xl shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>

              {/* 상세 내용 */}
              {isOpen && (
                <div className="px-5 pb-6 space-y-5 border-t border-outline/40 pt-4">
                  {mission.sections.map(sec => (
                    <div key={sec.heading} className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {sec.heading}
                      </p>
                      <div className="bg-surface-container-low rounded-xl px-4 py-3">
                        {sec.body.split('\n').map((line, i) => (
                          <p
                            key={i}
                            className={`text-xs text-on-surface-variant leading-relaxed ${
                              i > 0 ? 'mt-1' : ''
                            }`}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* 파트너 매칭 (런치 & 저녁만) */}
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
