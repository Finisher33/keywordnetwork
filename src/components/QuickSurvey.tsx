import { useState, ReactNode } from 'react';
import { useStore } from '../store';

interface QuickSurveyProps {
  onComplete: () => void;
}

type Errors = {
  condition?: string;
  memorableQuote?: string;
  fearWord?: string;
  excitingWord?: string;
  careerYears?: string;
};

// ─── 공통 카드: 큰 아이콘 + 질문 텍스트 ─────────────────────────────────────
function QuestionCard({
  icon,
  title,
  hint,
  error,
  children,
  accent = 'primary',
}: {
  icon: string;
  title: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  accent?: 'primary' | 'secondary' | 'amber' | 'rose' | 'emerald';
}) {
  const accentMap: Record<string, string> = {
    primary:  'from-blue-500/15 to-blue-400/5 text-primary border-primary/25',
    secondary:'from-cyan-500/15 to-cyan-400/5 text-secondary border-secondary/25',
    amber:    'from-amber-500/15 to-orange-400/5 text-amber-600 border-amber-500/30',
    rose:     'from-rose-500/15 to-pink-400/5 text-rose-600 border-rose-500/25',
    emerald:  'from-emerald-500/15 to-green-400/5 text-emerald-600 border-emerald-500/25',
  };
  return (
    <section className="bg-surface rounded-3xl border border-outline p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex items-start gap-4">
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${accentMap[accent]}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            {icon}
          </span>
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-[15px] sm:text-base font-bold text-on-surface leading-snug">
            {title}
          </h3>
          {hint && (
            <p className="mt-1 text-[12px] text-on-surface-variant/80 leading-snug">{hint}</p>
          )}
        </div>
      </div>
      {children}
      {error && (
        <p className="text-[12px] text-error font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">warning</span>
          {error}
        </p>
      )}
    </section>
  );
}

// ─── 슬라이더 (드래그 / 탭으로 값 선택) ─────────────────────────────────────
function ScaleSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  trackGradient,
  thumbColor,
}: {
  value: number | null;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  trackGradient: string;
  thumbColor: string;
}) {
  // 미선택 상태일 때 슬라이더는 중앙에 표시되지만 시각적으로 비활성처럼 보이게.
  const display = value ?? Math.round((min + max) / 2);
  const pct = ((display - min) / (max - min)) * 100;
  const isUntouched = value === null;

  return (
    <div className="relative pt-2 pb-1">
      {/* 트랙 배경 (그라데이션) */}
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full"
        style={{ background: trackGradient, opacity: isUntouched ? 0.35 : 1 }}
      />
      {/* 활성 진행 트랙 */}
      {!isUntouched && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none"
          style={{ width: `${pct}%`, background: thumbColor, opacity: 0.85 }}
        />
      )}
      {/* 네이티브 range — 접근성·터치·드래그 모두 자동 처리 */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => { if (isUntouched) onChange(display); }}
        className="qs-range relative w-full appearance-none bg-transparent"
        style={{ ['--qs-thumb' as any]: thumbColor }}
      />
    </div>
  );
}

// ─── 컨디션 무드 이모지 ────────────────────────────────────────────────────
function moodEmoji(v: number | null): string {
  if (v === null) return '🌫️';
  if (v <= 1) return '😴';
  if (v <= 3) return '😩';
  if (v <= 4) return '😟';
  if (v === 5) return '😐';
  if (v <= 7) return '🙂';
  if (v <= 9) return '😊';
  return '🤩';
}

// ─── 텍스트 한 줄 입력 ─────────────────────────────────────────────────────
function CleanTextInput({
  value,
  onChange,
  placeholder,
  error,
  accent = 'primary',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  accent?: 'primary' | 'amber' | 'rose';
}) {
  const accentRing: Record<string, string> = {
    primary: 'focus:ring-primary/30 focus:border-primary',
    amber:   'focus:ring-amber-500/30 focus:border-amber-500',
    rose:    'focus:ring-rose-500/30 focus:border-rose-500',
  };
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={60}
      className={`w-full bg-surface-container-low border rounded-xl px-4 py-3 text-[15px] font-medium text-on-surface outline-none focus:ring-2 transition-all ${
        accentRing[accent]
      } ${error ? 'border-error ring-2 ring-error/20' : 'border-outline'}`}
    />
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────
export default function QuickSurvey({ onComplete }: QuickSurveyProps) {
  const { currentUser, updateUser } = useStore();

  // 슬라이더 값은 null = "아직 선택 안 함"
  const [condition, setCondition] = useState<number | null>(null);
  const [careerYears, setCareerYears] = useState<number | null>(null);
  const [memorableQuote, setMemorableQuote] = useState('');
  const [fearWord, setFearWord] = useState('');
  const [excitingWord, setExcitingWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>('');

  const validate = (): boolean => {
    const next: Errors = {};
    if (condition === null) next.condition = '슬라이더를 움직여 점수를 선택해주세요.';
    if (!memorableQuote.trim()) next.memorableQuote = '한마디를 입력해주세요.';
    else if (memorableQuote.trim().length > 60) next.memorableQuote = '60자 이하로 입력해주세요.';
    if (!fearWord.trim()) next.fearWord = '단어를 입력해주세요.';
    else if (fearWord.trim().length > 60) next.fearWord = '60자 이하로 입력해주세요.';
    if (!excitingWord.trim()) next.excitingWord = '단어를 입력해주세요.';
    else if (excitingWord.trim().length > 60) next.excitingWord = '60자 이하로 입력해주세요.';
    if (careerYears === null) next.careerYears = '슬라이더를 움직여 경력을 선택해주세요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError('');
    if (!validate() || !currentUser) return;
    setIsSubmitting(true);
    try {
      await updateUser({
        ...currentUser,
        condition: condition!,
        memorableQuote: memorableQuote.trim(),
        fearWord: fearWord.trim(),
        excitingWord: excitingWord.trim(),
        careerYears: careerYears!,
        surveyCompleted: true,
      });
      onComplete();
    } catch (err: any) {
      console.error('Quick survey save failed:', err);
      setSubmitError(err?.message || '저장 중 오류가 발생했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 진행률 (필수 항목 5개 중 입력 완료 수)
  const progress = [
    condition !== null,
    memorableQuote.trim().length > 0,
    fearWord.trim().length > 0,
    excitingWord.trim().length > 0,
    careerYears !== null,
  ].filter(Boolean).length;

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-on-surface">
      <header className="header-safe shrink-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline shadow-sm">
        <div className="h-14 flex items-center justify-between px-6">
          <span className="font-headline text-xl font-bold tracking-tight text-primary">
            Keyword Survey
          </span>
          <span className="text-[11px] font-bold text-on-surface-variant">
            {progress} / 5 완료
          </span>
        </div>
        {/* 진행률 바 */}
        <div className="h-1 bg-surface-container-low overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(progress / 5) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-2xl space-y-4">
          {/* 인트로 */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <span className="material-symbols-outlined text-xl text-primary">waving_hand</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-headline text-lg sm:text-xl font-black text-on-surface tracking-tight">
                잠깐, 몇 가지만 여쭤볼게요
              </h2>
              <p className="text-xs text-on-surface-variant leading-snug">
                네트워킹에 활용되는 짧은 질문입니다 · 약 30초 소요
              </p>
            </div>
          </div>

          {/* ─── 컨디션 (슬라이더 + 이모지) ────────────────────────────── */}
          <QuestionCard
            icon="mood"
            title="오늘 나의 컨디션은 어떤가요?"
            hint="슬라이더를 좌우로 움직여보세요"
            error={errors.condition}
            accent="primary"
          >
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-[64px] leading-none transition-transform duration-200">
                {moodEmoji(condition)}
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-5xl font-black tracking-tight ${condition === null ? 'text-on-surface-variant/40' : 'text-primary'}`}>
                  {condition === null ? '–' : condition}
                </span>
                <span className="text-lg font-bold text-on-surface-variant">/ 10</span>
              </div>
            </div>
            <ScaleSlider
              value={condition}
              onChange={(v) => { setCondition(v); setErrors(p => ({ ...p, condition: undefined })); }}
              min={0}
              max={10}
              trackGradient="linear-gradient(to right, #fb7185 0%, #fbbf24 50%, #34d399 100%)"
              thumbColor="#3b82f6"
            />
            <div className="flex justify-between text-[11px] font-bold text-on-surface-variant/70 px-0.5 pt-1">
              <span>😩 0</span>
              <span>5</span>
              <span>10 🤩</span>
            </div>
          </QuestionCard>

          {/* ─── 기억에 남는 한마디 ──────────────────────────────────── */}
          <QuestionCard
            icon="format_quote"
            title="회사에서 들었던 가장 기억에 남는 한마디는?"
            hint="짧고 인상 깊었던 한 문장"
            error={errors.memorableQuote}
            accent="secondary"
          >
            <CleanTextInput
              value={memorableQuote}
              onChange={(v) => { setMemorableQuote(v); setErrors(p => ({ ...p, memorableQuote: undefined })); }}
              placeholder="예) 네가 곧 브랜드다"
              error={!!errors.memorableQuote}
              accent="primary"
            />
          </QuestionCard>

          {/* ─── 두렵게 하는 단어 ────────────────────────────────────── */}
          <QuestionCard
            icon="warning"
            title="요즘 나를 가장 두렵게 하는 단어는?"
            hint="떠오르는 한 단어"
            error={errors.fearWord}
            accent="rose"
          >
            <CleanTextInput
              value={fearWord}
              onChange={(v) => { setFearWord(v); setErrors(p => ({ ...p, fearWord: undefined })); }}
              placeholder="예) 면담요청"
              error={!!errors.fearWord}
              accent="rose"
            />
          </QuestionCard>

          {/* ─── 설레게 하는 단어 ────────────────────────────────────── */}
          <QuestionCard
            icon="favorite"
            title="요즘 나를 가장 설레게 하는 단어는?"
            hint="가슴 뛰는 한 단어"
            error={errors.excitingWord}
            accent="amber"
          >
            <CleanTextInput
              value={excitingWord}
              onChange={(v) => { setExcitingWord(v); setErrors(p => ({ ...p, excitingWord: undefined })); }}
              placeholder="예) 여름휴가"
              error={!!errors.excitingWord}
              accent="amber"
            />
          </QuestionCard>

          {/* ─── 경력 (슬라이더) ────────────────────────────────────── */}
          <QuestionCard
            icon="work_history"
            title="HMG 근무 경력은 총 몇 년인가요?"
            hint="슬라이더를 움직여 연차를 선택해주세요"
            error={errors.careerYears}
            accent="emerald"
          >
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="flex items-baseline gap-1">
                <span className={`text-5xl font-black tracking-tight ${careerYears === null ? 'text-on-surface-variant/40' : 'text-emerald-600'}`}>
                  {careerYears === null ? '–' : careerYears}
                </span>
                <span className="text-lg font-bold text-on-surface-variant">년차</span>
              </div>
              {careerYears !== null && (
                <span className="text-[11px] font-bold text-on-surface-variant/70">
                  {careerYears <= 5 ? '주니어' : careerYears <= 15 ? '시니어' : careerYears <= 25 ? '리더' : '마스터'}
                </span>
              )}
            </div>
            <ScaleSlider
              value={careerYears}
              onChange={(v) => { setCareerYears(v); setErrors(p => ({ ...p, careerYears: undefined })); }}
              min={1}
              max={40}
              trackGradient="linear-gradient(to right, #a7f3d0 0%, #34d399 50%, #047857 100%)"
              thumbColor="#10b981"
            />
            <div className="flex justify-between text-[11px] font-bold text-on-surface-variant/70 px-0.5 pt-1">
              <span>1년</span>
              <span>10년</span>
              <span>20년</span>
              <span>30년</span>
              <span>40년</span>
            </div>
          </QuestionCard>

          {submitError && (
            <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {submitError}
            </div>
          )}
        </div>
      </main>

      {/* 하단 제출 버튼 */}
      <div
        className="shrink-0 px-4 sm:px-6 pt-3 bg-white/90 backdrop-blur-md border-t border-outline shadow-lg"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-2xl mx-auto w-full">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-4 bg-primary text-white font-headline font-bold rounded-2xl shadow-xl active:scale-95 hover:opacity-90 transition-all flex items-center justify-center gap-2 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                저장 중...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">check_circle</span>
                제출하고 입장하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
