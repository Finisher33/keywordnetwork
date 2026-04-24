import { useMemo, useState, CSSProperties } from 'react';
import { useStore, User } from '../store';

interface Props {
  courseId: string;
}

type SurveyQ = 'golf' | 'career' | 'lotto' | 'known' | 'drink';

const Q_OPTIONS: { value: SurveyQ; label: string }[] = [
  { value: 'golf', label: 'Q1. 골프 평균 타수' },
  { value: 'career', label: 'Q2. HMG 경력 연수' },
  { value: 'lotto', label: 'Q3. 로또 최고 당첨 등수' },
  { value: 'known', label: 'Q4. 이미 아는 리더 수' },
  { value: 'drink', label: 'Q5. 주량 (소주 병)' },
];

export default function SurveyInsight({ courseId }: Props) {
  const { db } = useStore();
  const [q, setQ] = useState<SurveyQ>('golf');

  const courseUsers = useMemo<User[]>(
    () => db.users.filter((u: User) => u.courseId === courseId),
    [db.users, courseId]
  );

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-xs font-black text-on-surface-variant uppercase tracking-wider shrink-0">
          질문 선택
        </label>
        <select
          value={q}
          onChange={(e) => setQ(e.target.value as SurveyQ)}
          className="flex-1 bg-surface-container-highest border border-outline rounded-xl px-4 py-3 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary"
        >
          {Q_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm" key={q}>
        {q === 'golf' && <GolfScene users={courseUsers} />}
        {q === 'career' && <CareerScene users={courseUsers} />}
        {q === 'lotto' && <LottoScene users={courseUsers} />}
        {q === 'known' && <NetworkScene users={courseUsers} />}
        {q === 'drink' && <DrinkScene users={courseUsers} />}
      </div>
    </div>
  );
}

// ─── Q1. Golf ───────────────────────────────────────────────────────────────
function GolfScene({ users }: { users: User[] }) {
  const scores = users.map((u) => u.golfScore).filter((n): n is number => typeof n === 'number');
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const best = scores.length ? Math.min(...scores) : null; // 골프는 낮을수록 고수
  const bestUser = best != null ? users.find((u) => u.golfScore === best) : null;

  const [showAvg, setShowAvg] = useState(false);
  const [showBest, setShowBest] = useState(false);

  return (
    <div className="relative w-full h-[520px] overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-50">
      <style>{`
        @keyframes golfRoll {
          0%   { transform: translate(-220px, 20px) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          60%  { transform: translate(150px, 20px) rotate(1800deg); opacity: 1; }
          85%  { transform: translate(185px, 22px) rotate(2400deg) scale(1); opacity: 1; }
          100% { transform: translate(190px, 28px) rotate(2520deg) scale(0.3); opacity: 0; }
        }
        @keyframes flagWave {
          0%, 100% { transform: skewX(-4deg); }
          50%      { transform: skewX(6deg); }
        }
        @keyframes statsIn {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* 3D 그린 바닥 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[1200px] h-[380px]"
        style={{
          perspective: '800px',
          perspectiveOrigin: '50% 0%',
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-full"
          style={{
            transform: 'rotateX(58deg)',
            transformOrigin: '50% 100%',
            background:
              'radial-gradient(ellipse at center, #4ade80 0%, #22c55e 40%, #16a34a 80%)',
            boxShadow: 'inset 0 0 120px rgba(0,0,0,0.25)',
          }}
        >
          {/* 잔디 스트라이프 */}
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(0,0,0,0.15) 0 20px, transparent 20px 40px)',
            }}
          />
        </div>
      </div>

      {/* 홀 + 깃대 */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2">
        <div
          className="relative"
          style={{ transform: 'translateX(120px) translateY(40px)' }}
        >
          {/* 홀 (타원형 구멍) */}
          <div
            className="absolute w-10 h-3 rounded-full bg-neutral-900"
            style={{
              left: '-4px',
              top: '44px',
              boxShadow:
                'inset 0 2px 4px rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.4)',
            }}
          />
          {/* 깃대 */}
          <div
            className="absolute w-[2px] bg-neutral-700"
            style={{ height: '90px', left: '14px', bottom: '44px' }}
          />
          {/* 깃발 */}
          <div
            className="absolute left-[16px] bottom-[110px] w-7 h-4 bg-red-500 origin-left"
            style={{
              clipPath: 'polygon(0 0, 100% 20%, 100% 80%, 0 100%)',
              animation: 'flagWave 2s ease-in-out infinite',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      </div>

      {/* 굴러가는 공 */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 pointer-events-none">
        <div
          className="w-5 h-5 rounded-full bg-white"
          style={{
            animation: 'golfRoll 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
            boxShadow:
              'inset -2px -2px 4px rgba(0,0,0,0.2), 0 3px 6px rgba(0,0,0,0.3)',
            backgroundImage:
              'radial-gradient(circle at 30% 30%, #fff 0%, #e5e7eb 100%)',
          }}
        />
      </div>

      {/* 통계 출력 */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RevealCard
            icon="sports_golf"
            label="우리 과정 리더 평균 타수"
            value={avg != null ? `${avg}타` : '데이터 없음'}
            sub={scores.length ? `${scores.length}명 응답` : '응답 0명'}
            accent="from-emerald-500 to-green-600"
            revealed={showAvg}
            onReveal={() => setShowAvg(true)}
          />
          <RevealCard
            icon="military_tech"
            label="최고 고수"
            value={best != null ? `${best}타` : '데이터 없음'}
            sub={bestUser ? `${bestUser.name} (${bestUser.company})` : ''}
            accent="from-amber-500 to-orange-600"
            revealed={showBest}
            onReveal={() => setShowBest(true)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Q2. Career ─────────────────────────────────────────────────────────────
function CareerScene({ users }: { users: User[] }) {
  const years = users.map((u) => u.careerYears).filter((n): n is number => typeof n === 'number');
  const total = years.reduce((a, b) => a + b, 0);
  const avg = years.length ? (total / years.length).toFixed(1) : null;

  const [showTotal, setShowTotal] = useState(false);
  const [showAvg, setShowAvg] = useState(false);

  return (
    <div className="relative w-full h-[520px] overflow-hidden bg-gradient-to-b from-emerald-900 via-emerald-700 to-amber-100">
      <style>{`
        @keyframes forestZoom {
          0%   { transform: scale(1); opacity: 1; }
          70%  { transform: scale(4); opacity: 1; }
          100% { transform: scale(6); opacity: 0; }
        }
        @keyframes ringsIn {
          0%   { opacity: 0; transform: scale(0.3); }
          40%  { opacity: 0; }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ringGrow {
          0%   { stroke-dashoffset: 800; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes statsIn {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* 숲 → 줌인 */}
      <div
        className="absolute inset-0"
        style={{ animation: 'forestZoom 1.6s ease-in forwards', transformOrigin: '50% 60%' }}
      >
        {Array.from({ length: 18 }).map((_, i) => {
          const x = (i % 6) * 18 + (Math.floor(i / 6) % 2) * 9;
          const y = Math.floor(i / 6) * 22 + 30;
          const s = 0.6 + (i % 3) * 0.2;
          return (
            <div
              key={i}
              className="absolute"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `scale(${s})`,
                transformOrigin: 'bottom center',
              }}
            >
              {/* 나뭇잎 (원추형 3단) */}
              <div
                className="w-14 h-14 bg-emerald-600 rounded-full"
                style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
              />
              <div
                className="w-14 h-12 bg-emerald-700 rounded-full -mt-6"
                style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
              />
              {/* 줄기 */}
              <div className="w-2 h-4 bg-amber-900 mx-auto rounded-sm" />
            </div>
          );
        })}
      </div>

      {/* 나이테 (줌인 후 페이드인) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ animation: 'ringsIn 1.6s ease-out forwards', opacity: 0 }}
      >
        <svg viewBox="0 0 400 400" className="w-[320px] h-[320px] drop-shadow-2xl">
          <defs>
            <radialGradient id="woodGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="190" fill="url(#woodGrad)" />
          {[170, 145, 120, 95, 70, 48, 28].map((r, i) => (
            <circle
              key={r}
              cx="200"
              cy="200"
              r={r}
              fill="none"
              stroke="rgba(120,53,15,0.6)"
              strokeWidth={2 + (i % 2)}
              strokeDasharray="800"
              style={{
                animation: `ringGrow 1s ease-out ${1.2 + i * 0.08}s backwards`,
              }}
            />
          ))}
          <circle cx="200" cy="200" r="6" fill="#78350f" />
        </svg>
      </div>

      {/* 통계 */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RevealCard
            icon="forest"
            label="리더들의 경험을 합치면"
            value={years.length ? `총 ${total}년` : '데이터 없음'}
            sub={years.length ? `${years.length}명의 HMG 경력 합산` : ''}
            accent="from-emerald-600 to-green-700"
            revealed={showTotal}
            onReveal={() => setShowTotal(true)}
          />
          <RevealCard
            icon="history_edu"
            label="평균 경력"
            value={avg ? `${avg}년` : '데이터 없음'}
            sub={years.length ? `${years.length}명 응답` : ''}
            accent="from-amber-600 to-orange-700"
            revealed={showAvg}
            onReveal={() => setShowAvg(true)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Q3. Lotto ──────────────────────────────────────────────────────────────
function LottoScene({ users }: { users: User[] }) {
  const ranks = users.map((u) => u.lottoRank).filter((r): r is string => !!r);
  const winners = ranks.filter((r) => r !== '꽝');
  const parseRank = (r: string) => {
    const m = r.match(/(\d+)/);
    return m ? Number(m[1]) : Infinity;
  };
  const bestRank = winners.length ? Math.min(...winners.map(parseRank)) : null;

  const [showCount, setShowCount] = useState(false);
  const [showBest, setShowBest] = useState(false);

  return (
    <div className="relative w-full h-[520px] overflow-hidden bg-gradient-to-b from-rose-200 via-orange-100 to-yellow-100">
      <style>{`
        @keyframes drumSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(1080deg); }
        }
        @keyframes sevenDrop {
          0%   { transform: translate(-50%, -240px) scale(0.3); opacity: 0; }
          40%  { opacity: 0; }
          60%  { transform: translate(-50%, -40px) scale(0.9); opacity: 1; }
          80%  { transform: translate(-50%, 10px) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, 0px) scale(1); opacity: 1; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.4); }
        }
        @keyframes statsIn {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* 추첨기 본체 */}
      <div className="absolute left-1/2 top-20 -translate-x-1/2">
        {/* 투명 돔 */}
        <div
          className="relative w-52 h-52 rounded-full border-4 border-rose-400 shadow-2xl"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0%, rgba(254,226,226,0.6) 60%, rgba(244,114,182,0.3) 100%)',
            backdropFilter: 'blur(2px)',
          }}
        >
          {/* 회전하는 내부 공들 */}
          <div
            className="absolute inset-3 rounded-full"
            style={{ animation: 'drumSpin 1.5s linear' }}
          >
            {['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'].map((c, i) => {
              const angle = (i / 6) * 2 * Math.PI;
              const r = 60;
              return (
                <div
                  key={i}
                  className="absolute w-7 h-7 rounded-full shadow-md flex items-center justify-center text-white font-black text-xs"
                  style={{
                    left: `calc(50% + ${Math.cos(angle) * r}px - 14px)`,
                    top: `calc(50% + ${Math.sin(angle) * r}px - 14px)`,
                    backgroundColor: c,
                    backgroundImage:
                      'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), transparent 60%)',
                  }}
                >
                  {(i + 1) * 3}
                </div>
              );
            })}
          </div>
          {/* 추첨구 (하단 배출부) */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-16 h-4 bg-rose-500 rounded-b-xl shadow" />
        </div>

        {/* 배출된 7번 공 */}
        <div
          className="absolute left-1/2 top-full mt-6 w-20 h-20 rounded-full flex items-center justify-center font-black text-4xl text-white shadow-2xl"
          style={{
            animation: 'sevenDrop 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
            opacity: 0,
            background: 'radial-gradient(circle at 30% 30%, #fde047 0%, #f59e0b 60%, #b45309 100%)',
            textShadow: '0 2px 6px rgba(0,0,0,0.4)',
            border: '4px solid white',
          }}
        >
          7
        </div>

        {/* 스파클 */}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="absolute material-symbols-outlined text-yellow-400"
            style={{
              left: ['-30px', 'calc(100% + 8px)', '-20px', 'calc(100% + 16px)'][i],
              top: ['30px', '60px', '140px', '180px'][i],
              fontSize: '28px',
              animation: `sparkle ${1.5 + i * 0.2}s ease-in-out ${1 + i * 0.15}s infinite`,
              textShadow: '0 0 10px rgba(250,204,21,0.8)',
            }}
          >
            auto_awesome
          </span>
        ))}
      </div>

      {/* 통계 */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RevealCard
            icon="casino"
            label="우리 과정의 럭키가이"
            value={winners.length ? `총 ${winners.length}명!` : '없음'}
            sub={ranks.length ? `${ranks.length}명 중 당첨 경험` : ''}
            accent="from-rose-500 to-pink-600"
            revealed={showCount}
            onReveal={() => setShowCount(true)}
          />
          <RevealCard
            icon="emoji_events"
            label="최고 당첨 등수"
            value={bestRank != null ? `${bestRank}등!` : '데이터 없음'}
            sub={bestRank != null ? '가장 높은 등수' : ''}
            accent="from-amber-500 to-yellow-600"
            revealed={showBest}
            onReveal={() => setShowBest(true)}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Q4. Network (아는 리더) ────────────────────────────────────────────────
function NetworkScene({ users }: { users: User[] }) {
  const vals = users.map((u) => u.knownPeople).filter((n): n is number => typeof n === 'number');
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const maxUser = max != null ? users.find((u) => u.knownPeople === max) : null;

  const [showAvg, setShowAvg] = useState(false);
  const [showMax, setShowMax] = useState(false);

  return (
    <div className="relative w-full h-[520px] overflow-hidden bg-gradient-to-b from-indigo-100 via-sky-100 to-white">
      <style>{`
        @keyframes walkLeft {
          0%   { transform: translateX(-180px); }
          100% { transform: translateX(0); }
        }
        @keyframes walkRight {
          0%   { transform: translateX(180px); }
          100% { transform: translateX(0); }
        }
        @keyframes shakePulse {
          0%, 30% { transform: scale(0); opacity: 0; }
          50%     { transform: scale(1.4); opacity: 1; }
          100%    { transform: scale(1); opacity: 0.9; }
        }
        @keyframes statsIn {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* 바닥 그림자 */}
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 w-80 h-3 bg-black/10 rounded-full blur-md" />

      {/* 왼쪽 리더 */}
      <div
        className="absolute top-[20%]"
        style={{
          left: 'calc(50% - 100px)',
          animation: 'walkLeft 1.2s ease-out',
        }}
      >
        <PersonSilhouette color="#3b82f6" />
      </div>

      {/* 오른쪽 리더 */}
      <div
        className="absolute top-[20%]"
        style={{
          left: 'calc(50% + 20px)',
          animation: 'walkRight 1.2s ease-out',
        }}
      >
        <PersonSilhouette color="#ef4444" flip />
      </div>

      {/* 악수 펄스 */}
      <div
        className="absolute left-1/2 top-[37%] -translate-x-1/2 w-12 h-12 rounded-full"
        style={{
          background: 'radial-gradient(circle, #fde047 0%, #f59e0b 60%, transparent 80%)',
          animation: 'shakePulse 0.6s ease-out 1.2s forwards',
          opacity: 0,
          boxShadow: '0 0 30px rgba(250,204,21,0.8)',
        }}
      />

      {/* 통계 */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RevealCard
            icon="groups"
            label="평균 이미 아는 리더 수"
            value={avg ? `${avg}명` : '데이터 없음'}
            sub={vals.length ? `${vals.length}명 응답` : ''}
            accent="from-indigo-500 to-blue-600"
            revealed={showAvg}
            onReveal={() => setShowAvg(true)}
          />
          <RevealCard
            icon="star"
            label="우리 과정 핵인싸"
            value={max != null ? `무려 ${max}명!` : '데이터 없음'}
            sub={maxUser ? `${maxUser.name} (${maxUser.company})` : ''}
            accent="from-rose-500 to-red-600"
            revealed={showMax}
            onReveal={() => setShowMax(true)}
          />
        </div>
      </div>
    </div>
  );
}

function PersonSilhouette({ color, flip }: { color: string; flip?: boolean }) {
  return (
    <div className="relative w-20 h-36" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      {/* 머리 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-10 h-10 rounded-full shadow-md"
        style={{ background: `radial-gradient(circle at 35% 35%, #fcd5b5, #e6a87a)` }}
      />
      {/* 몸통 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-10 w-14 h-16 rounded-t-2xl rounded-b-md shadow-md"
        style={{ backgroundColor: color }}
      />
      {/* 악수 내민 팔 */}
      <div
        className="absolute top-[52px] right-[-18px] w-10 h-3 rounded-full shadow"
        style={{ backgroundColor: color, transform: 'rotate(-8deg)' }}
      />
      {/* 손 */}
      <div
        className="absolute top-[49px] right-[-26px] w-5 h-5 rounded-full"
        style={{ background: 'radial-gradient(circle at 35% 35%, #fcd5b5, #e6a87a)' }}
      />
      {/* 다리 */}
      <div
        className="absolute left-[24px] top-[104px] w-3 h-8 rounded-b-md"
        style={{ backgroundColor: '#1e293b' }}
      />
      <div
        className="absolute right-[24px] top-[104px] w-3 h-8 rounded-b-md"
        style={{ backgroundColor: '#1e293b' }}
      />
    </div>
  );
}

// ─── Q5. Drink ──────────────────────────────────────────────────────────────
function DrinkScene({ users }: { users: User[] }) {
  const vals = users.map((u) => u.drinkingCapacity).filter((n): n is number => typeof n === 'number');
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  const max = vals.length ? Math.max(...vals) : null;
  const maxUser = max != null ? users.find((u) => u.drinkingCapacity === max) : null;

  const [showAvg, setShowAvg] = useState(false);
  const [showMax, setShowMax] = useState(false);

  return (
    <div className="relative w-full h-[520px] overflow-hidden bg-gradient-to-b from-amber-900 via-orange-900 to-red-950">
      <style>{`
        @keyframes glassDrop1 {
          0%   { transform: translate(-120px, -260px) rotate(-15deg); opacity: 0; }
          30%  { opacity: 1; }
          70%  { transform: translate(-120px, 0px) rotate(0deg); }
          80%  { transform: translate(-120px, -8px) rotate(0deg); }
          100% { transform: translate(-120px, 0px) rotate(0deg); opacity: 1; }
        }
        @keyframes glassDrop2 {
          0%, 30%  { transform: translate(0px, -260px) rotate(12deg); opacity: 0; }
          50%      { opacity: 1; }
          85%      { transform: translate(0px, 0px) rotate(0deg); }
          92%      { transform: translate(0px, -6px) rotate(0deg); }
          100%     { transform: translate(0px, 0px) rotate(0deg); opacity: 1; }
        }
        @keyframes glassDrop3 {
          0%, 55%  { transform: translate(120px, -260px) rotate(-8deg); opacity: 0; }
          75%      { opacity: 1; }
          95%      { transform: translate(120px, 0px) rotate(0deg); }
          100%     { transform: translate(120px, 0px) rotate(0deg); opacity: 1; }
        }
        @keyframes tableIn {
          0%   { transform: perspective(600px) rotateX(65deg) translateY(40px); opacity: 0; }
          100% { transform: perspective(600px) rotateX(65deg) translateY(0); opacity: 1; }
        }
        @keyframes statsIn {
          0%   { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* 배경: 술집 조명 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 20%, rgba(250,204,21,0.25) 0%, transparent 60%)',
        }}
      />
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-yellow-200"
          style={{
            left: `${10 + i * 15}%`,
            top: '18%',
            boxShadow: '0 0 12px rgba(254,240,138,0.9)',
            opacity: 0.7,
          }}
        />
      ))}

      {/* 테이블 (3D 원근) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-2xl"
        style={{
          bottom: '200px',
          background: 'linear-gradient(180deg, #92400e 0%, #451a03 100%)',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5)',
          transform: 'perspective(600px) rotateX(65deg)',
          transformOrigin: 'center bottom',
          animation: 'tableIn 0.6s ease-out forwards',
        }}
      >
        <div
          className="absolute inset-0 rounded-2xl opacity-40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.3) 0 80px, transparent 80px 120px)',
          }}
        />
      </div>

      {/* 3잔 */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2">
        <SojuGlass style={{ animation: 'glassDrop1 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards', opacity: 0 }} />
        <SojuGlass style={{ animation: 'glassDrop2 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards', opacity: 0 }} />
        <SojuGlass style={{ animation: 'glassDrop3 1.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards', opacity: 0 }} />
      </div>

      {/* 통계 */}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RevealCard
            icon="local_bar"
            label="리더들의 평균 주량"
            value={avg ? `${avg}병` : '데이터 없음'}
            sub={vals.length ? `${vals.length}명 응답 (소주 기준)` : ''}
            accent="from-amber-500 to-orange-600"
            revealed={showAvg}
            onReveal={() => setShowAvg(true)}
          />
          <RevealCard
            icon="liquor"
            label="술이 물보다 맛있는 리더"
            value={max != null ? `${max.toFixed(1)}병!` : '데이터 없음'}
            sub={maxUser ? `${maxUser.name} (${maxUser.company})` : ''}
            accent="from-red-600 to-rose-700"
            revealed={showMax}
            onReveal={() => setShowMax(true)}
          />
        </div>
      </div>
    </div>
  );
}

function SojuGlass({ style }: { style?: CSSProperties }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2" style={style}>
      {/* 잔 본체 */}
      <div
        className="relative w-10 h-14 rounded-b-xl rounded-t-sm shadow-xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(220,240,255,0.8) 50%, rgba(180,220,255,0.7) 100%)',
          border: '1.5px solid rgba(255,255,255,0.6)',
          backdropFilter: 'blur(2px)',
        }}
      >
        {/* 소주 (투명) */}
        <div
          className="absolute bottom-0 left-0 right-0 h-3/5 rounded-b-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.3), rgba(200,220,255,0.5))' }}
        />
        {/* 빛 반사 */}
        <div className="absolute top-1 left-1 w-1.5 h-6 bg-white/80 rounded-full" />
      </div>
      {/* 받침 그림자 */}
      <div className="w-12 h-1 bg-black/40 rounded-full blur-sm mx-auto -mt-0.5" />
    </div>
  );
}

function RevealCard({
  icon,
  label,
  value,
  sub,
  accent,
  revealed,
  onReveal,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onReveal}
      disabled={revealed}
      className={`relative text-left bg-white/95 backdrop-blur-sm rounded-2xl p-4 sm:p-5 shadow-xl border border-white/60 overflow-hidden transition-transform ${
        revealed ? 'cursor-default' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
      }`}
      style={revealed ? { animation: 'statsIn 0.5s ease-out' } : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-md shrink-0`}
        >
          <span className="material-symbols-outlined text-white text-xl">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider truncate">
            {label}
          </p>
          <p
            className="font-headline text-2xl sm:text-3xl font-black text-on-surface transition-all"
            style={revealed ? {} : { filter: 'blur(10px)', userSelect: 'none' }}
          >
            {value}
          </p>
          {sub && (
            <p
              className="text-[11px] text-on-surface-variant truncate transition-all"
              style={revealed ? {} : { filter: 'blur(6px)', userSelect: 'none' }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>

      {!revealed && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900/80 text-white text-[11px] font-bold shadow-lg">
            <span className="material-symbols-outlined text-sm">touch_app</span>
            탭하여 확인
          </div>
        </div>
      )}
    </button>
  );
}
