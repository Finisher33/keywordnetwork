import { useState } from 'react';
import { useStore } from '../store';
import LocationAutocomplete from './LocationAutocomplete';
import { HYUNDAI_COMPANIES } from '../constants/companies';

export default function MainView({ onAdminClick }: { onAdminClick: () => void }) {
  const { db, login, register } = useStore();
  const [courseId, setCourseId] = useState('');
  const [company, setCompany] = useState('');
  const [customCompany, setCustomCompany] = useState('');
  const [isOtherCompany, setIsOtherCompany] = useState(false);
  const [name, setName] = useState('');
  const [coursePassword, setCoursePassword] = useState('');
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisteringInProgress, setIsRegisteringInProgress] = useState(false);
  const [department, setDepartment] = useState('');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleLogin = () => {
    const finalCompany = company === '직접입력' ? customCompany : company;
    if (!courseId || !finalCompany || !name) {
      alert('과정, 회사, 성명을 모두 입력해주세요.');
      return;
    }

    const selectedCourse = db.courses.find(c => c.id === courseId);
    if (selectedCourse?.password && selectedCourse.password !== coursePassword) {
      alert('과정 비밀번호가 올바르지 않습니다.');
      return;
    }
    
    // 먼저 로그인 시도 (사용자 존재 여부 확인)
    const user = login(finalCompany, name, courseId);
    
    if (!user) {
      // 사용자가 없을 경우에만 동의 여부 확인
      if (!agreed) {
        alert('등록된 정보가 없습니다. 개인정보 수집 및 이용에 동의하신 후 최초 정보를 등록해 주세요.');
        return;
      }
      setIsRegistering(true);
    }
  };

  const handleRegister = async () => {
    const finalCompany = company === '직접입력' ? customCompany : company;
    if (!department || !title || !location || !finalCompany) {
      alert('모든 정보를 입력해주세요.');
      return;
    }
    if (!agreed) {
      alert('개인정보 수집 및 이용에 동의해 주세요.');
      return;
    }
    
    setIsRegisteringInProgress(true);
    try {
      await register({
        id: Date.now().toString(),
        company: finalCompany,
        name,
        courseId,
        department,
        title,
        location
      });
    } catch (error) {
      console.error("Registration failed:", error);
      alert('등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsRegisteringInProgress(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 w-full z-50 bg-surface border-b border-outline shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">hub</span>
        </div>
        <button 
          onClick={onAdminClick}
          className="text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
        >
          Admin
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="min-h-full flex flex-col">
          <div className="my-auto w-full max-w-xl mx-auto space-y-10 py-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/5 border border-primary/10 mb-2">
              <span className="material-symbols-outlined text-4xl text-primary">hub</span>
            </div>
            <h1 className="text-[clamp(1.75rem,8vw,4.5rem)] font-headline font-black tracking-tight text-primary leading-none whitespace-nowrap w-full">
              be Giver be Taker
            </h1>
            <div className="h-1 w-12 bg-secondary mx-auto rounded-full"></div>
          </div>

          <section className="space-y-2 text-center">
            <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight">
              {isRegistering ? '최초 정보 등록' : '로그인'}
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              {isRegistering 
                ? '플랫폼 활동을 위한 기본 정보를 입력해 주세요.' 
                : '과정을 선택하고 정보를 입력해 주세요.'}
            </p>
          </section>

          <section className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">과정 선택</label>
              <div className="bg-white rounded-lg border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all relative flex items-center">
                <select 
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  disabled={isRegistering}
                  className="bg-transparent border-none px-4 py-3 w-full focus:ring-0 text-on-surface text-sm outline-none font-medium appearance-none cursor-pointer pr-10"
                >
                  <option value="" disabled>과정을 선택하세요</option>
                  {db.courses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-on-surface-variant text-sm absolute right-3 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">회사</label>
              <div className="bg-white rounded-lg border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 flex items-center transition-all relative">
                <span className="material-symbols-outlined text-on-surface-variant text-sm absolute left-4 pointer-events-none">corporate_fare</span>
                <select 
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    setIsOtherCompany(e.target.value === '직접입력');
                  }}
                  disabled={isRegistering}
                  className="bg-transparent border-none pl-11 pr-10 py-3 w-full focus:ring-0 text-on-surface text-sm outline-none appearance-none font-medium cursor-pointer"
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
                <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">회사명 직접 입력</label>
                <div className="bg-white rounded-lg px-4 py-3 border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 flex items-center gap-3 transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">edit</span>
                  <input 
                    type="text" 
                    value={customCompany}
                    onChange={(e) => setCustomCompany(e.target.value)}
                    placeholder="회사명을 입력하세요" 
                    className="bg-transparent border-none p-0 w-full focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 outline-none font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">성명</label>
              <div className="bg-white rounded-lg px-4 py-3 border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">person</span>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isRegistering}
                  placeholder="이름을 입력하세요" 
                  className="bg-transparent border-none p-0 w-full focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 outline-none font-medium"
                />
              </div>
            </div>

            {courseId && db.courses.find(c => c.id === courseId)?.password && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">과정 비밀번호</label>
                <div className="bg-white rounded-lg px-4 py-3 border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 flex items-center gap-3 transition-all">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">lock</span>
                  <input 
                    type="password" 
                    value={coursePassword}
                    onChange={(e) => setCoursePassword(e.target.value)}
                    disabled={isRegistering}
                    placeholder="비밀번호를 입력하세요" 
                    className="bg-transparent border-none p-0 w-full focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 outline-none font-medium"
                  />
                </div>
              </div>
            )}

            {isRegistering && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">담당 조직</label>
                  <div className="bg-white rounded-lg px-4 py-3 border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 flex items-center gap-3 transition-all">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm">account_tree</span>
                    <input 
                      type="text" 
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="소속 팀/부서를 입력하세요" 
                      className="bg-transparent border-none p-0 w-full focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">직책</label>
                  <div className="bg-white rounded-lg px-4 py-3 border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="직책을 입력하세요" 
                      className="bg-transparent border-none p-0 w-full focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/40 outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant px-1">근무지</label>
                  <div className="bg-white rounded-lg px-4 py-3 border border-outline focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 flex items-start gap-3 transition-all">
                    <span className="material-symbols-outlined text-on-surface-variant text-sm mt-0.5">location_on</span>
                    <LocationAutocomplete 
                      value={location}
                      onChange={setLocation}
                      placeholder="근무지를 입력하세요"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Privacy Policy Summary Box */}
            <div className="bg-white rounded-lg border border-outline overflow-hidden shadow-sm">
              <div className="p-4 bg-surface-container-low border-b border-outline">
                <h3 className="text-xs font-black text-primary flex items-center gap-2 uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm">security</span>
                  개인정보 처리 안내
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-[11px] text-on-surface-variant leading-relaxed font-medium">
                  사용자의 정보를 안전하게 보호하며, 교육 서비스 제공을 위해 꼭 필요한 정보만 수집합니다.
                </p>
                <div className="grid grid-cols-3 gap-px bg-outline overflow-hidden rounded-md border border-outline">
                  <div className="bg-surface-container-low p-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">수집 목적</div>
                  <div className="bg-white p-2.5 text-[10px] text-on-surface col-span-2 font-medium">사용자 식별 및 서비스 제공</div>
                  
                  <div className="bg-surface-container-low p-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">수집 정보</div>
                  <div className="bg-white p-2.5 text-[10px] text-on-surface col-span-2 font-medium leading-tight">소속(회사), 성명, 담당조직, 직책, 근무지, 관심사, 세션별 학습 인사이트</div>
                  
                  <div className="bg-surface-container-low p-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">보유 기간</div>
                  <div className="bg-white p-2.5 text-[10px] text-on-surface col-span-2 font-medium">과정 종료 후 일주일 이내 파기</div>
                  
                  <div className="bg-surface-container-low p-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-tighter">제3자 제공</div>
                  <div className="bg-white p-2.5 text-[10px] text-on-surface col-span-2 font-medium">해당 없음 (외부 제공 안함)</div>
                </div>
                <button 
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-[10px] text-secondary font-bold hover:underline flex items-center gap-1"
                >
                  * 상세 내용 확인 : [개인정보 처리방침]
                </button>
              </div>
            </div>

            {/* Agreement Checkbox */}
            <label className="flex items-start gap-3 p-2 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="peer appearance-none w-5 h-5 rounded border-2 border-outline checked:bg-primary checked:border-primary transition-all cursor-pointer"
                />
                <span className="material-symbols-outlined absolute text-white text-sm opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  check
                </span>
              </div>
              <span className="text-xs font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">
                개인정보 수집 및 이용에 대한 안내를 확인하였으며 이에 동의합니다. <span className="text-error font-bold">(필수)</span>
              </span>
            </label>

            <button 
              onClick={isRegistering ? handleRegister : handleLogin}
              disabled={isRegisteringInProgress || (isRegistering && !agreed)}
              className={`w-full py-4 mt-2 font-headline font-black text-lg rounded-lg shadow-lg transition-all duration-300 uppercase tracking-widest flex items-center justify-center gap-2 ${
                (!isRegistering || agreed) && !isRegisteringInProgress
                  ? 'bg-primary text-on-primary hover:bg-primary/90 hover:shadow-xl active:scale-[0.98]' 
                  : 'bg-surface-container-highest text-on-surface-variant/40 cursor-not-allowed'
              }`}
            >
              {isRegisteringInProgress ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  처리 중...
                </>
              ) : (isRegistering ? '등록 완료' : '입장하기')}
            </button>
            
            {isRegistering && (
              <button 
                onClick={() => setIsRegistering(false)}
                className="w-full py-3 mt-2 text-on-surface-variant text-sm hover:text-on-surface transition-colors"
              >
                취소
              </button>
            )}
          </section>
          </div>
        </div>
      </main>

      {/* Privacy Policy Full Text Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-outline">
            <div className="p-6 border-b border-outline flex items-center justify-between bg-surface-container-low">
              <h2 className="text-xl font-headline font-bold text-on-surface">개인정보 처리방침 전문</h2>
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 text-sm text-on-surface-variant leading-relaxed">
              <section className="space-y-3">
                <h3 className="text-lg font-bold text-on-surface">제1조 (개인정보의 처리 목적)</h3>
                <p>회사는 다음의 목적을 위하여 개인정보를 처리하며, 목적 이외의 용도로는 이용되지 않습니다.</p>
                <ul className="list-decimal pl-5 space-y-1">
                  <li>사용자 식별: 교육 서비스 이용에 따른 본인 확인 및 식별</li>
                  <li>서비스 제공: 해당 교육 과정 내 콘텐츠 및 관련 기능 제공</li>
                </ul>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-bold text-on-surface">제2조 (처리하는 개인정보 항목)</h3>
                <p>회사는 서비스 제공을 위해 아래와 같은 필수 항목을 처리하고 있습니다.</p>
                <p className="font-bold text-primary">* 항목: 소속(회사), 성명, 담당조직, 직책, 근무지, 관심사, 세션별 학습 인사이트</p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-bold text-on-surface">제3조 (개인정보의 처리 및 보유 기간)</h3>
                <p>① 회사는 정보주체로부터 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
                <p>② 개인정보 보유 및 이용기간: 이용자가 참여하는 해당 교육 과정 종료 후 7일(일주일) 이내</p>
                <p>③ 회사는 보유 기간이 경과하거나 처리 목적이 달성된 개인정보를 지체 없이 파기합니다.</p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-bold text-on-surface">제4조 (개인정보의 제3자 제공)</h3>
                <p>회사는 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 단, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 예외적으로 제공합니다.</p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-bold text-on-surface">제5조 (개인정보의 파기절차 및 방법)</h3>
                <p>① 회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</p>
                <p>② 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 파기합니다.</p>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-bold text-on-surface">제6조 (정보주체의 권리·의무 및 행사방법)</h3>
                <p>정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.</p>
              </section>

              <section className="space-y-3 pb-4">
                <h3 className="text-lg font-bold text-on-surface">제7조 (개인정보 보호책임자)</h3>
                <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
                <div className="bg-surface-container-low p-4 rounded-xl border border-outline space-y-1">
                  <p><span className="font-bold">성명/부서:</span> 인재개발원 리더십개발팀 한상아 책임매니저</p>
                  <p><span className="font-bold">이메일:</span> sangahan@hyundai.com</p>
                  <p><span className="font-bold">연락처:</span> 031-8014-6368</p>
                </div>
              </section>
            </div>
            <div className="p-6 border-t border-outline bg-surface-container-low">
              <button 
                onClick={() => setShowPrivacyModal(false)}
                className="w-full py-3 bg-primary text-on-primary font-bold rounded-xl"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
