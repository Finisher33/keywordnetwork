import { useState } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store';
import NetworkMap from './NetworkMap';
import MyNetwork from './MyNetwork';
import NotificationBell from './NotificationBell';

export default function AppView({ 
  onBack, 
  onLogout, 
  onProfileClick, 
  initialTab = 'map', 
  onTabChange,
  onNotificationClick 
}: { 
  onBack: () => void, 
  onLogout: () => void, 
  onProfileClick: () => void,
  initialTab?: 'map' | 'network',
  onTabChange?: (tab: 'map' | 'network') => void,
  onNotificationClick?: () => void
}) {
  const { currentUser } = useStore();
  const activeTab = initialTab;
  const setActiveTab = onTabChange || (() => {});

  return (
    <div className="h-[100dvh] bg-background text-on-surface flex flex-col overflow-hidden">
      {/* Top Nav */}
      <header className="bg-white border-b border-outline flex justify-between items-center px-4 h-12 shadow-sm shrink-0 z-[100]">
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
                <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 relative ${activeTab === 'network' ? 'overflow-y-auto' : 'overflow-hidden'} bg-surface-container-lowest/30`}>
        {activeTab === 'map' && <NetworkMap />}
        {activeTab === 'network' && <MyNetwork />}
      </main>

      {/* Bottom Nav */}
      <nav className="z-50 flex justify-around items-center h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-4 bg-white/95 backdrop-blur-2xl border-t border-outline shadow-xl shrink-0">
        <button 
          onClick={() => setActiveTab('map')}
          className={`flex items-center justify-center gap-2 transition-all active:scale-95 px-4 py-2 rounded-full ${activeTab === 'map' ? 'text-primary bg-primary/10' : 'text-on-surface-variant/40 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: activeTab === 'map' ? "'FILL' 1" : "'FILL' 0" }}>hub</span>
          <span className="font-label text-[10px] uppercase tracking-widest font-black">Map</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('network')}
          className={`flex items-center justify-center gap-2 transition-all active:scale-95 px-4 py-2 rounded-full ${activeTab === 'network' ? 'text-primary bg-primary/10' : 'text-on-surface-variant/40 hover:text-primary'}`}
        >
          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: activeTab === 'network' ? "'FILL' 1" : "'FILL' 0" }}>diversity_2</span>
          <span className="font-label text-[10px] uppercase tracking-widest font-black">Network</span>
        </button>
      </nav>
    </div>
  );
}
