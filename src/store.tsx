import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from 'react';
import { getEmbedding, cosineSimilarity } from './services/embeddingService';
import { db as firestore, auth, authReady, ensureAuth } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, deleteDoc, writeBatch, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { hashId } from './utils/hashId';
import { normalizeUserField } from './utils/normalizeUserField';
import { generateMockData } from './utils/mockData';

// Firebase 에러 코드를 사용자 친화적 메시지로 변환하고 디버그 로그를 남긴다.
function translateFirestoreError(error: any, path: string | null): Error {
  const code = error?.code || '';
  const rawMessage = error instanceof Error ? error.message : String(error);

  console.error('Firestore Error:', JSON.stringify({
    error: rawMessage,
    code,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      isAnonymous: auth.currentUser?.isAnonymous,
    }
  }));

  if (rawMessage === 'AUTH_FAILED')            return new Error('인증에 실패했습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
  if (code === 'permission-denied')            return new Error('저장 권한이 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
  if (code === 'unauthenticated')              return new Error('인증이 필요합니다. 페이지를 새로고침 후 다시 시도해 주세요.');
  if (code === 'not-found')                    return new Error('데이터를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
  if (code === 'unavailable' || code === 'deadline-exceeded') return new Error('네트워크 연결을 확인하고 다시 시도해 주세요.');
  if (code === 'resource-exhausted')           return new Error('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  return new Error('오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
}

// 일시적 Firestore 오류(네트워크 순단, 서버 과부하)에만 재시도하는 코드. 권한/인증 오류는 재시도 없이 즉시 실패.
const RETRYABLE_CODES = new Set(['unavailable', 'deadline-exceeded', 'resource-exhausted', 'internal']);

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!RETRYABLE_CODES.has(error?.code || '')) throw error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`Firestore 재시도 ${attempt + 1}/${maxAttempts - 1} (${delay}ms 후, 오류: ${error?.code})`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export interface Course {
  id: string;
  name: string;
  password?: string;
  isActive?: boolean;
}

export interface Session {
  id: string;
  courseId: string;
  name: string;
  time: string;
  module: string;
  day: string;
  isActive: boolean;
  objectives?: string;
  contents?: string;
  instructor?: string;
  // 표시 순서 (작을수록 먼저). 미설정 시 fallback 정렬 사용.
  order?: number;
}

export interface UserInsight {
  id: string;
  userId: string;
  sessionId: string;
  keyword: string;
  canonicalId?: string;
  description: string;
  likes?: string[]; // Array of user IDs who liked this insight
}

export interface User {
  id: string;
  company: string;
  name: string;
  department: string;
  title: string;
  courseId: string;
  profilePic?: string;
  location?: string;
  golfScore?: number;          // deprecated (구 서베이)
  careerYears?: number;        // HMG 근무 경력 연수 (Q5)
  knownPeople?: number;        // deprecated (구 서베이)
  lottoRank?: string;          // deprecated (구 서베이)
  drinkingCapacity?: number;   // deprecated (구 서베이)
  condition?: number;          // Q1: 오늘 컨디션 0~10
  memorableQuote?: string;     // Q2: 기억에 남는 한마디
  fearWord?: string;           // Q3: 두렵게 하는 단어
  excitingWord?: string;       // Q4: 설레게 하는 단어
  surveyCompleted?: boolean;
}

export interface Interest {
  id: string;
  userId: string;
  type: 'giver' | 'taker';
  keyword: string;
  canonicalId?: string;
  description: string;
}

export interface TeaTimeRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  responseMessage?: string;
}

export interface CanonicalTerm {
  id: string;
  term: string;
  embedding?: number[];
  // 키워드 도메인 격리:
  //   - 'insight'  : 학습 인사이트 키워드 (userInsights 가 참조)
  //   - 'interest' : 유저 관심사 키워드 (interests 가 참조)
  // 동일 단어("AI")라도 insight 측과 interest 측 canonicalId 가 분리되어 충돌 차단.
  // 기존 데이터(legacy)는 kind 가 없을 수 있음 → 매칭 후보에서는 제외, 표시 lookup 만 가능.
  kind?: 'insight' | 'interest';
}

export interface PresetInterest {
  id: string;
  keyword: string;
  group: 'work' | 'hobby';
}

interface Database {
  courses: Course[];
  sessions: Session[];
  users: User[];
  interests: Interest[];
  teaTimeRequests: TeaTimeRequest[];
  userInsights: UserInsight[];
  canonicalTerms: CanonicalTerm[];
  presetInterests: PresetInterest[];
}

const defaultDb: Database = {
  courses: [
    { id: 'c1', name: 'Neural AI 기초' },
    { id: 'c2', name: 'Advanced UX Design' }
  ],
  sessions: [],
  users: [],
  interests: [],
  teaTimeRequests: [],
  userInsights: [],
  canonicalTerms: [],
  presetInterests: [],
};

interface StoreContextType {
  db: Database;
  currentUser: User | null;
  isDbLoaded: boolean;
  login: (company: string, name: string, courseId: string) => User | null;
  register: (user: User) => Promise<void>;
  logout: () => void;
  addCourse: (course: Course) => Promise<void>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  resetCourseData: (courseId: string) => Promise<void>;
  addSession: (session: Session) => Promise<void>;
  updateSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  saveInterests: (interests: Interest[]) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUserProfile: (user: User, interests: Interest[]) => Promise<void>;
  sendTeaTimeRequest: (req: TeaTimeRequest) => Promise<void>;
  updateTeaTimeRequest: (id: string, status: 'accepted' | 'rejected', responseMessage?: string) => Promise<void>;
  toggleSessionActive: (id: string) => Promise<void>;
  /** 같은 과정 내 세션 순서를 일괄 갱신 (각 세션의 order 필드 기록). */
  reorderSessions: (courseId: string, orderedIds: string[]) => Promise<void>;
  saveUserInsight: (insight: UserInsight) => Promise<void>;
  toggleInsightLike: (insightId: string, userId: string) => Promise<void>;
  fetchData: () => Promise<void>;
  /** canonicalTerms 컬렉션만 가볍게 재조회 (50명 동시 fan-out 방지를 위해 onSnapshot 미사용,
   *  대신 인사이트 화면 진입 / 자기 저장 직후 호출). */
  refreshCanonicalTerms: () => Promise<void>;
  addPresetInterest: (keyword: string, group: 'work' | 'hobby') => Promise<void>;
  deletePresetInterest: (id: string) => Promise<void>;
  /** canonicalTerms 컬렉션 정리 — 동일 정규화 텍스트의 분기된 ID 를 통일하고 미사용 doc 삭제. */
  cleanupCanonicalTerms: () => Promise<{ unified: number; deletedUnused: number; total: number }>;
  isDemoMode: boolean;
  toggleDemoMode: (active: boolean, role?: 'user' | 'admin') => void;
  resetDemoData: () => void;
  networkError: string | null;
  clearNetworkError: () => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>(defaultDb.courses);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [teaTimeRequests, setTeaTimeRequests] = useState<TeaTimeRequest[]>([]);
  const [userInsights, setUserInsights] = useState<UserInsight[]>([]);
  const [canonicalTerms, setCanonicalTerms] = useState<CanonicalTerm[]>([]);
  // 세션 내 optimistic 캐시 — onSnapshot 라운드트립 전이라도 방금 생성한 term을
  // 후속 canonicalizeKeyword 호출이 참조할 수 있게 유지. 연속 저장 시 중복 생성 방지.
  const newCanonicalTermsRef = useRef<CanonicalTerm[]>([]);
  const [presetInterests, setPresetInterests] = useState<PresetInterest[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const clearNetworkError = () => setNetworkError(null);

  // Demo Mode State
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoDb, setDemoDb] = useState<Database>(generateMockData());
  const [demoUser, setDemoUser] = useState<User | null>(null);

  const db: Database = isDemoMode ? demoDb : {
    users,
    courses,
    sessions,
    interests,
    teaTimeRequests,
    userInsights,
    canonicalTerms,
    presetInterests,
  };

  const effectiveCurrentUser = isDemoMode ? demoUser : currentUser;

  const toggleDemoMode = (active: boolean, role: 'user' | 'admin' = 'user') => {
    setIsDemoMode(active);
    if (active) {
      if (role === 'admin') {
        setDemoUser(null); // Admin view is triggered by !currentUser in App.tsx logic usually, but here we might need to handle it
      } else {
        setDemoUser(demoDb.users[0]);
      }
    } else {
      setDemoUser(null);
    }
  };

  const resetDemoData = () => {
    const newMockData = generateMockData();
    setDemoDb(newMockData);
    if (demoUser) {
      setDemoUser(newMockData.users[0]);
    }
  };

  // canonicalTerms 만 가볍게 재조회 (1 컬렉션 ~50 docs read).
  // 다른 유저가 방금 만든 새 doc 가 내 로컬 캐시에 없어 화면에 hash ID 가
  // 노출되는 현상 방지용. 50명 동시접속 시에도 서버 부하 무시 가능 수준.
  const refreshCanonicalTerms = async () => {
    if (isDemoMode) return;
    try {
      await ensureAuth();
      const snap = await withRetry(() => getDocs(collection(firestore, 'canonicalTerms')));
      setCanonicalTerms(snap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalTerm)));
    } catch (e) {
      // 실패해도 기존 로컬 캐시 유지 — UI 차단하지 않음
      console.warn('refreshCanonicalTerms failed (non-fatal):', e);
    }
  };

  const fetchData = async () => {
    try {
      await ensureAuth();
      const [usersSnap, coursesSnap, sessionsSnap, interestsSnap, requestsSnap, insightsSnap, termsSnap, presetsSnap] = await Promise.all([
        withRetry(() => getDocs(collection(firestore, 'users'))),
        withRetry(() => getDocs(collection(firestore, 'courses'))),
        withRetry(() => getDocs(collection(firestore, 'sessions'))),
        withRetry(() => getDocs(collection(firestore, 'interests'))),
        withRetry(() => getDocs(collection(firestore, 'teaTimeRequests'))),
        withRetry(() => getDocs(collection(firestore, 'userInsights'))),
        withRetry(() => getDocs(collection(firestore, 'canonicalTerms'))),
        withRetry(() => getDocs(collection(firestore, 'presetInterests'))),
      ]);
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
      setSessions(sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      setInterests(interestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Interest)));
      setTeaTimeRequests(requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeaTimeRequest)));
      setUserInsights(insightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserInsight)));
      setCanonicalTerms(termsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CanonicalTerm)));
      setPresetInterests(presetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresetInterest)));
      console.log("Manual data fetch complete.");
    } catch (error) {
      // 에러를 상위로 전파 — 호출자가 사용자에게 알림을 표시할 수 있도록
      throw translateFirestoreError(error, 'fetchData');
    }
  };

  // 1단계: Firestore 실시간 리스너 설정 (Step 1: Setup Firestore real-time listeners for each collection)
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    const collectionsToLoad = ['users', 'courses', 'sessions', 'interests', 'teaTimeRequests', 'userInsights', 'canonicalTerms', 'presetInterests'];
    const loadedCollections = new Set<string>();

    const checkAllLoaded = (collectionName: string, success: boolean = true) => {
      loadedCollections.add(collectionName);
      if (loadedCollections.size === collectionsToLoad.length) {
        setIsDbLoaded(true);
      }
      // 리스너가 한 번이라도 데이터를 정상 수신하면, 초기 fetchData 실패로 띄운
      // 네트워크 오류 배너를 자동으로 해제 (UX 자가 회복).
      if (success) {
        setNetworkError(null);
      }
    };

    const setupListeners = () => {
      const handleError = (error: any, collectionName: string) => {
        console.error('Firestore listener error:', JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          code: error?.code,
          collection: collectionName,
        }));
        checkAllLoaded(collectionName, false);
      };

      // Users
      unsubscribers.push(onSnapshot(collection(firestore, 'users'), (snap) => {
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        checkAllLoaded('users');
      }, (error) => handleError(error, 'users')));

      // Courses
      unsubscribers.push(onSnapshot(collection(firestore, 'courses'), (snap) => {
        setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
        checkAllLoaded('courses');
      }, (error) => handleError(error, 'courses')));

      // Sessions
      unsubscribers.push(onSnapshot(collection(firestore, 'sessions'), (snap) => {
        setSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
        checkAllLoaded('sessions');
      }, (error) => handleError(error, 'sessions')));

      // Interests
      unsubscribers.push(onSnapshot(collection(firestore, 'interests'), (snap) => {
        setInterests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Interest)));
        checkAllLoaded('interests');
      }, (error) => handleError(error, 'interests')));

      // TeaTimeRequests
      unsubscribers.push(onSnapshot(collection(firestore, 'teaTimeRequests'), (snap) => {
        setTeaTimeRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeaTimeRequest)));
        checkAllLoaded('teaTimeRequests');
      }, (error) => handleError(error, 'teaTimeRequests')));

      // UserInsights
      unsubscribers.push(onSnapshot(collection(firestore, 'userInsights'), (snap) => {
        setUserInsights(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserInsight)));
        checkAllLoaded('userInsights');
      }, (error) => handleError(error, 'userInsights')));

      // CanonicalTerms — heaviest collection (3072차원 embedding/doc, ~24KB).
      // 50명 동시 접속 시 read fan-out 폭증 방지를 위해 onSnapshot 대신
      // 1회 getDocs 로 적재 후 (a) 사용자가 새 키워드를 저장할 때 (b) 수동 새로고침
      // 시점에만 갱신. 동기화 지연이 있어도 buildInterestKeyIndex 가 텍스트 정규화로
      // 자동 통합하므로 시각적 일관성에는 영향 없음.
      withRetry(() => getDocs(collection(firestore, 'canonicalTerms')))
        .then((snap) => {
          setCanonicalTerms(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CanonicalTerm)));
          checkAllLoaded('canonicalTerms');
        })
        .catch((error) => handleError(error, 'canonicalTerms'));

      // PresetInterests
      unsubscribers.push(onSnapshot(collection(firestore, 'presetInterests'), (snap) => {
        setPresetInterests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresetInterest)));
        checkAllLoaded('presetInterests');
      }, (error) => handleError(error, 'presetInterests')));

    };

    // 마이그레이션 및 초기화 로직 (Migration and Initialization)
    const initializeData = async () => {
      await authReady; // Firebase 익명 인증 완료 후 Firestore 접근

      // 인증 실패 시 리스너 설정 자체가 불가 → 즉시 오류 표시
      if (!auth.currentUser) {
        console.error('익명 인증 실패: Firestore 접근 불가');
        setNetworkError('서버 인증에 실패했습니다. 페이지를 새로고침해 주세요.');
        setIsDbLoaded(true);
        return;
      }

      try {
        const oldDocRef = doc(firestore, 'giveandtake', 'data');
        const oldSnap = await withRetry(() => getDoc(oldDocRef));

        if (oldSnap.exists()) {
          const oldData = oldSnap.data() as Database;
          console.log("Old data found. Migrating to granular collections...");

          const batch = writeBatch(firestore);

          // Migrate Users
          if (oldData.users) {
            oldData.users.forEach(u => batch.set(doc(firestore, 'users', u.id), u));
          }
          // Migrate Courses
          if (oldData.courses) {
            oldData.courses.forEach(c => batch.set(doc(firestore, 'courses', c.id), c));
          }
          // Migrate Sessions
          if (oldData.sessions) {
            oldData.sessions.forEach(s => batch.set(doc(firestore, 'sessions', s.id), s));
          }
          // Migrate Interests
          if (oldData.interests) {
            oldData.interests.forEach(i => batch.set(doc(firestore, 'interests', i.id), i));
          }
          // Migrate Insights
          if (oldData.userInsights) {
            oldData.userInsights.forEach(i => batch.set(doc(firestore, 'userInsights', i.id), i));
          }
          // Migrate Requests
          if (oldData.teaTimeRequests) {
            oldData.teaTimeRequests.forEach(r => batch.set(doc(firestore, 'teaTimeRequests', r.id), r));
          }
          // Migrate Terms
          if (oldData.canonicalTerms) {
            oldData.canonicalTerms.forEach(t => batch.set(doc(firestore, 'canonicalTerms', t.id), t));
          }

          // Delete old doc
          batch.delete(oldDocRef);
          await withRetry(() => batch.commit());
          console.log("Migration complete.");
        } else {
          // Check if collections are empty, if so, seed default courses
          const coursesSnap = await withRetry(() => getDocs(collection(firestore, 'courses')));
          if (coursesSnap.empty) {
            console.log("Seeding default courses...");
            const batch = writeBatch(firestore);
            defaultDb.courses.forEach(c => batch.set(doc(firestore, 'courses', c.id), c));
            await withRetry(() => batch.commit());
          }
        }

        setupListeners();
      } catch (error: any) {
        console.error("Initialization error:", error);
        const code = error?.code || '';
        const isFatal = code === 'permission-denied' || code === 'unauthenticated' || error?.message === 'AUTH_FAILED';
        if (isFatal) {
          // 권한/인증 오류는 리스너도 동일하게 실패하므로 설정하지 않음
          setNetworkError('데이터 접근 권한이 없습니다. 관리자에게 문의하거나 페이지를 새로고침해 주세요.');
          setIsDbLoaded(true);
        } else {
          // 일시적 네트워크 오류: withRetry 재시도 소진 후 도달. 리스너는 자체 재연결 로직이 있으므로 계속 시도
          setNetworkError('초기화 중 네트워크 오류가 발생했습니다. 일부 기능이 제한될 수 있습니다.');
          setupListeners();
        }
      }
    };

    initializeData();

    // 로컬 스토리지에서 현재 사용자 정보 복구
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Error parsing stored user:", e);
      }
    }

    const safetyTimeout = setTimeout(() => {
      if (!isDbLoaded) {
        console.warn("Safety timeout triggered. Forcing isDbLoaded to true.");
        setIsDbLoaded(true);
      }
    }, 10000);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Helper to sanitize data for Firestore
  const sanitize = (data: any) => JSON.parse(JSON.stringify(data));

  const login = (company: string, name: string, courseId: string) => {
    if (isDemoMode) {
      const user = demoDb.users.find(u => u.company === company && u.name === name && u.courseId === courseId);
      if (user) {
        setDemoUser(user);
        return user;
      }
      return null;
    }
    const user = users.find(u => u.company === company && u.name === name && u.courseId === courseId);
    if (user) {
      setCurrentUser(user);
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (e) {
        console.warn('localStorage write failed (non-fatal):', e);
      }
      return user;
    }
    return null;
  };

  const register = async (user: User) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, users: [...prev.users, user] }));
      setDemoUser(user);
      return;
    }
    await ensureAuth();
    try {
      // 이름·회사 표면 정규화 (NFC + zero-width 제거 + 공백 압축)
      // 동명이인 ID 충돌 / 보이지 않는 문자로 인한 분리 방지.
      const cleaned: User = {
        ...user,
        name: normalizeUserField(user.name) || user.name,
        company: normalizeUserField(user.company) || user.company,
      };
      await withRetry(() => setDoc(doc(firestore, 'users', cleaned.id), sanitize(cleaned)));
      setCurrentUser(cleaned);
      try {
        localStorage.setItem('currentUser', JSON.stringify(cleaned));
      } catch (e) {
        console.warn('localStorage write failed (non-fatal):', e);
      }
    } catch (error: any) {
      throw translateFirestoreError(error, `users/${user.id}`);
    }
  };

  const logout = () => {
    if (isDemoMode) {
      setDemoUser(null);
      return;
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const addCourse = async (course: Course) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, courses: [...prev.courses, course] }));
      return;
    }
    await ensureAuth();
    try {
      await withRetry(() => setDoc(doc(firestore, 'courses', course.id), sanitize(course)));
    } catch (error: any) {
      throw translateFirestoreError(error, `courses/${course.id}`);
    }
  };

  const updateCourse = async (course: Course) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, courses: prev.courses.map(c => c.id === course.id ? course : c) }));
      return;
    }
    await ensureAuth();
    try {
      await withRetry(() => setDoc(doc(firestore, 'courses', course.id), sanitize(course)));
    } catch (error: any) {
      throw translateFirestoreError(error, `courses/${course.id}`);
    }
  };

  const deleteCourse = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        courses: prev.courses.filter(c => c.id !== id),
        sessions: prev.sessions.filter(s => s.courseId !== id),
        users: prev.users.filter(u => u.courseId !== id)
      }));
      return;
    }
    await ensureAuth();
    try {
      console.log(`Starting deletion for course: ${id}`);
      let batch = writeBatch(firestore);
      let opCount = 0;

      const commitBatch = async () => {
        if (opCount > 0) {
          await batch.commit();
          batch = writeBatch(firestore);
          opCount = 0;
        }
      };

      // 1. Delete the course itself
      batch.delete(doc(firestore, 'courses', id));
      opCount++;

      // 2. Delete related sessions
      const sessionsQuery = query(collection(firestore, 'sessions'), where('courseId', '==', id));
      const sessionsSnap = await getDocs(sessionsQuery);
      for (const d of sessionsSnap.docs) {
        batch.delete(d.ref);
        opCount++;
        if (opCount >= 400) await commitBatch();
      }

      // 3. Delete related users and their data
      const usersQuery = query(collection(firestore, 'users'), where('courseId', '==', id));
      const usersSnap = await getDocs(usersQuery);
      const userIds = usersSnap.docs.map(d => d.id);

      for (const userDoc of usersSnap.docs) {
        batch.delete(userDoc.ref);
        opCount++;
        if (opCount >= 400) await commitBatch();
      }

      for (const userId of userIds) {
        // Interests
        const interestsQuery = query(collection(firestore, 'interests'), where('userId', '==', userId));
        const interestsSnap = await getDocs(interestsQuery);
        for (const d of interestsSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }

        // Insights
        const insightsQuery = query(collection(firestore, 'userInsights'), where('userId', '==', userId));
        const insightsSnap = await getDocs(insightsQuery);
        for (const d of insightsSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }

        // Tea Time Requests (from)
        const requestsFromQuery = query(collection(firestore, 'teaTimeRequests'), where('fromUserId', '==', userId));
        const requestsFromSnap = await getDocs(requestsFromQuery);
        for (const d of requestsFromSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }

        // Tea Time Requests (to)
        const requestsToQuery = query(collection(firestore, 'teaTimeRequests'), where('toUserId', '==', userId));
        const requestsToSnap = await getDocs(requestsToQuery);
        for (const d of requestsToSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }
      }

      await commitBatch();
      console.log("Deletion complete.");
    } catch (error: any) {
      const errorCode = error?.code || '';
      const errorMessage = error?.message || String(error);
      console.error("Error deleting course:", errorCode, errorMessage);

      if (errorCode === 'permission-denied') {
        throw new Error('권한이 없습니다. 어드민 계정으로 로그인되어 있는지 확인해주세요.');
      }
      if (errorCode === 'not-found') {
        throw new Error('삭제할 과정을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.');
      }
      throw translateFirestoreError(error, `courses/${id}`);
    }
  };

  const resetCourseData = async (courseId: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        users: prev.users.filter(u => u.courseId !== courseId),
        interests: prev.interests.filter(i => {
          const user = prev.users.find(u => u.id === i.userId);
          return user?.courseId !== courseId;
        })
      }));
      return;
    }
    await ensureAuth();
    try {
      console.log(`Starting reset for course: ${courseId}`);
      
      // 1. Get all users for this course directly from Firestore
      const usersQuery = query(collection(firestore, 'users'), where('courseId', '==', courseId));
      const usersSnap = await getDocs(usersQuery);
      const userIds = usersSnap.docs.map(d => d.id);

      if (userIds.length === 0) {
        console.log("No users found for this course.");
        return;
      }

      // Firestore batch limit is 500. We'll use a simple strategy to commit every 400 operations.
      let batch = writeBatch(firestore);
      let opCount = 0;

      const commitBatch = async () => {
        if (opCount > 0) {
          await batch.commit();
          batch = writeBatch(firestore);
          opCount = 0;
        }
      };

      // Delete Users
      for (const userDoc of usersSnap.docs) {
        batch.delete(userDoc.ref);
        opCount++;
        if (opCount >= 400) await commitBatch();
      }

      // Delete related data for each user
      for (const userId of userIds) {
        // Interests
        const interestsQuery = query(collection(firestore, 'interests'), where('userId', '==', userId));
        const interestsSnap = await getDocs(interestsQuery);
        for (const d of interestsSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }

        // Insights
        const insightsQuery = query(collection(firestore, 'userInsights'), where('userId', '==', userId));
        const insightsSnap = await getDocs(insightsQuery);
        for (const d of insightsSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }

        // Tea Time Requests (from)
        const requestsFromQuery = query(collection(firestore, 'teaTimeRequests'), where('fromUserId', '==', userId));
        const requestsFromSnap = await getDocs(requestsFromQuery);
        for (const d of requestsFromSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }

        // Tea Time Requests (to)
        const requestsToQuery = query(collection(firestore, 'teaTimeRequests'), where('toUserId', '==', userId));
        const requestsToSnap = await getDocs(requestsToQuery);
        for (const d of requestsToSnap.docs) {
          batch.delete(d.ref);
          opCount++;
          if (opCount >= 400) await commitBatch();
        }
      }

      await commitBatch();
      console.log("Reset complete.");
    } catch (error: any) {
      throw translateFirestoreError(error, `courseData/${courseId}`);
    }
  };

  const addSession = async (session: Session) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, sessions: [...prev.sessions, session] }));
      return;
    }
    await ensureAuth();
    try {
      const data = { ...session, isActive: session.isActive ?? true };
      await withRetry(() => setDoc(doc(firestore, 'sessions', session.id), sanitize(data)));
    } catch (error: any) {
      throw translateFirestoreError(error, `sessions/${session.id}`);
    }
  };

  const updateSession = async (session: Session) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, sessions: prev.sessions.map(s => s.id === session.id ? session : s) }));
      return;
    }
    await ensureAuth();
    try {
      await withRetry(() => setDoc(doc(firestore, 'sessions', session.id), sanitize(session)));
    } catch (error: any) {
      throw translateFirestoreError(error, `sessions/${session.id}`);
    }
  };

  // 과정 내 세션의 표시 순서 갱신 — orderedIds 의 인덱스를 order 필드에 기록.
  const reorderSessions = async (courseId: string, orderedIds: string[]) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => {
          if (s.courseId !== courseId) return s;
          const idx = orderedIds.indexOf(s.id);
          return idx >= 0 ? { ...s, order: idx } : s;
        }),
      }));
      return;
    }
    await ensureAuth();
    try {
      const batch = writeBatch(firestore);
      orderedIds.forEach((sid, idx) => {
        batch.update(doc(firestore, 'sessions', sid), { order: idx });
      });
      await withRetry(() => batch.commit());
    } catch (error: any) {
      throw translateFirestoreError(error, `sessions/reorder`);
    }
  };

  const toggleSessionActive = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s)
      }));
      return;
    }
    await ensureAuth();
    try {
      const session = sessions.find(s => s.id === id);
      if (session) {
        await withRetry(() =>
          setDoc(doc(firestore, 'sessions', id), sanitize({ ...session, isActive: !session.isActive }))
        );
      }
    } catch (error: any) {
      throw translateFirestoreError(error, `sessions/${id}`);
    }
  };

  const canonicalizeKeyword = async (keyword: string, kind: 'insight' | 'interest') => {
    const normalized = keyword.replace(/\s+/g, '').toLowerCase();

    const safeKeyId = (raw: string) =>
      raw.replace(/[\/\x00-\x1F\x7F]/g, '_').replace(/^__+|__+$/g, '_').slice(0, 500) || Date.now().toString();

    // onSnapshot 반영 전인 세션-로컬 새 term도 함께 비교 (연속 저장 시 중복 생성 방지)
    // 같은 id는 중복 제거 — onSnapshot이 나중에 따라잡아도 문제 없음
    const all: CanonicalTerm[] = [...canonicalTerms];
    const seen = new Set(canonicalTerms.map(t => t.id));
    for (const t of newCanonicalTermsRef.current) {
      if (!seen.has(t.id)) all.push(t);
    }

    // ★ 도메인 격리: 매칭은 같은 kind 끼리만. legacy(kind 없음) 는 매칭 제외.
    const merged = all.filter(t => t.kind === kind);

    // 1) 정규화 후 exact match (같은 도메인 내에서)
    for (const ct of merged) {
      const ctNormalized = (ct.term || '').replace(/\s+/g, '').toLowerCase();
      if (ctNormalized === normalized) {
        return { canonicalId: ct.id, term: ct.term };
      }
    }

    // 2) 임베딩 기반 유사도
    const embedding = await getEmbedding(keyword);
    if (!embedding) {
      // 임베딩이 없으면 향후 그룹핑 불가 — 최소한 safeKeyId로 고립 저장
      return { canonicalId: safeKeyId(keyword), term: keyword };
    }

    let bestMatch: CanonicalTerm | null = null;
    let maxSimilarity = -1;
    for (const ct of merged) {
      if (ct.embedding) {
        const sim = cosineSimilarity(embedding, ct.embedding);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          bestMatch = ct;
        }
      }
    }

    // 유사도 임계치: 0.78 (Gemini embedding-001 한국어 anisotropy 보정값)
    // 실측 검증:
    //   - 진짜 동의어 (Physical AI ↔ 피지컬 AI = 0.884, 리더십 ↔ Leadership = 0.783,
    //     커뮤니케이션 ↔ 소통 = 0.796, 데이터 분석 ↔ 데이터 사이언스 = 0.786) → 정상 MERGE
    //   - 무관어 (브랜딩 ↔ 코딩 = 0.714, 전기차 ↔ 공룡 = 0.633, 요리 ↔ 악기연주 = 0.671) → KEEP
    //   - 0.55 임계치 시 한국어 baseline anisotropy(~0.6)로 false positive 폭증
    if (bestMatch && maxSimilarity > 0.78) {
      return { canonicalId: bestMatch.id, term: bestMatch.term };
    }

    // 새 term — 결정적 ID (정규화 텍스트 hash) 사용.
    // 두 사용자가 동시에 같은 키워드를 처음 등록해도 동일 ID 로 수렴 → setDoc 멱등 → 중복 doc 0.
    const newId = `ct_${kind}_${hashId(normalized + '|' + kind)}`;
    newCanonicalTermsRef.current.push({ id: newId, term: keyword, embedding, kind });
    return { canonicalId: newId, term: keyword, embedding, kind };
  };

  const saveUserInsight = async (insight: UserInsight) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, userInsights: [...prev.userInsights, insight] }));
      return;
    }
    await ensureAuth();
    try {
      const { canonicalId, term, embedding } = await canonicalizeKeyword(insight.keyword, 'insight');
      const batch = writeBatch(firestore);
      const isNewCanonical = !canonicalTerms.find(t => t.id === canonicalId);
      if (isNewCanonical) {
        batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding, kind: 'insight' }));
      }
      batch.set(doc(firestore, 'userInsights', insight.id), sanitize({ ...insight, canonicalId, likes: insight.likes || [] }));
      await withRetry(() => batch.commit());
      // canonicalTerms 는 onSnapshot 미사용이라 로컬 상태 즉시 반영 필요
      if (isNewCanonical) {
        setCanonicalTerms((prev) =>
          prev.find((t) => t.id === canonicalId) ? prev : [...prev, { id: canonicalId, term, embedding, kind: 'insight' }]
        );
      }
    } catch (error: any) {
      // canonicalization 또는 batch 실패 시 canonicalId 없이 단순 저장으로 fallback (재시도 포함)
      try {
        await withRetry(() =>
          setDoc(doc(firestore, 'userInsights', insight.id), sanitize({ ...insight, likes: insight.likes || [] }))
        );
      } catch (fallbackError: any) {
        throw translateFirestoreError(fallbackError, `userInsights/${insight.id}`);
      }
    }
  };

  const toggleInsightLike = async (insightId: string, userId: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        userInsights: prev.userInsights.map(i => {
          if (i.id === insightId) {
            const likes = i.likes || [];
            const newLikes = likes.includes(userId) ? likes.filter(id => id !== userId) : [...likes, userId];
            return { ...i, likes: newLikes };
          }
          return i;
        })
      }));
      return;
    }
    await ensureAuth();
    try {
      // 동시 좋아요 race 방지: read-modify-write 대신 Firestore 의 atomic
      // arrayUnion / arrayRemove 로 likes 필드만 부분 갱신.
      const insight = userInsights.find(i => i.id === insightId);
      const isLiked = (insight?.likes || []).includes(userId);
      await withRetry(() =>
        updateDoc(doc(firestore, 'userInsights', insightId), {
          likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
        })
      );
    } catch (error: any) {
      throw translateFirestoreError(error, `userInsights/${insightId}`);
    }
  };

  const deleteSession = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.id !== id) }));
      return;
    }
    await ensureAuth();
    try {
      await withRetry(() => deleteDoc(doc(firestore, 'sessions', id)));
    } catch (error: any) {
      throw translateFirestoreError(error, `sessions/${id}`);
    }
  };

  const saveInterests = async (interestsToSave: Interest[]) => {
    if (isDemoMode) {
      setDemoDb(prev => {
        const otherInterests = prev.interests.filter(i => i.userId !== demoUser?.id);
        return { ...prev, interests: [...otherInterests, ...interestsToSave] };
      });
      return;
    }
    await ensureAuth();
    try {
      const batch = writeBatch(firestore);

      // 1. Delete old interests for this user
      if (currentUser) {
        const oldInterests = interests.filter(i => i.userId === currentUser.id);
        oldInterests.forEach(i => batch.delete(doc(firestore, 'interests', i.id)));
      }

      // 2. Canonicalize and add new — canonicalization 실패 시 canonicalId 없이 저장
      const newCanonicals: CanonicalTerm[] = [];
      for (const i of interestsToSave) {
        try {
          const { canonicalId, term, embedding } = await canonicalizeKeyword(i.keyword, 'interest');
          if (!canonicalTerms.find(t => t.id === canonicalId) && !newCanonicals.find(t => t.id === canonicalId)) {
            batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding, kind: 'interest' }));
            newCanonicals.push({ id: canonicalId, term, embedding, kind: 'interest' });
          }
          batch.set(doc(firestore, 'interests', i.id), sanitize({ ...i, canonicalId }));
        } catch {
          batch.set(doc(firestore, 'interests', i.id), sanitize(i));
        }
      }

      await withRetry(() => batch.commit());
      // canonicalTerms 는 onSnapshot 미사용이라 로컬 상태 즉시 반영 필요
      if (newCanonicals.length > 0) {
        setCanonicalTerms((prev) => {
          const have = new Set(prev.map(t => t.id));
          const adds = newCanonicals.filter(t => !have.has(t.id));
          return adds.length > 0 ? [...prev, ...adds] : prev;
        });
      }
    } catch (error: any) {
      throw translateFirestoreError(error, 'interests');
    }
  };

  const updateUser = async (user: User) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, users: prev.users.map(u => u.id === user.id ? user : u) }));
      if (demoUser?.id === user.id) setDemoUser(user);
      return;
    }
    await ensureAuth();
    try {
      await setDoc(doc(firestore, 'users', user.id), sanitize(user));
      if (currentUser?.id === user.id) {
        setCurrentUser(user);
        try {
          localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (e) {
          console.warn('localStorage write failed (non-fatal):', e);
        }
      }
    } catch (error: any) {
      throw translateFirestoreError(error, `users/${user.id}`);
    }
  };

  const updateUserProfile = async (user: User, newInterests: Interest[]) => {
    if (isDemoMode) {
      setDemoDb(prev => {
        const otherInterests = prev.interests.filter(i => i.userId !== user.id);
        return {
          ...prev,
          users: prev.users.map(u => u.id === user.id ? user : u),
          interests: [...otherInterests, ...newInterests]
        };
      });
      if (demoUser?.id === user.id) setDemoUser(user);
      return;
    }
    await ensureAuth();
    try {
      const batch = writeBatch(firestore);

      // 1. Update User
      batch.set(doc(firestore, 'users', user.id), sanitize(user));

      // 2. Handle Interests
      // Delete old
      const oldInterests = interests.filter(i => i.userId === user.id);
      oldInterests.forEach(i => batch.delete(doc(firestore, 'interests', i.id)));

      // Add new — canonicalization을 병렬 실행해 하나가 느려도 직렬로 쌓이지 않게 처리.
      // 실패 시 canonicalId 없이 저장 (fallback).
      const canonicalized = await Promise.all(
        newInterests.map(async (i) => {
          try {
            const res = await canonicalizeKeyword(i.keyword, 'interest');
            return { i, res, ok: true as const };
          } catch {
            return { i, res: null, ok: false as const };
          }
        })
      );
      const newCanonicals: CanonicalTerm[] = [];
      for (const { i, res, ok } of canonicalized) {
        if (ok && res) {
          const { canonicalId, term, embedding } = res;
          try {
            if (!canonicalTerms.find(t => t.id === canonicalId) && !newCanonicals.find(t => t.id === canonicalId)) {
              batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding, kind: 'interest' }));
              newCanonicals.push({ id: canonicalId, term, embedding, kind: 'interest' });
            }
            batch.set(doc(firestore, 'interests', i.id), sanitize({ ...i, canonicalId }));
          } catch {
            batch.set(doc(firestore, 'interests', i.id), sanitize(i));
          }
        } else {
          batch.set(doc(firestore, 'interests', i.id), sanitize(i));
        }
      }

      await withRetry(() => batch.commit());

      // onSnapshot 응답을 기다리지 않고 로컬 상태 즉시 갱신
      setInterests(prev => [
        ...prev.filter(i => i.userId !== user.id),
        ...newInterests,
      ]);
      // canonicalTerms 도 즉시 반영 (snapshot listener 없음)
      if (newCanonicals.length > 0) {
        setCanonicalTerms((prev) => {
          const have = new Set(prev.map(t => t.id));
          const adds = newCanonicals.filter(t => !have.has(t.id));
          return adds.length > 0 ? [...prev, ...adds] : prev;
        });
      }

      if (currentUser?.id === user.id) {
        setCurrentUser(user);
        // 인앱브라우저/Private 모드에서 localStorage가 throw 할 수 있음.
        // Firestore 저장은 이미 완료됐으므로 여기서 실패해도 전체 save를 깨뜨리지 않는다.
        try {
          localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (e) {
          console.warn('localStorage write failed (non-fatal):', e);
        }
      }
    } catch (error: any) {
      console.error("Error updating user profile:", JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        code: error?.code,
        authInfo: { userId: auth.currentUser?.uid, isAnonymous: auth.currentUser?.isAnonymous },
        path: `users/${user.id}`
      }));

      const code = error?.code || '';
      if (error?.message === 'AUTH_FAILED') {
        throw new Error('인증에 실패했습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
      }
      if (code === 'permission-denied') {
        throw new Error('저장 권한이 없습니다. 페이지를 새로고침 후 다시 시도해 주세요.');
      }
      if (code === 'unavailable' || code === 'deadline-exceeded') {
        throw new Error('네트워크 연결을 확인하고 다시 시도해 주세요.');
      }
      throw new Error('프로필 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const deleteUser = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        users: prev.users.filter(u => u.id !== id),
        interests: prev.interests.filter(i => i.userId !== id),
        userInsights: prev.userInsights.filter(i => i.userId !== id),
        teaTimeRequests: prev.teaTimeRequests.filter(r => r.fromUserId !== id && r.toUserId !== id)
      }));
      return;
    }
    await ensureAuth();
    try {
      const batch = writeBatch(firestore);
      
      // Delete User
      batch.delete(doc(firestore, 'users', id));
      
      // Delete related data
      interests.filter(i => i.userId === id).forEach(i => batch.delete(doc(firestore, 'interests', i.id)));
      userInsights.filter(i => i.userId === id).forEach(i => batch.delete(doc(firestore, 'userInsights', i.id)));
      teaTimeRequests.filter(r => r.fromUserId === id || r.toUserId === id).forEach(r => batch.delete(doc(firestore, 'teaTimeRequests', r.id)));
      
      await batch.commit();
    } catch (error: any) {
      throw translateFirestoreError(error, `users/${id}`);
    }
  };

  const sendTeaTimeRequest = async (req: TeaTimeRequest) => {
    // 같은 보낸이→받는이 의 pending 요청이 이미 있으면 중복 생성 차단 (더블클릭/네트워크 지연 등)
    const dup = teaTimeRequests.find(
      r => r.fromUserId === req.fromUserId && r.toUserId === req.toUserId && r.status === 'pending'
    );
    if (dup) return;
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, teaTimeRequests: [...prev.teaTimeRequests, req] }));
      return;
    }
    await ensureAuth();
    try {
      await withRetry(() => setDoc(doc(firestore, 'teaTimeRequests', req.id), sanitize(req)));
    } catch (error: any) {
      throw translateFirestoreError(error, `teaTimeRequests/${req.id}`);
    }
  };

  const updateTeaTimeRequest = async (id: string, status: 'accepted' | 'rejected', responseMessage?: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({
        ...prev,
        teaTimeRequests: prev.teaTimeRequests.map(r => r.id === id ? { ...r, status, responseMessage } : r)
      }));
      return;
    }
    await ensureAuth();
    try {
      // partial update: race condition 시 다른 필드 덮어쓰지 않도록 status/responseMessage 만 갱신.
      const patch: Record<string, any> = { status };
      if (responseMessage !== undefined) patch.responseMessage = responseMessage;
      await withRetry(() => updateDoc(doc(firestore, 'teaTimeRequests', id), patch));
    } catch (error: any) {
      throw translateFirestoreError(error, `teaTimeRequests/${id}`);
    }
  };

  const addPresetInterest = async (keyword: string, group: 'work' | 'hobby') => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, presetInterests: [...prev.presetInterests, { id: `pi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`, keyword, group }] }));
      return;
    }
    await ensureAuth();
    try {
      const id = `pi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
      await withRetry(() => setDoc(doc(firestore, 'presetInterests', id), sanitize({ id, keyword, group })));
    } catch (error: any) {
      throw translateFirestoreError(error, `presetInterests/${keyword}`);
    }
  };

  const deletePresetInterest = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, presetInterests: prev.presetInterests.filter(p => p.id !== id) }));
      return;
    }
    await ensureAuth();
    try {
      await withRetry(() => deleteDoc(doc(firestore, 'presetInterests', id)));
    } catch (error: any) {
      throw translateFirestoreError(error, `presetInterests/${id}`);
    }
  };

  // canonicalTerms 정리 — 같은 정규화 텍스트 + 같은 kind 인 doc 들이 여러 ID 로 분기된
  // 경우 가장 많이 참조되는 ID 로 통일하고, 어디에서도 참조되지 않는 doc 은 삭제.
  // race / 마이그레이션 잔여물 누적 방지용. 관리자 수동 호출.
  const cleanupCanonicalTerms = async () => {
    if (isDemoMode) return { unified: 0, deletedUnused: 0, total: 0 };
    await ensureAuth();

    // 정규화: store.tsx canonicalize 와 동일 규칙
    const norm = (s: string | undefined | null) => {
      if (!s) return '';
      let v = s;
      try { v = v.normalize('NFC'); } catch {}
      return v.replace(/[​-‍﻿ ]/g, '').replace(/\s+/g, '').toLowerCase();
    };

    // 최신 데이터 재조회 (snapshot 미사용이므로 stale 가능성 차단)
    const [termsSnap, insightsSnap, interestsSnap] = await Promise.all([
      withRetry(() => getDocs(collection(firestore, 'canonicalTerms'))),
      withRetry(() => getDocs(collection(firestore, 'userInsights'))),
      withRetry(() => getDocs(collection(firestore, 'interests'))),
    ]);
    const allTerms = termsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalTerm));
    const allInsights = insightsSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserInsight));
    const allInterestsLatest = interestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Interest));

    // (norm + kind) → 사용 빈도 count 후보 매트릭스
    const ref = new Map<string, Map<string, number>>(); // cid → count
    const keyOfRef = new Map<string, string>(); // cid → "norm|kind"
    for (const t of allTerms) {
      const key = `${norm(t.term)}|${t.kind || 'unknown'}`;
      keyOfRef.set(t.id, key);
      if (!ref.has(key)) ref.set(key, new Map());
      ref.get(key)!.set(t.id, 0);
    }
    for (const i of allInterestsLatest) {
      if (!i.canonicalId) continue;
      const k = keyOfRef.get(i.canonicalId) ?? `${norm(i.keyword)}|interest`;
      if (!ref.has(k)) ref.set(k, new Map());
      const m = ref.get(k)!;
      m.set(i.canonicalId, (m.get(i.canonicalId) || 0) + 1);
    }
    for (const i of allInsights) {
      if (!i.canonicalId) continue;
      const k = keyOfRef.get(i.canonicalId) ?? `${norm(i.keyword)}|insight`;
      if (!ref.has(k)) ref.set(k, new Map());
      const m = ref.get(k)!;
      m.set(i.canonicalId, (m.get(i.canonicalId) || 0) + 1);
    }

    // 그룹별 winner 선정 + 패치 ops 수집
    const ops: Array<{ kind: 'set'; coll: string; id: string; data: any } | { kind: 'delete'; coll: string; id: string }> = [];
    let unifiedGroups = 0;
    let deletedUnused = 0;
    const cidRedirect = new Map<string, string>(); // 옛 ID → 통일된 ID

    for (const [_groupKey, idToCount] of ref) {
      const ids = [...idToCount.keys()];
      if (ids.length === 0) continue;
      // 정렬: count 내림차순 → ID 사전순 (오래된 우선)
      ids.sort((a, b) => (idToCount.get(b)! - idToCount.get(a)!) || a.localeCompare(b));
      const winner = ids[0];
      if (idToCount.get(winner) === 0) {
        // 그룹 전체가 미사용 → 모두 삭제
        for (const id of ids) {
          ops.push({ kind: 'delete', coll: 'canonicalTerms', id });
          deletedUnused++;
        }
        continue;
      }
      if (ids.length > 1) {
        unifiedGroups++;
        for (let i = 1; i < ids.length; i++) {
          if (idToCount.get(ids[i]) === 0) {
            ops.push({ kind: 'delete', coll: 'canonicalTerms', id: ids[i] });
            deletedUnused++;
          } else {
            cidRedirect.set(ids[i], winner);
            ops.push({ kind: 'delete', coll: 'canonicalTerms', id: ids[i] });
          }
        }
      }
    }

    // 참조 패치 — interests / userInsights 의 canonicalId 갱신
    for (const i of allInterestsLatest) {
      const newId = i.canonicalId ? cidRedirect.get(i.canonicalId) : undefined;
      if (newId) ops.push({ kind: 'set', coll: 'interests', id: i.id, data: { ...i, canonicalId: newId } });
    }
    for (const i of allInsights) {
      const newId = i.canonicalId ? cidRedirect.get(i.canonicalId) : undefined;
      if (newId) ops.push({ kind: 'set', coll: 'userInsights', id: i.id, data: { ...i, canonicalId: newId } });
    }

    // 450 단위 batch commit (Firestore batch limit 500)
    for (let i = 0; i < ops.length; i += 450) {
      const slice = ops.slice(i, i + 450);
      const batch = writeBatch(firestore);
      for (const op of slice) {
        if (op.kind === 'set') batch.set(doc(firestore, op.coll, op.id), sanitize(op.data));
        else batch.delete(doc(firestore, op.coll, op.id));
      }
      await withRetry(() => batch.commit());
    }

    // 로컬 canonicalTerms 재조회로 동기화
    const refreshed = await withRetry(() => getDocs(collection(firestore, 'canonicalTerms')));
    setCanonicalTerms(refreshed.docs.map(d => ({ id: d.id, ...d.data() } as CanonicalTerm)));

    return { unified: unifiedGroups, deletedUnused, total: refreshed.docs.length };
  };

  return (
    <StoreContext.Provider value={{
      db, currentUser: effectiveCurrentUser, isDbLoaded, login, register, logout, addCourse, updateCourse, deleteCourse, resetCourseData,
      addSession, updateSession, deleteSession,
      saveInterests, updateUser, deleteUser, updateUserProfile, sendTeaTimeRequest, updateTeaTimeRequest,
      toggleSessionActive, reorderSessions, saveUserInsight, toggleInsightLike, fetchData,
      addPresetInterest, deletePresetInterest, cleanupCanonicalTerms, refreshCanonicalTerms,
      isDemoMode, toggleDemoMode, resetDemoData,
      networkError, clearNetworkError,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}

