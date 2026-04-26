import { useMemo, useState, useRef, useEffect, ReactNode, CSSProperties, SyntheticEvent } from 'react';
import { useStore, User } from '../store';
import { groupByNormalizedKorean } from '../utils/normalizeKoreanWord';

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
// pseudoFs 상태로 Fullscreen API 미지원/실패 시에도 동일한 토글 UX 제공.
// 전체화면 시 질문 전환 드롭다운을 함께 노출.
function Stage({
  children,
  className = '',
  q,
  setQ,
}: {
  children: ReactNode;
  className?: string;
  q?: SurveyQ;
  setQ?: (v: SurveyQ) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [nativeFs, setNativeFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);
  const isFs = nativeFs || pseudoFs;

  useEffect(() => {
    const handler = () => {
      const fsEl: any =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement;
      setNativeFs(!!fsEl && fsEl === stageRef.current);
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

  // pseudoFs 진입 시 ESC 로 종료 가능
  useEffect(() => {
    if (!pseudoFs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPseudoFs(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pseudoFs]);

  const toggleFs = () => {
    const el: any = stageRef.current;
    const doc: any = document;
    const fsEl =
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.msFullscreenElement;

    // 진입
    if (!fsEl && !pseudoFs) {
      const req =
        el?.requestFullscreen ||
        el?.webkitRequestFullscreen ||
        el?.webkitEnterFullscreen ||
        el?.msRequestFullscreen;
      if (req) {
        try {
          const p = req.call(el);
          if (p && typeof p.catch === 'function') p.catch(() => setPseudoFs(true));
        } catch {
          setPseudoFs(true);
        }
      } else {
        setPseudoFs(true);
      }
      return;
    }

    // 종료
    if (fsEl) {
      const exit =
        document.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.msExitFullscreen;
      if (exit) {
        try {
          const p = exit.call(document);
          if (p && typeof p.catch === 'function') p.catch(() => setPseudoFs(false));
        } catch {
          setPseudoFs(false);
        }
      }
    }
    if (pseudoFs) setPseudoFs(false);
  };

  // 모바일에서 안전한 탭 처리: pointerup으로 즉시 반응 + click 폴백
  const tapHandler = (e: SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFs();
  };

  return (
    <div
      ref={stageRef}
      className={`${isFs ? 'fixed inset-0 z-[9999] w-screen h-screen' : 'relative w-full h-[560px] sm:h-[620px]'} overflow-hidden ${className}`}
      style={softStyle}
    >
      {children}

      {/* 전체화면 모드에서만 보이는 질문 전환 드롭다운 (좌상단) */}
      {isFs && q && setQ && (
        <div
          className="absolute z-[60] flex items-center gap-2"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          }}
        >
          <select
            value={q}
            onChange={(e) => setQ(e.target.value as SurveyQ)}
            className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs sm:text-sm font-bold rounded-full pl-4 pr-8 py-2 sm:py-2.5 border border-white/25 shadow-lg outline-none focus:ring-2 focus:ring-white/40 appearance-none"
            style={{
              ...softStyle,
              backgroundImage:
                'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27white%27 viewBox=%270 0 24 24%27><path d=%27M7 10l5 5 5-5z%27/></svg>")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              backgroundSize: '16px',
            }}
          >
            {Q_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ color: '#000' }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 전체화면 토글 버튼: 우하단 (모바일에서도 닿기 쉬운 위치 + safe-area 고려) */}
      <button
        type="button"
        onClick={tapHandler}
        onPointerUp={tapHandler}
        className="absolute z-[60] w-14 h-14 rounded-full bg-black/70 active:bg-black/90 hover:bg-black/85 backdrop-blur-sm text-white flex items-center justify-center shadow-2xl border border-white/30 transition-all touch-manipulation"
        style={{
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${isFs ? 20 : 12}px)`,
          right: `calc(env(safe-area-inset-right, 0px) + ${isFs ? 20 : 12}px)`,
          WebkitTapHighlightColor: 'transparent',
        }}
        title={isFs ? '전체화면 종료' : '전체화면'}
        aria-label={isFs ? '전체화면 종료' : '전체화면'}
      >
        <span className="material-symbols-outlined text-2xl">
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

      {/* 단일 Stage로 감싸서 전체화면 중에도 q 전환이 가능하도록 함
          (Stage가 언마운트되면 native fullscreen 도 풀려버리므로 key={q} 사용 X) */}
      <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <Stage q={q} setQ={setQ}>
          {q === 'condition' && <ConditionScene users={courseUsers} />}
          {q === 'memory'    && <WordCloudScene users={courseUsers} field="memorableQuote" theme="memory" />}
          {q === 'fear'      && <WordCloudScene users={courseUsers} field="fearWord"       theme="fear" />}
          {q === 'exciting'  && <WordCloudScene users={courseUsers} field="excitingWord"   theme="exciting" />}
          {q === 'career'    && <CareerScene users={courseUsers} />}
        </Stage>
      </div>
    </div>
  );
}

// ─── Q1. Condition (0~10 분포 세로 막대그래프 · 클릭 시 stagger 상승) ─────
function ConditionScene({ users }: { users: User[] }) {
  const vals = users.map((u) => u.condition).filter((n): n is number => typeof n === 'number');
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;

  // 0~10 각 점수별 인원 수
  const buckets = useMemo(() => {
    const b = Array.from({ length: 11 }, (_, i) => ({ score: i, count: 0 }));
    vals.forEach((v) => {
      const s = Math.max(0, Math.min(10, Math.round(v)));
      b[s].count++;
    });
    return b;
  }, [vals]);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  // 그래프 전체 공개 플래그 (클릭 시 애니메이션 트리거)
  const [chartRevealed, setChartRevealed] = useState(false);

  // 점수별 색상 (낮→차가운 / 높→따뜻한)
  const barColor = (score: number) => {
    const palette = [
      '#1e40af', '#2563eb', '#3b82f6', '#38bdf8', '#22d3ee',
      '#14b8a6', '#84cc16', '#facc15', '#f59e0b', '#f97316', '#ef4444',
    ];
    return palette[score] || '#2563eb';
  };

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 25%, #7c3aed 55%, #f97316 85%, #fde047 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 85%, rgba(253,224,71,0.55) 0%, rgba(251,146,60,0.25) 25%, transparent 55%)',
        }}
      />
      <svg className="absolute inset-0 w-full h-full opacity-50 pointer-events-none" preserveAspectRatio="none">
        {Array.from({ length: 40 }).map((_, i) => {
          const x = (i * 37) % 100;
          const y = (i * 19) % 55;
          const r = (i % 3) * 0.4 + 0.6;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" />;
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center px-4 sm:px-8 py-6 sm:py-8 overflow-y-auto">
        {/* 타이틀 */}
        <div className="text-center shrink-0">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.4em] text-white/70" style={softStyle}>
            Today's Condition
          </p>
          <h2
            className="mt-2 text-xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-xl leading-snug"
            style={softStyle}
          >
            우리 과정에 모인 리더분들의 컨디션은?
          </h2>
        </div>

        {/* 평균 (개별 탭 공개) */}
        {vals.length > 0 && (
          <div className="mt-4 sm:mt-5 flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl px-4 sm:px-6 py-2.5 sm:py-3 shadow-2xl border border-white/70">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-white text-xl sm:text-2xl">mood</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest" style={softStyle}>
                평균
              </span>
              <ClickToReveal
                value={<span>{avg!.toFixed(1)}</span>}
                placeholder={<span className="text-on-surface-variant/60">?.?</span>}
                className="ml-2 text-2xl sm:text-4xl font-bold text-on-surface px-2 py-0.5 rounded-lg hover:bg-primary/5"
                hint="탭하여 평균 공개"
              />
              <span className="text-sm sm:text-lg text-on-surface-variant font-bold" style={softStyle}>/10</span>
            </div>
          </div>
        )}

        {/* 세로 막대 그래프 */}
        {vals.length === 0 ? (
          <p className="mt-10 text-white/80 text-sm font-bold" style={softStyle}>아직 응답이 없습니다.</p>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setChartRevealed((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChartRevealed((v) => !v); } }}
            title={chartRevealed ? '다시 가리기' : '그래프를 탭하여 전체 공개'}
            className="mt-5 sm:mt-6 w-full max-w-3xl bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 p-3 sm:p-5 shadow-2xl cursor-pointer hover:bg-white/15 transition-colors text-left select-none"
          >
            {/* 안내 배너 */}
            {!chartRevealed && (
              <div className="mb-3 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white/95 text-[11px] sm:text-xs font-bold" style={softStyle}>
                  <span className="material-symbols-outlined text-sm">touch_app</span>
                  그래프를 탭하여 전체 결과 공개
                </span>
              </div>
            )}

            {/* 차트 영역 */}
            <div
              className="relative w-full"
              style={{ height: 'clamp(180px, 34vh, 300px)' }}
            >
              {/* 가이드 그리드 */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="border-t border-white/10" />
                ))}
              </div>

              {/* 막대들 (plot area) */}
              <div className="absolute inset-0 pt-5 pb-0 flex items-end justify-between gap-1 sm:gap-2">
                {buckets.map((b, idx) => {
                  const heightPct = chartRevealed ? (b.count / maxCount) * 100 : 0;
                  const minHeight = chartRevealed && b.count > 0 ? 6 : 0;
                  return (
                    <div
                      key={b.score}
                      className="flex-1 h-full flex flex-col items-center justify-end relative"
                    >
                      {/* 인원수 라벨 */}
                      <span
                        className="text-[10px] sm:text-xs font-bold text-white tabular-nums mb-1 transition-opacity duration-500"
                        style={{
                          ...softStyle,
                          opacity: chartRevealed && b.count > 0 ? 1 : 0,
                          transitionDelay: chartRevealed ? `${500 + idx * 80}ms` : '0ms',
                          textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }}
                      >
                        {b.count}명
                      </span>
                      {/* 막대 */}
                      <div
                        className="w-full rounded-t-lg"
                        style={{
                          height: `max(${heightPct}%, ${minHeight}px)`,
                          background: `linear-gradient(180deg, ${barColor(b.score)} 0%, ${barColor(b.score)}cc 100%)`,
                          boxShadow: chartRevealed && b.count > 0 ? `0 -4px 16px ${barColor(b.score)}80` : 'none',
                          transition: 'height 900ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 500ms ease',
                          transitionDelay: chartRevealed ? `${idx * 80}ms` : '0ms',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X축: 점수 레이블 */}
            <div className="mt-2 flex items-center justify-between gap-1 sm:gap-2 px-0">
              {buckets.map((b) => (
                <span
                  key={b.score}
                  className="flex-1 text-center text-xs sm:text-sm font-bold text-white/90 tabular-nums"
                  style={softStyle}
                >
                  {b.score}
                </span>
              ))}
            </div>
            <p
              className="mt-1 text-center text-[10px] sm:text-xs font-bold text-white/60 uppercase tracking-[0.3em]"
              style={softStyle}
            >
              Score
            </p>

            {/* 푸터: 총 응답 수 */}
            <div className="mt-3 sm:mt-4 pt-3 border-t border-white/15 text-center">
              <p
                className="text-[11px] sm:text-xs text-white/80 font-bold flex items-center justify-center gap-1.5 flex-wrap"
                style={softStyle}
              >
                총
                <ClickToReveal
                  value={<span>{vals.length}</span>}
                  placeholder={<span className="opacity-60">??</span>}
                  className="px-2 py-0.5 rounded-md bg-white/15 hover:bg-white/25"
                />
                명 응답 · 10점 만점 기준
              </p>
            </div>
          </div>
        )}
      </div>
    </>
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
    // 한국어 표면 변형(조사/어미/공백/대소문자) 정규화 후 그룹화.
    //   "두려움이" + "두려움 " + "Fear" + "fear" → 같은 그룹.
    //   대표 표시는 가장 자주 쓰인 표면 형태 (동률 시 가장 짧은 형태).
    const raws: string[] = [];
    users.forEach((u) => {
      const v = (u as any)[field];
      if (typeof v === 'string' && v.trim()) raws.push(v);
    });
    return groupByNormalizedKorean(raws).slice(0, 40);
  }, [users, field]);

  const maxCount = items[0]?.count || 1;
  const totalResp = items.reduce((a, b) => a + b.count, 0);

  return (
    <>
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

      <div className="absolute inset-0 pt-24 sm:pt-32 pb-12 px-4 sm:px-6 flex items-center justify-center overflow-hidden">
        {items.length === 0 ? (
          <p className={`text-sm font-bold ${theme === 'exciting' ? 'text-slate-700' : 'text-white/80'}`} style={softStyle}>
            아직 응답이 없습니다.
          </p>
        ) : (
          <div
            className="flex flex-wrap items-center justify-center w-full max-w-5xl max-h-full overflow-hidden content-center"
            style={{ gap: 'clamp(6px, 1vw, 12px)' }}
          >
            {(() => {
              // 키워드 개수에 따라 최대 폰트 크기를 자동 축소 — 화면 밖으로 넘치지 않도록.
              const n = items.length;
              const maxFont = n > 30 ? 30 : n > 18 ? 38 : n > 10 ? 46 : 54;
              const minFont = 13;
              const range = maxFont - minFont;

              // 키워드 별 구름/풍선 배경 색조 (3가지 미세 톤 순환).
              // 너무 도드라지지 않도록 alpha 매우 낮게.
              const isLight = theme === 'exciting';
              const cloudBgs = isLight
                ? ['rgba(255,255,255,0.55)', 'rgba(248,250,252,0.5)', 'rgba(241,245,249,0.55)']
                : ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)'];
              const cloudBorders = isLight
                ? ['rgba(15,23,42,0.10)', 'rgba(15,23,42,0.07)', 'rgba(15,23,42,0.12)']
                : ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.13)', 'rgba(255,255,255,0.22)'];
              const cloudShadow = isLight
                ? '0 1px 2px rgba(15,23,42,0.06), 0 4px 12px rgba(15,23,42,0.04)'
                : '0 1px 3px rgba(0,0,0,0.18), 0 4px 14px rgba(0,0,0,0.12)';

              return items.map((it, idx) => {
                const weight = it.count / maxCount;
                const size = minFont + Math.round(weight * range);
                const color = t.palette[idx % t.palette.length];
                const rotate = (idx % 7 === 0) ? -3 : (idx % 5 === 0 ? 3 : 0);
                const padX = Math.max(10, Math.round(size * 0.45));
                const padY = Math.max(4, Math.round(size * 0.18));
                return (
                  <span
                    key={it.display + idx}
                    className="inline-flex items-center justify-center select-none"
                    style={{
                      fontFamily: SOFT_FONT,
                      fontSize: `${size}px`,
                      color,
                      textShadow: t.textShadow,
                      transform: `rotate(${rotate}deg)`,
                      fontWeight: 700,
                      letterSpacing: '-0.01em',
                      lineHeight: 1.1,
                      // 구름/풍선 형태 배경 — 미세 색조 차이로 키워드 구분
                      background: cloudBgs[idx % cloudBgs.length],
                      border: `1px solid ${cloudBorders[idx % cloudBorders.length]}`,
                      borderRadius: '9999px',
                      padding: `${padY}px ${padX}px`,
                      boxShadow: cloudShadow,
                      backdropFilter: 'blur(2px)',
                      WebkitBackdropFilter: 'blur(2px)',
                      whiteSpace: 'nowrap',
                    }}
                    title={`${it.display} · ${it.count}회`}
                  >
                    {it.display}
                  </span>
                );
              });
            })()}
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
    </>
  );
}

// ─── Q5. Career (총 합산 연수) ─────────────────────────────────────────────
function CareerScene({ users }: { users: User[] }) {
  const years = users.map((u) => u.careerYears).filter((n): n is number => typeof n === 'number');
  const total = years.reduce((a, b) => a + b, 0);
  const avg = years.length ? (total / years.length).toFixed(1) : null;
  const maxYear = years.length ? Math.max(...years) : null;

  return (
    <>
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
    </>
  );
}
