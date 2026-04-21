import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

// Firestore 규칙의 isAuthenticated() 조건을 충족하기 위해 익명 로그인 수행
// 앱 사용자 인증(이름/회사 기반)과는 별개로 Firestore 접근 권한 확보용
export const authReady = new Promise<void>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsubscribe();
      resolve();
    }
  });
  signInAnonymously(auth).catch((err) => {
    console.error('익명 인증 실패:', err);
    resolve(); // 실패해도 앱은 계속 동작
  });
});

// 모든 Firestore write 전 호출 — 인증 완료 보장 및 실패 시 재시도
export const ensureAuth = async (): Promise<void> => {
  await authReady;
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error('익명 인증 재시도 실패:', err);
      throw new Error('AUTH_FAILED');
    }
  }
};
