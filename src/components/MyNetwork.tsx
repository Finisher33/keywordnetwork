import { useMemo, useState, Fragment, useRef } from 'react';
import { useStore, User, Interest } from '../store';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import UserReportPDF from './UserReportPDF';
import { calculateUserNetworkData, getKeywordColor } from '../utils/networkUtils';

interface MyNetworkProps {
  targetUser?: User;
  hideActions?: boolean;
}

export default function MyNetwork({ targetUser, hideActions = false }: MyNetworkProps) {
  const { db, currentUser: storeUser, updateTeaTimeRequest, sendTeaTimeRequest, synonymLevel, fetchData } = useStore();
  const currentUser = targetUser || storeUser;
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [replyMsg, setReplyMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [teaTimeMsg, setTeaTimeMsg] = useState('');
  const [requestingTo, setRequestingTo] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const pdfReportRef = useRef<HTMLDivElement>(null);

  const networkData = useMemo(() => {
    if (!currentUser) return null;
    return calculateUserNetworkData(currentUser, db);
  }, [currentUser, db]);

  const { groupedNetwork, summary, keywordGroups, myInterests } = networkData || { 
    groupedNetwork: [], 
    summary: { total: 0, givers: 0, takers: 0, receivedCount: 0, sentCount: 0 },
    keywordGroups: {},
    myInterests: []
  };

  const handleDownloadPDF = async () => {
    if (!pdfReportRef.current) return;
    setIsDownloading(true);

    try {
      const element = pdfReportRef.current;
      
      // Ensure all images are loaded
      const images = Array.from(element.getElementsByTagName('img')) as HTMLImageElement[];
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Remove all existing style and link tags to prevent oklch parsing errors
          const styles = clonedDoc.getElementsByTagName('style');
          const links = clonedDoc.getElementsByTagName('link');
          Array.from(styles).forEach(s => s.remove());
          Array.from(links).forEach(l => {
            if (l.rel === 'stylesheet') l.remove();
          });

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            * {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .pdf-report { width: 210mm !important; padding: 20mm 10mm !important; background-color: #ffffff !important; color: #111827 !important; box-sizing: border-box !important; }
            .pdf-header { border-bottom: 2px solid #002c5f !important; padding-bottom: 1rem !important; margin-bottom: 2rem !important; display: flex !important; justify-content: space-between !important; align-items: flex-end !important; }
            .pdf-main-title { font-size: 24pt !important; font-weight: 900 !important; color: #002c5f !important; margin: 0 !important; letter-spacing: -0.02em !important; white-space: nowrap !important; }
            .pdf-user-info { font-size: 12pt !important; font-weight: 700 !important; color: #4b5563 !important; margin-top: 0.5rem !important; }
            .pdf-date { font-size: 10pt !important; font-weight: 700 !important; color: #00aad2 !important; margin: 0 !important; white-space: nowrap !important; margin-left: 1rem !important; }
            
            .pdf-section { margin-bottom: 2rem !important; padding: 1.5rem !important; border: 1px solid #e5e7eb !important; background-color: #f9fafb !important; border-radius: 0.75rem !important; box-sizing: border-box !important; }
            .pdf-section-title-container { border-top: 2px solid #002c5f !important; padding-top: 0.5rem !important; margin-bottom: 1rem !important; }
            .pdf-section-title { font-size: 14pt !important; font-weight: 700 !important; color: #002c5f !important; margin: 0 !important; }
            
            .pdf-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 1rem !important; }
            .pdf-stat-box { border: 1px solid #e5e7eb !important; padding: 1rem !important; border-radius: 0.5rem !important; background-color: #ffffff !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; }
            .pdf-stat-label { font-size: 9pt !important; color: #00aad2 !important; font-weight: 900 !important; text-transform: uppercase !important; margin-bottom: 0.25rem !important; letter-spacing: 0.05em !important; }
            .pdf-stat-value { font-size: 16pt !important; font-weight: 900 !important; color: #002c5f !important; margin: 0 !important; }
            .pdf-stat-sub { font-size: 9pt !important; color: #6b7280 !important; font-weight: 500 !important; margin: 0 !important; }
            
            .pdf-stack { display: flex !important; flex-direction: column !important; gap: 1.5rem !important; }
            .pdf-sub-title { font-size: 11pt !important; font-weight: 900 !important; color: #002c5f !important; margin-bottom: 0.5rem !important; border-bottom: 1px solid #e5e7eb !important; padding-bottom: 0.25rem !important; }
            .pdf-list { display: flex !important; flex-direction: column !important; gap: 0.75rem !important; }
            .pdf-item { border-left: 4px solid #00aad2 !important; padding: 0.5rem 0 0.5rem 1rem !important; background-color: #ffffff !important; border-radius: 0 0.5rem 0.5rem 0 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; box-sizing: border-box !important; }
            .pdf-item-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 0.25rem !important; }
            .pdf-item-name { font-weight: 700 !important; font-size: 10pt !important; color: #111827 !important; }
            .pdf-item-status { font-weight: 900 !important; font-size: 9pt !important; padding: 0.125rem 0.5rem !important; border-radius: 9999px !important; background-color: #f3f4f6 !important; color: #6b7280 !important; }
            .pdf-item-msg { color: #4b5563 !important; margin-top: 0.5rem !important; font-style: italic !important; line-height: 1.5 !important; font-size: 10pt !important; }
            
            .pdf-group-box { border: 1px solid #e5e7eb !important; padding: 1.25rem !important; border-radius: 0.5rem !important; background-color: #ffffff !important; margin-bottom: 1.5rem !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; box-sizing: border-box !important; }
            .pdf-group-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 1rem !important; border-bottom: 2px solid #f3f4f6 !important; padding-bottom: 0.5rem !important; }
            .pdf-group-title { font-size: 12pt !important; font-weight: 900 !important; color: #002c5f !important; margin: 0 !important; }
            .pdf-group-rec { font-size: 10pt !important; color: #00aad2 !important; font-weight: 900 !important; margin: 0 !important; }
            
            .pdf-user-card { display: flex !important; gap: 1rem !important; background-color: #fafafa !important; padding: 1rem !important; border: 1px solid #f3f4f6 !important; border-radius: 0.75rem !important; margin-bottom: 1rem !important; box-sizing: border-box !important; }
            .pdf-user-avatar { width: 3.5rem !important; height: 3.5rem !important; flex-shrink: 0 !important; border-radius: 9999px !important; overflow: hidden !important; border: 2px solid #ffffff !important; box-shadow: 0 1px 2px rgba(0,0,0,0.1) !important; }
            .pdf-user-avatar img { width: 100% !important; height: 100% !important; object-fit: cover !important; }
            .pdf-user-content { flex: 1 !important; min-width: 0 !important; }
            .pdf-user-header { display: flex !important; align-items: center !important; gap: 0.5rem !important; margin-bottom: 0.25rem !important; flex-wrap: wrap !important; }
            .pdf-user-info-text { font-weight: 700 !important; color: #002c5f !important; font-size: 10pt !important; }
            
            .pdf-badge { font-size: 8pt !important; font-weight: 900 !important; padding: 0.125rem 0.5rem !important; border-radius: 0.25rem !important; text-transform: uppercase !important; color: #ffffff !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; min-width: 45px !important; }
            .pdf-badge-giver { background-color: #002c5f !important; }
            .pdf-badge-taker { background-color: #00aad2 !important; }
            .pdf-user-desc { color: #4b5563 !important; font-style: italic !important; line-height: 1.4 !important; font-size: 9.5pt !important; margin-top: 0.25rem !important; }
            
            .pdf-location-box { border: 1px solid #e5e7eb !important; padding: 1.25rem !important; border-radius: 0.5rem !important; background-color: #ffffff !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; box-sizing: border-box !important; }
            .pdf-location-title { font-size: 11pt !important; font-weight: 900 !important; color: #002c5f !important; margin-bottom: 1rem !important; border-bottom: 1px solid #f3f4f6 !important; padding-bottom: 0.5rem !important; }
            .pdf-location-item { font-size: 10pt !important; color: #4b5563 !important; display: flex !important; align-items: center !important; gap: 0.5rem !important; margin-bottom: 0.75rem !important; font-weight: 500 !important; box-sizing: border-box !important; }
            .pdf-location-item::before { content: "" !important; width: 6px !important; height: 6px !important; background-color: #00aad2 !important; border-radius: 9999px !important; display: inline-block !important; }
            
            .pdf-footer { margin-top: auto !important; padding-top: 1.5rem !important; border-top: 2px solid #f3f4f6 !important; text-align: center !important; }
            .pdf-footer-msg { font-size: 11pt !important; color: #002c5f !important; font-weight: 900 !important; margin: 0 !important; }
            .pdf-copyright { font-size: 9pt !important; color: #9ca3af !important; margin-top: 0.5rem !important; font-weight: 500 !important; }
            
            .italic { font-style: italic !important; }
            .uppercase { text-transform: uppercase !important; }
          `;
          clonedDoc.head.appendChild(style);

          // Smart Page Break Logic
          const report = clonedDoc.querySelector('.pdf-report') as HTMLElement;
          if (report) {
            const pageHeightPx = (297 / 210) * report.offsetWidth; // A4 ratio
            const blocks = clonedDoc.querySelectorAll('.pdf-section, .pdf-item, .pdf-user-card, .pdf-group-box, .pdf-location-item');
            
            blocks.forEach((block: any) => {
              const rect = block.getBoundingClientRect();
              const reportRect = report.getBoundingClientRect();
              const relativeTop = rect.top - reportRect.top;
              const relativeBottom = rect.bottom - reportRect.top;
              
              const startPage = Math.floor(relativeTop / pageHeightPx);
              const endPage = Math.floor(relativeBottom / pageHeightPx);
              
              if (startPage !== endPage) {
                // This block is split across pages. Insert a spacer before it.
                const spacerHeight = (startPage + 1) * pageHeightPx - relativeTop;
                const spacer = clonedDoc.createElement('div');
                spacer.style.height = `${spacerHeight}px`;
                spacer.style.width = '100%';
                spacer.style.backgroundColor = 'transparent';
                block.parentNode.insertBefore(spacer, block);
              }
            });
          }
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Define margins (10mm left/right, 20mm top/bottom)
      const marginX = 10;
      const marginY = 20;
      const contentWidth = pdfWidth - (marginX * 2);
      const contentHeight = pdfHeight - (marginY * 2);
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = contentWidth;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let currentOffset = 0;
      while (currentOffset < imgHeight) {
        if (currentOffset > 0) {
          // Skip near-empty final pages (less than 15mm of real content)
          const remaining = imgHeight - currentOffset;
          if (remaining < 15) break;
          pdf.addPage();
        }

        // Draw the image slice with top margin offset
        pdf.addImage(imgData, 'JPEG', marginX, marginY - currentOffset, imgWidth, imgHeight);

        // Mask top and bottom margins with white rectangles to ensure clean edges
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, marginY, 'F'); // Top margin mask
        pdf.rect(0, pdfHeight - marginY, pdfWidth, marginY, 'F'); // Bottom margin mask

        currentOffset += contentHeight;
      }

      pdf.save(`NetworkReport_${currentUser?.name || 'User'}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const receivedRequests = useMemo(() => {
    return db.teaTimeRequests.filter(r => r.toUserId === currentUser?.id);
  }, [db.teaTimeRequests, currentUser]);

  const sentRequests = useMemo(() => {
    return db.teaTimeRequests.filter(r => r.fromUserId === currentUser?.id);
  }, [db.teaTimeRequests, currentUser]);

  const locationGroup = useMemo(() => {
    if (!currentUser) return null;
    const location = currentUser.location || '미지정';
    const sameLocationUsers = currentUser.location 
      ? db.users.filter(u => u.id !== currentUser.id && u.location === currentUser.location && u.courseId === currentUser.courseId)
      : [];
    return {
      title: `근무지: ${location}`,
      users: sameLocationUsers,
      hasLocation: !!currentUser.location
    };
  }, [db.users, currentUser]);

  const selectedUserInterests = useMemo(() => {
    if (!selectedUser) return [];
    return db.interests.filter(i => i.userId === selectedUser.id);
  }, [db.interests, selectedUser]);

  const handleAccept = (reqId: string) => {
    updateTeaTimeRequest(reqId, 'accepted', replyMsg);
    setReplyingTo(null);
    setReplyMsg('');
  };

  const handleReject = (reqId: string) => {
    updateTeaTimeRequest(reqId, 'rejected', replyMsg);
    setReplyingTo(null);
    setReplyMsg('');
  };

  const handleSendRequest = (toUserId: string) => {
    const toUser = db.users.find(u => u.id === toUserId);
    const myHashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
    const defaultMsg = `${myHashtags}\n\n${toUser?.name}님에게 구체적인 일정과 장소를 기재하여 티타임을 제안해보세요.`;
    
    if (!teaTimeMsg.trim()) {
      alert('메시지를 입력해주세요.');
      return;
    }
    sendTeaTimeRequest({
      id: Date.now().toString(),
      fromUserId: currentUser!.id,
      toUserId,
      message: teaTimeMsg,
      status: 'pending'
    });
    setTeaTimeMsg('');
    setRequestingTo(null);
    alert('티타임 요청을 보냈습니다.');
  };

  const handleSendTeaTime = (toUserId: string, message?: string) => {
    const finalMsg = message || teaTimeMsg;
    if (!finalMsg.trim()) {
      alert('메시지를 입력해주세요.');
      return;
    }
    sendTeaTimeRequest({
      id: Date.now().toString(),
      fromUserId: currentUser!.id,
      toUserId,
      message: finalMsg,
      status: 'pending'
    });
    setTeaTimeMsg('');
    setSelectedUser(null);
    alert('티타임 요청을 보냈습니다.');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10" ref={contentRef} data-pdf-content>
      {/* Page Title */}
      <div className="pb-3 border-b-2 border-primary/30">
        <h1 className="font-headline text-2xl font-black uppercase tracking-widest text-primary">MY NETWORK</h1>
        <p className="text-xs text-on-surface-variant mt-0.5 font-medium">{currentUser?.name}님의 키워드 네트워크</p>
      </div>

      {/* Network Summary */}
      <section data-pdf-section className="bg-surface-container-low rounded-2xl border border-outline p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">
                네트워크 요약
              </h2>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1 font-medium">
              리더님들간의 의미있는 연결과 지속적인 교류를 응원합니다. : )
            </p>
          </div>
          {!hideActions && (
            <div className="flex items-center gap-2" data-html2canvas-ignore>
              <button 
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className={`w-10 h-10 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="PDF 다운로드"
              >
                <span className="material-symbols-outlined text-on-surface-variant">{isDownloading ? 'sync' : 'download'}</span>
              </button>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`w-10 h-10 rounded-full bg-white border border-outline flex items-center justify-center shadow-sm hover:bg-surface-container-low transition-all ${isRefreshing ? 'animate-spin' : ''}`}
                title="새로고침"
              >
                <span className="material-symbols-outlined text-on-surface-variant">refresh</span>
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface p-4 rounded-xl border border-outline/50">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">연결된 리더</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-primary">{summary.total}</span>
              <span className="text-xs text-on-surface-variant">명</span>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1">
              Giver <span className="text-primary font-bold">{summary.givers}</span>명, 
              Taker <span className="text-secondary font-bold">{summary.takers}</span>명
            </p>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-outline/50">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">요청된 티타임</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-tertiary">{summary.receivedCount}</span>
              <span className="text-xs text-on-surface-variant">회</span>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1">나에게 온 요청</p>
          </div>
          <div className="bg-surface p-4 rounded-xl border border-outline/50">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">내가 요청한 티타임</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-secondary">{summary.sentCount}</span>
              <span className="text-xs text-on-surface-variant">회</span>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1">내가 보낸 요청</p>
          </div>
        </div>
      </section>

      {/* Tea Time Requests */}
      <section className="space-y-6">
        <div data-pdf-section className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">coffee_maker</span>
          <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">티타임 요청 현황</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Received Requests */}
          <div className="space-y-4">
            <h3 data-pdf-section className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">call_received</span> 받은 요청
            </h3>
            <div className="space-y-3">
              {receivedRequests.length === 0 ? (
                <p data-pdf-section className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">받은 요청이 없습니다.</p>
              ) : (
                receivedRequests.map(req => {
                  const fromUser = db.users.find(u => u.id === req.fromUserId);
                  if (!fromUser) return null;
                  const isHandled = req.status !== 'pending';
                  
                  return (
                    <div key={req.id} data-pdf-section className={`p-4 rounded-2xl border border-outline shadow-sm space-y-3 transition-opacity ${isHandled ? 'bg-surface/50 opacity-80' : 'bg-surface'}`}>
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center shrink-0 border border-outline">
                          {fromUser.profilePic ? (
                            <img src={fromUser.profilePic} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-primary text-xs">{fromUser.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-on-surface text-xs truncate">{fromUser.name}</h3>
                            {isHandled && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${req.status === 'accepted' ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                                {req.status === 'accepted' ? '수락됨' : '거절됨'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-on-surface-variant truncate">{fromUser.title}</p>
                          <div className="mt-1 space-y-1">
                            {req.message.includes('\n\n') ? (
                              <>
                                <div className="flex flex-wrap gap-1">
                                  {req.message.split('\n\n')[0].split(' ').filter(tag => tag.startsWith('#')).map((tag, idx) => (
                                    <span key={idx} className="text-[9px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 uppercase tracking-widest italic">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message.split('\n\n')[1]}"</p>
                              </>
                            ) : (
                              <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message}"</p>
                            )}
                          </div>
                          {isHandled && req.responseMessage && (
                            <div className="mt-2 p-2 bg-surface-container-low rounded-lg border border-outline/30">
                              <p className="text-[9px] font-bold text-primary mb-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">reply</span> 나의 응답
                              </p>
                              <p className="text-[10px] text-on-surface italic">"{req.responseMessage}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {!isHandled && (
                        replyingTo === req.id ? (
                          <div className="space-y-2 pt-2 border-t border-outline">
                            <textarea 
                              value={replyMsg}
                              onChange={e => setReplyMsg(e.target.value)}
                              placeholder="응답 메시지를 작성하세요..."
                              className="w-full bg-surface-container-low border border-outline rounded-lg p-2 text-xs outline-none focus:border-primary"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setReplyingTo(null)} className="flex-1 py-1.5 text-[10px] font-bold border border-outline rounded-lg">취소</button>
                              <button onClick={() => handleAccept(req.id)} className="flex-1 py-1.5 text-[10px] font-bold bg-primary text-on-primary rounded-lg">수락</button>
                              <button onClick={() => handleReject(req.id)} className="flex-1 py-1.5 text-[10px] font-bold border border-outline text-on-surface rounded-lg">거절</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 pt-2">
                            <button onClick={() => setReplyingTo(req.id)} className="flex-1 py-1.5 text-[10px] font-bold bg-primary text-on-primary rounded-lg">응답하기</button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sent Requests */}
          <div className="space-y-4">
            <h3 data-pdf-section className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">call_made</span> 보낸 요청
            </h3>
            <div className="space-y-3">
              {sentRequests.length === 0 ? (
                <p data-pdf-section className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">보낸 요청이 없습니다.</p>
              ) : (
                sentRequests.map(req => {
                  const toUser = db.users.find(u => u.id === req.toUserId);
                  if (!toUser) return null;
                  
                  return (
                    <div key={req.id} data-pdf-section className="p-4 rounded-2xl border border-outline bg-surface shadow-sm space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-low overflow-hidden flex items-center justify-center shrink-0 border border-outline">
                          {toUser.profilePic ? (
                            <img src={toUser.profilePic} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-primary text-xs">{toUser.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h3 className="font-bold text-on-surface text-xs truncate">{toUser.name}</h3>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              req.status === 'accepted' ? 'bg-primary/10 text-primary' : 
                              req.status === 'rejected' ? 'bg-surface-variant text-on-surface-variant' : 
                              'bg-tertiary/10 text-tertiary'
                            }`}>
                              {req.status === 'accepted' ? '수락됨' : req.status === 'rejected' ? '거절됨' : '대기 중'}
                            </span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant truncate">{toUser.title}</p>
                          <div className="mt-1 space-y-1">
                            {req.message.includes('\n\n') ? (
                              <>
                                <div className="flex flex-wrap gap-1">
                                  {req.message.split('\n\n')[0].split(' ').filter(tag => tag.startsWith('#')).map((tag, idx) => (
                                    <span key={idx} className="text-[9px] font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10 uppercase tracking-widest italic">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message.split('\n\n')[1]}"</p>
                              </>
                            ) : (
                              <p className="text-[10px] text-on-surface-variant italic line-clamp-2">"{req.message}"</p>
                            )}
                          </div>
                          {req.status !== 'pending' && req.responseMessage && (
                            <div className="mt-2 p-2 bg-surface-container-low rounded-lg border border-outline/30">
                              <p className="text-[9px] font-bold text-secondary mb-0.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[10px]">chat_bubble</span> 상대방의 응답
                              </p>
                              <p className="text-[10px] text-on-surface italic">"{req.responseMessage}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Keyword Recommendations */}
      <section className="space-y-6">
        <div data-pdf-section className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">hub</span>
          <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">키워드 네트워크</h2>
        </div>

        {groupedNetwork.length === 0 ? (
          <p data-pdf-section className="text-xs text-on-surface-variant italic p-4 bg-surface-container rounded-xl border border-outline-variant/10">추천할 동료가 아직 없습니다. 관심사를 더 등록해보세요!</p>
        ) : (
          <div className="space-y-12">
            {groupedNetwork.map(group => {
              const relevantKeywords = keywordGroups[group.id] || [group.id];
              
              return (
                <div key={group.id} className="space-y-4">
                  <div data-pdf-section className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: getKeywordColor(group.title.replace('#', '')) }}></div>
                      <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-sm font-bold text-on-surface">{group.title}</h3>
                          <span className="text-[10px] text-on-surface-variant font-medium">
                            (총 {group.users.length}명 연결, Giver {group.giverCount}명, Taker {group.takerCount}명)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {relevantKeywords.map(kw => (
                            <span key={kw} className="text-[9px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline/30">#{kw}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
                      <p className="text-[10px] font-bold text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">tips_and_updates</span>
                        {group.recommendation}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {group.users.map(u => {
                      const uInterests = db.interests.filter((i: Interest) => i.userId === u.id && relevantKeywords.includes(i.keyword));
                      const isMe = u.id === currentUser?.id;
                      
                      return (
                        <div 
                          key={u.id} 
                          data-pdf-section
                          className={`${isMe ? 'bg-surface border-primary border-2 shadow-md' : 'bg-surface border-outline shadow-sm'} rounded-2xl border p-5 hover:shadow-md transition-all group relative z-10`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <button 
                              onClick={() => { setSelectedUser(u); setTeaTimeMsg(''); }}
                              className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                            >
                              <div className={`w-10 h-10 rounded-xl ${isMe ? 'bg-surface border-primary/30' : 'bg-surface-container-low border-outline'} overflow-hidden flex items-center justify-center border shrink-0`}>
                                {u.profilePic ? (
                                  <img src={u.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-sm font-bold text-primary">{u.name.charAt(0)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] text-on-surface-variant truncate uppercase font-medium">{u.company} • {u.department}</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-on-surface truncate">{u.name}</p>
                                  {isMe && <span className="text-[9px] font-black bg-primary text-on-primary px-1.5 py-0.5 rounded uppercase tracking-widest">나</span>}
                                </div>
                                <p className="text-[10px] text-on-surface-variant truncate">{u.title}</p>
                              </div>
                            </button>
                          </div>

                          <div className="space-y-3">
                            {uInterests.map((i: Interest) => (
                              <div key={i.id} className="bg-surface-container-low/50 rounded-xl p-3 border border-outline/30">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-xs font-bold ${i.type === 'giver' ? 'text-primary' : 'text-secondary'}`}>
                                    #{i.keyword}
                                  </span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${i.type === 'giver' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                                    {i.type === 'giver' ? 'Giver' : 'Taker'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                  {i.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Fixed Location Group */}
      <section className="space-y-6 pt-6 border-t border-outline">
        <div data-pdf-section className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">location_on</span>
            <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">
              {locationGroup?.title || '근무지 정보'}
            </h2>
          </div>
          <span className="text-[10px] bg-tertiary/10 text-tertiary px-3 py-1 rounded-full font-bold border border-tertiary/20">고정 메뉴</span>
        </div>
        
        {!locationGroup?.hasLocation ? (
          <p data-pdf-section className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">프로필에서 근무지를 설정하면 같은 근무지의 동료를 추천해드립니다.</p>
        ) : locationGroup.users.length === 0 ? (
          <p data-pdf-section className="text-xs text-on-surface-variant italic p-4 bg-surface rounded-xl border border-outline">같은 근무지의 동료가 아직 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {locationGroup.users.map(u => {
              const uInterests = db.interests.filter((i: Interest) => i.userId === u.id);
              
              return (
                <div 
                  key={u.id} 
                  data-pdf-section
                  className="bg-surface rounded-2xl border border-outline p-5 shadow-sm hover:shadow-md transition-all group"
                >
                        <div className="flex items-center justify-between mb-4">
                          <button 
                            onClick={() => { setSelectedUser(u); setTeaTimeMsg(''); }}
                            className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                          >
                            <div className="w-10 h-10 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline shrink-0">
                              {u.profilePic ? (
                                <img src={u.profilePic} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-sm font-bold text-primary">{u.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-on-surface-variant truncate uppercase font-medium">{u.company} • {u.department}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-on-surface truncate">{u.name}</p>
                              </div>
                              <p className="text-[10px] text-on-surface-variant truncate">{u.title}</p>
                            </div>
                          </button>
                        </div>

                  <div className="flex flex-wrap gap-2">
                    {uInterests.map((i: Interest) => (
                      <span 
                        key={i.id} 
                        className={`text-[10px] px-2.5 py-1 rounded-full font-bold border ${
                          i.type === 'giver' 
                            ? 'bg-primary/5 text-primary border-primary/20' 
                            : 'bg-secondary/5 text-secondary border-secondary/20'
                        }`}
                      >
                        #{i.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* User Detail Popup (Same as NetworkMap) */}
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-surface p-6 rounded-2xl border border-outline max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-container-low overflow-hidden flex items-center justify-center border border-outline">
                  {selectedUser.profilePic ? (
                    <img src={selectedUser.profilePic} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-5xl text-primary/40">face</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">{selectedUser.company} • {selectedUser.department}</p>
                  <h3 className="font-bold text-xl text-on-surface">{selectedUser.name}</h3>
                  <p className="text-sm text-primary font-medium">{selectedUser.title}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">volunteer_activism</span> be Giver
                </h4>
                <div className="grid gap-2">
                  {selectedUserInterests.filter(i => i.type === 'giver').map(i => (
                    <div key={i.id} className="bg-surface-container-low p-3 rounded-xl border border-outline">
                      <p className="text-sm font-bold text-primary mb-1">#{i.keyword}</p>
                      <p className="text-xs text-on-surface-variant">{i.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-secondary uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">pan_tool</span> be Taker
                </h4>
                <div className="grid gap-2">
                  {selectedUserInterests.filter(i => i.type === 'taker').map(i => (
                    <div key={i.id} className="bg-surface-container-low p-3 rounded-xl border border-outline">
                      <p className="text-sm font-bold text-secondary mb-1">#{i.keyword}</p>
                      <p className="text-xs text-on-surface-variant">{i.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedUser.id !== currentUser?.id && (
                <div className="space-y-3 pt-4 border-t border-outline">
                  <h4 className="text-xs font-bold text-on-surface uppercase tracking-widest">티타임 요청</h4>
                  <p className="text-[10px] text-on-surface-variant font-medium mb-2">
                    {selectedUser.name}님에게 구체적인 일정과 장소를 기재하여 티타임을 제안해보세요.
                  </p>
                  <textarea 
                    value={teaTimeMsg}
                    onChange={e => setTeaTimeMsg(e.target.value)}
                    placeholder={`${selectedUser.name}님에게 보낼 짧은 메시지를 작성하세요...`}
                    className="w-full bg-surface-container-low border border-outline rounded-xl p-4 text-sm resize-none outline-none focus:border-primary"
                    rows={4}
                  />
                  <div className="flex flex-wrap gap-2">
                    {myInterests.map(i => (
                      <span key={i.id} className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20">
                        #{i.keyword}
                      </span>
                    ))}
                  </div>
                  <button 
                    onClick={() => {
                      const myHashtags = myInterests.map(i => `#${i.keyword}`).join(' ');
                      const finalMsg = `${myHashtags}\n\n${teaTimeMsg}`;
                      handleSendTeaTime(selectedUser.id, finalMsg);
                    }}
                    className="w-full py-4 bg-primary text-on-primary font-bold rounded-xl shadow-lg active:scale-95 transition-all"
                  >
                    요청 보내기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* PDF Report Template (Hidden) */}
      <div className="fixed left-[-9999px] top-0 overflow-hidden bg-white" style={{ width: '210mm', color: 'black', backgroundColor: 'white' }}>
        <div ref={pdfReportRef}>
          {currentUser && (
            <UserReportPDF 
              user={currentUser}
              interests={db.interests}
              canonicalTerms={db.canonicalTerms || []}
              allUsers={db.users}
              teaTimeRequests={db.teaTimeRequests}
              groupedNetwork={groupedNetwork}
              summary={summary}
            />
          )}
        </div>
      </div>
    </div>
  );
}


