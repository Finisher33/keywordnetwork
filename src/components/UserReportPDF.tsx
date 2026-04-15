import { useMemo } from 'react';
import { User, Interest, CanonicalTerm, TeaTimeRequest } from '../store';

interface UserReportPDFProps {
  user: User;
  interests: Interest[];
  canonicalTerms: CanonicalTerm[];
  allUsers: User[];
  teaTimeRequests: TeaTimeRequest[];
  groupedNetwork: any[];
  summary: any;
}

export default function UserReportPDF({ 
  user, 
  interests, 
  canonicalTerms, 
  allUsers, 
  teaTimeRequests,
  groupedNetwork,
  summary
}: UserReportPDFProps) {
  const receivedRequests = teaTimeRequests.filter(r => r.toUserId === user.id);
  const sentRequests = teaTimeRequests.filter(r => r.fromUserId === user.id);
  const currentYear = new Date().getFullYear();

  const formatLeaderInfo = (u: User | undefined) => {
    if (!u) return 'Unknown Leader';
    return `${u.company} ${u.department} ${u.name} ${u.title}`;
  };

  const filteredGroups = useMemo(() => {
    return groupedNetwork.filter(group => 
      group.users.some((u: User) => u.id !== user.id)
    );
  }, [groupedNetwork, user.id]);

  const locationGroup = useMemo(() => {
    const location = user.location || '미지정';
    const sameLocationUsers = user.location 
      ? allUsers.filter(u => u.id !== user.id && u.location === user.location)
      : [];
    return {
      title: `근무지: ${location}`,
      users: sameLocationUsers,
      hasLocation: !!user.location
    };
  }, [allUsers, user]);

  return (
    <div className="pdf-report w-[210mm] bg-white px-[10mm] py-[20mm] text-[#111827] font-sans" style={{ colorScheme: 'light', minHeight: '297mm', fontSize: '10pt' }}>
      {/* Header */}
      <div className="pdf-header border-b-2 border-[#002C5F] pb-4 mb-8 flex justify-between items-end">
        <div className="min-w-0">
          <h1 className="pdf-main-title text-[24pt] font-black text-[#002C5F] tracking-tight whitespace-nowrap">be Giver be Taker • Network Report</h1>
          <p className="pdf-user-info text-[12pt] font-bold text-[#4B5563] mt-2">{formatLeaderInfo(user)}</p>
        </div>
        <p className="pdf-date text-[10pt] font-bold text-[#00AAD2] whitespace-nowrap ml-4">Date: {new Date().toLocaleDateString()}</p>
      </div>

      {/* 1. 네트워크 요약 */}
      <div className="pdf-section mb-8 p-6 border border-[#e5e7eb] bg-[#F9FAFB] rounded-xl" style={{ breakInside: 'avoid' }}>
        <div className="pdf-section-title-container border-t-2 border-[#002C5F] pt-2 mb-4">
          <h3 className="pdf-section-title text-[14pt] font-bold text-[#002C5F]">01. 네트워크 요약</h3>
        </div>
        <div className="pdf-grid grid grid-cols-3 gap-4">
          <div className="pdf-stat-box border border-[#e5e7eb] p-4 rounded-lg bg-white shadow-sm">
            <p className="pdf-stat-label text-[9pt] text-[#00AAD2] font-black uppercase mb-1 tracking-wider">Connected</p>
            <p className="pdf-stat-value text-[16pt] font-black text-[#002C5F]">{summary.total}명</p>
            <p className="pdf-stat-sub text-[9pt] text-[#6B7280] font-medium">Giver {summary.givers} / Taker {summary.takers}</p>
          </div>
          <div className="pdf-stat-box border border-[#e5e7eb] p-4 rounded-lg bg-white shadow-sm">
            <p className="pdf-stat-label text-[9pt] text-[#00AAD2] font-black uppercase mb-1 tracking-wider">Tea Time (In)</p>
            <p className="pdf-stat-value text-[16pt] font-black text-[#002C5F]">{receivedRequests.length}회</p>
            <p className="pdf-stat-sub text-[9pt] text-[#6B7280] font-medium">받은 요청</p>
          </div>
          <div className="pdf-stat-box border border-[#e5e7eb] p-4 rounded-lg bg-white shadow-sm">
            <p className="pdf-stat-label text-[9pt] text-[#00AAD2] font-black uppercase mb-1 tracking-wider">Tea Time (Out)</p>
            <p className="pdf-stat-value text-[16pt] font-black text-[#002C5F]">{sentRequests.length}회</p>
            <p className="pdf-stat-sub text-[9pt] text-[#6B7280] font-medium">보낸 요청</p>
          </div>
        </div>
      </div>

      {/* 2. 티타임 요청 현황 */}
      <div className="pdf-section mb-8 p-6 border border-[#e5e7eb] bg-[#F9FAFB] rounded-xl" style={{ breakInside: 'avoid' }}>
        <div className="pdf-section-title-container border-t-2 border-[#002C5F] pt-2 mb-4">
          <h3 className="pdf-section-title text-[14pt] font-bold text-[#002C5F]">02. 티타임 요청 현황</h3>
        </div>
        <div className="pdf-stack space-y-6">
          <div className="pdf-sub-section" style={{ breakInside: 'avoid' }}>
            <p className="pdf-sub-title text-[11pt] font-black text-[#002C5F] mb-2 border-b border-[#e5e7eb] pb-1">받은 요청 ({receivedRequests.length})</p>
            <div className="pdf-list space-y-3">
              {receivedRequests.length === 0 ? (
                <p className="pdf-empty text-[10pt] text-[#9ca3af] italic">받은 요청이 없습니다.</p>
              ) : (
                receivedRequests.slice(0, 10).map(req => {
                  const fromUser = allUsers.find(u => u.id === req.fromUserId);
                  return (
                    <div key={req.id} className="pdf-item text-[10pt] border-l-4 border-[#00AAD2] pl-4 py-2 bg-white rounded-r-lg shadow-sm" style={{ breakInside: 'avoid' }}>
                      <div className="pdf-item-header flex justify-between items-center">
                        <span className="pdf-item-name font-bold text-[#111827]">{formatLeaderInfo(fromUser)}</span>
                        <span className={`pdf-item-status text-[9pt] font-black px-2 py-0.5 rounded ${req.status === 'accepted' ? 'bg-success/10 text-success' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="pdf-item-msg text-[#4B5563] mt-2 leading-relaxed italic">"{req.message}"</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="pdf-sub-section" style={{ breakInside: 'avoid' }}>
            <p className="pdf-sub-title text-[11pt] font-black text-[#002C5F] mb-2 border-b border-[#e5e7eb] pb-1">보낸 요청 ({sentRequests.length})</p>
            <div className="pdf-list space-y-3">
              {sentRequests.length === 0 ? (
                <p className="pdf-empty text-[10pt] text-[#9ca3af] italic">보낸 요청이 없습니다.</p>
              ) : (
                sentRequests.slice(0, 10).map(req => {
                  const toUser = allUsers.find(u => u.id === req.toUserId);
                  return (
                    <div key={req.id} className="pdf-item text-[10pt] border-l-4 border-[#002C5F] pl-4 py-2 bg-white rounded-r-lg shadow-sm" style={{ breakInside: 'avoid' }}>
                      <div className="pdf-item-header flex justify-between items-center">
                        <span className="pdf-item-name font-bold text-[#111827]">{formatLeaderInfo(toUser)}</span>
                        <span className={`pdf-item-status text-[9pt] font-black px-2 py-0.5 rounded ${req.status === 'accepted' ? 'bg-success/10 text-success' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="pdf-item-msg text-[#4B5563] mt-2 leading-relaxed italic">"{req.message}"</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 키워드 네트워크 요약 */}
      <div className="pdf-section mb-8 p-6 border border-[#e5e7eb] bg-[#F9FAFB] rounded-xl" style={{ breakInside: 'avoid' }}>
        <div className="pdf-section-title-container border-t-2 border-[#002C5F] pt-2 mb-4">
          <h3 className="pdf-section-title text-[14pt] font-bold text-[#002C5F]">03. 키워드 네트워크 요약</h3>
        </div>
        <div className="pdf-stack space-y-6">
          {filteredGroups.length === 0 ? (
            <p className="pdf-empty text-[10pt] text-[#9ca3af] italic">추천 네트워크가 없습니다.</p>
          ) : (
            filteredGroups.slice(0, 3).map(group => (
              <div key={group.id} className="pdf-group-box border border-[#e5e7eb] p-5 rounded-lg bg-white shadow-sm" style={{ breakInside: 'avoid' }}>
                <div className="pdf-group-header flex justify-between items-center mb-4 border-b-2 border-[#F3F4F6] pb-2">
                  <p className="pdf-group-title text-[12pt] font-black text-[#002C5F]">{group.title}</p>
                  <p className="pdf-group-rec text-[10pt] text-[#00AAD2] font-black tracking-tight">{group.recommendation}</p>
                </div>
                <div className="pdf-group-list space-y-4">
                  {group.users.filter((u: User) => u.id !== user.id).slice(0, 5).map((u: User) => {
                    const uInterests = interests.filter(i => i.userId === u.id && group.title.includes(i.keyword));
                    return (
                      <div key={u.id} className="pdf-user-card flex gap-4 bg-[#FAFAFA] p-4 border border-[#F3F4F6] rounded-xl" style={{ breakInside: 'avoid' }}>
                        <div className="pdf-user-avatar shrink-0">
                          <img 
                            src={u.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} 
                            alt="" 
                            className="w-14 h-14 rounded-full border-2 border-white shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="pdf-user-content flex-1 min-w-0">
                          {uInterests.map(i => (
                            <div key={i.id} className="pdf-user-interest-item mb-2 last:mb-0">
                              <div className="pdf-user-header flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`pdf-badge text-[8pt] font-black px-2 py-0.5 rounded uppercase inline-flex items-center justify-center min-w-[45px] ${i.type === 'giver' ? 'pdf-badge-giver' : 'pdf-badge-taker'}`}>
                                  {i.type}
                                </span>
                                <span className="pdf-user-info-text text-[10pt] font-bold text-[#002C5F]">
                                  {u.company} {u.department} {u.name} {u.title}
                                </span>
                              </div>
                              <p className="pdf-user-desc text-[9.5pt] text-[#4B5563] leading-snug italic mt-1">"{i.description}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. 근무지 기반 추천 */}
      <div className="pdf-section mb-8 p-6 border border-[#e5e7eb] bg-[#F9FAFB] rounded-xl" style={{ breakInside: 'avoid' }}>
        <div className="pdf-section-title-container border-t-2 border-[#002C5F] pt-2 mb-4">
          <h3 className="pdf-section-title text-[14pt] font-bold text-[#002C5F]">04. 근무지 기반 추천</h3>
        </div>
        <div className="pdf-location-box border border-[#e5e7eb] p-5 rounded-lg bg-white shadow-sm">
          <p className="pdf-location-title text-[11pt] font-black text-[#002C5F] mb-4 border-b border-[#F3F4F6] pb-2">{locationGroup.title}</p>
          {!locationGroup.hasLocation ? (
            <p className="pdf-empty text-[10pt] text-[#9ca3af] italic">근무지 정보가 없습니다.</p>
          ) : locationGroup.users.length === 0 ? (
            <p className="pdf-empty text-[10pt] text-[#9ca3af] italic">동일 근무지 동료가 없습니다.</p>
          ) : (
            <div className="pdf-location-list grid grid-cols-1 gap-3">
              {locationGroup.users.slice(0, 15).map(u => (
                <div key={u.id} className="pdf-location-item text-[10pt] text-[#4B5563] font-medium flex items-center gap-2" style={{ breakInside: 'avoid' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00AAD2]"></span>
                  {formatLeaderInfo(u)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pdf-footer mt-auto pt-6 border-t-2 border-[#F3F4F6] text-center">
        <p className="pdf-footer-msg text-[11pt] text-[#002C5F] font-black">리더님들간의 의미있는 연결과 지속적인 교류를 응원합니다.</p>
        <p className="pdf-copyright text-[9pt] text-[#9ca3af] mt-2 font-medium">ⓒ {currentYear} HMG 인재개발원. All rights reserved.</p>
      </div>
    </div>
  );
}
