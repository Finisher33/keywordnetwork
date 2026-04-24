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

// 부모 컴포넌트 바깥에 선언 — 리렌더마다 새 함수 참조가 만들어지면
// React가 input을 unmount/remount 하면서 포커스가 튕기는 문제를 방지
const Question = ({
  num,
  icon,
  children,
  error,
}: {
  num: number;
  icon: string;
  error?: string;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-[2.25rem_1fr] gap-x-3 gap-y-1.5 items-start">
    <span className="shrink-0 w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center text-xs font-black">
      Q{num}
    </span>
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-start gap-1.5 text-[15px] sm:text-base font-bold text-on-surface leading-relaxed flex-wrap">
        <span className="material-symbols-outlined text-[20px] text-primary/70 mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {error && (
        <p className="text-[11px] text-error font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">warning</span>
          {error}
        </p>
      )}
    </div>
  </div>
);

// 인라인 숫자 입력 박스
function NumInput({
  value,
  onChange,
  min,
  max,
  placeholder,
  width = 'w-20',
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  placeholder?: string;
  width?: string;
  error?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`inline-block ${width} text-center bg-surface-container-low border rounded-lg px-2 py-1 text-[15px] font-bold text-primary outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
        error ? 'border-error ring-2 ring-error/20' : 'border-outline'
      }`}
    />
  );
}

// 인라인 텍스트 입력 박스
function TextInput({
  value,
  onChange,
  placeholder,
  width = 'min-w-[8rem] max-w-[14rem]',
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
  error?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={60}
      className={`inline-block ${width} bg-surface-container-low border rounded-lg px-2.5 py-1 text-[15px] font-bold text-primary outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${
        error ? 'border-error ring-2 ring-error/20' : 'border-outline'
      }`}
    />
  );
}

export default function QuickSurvey({ onComplete }: QuickSurveyProps) {
  const { currentUser, updateUser } = useStore();
  const [condition, setCondition] = useState('');
  const [memorableQuote, setMemorableQuote] = useState('');
  const [fearWord, setFearWord] = useState('');
  const [excitingWord, setExcitingWord] = useState('');
  const [careerYears, setCareerYears] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>('');

  const validate = (): boolean => {
    const next: Errors = {};
    const c = Number(condition.trim());
    const y = Number(careerYears.trim());

    if (!condition.trim()) next.condition = '컨디션 점수를 입력해주세요.';
    else if (isNaN(c) || c < 0 || c > 10) next.condition = '0~10 사이 숫자를 입력해주세요.';

    if (!memorableQuote.trim()) next.memorableQuote = '키워드를 입력해주세요.';
    else if (memorableQuote.trim().length > 60) next.memorableQuote = '60자 이하로 입력해주세요.';

    if (!fearWord.trim()) next.fearWord = '키워드를 입력해주세요.';
    else if (fearWord.trim().length > 60) next.fearWord = '60자 이하로 입력해주세요.';

    if (!excitingWord.trim()) next.excitingWord = '키워드를 입력해주세요.';
    else if (excitingWord.trim().length > 60) next.excitingWord = '60자 이하로 입력해주세요.';

    if (!careerYears.trim()) next.careerYears = '경력 연수를 입력해주세요.';
    else if (isNaN(y) || y < 1 || y > 40) next.careerYears = '1~40 사이 숫자를 입력해주세요.';

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
        condition: Number(condition.trim()),
        memorableQuote: memorableQuote.trim(),
        fearWord: fearWord.trim(),
        excitingWord: excitingWord.trim(),
        careerYears: Number(careerYears.trim()),
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

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-on-surface">
      <header className="header-safe shrink-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline shadow-sm">
        <div className="h-14 flex items-center px-6">
          <span className="font-headline text-xl font-bold tracking-tight text-primary">Check in Survey</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col items-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-2xl space-y-5">
          {/* 인트로 */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
              <span className="material-symbols-outlined text-xl text-primary">quiz</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-headline text-lg sm:text-xl font-black text-on-surface tracking-tight">
                잠깐, 몇 가지만 여쭤볼게요!
              </h2>
              <p className="text-xs text-on-surface-variant leading-snug">
                네트워킹에 활용되는 짧은 질문입니다. (약 30초 소요)
              </p>
            </div>
          </div>

          {/* 카드 */}
          <div className="bg-surface border border-outline rounded-3xl p-4 sm:p-6 shadow-sm space-y-6">

            {/* Q1. 오늘 컨디션 */}
            <Question num={1} icon="mood" error={errors.condition}>
              나의 오늘 컨디션은 10점 만점에{' '}
              <NumInput
                value={condition}
                onChange={(v) => { setCondition(v); setErrors(p => ({ ...p, condition: undefined })); }}
                min={0}
                max={10}
                placeholder="0~10"
                width="w-16"
                error={!!errors.condition}
              />{' '}
              점 이다.
            </Question>

            {/* Q2. 기억에 남는 한마디 */}
            <Question num={2} icon="format_quote" error={errors.memorableQuote}>
              회사에서 들었던 가장 기억에 남는 한마디는{' '}
              <TextInput
                value={memorableQuote}
                onChange={(v) => { setMemorableQuote(v); setErrors(p => ({ ...p, memorableQuote: undefined })); }}
                placeholder="예) 네가 곧 브랜드다"
                error={!!errors.memorableQuote}
              />{' '}
              였다.
            </Question>

            {/* Q3. 두렵게 하는 단어 */}
            <Question num={3} icon="warning" error={errors.fearWord}>
              요즘 나를 가장 두렵게 하는 단어는{' '}
              <TextInput
                value={fearWord}
                onChange={(v) => { setFearWord(v); setErrors(p => ({ ...p, fearWord: undefined })); }}
                placeholder="예) 인사평가"
                error={!!errors.fearWord}
              />{' '}
              (이)다.
            </Question>

            {/* Q4. 설레게 하는 단어 */}
            <Question num={4} icon="favorite" error={errors.excitingWord}>
              요즘 나를 가장 설레게 하는 단어는{' '}
              <TextInput
                value={excitingWord}
                onChange={(v) => { setExcitingWord(v); setErrors(p => ({ ...p, excitingWord: undefined })); }}
                placeholder="예) 여름휴가"
                error={!!errors.excitingWord}
              />{' '}
              (이)다.
            </Question>

            {/* Q5. 경력 */}
            <Question num={5} icon="work_history" error={errors.careerYears}>
              나의 HMG 근무 경력은 총{' '}
              <NumInput
                value={careerYears}
                onChange={(v) => { setCareerYears(v); setErrors(p => ({ ...p, careerYears: undefined })); }}
                min={1}
                max={40}
                placeholder="1~40"
                width="w-16"
                error={!!errors.careerYears}
              />{' '}
              년이다.
            </Question>
          </div>

          {submitError && (
            <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {submitError}
            </div>
          )}
        </div>
      </main>

      {/* 하단 버튼 */}
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
