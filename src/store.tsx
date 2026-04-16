import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { getEmbedding, cosineSimilarity } from './services/embeddingService';
import { db as firestore, auth, authReady } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer, collection, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { generateMockData } from './utils/mockData';

// Firestore 에러 핸들링을 위한 인터페이스 및 함수 (Error handling for Firestore)
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // 에러를 다시 던져서 UI에서 잡을 수 있게 합니다.
  throw new Error(JSON.stringify(errInfo));
}

export interface Course {
  id: string;
  name: string;
  password?: string;
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
  location: string;
  courseId: string;
  profilePic?: string;
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
}

export interface PresetInterest {
  id: string;
  keyword: string;
}

export interface MissionGroup {
  id: string;         // `${courseId}_${type}`
  courseId: string;
  type: 'lunch' | 'evening';
  groups: string[][];  // array of groups, each group = array of userIds
  confirmedAt: string;
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
  missionGroups: MissionGroup[];
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
  missionGroups: []
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
  addPresetInterest: (keyword: string) => Promise<void>;
  deletePresetInterest: (id: string) => Promise<void>;
  saveMissionGroups: (group: MissionGroup) => Promise<void>;
  deleteMissionGroup: (groupId: string) => Promise<void>;
  isDemoMode: boolean;
  toggleDemoMode: (active: boolean, role?: 'user' | 'admin') => void;
  resetDemoData: () => void;
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
  const [presetInterests, setPresetInterests] = useState<PresetInterest[]>([]);
  const [missionGroups, setMissionGroups] = useState<MissionGroup[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

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
    missionGroups
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
      const usersSnap = await getDocs(collection(firestore, 'users'));
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));

      const coursesSnap = await getDocs(collection(firestore, 'courses'));
      setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));

      const sessionsSnap = await getDocs(collection(firestore, 'sessions'));
      setSessions(sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));

      const interestsSnap = await getDocs(collection(firestore, 'interests'));
      setInterests(interestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Interest)));

      const requestsSnap = await getDocs(collection(firestore, 'teaTimeRequests'));
      setTeaTimeRequests(requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeaTimeRequest)));

      const insightsSnap = await getDocs(collection(firestore, 'userInsights'));
      setUserInsights(insightsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserInsight)));

      const termsSnap = await getDocs(collection(firestore, 'canonicalTerms'));
      setCanonicalTerms(termsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CanonicalTerm)));

      const presetsSnap = await getDocs(collection(firestore, 'presetInterests'));
      setPresetInterests(presetsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PresetInterest)));

      const missionGroupsSnap = await getDocs(collection(firestore, 'missionGroups'));
      setMissionGroups(missionGroupsSnap.docs.map(doc => parseMissionGroup(doc.data(), doc.id)));
      
      console.log("Manual data fetch complete.");
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // 1단계: Firestore 실시간 리스너 설정 (Step 1: Setup Firestore real-time listeners for each collection)
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    const collectionsToLoad = ['users', 'courses', 'sessions', 'interests', 'teaTimeRequests', 'userInsights', 'canonicalTerms', 'presetInterests', 'missionGroups'];
    const loadedCollections = new Set<string>();

    const checkAllLoaded = (collectionName: string) => {
      loadedCollections.add(collectionName);
      if (loadedCollections.size === collectionsToLoad.length) {
        setIsDbLoaded(true);
      }
    };

    const setupListeners = () => {
      const handleError = (error: any, collectionName: string) => {
        try {
          handleFirestoreError(error, OperationType.LIST, collectionName);
        } catch (e) {
          // Ignore throw in background listener to allow checkAllLoaded to run
        }
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

      // MissionGroups (groups는 JSON 문자열 배열로 저장 → 역직렬화)
      unsubscribers.push(onSnapshot(collection(firestore, 'missionGroups'), (snap) => {
        setMissionGroups(snap.docs.map(doc => parseMissionGroup(doc.data(), doc.id)));
        checkAllLoaded('missionGroups');
      }, (error) => handleError(error, 'missionGroups')));
    };

    // 마이그레이션 및 초기화 로직 (Migration and Initialization)
    const initializeData = async () => {
      await authReady; // Firebase 익명 인증 완료 후 Firestore 접근
      try {
        const oldDocRef = doc(firestore, 'giveandtake', 'data');
        const oldSnap = await getDoc(oldDocRef);

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
          await batch.commit();
          console.log("Migration complete.");
        } else {
          // Check if collections are empty, if so, seed default courses
          const coursesSnap = await getDocs(collection(firestore, 'courses'));
          if (coursesSnap.empty) {
            console.log("Seeding default courses...");
            const batch = writeBatch(firestore);
            defaultDb.courses.forEach(c => batch.set(doc(firestore, 'courses', c.id), c));
            await batch.commit();
          }
        }
        
        setupListeners();
      } catch (error) {
        console.error("Initialization error:", error);
        setupListeners(); // Still setup listeners even if migration fails
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
      localStorage.setItem('currentUser', JSON.stringify(user));
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
    try {
      await setDoc(doc(firestore, 'users', user.id), sanitize(user));
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
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
    try {
      await setDoc(doc(firestore, 'courses', course.id), sanitize(course));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `courses/${course.id}`);
    }
  };

  const updateCourse = async (course: Course) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, courses: prev.courses.map(c => c.id === course.id ? course : c) }));
      return;
    }
    try {
      await setDoc(doc(firestore, 'courses', course.id), sanitize(course));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `courses/${course.id}`);
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
      handleFirestoreError(error, OperationType.DELETE, `courses/${id}`);
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
    } catch (error) {
      console.error("Error resetting course data:", error);
      handleFirestoreError(error, OperationType.DELETE, `courseData/${courseId}`);
    }
  };

  const addSession = async (session: Session) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, sessions: [...prev.sessions, session] }));
      return;
    }
    try {
      const data = { ...session, isActive: session.isActive ?? true };
      await setDoc(doc(firestore, 'sessions', session.id), sanitize(data));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${session.id}`);
    }
  };

  const updateSession = async (session: Session) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, sessions: prev.sessions.map(s => s.id === session.id ? session : s) }));
      return;
    }
    try {
      await setDoc(doc(firestore, 'sessions', session.id), sanitize(session));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${session.id}`);
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
    try {
      const session = sessions.find(s => s.id === id);
      if (session) {
        await setDoc(doc(firestore, 'sessions', id), sanitize({ ...session, isActive: !session.isActive }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${id}`);
    }
  };

  const canonicalizeKeyword = async (keyword: string) => {
    const normalized = keyword.replace(/\s+/g, '').toLowerCase();
    
    // 1. Check for exact match after normalization in existing canonical terms
    let bestMatch = null;
    let maxSimilarity = -1;

    for (const ct of canonicalTerms) {
      const ctNormalized = ct.term.replace(/\s+/g, '').toLowerCase();
      if (ctNormalized === normalized) {
        return { canonicalId: ct.id, term: ct.term };
      }
      
      if (ct.embedding) {
        // We'll calculate similarity later if no exact normalized match is found
      }
    }

    // 2. If no exact normalized match, use embedding similarity
    const embedding = await getEmbedding(keyword);
    if (!embedding) return { canonicalId: keyword, term: keyword };

    for (const ct of canonicalTerms) {
      if (ct.embedding) {
        const sim = cosineSimilarity(embedding, ct.embedding);
        if (sim > maxSimilarity) {
          maxSimilarity = sim;
          bestMatch = ct;
        }
      }
    }

    // Similarity threshold: 0.85
    if (bestMatch && maxSimilarity > 0.85) {
      return { canonicalId: bestMatch.id, term: bestMatch.term };
    } else {
      const newId = Date.now().toString();
      return { canonicalId: newId, term: keyword, embedding };
    }
  };

  const saveUserInsight = async (insight: UserInsight) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, userInsights: [...prev.userInsights, insight] }));
      return;
    }
    try {
      const { canonicalId, term, embedding } = await canonicalizeKeyword(insight.keyword);
      
      const batch = writeBatch(firestore);
      
      // Update canonical terms if new
      if (!canonicalTerms.find(t => t.id === canonicalId)) {
        batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding }));
      }

      const data = { ...insight, canonicalId, likes: insight.likes || [] };
      batch.set(doc(firestore, 'userInsights', insight.id), sanitize(data));
      
      await batch.commit();
    } catch (error) {
      console.error("Error saving insight:", error);
      await setDoc(doc(firestore, 'userInsights', insight.id), sanitize({ ...insight, likes: insight.likes || [] }));
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
    try {
      const insight = userInsights.find(i => i.id === insightId);
      if (insight) {
        const likes = insight.likes || [];
        const newLikes = likes.includes(userId) 
          ? likes.filter(id => id !== userId) 
          : [...likes, userId];
        await setDoc(doc(firestore, 'userInsights', insightId), sanitize({ ...insight, likes: newLikes }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `userInsights/${insightId}`);
    }
  };

  const deleteSession = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, sessions: prev.sessions.filter(s => s.id !== id) }));
      return;
    }
    try {
      await deleteDoc(doc(firestore, 'sessions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sessions/${id}`);
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
    try {
      const batch = writeBatch(firestore);
      
      // 1. Delete old interests for this user
      if (currentUser) {
        const oldInterests = interests.filter(i => i.userId === currentUser.id);
        oldInterests.forEach(i => batch.delete(doc(firestore, 'interests', i.id)));
      }

      // 2. Canonicalize and add new interests
      for (const i of interestsToSave) {
        const { canonicalId, term, embedding } = await canonicalizeKeyword(i.keyword);
        
        if (!canonicalTerms.find(t => t.id === canonicalId)) {
          batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding }));
        }
        
        batch.set(doc(firestore, 'interests', i.id), sanitize({ ...i, canonicalId }));
      }

      await batch.commit();
    } catch (error) {
      console.error("Error saving interests:", error);
      const batch = writeBatch(firestore);
      interestsToSave.forEach(i => batch.set(doc(firestore, 'interests', i.id), sanitize(i)));
      await batch.commit();
    }
  };

  const updateUser = async (user: User) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, users: prev.users.map(u => u.id === user.id ? user : u) }));
      if (demoUser?.id === user.id) setDemoUser(user);
      return;
    }
    try {
      await setDoc(doc(firestore, 'users', user.id), sanitize(user));
      if (currentUser?.id === user.id) {
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
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
    try {
      const batch = writeBatch(firestore);
      
      // 1. Update User
      batch.set(doc(firestore, 'users', user.id), sanitize(user));

      // 2. Handle Interests
      // Delete old
      const oldInterests = interests.filter(i => i.userId === user.id);
      oldInterests.forEach(i => batch.delete(doc(firestore, 'interests', i.id)));

      // Add new with canonicalization
      for (const i of newInterests) {
        const { canonicalId, term, embedding } = await canonicalizeKeyword(i.keyword);
        if (!canonicalTerms.find(t => t.id === canonicalId)) {
          batch.set(doc(firestore, 'canonicalTerms', canonicalId), sanitize({ id: canonicalId, term, embedding }));
        }
        batch.set(doc(firestore, 'interests', i.id), sanitize({ ...i, canonicalId }));
      }

      await batch.commit();
      
      if (currentUser?.id === user.id) {
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
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
    try {
      const batch = writeBatch(firestore);
      
      // Delete User
      batch.delete(doc(firestore, 'users', id));
      
      // Delete related data
      interests.filter(i => i.userId === id).forEach(i => batch.delete(doc(firestore, 'interests', i.id)));
      userInsights.filter(i => i.userId === id).forEach(i => batch.delete(doc(firestore, 'userInsights', i.id)));
      teaTimeRequests.filter(r => r.fromUserId === id || r.toUserId === id).forEach(r => batch.delete(doc(firestore, 'teaTimeRequests', r.id)));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const sendTeaTimeRequest = async (req: TeaTimeRequest) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, teaTimeRequests: [...prev.teaTimeRequests, req] }));
      return;
    }
    try {
      await setDoc(doc(firestore, 'teaTimeRequests', req.id), sanitize(req));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `teaTimeRequests/${req.id}`);
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
    try {
      const req = teaTimeRequests.find(r => r.id === id);
      if (req) {
        await setDoc(doc(firestore, 'teaTimeRequests', id), sanitize({ ...req, status, responseMessage }));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teaTimeRequests/${id}`);
    }
  };

  const addPresetInterest = async (keyword: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, presetInterests: [...prev.presetInterests, { id: Date.now().toString(), keyword }] }));
      return;
    }
    try {
      const id = Date.now().toString();
      await setDoc(doc(firestore, 'presetInterests', id), sanitize({ id, keyword }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `presetInterests/${keyword}`);
    }
  };

  const deletePresetInterest = async (id: string) => {
    if (isDemoMode) {
      setDemoDb(prev => ({ ...prev, presetInterests: prev.presetInterests.filter(p => p.id !== id) }));
      return;
    }
    try {
      await deleteDoc(doc(firestore, 'presetInterests', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `presetInterests/${id}`);
    }
  };

  // Firestore는 중첩 배열(string[][])을 지원하지 않으므로,
  // groups의 각 요소를 JSON 문자열로 직렬화하여 저장하고 읽을 때 역직렬화한다.
  const parseMissionGroup = (data: any, id: string): MissionGroup => ({
    ...data,
    id,
    groups: (data.groups || []).map((g: any) => {
      if (typeof g === 'string') {
        try { return JSON.parse(g) as string[]; } catch { return [] as string[]; }
      }
      return (Array.isArray(g) ? g : []) as string[];
    }),
  });

  const deleteMissionGroup = async (groupId: string) => {
    try {
      await deleteDoc(doc(firestore, 'missionGroups', groupId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `missionGroups/${groupId}`);
      throw error;
    }
  };

  const saveMissionGroups = async (group: MissionGroup) => {
    try {
      // 중첩 배열 → 각 그룹을 JSON 문자열로 직렬화
      const firestoreData = {
        ...group,
        groups: group.groups.map(g => JSON.stringify(g)),
      };
      await setDoc(doc(firestore, 'missionGroups', group.id), sanitize(firestoreData));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `missionGroups/${group.id}`);
      throw error; // 호출자(handleConfirmMatch)가 에러를 인지할 수 있도록 re-throw
    }
  };

  return (
    <StoreContext.Provider value={{
      db, currentUser: effectiveCurrentUser, isDbLoaded, login, register, logout, addCourse, updateCourse, deleteCourse, resetCourseData,
      addSession, updateSession, deleteSession,
      saveInterests, updateUser, deleteUser, updateUserProfile, sendTeaTimeRequest, updateTeaTimeRequest,
      toggleSessionActive, saveUserInsight, toggleInsightLike, fetchData,
      addPresetInterest, deletePresetInterest, saveMissionGroups, deleteMissionGroup,
      isDemoMode, toggleDemoMode, resetDemoData
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

