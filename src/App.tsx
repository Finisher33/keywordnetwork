import { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import MainView from './components/MainView';
import AdminView from './components/AdminView';
import MyProfile from './components/MyProfile';
import QuickSurvey from './components/QuickSurvey';
import AppView, { AppTab } from './components/AppView';
import LandingPageView from './components/LandingPageView';
import InsightView from './components/InsightView';

export default function App() {
  const { currentUser, db, logout, isDbLoaded, networkError, clearNetworkError } = useStore();
  const [view, setView] = useState<'main' | 'admin'>('main');
  const [subView, setSubView] = useState<'landing' | 'app' | 'insight' | 'profile' | 'survey'>('landing');
  const [lastSubView, setLastSubView] = useState<'landing' | 'app' | 'insight'>('landing');
  const [appViewTab, setAppViewTab] = useState<AppTab>('network');
  // 최초 등록 완료 플래그 — db.interests 비동기 전파와 무관하게 즉시 라우팅 전환을 보장
  const [registrationDone, setRegistrationDone] = useState(false);
  // 최초 등록 진행 중 플래그 — effect 기반 네비게이션 안전망에서 사용
  const awaitingFirstNavRef = useRef(false);

  // 안전망: handleSave 의 onSave() 콜백이 어떤 이유로든 실행되지 않더라도
  // db.interests(onSnapshot)이 currentUser 의 interest를 수신하면 자동 네비게이션.
  // PC / 두 번째 유저 전환 시 callback 체인이 끊기는 에지케이스를 effect로 커버.
  useEffect(() => {
    if (!currentUser) return;
    const hasInterestsInDb = db.interests.some(i => i.userId === currentUser.id);
    if (!hasInterestsInDb) return;
    if (subView === 'profile') return; // 명시적 편집 모드는 유지

    // registrationDone 이 아직 false 면 callback 이 실행 안 된 것 — 강제로 동기화
    if (!registrationDone) {
      setRegistrationDone(true);
      // 최초 등록 대기 상태였다면 survey 우선, 아니면 landing
      const surveyAlreadyDone = !!(
        currentUser.surveyCompleted ||
        (typeof currentUser.golfScore === 'number' &&
         typeof currentUser.careerYears === 'number')
      );
      if (awaitingFirstNavRef.current && !surveyAlreadyDone) {
        setSubView('survey');
      } else if (subView !== 'survey' && subView !== 'app' && subView !== 'insight') {
        setSubView('landing');
      }
      awaitingFirstNavRef.current = false;
    }
  }, [db.interests, currentUser, subView, registrationDone]);

  const handleNotificationClick = () => {
    setSubView('app');
    setAppViewTab('mission');
  };

  const handleLogout = () => {
    logout();
    setView('main');
    setSubView('landing');
    setLastSubView('landing');
    setRegistrationDone(false);
  };

  const goToSurvey = () => setSubView('survey');

  const goToProfile = () => {
    setLastSubView(subView as any);
    setSubView('profile');
  };

  // 데이터 로딩 중일 때 표시할 로딩 화면
  if (!isDbLoaded) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-primary font-bold animate-pulse">데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  const renderContent = () => {
    if (view === 'admin') {
      return <AdminView onBack={() => setView('main')} onLogout={handleLogout} />;
    }

    if (!currentUser) {
      return <MainView onAdminClick={() => setView('admin')} />;
    }

    const hasInterests = registrationDone || db.interests.some(i => i.userId === currentUser.id);
    const surveyAlreadyDone = !!(
      currentUser.surveyCompleted ||
      (typeof currentUser.golfScore === 'number' &&
       typeof currentUser.careerYears === 'number')
    );

    // 최초 정보등록 기록이 없거나, 프로필 수정 모드인 경우
    if (!hasInterests || subView === 'profile') {
      const isFirstRegistration = !hasInterests;
      // effect 안전망에게 "지금 최초 등록 플로우다"를 알림
      if (isFirstRegistration) awaitingFirstNavRef.current = true;
      return (
        <MyProfile
          onSave={() => {
            setRegistrationDone(true);
            if (isFirstRegistration && !surveyAlreadyDone) {
              goToSurvey();
            } else {
              setSubView(lastSubView);
            }
            awaitingFirstNavRef.current = false;
          }}
          onLogout={handleLogout}
          showBack={hasInterests}
        />
      );
    }

    // ─── 서베이 게이트: 키워드 서베이 미완료 시 어떤 메인뷰로도 진입 차단 ───
    // 신규 가입자뿐 아니라 과거에 surveyCompleted=false 로 남아있는 유저도 모두 강제.
    // 응답하지 않으면 onComplete 가 호출되지 않아 자연스럽게 다음 페이지로 갈 수 없음.
    if (!surveyAlreadyDone) {
      return (
        <QuickSurvey
          onComplete={() => {
            awaitingFirstNavRef.current = false;
            setSubView('landing');
          }}
          onLogout={handleLogout}
        />
      );
    }

    // 안전 fallback: subView 가 'survey' 인데 이미 완료한 경우 landing 으로 간주.
    const effectiveSub = subView === 'survey' ? 'landing' : subView;

    // 정보등록 이력이 있고 서베이도 완료된 경우 — 메인뷰(LandingPage)
    if (effectiveSub === 'landing') {
      return (
        <LandingPageView
          onSelect={(v) => { if (v === 'app') setAppViewTab('network'); setSubView(v); }}
          onLogout={handleLogout}
          onProfileClick={goToProfile}
          onNotificationClick={handleNotificationClick}
        />
      );
    }

    if (effectiveSub === 'insight') {
      return (
        <InsightView 
          onBack={() => setSubView('landing')} 
          onLogout={handleLogout}
          onProfileClick={goToProfile}
          onNotificationClick={handleNotificationClick}
        />
      );
    }

    return (
      <AppView 
        onBack={() => setSubView('landing')} 
        onLogout={handleLogout}
        onProfileClick={goToProfile}
        initialTab={appViewTab}
        onTabChange={setAppViewTab}
        onNotificationClick={handleNotificationClick}
      />
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background overflow-hidden">
      {networkError && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 bg-red-600 px-4 py-3 text-sm text-white shadow-md">
          <span>⚠ {networkError}</span>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="underline underline-offset-2 hover:no-underline"
            >
              새로고침
            </button>
            <button onClick={clearNetworkError} className="opacity-70 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  );
}
