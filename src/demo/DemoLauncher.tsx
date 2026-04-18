import { useStore } from '../store';

interface Props {
  onAdminClick: () => void;
}

export default function DemoLauncher({ onAdminClick }: Props) {
  const { toggleDemoMode } = useStore();

  const handleUserDemo = () => {
    toggleDemoMode(true, 'user');
  };

  const handleAdminDemo = () => {
    toggleDemoMode(true, 'admin');
    onAdminClick();
  };

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'rgba(8,28,65,0.55)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-sm" style={{ color: '#7dc8ff' }}>science</span>
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/50">Demo</span>
      </div>
      <p className="text-center text-[10px] text-white/35 leading-relaxed">
        가입 없이 앱을 체험해 보세요<br />
        <span className="text-white/25">30명이 참여한 실제 데이터로 구성됩니다</span>
      </p>

      {/* 버튼 */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={handleUserDemo}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl transition-all active:scale-95"
          style={{
            background: 'rgba(77,166,255,0.12)',
            border: '1px solid rgba(77,166,255,0.28)',
            color: '#7dc8ff',
          }}
        >
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-[10px] font-black uppercase tracking-widest">유저 모드</span>
          <span className="text-[8px] text-white/30 font-medium">일반 참가자 체험</span>
        </button>

        <button
          onClick={handleAdminDemo}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl transition-all active:scale-95"
          style={{
            background: 'rgba(0,200,224,0.1)',
            border: '1px solid rgba(0,200,224,0.28)',
            color: '#00c8e0',
          }}
        >
          <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
          <span className="text-[10px] font-black uppercase tracking-widest">어드민 모드</span>
          <span className="text-[8px] text-white/30 font-medium">관리자 화면 체험</span>
        </button>
      </div>
    </div>
  );
}
