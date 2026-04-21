import { useState } from 'react';
import { useStore } from './store';
import MainView from './components/MainView';
import AdminView from './components/AdminView';
import MyProfile from './components/MyProfile';
import AppView, { AppTab } from './components/AppView';
import LandingPageView from './components/LandingPageView';
import InsightView from './components/InsightView';

export default function App() {
  const { currentUser, db, logout, isDbLoaded, networkError, clearNetworkError } = useStore();
  const [view, setView] = useState<'main' | 'admin'>('main');
  const [subView, setSubView] = useState<'landing' | 'app' | 'insight' | 'profile'>('landing');
  const [lastSubView, setLastSubView] = useState<'landing' | 'app' | 'insight'>('landing');
  const [appViewTab, setAppViewTab] = useState<AppTab>('network');
  // 최초 등록 완료 플래그 — db.interests 비동기 전파와 무관하게 즉시 라우팅 전환을 보장
  const [registrationDone, setRegistrationDone] = useState(false);

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

    // 최초 정보등록 기록이 없거나, 프로필 수정 모드인 경우
    if (!hasInterests || subView === 'profile') {
      return (
        <MyProfile
          onSave={() => {
            setRegistrationDone(true);
            setSubView(lastSubView);
          }}
          onLogout={handleLogout}
          showBack={hasInterests}
        />
      );
    }

    // 정보등록 이력이 있는 경우 선택 페이지로 이동
    if (subView === 'landing') {
      return (
        <LandingPageView
          onSelect={(v) => { if (v === 'app') setAppViewTab('network'); setSubView(v); }}
          onLogout={handleLogout}
          onProfileClick={goToProfile}
          onNotificationClick={handleNotificationClick}
        />
      );
    }

    if (subView === 'insight') {
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
