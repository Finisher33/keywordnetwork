import { useStore } from '../store';
import { motion } from 'motion/react';
import NotificationBell from './NotificationBell';
import { useEffect, useRef } from 'react';

// ── 3D 네트워크 캔버스 배경 ───────────────────────────────────────────────────
function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const N = 55;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random(),
      vx: (Math.random() - 0.5) * 0.00022,
      vy: (Math.random() - 0.5) * 0.00022,
      vz: (Math.random() - 0.5) * 0.0005,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.z += n.vz; n.pulse += 0.018;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
        if (n.z < 0 || n.z > 1) n.vz *= -1;
      });

      const px = nodes.map(n => ({ sx: n.x * W, sy: n.y * H, z: n.z, pulse: n.pulse }));
      const sorted = [...px].sort((a, b) => a.z - b.z);

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i], b = sorted[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxD = Math.min(W, H) * 0.28;
          if (dist < maxD) {
            const alpha = (1 - dist / maxD) * ((a.z + b.z) / 2) * 0.4;
            ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
            ctx.strokeStyle = `rgba(180,215,255,${alpha.toFixed(3)})`;
            ctx.lineWidth = (a.z + b.z) / 2 * 1.2; ctx.stroke();
          }
        }
      }

      sorted.forEach(n => {
        const r = 1.5 + n.z * 5;
        const glow = r * (1 + 0.18 * Math.sin(n.pulse));
        if (n.z > 0.45) {
          const grad = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, glow * 4.5);
          grad.addColorStop(0, `rgba(120,190,255,${((n.z - 0.45) * 0.35).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(120,190,255,0)');
          ctx.beginPath(); ctx.arc(n.sx, n.sy, glow * 4.5, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.sx, n.sy, glow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,230,255,${(0.25 + n.z * 0.75).toFixed(3)})`; ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-90" />;
}

interface LandingPageViewProps {
  onSelect: (view: 'app' | 'insight') => void;
  onLogout: () => void;
  onProfileClick: () => void;
  onNotificationClick?: () => void;
}

export default function LandingPageView({ onSelect, onLogout, onProfileClick, onNotificationClick }: LandingPageViewProps) {
  const { currentUser } = useStore();

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0f3460 0%, #1a5290 40%, #0e2d56 100%)' }}>

      {/* 배경 캔버스 */}
      <div className="absolute inset-0"><NetworkCanvas /></div>

      {/* 광원 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #4da6ff 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00c8e0 0%, transparent 70%)' }} />
      </div>

      {/* 상단 바 */}
      <header className="header-safe shrink-0 z-50 border-b border-white/15"
        style={{ background: 'rgba(10,35,75,0.55)', backdropFilter: 'blur(20px)' }}>
        <div className="h-12 flex justify-between items-center px-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(77,166,255,0.35)', border: '1px solid rgba(77,166,255,0.6)' }}>
              <span className="material-symbols-outlined text-base" style={{ color: '#7dc8ff' }}>hub</span>
            </div>
            <span className="text-[11px] font-black tracking-[0.15em] uppercase text-white/70 whitespace-nowrap">KEYWORD NETWORKING</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="[&_button]:text-white/70 [&_button:hover]:text-white [&_button:hover]:bg-white/10">
              <NotificationBell onNotificationClick={onNotificationClick} />
            </div>
            <button onClick={onProfileClick}
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center hover:scale-105 transition-transform"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
              title="내 프로필">
              {currentUser?.profilePic ? (
                currentUser.profilePic.length < 5
                  ? <span className="text-base">{currentUser.profilePic}</span>
                  : <img src={currentUser.profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="material-symbols-outlined text-2xl text-white/50">face</span>
              )}
            </button>
            <div className="w-px h-3 mx-1" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <button onClick={onLogout}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-white/55 hover:text-red-300 hover:bg-red-500/10"
              title="로그아웃">
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto relative z-10 scrollbar-hide">
        <div className="min-h-full flex flex-col items-center justify-center px-5 sm:px-8 py-10">

          {/* 헤드라인 */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="text-center mb-8 sm:mb-10 space-y-3 w-full max-w-lg">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(77,166,255,0.3), rgba(0,160,220,0.2))', border: '1px solid rgba(77,166,255,0.5)', boxShadow: '0 0 40px rgba(77,166,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
                <span className="material-symbols-outlined text-4xl sm:text-5xl" style={{ color: '#7dc8ff' }}>hub</span>
              </div>
            </div>
            <h1 className="font-headline font-black tracking-tight leading-none text-white whitespace-nowrap"
              style={{ fontSize: 'clamp(1.6rem,7vw,3.4rem)', textShadow: '0 2px 30px rgba(77,166,255,0.4)' }}>
              <span style={{ color: '#7dc8ff' }}>Keyword</span> Networking
            </h1>
            <div className="inline-block px-3 py-1 rounded-full text-sm font-bold"
              style={{ background: 'rgba(77,166,255,0.2)', border: '1px solid rgba(77,166,255,0.4)', color: '#a8d8ff' }}>
              Welcome, {currentUser?.name} 리더님
            </div>
          </motion.div>

          {/* 메뉴 카드 */}
          <div className="flex flex-col gap-3 w-full max-w-sm sm:max-w-md">

            {/* 키워드 네트워크 */}
            <motion.button
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect('app')}
              className="group relative overflow-hidden rounded-xl flex items-center gap-4 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                style={{ background: 'linear-gradient(90deg, rgba(77,166,255,0.18), transparent)' }} />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative z-10"
                style={{ background: 'linear-gradient(135deg, rgba(77,166,255,0.45), rgba(0,140,220,0.3))', border: '1px solid rgba(77,166,255,0.5)', boxShadow: '0 0 18px rgba(77,166,255,0.25)' }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: '#a8d8ff' }}>hub</span>
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-base font-black uppercase tracking-tight text-white leading-none mb-0.5">키워드 네트워크</p>
                <p className="text-xs text-white/55 font-medium">관심사로 연결되는 HMG 리더 네트워크</p>
              </div>
              <span className="material-symbols-outlined text-lg text-white/35 group-hover:text-[#7dc8ff] group-hover:translate-x-0.5 transition-all relative z-10">arrow_forward_ios</span>
            </motion.button>

            {/* 학습 인사이트 */}
            <motion.button
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect('insight')}
              className="group relative overflow-hidden rounded-xl flex items-center gap-4 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                style={{ background: 'linear-gradient(90deg, rgba(220,180,80,0.18), transparent)' }} />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative z-10"
                style={{ background: 'linear-gradient(135deg, rgba(220,175,70,0.45), rgba(190,130,40,0.3))', border: '1px solid rgba(220,175,70,0.5)', boxShadow: '0 0 18px rgba(220,175,70,0.2)' }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: '#f0d080' }}>psychology</span>
              </div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-base font-black uppercase tracking-tight text-white leading-none mb-0.5">학습 인사이트 키워드</p>
                <p className="text-xs text-white/55 font-medium">리더들의 학습 인사이트 기록 및 공유</p>
              </div>
              <span className="material-symbols-outlined text-lg text-white/35 group-hover:text-[#f0d080] group-hover:translate-x-0.5 transition-all relative z-10">arrow_forward_ios</span>
            </motion.button>
          </div>

          {/* 하단 장식 */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            className="mt-8 sm:mt-10 flex items-center gap-3">
            <div className="w-6 h-px" style={{ background: 'rgba(255,255,255,0.18)' }} />
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/30">Hyundai Motor Group</span>
            <div className="w-6 h-px" style={{ background: 'rgba(255,255,255,0.18)' }} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
