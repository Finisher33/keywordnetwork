import { User, Interest, CanonicalTerm, TeaTimeRequest } from '../store';

export interface HotKeyword {
  canonicalId: string;
  displayName: string;
  givers: Interest[];
  takers: Interest[];
  total: number;
}

// ─── 표시용 키워드 그룹 인덱스 ─────────────────────────────────────────────
// 같은 키워드인데 canonicalId 가 다르게 들어와 노드가 분리돼 보이는 문제 해결.
// 두 interest 가 (a) 같은 canonicalId 를 공유하거나 (b) 정규화된 keyword 텍스트가
// 같으면 동일 그룹으로 union. canonicalId race / 미부여 / 마이그레이션 ID 변경에도
// 견고하게 묶는다.
export interface InterestKeyIndex {
  // interest.id → 그룹 루트 키
  groupOf: (interestId: string) => string;
  // 그룹 루트 키 → 그룹 정보
  groups: Map<string, { displayName: string; originals: string[]; interestIds: string[] }>;
  // canonicalId 또는 raw keyword 텍스트로부터 그룹 루트 키를 찾는 유연한 룩업
  resolveKey: (canonicalIdOrKeyword: string | undefined | null) => string | undefined;
}

export function buildInterestKeyIndex(
  interests: Interest[],
  canonicalTerms?: CanonicalTerm[]
): InterestKeyIndex {
  const norm = (s: string | undefined | null) =>
    (s || '').trim().toLowerCase().replace(/\s+/g, '');

  // Union-Find
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x);
    if (p === undefined) { parent.set(x, x); return x; }
    if (p === x) return x;
    const r = find(p);
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  const interestKey = new Map<string, string>(); // interest.id → primary key
  const normToKey = new Map<string, string>();   // normalized text → first primary key seen
  const idToNorm = new Map<string, string>();    // canonicalId → normalized text (for cross-mapping)

  for (const i of interests) {
    const primary = i.canonicalId || `kw:${norm(i.keyword)}`;
    if (!parent.has(primary)) parent.set(primary, primary);
    interestKey.set(i.id, primary);

    const nk = norm(i.keyword);
    if (i.canonicalId) idToNorm.set(i.canonicalId, nk);

    if (normToKey.has(nk)) {
      union(normToKey.get(nk)!, primary);
    } else {
      normToKey.set(nk, primary);
    }
  }

  // 그룹 빌드
  const groups = new Map<string, { displayName: string; originals: string[]; interestIds: string[] }>();
  for (const i of interests) {
    const root = find(interestKey.get(i.id)!);
    if (!groups.has(root)) {
      const term = canonicalTerms?.find(t => t.id === root);
      groups.set(root, { displayName: term?.term || i.keyword, originals: [], interestIds: [] });
    }
    const g = groups.get(root)!;
    if (!g.originals.includes(i.keyword)) g.originals.push(i.keyword);
    g.interestIds.push(i.id);
  }

  const groupOf = (interestId: string): string => {
    const k = interestKey.get(interestId);
    return k ? find(k) : interestId;
  };

  const resolveKey = (key: string | undefined | null): string | undefined => {
    if (!key) return undefined;
    // 1) 이미 union-find 에 등록된 key 면 root 반환
    if (parent.has(key)) return find(key);
    // 2) canonicalId 가 인덱스에 있으면 정규화된 텍스트 경유 매핑
    const nk = idToNorm.get(key);
    if (nk && normToKey.has(nk)) return find(normToKey.get(nk)!);
    // 3) 정규화된 keyword 자체로 매핑
    const k2 = `kw:${norm(key)}`;
    if (parent.has(k2)) return find(k2);
    return undefined;
  };

  return { groupOf, groups, resolveKey };
}

// ─── HOT KEYWORDS 계산 ───────────────────────────────────────────────────────

export function calculateHotKeywords(currentUser: User, db: any, topN = 5): HotKeyword[] {
  const courseUsers = db.users.filter((u: User) => u.courseId === currentUser.courseId);
  const userIds = new Set<string>(courseUsers.map((u: User) => u.id));
  const courseInterests = db.interests.filter((i: Interest) => userIds.has(i.userId));

  // 같은 키워드 텍스트를 공유하지만 canonicalId 가 다른 interest 들도 단일 그룹으로 병합.
  const idx = buildInterestKeyIndex(courseInterests, db.canonicalTerms);

  const keywordMap = new Map<string, { canonicalId: string; displayName: string; givers: Interest[]; takers: Interest[] }>();

  courseInterests.forEach((i: Interest) => {
    const id = idx.groupOf(i.id);
    if (!keywordMap.has(id)) {
      const g = idx.groups.get(id);
      keywordMap.set(id, { canonicalId: id, displayName: g?.displayName || i.keyword, givers: [], takers: [] });
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

  // 표시-친화적 그룹 인덱스 (canonicalId 분기/race 에 견고)
  const idx = buildInterestKeyIndex(courseInterests, db.canonicalTerms);

  const keywordGroups: Record<string, string[]> = {};
  courseInterests.forEach((i: Interest) => {
    const id = idx.groupOf(i.id);
    if (!keywordGroups[id]) keywordGroups[id] = [];
    if (!keywordGroups[id].includes(i.keyword)) keywordGroups[id].push(i.keyword);
  });

  const getKeywordName = (id: string) => idx.groups.get(id)?.displayName || id;

  const myInterests = db.interests.filter((i: Interest) => i.userId === currentUser.id);
  const myRepKeywords = Array.from(new Set(myInterests.map((i: Interest) => idx.groupOf(i.id))));

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
