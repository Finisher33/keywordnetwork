import { useState, useMemo, useRef, ChangeEvent } from 'react';
import { useStore, Interest, User } from '../store';
import LocationAutocomplete from './LocationAutocomplete';
import { HYUNDAI_COMPANIES } from '../constants/companies';

// 12지신 동물 아이콘 (자·축·인·묘·진·사·오·미·신·유·술·해 순서)
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

export default function MyProfile({ onSave, onLogout, showBack = true, targetUser }: MyProfileProps) {
  const { currentUser: loggedInUser, db, updateUserProfile } = useStore();
  const userToEdit = targetUser || loggedInUser;
  
  const [company, setCompany] = useState(userToEdit?.company || '');
  const [customCompany, setCustomCompany] = useState('');
  const [isOtherCompany, setIsOtherCompany] = useState(false);

  // Initialize isOtherCompany if the current company is not in the list
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
  const [location, setLocation] = useState(userToEdit?.location || '');
  const [profilePic, setProfilePic] = useState(() => {
    if (userToEdit?.profilePic) return userToEdit.profilePic;
    // 최초 등록 시 12지신 중 랜덤 선택
    return ZODIAC_ANIMALS[Math.floor(Math.random() * ZODIAC_ANIMALS.length)].url;
  });

  const myInterests = useMemo(() => db.interests.filter(i => i.userId === userToEdit?.id), [db.interests, userToEdit]);
  
  const initialGivers = useMemo(() => myInterests.filter(i => i.type === 'giver').map(i => ({ keyword: i.keyword, description: i.description })), [myInterests]);
  const initialTakers = useMemo(() => myInterests.filter(i => i.type === 'taker').map(i => ({ keyword: i.keyword, description: i.description })), [myInterests]);

  const presetKeywords = useMemo(() => db.presetInterests.map(p => p.keyword), [db.presetInterests]);

  const [givers, setGivers] = useState(() => {
    const base = initialGivers.map(g => ({
      ...g,
      isCustom: g.keyword !== '' && !presetKeywords.includes(g.keyword)
    }));
    return base.length >= 2 ? base : [...base, ...Array.from({ length: 2 - base.length }, () => ({ keyword: '', description: '', isCustom: false }))];
  });

  const [takers, setTakers] = useState(() => {
    const base = initialTakers.map(t => ({
      ...t,
      isCustom: t.keyword !== '' && !presetKeywords.includes(t.keyword)
    }));
    return base.length >= 2 ? base : [...base, ...Array.from({ length: 2 - base.length }, () => ({ keyword: '', description: '', isCustom: false }))];
  });

  const sortedPresetInterests = useMemo(() => {
    return [...db.presetInterests].sort((a, b) => a.keyword.localeCompare(b.keyword));
  }, [db.presetInterests]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!userToEdit) return;

    // Validate interests
    const validGivers = givers.filter(g => g.keyword.trim() && g.description.trim());
    const validTakers = takers.filter(t => t.keyword.trim() && t.description.trim());

    if (validGivers.length < 2 || validTakers.length < 2) {
      alert('Giver와 Taker 각각 최소 2개 이상의 키워드와 세부 내용을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    // Prepare Interests
    const newInterests: Interest[] = [
      ...validGivers.map(g => ({
        id: Date.now().toString() + Math.random(),
        userId: userToEdit.id,
        type: 'giver' as const,
        keyword: g.keyword,
        description: g.description
      })),
      ...validTakers.map(t => ({
        id: Date.now().toString() + Math.random(),
        userId: userToEdit.id,
        type: 'taker' as const,
        keyword: t.keyword,
        description: t.description
      }))
    ];

    try {
      // Update User Info and Interests atomically
      await updateUserProfile({
        ...userToEdit,
        company: company === '직접입력' ? customCompany : company,
        name,
        department,
        title,
        location,
        profilePic
      }, newInterests);

      alert('프로필이 업데이트 되었습니다.');
      onSave();
    } catch (error) {
      console.error("Failed to save profile:", error);
      alert('프로필 저장 중 오류가 발생했습니다. 권한 설정을 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const addGiver = () => {
    if (givers.length < 5) setGivers([...givers, { keyword: '', description: '', isCustom: false }]);
  };
  const removeGiver = (idx: number) => {
    if (givers.length > 2) setGivers(givers.filter((_, i) => i !== idx));
  };
  const addTaker = () => {
    if (takers.length < 5) setTakers([...takers, { keyword: '', description: '', isCustom: false }]);
  };
  const removeTaker = (idx: number) => {
    if (takers.length > 2) setTakers(takers.filter((_, i) => i !== idx));
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background text-on-surface">
      <header className="header-safe shrink-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline shadow-sm">
        <div className="h-14 flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
            {showBack && (
              <button onClick={onSave} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors">
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            )}
            <span className="font-headline text-lg font-bold tracking-tight text-primary">내 프로필 설정</span>
          </div>
          {onLogout && (
            <div className="bg-surface-container-low border border-outline rounded-xl p-1 flex items-center shadow-sm">
              <button
                onClick={onLogout}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                title="로그아웃"
              >
                <span className="material-symbols-outlined text-xl">logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-8 pb-32 max-w-2xl mx-auto px-4 sm:px-6 space-y-10 w-full">
        <section className="bg-surface p-6 rounded-3xl border border-outline space-y-8 shadow-sm">
        {/* Profile Picture Section */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="w-28 h-28 rounded-3xl border-2 border-primary/30 overflow-hidden bg-surface-container-low flex items-center justify-center shadow-md">
              {profilePic ? (
                profilePic.length < 5 ? (
                  <span className="text-5xl">{profilePic}</span>
                ) : (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                )
              ) : (
                <span className="material-symbols-outlined text-8xl text-primary/40">face</span>
              )}
            </div>
          </div>

          <div className="space-y-3 w-full">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase text-center tracking-widest">프로필 아이콘 선택</p>
            <div className="grid grid-cols-6 gap-2">
              {ZODIAC_ANIMALS.map(animal => (
                <button
                  key={animal.url}
                  onClick={() => setProfilePic(animal.url)}
                  className={`flex items-center justify-center p-1.5 rounded-2xl transition-all ${profilePic === animal.url ? 'border-2 border-primary shadow-md scale-110 bg-primary/10' : 'border border-outline opacity-70 hover:opacity-100 hover:bg-primary/5 bg-surface-container-low'}`}
                >
                  <img src={animal.url} alt="" className="w-9 h-9 object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1 tracking-widest">회사</label>
            <div className="bg-surface-container-low rounded-xl border border-outline focus-within:border-primary transition-colors flex items-center relative">
              <select 
                value={company} 
                onChange={e => {
                  setCompany(e.target.value);
                  setIsOtherCompany(e.target.value === '직접입력');
                }} 
                className="w-full bg-transparent border-none px-4 py-3 text-sm outline-none text-on-surface appearance-none cursor-pointer pr-10"
              >
                <option value="" disabled>회사를 선택하세요</option>
                {HYUNDAI_COMPANIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="material-symbols-outlined text-on-surface-variant text-sm absolute right-3 pointer-events-none">expand_more</span>
            </div>
          </div>
          {isOtherCompany && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1 tracking-widest">회사명 직접 입력</label>
              <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
                <input 
                  type="text" 
                  value={customCompany} 
                  onChange={e => setCustomCompany(e.target.value)} 
                  placeholder="회사명을 입력하세요"
                  className="w-full bg-transparent border-none p-0 text-sm outline-none text-on-surface" 
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1 tracking-widest">성명</label>
            <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-transparent border-none p-0 text-sm outline-none text-on-surface" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1 tracking-widest">담당 조직</label>
            <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-transparent border-none p-0 text-sm outline-none text-on-surface" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1 tracking-widest">직책</label>
            <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-transparent border-none p-0 text-sm outline-none text-on-surface" />
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1 tracking-widest">근무지</label>
            <div className="bg-surface-container-low rounded-xl px-4 py-3 border border-outline focus-within:border-primary transition-colors">
              <LocationAutocomplete 
                value={location}
                onChange={setLocation}
                placeholder="근무지를 입력하세요"
              />
            </div>
          </div>
        </div>

        <hr className="border-outline" />

        {/* Interests Editing */}
        <div className="space-y-12">
          {/* Giver Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2">
              <h3 className="text-lg font-headline font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">volunteer_activism</span> be Giver
              </h3>
              {givers.length < 5 && (
                <button 
                  onClick={addGiver} 
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span> 추가하기
                </button>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
              자신이 다른 리더들에게 줄 수 있는 가치나 도움을 키워드와 함께 상세히 적어주세요. (최소 2개, 최대 5개)
            </p>
            <div className="grid gap-6">
              {givers.map((g, idx) => (
                <div key={idx} className="bg-surface-container-low p-5 rounded-3xl border border-outline space-y-4 relative group/item shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">Giver Keyword {idx + 1}</span>
                    <button 
                      onClick={() => removeGiver(idx)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${givers.length > 2 ? 'bg-error/10 text-error hover:bg-error/20' : 'bg-surface-container-highest text-on-surface-variant/20 cursor-not-allowed'}`}
                      title={givers.length > 2 ? "삭제" : "최소 2개 항목이 필요합니다"}
                      disabled={givers.length <= 2}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">키워드 선택</label>
                    <div className="bg-surface border border-outline rounded-xl flex items-center relative">
                        <select 
                          value={g.isCustom ? '직접입력' : g.keyword}
                          onChange={e => {
                            const val = e.target.value;
                            const next = [...givers];
                            if (val === '직접입력') {
                              next[idx] = { ...next[idx], isCustom: true, keyword: g.isCustom ? g.keyword : '' };
                            } else {
                              next[idx] = { ...next[idx], isCustom: false, keyword: val };
                            }
                            setGivers(next);
                          }}
                          className="w-full bg-transparent border-none px-4 py-2.5 text-sm outline-none text-on-surface appearance-none cursor-pointer pr-10"
                        >
                          <option value="">관심사를 선택하세요</option>
                          <option value="직접입력">직접입력</option>
                          {sortedPresetInterests.map(p => (
                            <option key={p.id} value={p.keyword}>{p.keyword}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined text-on-surface-variant text-sm absolute right-3 pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {g.isCustom && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">키워드 직접 입력</label>
                        <input 
                          type="text" 
                          value={g.keyword} 
                          onChange={e => {
                            const next = [...givers];
                            next[idx] = { ...next[idx], keyword: e.target.value };
                            setGivers(next);
                          }}
                          placeholder="# 예: 바이브코딩"
                          className="w-full bg-surface border border-outline rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-on-surface"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">상세 내용</label>
                      <textarea 
                        value={g.description}
                        onChange={e => {
                          const next = [...givers];
                          next[idx] = { ...next[idx], description: e.target.value };
                          setGivers(next);
                        }}
                        placeholder="어떤 도움을 줄 수 있는지 구체적으로 적어주세요."
                        rows={3}
                        className="w-full bg-surface border border-outline rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-on-surface"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Taker Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-secondary/20 pb-2">
              <h3 className="text-lg font-headline font-bold text-secondary flex items-center gap-2">
                <span className="material-symbols-outlined">pan_tool</span> be Taker
              </h3>
              {takers.length < 5 && (
                <button 
                  onClick={addTaker} 
                  className="flex items-center gap-1 text-xs font-bold text-secondary hover:bg-secondary/5 px-3 py-1.5 rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span> 추가하기
                </button>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
              다른 리더들로부터 배우고 싶거나 도움을 받고 싶은 분야를 키워드와 함께 적어주세요. (최소 2개, 최대 5개)
            </p>
            <div className="grid gap-6">
              {takers.map((t, idx) => (
                <div key={idx} className="bg-surface-container-low p-5 rounded-3xl border border-outline space-y-4 relative group/item shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">Taker Keyword {idx + 1}</span>
                    <button 
                      onClick={() => removeTaker(idx)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${takers.length > 2 ? 'bg-error/10 text-error hover:bg-error/20' : 'bg-surface-container-highest text-on-surface-variant/20 cursor-not-allowed'}`}
                      title={takers.length > 2 ? "삭제" : "최소 2개 항목이 필요합니다"}
                      disabled={takers.length <= 2}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">키워드 선택</label>
                    <div className="bg-surface border border-outline rounded-xl flex items-center relative">
                        <select 
                          value={t.isCustom ? '직접입력' : t.keyword}
                          onChange={e => {
                            const val = e.target.value;
                            const next = [...takers];
                            if (val === '직접입력') {
                              next[idx] = { ...next[idx], isCustom: true, keyword: t.isCustom ? t.keyword : '' };
                            } else {
                              next[idx] = { ...next[idx], isCustom: false, keyword: val };
                            }
                            setTakers(next);
                          }}
                          className="w-full bg-transparent border-none px-4 py-2.5 text-sm outline-none text-on-surface appearance-none cursor-pointer pr-10"
                        >
                          <option value="">관심사를 선택하세요</option>
                          <option value="직접입력">직접입력</option>
                          {sortedPresetInterests.map(p => (
                            <option key={p.id} value={p.keyword}>{p.keyword}</option>
                          ))}
                        </select>
                        <span className="material-symbols-outlined text-on-surface-variant text-sm absolute right-3 pointer-events-none">expand_more</span>
                      </div>
                    </div>
                    {t.isCustom && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">키워드 직접 입력</label>
                        <input 
                          type="text" 
                          value={t.keyword} 
                          onChange={e => {
                            const next = [...takers];
                            next[idx] = { ...next[idx], keyword: e.target.value };
                            setTakers(next);
                          }}
                          placeholder="# 예: 1on1 면담"
                          className="w-full bg-surface border border-outline rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-on-surface"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">상세 내용</label>
                      <textarea 
                        value={t.description}
                        onChange={e => {
                          const next = [...takers];
                          next[idx] = { ...next[idx], description: e.target.value };
                          setTakers(next);
                        }}
                        placeholder="어떤 배움을 얻고 싶은지 구체적으로 적어주세요."
                        rows={3}
                        className="w-full bg-surface border border-outline rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all resize-none text-on-surface"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        </section>
      </main>

      {/* 하단 고정 저장 버튼 */}
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
            ) : '수정 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}

