import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

// Firebase 앱 초기화 (Initialize Firebase)
const app = initializeApp(firebaseConfig);

// Firestore 데이터베이스 인스턴스 생성 (Initialize Firestore)
// firebase-applet-config.json에 정의된 firestoreDatabaseId가 있으면 사용하고, 없으면 기본값을 사용합니다.
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');

// Firebase 인증 서비스 생성 (Initialize Firebase Auth)
export const auth = getAuth(app);

// Google 인증 프로바이더 설정 (Google Auth Provider)
export const googleProvider = new GoogleAuthProvider();

// Analytics 초기화 (Initialize Analytics - Browser only)
export const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);
