import type { User, Course, Session, Interest, TeaTimeRequest, UserInsight, CanonicalTerm, PresetInterest } from '../store';

export const generateDemoData = () => {
  const courses: Course[] = [
    { id: 'demo-c1', name: '[데모] 하이테크 리더십 과정' },
    { id: 'demo-c2', name: '[데모] 미래 모빌리티 전략 세미나' },
  ];

  const users: User[] = [
    // ── Course 1 (30명) ──────────────────────────────────────────────────────
    { id: 'demo-u1',  company: '현대자동차',     name: '김철수', department: '자율주행개발팀',    title: '팀장',     location: '남양연구소',  courseId: 'demo-c1' },
    { id: 'demo-u2',  company: '현대모비스',     name: '이영희', department: '전동화시스템설계',   title: '책임연구원', location: '의왕연구소',  courseId: 'demo-c1' },
    { id: 'demo-u3',  company: '현대제철',       name: '박지민', department: '스마트팩토리추진단', title: '매니저',    location: '당진제철소',  courseId: 'demo-c1' },
    { id: 'demo-u4',  company: '현대건설',       name: '최동욱', department: '글로벌전략기획',     title: '팀장',     location: '계동사옥',    courseId: 'demo-c1' },
    { id: 'demo-u5',  company: '현대글로비스',   name: '정수아', department: '스마트물류솔루션',   title: '책임매니저', location: '본사',       courseId: 'demo-c1' },
    { id: 'demo-u6',  company: '현대오토에버',   name: '강현우', department: '클라우드아키텍처',   title: '팀장',     location: '삼성동',      courseId: 'demo-c1' },
    { id: 'demo-u7',  company: '현대위아',       name: '윤서연', department: '로봇틱스연구소',     title: '선임연구원', location: '안산',       courseId: 'demo-c1' },
    { id: 'demo-u8',  company: '기아',           name: '한준호', department: '상품기획팀',         title: '책임',     location: '양재',        courseId: 'demo-c1' },
    { id: 'demo-u9',  company: '현대카드',       name: '송미경', department: '데이터분석팀',       title: '팀장',     location: '여의도',      courseId: 'demo-c1' },
    { id: 'demo-u10', company: '현대캐피탈',     name: '조민기', department: '디지털전략팀',       title: '책임',     location: '여의도',      courseId: 'demo-c1' },
    { id: 'demo-u11', company: '현대자동차',     name: '임수빈', department: 'HR전략팀',           title: '선임매니저', location: '양재본사',   courseId: 'demo-c1' },
    { id: 'demo-u12', company: '현대모비스',     name: '황정훈', department: 'AI솔루션개발',       title: '책임연구원', location: '마북연구소', courseId: 'demo-c1' },
    { id: 'demo-u13', company: '현대엔지니어링', name: '서은지', department: '탄소중립기획',       title: '팀장',     location: '판교',        courseId: 'demo-c1' },
    { id: 'demo-u14', company: '현대로템',       name: '노재원', department: '방산시스템연구',     title: '책임연구원', location: '의왕',       courseId: 'demo-c1' },
    { id: 'demo-u15', company: '현대트랜시스',   name: '문지혜', department: '파워트레인설계',     title: '선임연구원', location: '화성',       courseId: 'demo-c1' },
    { id: 'demo-u31', company: '기아',           name: '김민지', department: '브랜드전략팀',       title: '책임',     location: '양재',        courseId: 'demo-c1' },
    { id: 'demo-u32', company: '현대모비스',     name: '이성훈', department: '전장부품기획팀',     title: '팀장',     location: '용인',        courseId: 'demo-c1' },
    { id: 'demo-u33', company: '현대글로비스',   name: '박현아', department: 'SCM혁신팀',          title: '선임매니저', location: '본사',       courseId: 'demo-c1' },
    { id: 'demo-u34', company: '현대캐피탈',     name: '최준영', department: '리스크관리팀',       title: '책임',     location: '여의도',      courseId: 'demo-c1' },
    { id: 'demo-u35', company: '현대오토에버',   name: '신지원', department: '사이버보안팀',       title: '선임연구원', location: '삼성동',     courseId: 'demo-c1' },
    { id: 'demo-u36', company: '기아',           name: '황도윤', department: '디자인경영팀',       title: '팀장',     location: '양재',        courseId: 'demo-c1' },
    { id: 'demo-u37', company: '현대제철',       name: '김수현', department: '에너지전환추진단',   title: '책임',     location: '인천',        courseId: 'demo-c1' },
    { id: 'demo-u38', company: '현대건설',       name: '이지훈', department: '해외사업개발팀',     title: '선임매니저', location: '계동',       courseId: 'demo-c1' },
    { id: 'demo-u39', company: '현대로템',       name: '오민준', department: '미래사업기획팀',     title: '책임연구원', location: '의왕',       courseId: 'demo-c1' },
    { id: 'demo-u40', company: '현대카드',       name: '나은지', department: '상품기획팀',         title: '팀장',     location: '여의도',      courseId: 'demo-c1' },
    { id: 'demo-u41', company: '현대트랜시스',   name: '배성호', department: '전동화파워팀',       title: '선임연구원', location: '화성',       courseId: 'demo-c1' },
    { id: 'demo-u42', company: '현대엔지니어링', name: '정하윤', department: '디지털플랜트팀',     title: '책임',     location: '판교',        courseId: 'demo-c1' },
    { id: 'demo-u43', company: '현대위아',       name: '손민재', department: '방산소재연구팀',     title: '선임연구원', location: '창원',       courseId: 'demo-c1' },
    { id: 'demo-u44', company: '현대모비스',     name: '임채원', department: '제동시스템설계팀',   title: '팀장',     location: '마북연구소', courseId: 'demo-c1' },
    { id: 'demo-u45', company: '현대자동차',     name: '유나라', department: 'ESG경영팀',          title: '책임매니저', location: '양재본사',   courseId: 'demo-c1' },

    // ── Course 2 (30명) ──────────────────────────────────────────────────────
    { id: 'demo-u16', company: '현대자동차',     name: '오세훈', department: 'PBV사업기획',        title: '상무',     location: '양재본사',    courseId: 'demo-c2' },
    { id: 'demo-u17', company: '기아',           name: '권나영', department: 'EV플랫폼개발',       title: '팀장',     location: '화성연구소',  courseId: 'demo-c2' },
    { id: 'demo-u18', company: '현대모비스',     name: '류민준', department: '자율주행센서',       title: '수석연구원', location: '마북연구소', courseId: 'demo-c2' },
    { id: 'demo-u19', company: '현대오토에버',   name: '백지은', department: '커넥티드카플랫폼',   title: '팀장',     location: '삼성동',      courseId: 'demo-c2' },
    { id: 'demo-u20', company: '현대글로비스',   name: '신동현', department: '해운물류기획',       title: '책임매니저', location: '부산사무소', courseId: 'demo-c2' },
    { id: 'demo-u21', company: '현대제철',       name: '안수진', department: '그린스틸연구',       title: '선임연구원', location: '인천',       courseId: 'demo-c2' },
    { id: 'demo-u22', company: '현대건설',       name: '장태영', department: '스마트시티사업',     title: '팀장',     location: '계동',        courseId: 'demo-c2' },
    { id: 'demo-u23', company: '현대위아',       name: '전혜린', department: 'CNC가공기술',        title: '책임연구원', location: '창원',       courseId: 'demo-c2' },
    { id: 'demo-u24', company: '현대로템',       name: '차유진', department: '수소전기열차',       title: '팀장',     location: '의왕',        courseId: 'demo-c2' },
    { id: 'demo-u25', company: '현대카드',       name: '하승우', department: 'PLCC전략팀',         title: '팀장',     location: '여의도',      courseId: 'demo-c2' },
    { id: 'demo-u26', company: '현대트랜시스',   name: '곽민서', department: '전동화변속기',       title: '수석연구원', location: '동탄',       courseId: 'demo-c2' },
    { id: 'demo-u27', company: '현대엔지니어링', name: '배준혁', department: '수소플랜트',         title: '책임',     location: '판교',        courseId: 'demo-c2' },
    { id: 'demo-u28', company: '현대캐피탈',     name: '성은비', department: '모빌리티금융',       title: '선임매니저', location: '여의도',     courseId: 'demo-c2' },
    { id: 'demo-u29', company: '현대자동차',     name: '유재현', department: '제네시스개발',       title: '책임연구원', location: '남양',       courseId: 'demo-c2' },
    { id: 'demo-u30', company: '기아',           name: '이준서', department: '글로벌마케팅',       title: '팀장',     location: '양재',        courseId: 'demo-c2' },
    { id: 'demo-u46', company: '현대자동차',     name: '강태현', department: '미래기술전략실',     title: '상무',     location: '양재본사',    courseId: 'demo-c2' },
    { id: 'demo-u47', company: '기아',           name: '문소희', department: '인도권역사업팀',     title: '팀장',     location: '양재',        courseId: 'demo-c2' },
    { id: 'demo-u48', company: '현대모비스',     name: '백승민', department: 'ADAS개발팀',         title: '수석연구원', location: '마북연구소', courseId: 'demo-c2' },
    { id: 'demo-u49', company: '현대오토에버',   name: '서다은', department: '데이터플랫폼팀',     title: '팀장',     location: '삼성동',      courseId: 'demo-c2' },
    { id: 'demo-u50', company: '현대글로비스',   name: '양준호', department: '복합물류기획팀',     title: '책임매니저', location: '본사',       courseId: 'demo-c2' },
    { id: 'demo-u51', company: '현대제철',       name: '조아름', department: '제품개발연구소',     title: '선임연구원', location: '당진',       courseId: 'demo-c2' },
    { id: 'demo-u52', company: '현대건설',       name: '한재원', department: '모듈러건축사업팀',   title: '팀장',     location: '계동',        courseId: 'demo-c2' },
    { id: 'demo-u53', company: '현대위아',       name: '도유진', department: '정밀가공연구팀',     title: '책임연구원', location: '안산',       courseId: 'demo-c2' },
    { id: 'demo-u54', company: '현대로템',       name: '이원준', department: '철도시스템개발팀',   title: '팀장',     location: '의왕',        courseId: 'demo-c2' },
    { id: 'demo-u55', company: '현대카드',       name: '김아린', department: 'DIGITAL팀',          title: '팀장',     location: '여의도',      courseId: 'demo-c2' },
    { id: 'demo-u56', company: '현대트랜시스',   name: '최민영', department: '시트시스템개발팀',   title: '수석연구원', location: '동탄',       courseId: 'demo-c2' },
    { id: 'demo-u57', company: '현대엔지니어링', name: '엄태준', department: '신재생에너지팀',     title: '책임',     location: '판교',        courseId: 'demo-c2' },
    { id: 'demo-u58', company: '현대캐피탈',     name: '박지훈', department: '글로벌금융팀',       title: '선임매니저', location: '여의도',     courseId: 'demo-c2' },
    { id: 'demo-u59', company: '현대자동차',     name: '류세연', department: '커넥티드서비스팀',   title: '책임연구원', location: '양재본사',   courseId: 'demo-c2' },
    { id: 'demo-u60', company: '기아',           name: '송재민', department: '자동화기술팀',       title: '팀장',     location: '화성연구소',  courseId: 'demo-c2' },
  ];

  const sessions: Session[] = [
    // Course 1
    { id: 'demo-s1', courseId: 'demo-c1', name: 'AI 시대의 리더십 패러다임', time: '09:00-10:30', module: 'Module 1', day: 'Day 1', isActive: true,  instructor: '홍길동 교수' },
    { id: 'demo-s2', courseId: 'demo-c1', name: '조직문화 혁신 워크숍',       time: '10:40-12:00', module: 'Module 1', day: 'Day 1', isActive: true,  instructor: '이순신 소장' },
    { id: 'demo-s3', courseId: 'demo-c1', name: '데이터 기반 의사결정',        time: '13:00-15:00', module: 'Module 2', day: 'Day 1', isActive: false, instructor: '장영실 박사' },
    { id: 'demo-s4', courseId: 'demo-c1', name: '세대 간 소통과 팀 빌딩',      time: '15:30-17:00', module: 'Module 2', day: 'Day 1', isActive: false, instructor: '신사임당 박사' },
    // Course 2
    { id: 'demo-s5', courseId: 'demo-c2', name: '미래 모빌리티 메가트렌드',   time: '09:00-10:30', module: 'Module A', day: 'Day 1', isActive: true,  instructor: '정몽규 박사' },
    { id: 'demo-s6', courseId: 'demo-c2', name: '전동화 전환 전략',            time: '11:00-12:30', module: 'Module A', day: 'Day 1', isActive: true,  instructor: '강감찬 교수' },
    { id: 'demo-s7', courseId: 'demo-c2', name: '소프트웨어 중심 차량(SDV)',   time: '14:00-15:30', module: 'Module B', day: 'Day 1', isActive: false, instructor: '유관순 연구원' },
  ];

  const interests: Interest[] = [
    // u1 김철수
    { id: 'di-1',  userId: 'demo-u1',  type: 'giver',  keyword: '리더십',                        description: '팀 성과를 이끌어온 리더십 경험과 노하우를 나누고 싶습니다.' },
    { id: 'di-2',  userId: 'demo-u1',  type: 'taker',  keyword: '독서',                           description: '경영·자기계발 분야 독서 모임에 관심이 많습니다.' },
    // u2 이영희
    { id: 'di-3',  userId: 'demo-u2',  type: 'giver',  keyword: '성과관리',                       description: 'OKR 기반 팀 성과 관리 체계 구축 경험을 공유합니다.' },
    { id: 'di-4',  userId: 'demo-u2',  type: 'taker',  keyword: '요가/필라테스',                  description: '집중력과 균형감을 높이는 요가 루틴이 궁금합니다.' },
    // u3 박지민
    { id: 'di-5',  userId: 'demo-u3',  type: 'giver',  keyword: '조직문화',                       description: '현장 중심의 수평적 조직문화 만들기 경험을 나눌 수 있습니다.' },
    { id: 'di-6',  userId: 'demo-u3',  type: 'taker',  keyword: '등산/트래킹',                    description: '국내 명산 트래킹 코스 추천을 받고 싶습니다.' },
    // u4 최동욱
    { id: 'di-7',  userId: 'demo-u4',  type: 'giver',  keyword: '전략',                           description: '글로벌 시장 진입 전략 수립과 실행 경험이 있습니다.' },
    { id: 'di-8',  userId: 'demo-u4',  type: 'taker',  keyword: '와인',                           description: '와인 페어링과 원산지별 특징을 배우고 싶습니다.' },
    // u5 정수아
    { id: 'di-9',  userId: 'demo-u5',  type: 'giver',  keyword: '구성원 육성',                    description: '구성원의 강점을 발견하고 성장시키는 코칭 경험이 있습니다.' },
    { id: 'di-10', userId: 'demo-u5',  type: 'taker',  keyword: '미식(맛집/카페)',                description: '서울·경기 지역 숨은 맛집과 카페 정보를 나누고 싶습니다.' },
    // u6 강현우
    { id: 'di-11', userId: 'demo-u6',  type: 'giver',  keyword: 'AI/AX',                          description: '업무 프로세스에 AI를 도입한 전환 경험을 공유합니다.' },
    { id: 'di-12', userId: 'demo-u6',  type: 'taker',  keyword: '골프',                           description: '필드 매너와 스코어 관리 팁이 궁금합니다.' },
    // u7 윤서연
    { id: 'di-13', userId: 'demo-u7',  type: 'giver',  keyword: '일하는방식',                     description: '비동기 협업과 딥워크 루틴 설계 경험을 나눌 수 있습니다.' },
    { id: 'di-14', userId: 'demo-u7',  type: 'taker',  keyword: '마음챙김',                       description: '명상과 마음챙김 습관 형성 방법을 배우고 싶습니다.' },
    // u8 한준호
    { id: 'di-15', userId: 'demo-u8',  type: 'giver',  keyword: '마케팅',                         description: '브랜드 캠페인 기획과 타겟 고객 설정 경험을 공유합니다.' },
    { id: 'di-16', userId: 'demo-u8',  type: 'taker',  keyword: '테니스',                         description: '테니스 입문자에게 맞는 레슨 방법이 궁금합니다.' },
    // u9 송미경
    { id: 'di-17', userId: 'demo-u9',  type: 'giver',  keyword: '데이터기반 의사결정',            description: '데이터로 의사결정을 뒷받침한 실제 사례를 나눌 수 있습니다.' },
    { id: 'di-18', userId: 'demo-u9',  type: 'taker',  keyword: '재테크',                         description: '직장인 투자 포트폴리오 구성 전략이 궁금합니다.' },
    // u10 조민기
    { id: 'di-19', userId: 'demo-u10', type: 'giver',  keyword: '재무',                           description: '사업부 재무 분석과 원가 구조 개선 경험이 있습니다.' },
    { id: 'di-20', userId: 'demo-u10', type: 'taker',  keyword: '인문학',                         description: '철학·역사 기반 인문학적 통찰을 넓히고 싶습니다.' },
    // u11 임수빈
    { id: 'di-21', userId: 'demo-u11', type: 'giver',  keyword: '구성원 육성',                    description: 'HR 관점에서 신입부터 팀장까지 성장 경로를 설계한 경험이 있습니다.' },
    { id: 'di-22', userId: 'demo-u11', type: 'taker',  keyword: '사회공헌/멘토링',                description: '청소년 대상 커리어 멘토링 활동을 시작하고 싶습니다.' },
    // u12 황정훈
    { id: 'di-23', userId: 'demo-u12', type: 'giver',  keyword: 'AI/AX',                          description: 'LLM 기반 업무 자동화 및 AX 전환 프로젝트 경험을 공유합니다.' },
    { id: 'di-24', userId: 'demo-u12', type: 'taker',  keyword: '독서',                           description: 'AI·기술 철학 관련 도서 추천과 독서 토론에 관심이 있습니다.' },
    // u13 서은지
    { id: 'di-25', userId: 'demo-u13', type: 'giver',  keyword: '정책',                           description: '국내외 ESG·탄소중립 정책 동향 분석 경험을 나눌 수 있습니다.' },
    { id: 'di-26', userId: 'demo-u13', type: 'taker',  keyword: '심리학',                         description: '행동경제학과 조직심리학 기초를 배우고 싶습니다.' },
    // u14 노재원
    { id: 'di-27', userId: 'demo-u14', type: 'giver',  keyword: '협상',                           description: '대규모 계약 협상 전략과 실전 경험을 공유합니다.' },
    { id: 'di-28', userId: 'demo-u14', type: 'taker',  keyword: '지정학',                         description: '글로벌 지정학 리스크가 사업에 미치는 영향을 이해하고 싶습니다.' },
    // u15 문지혜
    { id: 'di-29', userId: 'demo-u15', type: 'giver',  keyword: '혁신',                           description: '기존 프로세스를 뒤집은 혁신 실험 경험을 나눌 수 있습니다.' },
    { id: 'di-30', userId: 'demo-u15', type: 'taker',  keyword: '악기연주',                       description: '피아노 재입문을 위한 효율적인 연습법이 궁금합니다.' },
    // u31 김민지
    { id: 'di-61', userId: 'demo-u31', type: 'giver',  keyword: '마케팅',                         description: '글로벌 브랜드 포지셔닝과 캠페인 기획 경험을 나눌 수 있습니다.' },
    { id: 'di-62', userId: 'demo-u31', type: 'taker',  keyword: '자기다움',                       description: '직장인으로서 자신만의 강점을 재발견하는 방법이 궁금합니다.' },
    // u32 이성훈
    { id: 'di-63', userId: 'demo-u32', type: 'giver',  keyword: '전략',                           description: '부품 공급망 전략 수립과 원가절감 프로젝트 경험이 있습니다.' },
    { id: 'di-64', userId: 'demo-u32', type: 'taker',  keyword: 'AI/AX',                          description: '제조 현장에 AI를 어떻게 도입할지 방향을 잡고 싶습니다.' },
    // u33 박현아
    { id: 'di-65', userId: 'demo-u33', type: 'giver',  keyword: '협업',                           description: '사내 다부서 협업 체계 구축과 갈등 해소 경험을 공유합니다.' },
    { id: 'di-66', userId: 'demo-u33', type: 'taker',  keyword: '변화관리',                       description: '조직 변화에 구성원이 자발적으로 참여하게 만드는 방법이 궁금합니다.' },
    // u34 최준영
    { id: 'di-67', userId: 'demo-u34', type: 'giver',  keyword: '재무',                           description: '금융 리스크 평가와 포트폴리오 관리 경험을 나눌 수 있습니다.' },
    { id: 'di-68', userId: 'demo-u34', type: 'taker',  keyword: '지정학',                         description: '글로벌 금융 환경에 영향을 미치는 지정학적 요소를 이해하고 싶습니다.' },
    // u35 신지원
    { id: 'di-69', userId: 'demo-u35', type: 'giver',  keyword: 'AI/AX',                          description: 'AI 보안 위협 분석과 대응 체계 구축 경험을 공유합니다.' },
    { id: 'di-70', userId: 'demo-u35', type: 'taker',  keyword: '협업',                           description: '보안팀과 현업 간의 원활한 협업 방식에 대해 배우고 싶습니다.' },
    // u36 황도윤
    { id: 'di-71', userId: 'demo-u36', type: 'giver',  keyword: '혁신',                           description: '디자인 사고를 활용한 제품·서비스 혁신 사례를 나눌 수 있습니다.' },
    { id: 'di-72', userId: 'demo-u36', type: 'taker',  keyword: '인문학',                         description: '디자인과 인문학을 연결하는 사유의 방식을 배우고 싶습니다.' },
    // u37 김수현
    { id: 'di-73', userId: 'demo-u37', type: 'giver',  keyword: '정책',                           description: '에너지 전환 관련 국내외 정책 동향과 대응 전략 경험이 있습니다.' },
    { id: 'di-74', userId: 'demo-u37', type: 'taker',  keyword: 'Open Innovation',                description: '외부 파트너와 공동으로 에너지 신기술을 개발하는 방법이 궁금합니다.' },
    // u38 이지훈
    { id: 'di-75', userId: 'demo-u38', type: 'giver',  keyword: '협상',                           description: '해외 발주처·파트너와의 계약 협상 실전 경험을 공유합니다.' },
    { id: 'di-76', userId: 'demo-u38', type: 'taker',  keyword: '마케팅',                         description: '해외 시장에서의 B2G 마케팅 전략을 배우고 싶습니다.' },
    // u39 오민준
    { id: 'di-77', userId: 'demo-u39', type: 'giver',  keyword: '신사업',                         description: '신사업 타당성 분석과 사업모델 설계 경험을 나눌 수 있습니다.' },
    { id: 'di-78', userId: 'demo-u39', type: 'taker',  keyword: '전략',                           description: '불확실한 환경에서 신사업 방향을 설정하는 전략 프레임이 궁금합니다.' },
    // u40 나은지
    { id: 'di-79', userId: 'demo-u40', type: 'giver',  keyword: '데이터기반 의사결정',            description: '고객 데이터 분석으로 상품 기획을 고도화한 경험을 공유합니다.' },
    { id: 'di-80', userId: 'demo-u40', type: 'taker',  keyword: '잡크래프팅',                     description: '현재 업무에서 새로운 의미와 보람을 찾는 방법이 궁금합니다.' },
    // u41 배성호
    { id: 'di-81', userId: 'demo-u41', type: 'giver',  keyword: '일하는방식',                     description: '제조 엔지니어링 팀의 애자일 전환 경험을 나눌 수 있습니다.' },
    { id: 'di-82', userId: 'demo-u41', type: 'taker',  keyword: '등산/트래킹',                    description: '주말 산행 코스와 준비물에 대해 조언을 듣고 싶습니다.' },
    // u42 정하윤
    { id: 'di-83', userId: 'demo-u42', type: 'giver',  keyword: '변화관리',                       description: '플랜트 디지털화 추진 과정에서의 변화관리 경험을 공유합니다.' },
    { id: 'di-84', userId: 'demo-u42', type: 'taker',  keyword: '마음챙김',                       description: '고강도 프로젝트 중 심리적 안정을 유지하는 방법이 궁금합니다.' },
    // u43 손민재
    { id: 'di-85', userId: 'demo-u43', type: 'giver',  keyword: '조직문화',                       description: '연구개발 조직에서 심리적 안전감을 높인 문화 개선 경험이 있습니다.' },
    { id: 'di-86', userId: 'demo-u43', type: 'taker',  keyword: '골프',                           description: '업무 네트워킹에 도움이 되는 골프 입문 방법이 궁금합니다.' },
    // u44 임채원
    { id: 'di-87', userId: 'demo-u44', type: 'giver',  keyword: '성과관리',                       description: '개발 조직의 KPI 설계와 공정한 평가 체계 구축 경험을 나눕니다.' },
    { id: 'di-88', userId: 'demo-u44', type: 'taker',  keyword: '독서',                           description: '리더십과 조직 관련 추천 도서 목록과 독서법이 궁금합니다.' },
    // u45 유나라
    { id: 'di-89', userId: 'demo-u45', type: 'giver',  keyword: '구성원 육성',                    description: 'ESG 관점에서 구성원의 지속가능한 성장을 지원한 경험이 있습니다.' },
    { id: 'di-90', userId: 'demo-u45', type: 'taker',  keyword: '와인',                           description: '와인 입문자를 위한 기초 지식과 추천 와인리스트가 궁금합니다.' },

    // u16 오세훈
    { id: 'di-31', userId: 'demo-u16', type: 'giver',  keyword: '신사업',                         description: '신사업 기회 발굴부터 사업화까지의 전 과정 경험이 있습니다.' },
    { id: 'di-32', userId: 'demo-u16', type: 'taker',  keyword: '리더십',                         description: '조직 규모가 커질수록 달라지는 리더십 스타일에 대해 배우고 싶습니다.' },
    // u17 권나영
    { id: 'di-33', userId: 'demo-u17', type: 'giver',  keyword: '변화관리',                       description: '대규모 조직 변화 시 구성원 저항을 극복한 경험을 공유합니다.' },
    { id: 'di-34', userId: 'demo-u17', type: 'taker',  keyword: '요리',                           description: '건강하고 빠르게 만들 수 있는 요리 레시피에 관심이 있습니다.' },
    // u18 류민준
    { id: 'di-35', userId: 'demo-u18', type: 'giver',  keyword: '데이터기반 의사결정',            description: '센서 데이터 분석으로 의사결정을 가속화한 사례를 나눕니다.' },
    { id: 'di-36', userId: 'demo-u18', type: 'taker',  keyword: 'Open Innovation',                description: '외부 스타트업·연구소와의 협력 모델 구축 방법이 궁금합니다.' },
    // u19 백지은
    { id: 'di-37', userId: 'demo-u19', type: 'giver',  keyword: '협업',                           description: '원격·하이브리드 환경에서 팀 협업 효율을 높인 경험이 있습니다.' },
    { id: 'di-38', userId: 'demo-u19', type: 'taker',  keyword: '조직관리',                       description: '성과와 관계를 동시에 잡는 조직 관리 방법이 궁금합니다.' },
    // u20 신동현
    { id: 'di-39', userId: 'demo-u20', type: 'giver',  keyword: '전략',                           description: '글로벌 물류 네트워크 재편 전략 수립 경험을 나눌 수 있습니다.' },
    { id: 'di-40', userId: 'demo-u20', type: 'taker',  keyword: '골프',                           description: '라운딩을 처음 시작할 때 알아야 할 기본 매너와 규칙이 궁금합니다.' },
    // u21 안수진
    { id: 'di-41', userId: 'demo-u21', type: 'giver',  keyword: '자기다움',                       description: '자신만의 일하는 방식과 강점을 발견하도록 도운 경험이 있습니다.' },
    { id: 'di-42', userId: 'demo-u21', type: 'taker',  keyword: '가드닝',                         description: '실내 공기정화 식물 관리법과 가드닝 입문 방법이 궁금합니다.' },
    // u22 장태영
    { id: 'di-43', userId: 'demo-u22', type: 'giver',  keyword: '조직관리',                       description: '다양한 전문가로 구성된 프로젝트 팀 관리 경험을 공유합니다.' },
    { id: 'di-44', userId: 'demo-u22', type: 'taker',  keyword: '구성원 육성',                    description: '팀원의 잠재력을 이끌어내는 코칭 대화법이 궁금합니다.' },
    // u23 전혜린
    { id: 'di-45', userId: 'demo-u23', type: 'giver',  keyword: '일하는방식',                     description: '제조 현장의 표준화와 효율 개선 경험을 나눌 수 있습니다.' },
    { id: 'di-46', userId: 'demo-u23', type: 'taker',  keyword: '잡크래프팅',                     description: '현재 직무에서 의미와 강점을 재발견하는 방법이 궁금합니다.' },
    // u24 차유진
    { id: 'di-47', userId: 'demo-u24', type: 'giver',  keyword: '혁신',                           description: '기존 관행을 깨고 새로운 공정을 도입한 혁신 사례를 공유합니다.' },
    { id: 'di-48', userId: 'demo-u24', type: 'taker',  keyword: '낚시',                           description: '민물 낚시 입문을 위한 장비 선택과 포인트 정보가 궁금합니다.' },
    // u25 하승우
    { id: 'di-49', userId: 'demo-u25', type: 'giver',  keyword: '마케팅',                         description: '타겟 고객 세분화와 디지털 채널 마케팅 경험을 공유합니다.' },
    { id: 'di-50', userId: 'demo-u25', type: 'taker',  keyword: '재무',                           description: '사업 성과를 재무 언어로 설명하는 방법을 배우고 싶습니다.' },
    // u26 곽민서
    { id: 'di-51', userId: 'demo-u26', type: 'giver',  keyword: '동기부여',                       description: '팀의 내재적 동기를 이끌어낸 다양한 시도와 사례를 나눕니다.' },
    { id: 'di-52', userId: 'demo-u26', type: 'taker',  keyword: '성과관리',                       description: '정성적 성과를 정량적으로 평가하는 방법이 궁금합니다.' },
    // u27 배준혁
    { id: 'di-53', userId: 'demo-u27', type: 'giver',  keyword: '지정학',                         description: '글로벌 프로젝트 수행 중 겪은 지정학 리스크 대응 경험이 있습니다.' },
    { id: 'di-54', userId: 'demo-u27', type: 'taker',  keyword: '전략',                           description: '불확실한 환경에서의 시나리오 전략 수립 방법을 배우고 싶습니다.' },
    // u28 성은비
    { id: 'di-55', userId: 'demo-u28', type: 'giver',  keyword: '재무',                           description: '금융 상품 수익성 분석과 리스크 평가 경험을 나눌 수 있습니다.' },
    { id: 'di-56', userId: 'demo-u28', type: 'taker',  keyword: '컬렉팅(미술품 등)',              description: '미술품 투자와 아트페어 방문 방법이 궁금합니다.' },
    // u29 유재현
    { id: 'di-57', userId: 'demo-u29', type: 'giver',  keyword: '자기다움',                       description: '자신의 브랜드 정체성을 발견하고 표현하는 과정을 공유합니다.' },
    { id: 'di-58', userId: 'demo-u29', type: 'taker',  keyword: '마케팅',                         description: '럭셔리 브랜드의 고객 경험 마케팅 전략을 배우고 싶습니다.' },
    // u30 이준서
    { id: 'di-59', userId: 'demo-u30', type: 'giver',  keyword: '커뮤니케이션스킬(코칭,피드백)', description: '다문화 팀과 고객을 상대한 코칭·피드백 경험을 나눕니다.' },
    { id: 'di-60', userId: 'demo-u30', type: 'taker',  keyword: '협업',                           description: '부서 간 사일로를 해소하는 협업 문화 만들기가 궁금합니다.' },
    // u46 강태현
    { id: 'di-91',  userId: 'demo-u46', type: 'giver',  keyword: '리더십',                        description: '조직 전략 방향을 설정하고 실행력을 높인 임원급 리더십 경험을 나눕니다.' },
    { id: 'di-92',  userId: 'demo-u46', type: 'taker',  keyword: '자기다움',                      description: '기술 리더로서 자신만의 경영 철학을 정립하는 방법이 궁금합니다.' },
    // u47 문소희
    { id: 'di-93',  userId: 'demo-u47', type: 'giver',  keyword: '전략',                          description: '인도·동남아 신흥 시장 진입 전략과 현지화 경험을 공유합니다.' },
    { id: 'di-94',  userId: 'demo-u47', type: 'taker',  keyword: '요가/필라테스',                 description: '출장이 잦은 직장인에게 맞는 스트레칭·필라테스 루틴이 궁금합니다.' },
    // u48 백승민
    { id: 'di-95',  userId: 'demo-u48', type: 'giver',  keyword: 'AI/AX',                         description: '자율주행 인지 알고리즘에 AI를 적용한 실전 경험을 나눌 수 있습니다.' },
    { id: 'di-96',  userId: 'demo-u48', type: 'taker',  keyword: '독서',                          description: '과학·공학 철학 분야의 좋은 책 추천을 받고 싶습니다.' },
    // u49 서다은
    { id: 'di-97',  userId: 'demo-u49', type: 'giver',  keyword: '데이터기반 의사결정',           description: '실시간 데이터 파이프라인으로 경영 의사결정을 지원한 경험이 있습니다.' },
    { id: 'di-98',  userId: 'demo-u49', type: 'taker',  keyword: '재테크',                        description: '데이터 분석가 출신 직장인에게 맞는 투자 전략이 궁금합니다.' },
    // u50 양준호
    { id: 'di-99',  userId: 'demo-u50', type: 'giver',  keyword: '협상',                          description: '해운·항만 운임 협상과 장기 계약 전략 경험을 공유합니다.' },
    { id: 'di-100', userId: 'demo-u50', type: 'taker',  keyword: '골프',                          description: '비즈니스 골프 에티켓과 입문 레슨 방법이 궁금합니다.' },
    // u51 조아름
    { id: 'di-101', userId: 'demo-u51', type: 'giver',  keyword: '혁신',                          description: '철강 제품 개발에서 혁신 소재를 상용화한 사례를 나눌 수 있습니다.' },
    { id: 'di-102', userId: 'demo-u51', type: 'taker',  keyword: '요리',                          description: '혼자 요리하기 좋은 건강 레시피와 밀프렙 방법이 궁금합니다.' },
    // u52 한재원
    { id: 'di-103', userId: 'demo-u52', type: 'giver',  keyword: '신사업',                        description: '모듈러 건축 신시장 개척과 고객 발굴 경험을 공유합니다.' },
    { id: 'di-104', userId: 'demo-u52', type: 'taker',  keyword: '테니스',                        description: '주말 테니스 동호회를 시작하는 방법이 궁금합니다.' },
    // u53 도유진
    { id: 'di-105', userId: 'demo-u53', type: 'giver',  keyword: '조직관리',                      description: '기술 전문가 조직의 동기부여와 성과 관리 경험을 나눌 수 있습니다.' },
    { id: 'di-106', userId: 'demo-u53', type: 'taker',  keyword: '가드닝',                        description: '사무실에서도 키울 수 있는 식물 관리법이 궁금합니다.' },
    // u54 이원준
    { id: 'di-107', userId: 'demo-u54', type: 'giver',  keyword: '성과관리',                      description: '대형 시스템 개발 프로젝트의 마일스톤 기반 성과 관리 경험이 있습니다.' },
    { id: 'di-108', userId: 'demo-u54', type: 'taker',  keyword: '지정학',                        description: '방산·인프라 수출에 영향을 미치는 지정학 동향을 이해하고 싶습니다.' },
    // u55 김아린
    { id: 'di-109', userId: 'demo-u55', type: 'giver',  keyword: '마케팅',                        description: '디지털 퍼스트 마케팅 전략과 콘텐츠 운영 경험을 공유합니다.' },
    { id: 'di-110', userId: 'demo-u55', type: 'taker',  keyword: '심리학',                        description: '소비자 심리를 마케팅에 활용하는 원칙을 배우고 싶습니다.' },
    // u56 최민영
    { id: 'di-111', userId: 'demo-u56', type: 'giver',  keyword: '일하는방식',                    description: '글로벌 협력사와의 비동기 협업 루틴 설계 경험을 나눌 수 있습니다.' },
    { id: 'di-112', userId: 'demo-u56', type: 'taker',  keyword: '잡크래프팅',                    description: '전문 연구직에서 새로운 의미를 찾는 방법이 궁금합니다.' },
    // u57 엄태준
    { id: 'di-113', userId: 'demo-u57', type: 'giver',  keyword: '정책',                          description: '재생에너지 관련 국내외 인허가·보조금 정책 경험을 공유합니다.' },
    { id: 'di-114', userId: 'demo-u57', type: 'taker',  keyword: '낚시',                          description: '바다 낚시 입문을 위한 포인트와 장비 선택 방법이 궁금합니다.' },
    // u58 박지훈
    { id: 'di-115', userId: 'demo-u58', type: 'giver',  keyword: '재무',                          description: '해외 법인 재무 관리와 외환 리스크 헤지 경험을 나눌 수 있습니다.' },
    { id: 'di-116', userId: 'demo-u58', type: 'taker',  keyword: '와인',                          description: '비즈니스 자리에서 와인을 고르는 기초 지식이 궁금합니다.' },
    // u59 류세연
    { id: 'di-117', userId: 'demo-u59', type: 'giver',  keyword: '협업',                          description: '소프트웨어·하드웨어 팀 간 크로스펑셔널 협업 경험을 공유합니다.' },
    { id: 'di-118', userId: 'demo-u59', type: 'taker',  keyword: '사회공헌/멘토링',               description: '이공계 여성 후배들을 위한 멘토링 프로그램 참여 방법이 궁금합니다.' },
    // u60 송재민
    { id: 'di-119', userId: 'demo-u60', type: 'giver',  keyword: '동기부여',                      description: '자동화 전환기 현장 구성원의 사기를 유지한 동기부여 사례를 나눕니다.' },
    { id: 'di-120', userId: 'demo-u60', type: 'taker',  keyword: '미식(맛집/카페)',               description: '전국 출장 중 발견한 현지 맛집 정보를 나누고 싶습니다.' },

    // ── 추가 관심사 (1인당 총 5개) ─────────────────────────────────────────────
    // u1 김철수 추가
    { id: 'di-121', userId: 'demo-u1',  type: 'giver',  keyword: '구성원 육성',                    description: '팀장으로서 구성원의 성장을 이끈 육성 경험을 나눌 수 있습니다.' },
    { id: 'di-122', userId: 'demo-u1',  type: 'taker',  keyword: '조직문화',                       description: '심리적으로 안전한 조직문화를 어떻게 만드는지 배우고 싶습니다.' },
    { id: 'di-123', userId: 'demo-u1',  type: 'taker',  keyword: '인문학',                         description: '역사와 철학을 통해 리더십을 깊게 이해하고 싶습니다.' },
    // u2 이영희 추가
    { id: 'di-124', userId: 'demo-u2',  type: 'giver',  keyword: '데이터기반 의사결정',            description: '엔지니어링 지표로 개발 방향을 결정한 경험을 공유합니다.' },
    { id: 'di-125', userId: 'demo-u2',  type: 'taker',  keyword: '독서',                           description: '공학 외 분야 독서로 시야를 넓히고 싶습니다.' },
    { id: 'di-126', userId: 'demo-u2',  type: 'giver',  keyword: '협업',                           description: '타 부서와의 기술 협업 체계를 구축한 경험이 있습니다.' },
    // u3 박지민 추가
    { id: 'di-127', userId: 'demo-u3',  type: 'giver',  keyword: '일하는방식',                     description: '현장 중심 스마트 업무 프로세스 개선 경험을 나눌 수 있습니다.' },
    { id: 'di-128', userId: 'demo-u3',  type: 'taker',  keyword: '마음챙김',                       description: '제조 현장 스트레스를 관리하는 마음챙김 방법이 궁금합니다.' },
    { id: 'di-129', userId: 'demo-u3',  type: 'giver',  keyword: '변화관리',                       description: '디지털 전환 과정의 현장 저항을 극복한 경험을 공유합니다.' },
    // u4 최동욱 추가
    { id: 'di-130', userId: 'demo-u4',  type: 'giver',  keyword: '협상',                           description: '해외 파트너십 계약 협상 전략과 전술을 나눌 수 있습니다.' },
    { id: 'di-131', userId: 'demo-u4',  type: 'taker',  keyword: '지정학',                         description: '글로벌 사업에서 지정학 리스크를 어떻게 판단할지 배우고 싶습니다.' },
    { id: 'di-132', userId: 'demo-u4',  type: 'taker',  keyword: '골프',                           description: '해외 비즈니스 파트너와의 골프 라운딩 준비 방법이 궁금합니다.' },
    // u5 정수아 추가
    { id: 'di-133', userId: 'demo-u5',  type: 'giver',  keyword: '협업',                           description: '물류 특성상 타 부문과의 긴밀한 협업 체계 구축 경험이 있습니다.' },
    { id: 'di-134', userId: 'demo-u5',  type: 'taker',  keyword: '잡크래프팅',                     description: '물류 업무에서 더 큰 보람을 찾는 방법이 궁금합니다.' },
    { id: 'di-135', userId: 'demo-u5',  type: 'giver',  keyword: '조직관리',                       description: '다양한 직급·직종이 혼합된 팀 관리 경험을 나눌 수 있습니다.' },
    // u6 강현우 추가
    { id: 'di-136', userId: 'demo-u6',  type: 'giver',  keyword: '혁신',                           description: '클라우드 전환을 넘어 기술 혁신 문화를 조직에 정착시킨 경험이 있습니다.' },
    { id: 'di-137', userId: 'demo-u6',  type: 'taker',  keyword: '재테크',                         description: 'IT 전문직 직장인에게 맞는 자산 관리 방법이 궁금합니다.' },
    { id: 'di-138', userId: 'demo-u6',  type: 'giver',  keyword: '데이터기반 의사결정',            description: '클라우드 비용 최적화를 데이터로 의사결정한 경험을 공유합니다.' },
    // u7 윤서연 추가
    { id: 'di-139', userId: 'demo-u7',  type: 'giver',  keyword: '혁신',                           description: '로봇 협업 환경에서 기존 공정을 혁신한 사례를 나눌 수 있습니다.' },
    { id: 'di-140', userId: 'demo-u7',  type: 'taker',  keyword: '독서',                           description: '로봇공학 최신 트렌드를 공유하는 독서 그룹에 참여하고 싶습니다.' },
    { id: 'di-141', userId: 'demo-u7',  type: 'taker',  keyword: '요가/필라테스',                  description: '연구 업무로 인한 신체 피로를 해소하는 요가 루틴이 궁금합니다.' },
    // u8 한준호 추가
    { id: 'di-142', userId: 'demo-u8',  type: 'giver',  keyword: '신사업',                         description: '신차 개발과 연계한 신규 모빌리티 서비스 기획 경험이 있습니다.' },
    { id: 'di-143', userId: 'demo-u8',  type: 'taker',  keyword: '리더십',                         description: '제품 기획자로서 리더십을 어떻게 키워야 할지 배우고 싶습니다.' },
    { id: 'di-144', userId: 'demo-u8',  type: 'taker',  keyword: '와인',                           description: '자동차 런칭 행사에서 활용할 와인 선택법이 궁금합니다.' },
    // u9 송미경 추가
    { id: 'di-145', userId: 'demo-u9',  type: 'giver',  keyword: '성과관리',                       description: '데이터 팀의 KPI 설계와 성과 측정 체계 구축 경험을 공유합니다.' },
    { id: 'di-146', userId: 'demo-u9',  type: 'taker',  keyword: '잡크래프팅',                     description: '데이터 분석 업무에서 더 큰 의미를 찾는 방법이 궁금합니다.' },
    { id: 'di-147', userId: 'demo-u9',  type: 'giver',  keyword: '마케팅',                         description: '데이터 분석을 마케팅 캠페인에 연결한 실제 사례를 나눌 수 있습니다.' },
    // u10 조민기 추가
    { id: 'di-148', userId: 'demo-u10', type: 'giver',  keyword: '전략',                           description: '디지털 금융 서비스의 중장기 전략 수립 경험이 있습니다.' },
    { id: 'di-149', userId: 'demo-u10', type: 'taker',  keyword: '독서',                           description: '핀테크·금융 혁신 트렌드를 다룬 도서 추천을 받고 싶습니다.' },
    { id: 'di-150', userId: 'demo-u10', type: 'giver',  keyword: '협상',                           description: '협력사와의 플랫폼 연동 계약 협상 경험을 공유합니다.' },
    // u11 임수빈 추가
    { id: 'di-151', userId: 'demo-u11', type: 'giver',  keyword: '커뮤니케이션스킬(코칭,피드백)', description: 'HR에서 다양한 직급 대상 코칭·피드백 훈련 경험이 있습니다.' },
    { id: 'di-152', userId: 'demo-u11', type: 'taker',  keyword: '조직문화',                       description: '구성원이 스스로 문화를 만들어가는 조직 설계 방법이 궁금합니다.' },
    { id: 'di-153', userId: 'demo-u11', type: 'giver',  keyword: '동기부여',                       description: '구성원 동기 진단과 맞춤형 동기부여 실행 경험을 나눌 수 있습니다.' },
    // u12 황정훈 추가
    { id: 'di-154', userId: 'demo-u12', type: 'giver',  keyword: '데이터기반 의사결정',            description: 'AI 모델 성능 지표로 개발 의사결정을 지원한 경험이 있습니다.' },
    { id: 'di-155', userId: 'demo-u12', type: 'taker',  keyword: 'Open Innovation',                description: 'AI 분야 대학·스타트업 협력 모델을 배우고 싶습니다.' },
    { id: 'di-156', userId: 'demo-u12', type: 'giver',  keyword: '혁신',                           description: '기존 개발 방식을 AI로 대체한 혁신 프로젝트 경험을 공유합니다.' },
    // u13 서은지 추가
    { id: 'di-157', userId: 'demo-u13', type: 'giver',  keyword: '조직문화',                       description: '환경부서 특유의 사명감 기반 조직문화를 구축한 경험이 있습니다.' },
    { id: 'di-158', userId: 'demo-u13', type: 'taker',  keyword: '인문학',                         description: '환경철학과 지속가능성의 인문학적 배경을 넓히고 싶습니다.' },
    { id: 'di-159', userId: 'demo-u13', type: 'giver',  keyword: '변화관리',                       description: '탄소중립 전환을 위한 내부 변화관리 경험을 나눌 수 있습니다.' },
    // u14 노재원 추가
    { id: 'di-160', userId: 'demo-u14', type: 'giver',  keyword: '전략',                           description: '방산 분야 장기 사업 전략 수립과 포트폴리오 관리 경험이 있습니다.' },
    { id: 'di-161', userId: 'demo-u14', type: 'taker',  keyword: '독서',                           description: '국제안보와 전략적 사고를 다룬 도서를 추천받고 싶습니다.' },
    { id: 'di-162', userId: 'demo-u14', type: 'giver',  keyword: '리더십',                         description: '특수한 조직 문화 속에서의 리더십 경험을 나눌 수 있습니다.' },
    // u15 문지혜 추가
    { id: 'di-163', userId: 'demo-u15', type: 'giver',  keyword: '일하는방식',                     description: '설계 엔지니어링 팀의 효율적인 업무 방식을 구축한 경험이 있습니다.' },
    { id: 'di-164', userId: 'demo-u15', type: 'taker',  keyword: '마음챙김',                       description: '장시간 집중 설계 작업 후의 피로를 관리하는 방법이 궁금합니다.' },
    { id: 'di-165', userId: 'demo-u15', type: 'giver',  keyword: '성과관리',                       description: '연구개발 성과의 정량·정성 평가 체계 구축 경험을 공유합니다.' },
    // u31 김민지 추가
    { id: 'di-166', userId: 'demo-u31', type: 'giver',  keyword: 'Open Innovation',                description: '외부 스타트업과의 브랜드 협업 프로젝트 경험을 나눌 수 있습니다.' },
    { id: 'di-167', userId: 'demo-u31', type: 'taker',  keyword: '커뮤니케이션스킬(코칭,피드백)', description: '설득력 있는 마케팅 발표와 고객 커뮤니케이션 스킬을 배우고 싶습니다.' },
    { id: 'di-168', userId: 'demo-u31', type: 'giver',  keyword: '협업',                           description: '마케팅과 제품 부서 간의 협업 체계를 만든 경험이 있습니다.' },
    // u32 이성훈 추가
    { id: 'di-169', userId: 'demo-u32', type: 'giver',  keyword: '성과관리',                       description: '부품 개발 프로젝트의 일정·품질·원가 관리 경험을 공유합니다.' },
    { id: 'di-170', userId: 'demo-u32', type: 'taker',  keyword: '재무',                           description: '사업부 예산 편성과 원가 분석 방법을 배우고 싶습니다.' },
    { id: 'di-171', userId: 'demo-u32', type: 'taker',  keyword: '골프',                           description: '처음 골프를 시작하는 직장인을 위한 팁이 궁금합니다.' },
    // u33 박현아 추가
    { id: 'di-172', userId: 'demo-u33', type: 'giver',  keyword: '조직관리',                       description: '물류 허브의 다기능 팀 운영과 인력 배치 경험을 나눌 수 있습니다.' },
    { id: 'di-173', userId: 'demo-u33', type: 'taker',  keyword: '마음챙김',                       description: '바쁜 공급망 업무 속 스트레스 관리법이 궁금합니다.' },
    { id: 'di-174', userId: 'demo-u33', type: 'giver',  keyword: '일하는방식',                     description: 'SCM 혁신 프로젝트에서의 애자일 업무 방식 경험이 있습니다.' },
    // u34 최준영 추가
    { id: 'di-175', userId: 'demo-u34', type: 'giver',  keyword: '전략',                           description: '금융 리스크 관점에서의 사업 전략 평가 경험을 공유합니다.' },
    { id: 'di-176', userId: 'demo-u34', type: 'taker',  keyword: '재테크',                         description: '금융 전문가 눈으로 보는 개인 자산 관리 전략이 궁금합니다.' },
    { id: 'di-177', userId: 'demo-u34', type: 'taker',  keyword: '와인',                           description: '고객 접대 시 와인 선택 기준과 기초 지식이 궁금합니다.' },
    // u35 신지원 추가
    { id: 'di-178', userId: 'demo-u35', type: 'giver',  keyword: '혁신',                           description: '보안 관점에서 IT 인프라를 혁신적으로 개편한 경험이 있습니다.' },
    { id: 'di-179', userId: 'demo-u35', type: 'taker',  keyword: '독서',                           description: '사이버보안과 기술 미래를 다룬 추천 도서가 궁금합니다.' },
    { id: 'di-180', userId: 'demo-u35', type: 'giver',  keyword: '데이터기반 의사결정',            description: '보안 위협 데이터를 분석해 의사결정에 활용한 경험이 있습니다.' },
    // u36 황도윤 추가
    { id: 'di-181', userId: 'demo-u36', type: 'giver',  keyword: '자기다움',                       description: '디자이너의 정체성으로 경영 의사결정에 참여한 경험을 나눌 수 있습니다.' },
    { id: 'di-182', userId: 'demo-u36', type: 'taker',  keyword: '마음챙김',                       description: '창의적 번아웃을 극복하는 마음챙김 방법이 궁금합니다.' },
    { id: 'di-183', userId: 'demo-u36', type: 'giver',  keyword: 'Open Innovation',                description: '디자인 기반 오픈 이노베이션 프로젝트 참여 경험이 있습니다.' },
    // u37 김수현 추가
    { id: 'di-184', userId: 'demo-u37', type: 'giver',  keyword: '전략',                           description: '에너지 전환 시대 사업 포트폴리오 재편 전략 경험을 공유합니다.' },
    { id: 'di-185', userId: 'demo-u37', type: 'taker',  keyword: '등산/트래킹',                    description: '주말 산행으로 에너지를 재충전하는 코스 추천이 궁금합니다.' },
    { id: 'di-186', userId: 'demo-u37', type: 'taker',  keyword: '재테크',                         description: 'ESG 투자 트렌드와 개인 재테크 연결법이 궁금합니다.' },
    // u38 이지훈 추가
    { id: 'di-187', userId: 'demo-u38', type: 'giver',  keyword: '전략',                           description: '해외 건설 수주를 위한 사업 전략과 현지화 경험을 나눌 수 있습니다.' },
    { id: 'di-188', userId: 'demo-u38', type: 'taker',  keyword: '와인',                           description: '중동·유럽 출장 중 비즈니스 와인 문화를 배우고 싶습니다.' },
    { id: 'di-189', userId: 'demo-u38', type: 'giver',  keyword: '지정학',                         description: '해외 건설 프로젝트에서 경험한 지정학 리스크 대응 사례가 있습니다.' },
    // u39 오민준 추가
    { id: 'di-190', userId: 'demo-u39', type: 'giver',  keyword: '혁신',                           description: '방산 기술을 민간에 이전하는 스핀오프 혁신 사례를 나눌 수 있습니다.' },
    { id: 'di-191', userId: 'demo-u39', type: 'taker',  keyword: 'Open Innovation',                description: '스타트업과의 공동 신사업 개발 방법을 배우고 싶습니다.' },
    { id: 'di-192', userId: 'demo-u39', type: 'taker',  keyword: '독서',                           description: '미래 사업 트렌드를 읽는 독서 방법과 추천 도서가 궁금합니다.' },
    // u40 나은지 추가
    { id: 'di-193', userId: 'demo-u40', type: 'giver',  keyword: '마케팅',                         description: '카드 상품 마케팅과 고객 세분화 캠페인 경험을 공유합니다.' },
    { id: 'di-194', userId: 'demo-u40', type: 'taker',  keyword: '심리학',                         description: '소비자 심리를 상품 기획에 적용하는 방법을 배우고 싶습니다.' },
    { id: 'di-195', userId: 'demo-u40', type: 'giver',  keyword: '성과관리',                       description: '상품 출시 후 KPI 추적과 성과 관리 프로세스 경험이 있습니다.' },
    // u41 배성호 추가
    { id: 'di-196', userId: 'demo-u41', type: 'giver',  keyword: '변화관리',                       description: '전동화 전환에 따른 현장 업무 변화 관리 경험을 나눌 수 있습니다.' },
    { id: 'di-197', userId: 'demo-u41', type: 'taker',  keyword: '마음챙김',                       description: '교대근무 환경에서 심신 균형을 유지하는 방법이 궁금합니다.' },
    { id: 'di-198', userId: 'demo-u41', type: 'taker',  keyword: '낚시',                           description: '주말 스트레스 해소를 위한 낚시 입문 방법이 궁금합니다.' },
    // u42 정하윤 추가
    { id: 'di-199', userId: 'demo-u42', type: 'giver',  keyword: '혁신',                           description: '플랜트 운영의 디지털 혁신과 비용 절감 사례를 나눌 수 있습니다.' },
    { id: 'di-200', userId: 'demo-u42', type: 'taker',  keyword: '가드닝',                         description: '사무실 공간을 자연 친화적으로 꾸미는 가드닝 아이디어가 궁금합니다.' },
    { id: 'di-201', userId: 'demo-u42', type: 'giver',  keyword: '협업',                           description: '설계·시공·운영팀 간의 통합 협업 체계 구축 경험이 있습니다.' },
    // u43 손민재 추가
    { id: 'di-202', userId: 'demo-u43', type: 'giver',  keyword: '구성원 육성',                    description: '연구직 후배들의 경력 개발을 지원한 멘토링 경험이 있습니다.' },
    { id: 'di-203', userId: 'demo-u43', type: 'taker',  keyword: '심리학',                         description: '연구팀의 창의성을 높이는 심리학적 접근법이 궁금합니다.' },
    { id: 'di-204', userId: 'demo-u43', type: 'taker',  keyword: '낚시',                           description: '남해·동해 바다 낚시 포인트와 계절별 어종 정보가 궁금합니다.' },
    // u44 임채원 추가
    { id: 'di-205', userId: 'demo-u44', type: 'giver',  keyword: '리더십',                         description: '엔지니어링 조직의 기술 리더십과 팀 빌딩 경험을 나눌 수 있습니다.' },
    { id: 'di-206', userId: 'demo-u44', type: 'taker',  keyword: '자기다움',                       description: '기술 전문가로서 나만의 커리어 정체성을 찾고 싶습니다.' },
    { id: 'di-207', userId: 'demo-u44', type: 'giver',  keyword: '구성원 육성',                    description: '주니어 엔지니어의 온보딩과 역량 개발 경험을 공유합니다.' },
    // u45 유나라 추가
    { id: 'di-208', userId: 'demo-u45', type: 'giver',  keyword: '조직문화',                       description: 'ESG 가치를 조직문화로 내재화한 경험을 나눌 수 있습니다.' },
    { id: 'di-209', userId: 'demo-u45', type: 'taker',  keyword: '사회공헌/멘토링',                description: '환경 분야 사회공헌 활동과 청소년 멘토링 방법을 배우고 싶습니다.' },
    { id: 'di-210', userId: 'demo-u45', type: 'giver',  keyword: '커뮤니케이션스킬(코칭,피드백)', description: '이해관계자 설득과 ESG 보고 커뮤니케이션 경험을 공유합니다.' },
    // u16 오세훈 추가
    { id: 'di-211', userId: 'demo-u16', type: 'giver',  keyword: '전략',                           description: '신사업 전략 로드맵 수립과 이사회 승인 프로세스 경험이 있습니다.' },
    { id: 'di-212', userId: 'demo-u16', type: 'taker',  keyword: '골프',                           description: '임원급 비즈니스 골프의 에티켓과 접대 방법이 궁금합니다.' },
    { id: 'di-213', userId: 'demo-u16', type: 'giver',  keyword: 'Open Innovation',                description: '외부 스타트업 투자와 협력 생태계 구축 경험을 나눌 수 있습니다.' },
    // u17 권나영 추가
    { id: 'di-214', userId: 'demo-u17', type: 'giver',  keyword: '리더십',                         description: '대규모 개발 조직을 이끈 기술 리더십 경험을 나눌 수 있습니다.' },
    { id: 'di-215', userId: 'demo-u17', type: 'taker',  keyword: '마음챙김',                       description: '고강도 개발 일정 중 번아웃을 예방하는 마음챙김법이 궁금합니다.' },
    { id: 'di-216', userId: 'demo-u17', type: 'giver',  keyword: '혁신',                           description: '플랫폼 아키텍처 혁신으로 개발 속도를 높인 경험이 있습니다.' },
    // u18 류민준 추가
    { id: 'di-217', userId: 'demo-u18', type: 'giver',  keyword: 'AI/AX',                          description: '자율주행 센서 데이터에 AI를 접목한 AX 전환 경험이 있습니다.' },
    { id: 'di-218', userId: 'demo-u18', type: 'taker',  keyword: '독서',                           description: 'AI와 미래 기술을 다룬 최신 도서 추천과 독서 토론에 참여하고 싶습니다.' },
    { id: 'di-219', userId: 'demo-u18', type: 'giver',  keyword: '혁신',                           description: '기존 센서 융합 방식을 완전히 재설계한 혁신 프로젝트 경험이 있습니다.' },
    // u19 백지은 추가
    { id: 'di-220', userId: 'demo-u19', type: 'giver',  keyword: '커뮤니케이션스킬(코칭,피드백)', description: '글로벌 팀과의 영어 코칭·피드백 방법을 나눌 수 있습니다.' },
    { id: 'di-221', userId: 'demo-u19', type: 'taker',  keyword: '심리학',                         description: '원격 팀의 심리적 안전감을 높이는 방법이 궁금합니다.' },
    { id: 'di-222', userId: 'demo-u19', type: 'giver',  keyword: '일하는방식',                     description: '커넥티드카 개발팀의 분산 협업 업무 방식을 구축한 경험이 있습니다.' },
    // u20 신동현 추가
    { id: 'di-223', userId: 'demo-u20', type: 'giver',  keyword: '협상',                           description: '글로벌 선사·항만사와의 계약 협상 전략을 나눌 수 있습니다.' },
    { id: 'di-224', userId: 'demo-u20', type: 'taker',  keyword: '지정학',                         description: '해운 물류에 영향을 미치는 지정학 리스크 분석 방법이 궁금합니다.' },
    { id: 'di-225', userId: 'demo-u20', type: 'taker',  keyword: '미식(맛집/카페)',                description: '부산·인천 항구 주변 숨은 맛집 정보를 나누고 싶습니다.' },
    // u21 안수진 추가
    { id: 'di-226', userId: 'demo-u21', type: 'giver',  keyword: '혁신',                           description: '전통 제철 공정에서의 점진적 혁신 추진 경험을 공유합니다.' },
    { id: 'di-227', userId: 'demo-u21', type: 'taker',  keyword: '인문학',                         description: '소재 과학자가 인문학적 시각으로 세상을 보는 방법이 궁금합니다.' },
    { id: 'di-228', userId: 'demo-u21', type: 'giver',  keyword: '조직문화',                       description: '연구소의 혁신 친화적 조직문화 형성 경험을 나눌 수 있습니다.' },
    // u22 장태영 추가
    { id: 'di-229', userId: 'demo-u22', type: 'giver',  keyword: '전략',                           description: '대형 인프라 사업의 수주 전략과 경쟁사 분석 경험이 있습니다.' },
    { id: 'di-230', userId: 'demo-u22', type: 'taker',  keyword: '와인',                           description: '중동 프로젝트 파트너와의 비즈니스 석상 와인 대처법이 궁금합니다.' },
    { id: 'di-231', userId: 'demo-u22', type: 'giver',  keyword: '리더십',                         description: '다국적 건설 현장에서의 리더십 경험을 나눌 수 있습니다.' },
    // u23 전혜린 추가
    { id: 'di-232', userId: 'demo-u23', type: 'giver',  keyword: '혁신',                           description: '5축 가공 공정의 완전 자동화를 이룬 혁신 사례를 공유합니다.' },
    { id: 'di-233', userId: 'demo-u23', type: 'taker',  keyword: '마음챙김',                       description: '정밀 가공 집중 업무 후의 심신 회복 방법이 궁금합니다.' },
    { id: 'di-234', userId: 'demo-u23', type: 'giver',  keyword: '성과관리',                       description: '가공 품질과 생산성을 동시에 관리하는 성과 체계 경험이 있습니다.' },
    // u24 차유진 추가
    { id: 'di-235', userId: 'demo-u24', type: 'giver',  keyword: '변화관리',                       description: '수소 시스템 도입 시 현장 엔지니어의 변화 저항을 극복한 경험이 있습니다.' },
    { id: 'di-236', userId: 'demo-u24', type: 'taker',  keyword: '독서',                           description: '수소 경제와 에너지 전환을 다룬 추천 도서가 궁금합니다.' },
    { id: 'di-237', userId: 'demo-u24', type: 'giver',  keyword: '전략',                           description: '수소 모빌리티 사업의 중장기 로드맵 수립 경험을 나눌 수 있습니다.' },
    // u25 하승우 추가
    { id: 'di-238', userId: 'demo-u25', type: 'giver',  keyword: '신사업',                         description: '금융 산업의 새로운 수익 모델 발굴과 상품화 경험이 있습니다.' },
    { id: 'di-239', userId: 'demo-u25', type: 'taker',  keyword: '골프',                           description: '금융권 비즈니스 골프 문화와 에티켓을 배우고 싶습니다.' },
    { id: 'di-240', userId: 'demo-u25', type: 'taker',  keyword: '와인',                           description: '고객 접대용 와인 셀렉션 기준과 레스토랑 페어링이 궁금합니다.' },
    // u26 곽민서 추가
    { id: 'di-241', userId: 'demo-u26', type: 'giver',  keyword: '구성원 육성',                    description: '연구 조직에서 구성원의 자기주도 성장을 이끈 경험이 있습니다.' },
    { id: 'di-242', userId: 'demo-u26', type: 'taker',  keyword: '잡크래프팅',                     description: '수십 년 경력의 엔지니어로서 직무 재설계 방법이 궁금합니다.' },
    { id: 'di-243', userId: 'demo-u26', type: 'taker',  keyword: '악기연주',                       description: '퇴근 후 취미로 시작하기 좋은 악기와 입문법이 궁금합니다.' },
    // u27 배준혁 추가
    { id: 'di-244', userId: 'demo-u27', type: 'giver',  keyword: '협상',                           description: '대형 플랜트 EPC 계약 협상 전략과 클레임 대응 경험을 공유합니다.' },
    { id: 'di-245', userId: 'demo-u27', type: 'taker',  keyword: '독서',                           description: '지정학과 국제관계를 깊이 다룬 도서를 추천받고 싶습니다.' },
    { id: 'di-246', userId: 'demo-u27', type: 'giver',  keyword: '정책',                           description: '수소에너지 관련 국내외 정책 동향과 인허가 절차 경험이 있습니다.' },
    // u28 성은비 추가
    { id: 'di-247', userId: 'demo-u28', type: 'giver',  keyword: '마케팅',                         description: '금융 상품의 고객군별 마케팅 전략 수립 경험을 나눌 수 있습니다.' },
    { id: 'di-248', userId: 'demo-u28', type: 'taker',  keyword: '인문학',                         description: '금융과 인문학을 연결하는 독서와 사유 방식이 궁금합니다.' },
    { id: 'di-249', userId: 'demo-u28', type: 'taker',  keyword: '와인',                           description: '금융권 고객과의 와인 다이닝 에티켓과 기초 지식이 궁금합니다.' },
    // u29 유재현 추가
    { id: 'di-250', userId: 'demo-u29', type: 'giver',  keyword: '리더십',                         description: '럭셔리 브랜드 개발 프로젝트에서의 크리에이티브 리더십 경험이 있습니다.' },
    { id: 'di-251', userId: 'demo-u29', type: 'taker',  keyword: '인문학',                         description: '프리미엄 브랜드의 인문학적 철학과 역사를 배우고 싶습니다.' },
    { id: 'di-252', userId: 'demo-u29', type: 'taker',  keyword: '컬렉팅(미술품 등)',              description: '자동차 디자인과 미술품 컬렉팅의 연관성이 궁금합니다.' },
    // u30 이준서 추가
    { id: 'di-253', userId: 'demo-u30', type: 'giver',  keyword: '마케팅',                         description: '신흥 시장 진입을 위한 현지화 마케팅 전략 경험을 공유합니다.' },
    { id: 'di-254', userId: 'demo-u30', type: 'taker',  keyword: '골프',                           description: '해외 시장 파트너와의 비즈니스 골프 문화 이해가 필요합니다.' },
    { id: 'di-255', userId: 'demo-u30', type: 'giver',  keyword: '리더십',                         description: '글로벌 마케팅 팀의 다문화 리더십 경험을 나눌 수 있습니다.' },
    // u46 강태현 추가
    { id: 'di-256', userId: 'demo-u46', type: 'giver',  keyword: '전략',                           description: '기술 트렌드를 사업 전략으로 전환하는 임원 관점의 경험을 공유합니다.' },
    { id: 'di-257', userId: 'demo-u46', type: 'taker',  keyword: '와인',                           description: '임원급 비즈니스 석상에서의 와인 소통법이 궁금합니다.' },
    { id: 'di-258', userId: 'demo-u46', type: 'giver',  keyword: 'Open Innovation',                description: '글로벌 파트너십과 오픈 이노베이션 생태계 구축 경험이 있습니다.' },
    // u47 문소희 추가
    { id: 'di-259', userId: 'demo-u47', type: 'giver',  keyword: '마케팅',                         description: '인도·동남아 신흥시장 현지화 마케팅 전략 경험을 나눌 수 있습니다.' },
    { id: 'di-260', userId: 'demo-u47', type: 'taker',  keyword: '지정학',                         description: '인도 시장 진출에 영향을 미치는 지정학 리스크 이해가 필요합니다.' },
    { id: 'di-261', userId: 'demo-u47', type: 'giver',  keyword: '협상',                           description: '현지 파트너·딜러와의 계약 협상 전략 경험이 있습니다.' },
    // u48 백승민 추가
    { id: 'di-262', userId: 'demo-u48', type: 'giver',  keyword: '데이터기반 의사결정',            description: 'ADAS 개발 데이터를 기반으로 한 의사결정 프로세스를 공유합니다.' },
    { id: 'di-263', userId: 'demo-u48', type: 'taker',  keyword: 'Open Innovation',                description: '자율주행 분야 외부 연구기관과의 협력 모델을 배우고 싶습니다.' },
    { id: 'di-264', userId: 'demo-u48', type: 'giver',  keyword: '혁신',                           description: '기존 센서 통합 방식을 완전히 재설계한 혁신 사례가 있습니다.' },
    // u49 서다은 추가
    { id: 'di-265', userId: 'demo-u49', type: 'giver',  keyword: 'AI/AX',                          description: '데이터 플랫폼에 AI를 도입해 분석 자동화를 구현한 경험이 있습니다.' },
    { id: 'di-266', userId: 'demo-u49', type: 'taker',  keyword: '잡크래프팅',                     description: '데이터 엔지니어로서 커리어의 새로운 방향을 탐색하고 싶습니다.' },
    { id: 'di-267', userId: 'demo-u49', type: 'giver',  keyword: '성과관리',                       description: '데이터 조직의 OKR 설계와 성과 추적 경험을 나눌 수 있습니다.' },
    // u50 양준호 추가
    { id: 'di-268', userId: 'demo-u50', type: 'giver',  keyword: '전략',                           description: '복합 물류 네트워크 최적화를 위한 전략 수립 경험이 있습니다.' },
    { id: 'di-269', userId: 'demo-u50', type: 'taker',  keyword: '지정학',                         description: '홍해 위기 등 지정학 이슈가 해운 물류에 미치는 영향을 이해하고 싶습니다.' },
    { id: 'di-270', userId: 'demo-u50', type: 'taker',  keyword: '미식(맛집/카페)',                description: '전국 물류 거점 주변 맛집 정보를 나누고 싶습니다.' },
    // u51 조아름 추가
    { id: 'di-271', userId: 'demo-u51', type: 'giver',  keyword: '변화관리',                       description: '고로에서 전기로 전환 과정의 조직 변화 관리 경험을 공유합니다.' },
    { id: 'di-272', userId: 'demo-u51', type: 'taker',  keyword: '마음챙김',                       description: '장기 연구 업무의 집중력 유지를 위한 마음챙김 방법이 궁금합니다.' },
    { id: 'di-273', userId: 'demo-u51', type: 'giver',  keyword: '조직문화',                       description: '소재 연구소의 창의적 조직문화 조성 경험을 나눌 수 있습니다.' },
    // u52 한재원 추가
    { id: 'di-274', userId: 'demo-u52', type: 'giver',  keyword: '전략',                           description: '신축 모듈러 시장 개척과 고객 발굴 전략 경험을 공유합니다.' },
    { id: 'di-275', userId: 'demo-u52', type: 'taker',  keyword: '인문학',                         description: '건축과 인문학의 접점에서 영감을 얻는 방법이 궁금합니다.' },
    { id: 'di-276', userId: 'demo-u52', type: 'giver',  keyword: 'Open Innovation',                description: '건설 분야 스타트업과의 기술 협업 경험이 있습니다.' },
    // u53 도유진 추가
    { id: 'di-277', userId: 'demo-u53', type: 'giver',  keyword: '일하는방식',                     description: '정밀가공 연구팀의 비효율을 줄인 업무 프로세스 개선 경험이 있습니다.' },
    { id: 'di-278', userId: 'demo-u53', type: 'taker',  keyword: '마음챙김',                       description: '정밀 집중 업무 환경에서 마음챙김을 실천하는 방법이 궁금합니다.' },
    { id: 'di-279', userId: 'demo-u53', type: 'taker',  keyword: '낚시',                           description: '공장 인근 충남 지역 낚시 포인트 정보가 궁금합니다.' },
    // u54 이원준 추가
    { id: 'di-280', userId: 'demo-u54', type: 'giver',  keyword: '리더십',                         description: '철도 시스템 개발 프로젝트의 다기능 팀 리더십 경험을 나눕니다.' },
    { id: 'di-281', userId: 'demo-u54', type: 'taker',  keyword: '독서',                           description: '시스템 엔지니어링과 복잡계를 다룬 추천 도서가 궁금합니다.' },
    { id: 'di-282', userId: 'demo-u54', type: 'giver',  keyword: '협업',                           description: '철도·항공·방산 분야 크로스 인더스트리 협업 경험이 있습니다.' },
    // u55 김아린 추가
    { id: 'di-283', userId: 'demo-u55', type: 'giver',  keyword: '데이터기반 의사결정',            description: '디지털 마케팅 데이터로 캠페인 ROI를 높인 경험이 있습니다.' },
    { id: 'di-284', userId: 'demo-u55', type: 'taker',  keyword: '재테크',                         description: '마케터 출신 직장인의 현명한 자산 관리 전략이 궁금합니다.' },
    { id: 'di-285', userId: 'demo-u55', type: 'giver',  keyword: '협업',                           description: '마케팅·IT·사업부 간의 디지털 전환 협업을 주도한 경험이 있습니다.' },
    // u56 최민영 추가
    { id: 'di-286', userId: 'demo-u56', type: 'giver',  keyword: '성과관리',                       description: '글로벌 협력사와의 공동 개발 성과 측정 체계를 구축한 경험이 있습니다.' },
    { id: 'di-287', userId: 'demo-u56', type: 'taker',  keyword: '마음챙김',                       description: '해외 출장이 잦은 직장인을 위한 마음챙김 루틴이 궁금합니다.' },
    { id: 'di-288', userId: 'demo-u56', type: 'taker',  keyword: '악기연주',                       description: '기타나 피아노로 퇴근 후 취미 생활을 시작하고 싶습니다.' },
    // u57 엄태준 추가
    { id: 'di-289', userId: 'demo-u57', type: 'giver',  keyword: '전략',                           description: '재생에너지 사업의 중장기 투자 전략과 포트폴리오 구성 경험이 있습니다.' },
    { id: 'di-290', userId: 'demo-u57', type: 'taker',  keyword: '지정학',                         description: '에너지 안보와 지정학 리스크의 연관성을 이해하고 싶습니다.' },
    { id: 'di-291', userId: 'demo-u57', type: 'giver',  keyword: '혁신',                           description: '신재생에너지 플랜트의 설계 혁신과 비용 절감 사례를 나눌 수 있습니다.' },
    // u58 박지훈 추가
    { id: 'di-292', userId: 'demo-u58', type: 'giver',  keyword: '전략',                           description: '글로벌 금융 시장에서의 자산 배분 전략 수립 경험이 있습니다.' },
    { id: 'di-293', userId: 'demo-u58', type: 'taker',  keyword: '재테크',                         description: '해외 금융 전문가 관점의 개인 자산 관리 팁이 궁금합니다.' },
    { id: 'di-294', userId: 'demo-u58', type: 'taker',  keyword: '컬렉팅(미술품 등)',              description: '미술품을 자산으로 보는 관점과 컬렉팅 입문 방법이 궁금합니다.' },
    // u59 류세연 추가
    { id: 'di-295', userId: 'demo-u59', type: 'giver',  keyword: '커뮤니케이션스킬(코칭,피드백)', description: '글로벌 소프트웨어 팀 대상 영어 코칭과 피드백 방법을 공유합니다.' },
    { id: 'di-296', userId: 'demo-u59', type: 'taker',  keyword: '마음챙김',                       description: '연속적인 업무 집중 후의 정신적 회복 루틴이 궁금합니다.' },
    { id: 'di-297', userId: 'demo-u59', type: 'giver',  keyword: 'AI/AX',                          description: '차량 커넥티드 서비스에 AI를 접목한 AX 전환 경험이 있습니다.' },
    // u60 송재민 추가
    { id: 'di-298', userId: 'demo-u60', type: 'giver',  keyword: '일하는방식',                     description: '자동화 현장의 효율적 업무 방식과 인간-기계 협업 체계를 공유합니다.' },
    { id: 'di-299', userId: 'demo-u60', type: 'taker',  keyword: '골프',                           description: '공장 지역 근무자를 위한 주말 골프 라운딩 정보가 궁금합니다.' },
    { id: 'di-300', userId: 'demo-u60', type: 'taker',  keyword: '재테크',                         description: '생산직 관리자의 장기 자산 형성 방법에 대해 조언을 받고 싶습니다.' },
  ];

  const userInsights: UserInsight[] = [
    { id: 'din-1',  userId: 'demo-u1',  sessionId: 'demo-s1', keyword: '심리적 안전감',   description: '팀원이 실패를 두려워하지 않는 환경이 AI 시대 혁신의 전제조건이라는 것을 깨달았습니다.', likes: ['demo-u2','demo-u3','demo-u11'] },
    { id: 'din-2',  userId: 'demo-u2',  sessionId: 'demo-s1', keyword: '공감 리더십',     description: '기술적 탁월함보다 구성원의 감정을 읽는 능력이 성과를 좌우한다는 점이 인상적이었습니다.', likes: ['demo-u1','demo-u4'] },
    { id: 'din-3',  userId: 'demo-u3',  sessionId: 'demo-s2', keyword: '투명한 의사결정', description: '결정 과정을 공개할수록 팀의 신뢰와 실행력이 높아진다는 사례가 와닿았습니다.', likes: ['demo-u5','demo-u6'] },
    { id: 'din-4',  userId: 'demo-u4',  sessionId: 'demo-s2', keyword: '다양성 포용',     description: '문화·세대 차이를 장애물이 아닌 혁신 자원으로 바라보는 시각 전환이 필요합니다.', likes: ['demo-u7','demo-u8'] },
    { id: 'din-5',  userId: 'demo-u5',  sessionId: 'demo-s3', keyword: '데이터 리터러시', description: '현장 경험과 데이터의 교차점에서만 진짜 인사이트가 나온다고 느꼈습니다.', likes: ['demo-u9','demo-u10'] },
    { id: 'din-6',  userId: 'demo-u6',  sessionId: 'demo-s3', keyword: '실험 문화',        description: '빠른 실패와 학습을 제도화하는 것이 디지털 전환의 핵심이라는 것을 배웠습니다.', likes: ['demo-u12'] },
    { id: 'din-7',  userId: 'demo-u7',  sessionId: 'demo-s4', keyword: 'Z세대 동기부여',  description: '의미·성장·자율 세 가지가 젊은 구성원의 몰입을 결정한다는 프레임이 유용했습니다.', likes: ['demo-u11','demo-u13'] },
    { id: 'din-8',  userId: 'demo-u8',  sessionId: 'demo-s4', keyword: '역멘토링',         description: '시니어가 주니어에게 배우는 역멘토링 제도가 세대 갈등 해소에 효과적임을 알았습니다.', likes: ['demo-u1','demo-u2','demo-u14'] },
    { id: 'din-9',  userId: 'demo-u9',  sessionId: 'demo-s1', keyword: '데이터 민주화',   description: '의사결정권자만 데이터를 보는 조직은 AI 시대에 뒤처진다는 경고가 충격적이었습니다.', likes: ['demo-u10','demo-u15'] },
    { id: 'din-10', userId: 'demo-u31', sessionId: 'demo-s1', keyword: '브랜드 일관성',   description: '내부 문화와 외부 브랜드가 일치할 때 진정성이 고객에게 전달된다는 것을 배웠습니다.', likes: ['demo-u32','demo-u36'] },
    { id: 'din-11', userId: 'demo-u32', sessionId: 'demo-s2', keyword: '조직 간 신뢰',    description: '부서 간 벽을 허물려면 먼저 리더가 취약성을 공개해야 한다는 점이 인상적이었습니다.', likes: ['demo-u33','demo-u44'] },
    { id: 'din-12', userId: 'demo-u36', sessionId: 'demo-s2', keyword: '디자인 씽킹',     description: '고객 관찰에서 출발하는 디자인 씽킹이 조직문화 혁신에도 적용됨을 배웠습니다.', likes: ['demo-u31','demo-u43'] },
    { id: 'din-13', userId: 'demo-u40', sessionId: 'demo-s3', keyword: '데이터 기반 공감', description: '숫자로 증명된 고객 인사이트가 설득력 있는 상품 기획의 출발점이라고 느꼈습니다.', likes: ['demo-u9','demo-u35'] },
    { id: 'din-14', userId: 'demo-u45', sessionId: 'demo-s4', keyword: '세대 통합 리더십', description: 'MZ세대를 이해하려는 노력 자체가 조직 통합의 시작임을 깨달았습니다.', likes: ['demo-u11','demo-u41'] },
    { id: 'din-15', userId: 'demo-u16', sessionId: 'demo-s5', keyword: 'MaaS 생태계',     description: '차를 소유하는 시대에서 이동 경험을 구독하는 시대로의 전환을 준비해야 합니다.', likes: ['demo-u17','demo-u19','demo-u30'] },
    { id: 'din-16', userId: 'demo-u17', sessionId: 'demo-s5', keyword: '배터리 공급망',   description: '핵심 광물 수급 리스크가 전동화 속도를 결정한다는 현실에 전략적 대비가 필요합니다.', likes: ['demo-u18','demo-u26'] },
    { id: 'din-17', userId: 'demo-u18', sessionId: 'demo-s6', keyword: 'SDV 전환 비용',   description: '하드웨어 비용보다 소프트웨어 인재 확보 비용이 전동화의 진짜 병목임을 배웠습니다.', likes: ['demo-u19','demo-u29'] },
    { id: 'din-18', userId: 'demo-u22', sessionId: 'demo-s5', keyword: '모빌리티 인프라', description: '충전 인프라 없는 전동화 전략은 사상누각이라는 비유가 강렬하게 남습니다.', likes: ['demo-u24','demo-u27'] },
    { id: 'din-19', userId: 'demo-u25', sessionId: 'demo-s6', keyword: '전기차 금융 혁신', description: '배터리 리스 분리를 통한 초기 구매 장벽 해소가 EV 대중화의 열쇠라고 느꼈습니다.', likes: ['demo-u28'] },
    { id: 'din-20', userId: 'demo-u30', sessionId: 'demo-s7', keyword: 'OTA 수익 모델',   description: '차량 판매 후에도 소프트웨어로 수익을 창출하는 구조가 게임체인저가 될 것입니다.', likes: ['demo-u16','demo-u17','demo-u19'] },
    { id: 'din-21', userId: 'demo-u46', sessionId: 'demo-s5', keyword: '기술-전략 연계',  description: '기술 로드맵과 사업 전략을 동기화하지 않으면 혁신이 현장에서 멈춘다는 것을 배웠습니다.', likes: ['demo-u47','demo-u48'] },
    { id: 'din-22', userId: 'demo-u49', sessionId: 'demo-s6', keyword: '데이터 거버넌스', description: '데이터 품질 관리 없이는 AI 전환도 사상누각임을 다시 한번 확인했습니다.', likes: ['demo-u18','demo-u55'] },
    { id: 'din-23', userId: 'demo-u55', sessionId: 'demo-s7', keyword: '구독 마케팅',     description: '차량 OTA처럼 마케팅도 지속적 관계 설계로 전환해야 한다는 인사이트를 얻었습니다.', likes: ['demo-u30','demo-u60'] },
  ];

  const teaTimeRequests: TeaTimeRequest[] = [
    { id: 'dtr-1',  fromUserId: 'demo-u2',  toUserId: 'demo-u1',  message: '리더십 경험을 나눠주실 수 있을까요? 짧게 티타임 가능하실까요?',                     status: 'accepted',  responseMessage: '물론이죠! 세션 쉬는 시간에 잠깐 이야기 나눠요.' },
    { id: 'dtr-2',  fromUserId: 'demo-u5',  toUserId: 'demo-u3',  message: '조직문화 개선 초기 시행착오 사례를 듣고 싶습니다.',                                  status: 'accepted',  responseMessage: '기꺼이요. 저도 많이 헤맸거든요. ^^' },
    { id: 'dtr-3',  fromUserId: 'demo-u12', toUserId: 'demo-u9',  message: '데이터 기반 의사결정 방법이 궁금합니다. 조언 부탁드려도 될까요?',                    status: 'pending' },
    { id: 'dtr-4',  fromUserId: 'demo-u7',  toUserId: 'demo-u6',  message: 'AI 전환 경험에 대해 의견 듣고 싶습니다.',                                            status: 'accepted',  responseMessage: '좋습니다. 오후 자유시간에 만나요.' },
    { id: 'dtr-5',  fromUserId: 'demo-u4',  toUserId: 'demo-u13', message: '정책 대응 과정에서 어려웠던 점을 여쭤보고 싶습니다.',                                 status: 'pending' },
    { id: 'dtr-6',  fromUserId: 'demo-u11', toUserId: 'demo-u8',  message: '역멘토링 제도 도입 시 구성원 반응이 어떠셨나요?',                                     status: 'accepted',  responseMessage: '저도 고민이 많았어요. 꼭 이야기 나눠봐요.' },
    { id: 'dtr-7',  fromUserId: 'demo-u33', toUserId: 'demo-u19', message: '원격 협업 체계를 어떻게 구축하셨는지 여쭤보고 싶습니다.',                             status: 'pending' },
    { id: 'dtr-8',  fromUserId: 'demo-u25', toUserId: 'demo-u28', message: '재무 관점에서 마케팅 ROI를 어떻게 설명하시는지 궁금합니다.',                          status: 'accepted',  responseMessage: '저도 같은 관심사예요! 점심 시간에 만나요.' },
    { id: 'dtr-9',  fromUserId: 'demo-u20', toUserId: 'demo-u5',  message: '협업 문화 만들기 경험을 나눠주실 수 있나요?',                                         status: 'rejected',  responseMessage: '죄송하게도 오늘 일정이 빡빡하네요. 다음에 꼭 이야기 나눠요.' },
    { id: 'dtr-10', fromUserId: 'demo-u24', toUserId: 'demo-u27', message: '지정학 리스크를 사업 전략에 반영하는 방법을 여쭤보고 싶습니다.',                      status: 'accepted',  responseMessage: '지정학 이야기라면 언제든 환영입니다!' },
    { id: 'dtr-11', fromUserId: 'demo-u31', toUserId: 'demo-u8',  message: '브랜드 마케팅 캠페인 설계 시 가장 중요한 포인트가 무엇인지 여쭤보고 싶습니다.',       status: 'pending' },
    { id: 'dtr-12', fromUserId: 'demo-u40', toUserId: 'demo-u9',  message: '고객 데이터를 상품 기획에 연결하는 구체적인 방법이 궁금합니다.',                      status: 'accepted',  responseMessage: '저도 비슷한 고민을 했어요. 꼭 이야기 나눠봐요.' },
    { id: 'dtr-13', fromUserId: 'demo-u48', toUserId: 'demo-u12', message: 'AI/AX 전환에서 경영진 설득을 어떻게 하셨는지 경험을 듣고 싶습니다.',                  status: 'pending' },
    { id: 'dtr-14', fromUserId: 'demo-u55', toUserId: 'demo-u30', message: '글로벌 마케팅에서 디지털 채널 운영 노하우를 나눠주실 수 있나요?',                    status: 'accepted',  responseMessage: '좋아요! 오후에 잠깐 커피 한 잔 해요.' },
    { id: 'dtr-15', fromUserId: 'demo-u59', toUserId: 'demo-u33', message: '크로스펑셔널 협업 시 갈등을 어떻게 해소하셨는지 경험담이 궁금합니다.',               status: 'pending' },
  ];

  const canonicalTerms: CanonicalTerm[] = [
    { id: 'ct-1',  term: '리더십' },
    { id: 'ct-2',  term: '전략' },
    { id: 'ct-3',  term: '조직문화' },
    { id: 'ct-4',  term: '데이터기반 의사결정' },
    { id: 'ct-5',  term: 'AI/AX' },
    { id: 'ct-6',  term: '협업' },
    { id: 'ct-7',  term: '재무' },
    { id: 'ct-8',  term: '마케팅' },
    { id: 'ct-9',  term: '혁신' },
    { id: 'ct-10', term: '성과관리' },
  ];

  const presetInterests: PresetInterest[] = [
    { id: 'dp-1',  keyword: '구성원 육성',                    group: 'work' },
    { id: 'dp-2',  keyword: '데이터기반 의사결정',            group: 'work' },
    { id: 'dp-3',  keyword: '동기부여',                       group: 'work' },
    { id: 'dp-4',  keyword: '리더십',                         group: 'work' },
    { id: 'dp-5',  keyword: '마케팅',                         group: 'work' },
    { id: 'dp-6',  keyword: '변화관리',                       group: 'work' },
    { id: 'dp-7',  keyword: '성과관리',                       group: 'work' },
    { id: 'dp-8',  keyword: '신사업',                         group: 'work' },
    { id: 'dp-9',  keyword: '일하는방식',                     group: 'work' },
    { id: 'dp-10', keyword: '자기다움',                       group: 'work' },
    { id: 'dp-11', keyword: '잡크래프팅',                     group: 'work' },
    { id: 'dp-12', keyword: '재무',                           group: 'work' },
    { id: 'dp-13', keyword: '전략',                           group: 'work' },
    { id: 'dp-14', keyword: '정책',                           group: 'work' },
    { id: 'dp-15', keyword: '조직관리',                       group: 'work' },
    { id: 'dp-16', keyword: '조직문화',                       group: 'work' },
    { id: 'dp-17', keyword: '지정학',                         group: 'work' },
    { id: 'dp-18', keyword: '커뮤니케이션스킬(코칭,피드백)', group: 'work' },
    { id: 'dp-19', keyword: '혁신',                           group: 'work' },
    { id: 'dp-20', keyword: '협상',                           group: 'work' },
    { id: 'dp-21', keyword: '협업',                           group: 'work' },
    { id: 'dp-22', keyword: 'AI/AX',                          group: 'work' },
    { id: 'dp-23', keyword: 'Open Innovation',                group: 'work' },
    { id: 'dp-24', keyword: '가드닝',                         group: 'hobby' },
    { id: 'dp-25', keyword: '골프',                           group: 'hobby' },
    { id: 'dp-26', keyword: '낚시',                           group: 'hobby' },
    { id: 'dp-27', keyword: '독서',                           group: 'hobby' },
    { id: 'dp-28', keyword: '등산/트래킹',                    group: 'hobby' },
    { id: 'dp-29', keyword: '마음챙김',                       group: 'hobby' },
    { id: 'dp-30', keyword: '미식(맛집/카페)',                group: 'hobby' },
    { id: 'dp-31', keyword: '사회공헌/멘토링',                group: 'hobby' },
    { id: 'dp-32', keyword: '심리학',                         group: 'hobby' },
    { id: 'dp-33', keyword: '악기연주',                       group: 'hobby' },
    { id: 'dp-34', keyword: '와인',                           group: 'hobby' },
    { id: 'dp-35', keyword: '요가/필라테스',                  group: 'hobby' },
    { id: 'dp-36', keyword: '요리',                           group: 'hobby' },
    { id: 'dp-37', keyword: '인문학',                         group: 'hobby' },
    { id: 'dp-38', keyword: '재테크',                         group: 'hobby' },
    { id: 'dp-39', keyword: '컬렉팅(미술품 등)',              group: 'hobby' },
    { id: 'dp-40', keyword: '테니스',                         group: 'hobby' },
  ];

  return { courses, users, sessions, interests, userInsights, teaTimeRequests, canonicalTerms, presetInterests };
};
