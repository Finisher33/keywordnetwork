import type { User, Course, Session, Interest, TeaTimeRequest, UserInsight, CanonicalTerm, PresetInterest, MissionGroup } from '../store';

export const generateDemoData = () => {
  const courses: Course[] = [
    { id: 'demo-c1', name: '[데모] 하이테크 리더십 과정' },
    { id: 'demo-c2', name: '[데모] 미래 모빌리티 전략 세미나' },
  ];

  const users: User[] = [
    // ── Course 1 (15명) ──────────────────────────────────────────────────────
    { id: 'demo-u1',  company: '현대자동차',   name: '김철수', department: '자율주행개발팀',    title: '팀장',     location: '남양연구소',  courseId: 'demo-c1' },
    { id: 'demo-u2',  company: '현대모비스',   name: '이영희', department: '전동화시스템설계',   title: '책임연구원', location: '의왕연구소',  courseId: 'demo-c1' },
    { id: 'demo-u3',  company: '현대제철',     name: '박지민', department: '스마트팩토리추진단', title: '매니저',    location: '당진제철소',  courseId: 'demo-c1' },
    { id: 'demo-u4',  company: '현대건설',     name: '최동욱', department: '글로벌전략기획',     title: '팀장',     location: '계동사옥',    courseId: 'demo-c1' },
    { id: 'demo-u5',  company: '현대글로비스', name: '정수아', department: '스마트물류솔루션',   title: '책임매니저', location: '본사',       courseId: 'demo-c1' },
    { id: 'demo-u6',  company: '현대오토에버', name: '강현우', department: '클라우드아키텍처',   title: '팀장',     location: '삼성동',      courseId: 'demo-c1' },
    { id: 'demo-u7',  company: '현대위아',     name: '윤서연', department: '로봇틱스연구소',     title: '선임연구원', location: '안산',       courseId: 'demo-c1' },
    { id: 'demo-u8',  company: '기아',         name: '한준호', department: '상품기획팀',         title: '책임',     location: '양재',        courseId: 'demo-c1' },
    { id: 'demo-u9',  company: '현대카드',     name: '송미경', department: '데이터분석팀',       title: '팀장',     location: '여의도',      courseId: 'demo-c1' },
    { id: 'demo-u10', company: '현대캐피탈',   name: '조민기', department: '디지털전략팀',       title: '책임',     location: '여의도',      courseId: 'demo-c1' },
    { id: 'demo-u11', company: '현대자동차',   name: '임수빈', department: 'HR전략팀',           title: '선임매니저', location: '양재본사',   courseId: 'demo-c1' },
    { id: 'demo-u12', company: '현대모비스',   name: '황정훈', department: 'AI솔루션개발',       title: '책임연구원', location: '마북연구소', courseId: 'demo-c1' },
    { id: 'demo-u13', company: '현대엔지니어링', name: '서은지', department: '탄소중립기획',     title: '팀장',     location: '판교',        courseId: 'demo-c1' },
    { id: 'demo-u14', company: '현대로템',     name: '노재원', department: '방산시스템연구',     title: '책임연구원', location: '의왕',       courseId: 'demo-c1' },
    { id: 'demo-u15', company: '현대트랜시스', name: '문지혜', department: '파워트레인설계',     title: '선임연구원', location: '화성',       courseId: 'demo-c1' },

    // ── Course 2 (15명) ──────────────────────────────────────────────────────
    { id: 'demo-u16', company: '현대자동차',   name: '오세훈', department: 'PBV사업기획',        title: '상무',     location: '양재본사',    courseId: 'demo-c2' },
    { id: 'demo-u17', company: '기아',         name: '권나영', department: 'EV플랫폼개발',       title: '팀장',     location: '화성연구소',  courseId: 'demo-c2' },
    { id: 'demo-u18', company: '현대모비스',   name: '류민준', department: '자율주행센서',       title: '수석연구원', location: '마북연구소', courseId: 'demo-c2' },
    { id: 'demo-u19', company: '현대오토에버', name: '백지은', department: '커넥티드카플랫폼',   title: '팀장',     location: '삼성동',      courseId: 'demo-c2' },
    { id: 'demo-u20', company: '현대글로비스', name: '신동현', department: '해운물류기획',       title: '책임매니저', location: '부산사무소', courseId: 'demo-c2' },
    { id: 'demo-u21', company: '현대제철',     name: '안수진', department: '그린스틸연구',       title: '선임연구원', location: '인천',       courseId: 'demo-c2' },
    { id: 'demo-u22', company: '현대건설',     name: '장태영', department: '스마트시티사업',     title: '팀장',     location: '계동',        courseId: 'demo-c2' },
    { id: 'demo-u23', company: '현대위아',     name: '전혜린', department: 'CNC가공기술',        title: '책임연구원', location: '창원',       courseId: 'demo-c2' },
    { id: 'demo-u24', company: '현대로템',     name: '차유진', department: '수소전기열차',       title: '팀장',     location: '의왕',        courseId: 'demo-c2' },
    { id: 'demo-u25', company: '현대카드',     name: '하승우', department: 'PLCC전략팀',         title: '팀장',     location: '여의도',      courseId: 'demo-c2' },
    { id: 'demo-u26', company: '현대트랜시스', name: '곽민서', department: '전동화변속기',       title: '수석연구원', location: '동탄',       courseId: 'demo-c2' },
    { id: 'demo-u27', company: '현대엔지니어링', name: '배준혁', department: '수소플랜트',       title: '책임',     location: '판교',        courseId: 'demo-c2' },
    { id: 'demo-u28', company: '현대캐피탈',   name: '성은비', department: '모빌리티금융',       title: '선임매니저', location: '여의도',     courseId: 'demo-c2' },
    { id: 'demo-u29', company: '현대자동차',   name: '유재현', department: '제네시스개발',       title: '책임연구원', location: '남양',       courseId: 'demo-c2' },
    { id: 'demo-u30', company: '기아',         name: '이준서', department: '글로벌마케팅',       title: '팀장',     location: '양재',        courseId: 'demo-c2' },
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
    { id: 'di-1',  userId: 'demo-u1',  type: 'giver',  keyword: '자율주행 알고리즘',   description: '레벨 4 자율주행 제어 로직 및 센서 퓨전 설계 경험을 공유할 수 있습니다.' },
    { id: 'di-2',  userId: 'demo-u1',  type: 'taker',  keyword: 'MZ세대 조직관리',     description: '젊은 팀원들과 효과적으로 소통하고 동기부여하는 방법이 궁금합니다.' },
    // u2 이영희
    { id: 'di-3',  userId: 'demo-u2',  type: 'giver',  keyword: '배터리 열관리',        description: 'BMS 최적화 및 배터리팩 열관리 시스템 설계 노하우를 나눌 수 있습니다.' },
    { id: 'di-4',  userId: 'demo-u2',  type: 'taker',  keyword: '생성형 AI 실무 적용', description: 'ChatGPT·Copilot을 설계 업무에 어떻게 활용하는지 배우고 싶습니다.' },
    // u3 박지민
    { id: 'di-5',  userId: 'demo-u3',  type: 'giver',  keyword: '스마트팩토리 구축',   description: '디지털 트윈 도입 및 MES 연동 경험이 있습니다. 시행착오도 공유합니다.' },
    { id: 'di-6',  userId: 'demo-u3',  type: 'taker',  keyword: 'ESG 경영 전략',       description: '탄소중립 로드맵 수립 방법론을 배우고 싶습니다.' },
    // u4 최동욱
    { id: 'di-7',  userId: 'demo-u4',  type: 'giver',  keyword: '중동·동남아 사업개발', description: '10년간의 해외 사업 경험으로 현지화 전략과 파트너십 구축을 안내합니다.' },
    { id: 'di-8',  userId: 'demo-u4',  type: 'taker',  keyword: '디지털 마케팅',        description: 'B2B 디지털 마케팅 채널 운영 전략에 대해 조언이 필요합니다.' },
    // u5 정수아
    { id: 'di-9',  userId: 'demo-u5',  type: 'giver',  keyword: '물류 네트워크 설계',  description: '글로벌 공급망 최적화 및 가시성 향상 프로젝트 경험을 공유합니다.' },
    { id: 'di-10', userId: 'demo-u5',  type: 'taker',  keyword: 'AGV·AMR 도입',         description: '자동화 창고 구축 시 벤더 선정과 운용 노하우가 궁금합니다.' },
    // u6 강현우
    { id: 'di-11', userId: 'demo-u6',  type: 'giver',  keyword: '클라우드 마이그레이션', description: 'On-prem에서 AWS/Azure로의 전환 아키텍처 설계 경험이 있습니다.' },
    { id: 'di-12', userId: 'demo-u6',  type: 'taker',  keyword: '제조 OT 보안',         description: '공장 네트워크 보안 체계 구축 방법에 대해 배우고 싶습니다.' },
    // u7 윤서연
    { id: 'di-13', userId: 'demo-u7',  type: 'giver',  keyword: '협동로봇 설계',         description: '코봇 안전 설계 기준 및 HRC(Human-Robot Collaboration) 구현 경험이 있습니다.' },
    { id: 'di-14', userId: 'demo-u7',  type: 'taker',  keyword: 'AI 비전 검사',          description: '제조 라인 품질 검사에 머신비전 적용 사례가 궁금합니다.' },
    // u8 한준호
    { id: 'di-15', userId: 'demo-u8',  type: 'giver',  keyword: '신차 상품기획',         description: '글로벌 트렌드 분석 기반의 신차 컨셉 기획 프로세스를 공유합니다.' },
    { id: 'di-16', userId: 'demo-u8',  type: 'taker',  keyword: '전기차 사용자 경험',    description: 'EV 고객의 페인포인트와 이를 해결한 UX 사례가 궁금합니다.' },
    // u9 송미경
    { id: 'di-17', userId: 'demo-u9',  type: 'giver',  keyword: '데이터 분석 자동화',   description: 'Python·SQL로 마케팅 데이터 분석 파이프라인을 자동화한 경험이 있습니다.' },
    { id: 'di-18', userId: 'demo-u9',  type: 'taker',  keyword: '성과 관리 체계',        description: 'OKR 도입 및 운용 방식에 대해 실제 사례를 듣고 싶습니다.' },
    // u10 조민기
    { id: 'di-19', userId: 'demo-u10', type: 'giver',  keyword: '핀테크 플랫폼 기획',   description: '금융 슈퍼앱 설계 및 UX 개선 경험을 나눌 수 있습니다.' },
    { id: 'di-20', userId: 'demo-u10', type: 'taker',  keyword: '규제 샌드박스 활용',    description: '금융 혁신 서비스를 위한 규제 샌드박스 신청 경험이 궁금합니다.' },
    // u11 임수빈
    { id: 'di-21', userId: 'demo-u11', type: 'giver',  keyword: '인재 채용 전략',        description: 'R&D 인재 확보를 위한 채용 브랜딩 및 프로세스 개선 경험이 있습니다.' },
    { id: 'di-22', userId: 'demo-u11', type: 'taker',  keyword: '조직 애자일 전환',      description: '대기업에서 애자일 방식 도입 시 저항을 극복하는 방법이 궁금합니다.' },
    // u12 황정훈
    { id: 'di-23', userId: 'demo-u12', type: 'giver',  keyword: 'LLM 실무 튜닝',        description: '도메인 특화 LLM 파인튜닝 및 RAG 파이프라인 구축 경험을 공유합니다.' },
    { id: 'di-24', userId: 'demo-u12', type: 'taker',  keyword: '특허 전략',             description: 'AI 관련 특허 출원 및 선행기술 조사 방법이 궁금합니다.' },
    // u13 서은지
    { id: 'di-25', userId: 'demo-u13', type: 'giver',  keyword: 'ESG 공시 준비',         description: 'GRI·TCFD 기준 ESG 보고서 작성 및 이해관계자 소통 경험이 있습니다.' },
    { id: 'di-26', userId: 'demo-u13', type: 'taker',  keyword: '탄소 크레딧 거래',      description: '자발적 탄소시장(VCM) 참여 방법과 크레딧 가격 동향이 궁금합니다.' },
    // u14 노재원
    { id: 'di-27', userId: 'demo-u14', type: 'giver',  keyword: '국방 획득 프로세스',    description: '방위사업법 기반 무기체계 획득 절차와 규격화 경험을 공유합니다.' },
    { id: 'di-28', userId: 'demo-u14', type: 'taker',  keyword: '민군 기술 이전',        description: '민간 첨단기술을 방산에 적용하는 스핀온(Spin-on) 사례가 궁금합니다.' },
    // u15 문지혜
    { id: 'di-29', userId: 'demo-u15', type: 'giver',  keyword: 'e-Axle 설계',           description: '전동화 파워트레인 통합 설계 및 NVH 저감 기술 경험이 있습니다.' },
    { id: 'di-30', userId: 'demo-u15', type: 'taker',  keyword: '전고체 배터리 동향',    description: '차세대 배터리 기술 로드맵과 양산화 타임라인이 궁금합니다.' },
    // u16 오세훈
    { id: 'di-31', userId: 'demo-u16', type: 'giver',  keyword: 'PBV 비즈니스 모델',     description: '목적기반차량(PBV) 생태계 구축 및 플릿 운영 경험을 나눕니다.' },
    { id: 'di-32', userId: 'demo-u16', type: 'taker',  keyword: '자율주행 규제 동향',    description: '글로벌 자율주행 인증·허가 규제 동향을 업데이트받고 싶습니다.' },
    // u17 권나영
    { id: 'di-33', userId: 'demo-u17', type: 'giver',  keyword: 'EV 플랫폼 아키텍처',   description: 'E-GMP 기반 전용 전기차 플랫폼 설계 경험을 공유합니다.' },
    { id: 'di-34', userId: 'demo-u17', type: 'taker',  keyword: '소프트웨어 OTA 운영',   description: '차량 OTA 업데이트 품질 관리 및 롤백 전략이 궁금합니다.' },
    // u18 류민준
    { id: 'di-35', userId: 'demo-u18', type: 'giver',  keyword: '라이다·레이더 융합',    description: '멀티모달 센서 캘리브레이션 및 포인트클라우드 처리 경험이 있습니다.' },
    { id: 'di-36', userId: 'demo-u18', type: 'taker',  keyword: '엣지 컴퓨팅 적용',      description: '차량 내 엣지 AI 처리 아키텍처 설계 방법이 궁금합니다.' },
    // u19 백지은
    { id: 'di-37', userId: 'demo-u19', type: 'giver',  keyword: '커넥티드카 플랫폼',     description: 'V2X·V2G 통신 플랫폼 설계 및 보안 아키텍처 경험을 공유합니다.' },
    { id: 'di-38', userId: 'demo-u19', type: 'taker',  keyword: 'AUTOSAR 표준',          description: '차량 SW 표준 아키텍처(Classic/Adaptive AUTOSAR) 적용 사례가 궁금합니다.' },
    // u20 신동현
    { id: 'di-39', userId: 'demo-u20', type: 'giver',  keyword: '해상 운임 협상',        description: '글로벌 선사와의 장기 계약 협상 전략 및 리스크 헤지 경험이 있습니다.' },
    { id: 'di-40', userId: 'demo-u20', type: 'taker',  keyword: '블록체인 물류 추적',    description: '공급망 가시성 확보를 위한 블록체인 적용 실제 사례가 궁금합니다.' },
    // u21 안수진
    { id: 'di-41', userId: 'demo-u21', type: 'giver',  keyword: '수소환원제철 공정',     description: 'DRI 기반 수소환원제철 파일럿 프로젝트 경험을 나눌 수 있습니다.' },
    { id: 'di-42', userId: 'demo-u21', type: 'taker',  keyword: '탄소국경조정제도(CBAM)', description: 'EU CBAM 대응 방안과 철강업 영향 분석이 궁금합니다.' },
    // u22 장태영
    { id: 'di-43', userId: 'demo-u22', type: 'giver',  keyword: '스마트시티 마스터플랜', description: '사우디 NEOM 등 대형 스마트시티 사업 기획 경험을 공유합니다.' },
    { id: 'di-44', userId: 'demo-u22', type: 'taker',  keyword: 'BIM·디지털 트윈 연동',  description: '건설 프로젝트 전 주기 디지털 트윈 구현 방법이 궁금합니다.' },
    // u23 전혜린
    { id: 'di-45', userId: 'demo-u23', type: 'giver',  keyword: 'CNC 고속가공 최적화',   description: '5축 가공 공정 최적화 및 공구 수명 예측 모델 개발 경험이 있습니다.' },
    { id: 'di-46', userId: 'demo-u23', type: 'taker',  keyword: '적층제조(AM) 양산 적용', description: '항공·방산 부품 대상 3D 프린팅 양산 적용 사례가 궁금합니다.' },
    // u24 차유진
    { id: 'di-47', userId: 'demo-u24', type: 'giver',  keyword: '수소연료전지 시스템',   description: 'FCEV 구동계와 수소 저장 시스템 통합 설계 경험을 나눕니다.' },
    { id: 'di-48', userId: 'demo-u24', type: 'taker',  keyword: '철도 사이버보안',        description: 'IEC 62443 기반 철도 제어 시스템 보안 구현 사례가 궁금합니다.' },
    // u25 하승우
    { id: 'di-49', userId: 'demo-u25', type: 'giver',  keyword: 'PLCC 카드 기획',        description: '브랜드 협업형 신용카드 상품 설계 및 혜택 구조화 경험이 있습니다.' },
    { id: 'di-50', userId: 'demo-u25', type: 'taker',  keyword: 'BNPL 서비스 설계',      description: '후불결제(BNPL) 서비스 리스크 관리 체계가 궁금합니다.' },
    // u26 곽민서
    { id: 'di-51', userId: 'demo-u26', type: 'giver',  keyword: '8단 DCT 설계',          description: '전동화 전용 듀얼클러치 변속기 설계 및 NVH 개선 경험을 공유합니다.' },
    { id: 'di-52', userId: 'demo-u26', type: 'taker',  keyword: '전동화 변속기 표준화',  description: '글로벌 전동화 파워트레인 표준 동향 파악이 필요합니다.' },
    // u27 배준혁
    { id: 'di-53', userId: 'demo-u27', type: 'giver',  keyword: '수소 추출·정제 공정',   description: '블루·그린 수소 생산 플랜트 EPC 경험을 나눌 수 있습니다.' },
    { id: 'di-54', userId: 'demo-u27', type: 'taker',  keyword: '수소 안전 규정',         description: '국내외 수소 저장·운반 안전 규정 최신 동향이 궁금합니다.' },
    // u28 성은비
    { id: 'di-55', userId: 'demo-u28', type: 'giver',  keyword: '모빌리티 구독 금융',    description: '차량 구독·렌탈 상품 설계 및 잔존가치 산출 모델 경험이 있습니다.' },
    { id: 'di-56', userId: 'demo-u28', type: 'taker',  keyword: '전기차 자산 유동화',    description: 'EV 배터리 잔존가치 기반 ABS 구조화 방법이 궁금합니다.' },
    // u29 유재현
    { id: 'di-57', userId: 'demo-u29', type: 'giver',  keyword: '럭셔리 브랜드 개발',    description: '제네시스 글로벌 포지셔닝 전략 수립 및 디자인 브리프 경험을 공유합니다.' },
    { id: 'di-58', userId: 'demo-u29', type: 'taker',  keyword: '전기 플래그십 개발',    description: 'BEV 플래그십 차량의 프리미엄 경험 설계 방향이 궁금합니다.' },
    // u30 이준서
    { id: 'di-59', userId: 'demo-u30', type: 'giver',  keyword: '글로벌 마케팅 캠페인',  description: '유럽·북미 시장 브랜드 캠페인 기획 및 ROI 분석 경험이 있습니다.' },
    { id: 'di-60', userId: 'demo-u30', type: 'taker',  keyword: '중국 시장 재진입 전략', description: '브랜드 이미지 재건 및 현지 파트너십 전략 수립 방법이 궁금합니다.' },
  ];

  const userInsights: UserInsight[] = [
    { id: 'din-1',  userId: 'demo-u1',  sessionId: 'demo-s1', keyword: '심리적 안전감',  description: '팀원이 실패를 두려워하지 않는 환경이 AI 시대 혁신의 전제조건이라는 것을 깨달았습니다.', likes: ['demo-u2','demo-u3','demo-u11'] },
    { id: 'din-2',  userId: 'demo-u2',  sessionId: 'demo-s1', keyword: '공감 리더십',    description: '기술적 탁월함보다 구성원의 감정을 읽는 능력이 성과를 좌우한다는 점이 인상적이었습니다.', likes: ['demo-u1','demo-u4'] },
    { id: 'din-3',  userId: 'demo-u3',  sessionId: 'demo-s2', keyword: '투명한 의사결정', description: '결정 과정을 공개할수록 팀의 신뢰와 실행력이 높아진다는 사례가 와닿았습니다.', likes: ['demo-u5','demo-u6'] },
    { id: 'din-4',  userId: 'demo-u4',  sessionId: 'demo-s2', keyword: '다양성 포용',    description: '문화·세대 차이를 장애물이 아닌 혁신 자원으로 바라보는 시각 전환이 필요합니다.', likes: ['demo-u7','demo-u8'] },
    { id: 'din-5',  userId: 'demo-u5',  sessionId: 'demo-s3', keyword: '데이터 리터러시', description: '현장 경험과 데이터의 교차점에서만 진짜 인사이트가 나온다고 느꼈습니다.', likes: ['demo-u9','demo-u10'] },
    { id: 'din-6',  userId: 'demo-u6',  sessionId: 'demo-s3', keyword: '실험 문화',       description: '빠른 실패와 학습을 제도화하는 것이 디지털 전환의 핵심이라는 것을 배웠습니다.', likes: ['demo-u12'] },
    { id: 'din-7',  userId: 'demo-u7',  sessionId: 'demo-s4', keyword: 'Z세대 동기부여',  description: '의미·성장·자율 세 가지가 젊은 구성원의 몰입을 결정한다는 프레임이 유용했습니다.', likes: ['demo-u11','demo-u13'] },
    { id: 'din-8',  userId: 'demo-u8',  sessionId: 'demo-s4', keyword: '역멘토링',        description: '시니어가 주니어에게 배우는 역멘토링 제도가 세대 갈등 해소에 효과적임을 알았습니다.', likes: ['demo-u1','demo-u2','demo-u14'] },
    { id: 'din-9',  userId: 'demo-u9',  sessionId: 'demo-s1', keyword: '데이터 민주화',   description: '의사결정권자만 데이터를 보는 조직은 AI 시대에 뒤처진다는 경고가 충격적이었습니다.', likes: ['demo-u10','demo-u15'] },
    { id: 'din-10', userId: 'demo-u16', sessionId: 'demo-s5', keyword: 'MaaS 생태계',     description: '차를 소유하는 시대에서 이동 경험을 구독하는 시대로의 전환을 준비해야 합니다.', likes: ['demo-u17','demo-u19','demo-u30'] },
    { id: 'din-11', userId: 'demo-u17', sessionId: 'demo-s5', keyword: '배터리 공급망',   description: '핵심 광물 수급 리스크가 전동화 속도를 결정한다는 현실에 전략적 대비가 필요합니다.', likes: ['demo-u18','demo-u26'] },
    { id: 'din-12', userId: 'demo-u18', sessionId: 'demo-s6', keyword: 'SDV 전환 비용',   description: '하드웨어 비용보다 소프트웨어 인재 확보 비용이 전동화의 진짜 병목임을 배웠습니다.', likes: ['demo-u19','demo-u29'] },
    { id: 'din-13', userId: 'demo-u22', sessionId: 'demo-s5', keyword: '모빌리티 인프라', description: '충전 인프라 없는 전동화 전략은 사상누각이라는 비유가 강렬하게 남습니다.', likes: ['demo-u24','demo-u27'] },
    { id: 'din-14', userId: 'demo-u25', sessionId: 'demo-s6', keyword: '전기차 금융 혁신', description: '배터리 리스 분리를 통한 초기 구매 장벽 해소가 EV 대중화의 열쇠라고 느꼈습니다.', likes: ['demo-u28'] },
    { id: 'din-15', userId: 'demo-u30', sessionId: 'demo-s7', keyword: 'OTA 수익 모델',   description: '차량 판매 후에도 소프트웨어로 수익을 창출하는 구조가 게임체인저가 될 것입니다.', likes: ['demo-u16','demo-u17','demo-u19'] },
  ];

  const teaTimeRequests: TeaTimeRequest[] = [
    { id: 'dtr-1',  fromUserId: 'demo-u2',  toUserId: 'demo-u1',  message: '자율주행 제어 로직 설계에 대해 여쭤보고 싶습니다. 짧게 티타임 가능하실까요?',       status: 'accepted',  responseMessage: '물론이죠! 세션 쉬는 시간에 잠깐 이야기 나눠요.' },
    { id: 'dtr-2',  fromUserId: 'demo-u5',  toUserId: 'demo-u3',  message: '스마트팩토리 구축 초기 시행착오 사례를 듣고 싶습니다.',                               status: 'accepted',  responseMessage: '기꺼이요. 저도 많이 헤맸거든요. ^^' },
    { id: 'dtr-3',  fromUserId: 'demo-u12', toUserId: 'demo-u9',  message: '데이터 분석 파이프라인 자동화 방법이 궁금합니다. 조언 부탁드려도 될까요?',             status: 'pending' },
    { id: 'dtr-4',  fromUserId: 'demo-u7',  toUserId: 'demo-u6',  message: '클라우드와 온프레미스 로봇 데이터 연동 아키텍처에 대해 의견 듣고 싶습니다.',           status: 'accepted',  responseMessage: '좋습니다. 오후 자유시간에 만나요.' },
    { id: 'dtr-5',  fromUserId: 'demo-u4',  toUserId: 'demo-u13', message: 'ESG 공시 대응 과정에서 어려웠던 점을 여쭤보고 싶습니다.',                              status: 'pending' },
    { id: 'dtr-6',  fromUserId: 'demo-u11', toUserId: 'demo-u8',  message: '역멘토링 제도 도입 시 시니어 저항 해소 방법이 궁금합니다.',                            status: 'accepted',  responseMessage: '저도 고민이 많았어요. 꼭 이야기 나눠봐요.' },
    { id: 'dtr-7',  fromUserId: 'demo-u18', toUserId: 'demo-u19', message: '라이다 데이터를 커넥티드카 플랫폼으로 스트리밍하는 아키텍처에 대해 논의하고 싶습니다.', status: 'pending' },
    { id: 'dtr-8',  fromUserId: 'demo-u25', toUserId: 'demo-u28', message: 'EV 배터리 잔존가치 기반 금융 상품 설계 아이디어를 나누고 싶습니다.',                   status: 'accepted',  responseMessage: '저도 같은 관심사예요! 점심 시간에 만나요.' },
    { id: 'dtr-9',  fromUserId: 'demo-u20', toUserId: 'demo-u5',  message: '글로벌 물류 네트워크 가시성 확보 방법에 대해 경험을 나눠주실 수 있나요?',               status: 'rejected',  responseMessage: '죄송하게도 오늘 일정이 빡빡하네요. 다음에 꼭 이야기 나눠요.' },
    { id: 'dtr-10', fromUserId: 'demo-u24', toUserId: 'demo-u27', message: '수소연료전지와 수소 공급 인프라 연계 방안에 대해 의견을 나누고 싶습니다.',               status: 'accepted',  responseMessage: '수소 이야기라면 언제든 환영입니다!' },
  ];

  const canonicalTerms: CanonicalTerm[] = [
    { id: 'ct-1',  term: '자율주행' },
    { id: 'ct-2',  term: '전동화' },
    { id: 'ct-3',  term: '스마트팩토리' },
    { id: 'ct-4',  term: '리더십' },
    { id: 'ct-5',  term: 'ESG' },
    { id: 'ct-6',  term: '클라우드' },
    { id: 'ct-7',  term: '수소에너지' },
    { id: 'ct-8',  term: '데이터분석' },
    { id: 'ct-9',  term: '조직문화' },
    { id: 'ct-10', term: '모빌리티' },
  ];

  const presetInterests: PresetInterest[] = [
    { id: 'dp-1',  keyword: '인공지능·LLM',     group: 'work' },
    { id: 'dp-2',  keyword: '전동화·배터리',     group: 'work' },
    { id: 'dp-3',  keyword: '자율주행',           group: 'work' },
    { id: 'dp-4',  keyword: '스마트팩토리',       group: 'work' },
    { id: 'dp-5',  keyword: '데이터 분석',        group: 'work' },
    { id: 'dp-6',  keyword: '클라우드·DevOps',   group: 'work' },
    { id: 'dp-7',  keyword: 'ESG·탄소중립',      group: 'work' },
    { id: 'dp-8',  keyword: '글로벌 사업 개발',  group: 'work' },
    { id: 'dp-9',  keyword: '조직문화·리더십',   group: 'work' },
    { id: 'dp-10', keyword: '수소에너지',         group: 'work' },
    { id: 'dp-11', keyword: '러닝·마라톤',        group: 'hobby' },
    { id: 'dp-12', keyword: '독서 토론',          group: 'hobby' },
    { id: 'dp-13', keyword: '사진·영상 편집',     group: 'hobby' },
    { id: 'dp-14', keyword: '요리·맛집 탐방',     group: 'hobby' },
    { id: 'dp-15', keyword: '등산·캠핑',          group: 'hobby' },
  ];

  const missionGroups: MissionGroup[] = [
    {
      id: 'demo-c1_lunch',
      courseId: 'demo-c1',
      type: 'lunch',
      confirmedAt: '2026-04-18T09:00:00.000Z',
      groups: [
        ['demo-u1',  'demo-u6',  'demo-u11'],
        ['demo-u2',  'demo-u7',  'demo-u12'],
        ['demo-u3',  'demo-u8',  'demo-u13'],
        ['demo-u4',  'demo-u9',  'demo-u14'],
        ['demo-u5',  'demo-u10', 'demo-u15'],
      ],
    },
    {
      id: 'demo-c2_lunch',
      courseId: 'demo-c2',
      type: 'lunch',
      confirmedAt: '2026-04-18T09:00:00.000Z',
      groups: [
        ['demo-u16', 'demo-u21', 'demo-u26'],
        ['demo-u17', 'demo-u22', 'demo-u27'],
        ['demo-u18', 'demo-u23', 'demo-u28'],
        ['demo-u19', 'demo-u24', 'demo-u29'],
        ['demo-u20', 'demo-u25', 'demo-u30'],
      ],
    },
  ];

  return { courses, users, sessions, interests, userInsights, teaTimeRequests, canonicalTerms, presetInterests, missionGroups };
};
