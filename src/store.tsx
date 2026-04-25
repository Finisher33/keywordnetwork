import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from 'react';
import { getEmbedding, cosineSimilarity } from './services/embeddingService';
import { db as firestore, auth, authReady, ensureAuth } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
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
  saveUserInsight: (insight: UserInsight) => Promise<void>;
  toggleInsightLike: (insightId: string, userId: string) => Promise<void>;
  fetchData: () => Promise<void>;
  addPresetInterest: (keyword: string, group: 'work' | 'hobby') => Promise<void>;
  deletePresetInterest: (id: string) => Promise<void>;
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

    const checkAllLoaded = (collectionName: string) => {
      loadedCollections.add(collectionName);
      if (loadedCollections.size === collectionsToLoad.length) {
        setIsDbLoaded(true);
      }
    };

    const setupListeners = () => {
      const handleError = (error: any, collectionName: string) => {
        console.error('Firestore listener error:', JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          code: error?.code,
          collection: collectionName,
        }));
        checkAllLoaded(collectionName);
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

      // CanonicalTerms
      unsubscribers.push(onSnapshot(collection(firestore, 'canonicalTerms'), (snap) => {
        setCanonicalTerms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CanonicalTerm)));
        checkAllLoaded('canonicalTerms');
      }, (error) => handleError(error, 'canonicalTerms')));

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
      await setDoc(doc(firestore, 'users', user.id), sanitize(user));
      setCurrentUser(user);
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
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
      await setDoc(doc(firestore, 'courses', course.id), sanitize(course));
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
      await setDoc(doc(firestore, 'courses', course.id), sanitize(course));
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
      await setDoc(doc(firestore, 'sessions', session.id), sanitize(data));
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
      await setDoc(doc(firestore, 'sessions', session.id), sanitize(session));
    } catch (error: any) {
      throw translateFirestoreError(error, `sessions/${session.id}`);
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
        await setDoc(doc(firestore, 'sessions', id), sanitize({ ...session, isActive: !session.isActive }));
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

    // 새 term — 세션 캐시에도 즉시 반영 (stale closure 방지)
    const newId = `ct_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
      if (!canonicalTerms.find(t => t.id === canonicalId)) {
        batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding, kind: 'insight' }));
      }
      batch.set(doc(firestore, 'userInsights', insight.id), sanitize({ ...insight, canonicalId, likes: insight.likes || [] }));
      await batch.commit();
    } catch (error: any) {
      // canonicalization 또는 batch 실패 시 canonicalId 없이 단순 저장으로 fallback
      try {
        await setDoc(doc(firestore, 'userInsights', insight.id), sanitize({ ...insight, likes: insight.likes || [] }));
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
      const insight = userInsights.find(i => i.id === insightId);
      if (insight) {
        const likes = insight.likes || [];
        const newLikes = likes.includes(userId) 
          ? likes.filter(id => id !== userId) 
          : [...likes, userId];
        await setDoc(doc(firestore, 'userInsights', insightId), sanitize({ ...insight, likes: newLikes }));
      }
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
      await deleteDoc(doc(firestore, 'sessions', id));
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
      for (const i of interestsToSave) {
        try {
          const { canonicalId, term, embedding } = await canonicalizeKeyword(i.keyword, 'interest');
          if (!canonicalTerms.find(t => t.id === canonicalId)) {
            batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding, kind: 'interest' }));
          }
          batch.set(doc(firestore, 'interests', i.id), sanitize({ ...i, canonicalId }));
        } catch {
          batch.set(doc(firestore, 'interests', i.id), sanitize(i));
        }
      }

      await batch.commit();
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
      for (const { i, res, ok } of canonicalized) {
        if (ok && res) {
          const { canonicalId, term, embedding } = res;
          try {
            if (!canonicalTerms.find(t => t.id === canonicalId)) {
              batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding, kind: 'interest' }));
            }
            batch.set(doc(firestore, 'interests', i.id), sanitize({ ...i, canonicalId }));
          } catch {
            batch.set(doc(firestore, 'interests', i.id), sanitize(i));
          }
        } else {
          batch.set(doc(firestore, 'interests', i.id), sanitize(i));
        }
      }

      await batch.commit();

      // onSnapshot 응답을 기다리지 않고 로컬 상태 즉시 갱신
      setInterests(prev => [
        ...prev.filter(i => i.userId !== user.id),
        ...newInterests,
      ]);

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
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, teaTimeRequests: [...prev.teaTimeRequests, req] }));
      return;
    }
    await ensureAuth();
    try {
      await setDoc(doc(firestore, 'teaTimeRequests', req.id), sanitize(req));
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
      const req = teaTimeRequests.find(r => r.id === id);
      if (req) {
        await setDoc(doc(firestore, 'teaTimeRequests', id), sanitize({ ...req, status, responseMessage }));
      }
    } catch (error: any) {
      throw translateFirestoreError(error, `teaTimeRequests/${id}`);
    }
  };

  const addPresetInterest = async (keyword: string, group: 'work' | 'hobby') => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, presetInterests: [...prev.presetInterests, { id: Date.now().toString(), keyword, group }] }));
      return;
    }
    await ensureAuth();
    try {
      const id = Date.now().toString();
      await setDoc(doc(firestore, 'presetInterests', id), sanitize({ id, keyword, group }));
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
      await deleteDoc(doc(firestore, 'presetInterests', id));
    } catch (error: any) {
      throw translateFirestoreError(error, `presetInterests/${id}`);
    }
  };

  return (
    <StoreContext.Provider value={{
      db, currentUser: effectiveCurrentUser, isDbLoaded, login, register, logout, addCourse, updateCourse, deleteCourse, resetCourseData,
      addSession, updateSession, deleteSession,
      saveInterests, updateUser, deleteUser, updateUserProfile, sendTeaTimeRequest, updateTeaTimeRequest,
      toggleSessionActive, saveUserInsight, toggleInsightLike, fetchData,
      addPresetInterest, deletePresetInterest,
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

