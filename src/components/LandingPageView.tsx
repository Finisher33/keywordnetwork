import { useStore } from '../store';
import { motion } from 'motion/react';
import NotificationBell from './NotificationBell';

interface LandingPageViewProps {
  onSelect: (view: 'app' | 'insight') => void;
  onLogout: () => void;
  onProfileClick: () => void;
  onNotificationClick?: () => void;
}

export default function LandingPageView({ onSelect, onLogout, onProfileClick, onNotificationClick }: LandingPageViewProps) {
  const { currentUser } = useStore();

  return (
    <div className="h-full bg-background text-on-surface flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 bg-white/80 backdrop-blur-md border-b border-outline flex justify-end items-center px-4 z-50 shadow-sm shrink-0">
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 scrollbar-hide">
        <div className="min-h-full flex flex-col">
          <div className="my-auto w-full flex flex-col items-center py-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12 space-y-4 w-full px-4"
            >
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
            <span className="material-symbols-outlined text-primary text-3xl">hub</span>
          </div>
        </div>
        <h1 className="text-[clamp(1.5rem,8vw,5rem)] font-headline font-black tracking-tighter text-on-surface leading-none mb-2 break-keep w-full">
          be Giver be Taker
        </h1>
        <div className="text-primary font-bold text-sm md:text-base tracking-wide">
          Welcome, {currentUser?.name} 리더님
        </div>
        <p className="text-on-surface-variant text-xs md:text-sm max-w-xs mx-auto leading-relaxed font-medium break-keep">
          원하시는 메뉴를 선택하여 <br className="block md:hidden" />네트워크를 확장하고 <br className="block md:hidden" />새로운 인사이트를 발견해보세요.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 w-full max-w-md">
        <motion.button
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('app')}
          className="group relative overflow-hidden bg-white border border-outline rounded-2xl p-5 text-left shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="absolute -top-2 -right-2 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-6xl text-primary">account_tree</span>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">hub</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-headline font-black text-on-surface uppercase tracking-tight leading-tight">키워드 네트워크</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium line-clamp-1">나와 비슷한 관심사를 가진 리더 찾기</p>
              <div className="flex items-center gap-1.5 text-primary font-black text-[9px] uppercase tracking-widest mt-1.5">
                Explore <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </div>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect('insight')}
          className="group relative overflow-hidden bg-white border border-outline rounded-2xl p-5 text-left shadow-sm hover:shadow-md hover:border-secondary/30 transition-all"
        >
          <div className="absolute -top-2 -right-2 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="material-symbols-outlined text-6xl text-secondary">lightbulb</span>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/5 flex items-center justify-center border border-secondary/10 shrink-0">
              <span className="material-symbols-outlined text-secondary text-2xl">psychology</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-headline font-black text-on-surface uppercase tracking-tight leading-tight">학습 인사이트 키워드</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium line-clamp-1">최신 학습 트렌드와 인사이트 탐색</p>
              <div className="flex items-center gap-1.5 text-secondary font-black text-[9px] uppercase tracking-widest mt-1.5">
                Explore <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
              </div>
            </div>
          </div>
        </motion.button>
      </div>
          </div>
        </div>
      </main>
    </div>
  );
}
