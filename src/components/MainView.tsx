import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import LocationAutocomplete from './LocationAutocomplete';
import { HYUNDAI_COMPANIES } from '../constants/companies';
import DemoLauncher from '../demo/DemoLauncher';

// ── 3D 네트워크 캔버스 배경 ───────────────────────────────────────────────────
function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const N = 50;
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random(),
      vx: (Math.random() - 0.5) * 0.00022,
      vy: (Math.random() - 0.5) * 0.00022,
      vz: (Math.random() - 0.5) * 0.0005,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.z += n.vz; n.pulse += 0.018;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
        if (n.z < 0 || n.z > 1) n.vz *= -1;
      });
      const px = nodes.map(n => ({ sx: n.x * W, sy: n.y * H, z: n.z, pulse: n.pulse }));
      const sorted = [...px].sort((a, b) => a.z - b.z);

      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const a = sorted[i], b = sorted[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxD = Math.min(W, H) * 0.28;
          if (dist < maxD) {
            const alpha = (1 - dist / maxD) * ((a.z + b.z) / 2) * 0.38;
            ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
            ctx.strokeStyle = `rgba(180,215,255,${alpha.toFixed(3)})`;
            ctx.lineWidth = (a.z + b.z) / 2 * 1.2; ctx.stroke();
          }
        }
      }
      sorted.forEach(n => {
        const r = 1.5 + n.z * 4.5;
        const glow = r * (1 + 0.18 * Math.sin(n.pulse));
        if (n.z > 0.45) {
          const grad = ctx.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, glow * 4.5);
          grad.addColorStop(0, `rgba(120,190,255,${((n.z - 0.45) * 0.32).toFixed(3)})`);
          grad.addColorStop(1, 'rgba(120,190,255,0)');
          ctx.beginPath(); ctx.arc(n.sx, n.sy, glow * 4.5, 0, Math.PI * 2);
          ctx.fillStyle = grad; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.sx, n.sy, glow, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,230,255,${(0.25 + n.z * 0.75).toFixed(3)})`; ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-85" />;
}

// ── 입력 필드 wrapper — 흰 배경, 다크 텍스트 (드롭다운 가독성 확보) ──────────
function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60 px-1">{label}</label>
      <div className="bg-white rounded-xl flex items-center gap-2.5 px-3.5 py-2.5 border border-white/30 focus-within:border-[#4da6ff] focus-within:ring-2 focus-within:ring-[#4da6ff]/20 transition-all">
        <span className="material-symbols-outlined text-sm shrink-0 text-slate-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function SelectField({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60 px-1">{label}</label>
      <div className="bg-white rounded-xl flex items-center relative border border-white/30 focus-within:border-[#4da6ff] focus-within:ring-2 focus-within:ring-[#4da6ff]/20 transition-all">
        {icon && <span className="material-symbols-outlined text-sm shrink-0 text-slate-400 ml-3.5">{icon}</span>}
        <div className={`flex-1 ${icon ? 'pl-2' : 'pl-3.5'} pr-8`}>
          {children}
        </div>
        <span className="material-symbols-outlined text-sm absolute right-3 pointer-events-none text-slate-400">expand_more</span>
      </div>
    </div>
  );
}

const inputCls = "bg-transparent border-none p-0 w-full focus:ring-0 text-sm text-slate-800 placeholder:text-slate-400 outline-none font-medium";
const selectCls = "bg-transparent border-none py-2.5 w-full focus:ring-0 text-sm text-slate-800 outline-none appearance-none cursor-pointer font-medium";

// ── 메인(로그인/등록) 페이지 ──────────────────────────────────────────────────
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
    if (!courseId || !finalCompany || !name) { alert('과정, 회사, 성명을 모두 입력해주세요.'); return; }
    const selectedCourse = db.courses.find(c => c.id === courseId);
    if (selectedCourse?.password && selectedCourse.password !== coursePassword) { alert('과정 비밀번호가 올바르지 않습니다.'); return; }
    const user = login(finalCompany, name, courseId);
    if (!user) {
      if (!agreed) { alert('등록된 정보가 없습니다. 개인정보 수집 및 이용에 동의하신 후 최초 정보를 등록해 주세요.'); return; }
      setIsRegistering(true);
    }
  };

  const handleRegister = async () => {
    const finalCompany = company === '직접입력' ? customCompany : company;
    if (!department || !title || !location || !finalCompany) { alert('모든 정보를 입력해주세요.'); return; }
    if (!agreed) { alert('개인정보 수집 및 이용에 동의해 주세요.'); return; }
    setIsRegisteringInProgress(true);
    try {
      await register({ id: Date.now().toString(), company: finalCompany, name, courseId, department, title, location });
    } catch (error: any) {
      console.error("Registration failed:", error);
      const msg = error?.message?.includes('인증에 실패')
        ? '네트워크 연결을 확인한 후 다시 시도해 주세요.'
        : '등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      alert(msg);
    } finally {
      setIsRegisteringInProgress(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0f3460 0%, #1a5290 40%, #0e2d56 100%)' }}>

      {/* 배경 */}
      <div className="absolute inset-0"><NetworkCanvas /></div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, #4da6ff 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00c8e0 0%, transparent 70%)' }} />
      </div>

      {/* 헤더 */}
      <header className="header-safe shrink-0 z-50 border-b border-white/15"
        style={{ background: 'rgba(10,35,75,0.55)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between px-5 h-12">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(77,166,255,0.35)', border: '1px solid rgba(77,166,255,0.6)' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#7dc8ff' }}>hub</span>
            </div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-white/70">GiveAndTake</span>
          </div>
          <button onClick={onAdminClick}
            className="text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg transition-colors text-white/55 hover:text-white/80 hover:bg-white/10"
            style={{ border: '1px solid rgba(255,255,255,0.18)' }}>
            Admin
          </button>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto relative z-10 scrollbar-hide pb-[env(safe-area-inset-bottom)]">
        <div className="min-h-full flex flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm space-y-5">

            {/* 타이틀 */}
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(77,166,255,0.3), rgba(0,160,220,0.2))', border: '1px solid rgba(77,166,255,0.5)', boxShadow: '0 0 32px rgba(77,166,255,0.2)' }}>
                  <span className="material-symbols-outlined text-2xl" style={{ color: '#7dc8ff' }}>hub</span>
                </div>
              </div>
              <h1 className="font-headline font-black tracking-tighter text-white leading-none"
                style={{ fontSize: 'clamp(1.6rem,7vw,2.8rem)', textShadow: '0 2px 30px rgba(77,166,255,0.35)' }}>
                be Giver <span style={{ color: '#7dc8ff' }}>be Taker</span>
              </h1>
              <p className="text-[10px] font-black tracking-[0.18em] uppercase text-white/45">
                {isRegistering ? '최초 정보 등록' : '로그인'}
              </p>
            </div>

            {/* 폼 카드 — 반투명 다크 + 흰 입력 필드 */}
            <div className="rounded-2xl p-5 space-y-3"
              style={{ background: 'rgba(8,28,65,0.65)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>

              <SelectField label="과정 선택">
                <select value={courseId} onChange={e => setCourseId(e.target.value)} disabled={isRegistering} className={selectCls}>
                  <option value="" disabled>과정을 선택하세요</option>
                  {db.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </SelectField>

              <SelectField label="회사" icon="corporate_fare">
                <select value={company} onChange={e => { setCompany(e.target.value); setIsOtherCompany(e.target.value === '직접입력'); }} disabled={isRegistering} className={selectCls}>
                  <option value="" disabled>회사를 선택하세요</option>
                  {HYUNDAI_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </SelectField>

              {isOtherCompany && (
                <Field label="회사명 직접 입력" icon="edit">
                  <input type="text" value={customCompany} onChange={e => setCustomCompany(e.target.value)} placeholder="회사명을 입력하세요" className={inputCls} />
                </Field>
              )}

              <Field label="성명" icon="person">
                <input type="text" value={name} onChange={e => setName(e.target.value)} disabled={isRegistering} placeholder="이름을 입력하세요" className={inputCls} />
              </Field>

              {courseId && db.courses.find(c => c.id === courseId)?.password && (
                <Field label="과정 비밀번호" icon="lock">
                  <input type="password" value={coursePassword} onChange={e => setCoursePassword(e.target.value)} disabled={isRegistering} placeholder="비밀번호를 입력하세요" className={inputCls} />
                </Field>
              )}

              {isRegistering && (
                <>
                  <Field label="담당 조직" icon="account_tree">
                    <input type="text" value={department} onChange={e => setDepartment(e.target.value)} placeholder="소속 팀/부서를 입력하세요" className={inputCls} />
                  </Field>
                  <Field label="직책" icon="badge">
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="직책을 입력하세요" className={inputCls} />
                  </Field>
                  <Field label="근무지" icon="location_on">
                    <div className="flex-1 min-w-0">
                      <LocationAutocomplete value={location} onChange={setLocation} placeholder="근무지를 입력하세요" />
                    </div>
                  </Field>
                </>
              )}

              {/* 개인정보 안내 */}
              <div className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(77,166,255,0.08)', border: '1px solid rgba(77,166,255,0.22)' }}>
                <div className="px-4 py-2.5 flex items-center gap-2"
                  style={{ borderBottom: '1px solid rgba(77,166,255,0.18)' }}>
                  <span className="material-symbols-outlined text-sm" style={{ color: '#7dc8ff' }}>security</span>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: '#7dc8ff' }}>개인정보 처리 안내</span>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {[
                      ['수집 목적', '사용자 식별 및 서비스 제공'],
                      ['수집 정보', '소속, 성명, 담당조직, 직책, 근무지, 관심사'],
                      ['보유 기간', '과정 종료 후 7일 이내 파기'],
                      ['제3자 제공', '해당 없음'],
                    ].map(([k, v]) => (
                      <React.Fragment key={k}>
                        <span className="text-[9px] font-black text-white/40 uppercase whitespace-nowrap">{k}</span>
                        <span className="text-[9px] text-white/65">{v}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <button onClick={() => setShowPrivacyModal(true)}
                    className="text-[9px] font-bold flex items-center gap-0.5 mt-0.5"
                    style={{ color: '#7dc8ff' }}>
                    전문 보기 <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                  </button>
                </div>
              </div>

              {/* 동의 체크박스 */}
              <label className="flex items-start gap-3 px-1 py-0.5 cursor-pointer group">
                <div className="relative flex items-center shrink-0 mt-0.5">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="peer appearance-none w-4 h-4 rounded border-2 cursor-pointer transition-all"
                    style={{ borderColor: agreed ? '#4da6ff' : 'rgba(255,255,255,0.3)', backgroundColor: agreed ? '#4da6ff' : 'transparent' }} />
                  <span className="material-symbols-outlined absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                    style={{ left: '1px', top: '1px', fontSize: '14px' }}>check</span>
                </div>
                <span className="text-[10px] font-medium text-white/55 group-hover:text-white/75 transition-colors leading-relaxed">
                  개인정보 수집 및 이용에 동의합니다. <span className="font-black text-red-400">(필수)</span>
                </span>
              </label>

              {/* 버튼 */}
              <button
                onClick={isRegistering ? handleRegister : handleLogin}
                disabled={isRegisteringInProgress || (isRegistering && !agreed)}
                className="w-full py-3.5 rounded-xl font-headline font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-1"
                style={(!isRegistering || agreed) && !isRegisteringInProgress
                  ? { background: 'linear-gradient(135deg,#4da6ff,#1a6fd4)', color: '#fff', boxShadow: '0 0 24px rgba(77,166,255,0.4)' }
                  : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)', cursor: 'not-allowed' }}>
                {isRegisteringInProgress
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />처리 중...</>
                  : isRegistering ? '등록 완료' : '입장하기'}
              </button>

              {isRegistering && (
                <button onClick={() => setIsRegistering(false)}
                  className="w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors">
                  취소
                </button>
              )}
            </div>

            {/* 데모 체험 */}
            <DemoLauncher onAdminClick={onAdminClick} />

            {/* 저작권 */}
            <p className="text-center text-[8px] font-medium tracking-wider text-white/30 pb-2">
              © COPYRIGHT 2026 HYUNDAI MOTOR GROUP,<br />ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </main>

      {/* 개인정보처리방침 모달 */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ background: '#0e2d56', border: '1px solid rgba(77,166,255,0.2)' }}>
            <div className="p-5 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h2 className="text-base font-headline font-bold text-white">개인정보 처리방침 전문</h2>
              <button onClick={() => setShowPrivacyModal(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-7 text-sm text-white/60 leading-relaxed">
              {[
                ['제1조 (개인정보의 처리 목적)', '회사는 다음의 목적을 위하여 개인정보를 처리하며, 목적 이외의 용도로는 이용되지 않습니다.\n1. 사용자 식별: 교육 서비스 이용에 따른 본인 확인 및 식별\n2. 서비스 제공: 해당 교육 과정 내 콘텐츠 및 관련 기능 제공'],
                ['제2조 (처리하는 개인정보 항목)', '회사는 서비스 제공을 위해 아래와 같은 필수 항목을 처리하고 있습니다.\n* 항목: 소속(회사), 성명, 담당조직, 직책, 근무지, 관심사, 세션별 학습 인사이트'],
                ['제3조 (개인정보의 처리 및 보유 기간)', '① 회사는 정보주체로부터 수집 시에 동의받은 개인정보 보유·이용기간 내에서 처리·보유합니다.\n② 개인정보 보유 및 이용기간: 해당 교육 과정 종료 후 7일(일주일) 이내\n③ 보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.'],
                ['제4조 (개인정보의 제3자 제공)', '회사는 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 단, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 예외적으로 제공합니다.'],
                ['제5조 (개인정보의 파기절차 및 방법)', '① 개인정보 보유기간의 경과, 처리목적 달성 등으로 불필요하게 되었을 때 지체 없이 파기합니다.\n② 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 파기합니다.'],
                ['제6조 (정보주체의 권리·의무 및 행사방법)', '정보주체는 회사에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있으며, 회사는 이에 대해 지체 없이 조치하겠습니다.'],
              ].map(([title, body]) => (
                <section key={title} className="space-y-2">
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  {body.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('*') ? 'font-bold text-[#7dc8ff]' : ''}>{line}</p>
                  ))}
                </section>
              ))}
              <section className="space-y-2 pb-2">
                <h3 className="text-sm font-bold text-white">제7조 (개인정보 보호책임자)</h3>
                <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 관련 불만처리 및 피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
                <div className="rounded-xl p-4 space-y-1 text-[11px]"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <p><span className="text-white/80 font-bold">성명/부서:</span> 인재개발원 리더십개발팀 한상아 책임매니저</p>
                  <p><span className="text-white/80 font-bold">이메일:</span> sangahan@hyundai.com</p>
                  <p><span className="text-white/80 font-bold">연락처:</span> 031-8014-6368</p>
                </div>
              </section>
            </div>
            <div className="p-5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => setShowPrivacyModal(false)}
                className="w-full py-3 rounded-xl font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg,#4da6ff,#1a6fd4)', boxShadow: '0 0 20px rgba(77,166,255,0.3)' }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
