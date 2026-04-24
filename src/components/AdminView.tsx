import { useState, FormEvent, useMemo } from 'react';
import { useStore, User, Course } from '../store';
import NetworkMap from './NetworkMap';
import PeopleMap from './PeopleMap';
import InsightView from './InsightView';
import TotalInsight from './TotalInsight';
import SurveyInsight from './SurveyInsight';
import MyNetwork from './MyNetwork';
import MyProfile from './MyProfile';
import NotificationBell from './NotificationBell';

export default function AdminView({ onBack, onLogout }: { onBack: () => void, onLogout: () => void }) {
  const { db, addCourse, updateCourse, deleteCourse, addSession, updateSession, deleteSession, toggleSessionActive, deleteUser, resetCourseData, fetchData, addPresetInterest, deletePresetInterest } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [adminSubView, setAdminSubView] = useState<'management' | 'analysis' | 'users' | 'presets'>('management');
  
  const [newPresetKeyword, setNewPresetKeyword] = useState('');
  const [presetGroupTab, setPresetGroupTab] = useState<'work' | 'hobby'>('work');
  
  // Analysis State
  const [analysisCourseId, setAnalysisCourseId] = useState('');
  const [analysisFeature, setAnalysisFeature] = useState<'survey' | 'total' | 'network' | 'peoplemap' | 'insight'>('survey');

  // User List State
  const [userListCourseId, setUserListCourseId] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);
  const [courseToReset, setCourseToReset] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [newCourseName, setNewCourseName] = useState('');
  const [newCoursePassword, setNewCoursePassword] = useState('');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCoursePassword, setEditCoursePassword] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  const [sessionName, setSessionName] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [sessionModule, setSessionModule] = useState('');
  const [sessionDay, setSessionDay] = useState('');
  const [sessionObjectives, setSessionObjectives] = useState('');
  const [sessionContents, setSessionContents] = useState('');
  const [sessionInstructor, setSessionInstructor] = useState('');

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  // Session copy state
  const [copySourceCourseId, setCopySourceCourseId] = useState('');
  const [copySelectedIds, setCopySelectedIds] = useState<string[]>([]);
  const [isCopyPanelOpen, setIsCopyPanelOpen] = useState(false);

  // Grouping State
  const [groupingCourseId, setGroupingCourseId] = useState('');
  const [groupingCriteria, setGroupingCriteria] = useState<'keyword_top5' | 'keyword_top6_10'>('keyword_top5');
  const [groupCount, setGroupCount] = useState(1);
  const [groupingResults, setGroupingResults] = useState<{ groupIndex: number, users: any[], keyword?: string }[]>([]);
  const [isGroupingPopupOpen, setIsGroupingPopupOpen] = useState(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);


  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLogin = (e?: FormEvent) => {
    if (e) e.preventDefault();
    console.log('Admin login attempt with password:', password);
    if (password === 'admin4321') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleAddCourse = async () => {
    if (!newCourseName) return;
    setIsProcessing(true);
    try {
      await addCourse({
        id: Date.now().toString(),
        name: newCourseName,
        password: newCoursePassword
      });
      setNewCourseName('');
      setNewCoursePassword('');
      showStatus('success', '과정이 등록되었습니다.');
    } catch (e) {
      showStatus('error', '과정 등록에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateCourse = async () => {
    if (!editingCourseId || !editCourseName) return;
    setIsProcessing(true);
    try {
      const existing = db.courses.find(c => c.id === editingCourseId);
      await updateCourse({
        id: editingCourseId,
        name: editCourseName,
        password: editCoursePassword,
        isActive: existing?.isActive ?? true
      });
      setEditingCourseId(null);
      setEditCourseName('');
      setEditCoursePassword('');
      showStatus('success', '과정명이 수정되었습니다.');
    } catch (e) {
      showStatus('error', '과정 수정에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCourseActive = async (course: Course) => {
    try {
      await updateCourse({ ...course, isActive: !(course.isActive ?? true) });
    } catch (e) {
      showStatus('error', '상태 변경에 실패했습니다.');
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsProcessing(true);
    try {
      await deleteCourse(courseToDelete);
      if (selectedCourseId === courseToDelete) setSelectedCourseId('');
      if (groupingCourseId === courseToDelete) setGroupingCourseId('');
      setCourseToDelete(null);
      showStatus('success', '과정이 삭제되었습니다.');
    } catch (e: any) {
      showStatus('error', e?.message || '과정 삭제에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetCourseData = async () => {
    if (!courseToReset) return;
    setIsProcessing(true);
    try {
      await resetCourseData(courseToReset);
      setCourseToReset(null);
      showStatus('success', '데이터가 초기화되었습니다.');
    } catch (e) {
      showStatus('error', '데이터 초기화에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };


  const handleCopySessions = async () => {
    if (!selectedCourseId || !copySourceCourseId || copySelectedIds.length === 0) {
      showStatus('error', '복사할 세션을 선택해주세요.');
      return;
    }
    setIsProcessing(true);
    try {
      const sessionsToCopy = db.sessions.filter(s => copySelectedIds.includes(s.id));
      const now = Date.now();
      for (let i = 0; i < sessionsToCopy.length; i++) {
        const src = sessionsToCopy[i];
        await addSession({
          id: (now + i).toString(),
          courseId: selectedCourseId,
          name: src.name,
          time: src.time,
          module: src.module,
          day: src.day,
          objectives: src.objectives,
          contents: src.contents,
          instructor: src.instructor,
          isActive: true,
        });
      }
      setCopySelectedIds([]);
      setCopySourceCourseId('');
      setIsCopyPanelOpen(false);
      showStatus('success', `${sessionsToCopy.length}개의 세션이 복사되었습니다.`);
    } catch (e) {
      showStatus('error', '세션 복사에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSession = async () => {
    if (!selectedCourseId || !sessionName || !sessionTime || !sessionModule || !sessionDay) {
      showStatus('error', '모든 세션 정보를 입력해주세요.');
      return;
    }
    setIsProcessing(true);
    try {
      await addSession({
        id: Date.now().toString(),
        courseId: selectedCourseId,
        name: sessionName,
        time: sessionTime,
        module: sessionModule,
        day: sessionDay,
        objectives: sessionObjectives,
        contents: sessionContents,
        instructor: sessionInstructor,
        isActive: true
      });
      setSessionName('');
      setSessionTime('');
      setSessionModule('');
      setSessionDay('');
      setSessionObjectives('');
      setSessionContents('');
      setSessionInstructor('');
      showStatus('success', '세션이 추가되었습니다.');
    } catch (e) {
      showStatus('error', '세션 추가에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSession = async () => {
    if (!editingSessionId || !sessionName || !sessionTime || !sessionModule || !sessionDay) return;
    const existingSession = db.sessions.find(s => s.id === editingSessionId);
    setIsProcessing(true);
    try {
      await updateSession({
        id: editingSessionId,
        courseId: selectedCourseId,
        name: sessionName,
        time: sessionTime,
        module: sessionModule,
        day: sessionDay,
        objectives: sessionObjectives,
        contents: sessionContents,
        instructor: sessionInstructor,
        isActive: existingSession ? existingSession.isActive : true
      });
      setEditingSessionId(null);
      setSessionName('');
      setSessionTime('');
      setSessionModule('');
      setSessionDay('');
      setSessionObjectives('');
      setSessionContents('');
      setSessionInstructor('');
      showStatus('success', '세션 정보가 수정되었습니다.');
    } catch (e) {
      showStatus('error', '세션 수정에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    setIsProcessing(true);
    try {
      await deleteSession(id);
      showStatus('success', '세션이 삭제되었습니다.');
    } catch (e) {
      showStatus('error', '세션 삭제에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleSessionActive = async (id: string) => {
    setIsProcessing(true);
    try {
      await toggleSessionActive(id);
      showStatus('success', '세션 상태가 변경되었습니다.');
    } catch (e) {
      showStatus('error', '상태 변경에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditSession = (s: any) => {
    setEditingSessionId(s.id);
    setSessionName(s.name);
    setSessionTime(s.time);
    setSessionModule(s.module);
    setSessionDay(s.day);
    setSessionObjectives(s.objectives || '');
    setSessionContents(s.contents || '');
    setSessionInstructor(s.instructor || '');
  };

  const handleStartGrouping = async () => {
    if (!groupingCourseId) {
      showStatus('error', '과정을 선택해주세요.');
      return;
    }

    const courseUsers = db.users.filter(u => u.courseId === groupingCourseId);
    if (courseUsers.length === 0) {
      showStatus('error', '해당 과정에 등록된 인원이 없습니다.');
      return;
    }

    setIsProcessing(true);

    try {
      const courseUserIds = new Set(courseUsers.map(u => u.id));
      const courseInterests = db.interests.filter(i => courseUserIds.has(i.userId));

      // 키워드 빈도 계산 (전체 과정 유저의 관심사 기준)
      const kwFreq: Record<string, number> = {};
      courseInterests.forEach(i => {
        const kw = i.keyword.trim().toLowerCase();
        if (kw) kwFreq[kw] = (kwFreq[kw] || 0) + 1;
      });

      // 빈도순 정렬
      const sortedKws = Object.entries(kwFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([kw]) => kw);

      // 기준에 따라 대상 키워드 범위 선택 (0-indexed: top1~5 → 0~4, top6~10 → 5~9)
      const [from, to] = groupingCriteria === 'keyword_top5' ? [0, 5] : [5, 10];
      // 설정한 조 수만큼만 키워드 사용
      const targetKws = sortedKws.slice(from, from + Math.min(groupCount, to - from));

      if (targetKws.length === 0) {
        showStatus('error', '해당 범위에 해당하는 관심사 키워드가 없습니다.');
        setIsProcessing(false);
        return;
      }

      // 각 키워드별 조 편성 (한 유저는 가장 먼저 매칭된 키워드 조에만 편성)
      const assignedUserIds = new Set<string>();
      const results: { groupIndex: number; keyword: string; users: any[]; criteriaSummary: string }[] = [];

      targetKws.forEach((kw, idx) => {
        // 이 키워드를 가진 미배정 유저 찾기 (원본 대소문자 유지)
        const usersWithKw = courseUsers.filter(u => {
          if (assignedUserIds.has(u.id)) return false;
          return courseInterests.some(i => i.userId === u.id && i.keyword.trim().toLowerCase() === kw);
        });

        usersWithKw.forEach(u => assignedUserIds.add(u.id));

        // 원본 키워드 표기 (대소문자 원본)
        const originalKw = courseInterests.find(i => i.keyword.trim().toLowerCase() === kw)?.keyword.trim() || kw;

        results.push({
          groupIndex: idx + 1,
          keyword: originalKw,
          users: usersWithKw,
          criteriaSummary: `#${originalKw} · ${usersWithKw.length}명`,
        });
      });

      // 미배정 유저 → 기타조
      const unassignedUsers = courseUsers.filter(u => !assignedUserIds.has(u.id));
      if (unassignedUsers.length > 0) {
        results.push({
          groupIndex: -1,
          keyword: '',
          users: unassignedUsers,
          criteriaSummary: `기타조 · ${unassignedUsers.length}명`,
        });
      }

      setGroupingResults(results);
      setIsGroupingPopupOpen(true);
    } catch (error) {
      console.error("Grouping error:", error);
      showStatus('error', '조편성 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedUsers = () => {
    const filtered = db.users.filter(u => u.courseId === userListCourseId);
    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      if (sortConfig.key === 'giver' || sortConfig.key === 'taker') {
        const aInterests = db.interests.filter(i => i.userId === a.id && i.type === sortConfig.key);
        const bInterests = db.interests.filter(i => i.userId === b.id && i.type === sortConfig.key);
        aValue = aInterests.map(i => i.keyword).join(', ');
        bValue = bInterests.map(i => i.keyword).join(', ');
      } else {
        aValue = (a as any)[sortConfig.key] || '';
        bValue = (b as any)[sortConfig.key] || '';
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const handleDownloadCSV = () => {
    if (!userListCourseId) return;
    const courseUsers = db.users.filter(u => u.courseId === userListCourseId);
    if (courseUsers.length === 0) {
      showStatus('error', '다운로드할 명단이 없습니다.');
      return;
    }

    const headers = [
      '회사', '성함', '담당조직', '직책', 'be Giver', 'be Taker',
      'Q1. 오늘 컨디션(0~10)',
      'Q2. 기억에 남는 한마디',
      'Q3. 두렵게 하는 단어',
      'Q4. 설레게 하는 단어',
      'Q5. 근무 경력(년)'
    ];
    const rows = courseUsers.map(u => {
      const userInterests = db.interests.filter(i => i.userId === u.id);
      const giverKeywords = userInterests.filter(i => i.type === 'giver').map(i => i.keyword).join(', ');
      const takerKeywords = userInterests.filter(i => i.type === 'taker').map(i => i.keyword).join(', ');
      return [
        u.company || '',
        u.name || '',
        u.department || '',
        u.title || '',
        giverKeywords,
        takerKeywords,
        typeof u.condition === 'number' ? String(u.condition) : '',
        u.memorableQuote || '',
        u.fearWord || '',
        u.excitingWord || '',
        typeof u.careerYears === 'number' ? String(u.careerYears) : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `user_list_${userListCourseId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddPreset = async () => {
    if (!newPresetKeyword.trim()) return;
    setIsProcessing(true);
    try {
      await addPresetInterest(newPresetKeyword.trim(), presetGroupTab);
      setNewPresetKeyword('');
      showStatus('success', '키워드가 추가되었습니다.');
    } catch (e) {
      showStatus('error', '키워드 추가에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePreset = async (id: string) => {
    setIsProcessing(true);
    try {
      await deletePresetInterest(id);
      showStatus('success', '키워드가 삭제되었습니다.');
    } catch (e) {
      showStatus('error', '키워드 삭제에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-background overflow-y-auto">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6 bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
          <h2 className="text-2xl font-headline font-bold text-center text-primary">Admin Login</h2>
          <div className="space-y-2">
            <input 
              type="password" 
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (loginError) setLoginError('');
              }}
              placeholder="비밀번호 입력" 
              className={`w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-on-surface outline-none focus:ring-1 ${loginError ? 'ring-1 ring-error' : 'focus:ring-primary'}`}
              autoFocus
            />
            {loginError && (
              <p className="text-error text-xs px-1 font-bold">{loginError}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="flex-1 py-3 text-on-surface-variant hover:text-on-surface">취소</button>
            <button type="submit" className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-xl">접속</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-background text-on-surface flex flex-col overflow-hidden">
      <header className="header-safe w-full z-50 bg-primary shadow-lg shrink-0">
        <div className="h-16 flex justify-between items-center px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8 flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="material-symbols-outlined text-white">hub</span>
            <span className="text-sm sm:text-base font-black tracking-[0.15em] text-white font-headline hidden min-[400px]:block whitespace-nowrap">KEYWORD NETWORKING ADMIN</span>
          </div>
          
          <nav className="flex items-center gap-1 bg-white/10 p-1 rounded-lg overflow-x-auto no-scrollbar flex-1 min-w-0">
            <button 
              onClick={() => setAdminSubView('management')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-black transition-all whitespace-nowrap uppercase tracking-wider ${adminSubView === 'management' ? 'bg-white text-primary' : 'text-white/60 hover:text-white'}`}
            >
              과정 관리
            </button>
            <button 
              onClick={() => setAdminSubView('users')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-black transition-all whitespace-nowrap uppercase tracking-wider ${adminSubView === 'users' ? 'bg-white text-primary' : 'text-white/60 hover:text-white'}`}
            >
              명단
            </button>
            <button 
              onClick={() => setAdminSubView('presets')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-black transition-all whitespace-nowrap uppercase tracking-wider ${adminSubView === 'presets' ? 'bg-white text-primary' : 'text-white/60 hover:text-white'}`}
            >
              관심사 키워드
            </button>
            <button 
              onClick={() => setAdminSubView('analysis')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-[10px] sm:text-xs font-black transition-all whitespace-nowrap uppercase tracking-wider ${adminSubView === 'analysis' ? 'bg-white text-primary' : 'text-white/60 hover:text-white'}`}
            >
              분석
            </button>
          </nav>
        </div>
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-1 flex items-center gap-2 shadow-sm shrink-0 ml-2">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Logout</span>
          </button>
        </div>
        </div> {/* h-16 inner div 닫기 */}
      </header>

      {/* Status Message */}
      {statusMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4">
          <div className={`px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border ${statusMessage.type === 'success' ? 'bg-success/10 border-success text-success' : 'bg-error/10 border-error text-error'}`}>
            <span className="material-symbols-outlined text-sm">
              {statusMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="text-xs font-bold">{statusMessage.text}</span>
          </div>
        </div>
      )}

      <main className={`flex-1 overflow-y-auto pt-8 px-4 md:px-8 mx-auto transition-all duration-500 pb-[calc(5rem+env(safe-area-inset-bottom))] ${adminSubView === 'analysis' || adminSubView === 'users' ? 'max-w-[98%]' : 'max-w-5xl'}`}>
        {adminSubView === 'management' ? (
          <div className="space-y-12">
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface mb-2">과정 등록 및 관리</h1>
              <p className="text-on-surface-variant text-xs sm:text-sm">코스와 세션을 관리합니다.</p>
            </div>

            {/* Course Management */}
            <section className="space-y-6">
              <div className="bg-white p-4 sm:p-8 rounded-xl border border-outline shadow-sm space-y-6">
                <h3 className="font-headline text-base sm:text-lg font-black text-primary uppercase tracking-tight">과정 관리</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="신규 과정명 입력" 
                    className="flex-1 bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                  />
                  <input 
                    type="text" 
                    value={newCoursePassword}
                    onChange={(e) => setNewCoursePassword(e.target.value)}
                    placeholder="입장 비밀번호 (선택)" 
                    className="w-full sm:w-48 bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                  />
                  <button 
                    onClick={handleAddCourse} 
                    disabled={isProcessing}
                    className="px-8 py-3 bg-primary text-on-primary font-black rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-primary/90 transition-colors text-xs sm:text-sm disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm sm:text-base">{isProcessing ? 'sync' : 'add'}</span> {isProcessing ? '처리 중...' : '등록'}
                  </button>
                </div>

                <div className="grid gap-3 mt-6">
                  {db.courses.map(course => {
                    const isActive = course.isActive ?? true;
                    return (
                    <div key={course.id} className={`bg-surface-container-high p-3 sm:p-4 rounded-xl flex justify-between items-center border transition-opacity ${isActive ? 'border-outline-variant/10' : 'border-outline-variant/10 opacity-50'}`}>
                      {editingCourseId === course.id ? (
                        <div className="flex-1 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={editCourseName}
                            onChange={e => setEditCourseName(e.target.value)}
                            placeholder="과정명"
                            className="flex-1 bg-surface-container-highest border-none rounded-lg px-3 py-1 text-xs sm:text-sm outline-none"
                          />
                          <input
                            type="text"
                            value={editCoursePassword}
                            onChange={e => setEditCoursePassword(e.target.value)}
                            placeholder="비밀번호"
                            className="w-full sm:w-32 bg-surface-container-highest border-none rounded-lg px-3 py-1 text-xs sm:text-sm outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleUpdateCourse}
                              disabled={isProcessing}
                              className="text-primary font-bold text-[10px] sm:text-xs disabled:opacity-50"
                            >
                              {isProcessing ? '...' : '저장'}
                            </button>
                            <button onClick={() => setEditingCourseId(null)} className="text-on-surface-variant text-[10px] sm:text-xs">취소</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs sm:text-sm ${!isActive ? 'line-through text-on-surface-variant' : ''}`}>{course.name}</span>
                              {!isActive && <span className="text-[9px] font-bold text-on-surface-variant bg-outline-variant/20 px-1.5 py-0.5 rounded-full">비활성</span>}
                            </div>
                            {course.password && (
                              <span className="text-[10px] text-primary font-bold">PW: {course.password}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {/* 활성/비활성 토글 */}
                            <button
                              onClick={() => handleToggleCourseActive(course)}
                              title={isActive ? '비활성화' : '활성화'}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${isActive ? 'bg-primary' : 'bg-outline-variant'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingCourseId(course.id);
                                setEditCourseName(course.name);
                                setEditCoursePassword(course.password || '');
                              }}
                              className="text-on-surface-variant hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm sm:text-base">edit</span>
                            </button>
                            <button
                              onClick={() => setCourseToDelete(course.id)}
                              className="text-on-surface-variant hover:text-error transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm sm:text-base">delete</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Session Management */}
            <section className="bg-white p-4 sm:p-8 rounded-xl border border-outline shadow-sm space-y-8">
              <h3 className="font-headline text-base sm:text-lg font-black text-secondary uppercase tracking-tight">세션 관리</h3>
              
              <div className="space-y-2">
                <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">과정 선택</label>
                <select 
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary font-medium"
                >
                  <option value="">과정을 선택하세요</option>
                  {db.courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {selectedCourseId && !editingSessionId && (
                <div className="bg-primary/5 p-4 sm:p-6 rounded-xl border border-primary/20 space-y-4">
                  <button
                    type="button"
                    onClick={() => setIsCopyPanelOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-2 text-left"
                  >
                    <span className="flex items-center gap-2 font-black text-sm sm:text-base text-primary uppercase tracking-tight">
                      <span className="material-symbols-outlined text-base sm:text-lg">content_copy</span>
                      다른 과정에서 세션 복사
                    </span>
                    <span className="material-symbols-outlined text-primary">
                      {isCopyPanelOpen ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {isCopyPanelOpen && (
                    <div className="space-y-4 pt-2 border-t border-primary/20">
                      <div className="space-y-2">
                        <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest">원본 과정 선택</label>
                        <select
                          value={copySourceCourseId}
                          onChange={e => { setCopySourceCourseId(e.target.value); setCopySelectedIds([]); }}
                          className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                        >
                          <option value="">복사할 과정을 선택하세요</option>
                          {db.courses.filter(c => c.id !== selectedCourseId).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {copySourceCourseId && (() => {
                        const sourceSessions = db.sessions.filter(s => s.courseId === copySourceCourseId);
                        if (sourceSessions.length === 0) {
                          return <p className="text-[11px] sm:text-xs text-on-surface-variant italic">선택한 과정에 등록된 세션이 없습니다.</p>;
                        }
                        const allIds = sourceSessions.map(s => s.id);
                        const allSelected = allIds.length > 0 && allIds.every(id => copySelectedIds.includes(id));
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest">복사할 세션 선택 ({copySelectedIds.length}/{sourceSessions.length})</label>
                              <button
                                type="button"
                                onClick={() => setCopySelectedIds(allSelected ? [] : allIds)}
                                className="text-[10px] sm:text-xs font-bold text-primary hover:underline"
                              >
                                {allSelected ? '전체 해제' : '전체 선택'}
                              </button>
                            </div>
                            <div className="max-h-56 overflow-y-auto space-y-2 bg-white border border-outline rounded-lg p-3">
                              {sourceSessions.map(session => {
                                const checked = copySelectedIds.includes(session.id);
                                return (
                                  <label key={session.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => setCopySelectedIds(prev => checked ? prev.filter(id => id !== session.id) : [...prev, session.id])}
                                      className="mt-1 accent-primary"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[9px] sm:text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold">{session.module}</span>
                                        <span className="text-[9px] sm:text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded font-bold">{session.day}</span>
                                        <span className="text-[9px] sm:text-[10px] text-on-surface-variant">{session.time}</span>
                                      </div>
                                      <p className="font-bold text-xs sm:text-sm mt-1 truncate">{session.name}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="flex justify-end pt-2">
                              <button
                                type="button"
                                onClick={handleCopySessions}
                                disabled={isProcessing || copySelectedIds.length === 0}
                                className="px-6 py-2.5 bg-primary text-on-primary font-black rounded-lg shadow hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center gap-2 uppercase tracking-widest text-xs sm:text-sm disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-sm sm:text-base">{isProcessing ? 'sync' : 'content_copy'}</span>
                                {isProcessing ? '복사 중...' : `선택한 세션 복사 (${copySelectedIds.length})`}
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {selectedCourseId && (
                <div className="bg-surface-container-low p-4 sm:p-8 rounded-xl border border-secondary/20 space-y-8">
                  <h4 className="font-headline font-black text-lg sm:text-xl text-on-surface flex items-center gap-2 uppercase tracking-tight">
                    <span className="material-symbols-outlined text-secondary text-base sm:text-xl">
                      {editingSessionId ? 'edit_note' : 'add_circle'}
                    </span>
                    {editingSessionId ? '세션 정보 수정' : '신규 세션 추가'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">label</span> 세션명
                      </label>
                      <input 
                        type="text" 
                        value={sessionName} 
                        onChange={e => setSessionName(e.target.value)} 
                        placeholder="세션 이름을 입력하세요"
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">schedule</span> 세션 시간
                      </label>
                      <input 
                        type="text" 
                        value={sessionTime} 
                        onChange={e => setSessionTime(e.target.value)} 
                        placeholder="ex) 09:00 - 12:00" 
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">view_module</span> 모듈
                      </label>
                      <input 
                        type="text" 
                        value={sessionModule} 
                        onChange={e => setSessionModule(e.target.value)} 
                        placeholder="ex) 모듈 01" 
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">calendar_today</span> 일차
                      </label>
                      <input 
                        type="text" 
                        value={sessionDay} 
                        onChange={e => setSessionDay(e.target.value)} 
                        placeholder="ex) 1일차" 
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">person</span> 강사 정보
                      </label>
                      <input 
                        type="text" 
                        value={sessionInstructor} 
                        onChange={e => setSessionInstructor(e.target.value)} 
                        placeholder="강사 성함 및 소속" 
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all font-medium" 
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">target</span> 학습 목표
                      </label>
                      <textarea 
                        value={sessionObjectives} 
                        onChange={e => setSessionObjectives(e.target.value)} 
                        placeholder="학습 목표를 입력하세요" 
                        rows={2}
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none font-medium" 
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant flex items-center gap-1.5 uppercase tracking-widest">
                        <span className="material-symbols-outlined text-[10px] sm:text-xs">article</span> 주요 내용
                      </label>
                      <textarea 
                        value={sessionContents} 
                        onChange={e => setSessionContents(e.target.value)} 
                        placeholder="주요 학습 내용을 입력하세요" 
                        rows={3}
                        className="w-full bg-white border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none font-medium" 
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    {editingSessionId && (
                      <button 
                        onClick={() => { 
                          setEditingSessionId(null); 
                          setSessionName(''); 
                          setSessionTime(''); 
                          setSessionModule(''); 
                          setSessionDay(''); 
                          setSessionObjectives('');
                          setSessionContents('');
                          setSessionInstructor('');
                        }}
                        className="px-4 sm:px-6 py-3 text-on-surface-variant text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-surface-container-highest rounded-lg transition-colors"
                      >
                        취소
                      </button>
                    )}
                    <button 
                      onClick={editingSessionId ? handleUpdateSession : handleAddSession} 
                      disabled={isProcessing}
                      className="px-6 sm:px-10 py-3 bg-secondary text-on-secondary font-black rounded-lg shadow-lg hover:bg-secondary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm sm:text-base">{isProcessing ? 'sync' : 'save'}</span>
                      {isProcessing ? '처리 중...' : (editingSessionId ? '수정 완료' : '세션 저장')}
                    </button>
                  </div>
                </div>
              )}

              {selectedCourseId && (
                <div className="space-y-3 mt-6">
                  <h4 className="font-bold text-xs sm:text-sm text-on-surface">등록된 세션 목록</h4>
                  {db.sessions.filter(s => s.courseId === selectedCourseId).length === 0 ? (
                    <p className="text-[10px] sm:text-xs text-on-surface-variant italic">등록된 세션이 없습니다.</p>
                  ) : (
                    db.sessions.filter(s => s.courseId === selectedCourseId).map(session => (
                      <div key={session.id} className="bg-surface-container-high p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] sm:text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold">{session.module}</span>
                            <span className="text-[9px] sm:text-[10px] bg-secondary/20 text-secondary px-2 py-0.5 rounded font-bold">{session.day}</span>
                            <span className="text-[9px] sm:text-[10px] text-on-surface-variant ml-0 sm:ml-2">{session.time}</span>
                          </div>
                          <p className="font-bold text-xs sm:text-sm mt-1">{session.name}</p>
                        </div>
                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] sm:text-[10px] font-bold ${session.isActive ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                              {session.isActive ? '활성화' : '비활성화'}
                            </span>
                            <button
                              onClick={() => handleToggleSessionActive(session.id)}
                              disabled={isProcessing}
                              title={session.isActive ? '비활성화' : '활성화'}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${session.isActive ? 'bg-primary' : 'bg-outline-variant'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${session.isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                          </div>
                          <div className="flex gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEditSession(session)}
                              className="p-1.5 sm:p-2 text-on-surface-variant hover:text-primary"
                            >
                              <span className="material-symbols-outlined text-sm sm:text-base">edit</span>
                            </button>
                            <button 
                              onClick={() => handleDeleteSession(session.id)}
                              className="p-1.5 sm:p-2 text-on-surface-variant hover:text-error"
                            >
                              <span className="material-symbols-outlined text-sm sm:text-base">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>

            {/* Course Grouping (조편성) */}
            <section className="bg-white p-4 sm:p-8 rounded-xl border border-outline shadow-sm space-y-8">
              <h3 className="font-headline text-base sm:text-lg font-black text-tertiary uppercase tracking-tight">과정별 조편성</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">과정 선택</label>
                  <select
                    value={groupingCourseId}
                    onChange={(e) => setGroupingCourseId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary font-medium"
                  >
                    <option value="">과정을 선택하세요</option>
                    {db.courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">조편성 기준</label>
                  <select
                    value={groupingCriteria}
                    onChange={(e) => setGroupingCriteria(e.target.value as 'keyword_top5' | 'keyword_top6_10')}
                    className="w-full bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary font-medium"
                  >
                    <option value="keyword_top5">관심사 키워드 Top 1~5</option>
                    <option value="keyword_top6_10">관심사 키워드 Top 6~10</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">조 숫자 설정</label>
                  <select
                    value={groupCount}
                    onChange={(e) => setGroupCount(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary font-medium"
                  >
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={n}>{n}조</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                선택된 키워드 범위에서 빈도 Top 순위대로 설정한 조 수만큼 편성합니다. 한 유저는 가장 높은 순위의 키워드 조에 1번만 배정되며, 해당 관심사가 없는 유저는 기타조에 배정됩니다.
              </p>

              <div className="flex justify-center pt-4">
                <button 
                  onClick={handleStartGrouping}
                  disabled={isProcessing}
                  className="w-full sm:w-auto px-12 py-4 bg-tertiary text-on-tertiary font-black rounded-lg shadow-lg hover:bg-tertiary/90 active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs sm:text-sm disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm sm:text-base">{isProcessing ? 'sync' : 'group_add'}</span> {isProcessing ? '조편성 중...' : '조편성 시작'}
                </button>
              </div>
            </section>
          </div>
        ) : adminSubView === 'users' ? (
          <div className="space-y-12">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface mb-2">과정별 명단 관리</h1>
                <p className="text-on-surface-variant text-xs sm:text-sm">등록된 리더 명단을 확인하고 다운로드합니다.</p>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`w-10 h-10 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                title="새로고침"
              >
                <span className="material-symbols-outlined text-on-surface-variant">refresh</span>
              </button>
            </div>

            <div className="bg-white p-4 sm:p-8 rounded-xl border border-outline shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
                <div className="w-full sm:w-1/2 space-y-2">
                  <label className="text-[9px] sm:text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">과정 선택</label>
                  <select 
                    value={userListCourseId}
                    onChange={(e) => setUserListCourseId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                  >
                    <option value="">과정을 선택하세요</option>
                    {db.courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-2 sm:pb-0">
                  <button
                    onClick={() => setCourseToReset(userListCourseId)}
                    disabled={!userListCourseId}
                    className="flex-1 sm:flex-none px-4 py-3 bg-error text-white font-black rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-error/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-xs whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm">delete_sweep</span> DB 초기화
                  </button>
                  <button
                    onClick={handleDownloadCSV}
                    disabled={!userListCourseId}
                    title="CSV 다운로드"
                    className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                  >
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </div>
              </div>

              {userListCourseId && (() => {
                return (
                  <div className="overflow-x-auto border border-outline rounded-xl">
                    <table className="w-full text-left border-collapse min-w-[1400px]">
                      <thead>
                        <tr className="bg-surface-container-low border-b border-outline">
                          {[
                            { key: 'company', label: '회사' },
                            { key: 'name', label: '성함' },
                            { key: 'department', label: '담당조직' },
                            { key: 'title', label: '직책' },
                            { key: 'giver', label: 'be Giver' },
                            { key: 'taker', label: 'be Taker' },
                            { key: 'condition', label: 'Q1. 컨디션' },
                            { key: 'memorableQuote', label: 'Q2. 기억 한마디' },
                            { key: 'fearWord', label: 'Q3. 두려운 단어' },
                            { key: 'excitingWord', label: 'Q4. 설레는 단어' },
                            { key: 'careerYears', label: 'Q5. 경력(년)' },
                          ].map((col) => (
                            <th
                              key={col.key}
                              onClick={() => requestSort(col.key)}
                              className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant cursor-pointer hover:bg-surface-container-high transition-colors group"
                            >
                              <div className="flex items-center gap-1">
                                {col.label}
                                <span className={`material-symbols-outlined text-xs transition-opacity ${sortConfig?.key === col.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                                  {sortConfig?.key === col.key && sortConfig.direction === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                                </span>
                              </div>
                            </th>
                          ))}
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline/30">
                        {getSortedUsers().map(user => {
                          const userInterests = db.interests.filter(i => i.userId === user.id);
                          const giverInterests = userInterests.filter(i => i.type === 'giver');
                          const takerInterests = userInterests.filter(i => i.type === 'taker');

                          return (
                            <tr key={user.id} className="hover:bg-surface-container-low transition-colors">
                              <td className="p-4 text-sm font-medium text-on-surface">{user.company}</td>
                              <td className="p-4 text-sm font-bold text-primary">{user.name}</td>
                              <td className="p-4 text-sm text-on-surface-variant">{user.department}</td>
                              <td className="p-4 text-sm text-on-surface-variant">{user.title}</td>
                              <td className="p-4 text-sm text-on-surface-variant">
                                <div className="flex flex-wrap gap-1.5">
                                  {giverInterests.map((i, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                                      {i.keyword}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4 text-sm text-on-surface-variant">
                                <div className="flex flex-wrap gap-1.5">
                                  {takerInterests.map((i, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/10 text-secondary">
                                      {i.keyword}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4 text-sm text-on-surface-variant text-center">
                                {typeof user.condition === 'number' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">{user.condition}/10</span>
                                ) : <span className="text-on-surface-variant/40">—</span>}
                              </td>
                              <td className="p-4 text-xs text-on-surface max-w-[180px] truncate" title={user.memorableQuote || ''}>
                                {user.memorableQuote || <span className="text-on-surface-variant/40">—</span>}
                              </td>
                              <td className="p-4 text-xs text-on-surface max-w-[140px] truncate" title={user.fearWord || ''}>
                                {user.fearWord || <span className="text-on-surface-variant/40">—</span>}
                              </td>
                              <td className="p-4 text-xs text-on-surface max-w-[140px] truncate" title={user.excitingWord || ''}>
                                {user.excitingWord || <span className="text-on-surface-variant/40">—</span>}
                              </td>
                              <td className="p-4 text-sm text-on-surface-variant text-center">
                                {typeof user.careerYears === 'number' ? (
                                  <span className="font-bold text-on-surface">{user.careerYears}년</span>
                                ) : <span className="text-on-surface-variant/40">—</span>}
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setUserToEdit(user)}
                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="수정"
                                  >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                  </button>
                                  <button
                                    onClick={() => setUserToDelete(user.id)}
                                    className="p-2 text-on-surface-variant hover:text-error transition-colors"
                                    title="삭제"
                                  >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {getSortedUsers().length === 0 && (
                          <tr>
                            <td colSpan={12} className="p-12 text-center text-on-surface-variant italic font-medium">등록된 인원이 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : adminSubView === 'presets' ? (
          <div className="space-y-8">
            <div>
              <h1 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface mb-2">관심사 키워드 관리</h1>
              <p className="text-on-surface-variant text-xs sm:text-sm">유저가 프로필에서 선택할 수 있는 기본 관심사 키워드를 그룹별로 관리합니다.</p>
            </div>

            {/* 그룹 탭 */}
            <div className="flex gap-2">
              {([
                { key: 'work', label: '💼 업무 관련 관심사', count: db.presetInterests.filter(p => (p.group ?? 'work') === 'work').length },
                { key: 'hobby', label: '🎨 취미 관련 관심사', count: db.presetInterests.filter(p => p.group === 'hobby').length },
              ] as { key: 'work' | 'hobby'; label: string; count: number }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setPresetGroupTab(tab.key); setNewPresetKeyword(''); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${
                    presetGroupTab === tab.key
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface text-on-surface-variant border-outline hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${presetGroupTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-xl border border-outline shadow-sm space-y-8">
              {/* 키워드 추가 입력 */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">
                    새 키워드 추가 · {presetGroupTab === 'work' ? '업무 관련' : '취미 관련'}
                  </label>
                  <input
                    type="text"
                    value={newPresetKeyword}
                    onChange={(e) => setNewPresetKeyword(e.target.value)}
                    placeholder={presetGroupTab === 'work' ? '예: AI 활용, 리더십, 데이터 분석' : '예: 독서, 등산, 요리'}
                    className="w-full bg-surface-container-low border border-outline rounded-lg px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddPreset()}
                  />
                </div>
                <button
                  onClick={handleAddPreset}
                  disabled={isProcessing || !newPresetKeyword.trim()}
                  className="sm:mt-7 px-8 py-3 bg-primary text-on-primary font-black rounded-lg flex items-center justify-center gap-2 uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm sm:text-base">add</span> 추가
                </button>
              </div>

              {/* 그룹별 키워드 목록 */}
              {(['work', 'hobby'] as const).map(grp => {
                const groupPresets = [...db.presetInterests]
                  .filter(p => (p.group ?? 'work') === grp)
                  .sort((a, b) => a.keyword.localeCompare(b.keyword));
                if (presetGroupTab !== grp) return null;
                return (
                  <div key={grp} className="space-y-4">
                    <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">
                      {grp === 'work' ? '💼 업무 관련 관심사' : '🎨 취미 관련 관심사'} ({groupPresets.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {groupPresets.map(preset => (
                        <div
                          key={preset.id}
                          className="group flex items-center gap-2 px-4 py-2 bg-surface-container-high border border-outline/30 rounded-full hover:border-error/50 transition-all"
                        >
                          <span className="text-sm font-bold text-on-surface">{preset.keyword}</span>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </div>
                      ))}
                      {groupPresets.length === 0 && (
                        <p className="text-sm text-on-surface-variant italic py-4">등록된 키워드가 없습니다.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-headline text-2xl sm:text-3xl font-bold text-on-surface mb-2">과정별 네트워크 확인</h1>
                <p className="text-on-surface-variant text-xs sm:text-sm">과정별 네트워크 맵과 키워드 인사이트를 확인합니다.</p>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`w-10 h-10 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                title="새로고침"
              >
                <span className="material-symbols-outlined text-on-surface-variant">refresh</span>
              </button>
            </div>

            <div className="bg-surface-container p-4 sm:p-6 rounded-2xl border border-outline-variant/15 flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase">과정 선택</label>
                <select 
                  value={analysisCourseId}
                  onChange={(e) => setAnalysisCourseId(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-xl px-4 py-3 text-sm sm:text-base text-on-surface outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">과정을 선택하세요</option>
                  {db.courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase">기능 선택</label>
                <div className="flex gap-1 p-1 bg-surface-container-highest rounded-xl overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setAnalysisFeature('survey')}
                    className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${analysisFeature === 'survey' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    Keyword Survey
                  </button>
                  <button
                    onClick={() => setAnalysisFeature('total')}
                    className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${analysisFeature === 'total' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    종합 인사이트
                  </button>
                  <button
                    onClick={() => setAnalysisFeature('network')}
                    className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${analysisFeature === 'network' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    네트워크맵
                  </button>
                  <button
                    onClick={() => setAnalysisFeature('peoplemap')}
                    className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${analysisFeature === 'peoplemap' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    피플맵
                  </button>
                  <button
                    onClick={() => setAnalysisFeature('insight')}
                    className={`flex-1 min-w-fit px-3 py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${analysisFeature === 'insight' ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    세션별 키워드 인사이트
                  </button>
                </div>
              </div>
            </div>

            {analysisCourseId ? (
              <div className="bg-surface-container rounded-3xl border border-outline-variant/15 overflow-hidden min-h-[600px] sm:min-h-[800px] relative shadow-2xl">
                {analysisFeature === 'survey' ? (
                  <SurveyInsight courseId={analysisCourseId} />
                ) : analysisFeature === 'total' ? (
                  <TotalInsight courseId={analysisCourseId} />
                ) : analysisFeature === 'network' ? (
                  <NetworkMap adminCourseId={analysisCourseId} />
                ) : analysisFeature === 'peoplemap' ? (
                  <PeopleMap adminCourseId={analysisCourseId} />
                ) : (
                  <InsightView adminCourseId={analysisCourseId} />
                )}
              </div>
            ) : (
              <div className="bg-surface-container rounded-3xl border border-outline-variant/15 h-[300px] sm:h-[400px] flex flex-col items-center justify-center text-on-surface-variant gap-4">
                <span className="material-symbols-outlined text-4xl sm:text-6xl opacity-20">analytics</span>
                <p className="font-bold text-sm sm:text-base">과정을 선택하여 분석을 시작하세요.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* User Edit Modal */}
      {userToEdit && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-in fade-in slide-in-from-bottom-4 overflow-y-auto">
          <MyProfile 
            targetUser={userToEdit}
            onSave={() => {
              setUserToEdit(null);
              fetchData();
            }}
            showBack={true}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-outline animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-3xl">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">데이터 삭제 확인</h3>
                <p className="text-sm text-on-surface-variant mt-2">
                  해당 리더의 모든 데이터(관심사, 인사이트 등)가 영구적으로 삭제됩니다. 정말 삭제하시겠습니까?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 px-4 py-3 bg-surface-container-highest text-on-surface font-black rounded-xl text-xs uppercase tracking-widest hover:bg-outline-variant/20 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={() => {
                    setIsProcessing(true);
                    deleteUser(userToDelete).then(() => {
                      setUserToDelete(null);
                      showStatus('success', '리더 데이터가 삭제되었습니다.');
                    }).catch(() => {
                      showStatus('error', '삭제에 실패했습니다.');
                    }).finally(() => setIsProcessing(false));
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-error text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-error/90 transition-colors shadow-lg shadow-error/20 disabled:opacity-50"
                >
                  {isProcessing ? '...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {courseToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-outline animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-3xl">delete_forever</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">과정 삭제 확인</h3>
                <p className="text-sm text-on-surface-variant mt-2">
                  해당 과정과 관련된 모든 세션, 리더 명단 및 활동 데이터가 영구적으로 삭제됩니다. 정말 삭제하시겠습니까?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={() => setCourseToDelete(null)}
                  className="flex-1 px-4 py-3 bg-surface-container-highest text-on-surface font-black rounded-xl text-xs uppercase tracking-widest hover:bg-outline-variant/20 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleDeleteCourse}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-error text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-error/90 transition-colors shadow-lg shadow-error/20 disabled:opacity-50"
                >
                  {isProcessing ? '...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {courseToReset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-outline animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-3xl">delete_sweep</span>
              </div>
              <div>
                <h3 className="text-lg font-black text-on-surface uppercase tracking-tight">DB 초기화 확인</h3>
                <p className="text-sm text-on-surface-variant mt-2">
                  해당 과정의 <strong>모든 리더 명단과 활동 데이터(관심사, 인사이트, 티타임)</strong>가 영구적으로 삭제됩니다.<br/>(과정 및 세션 정보는 유지됩니다.)<br/>정말 초기화하시겠습니까?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-4">
                <button 
                  onClick={() => setCourseToReset(null)}
                  className="flex-1 px-4 py-3 bg-surface-container-highest text-on-surface font-black rounded-xl text-xs uppercase tracking-widest hover:bg-outline-variant/20 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={handleResetCourseData}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-error text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-error/90 transition-colors shadow-lg shadow-error/20 disabled:opacity-50"
                >
                  {isProcessing ? '...' : '초기화'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grouping Results Popup */}
      {isGroupingPopupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl border-t-8 border-tertiary max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-headline font-black text-2xl text-tertiary uppercase tracking-tight">조편성 결과</h3>
                <p className="text-[10px] text-on-surface-variant mt-1 font-black uppercase tracking-widest">
                  {db.courses.find(c => c.id === groupingCourseId)?.name} • {groupingCriteria === 'keyword_top5' ? '키워드 Top 1~5' : '키워드 Top 6~10'} 기준 • {groupCount}조 설정 • {groupingResults.filter(g => g.groupIndex !== -1).length}개 키워드조{groupingResults.some(g => g.groupIndex === -1) ? ' + 기타조' : ''}
                </p>
              </div>
              <button 
                onClick={() => setIsGroupingPopupOpen(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupingResults.map(group => {
                  const isEtc = group.groupIndex === -1;
                  return (
                  <div key={group.groupIndex} className={`bg-white border rounded-lg overflow-hidden shadow-sm ${isEtc ? 'border-outline/50' : 'border-outline'}`}>
                    <div className={`px-4 py-3 border-b ${isEtc ? 'bg-surface-container-low border-outline/30' : 'bg-tertiary/10 border-tertiary/20'}`}>
                      <div className="flex justify-between items-center">
                        <span className={`font-black uppercase tracking-widest text-sm ${isEtc ? 'text-on-surface-variant' : 'text-tertiary'}`}>
                          {isEtc ? '기타조' : `${group.groupIndex}조`}
                        </span>
                        <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{group.users.length}명</span>
                      </div>
                      {!isEtc && (group as any).keyword && (
                        <div className="mt-1.5">
                          <span className="text-[10px] font-black bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full uppercase tracking-widest">
                            #{(group as any).keyword}
                          </span>
                        </div>
                      )}
                      {isEtc && (
                        <p className="text-[9px] text-on-surface-variant/60 mt-0.5">해당 관심사 없는 유저 자유선택</p>
                      )}
                    </div>
                    <div className="p-4">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-on-surface-variant border-b border-outline">
                            <th className="text-left py-2 font-black uppercase tracking-widest">이름</th>
                            <th className="text-left py-2 font-black uppercase tracking-widest">소속</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline/5">
                          {group.users.map(u => (
                            <tr key={u.id}>
                              <td className="py-2.5 font-bold text-on-surface">{u.name}</td>
                              <td className="py-2.5 text-on-surface-variant font-medium">{u.company}</td>
                            </tr>
                          ))}
                          {group.users.length === 0 && (
                            <tr>
                              <td colSpan={2} className="py-6 text-center text-on-surface-variant italic font-medium">배정 인원 없음</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button 
                onClick={() => setIsGroupingPopupOpen(false)}
                className="px-10 py-3 bg-tertiary text-on-tertiary font-black rounded-lg shadow-lg hover:bg-tertiary/90 transition-all uppercase tracking-widest"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
