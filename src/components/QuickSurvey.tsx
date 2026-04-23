import { useState, ReactNode } from 'react';
import { useStore } from '../store';

interface QuickSurveyProps {
  onComplete: () => void;
}

type Errors = {
  golf?: string;
  career?: string;
  lotto?: string;
  known?: string;
  drink?: string;
};

const LOTTO_OPTIONS = ['1등', '2등', '3등', '4등', '5등', '꽝'];

export default function QuickSurvey({ onComplete }: QuickSurveyProps) {
  const { currentUser, updateUser } = useStore();
  const [golfScore, setGolfScore] = useState('');
  const [careerYears, setCareerYears] = useState('');
  const [lottoRank, setLottoRank] = useState('');
  const [knownPeople, setKnownPeople] = useState('');
  const [drinkingCapacity, setDrinkingCapacity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>('');

  const validate = (): boolean => {
    const next: Errors = {};
    const golfNum = Number(golfScore.trim());
    const careerNum = Number(careerYears.trim());
    const knownNum = Number(knownPeople.trim());
    const drinkNum = Number(drinkingCapacity.trim());

    if (!golfScore.trim()) next.golf = '타수를 입력해주세요.';
    else if (isNaN(golfNum) || golfNum < 60 || golfNum > 200) next.golf = '60~200 사이 숫자를 입력해주세요.';

    if (!careerYears.trim()) next.career = '경력 연수를 입력해주세요.';
    else if (isNaN(careerNum) || careerNum < 1 || careerNum > 40) next.career = '1~40 사이 숫자를 입력해주세요.';

    if (!lottoRank) next.lotto = '당첨 등수를 선택해주세요.';

    if (!knownPeople.trim()) next.known = '인원 수를 입력해주세요.';
    else if (isNaN(knownNum) || knownNum < 0 || knownNum > 30) next.known = '0~30 사이 숫자를 입력해주세요.';

    if (!drinkingCapacity.trim()) next.drink = '주량을 입력해주세요.';
    else if (isNaN(drinkNum) || drinkNum < 0 || drinkNum > 20) next.drink = '0~20 사이 숫자를 입력해주세요.';

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
        golfScore: Number(golfScore.trim()),
        careerYears: Number(careerYears.trim()),
        lottoRank,
        knownPeople: Number(knownPeople.trim()),
        drinkingCapacity: Number(drinkingCapacity.trim()),
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

  const inputWrap = (hasError: boolean) =>
    `flex items-center gap-2 bg-surface-container-low border rounded-xl px-3.5 py-2.5 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${
      hasError ? 'border-error ring-2 ring-error/20' : 'border-outline'
    }`;

  // 질문 한 줄 레이아웃: 번호 / 라벨 / 입력창 모두 좌측 기준 정렬
  const Question = ({
    num,
    icon,
    label,
    hint,
    error,
    children,
  }: {
    num: number;
    icon: string;
    label: string;
    hint?: string;
    error?: string;
    children: ReactNode;
  }) => (
    <div className="grid grid-cols-[2.25rem_1fr] gap-x-3 gap-y-1.5 items-start">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center text-xs font-black">
        Q{num}
      </span>
      <div className="min-w-0 space-y-1.5">
        <label className="flex items-center gap-1.5 text-sm font-bold text-on-surface leading-snug">
          <span className="material-symbols-outlined text-[18px] text-primary/70">{icon}</span>
          {label}
        </label>
        {children}
        {error && (
          <p className="text-[11px] text-error font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">warning</span>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-on-surface-variant/60">{hint}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-on-surface">
      <header className="header-safe shrink-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline shadow-sm">
        <div className="h-14 flex items-center px-6">
          <span className="font-headline text-xl font-bold tracking-tight text-primary">Quick Survey</span>
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
          <div className="bg-surface border border-outline rounded-3xl p-4 sm:p-6 shadow-sm space-y-5">

            <Question
              num={1}
              icon="sports_golf"
              label="골프, 보통 몇 타 치세요?"
              hint="60 ~ 백돌이(100+) 사이 아무 숫자나 적어주세요."
              error={errors.golf}
            >
              <div className={inputWrap(!!errors.golf)}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={golfScore}
                  onChange={e => { setGolfScore(e.target.value); setErrors(p => ({ ...p, golf: undefined })); }}
                  placeholder="예) 90"
                  min={60}
                  max={200}
                  className="flex-1 bg-transparent border-none p-0 text-base outline-none text-on-surface placeholder:text-on-surface-variant/40 font-medium min-w-0"
                />
                <span className="text-sm text-on-surface-variant font-medium shrink-0">타</span>
              </div>
            </Question>

            <Question
              num={2}
              icon="work_history"
              label="HMG에서 총 몇 년의 경력을 갖고 계신가요?"
              hint="현대자동차그룹 계열사 포함 총 재직 기간 (1~40년)."
              error={errors.career}
            >
              <div className={inputWrap(!!errors.career)}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={careerYears}
                  onChange={e => { setCareerYears(e.target.value); setErrors(p => ({ ...p, career: undefined })); }}
                  placeholder="예) 10"
                  min={1}
                  max={40}
                  className="flex-1 bg-transparent border-none p-0 text-base outline-none text-on-surface placeholder:text-on-surface-variant/40 font-medium min-w-0"
                />
                <span className="text-sm text-on-surface-variant font-medium shrink-0">년</span>
              </div>
            </Question>

            <Question
              num={3}
              icon="emoji_events"
              label="로또, 최고 몇 등까지 당첨되어 보셨어요?"
              hint="경험이 없으시면 '꽝'을 선택해주세요."
              error={errors.lotto}
            >
              <div className="flex flex-wrap gap-1.5">
                {LOTTO_OPTIONS.map(opt => {
                  const active = lottoRank === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setLottoRank(opt); setErrors(p => ({ ...p, lotto: undefined })); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        active
                          ? 'bg-primary text-on-primary border-primary shadow-sm'
                          : 'bg-surface text-on-surface-variant border-outline hover:border-primary/60 hover:text-primary hover:bg-primary/5'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </Question>

            <Question
              num={4}
              icon="group"
              label="오늘 강의장 리더분들 중 이미 아시는 분은 몇 분이십니까?"
              hint="0명 ~ 30명 사이 숫자로 입력."
              error={errors.known}
            >
              <div className={inputWrap(!!errors.known)}>
                <input
                  type="number"
                  inputMode="numeric"
                  value={knownPeople}
                  onChange={e => { setKnownPeople(e.target.value); setErrors(p => ({ ...p, known: undefined })); }}
                  placeholder="예) 3"
                  min={0}
                  max={30}
                  className="flex-1 bg-transparent border-none p-0 text-base outline-none text-on-surface placeholder:text-on-surface-variant/40 font-medium min-w-0"
                />
                <span className="text-sm text-on-surface-variant font-medium shrink-0">명</span>
              </div>
            </Question>

            <Question
              num={5}
              icon="local_bar"
              label="주량이 어떻게 되세요? (소주 기준)"
              hint="소주 병 단위로 소수점까지 입력 가능합니다. (예: 1.5)"
              error={errors.drink}
            >
              <div className={inputWrap(!!errors.drink)}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={drinkingCapacity}
                  onChange={e => { setDrinkingCapacity(e.target.value); setErrors(p => ({ ...p, drink: undefined })); }}
                  placeholder="예) 1.5"
                  min={0}
                  max={20}
                  className="flex-1 bg-transparent border-none p-0 text-base outline-none text-on-surface placeholder:text-on-surface-variant/40 font-medium min-w-0"
                />
                <span className="text-sm text-on-surface-variant font-medium shrink-0">병</span>
              </div>
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
