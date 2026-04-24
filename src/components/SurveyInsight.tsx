import { useMemo, useState, useRef, useEffect, ReactNode, CSSProperties } from 'react';
import { useStore, User } from '../store';

interface Props {
  courseId: string;
}

type SurveyQ = 'condition' | 'memory' | 'fear' | 'exciting' | 'career';

const Q_OPTIONS: { value: SurveyQ; label: string }[] = [
  { value: 'condition', label: 'Q1. 오늘의 컨디션' },
  { value: 'memory',    label: 'Q2. 기억에 남는 한마디' },
  { value: 'fear',      label: 'Q3. 두렵게 하는 단어' },
  { value: 'exciting',  label: 'Q4. 설레게 하는 단어' },
  { value: 'career',    label: 'Q5. HMG 근무 경력' },
];

// 모든 기기에서 깨지지 않는 말랑한 폰트 스택 (한글은 Gowun Dodum/Jua, Latin은 Quicksand/Nunito)
const SOFT_FONT = `'Gowun Dodum','Jua','Quicksand','Pretendard',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif`;
const softStyle: CSSProperties = { fontFamily: SOFT_FONT };

// ─── Stage: 전체화면 래퍼 (webkit/ms prefix fallback 포함) ───────────────────
function Stage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const handler = () => {
      const fsEl: any =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement;
      setIsFs(!!fsEl && fsEl === stageRef.current);
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler as any);
    document.addEventListener('msfullscreenchange', handler as any);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler as any);
      document.removeEventListener('msfullscreenchange', handler as any);
    };
  }, []);

  const toggleFs = () => {
    const el: any = stageRef.current;
    const doc: any = document;
    const fsEl =
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement;

    if (!fsEl) {
      const req =
        el?.requestFullscreen ||
        el?.webkitRequestFullscreen ||
        el?.webkitEnterFullscreen ||
        el?.msRequestFullscreen;
      if (req) {
        try {
          const p = req.call(el);
          if (p && typeof p.catch === 'function') p.catch(() => setIsFs((v) => !v));
        } catch {
          setIsFs((v) => !v);
        }
      } else {
        // Fullscreen API 미지원 브라우저: pseudo-fullscreen 으로 대체
        setIsFs(true);
      }
    } else {
      const exit =
        document.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.msExitFullscreen;
      if (exit) {
        try {
          const p = exit.call(document);
          if (p && typeof p.catch === 'function') p.catch(() => setIsFs(false));
        } catch {
          setIsFs(false);
        }
      } else {
        setIsFs(false);
      }
    }
  };

  return (
    <div
      ref={stageRef}
      className={`${isFs ? 'fixed inset-0 z-[9999] w-screen h-screen' : 'relative w-full h-[560px] sm:h-[620px]'} overflow-hidden ${className}`}
      style={softStyle}
    >
      {children}
      <button
        onClick={toggleFs}
        className="absolute top-3 right-3 z-50 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white flex items-center justify-center shadow-lg border border-white/20 transition-all"
        title={isFs ? '전체화면 종료' : '전체화면'}
        aria-label={isFs ? '전체화면 종료' : '전체화면'}
      >
        <span className="material-symbols-outlined text-xl">
          {isFs ? 'fullscreen_exit' : 'fullscreen'}
        </span>
      </button>
    </div>
  );
}

// ─── ClickToReveal: 숫자를 탭해서 공개 ────────────────────────────────────
function ClickToReveal({
  value,
  placeholder = '???',
  className = '',
  style,
  hint = '탭하여 공개',
}: {
  value: ReactNode;
  placeholder?: ReactNode;
  className?: string;
  style?: CSSProperties;
  hint?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v); }}
      className={`relative inline-flex items-center justify-center select-none cursor-pointer transition-all ${className}`}
      style={{ ...softStyle, ...style }}
      title={revealed ? '다시 가리기' : hint}
    >
      {revealed ? value : placeholder}
    </button>
  );
}

export default function SurveyInsight({ courseId }: Props) {
  const { db } = useStore();
  const [q, setQ] = useState<SurveyQ>('condition');

  const courseUsers = useMemo<User[]>(
    () => db.users.filter((u: User) => u.courseId === courseId),
    [db.users, courseId]
  );

  return (
    <div className="p-4 sm:p-8 space-y-6" style={softStyle}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider shrink-0">
          질문 선택
        </label>
        <select
          value={q}
          onChange={(e) => setQ(e.target.value as SurveyQ)}
          className="flex-1 bg-surface-container-highest border border-outline rounded-xl px-4 py-3 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary"
          style={softStyle}
        >
          {Q_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm" key={q}>
        {q === 'condition' && <ConditionScene users={courseUsers} />}
        {q === 'memory'    && <WordCloudScene users={courseUsers} field="memorableQuote" theme="memory" />}
        {q === 'fear'      && <WordCloudScene users={courseUsers} field="fearWord"       theme="fear" />}
        {q === 'exciting'  && <WordCloudScene users={courseUsers} field="excitingWord"   theme="exciting" />}
        {q === 'career'    && <CareerScene users={courseUsers} />}
      </div>
    </div>
  );
}

// ─── Q1. Condition ────────────────────────────────────────────────────────
function ConditionScene({ users }: { users: User[] }) {
  const vals = users.map((u) => u.condition).filter((n): n is number => typeof n === 'number');
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  const min = vals.length ? Math.min(...vals) : null;
  const max = vals.length ? Math.max(...vals) : null;

  return (
    <Stage>
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 25%, #7c3aed 55%, #f97316 85%, #fde047 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 85%, rgba(253,224,71,0.65) 0%, rgba(251,146,60,0.35) 25%, transparent 55%)',
        }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" preserveAspectRatio="none">
        {Array.from({ length: 40 }).map((_, i) => {
          const x = (i * 37) % 100;
          const y = (i * 19) % 55;
          const r = (i % 3) * 0.4 + 0.6;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" />;
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.4em] text-white/70" style={softStyle}>
            Today's Condition
          </p>
          <h2
            className="mt-3 text-2xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-xl leading-snug"
            style={softStyle}
          >
            우리 과정에 모인 리더분들의 컨디션은?
          </h2>
        </div>

        {vals.length === 0 ? (
          <p className="text-white/80 text-sm font-bold" style={softStyle}>아직 응답이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:gap-6 w-full max-w-3xl">
            <ConditionCard label="평균" value={avg!.toFixed(1)} icon="mood" accent="from-amber-400 to-orange-500" />
            <ConditionCard label="최저" value={String(min)}    icon="sentiment_dissatisfied" accent="from-sky-400 to-indigo-500" />
            <ConditionCard label="최고" value={String(max)}    icon="sentiment_very_satisfied" accent="from-rose-400 to-pink-600" />
          </div>
        )}

        {vals.length > 0 && (
          <p className="text-white/80 text-xs sm:text-sm font-bold flex items-center gap-2" style={softStyle}>
            <ClickToReveal
              value={<span className="text-white">{vals.length}</span>}
              placeholder={<span className="text-white/60">??</span>}
              className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25"
            />
            명 응답 · 10점 만점 기준
          </p>
        )}
      </div>
    </Stage>
  );
}

function ConditionCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-2xl border border-white/60 text-center" style={softStyle}>
      <div className={`mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-md mb-3`}>
        <span className="material-symbols-outlined text-white text-2xl sm:text-3xl">{icon}</span>
      </div>
      <p className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest" style={softStyle}>{label}</p>
      <div className="mt-1 flex items-baseline justify-center gap-0.5">
        <ClickToReveal
          value={<span>{value}</span>}
          placeholder={<span className="text-on-surface-variant/70">??</span>}
          className="text-3xl sm:text-5xl font-bold text-on-surface px-2 py-0.5 rounded-lg hover:bg-primary/5"
          hint="탭하여 점수 공개"
        />
        <span className="text-lg sm:text-2xl text-on-surface-variant font-bold" style={softStyle}>/10</span>
      </div>
    </div>
  );
}

// ─── Q2/3/4. Word Cloud ────────────────────────────────────────────────────
type WordTheme = 'memory' | 'fear' | 'exciting';

const THEME: Record<WordTheme, {
  title: string;
  subtitle: string;
  bg: string;
  overlay: string;
  palette: string[];
  textShadow: string;
}> = {
  memory: {
    title: '리더분들이 기억하는 한마디는?',
    subtitle: 'Memorable Words',
    bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 70%, #6b21a8 100%)',
    overlay: 'radial-gradient(ellipse at 50% 40%, rgba(251,191,36,0.25) 0%, transparent 60%)',
    palette: ['#fde047', '#fbbf24', '#f59e0b', '#fef3c7', '#fed7aa', '#fde68a'],
    textShadow: '0 2px 8px rgba(0,0,0,0.5), 0 0 20px rgba(251,191,36,0.4)',
  },
  fear: {
    title: '요즘 리더분들을 가장 두렵게 하는 단어는?',
    subtitle: 'What Scares Us',
    bg: 'linear-gradient(180deg, #020617 0%, #0f172a 30%, #1e293b 60%, #334155 100%)',
    overlay: 'radial-gradient(ellipse at 50% 30%, rgba(220,38,38,0.25) 0%, transparent 55%)',
    palette: ['#ef4444', '#f87171', '#fca5a5', '#e5e7eb', '#94a3b8', '#cbd5e1'],
    textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 0 24px rgba(239,68,68,0.45)',
  },
  exciting: {
    title: '요즘 리더분들을 가장 설레게 하는 단어는?',
    subtitle: 'What Excites Us',
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fbcfe8 30%, #ddd6fe 65%, #bae6fd 100%)',
    overlay: 'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.6) 0%, transparent 60%)',
    palette: ['#db2777', '#e11d48', '#7c3aed', '#2563eb', '#059669', '#d97706'],
    textShadow: '0 2px 6px rgba(255,255,255,0.6), 0 0 18px rgba(236,72,153,0.4)',
  },
};

function WordCloudScene({
  users,
  field,
  theme,
}: {
  users: User[];
  field: 'memorableQuote' | 'fearWord' | 'excitingWord';
  theme: WordTheme;
}) {
  const t = THEME[theme];

  const items = useMemo(() => {
    const freq = new Map<string, { display: string; count: number }>();
    users.forEach((u) => {
      const raw = (u as any)[field];
      if (typeof raw !== 'string' || !raw.trim()) return;
      const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
      const prev = freq.get(key);
      if (prev) prev.count++;
      else freq.set(key, { display: raw.trim(), count: 1 });
    });
    return Array.from(freq.values()).sort((a, b) => b.count - a.count).slice(0, 40);
  }, [users, field]);

  const maxCount = items[0]?.count || 1;
  const totalResp = items.reduce((a, b) => a + b.count, 0);

  return (
    <Stage>
      <div className="absolute inset-0" style={{ background: t.bg }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: t.overlay }} />
      <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" preserveAspectRatio="none">
        <filter id={`noise-${theme}`}>
          <feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#noise-${theme})`} />
      </svg>

      <div className="absolute top-6 sm:top-10 inset-x-0 text-center z-10 px-6">
        <p
          className={`text-[10px] sm:text-xs font-bold uppercase tracking-[0.4em] ${theme === 'exciting' ? 'text-slate-700/80' : 'text-white/70'}`}
          style={softStyle}
        >
          {t.subtitle}
        </p>
        <h2
          className={`mt-2 text-xl sm:text-3xl md:text-4xl font-bold drop-shadow-xl leading-snug ${theme === 'exciting' ? 'text-slate-900' : 'text-white'}`}
          style={softStyle}
        >
          {t.title}
        </h2>
      </div>

      <div className="absolute inset-0 pt-28 sm:pt-36 pb-10 px-6 flex items-center justify-center">
        {items.length === 0 ? (
          <p className={`text-sm font-bold ${theme === 'exciting' ? 'text-slate-700' : 'text-white/80'}`} style={softStyle}>
            아직 응답이 없습니다.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6 sm:gap-y-3 max-w-5xl">
            {items.map((it, idx) => {
              const weight = it.count / maxCount;
              const size = 14 + Math.round(weight * 54);
              const color = t.palette[idx % t.palette.length];
              const rotate = (idx % 7 === 0) ? -6 : (idx % 5 === 0 ? 6 : 0);
              return (
                <span
                  key={it.display + idx}
                  style={{
                    fontFamily: SOFT_FONT,
                    fontSize: `${size}px`,
                    color,
                    textShadow: t.textShadow,
                    transform: `rotate(${rotate}deg)`,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    lineHeight: 1.1,
                  }}
                  title={`${it.display} · ${it.count}회`}
                >
                  {it.display}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="absolute bottom-4 inset-x-0 text-center z-10 px-6">
          <p
            className={`text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 flex-wrap ${theme === 'exciting' ? 'text-slate-700/80' : 'text-white/70'}`}
            style={softStyle}
          >
            <ClickToReveal
              value={<span>{items.length}</span>}
              placeholder={<span className="opacity-60">??</span>}
              className={`px-2 py-0.5 rounded-md ${theme === 'exciting' ? 'bg-slate-900/10 hover:bg-slate-900/20' : 'bg-white/15 hover:bg-white/25'}`}
            />
            개 고유 키워드 · 총
            <ClickToReveal
              value={<span>{totalResp}</span>}
              placeholder={<span className="opacity-60">??</span>}
              className={`px-2 py-0.5 rounded-md ${theme === 'exciting' ? 'bg-slate-900/10 hover:bg-slate-900/20' : 'bg-white/15 hover:bg-white/25'}`}
            />
            명 응답
          </p>
        </div>
      )}
    </Stage>
  );
}

// ─── Q5. Career (총 합산 연수) ─────────────────────────────────────────────
function CareerScene({ users }: { users: User[] }) {
  const years = users.map((u) => u.careerYears).filter((n): n is number => typeof n === 'number');
  const total = years.reduce((a, b) => a + b, 0);
  const avg = years.length ? (total / years.length).toFixed(1) : null;
  const maxYear = years.length ? Math.max(...years) : null;

  return (
    <Stage>
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #451a03 0%, #78350f 25%, #b45309 55%, #f59e0b 85%, #fef3c7 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(254,243,199,0.45) 0%, rgba(251,191,36,0.25) 25%, transparent 60%)',
        }}
      />
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" preserveAspectRatio="xMidYMid slice">
        {[190, 170, 145, 120, 95, 70, 48, 28].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="rgba(251,191,36,0.6)" strokeWidth={1.5} />
        ))}
      </svg>
      <svg className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none" preserveAspectRatio="none">
        <filter id="wood-noise">
          <feTurbulence baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#wood-noise)" />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
        <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.4em] text-amber-100/80" style={softStyle}>
          HMG Career Sum
        </p>
        <p className="mt-4 text-base sm:text-xl md:text-2xl font-bold text-amber-50/95 max-w-3xl leading-snug" style={softStyle}>
          우리 과정에 입과한 리더분들이 쌓은
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <ClickToReveal
            value={<span>{years.length ? total.toLocaleString() : '—'}</span>}
            placeholder={<span className="opacity-80">????</span>}
            className="font-bold text-white leading-none px-3 py-1 rounded-2xl hover:bg-white/10 transition-colors"
            style={{
              fontSize: 'clamp(4rem, 16vw, 12rem)',
              textShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(251,191,36,0.5)',
              letterSpacing: '-0.03em',
            }}
            hint="탭하여 총 경력 공개"
          />
          <span className="text-3xl sm:text-6xl font-bold text-amber-50" style={softStyle}>년</span>
        </div>
        <p className="mt-4 text-base sm:text-xl md:text-2xl font-bold text-amber-50/95 max-w-3xl leading-snug" style={softStyle}>
          의 경험이 이 공간에 모였습니다.
        </p>
        {years.length > 0 && (
          <p className="mt-8 text-xs sm:text-sm text-amber-100/80 font-bold flex items-center justify-center gap-1.5 flex-wrap" style={softStyle}>
            <ClickToReveal
              value={<span>{years.length}</span>}
              placeholder={<span className="opacity-60">??</span>}
              className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25"
            />
            명의 리더 · 평균
            <ClickToReveal
              value={<span>{avg}</span>}
              placeholder={<span className="opacity-60">??</span>}
              className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25"
            />
            년 · 최장
            <ClickToReveal
              value={<span>{maxYear}</span>}
              placeholder={<span className="opacity-60">??</span>}
              className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25"
            />
            년
          </p>
        )}
      </div>
    </Stage>
  );
}
