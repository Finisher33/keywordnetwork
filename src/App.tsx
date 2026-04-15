import { useState } from 'react';
import { useStore } from './store';
import MainView from './components/MainView';
import AdminView from './components/AdminView';
import MyProfile from './components/MyProfile';
import AppView from './components/AppView';
import LandingPageView from './components/LandingPageView';
import InsightView from './components/InsightView';

export default function App() {
  const { currentUser, db, logout, isDbLoaded } = useStore();
  const [view, setView] = useState<'main' | 'admin'>('main');
  const [subView, setSubView] = useState<'landing' | 'app' | 'insight' | 'profile'>('landing');
  const [lastSubView, setLastSubView] = useState<'landing' | 'app' | 'insight'>('landing');
  const [appViewTab, setAppViewTab] = useState<'map' | 'network'>('map');

  const handleNotificationClick = () => {
    setSubView('app');
    setAppViewTab('network');
  };

  const handleLogout = () => {
    logout();
    setView('main');
    setSubView('landing');
    setLastSubView('landing');
  };

  const goToProfile = () => {
    setLastSubView(subView as any);
    setSubView('profile');
  };

  // 데이터 로딩 중일 때 표시할 로딩 화면
  if (!isDbLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
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

    const hasInterests = db.interests.some(i => i.userId === currentUser.id);

    // 최초 정보등록 기록이 없거나, 프로필 수정 모드인 경우
    if (!hasInterests || subView === 'profile') {
      return (
        <MyProfile 
          onSave={() => setSubView(lastSubView)} 
          onLogout={handleLogout}
          showBack={hasInterests}
        />
      );
    }

    // 정보등록 이력이 있는 경우 선택 페이지로 이동
    if (subView === 'landing') {
      return (
        <LandingPageView 
          onSelect={setSubView} 
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
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      {renderContent()}
    </div>
  );
}
