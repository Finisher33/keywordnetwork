import { User, Interest, CanonicalTerm, TeaTimeRequest } from '../store';

export interface HotKeyword {
  canonicalId: string;
  displayName: string;
  givers: Interest[];
  takers: Interest[];
  total: number;
}

// ─── HOT KEYWORDS 계산 ───────────────────────────────────────────────────────

export function calculateHotKeywords(currentUser: User, db: any, topN = 5): HotKeyword[] {
  const courseUsers = db.users.filter((u: User) => u.courseId === currentUser.courseId);
  const userIds = new Set<string>(courseUsers.map((u: User) => u.id));
  const courseInterests = db.interests.filter((i: Interest) => userIds.has(i.userId));

  const keywordMap = new Map<string, { canonicalId: string; displayName: string; givers: Interest[]; takers: Interest[] }>();

  courseInterests.forEach((i: Interest) => {
    const id = (i.canonicalId || i.keyword) as string;
    if (!keywordMap.has(id)) {
      const term = db.canonicalTerms?.find((t: CanonicalTerm) => t.id === id);
      keywordMap.set(id, { canonicalId: id, displayName: term ? term.term : i.keyword, givers: [], takers: [] });
    }
    const entry = keywordMap.get(id)!;
    if (i.type === 'giver') entry.givers.push(i);
    else entry.takers.push(i);
  });

  return Array.from(keywordMap.values())
    .map(entry => {
      const uniqueGivers = Array.from(new Map(entry.givers.map(i => [i.userId, i])).values());
      const uniqueTakers = Array.from(new Map(entry.takers.map(i => [i.userId, i])).values());
      const total = new Set([...entry.givers.map(i => i.userId), ...entry.takers.map(i => i.userId)]).size;
      return { ...entry, givers: uniqueGivers, takers: uniqueTakers, total };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}

export const getKeywordColor = (str: string) => {
  const colors = [
    '#3182f6', // Toss Blue
    '#00c471', // Green
    '#ff4b3e', // Red
    '#f97316', // Orange
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#00d4ea', // Cyan
    '#f59e0b', // Amber
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export function calculateUserNetworkData(currentUser: User, db: any) {
  const courseUsers = db.users.filter((u: User) => u.courseId === currentUser.courseId);
  const userIds = new Set(courseUsers.map((u: User) => u.id));
  const courseInterests = db.interests.filter((i: Interest) => userIds.has(i.userId));

  const keywordGroups: Record<string, string[]> = {};
  courseInterests.forEach((i: Interest) => {
    const id = (i.canonicalId || i.keyword) as string;
    if (!keywordGroups[id]) {
      keywordGroups[id] = [];
    }
    if (!keywordGroups[id].includes(i.keyword)) {
      keywordGroups[id].push(i.keyword);
    }
  });

  const getKeywordName = (id: string) => {
    const term = db.canonicalTerms?.find((t: CanonicalTerm) => t.id === id);
    return term ? term.term : id;
  };

  const myInterests = db.interests.filter((i: Interest) => i.userId === currentUser.id);
  const myRepKeywords = Array.from(new Set(myInterests.map((i: Interest) => (i.canonicalId || i.keyword) as string)));

  const groupedNetwork = myRepKeywords.map((repKw: string) => {
    const relatedOriginals = keywordGroups[repKw] || [repKw];
    const usersWithKw: { user: User; type: 'giver' | 'taker' }[] = [];
    
    courseInterests.forEach((i: Interest) => {
      if (relatedOriginals.includes(i.keyword)) {
        const user = courseUsers.find((u: User) => u.id === i.userId);
        if (user) {
          usersWithKw.push({ user, type: i.type });
        }
      }
    });

    if (usersWithKw.length > 0) {
      const giverCount = usersWithKw.filter(u => u.type === 'giver' && u.user.id !== currentUser.id).length;
      const takerCount = usersWithKw.filter(u => u.type === 'taker' && u.user.id !== currentUser.id).length;
      const total = usersWithKw.filter(u => u.user.id !== currentUser.id).length;
      
      let recommendation = '캐쥬얼한 모임 추천';
      if (takerCount / total >= 0.75) {
        recommendation = '전문가를 섭외하는 학습 모임 추천';
      } else if (giverCount / total >= 0.75) {
        recommendation = '업무 노하우를 적극 공유하는 심화 논의, 컨퍼런스 추천';
      }

      const uniqueUsers = Array.from(new Map(usersWithKw.map(item => [item.user.id, item.user])).values())
        .filter(u => u.id !== currentUser.id);

      const uniqueGivers = new Set(usersWithKw.filter(u => u.type === 'giver' && u.user.id !== currentUser.id).map(u => u.user.id)).size;
      const uniqueTakers = new Set(usersWithKw.filter(u => u.type === 'taker' && u.user.id !== currentUser.id).map(u => u.user.id)).size;

      return {
        title: `#${getKeywordName(repKw)}`,
        id: repKw,
        type: 'keyword' as const,
        users: uniqueUsers,
        recommendation,
        giverCount: uniqueGivers,
        takerCount: uniqueTakers
      };
    }
    return null;
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  // 추천 리더: 2개 이상 연결 키워드가 있는 리더 (본인 제외 - groupedNetwork.users는 이미 본인 필터됨)
  const leaderConnectionCount = new Map<string, { user: User; count: number; keywords: string[] }>();
  groupedNetwork.forEach(group => {
    group.users.forEach((u: User) => {
      if (!leaderConnectionCount.has(u.id)) {
        leaderConnectionCount.set(u.id, { user: u, count: 0, keywords: [] });
      }
      const entry = leaderConnectionCount.get(u.id)!;
      entry.count++;
      entry.keywords.push(group.title);
    });
  });
  const recommendedLeaders = Array.from(leaderConnectionCount.values())
    .filter(l => l.count >= 2)
    .sort((a, b) => b.count - a.count);

  const connectedLeadersMap = new Map<string, { user: User; types: Set<'giver' | 'taker'> }>();
  groupedNetwork.forEach((group: { id: string; users: User[] }) => {
    group.users.forEach((u: User) => {
      if (!connectedLeadersMap.has(u.id)) {
        connectedLeadersMap.set(u.id, { user: u, types: new Set() });
      }
      const entry = connectedLeadersMap.get(u.id)!;
      const relevantKeywords = keywordGroups[group.id] || [group.id];
      const uInterests = db.interests.filter((i: Interest) => i.userId === u.id && relevantKeywords.includes(i.keyword));
      uInterests.forEach((i: Interest) => entry.types.add(i.type));
    });
  });
  const connectedLeaders = Array.from(connectedLeadersMap.values());

  const receivedRequests = db.teaTimeRequests.filter((r: TeaTimeRequest) => r.toUserId === currentUser.id);
  const sentRequests = db.teaTimeRequests.filter((r: TeaTimeRequest) => r.fromUserId === currentUser.id);

  const summary = {
    total: connectedLeaders.length,
    givers: connectedLeaders.filter(l => l.types.has('giver')).length,
    takers: connectedLeaders.filter(l => l.types.has('taker')).length,
    receivedCount: receivedRequests.length,
    sentCount: sentRequests.length
  };

  return {
    groupedNetwork,
    summary,
    keywordGroups,
    myInterests,
    recommendedLeaders
  };
}
