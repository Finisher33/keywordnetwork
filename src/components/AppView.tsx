import { useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store';
import NetworkMap from './NetworkMap';
import PeopleMap from './PeopleMap';
import MyNetwork from './MyNetwork';
import LibraryView from './LibraryView';
import MissionView from './MissionView';
import NotificationBell from './NotificationBell';

export type AppTab = 'network' | 'map' | 'peoplemap' | 'library' | 'mission';

export default function AppView({
  onBack,
  onLogout,
  onProfileClick,
  initialTab = 'network',
  onTabChange,
  onNotificationClick,
}: {
  onBack: () => void;
  onLogout: () => void;
  onProfileClick: () => void;
  initialTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  onNotificationClick?: () => void;
}) {
  const { currentUser } = useStore();
  const activeTab = initialTab;
  const setActiveTab = onTabChange || (() => {});

  const tabs: { id: AppTab; icon: string; label: string }[] = [
    { id: 'network',   icon: 'diversity_2',  label: 'My Network'  },
    { id: 'map',       icon: 'hub',          label: 'Network Map' },
    { id: 'peoplemap', icon: 'group',        label: 'People Map'  },
    { id: 'library',   icon: 'auto_stories', label: 'Library'     },
    { id: 'mission',   icon: 'coffee',       label: 'Tea Time'    },
  ];

  const scrollable = activeTab === 'network' || activeTab === 'library' || activeTab === 'mission';

  return (
    <div className="absolute inset-0 bg-background text-on-surface flex flex-col overflow-hidden" style={{ colorScheme: 'light' }}>
      {/* Top Nav */}
      <header className="header-safe bg-white border-b border-outline shadow-sm shrink-0 z-[100]">
        <div className="h-12 flex justify-between items-center px-4">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant text-xl">arrow_back</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell onNotificationClick={onNotificationClick} />
            <button
              onClick={onProfileClick}
              className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-highest flex items-center justify-center hover:scale-105 transition-transform"
              title="내 프로필"
            >
              {currentUser?.profilePic ? (
                currentUser.profilePic.length < 5 ? (
                  <span className="text-sm">{currentUser.profilePic}</span>
                ) : (
                  <img loading="lazy" decoding="async" src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )
              ) : (
                <span className="material-symbols-outlined text-xl text-primary/40">face</span>
              )}
            </button>
            <div className="w-px h-3 bg-outline/30 mx-1" />
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
              title="로그아웃"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 relative ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'} bg-surface-container-lowest/30`}>
        {activeTab === 'network'   && <MyNetwork />}
        {activeTab === 'map'       && <NetworkMap />}
        {activeTab === 'peoplemap' && <PeopleMap />}
        {activeTab === 'library'   && <LibraryView />}
        {activeTab === 'mission'   && <MissionView onNavigateToLibrary={() => setActiveTab('library')} onNavigateToNetwork={() => setActiveTab('network')} />}
      </main>

      {/* Bottom Nav */}
      <nav className="z-50 flex justify-around items-center h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-1 bg-white/95 backdrop-blur-2xl border-t border-outline shadow-xl shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 flex-1 py-2 rounded-xl ${
              activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant/40 hover:text-primary'
            }`}
          >
            <span
              className="material-symbols-outlined text-[24px]"
              style={{ fontVariationSettings: activeTab === tab.id ? "'FILL' 1" : "'FILL' 0" }}
            >
              {tab.icon}
            </span>
            <span className={`font-label text-[9px] uppercase tracking-wide font-black leading-none ${activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant/40'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
