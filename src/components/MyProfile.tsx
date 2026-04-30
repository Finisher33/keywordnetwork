import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { useStore, Interest, User } from '../store';
import { HYUNDAI_COMPANIES } from '../constants/companies';

const ZODIAC_ANIMALS = [
  { name: '쥐 (자)', label: '🐭 쥐', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Mouse%20Face.png' },
  { name: '소 (축)', label: '🐮 소', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Cow%20Face.png' },
  { name: '호랑이 (인)', label: '🐯 호랑이', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Tiger%20Face.png' },
  { name: '토끼 (묘)', label: '🐰 토끼', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Rabbit%20Face.png' },
  { name: '용 (진)', label: '🐲 용', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dragon%20Face.png' },
  { name: '뱀 (사)', label: '🐍 뱀', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Snake.png' },
  { name: '말 (오)', label: '🐴 말', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Horse%20Face.png' },
  { name: '양 (미)', label: '🐑 양', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Ewe.png' },
  { name: '원숭이 (신)', label: '🐵 원숭이', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Monkey%20Face.png' },
  { name: '닭 (유)', label: '🐔 닭', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Chicken.png' },
  { name: '개 (술)', label: '🐶 개', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dog%20Face.png' },
  { name: '돼지 (해)', label: '🐷 돼지', url: 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Pig%20Face.png' },
];

interface MyProfileProps {
  onSave: () => void;
  onLogout?: () => void;
  showBack?: boolean;
  targetUser?: User;
}

type KeywordEntry = {
  keyword: string;
  description: string;
  isCustom: boolean;
  keywordGroup: 'work' | 'hobby' | '';
  customInput: string;
};

interface KeywordCardProps {
  entry: KeywordEntry;
  idx: number;
  role: 'giver' | 'taker';
  canRemove: boolean;
  accent: 'primary' | 'secondary';
  sortedWorkPresets: { id: string; keyword: string; group?: string }[];
  sortedHobbyPresets: { id: string; keyword: string; group?: string }[];
  usedKeywords: Map<string, { role: 'giver' | 'taker'; idx: number }>;
  onUpdate: (idx: number, patch: Partial<KeywordEntry>) => void;
  onRemove: (idx: number) => void;
}

const KeywordCard = memo(function KeywordCard({
  entry, idx, role, canRemove, accent,
  sortedWorkPresets, sortedHobbyPresets,
  usedKeywords, onUpdate, onRemove,
}: KeywordCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accentClass = accent === 'primary' ? 'primary' : 'secondary';
  const presets = entry.keywordGroup === 'work' ? sortedWorkPresets : entry.keywordGroup === 'hobby' ? sortedHobbyPresets : [];

  // 직접입력 클릭 시에만 입력칸 포커스 (사용자가 즉시 타이핑 가능하도록).
  // 프리셋 클릭 시에는 자동 이동 금지 — 사용자가 수동으로 다음 단계로 이동.
  useEffect(() => {
    if (entry.isCustom && inputRef.current) {
      inputRef.current.focus();
    }
  }, [entry.isCustom]);

  const update = useCallback((patch: Partial<KeywordEntry>) => {
    onUpdate(idx, patch);
  }, [onUpdate, idx]);

  const isKeywordUsedElsewhere = (keyword: string): boolean => {
    const kw = keyword.trim().toLowerCase();
    const found = usedKeywords.get(kw);
    if (!found) return false;
    return !(found.role === role && found.idx === idx);
  };

  const selectHashtag = (keyword: string) => {
    // 프리셋 키워드 선택 후 자동 포커스 이동 없음 (사용자 수동 조작)
    update({ keyword, isCustom: false, customInput: '' });
  };

  const handleCustomInput = (val: string) => {
    update({ customInput: val, keyword: val.trim() });
  };

  const duplicateWarning = !!(entry.keyword.trim() && isKeywordUsedElsewhere(entry.keyword));

  return (
    <div className="bg-surface-container-low p-5 rounded-3xl border border-outline space-y-4 relative shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold text-${accentClass} bg-${accentClass}/10 px-2 py-0.5 rounded-full uppercase tracking-widest`}>
          {role === 'giver' ? 'Giver' : 'Taker'} Keyword {idx + 1}
        </span>
        <button
          onClick={() => onRemove(idx)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${canRemove ? 'bg-error/10 text-error hover:bg-error/20' : 'bg-surface-container-highest text-on-surface-variant/20 cursor-not-allowed'}`}
          disabled={!canRemove}
          title={canRemove ? '삭제' : '최소 2개 항목이 필요합니다'}
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">
          Step 1 · 키워드 유형 선택
        </label>
        <div className="flex gap-2">
          {([
            { key: 'work' as const, label: '💼 업무' },
            { key: 'hobby' as const, label: '🎨 취미' },
          ]).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => update({ keywordGroup: opt.key, keyword: '', isCustom: false, customInput: '' })}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                entry.keywordGroup === opt.key
                  ? `bg-${accentClass} text-on-${accentClass} border-${accentClass} shadow-sm`
                  : `bg-surface text-on-surface-variant border-outline hover:border-${accentClass}/50`
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {entry.keywordGroup && (
        <div className="space-y-3">
          <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">
            Step 2 · 키워드 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p: { id: string; keyword: string }) => {
              const isSelected = !entry.isCustom && entry.keyword === p.keyword;
              const isUsed = isKeywordUsedElsewhere(p.keyword);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isUsed}
                  onClick={() => !isUsed && selectHashtag(p.keyword)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${
                    isSelected
                      ? `bg-${accentClass} text-on-${accentClass} border-${accentClass} shadow-sm`
                      : isUsed
                        ? 'bg-surface-container-highest text-on-surface-variant/30 border-outline/40 cursor-not-allowed line-through'
                        : `bg-surface text-on-surface-variant border-outline hover:border-${accentClass}/60 hover:text-${accentClass} hover:bg-${accentClass}/5`
                  }`}
                >
                  {p.keyword}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => update({ isCustom: true, keyword: entry.customInput.trim() || '', customInput: entry.customInput })}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all flex items-center gap-1 ${
                entry.isCustom
                  ? `bg-${accentClass} text-on-${accentClass} border-${accentClass} shadow-sm`
                  : `bg-surface text-on-surface-variant border-dashed border-outline hover:border-${accentClass}/60 hover:text-${accentClass} hover:bg-${accentClass}/5`
              }`}
            >
              <span className="material-symbols-outlined text-base">edit</span>
              직접입력
            </button>
          </div>

          {entry.isCustom && (
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={entry.customInput}
                onChange={e => handleCustomInput(e.target.value)}
                placeholder="원하는 키워드를 직접 입력하세요"
                className={`w-full bg-surface border rounded-xl px-4 py-2.5 text-base outline-none transition-all text-on-surface border-${accentClass} ring-2 ring-${accentClass}/20`}
              />
              {entry.customInput && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-${accentClass} text-lg`}>check_circle</span>
              )}
            </div>
          )}

          {duplicateWarning && (
            <p className="text-sm text-error font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-base">warning</span>
              이미 등록된 키워드입니다. 중복 키워드는 사용할 수 없습니다.
            </p>
          )}
        </div>
      )}

      {entry.keyword.trim() && !duplicateWarning && (
        <div className="space-y-2">
          <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">
            Step 3 · 상세 내용 입력
          </label>
          <div className={`text-sm text-${accentClass}/80 font-medium bg-${accentClass}/5 px-3 py-1.5 rounded-lg inline-flex items-center gap-1`}>
            <span className="material-symbols-outlined text-base">tag</span>
            {entry.keyword}
          </div>
          <textarea
            value={entry.description}
            onChange={e => update({ description: e.target.value })}
            placeholder={role === 'giver'
              ? `"${entry.keyword}"에 대해 어떤 도움을 줄 수 있는지 구체적으로 적어주세요.`
              : `"${entry.keyword}"에 대해 어떤 배움을 얻고 싶은지 구체적으로 적어주세요.`
            }
            rows={3}
            className={`w-full bg-surface border border-outline rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-${accentClass}/20 focus:border-${accentClass} transition-all resize-none text-on-surface`}
          />
        </div>
      )}
    </div>
  );
});

export default function MyProfile({ onSave, onLogout, showBack = true, targetUser }: MyProfileProps) {
  const { currentUser: loggedInUser, db, updateUserProfile } = useStore();
  const userToEdit = targetUser || loggedInUser;

  const [company, setCompany] = useState(userToEdit?.company || '');
  const [customCompany, setCustomCompany] = useState('');
  const [isOtherCompany, setIsOtherCompany] = useState(false);

  useMemo(() => {
    if (userToEdit?.company && !HYUNDAI_COMPANIES.includes(userToEdit.company)) {
      setCompany('직접입력');
      setCustomCompany(userToEdit.company);
      setIsOtherCompany(true);
    }
  }, [userToEdit?.company]);

  const [name, setName] = useState(userToEdit?.name || '');
  const [department, setDepartment] = useState(userToEdit?.department || '');
  const [title, setTitle] = useState(userToEdit?.title || '');
  const [profilePic, setProfilePic] = useState(() => {
    if (userToEdit?.profilePic) return userToEdit.profilePic;
    return ZODIAC_ANIMALS[Math.floor(Math.random() * ZODIAC_ANIMALS.length)].url;
  });

  const myInterests = useMemo(() => db.interests.filter(i => i.userId === userToEdit?.id), [db.interests, userToEdit]);
  const initialGivers = useMemo(() => myInterests.filter(i => i.type === 'giver').map(i => ({ keyword: i.keyword, description: i.description })), [myInterests]);
  const initialTakers = useMemo(() => myInterests.filter(i => i.type === 'taker').map(i => ({ keyword: i.keyword, description: i.description })), [myInterests]);
  const presetKeywords = useMemo(() => db.presetInterests.map(p => p.keyword), [db.presetInterests]);

  const inferGroup = (keyword: string): 'work' | 'hobby' | '' => {
    if (!keyword) return '';
    const preset = db.presetInterests.find(p => p.keyword === keyword);
    if (!preset) return 'work';
    return preset.group === 'hobby' ? 'hobby' : 'work';
  };

  const makeEntry = (keyword: string, description: string): KeywordEntry => ({
    keyword,
    description,
    isCustom: keyword !== '' && !presetKeywords.includes(keyword),
    keywordGroup: inferGroup(keyword),
    customInput: keyword !== '' && !presetKeywords.includes(keyword) ? keyword : '',
  });

  const emptyEntry = (): KeywordEntry => ({
    keyword: '', description: '', isCustom: false, keywordGroup: '', customInput: '',
  });

  const [givers, setGivers] = useState<KeywordEntry[]>(() => {
    const base = initialGivers.map(g => makeEntry(g.keyword, g.description));
    return base.length >= 2 ? base : [...base, ...Array.from({ length: 2 - base.length }, emptyEntry)];
  });

  const [takers, setTakers] = useState<KeywordEntry[]>(() => {
    const base = initialTakers.map(t => makeEntry(t.keyword, t.description));
    return base.length >= 2 ? base : [...base, ...Array.from({ length: 2 - base.length }, emptyEntry)];
  });

  const sortedWorkPresets = useMemo(() =>
    [...db.presetInterests].filter(p => (p.group ?? 'work') === 'work').sort((a, b) => a.keyword.localeCompare(b.keyword)),
    [db.presetInterests]
  );
  const sortedHobbyPresets = useMemo(() =>
    [...db.presetInterests].filter(p => p.group === 'hobby').sort((a, b) => a.keyword.localeCompare(b.keyword)),
    [db.presetInterests]
  );

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 전체 Giver+Taker 중 이미 사용된 키워드 (중복 방지)
  const allUsedKeywords = useMemo(() => {
    const used = new Map<string, { role: 'giver' | 'taker'; idx: number }>();
    givers.forEach((g, i) => { if (g.keyword.trim()) used.set(g.keyword.trim().toLowerCase(), { role: 'giver', idx: i }); });
    takers.forEach((t, i) => { if (t.keyword.trim()) used.set(t.keyword.trim().toLowerCase(), { role: 'taker', idx: i }); });
    return used;
  }, [givers, takers]);

  const isKeywordUsedElsewhere = (keyword: string, role: 'giver' | 'taker', idx: number): boolean => {
    const entry = allUsedKeywords.get(keyword.trim().toLowerCase());
    if (!entry) return false;
    return !(entry.role === role && entry.idx === idx);
  };

  const handleSave = async () => {
    if (!userToEdit) return;
    const validGivers = givers.filter(g => g.keyword.trim() && g.description.trim());
    const validTakers = takers.filter(t => t.keyword.trim() && t.description.trim());

    if (validGivers.length < 2 || validTakers.length < 2) {
      showToast('Giver와 Taker 각각 최소 2개 이상의 키워드와 세부 내용을 입력해주세요.', 'error');
      return;
    }

    // 중복 검사
    const allKeywords = [...validGivers.map(g => g.keyword.trim().toLowerCase()), ...validTakers.map(t => t.keyword.trim().toLowerCase())];
    const uniqueKeywords = new Set(allKeywords);
    if (uniqueKeywords.size !== allKeywords.length) {
      showToast('Giver와 Taker 전체에서 동일한 관심사는 1번만 등록할 수 있습니다. 중복된 키워드를 제거해주세요.', 'error');
      return;
    }

    setIsSaving(true);
    // id 충돌 방지: Date.now() + crypto 랜덤 + 인덱스로 고유성 강화
    const makeId = (prefix: string, idx: number) =>
      `${Date.now()}_${prefix}_${idx}_${Math.random().toString(36).slice(2, 10)}`;
    const newInterests: Interest[] = [
      ...validGivers.map((g, i) => ({
        id: makeId('g', i),
        userId: userToEdit.id,
        type: 'giver' as const,
        keyword: g.keyword,
        description: g.description
      })),
      ...validTakers.map((t, i) => ({
        id: makeId('t', i),
        userId: userToEdit.id,
        type: 'taker' as const,
        keyword: t.keyword,
        description: t.description
      }))
    ];

    // Watchdog: 20초 내 응답 없으면 사용자에게 알리고 버튼을 잠금 해제.
    // 인앱브라우저/PC에서 fetch 가 조용히 멈추는 에지케이스 대비.
    let watchdogFired = false;
    const watchdog = setTimeout(() => {
      watchdogFired = true;
      console.warn('[MyProfile] save watchdog fired — updateUserProfile has not resolved in 20s');
      setIsSaving(false);
      showToast('저장이 지연되고 있습니다. 네트워크를 확인하거나 페이지를 새로고침 해주세요.', 'error');
    }, 20000);

    try {
      console.log('[MyProfile] save start', { userId: userToEdit.id, interestCount: newInterests.length });
      await updateUserProfile({
        ...userToEdit,
        company: company === '직접입력' ? customCompany : company,
        name, department, title, profilePic
      }, newInterests);
      console.log('[MyProfile] save complete — calling onSave()');
      clearTimeout(watchdog);
      if (watchdogFired) return;
      // 다음 task 로 넘겨 React 의 setState 배칭이 완전히 flush 된 뒤 네비게이션 수행.
      // (즉시 호출 시 부모 리렌더 타이밍과 충돌해 라우팅이 씹히는 경우 방지)
      setTimeout(() => {
        try {
          onSave();
        } catch (navErr) {
          console.error('[MyProfile] onSave threw:', navErr);
        }
      }, 0);
    } catch (error: any) {
      clearTimeout(watchdog);
      if (watchdogFired) return;
      console.error("Failed to save profile:", error);
      showToast(error?.message || '프로필 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      if (!watchdogFired) setIsSaving(false);
    }
  };

  const addGiver = () => {
    if (givers.length < 5) setGivers([...givers, emptyEntry()]);
  };
  const removeGiver = (idx: number) => {
    if (givers.length > 2) setGivers(givers.filter((_, i) => i !== idx));
  };
  const addTaker = () => {
    if (takers.length < 5) setTakers([...takers, emptyEntry()]);
  };
  const removeTaker = (idx: number) => {
    if (takers.length > 2) setTakers(takers.filter((_, i) => i !== idx));
  };

  const updateGiver = useCallback((idx: number, patch: Partial<KeywordEntry>) => {
    setGivers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const updateTaker = useCallback((idx: number, patch: Partial<KeywordEntry>) => {
    setTakers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-on-surface">
      {/* 인앱브라우저 호환 토스트 (alert() 대체) */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-base font-bold max-w-[90vw] transition-all ${
          toast.type === 'success'
            ? 'bg-primary text-on-primary'
            : 'bg-error text-on-error'
        }`}>
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'warning'}
          </span>
          {toast.message}
        </div>
      )}
      <header className="header-safe shrink-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline shadow-sm">
        <div className="h-14 flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
            {showBack && (
              <button onClick={onSave} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            )}
            <span className="font-headline text-xl font-bold tracking-tight text-primary">내 프로필 설정</span>
          </div>
          {onLogout && (
            <div className="bg-surface-container-low border border-outline rounded-xl p-1 flex items-center shadow-sm">
              <button
                onClick={onLogout}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                title="로그아웃"
                aria-label="로그아웃"
              >
                {/* 미니멀한 power 아이콘 — 시각적 단순성 + 즉각 인지 */}
                <span className="material-symbols-outlined text-[22px]">power_settings_new</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-8 pb-32 max-w-2xl mx-auto px-4 sm:px-6 space-y-10 w-full">
        <section className="bg-surface p-6 rounded-3xl border border-outline space-y-8 shadow-sm">
          {/* 프로필 사진 */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="w-28 h-28 rounded-3xl border-2 border-primary/30 overflow-hidden bg-surface-container-low flex items-center justify-center shadow-md">
                {profilePic ? (
                  profilePic.length < 5 ? (
                    <span className="text-5xl">{profilePic}</span>
                  ) : (
                    <img loading="lazy" decoding="async" src={profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )
                ) : (
                  <span className="material-symbols-outlined text-8xl text-primary/40">face</span>
                )}
              </div>
            </div>
            <div className="space-y-3 w-full">
              <p className="text-xs font-bold text-on-surface-variant uppercase text-center tracking-widest">프로필 아이콘 선택</p>
              <div className="grid grid-cols-6 gap-2">
                {ZODIAC_ANIMALS.map(animal => (
                  <button
                    key={animal.url}
                    onClick={() => setProfilePic(animal.url)}
                    className={`flex items-center justify-center p-1.5 rounded-2xl transition-all ${profilePic === animal.url ? 'border-2 border-primary shadow-md scale-110 bg-primary/10' : 'border border-outline opacity-70 hover:opacity-100 hover:bg-primary/5 bg-surface-container-low'}`}
                  >
                    <img loading="lazy" decoding="async" src={animal.url} alt="" className="w-9 h-9 object-contain" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">회사</label>
              <div className="bg-surface-container-low rounded-xl border border-outline focus-within:border-primary transition-colors flex items-center relative">
                <select
                  value={company}
                  onChange={e => {
                    setCompany(e.target.value);
                    setIsOtherCompany(e.target.value === '직접입력');
                  }}
                  className="w-full bg-transparent border-none px-4 py-3 text-base outline-none text-on-surface appearance-none cursor-pointer pr-10"
                >
                  <option value="" disabled>회사를 선택하세요</option>
                  {HYUNDAI_COMPANIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-on-surface-variant text-base absolute right-3 pointer-events-none">expand_more</span>
              </div>
            </div>
            {isOtherCompany && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">회사명 직접 입력</label>
                <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
                  <input
                    type="text"
                    value={customCompany}
                    onChange={e => setCustomCompany(e.target.value)}
                    placeholder="회사명을 입력하세요"
                    className="w-full bg-transparent border-none p-0 text-base outline-none text-on-surface"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">성명</label>
              <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-none p-0 text-base outline-none text-on-surface" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">담당 조직</label>
              <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
                <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-transparent border-none p-0 text-base outline-none text-on-surface" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant uppercase ml-1 tracking-widest">직책</label>
              <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-none p-0 text-base outline-none text-on-surface" />
              </div>
            </div>
          </div>

          <hr className="border-outline" />

          {/* 관심사 편집 */}
          <div className="space-y-12">
            {/* Giver */}
            <div className="space-y-6">
              <div className="border-b border-primary/20 pb-2">
                <h3 className="flex items-center gap-2 min-w-0 overflow-hidden text-primary">
                  <span className="material-symbols-outlined shrink-0">volunteer_activism</span>
                  <span className="text-lg font-headline font-bold shrink-0">Giver</span>
                  <span className="text-sm font-normal text-on-surface-variant truncate">· 도움을 드릴 수 있어요.</span>
                </h3>
              </div>
              <p className="text-sm text-on-surface-variant/70 leading-relaxed">
                자신이 다른 리더들에게 줄 수 있는 전문분야나 관심사가 있다면 키워드와 함께 이유를 상세히 적어주세요. (최소 2개, 최대 5개)
              </p>
              <div className="grid gap-6">
                {givers.map((g, idx) => (
                  <KeywordCard
                    key={idx}
                    entry={g}
                    idx={idx}
                    role="giver"
                    accent="primary"
                    canRemove={givers.length > 2}
                    sortedWorkPresets={sortedWorkPresets}
                    sortedHobbyPresets={sortedHobbyPresets}
                    usedKeywords={allUsedKeywords}
                    onUpdate={updateGiver}
                    onRemove={removeGiver}
                  />
                ))}
              </div>
              {givers.length < 5 && (
                <button
                  onClick={addGiver}
                  className="w-full py-3 flex items-center justify-center gap-2 text-base font-bold text-primary border-2 border-dashed border-primary/40 rounded-2xl hover:bg-primary/5 hover:border-primary/70 transition-all"
                >
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                  키워드 추가하기 ({givers.length}/5)
                </button>
              )}
            </div>

            {/* Taker */}
            <div className="space-y-6">
              <div className="border-b border-secondary/20 pb-2">
                <h3 className="flex items-center gap-2 min-w-0 overflow-hidden text-secondary">
                  <span className="material-symbols-outlined shrink-0">pan_tool</span>
                  <span className="text-lg font-headline font-bold shrink-0">Taker</span>
                  <span className="text-sm font-normal text-on-surface-variant truncate">· 도움을 받고 싶어요.</span>
                </h3>
              </div>
              <p className="text-sm text-on-surface-variant/70 leading-relaxed">
                자신이 다른 리더들로부터 배우고 싶거나, 도움을 받고 싶은 키워드를 선택하시고, 이유를 상세히 적어주세요. (최소 2개, 최대 5개)
              </p>
              <div className="grid gap-6">
                {takers.map((t, idx) => (
                  <KeywordCard
                    key={idx}
                    entry={t}
                    idx={idx}
                    role="taker"
                    accent="secondary"
                    canRemove={takers.length > 2}
                    sortedWorkPresets={sortedWorkPresets}
                    sortedHobbyPresets={sortedHobbyPresets}
                    usedKeywords={allUsedKeywords}
                    onUpdate={updateTaker}
                    onRemove={removeTaker}
                  />
                ))}
              </div>
              {takers.length < 5 && (
                <button
                  onClick={addTaker}
                  className="w-full py-3 flex items-center justify-center gap-2 text-base font-bold text-secondary border-2 border-dashed border-secondary/40 rounded-2xl hover:bg-secondary/5 hover:border-secondary/70 transition-all"
                >
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                  키워드 추가하기 ({takers.length}/5)
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 하단 저장 버튼 */}
      <div className="shrink-0 px-4 sm:px-6 pt-3 bg-white/90 backdrop-blur-md border-t border-outline shadow-lg" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto w-full">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-4 bg-primary text-white font-headline font-bold rounded-2xl shadow-xl active:scale-95 hover:opacity-90 transition-all flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                저장 중...
              </>
            ) : showBack ? '수정 완료' : '입력 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
