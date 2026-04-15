import { User, Course, Session, Interest, TeaTimeRequest, UserInsight, CanonicalTerm, PresetInterest } from '../store';

export const generateMockData = () => {
  const courses: Course[] = [
    { id: 'demo-c1', name: '[데모] 하이테크 리더십 과정' },
    { id: 'demo-c2', name: '[데모] 미래 모빌리티 전략 세미나' }
  ];

  const users: User[] = [
    { id: 'demo-u1', company: '현대자동차', name: '김철수', department: '자율주행개발팀', title: '팀장', location: '남양연구소', courseId: 'demo-c1' },
    { id: 'demo-u2', company: '현대모비스', name: '이영희', department: '전동화시스템설계', title: '책임연구원', location: '의왕연구소', courseId: 'demo-c1' },
    { id: 'demo-u3', company: '현대제철', name: '박지민', department: '스마트팩토리추진단', title: '매니저', location: '당진제철소', courseId: 'demo-c1' },
    { id: 'demo-u4', company: '현대건설', name: '최동욱', department: '글로벌전략기획', title: '팀장', location: '계동사옥', courseId: 'demo-c1' },
    { id: 'demo-u5', company: '현대글로비스', name: '정수아', department: '스마트물류솔루션', title: '책임매니저', location: '본사', courseId: 'demo-c1' },
    { id: 'demo-u6', company: '현대오토에버', name: '강현우', department: '클라우드아키텍처', title: '팀장', location: '삼성동', courseId: 'demo-c2' },
    { id: 'demo-u7', company: '현대위아', name: '윤서연', department: '로봇틱스연구소', title: '선임연구원', location: '안산', courseId: 'demo-c2' },
    { id: 'demo-u8', company: '현대트랜시스', name: '한준호', department: '시트디자인팀', title: '책임', location: '동탄', courseId: 'demo-c2' },
    { id: 'demo-u9', company: '현대로템', name: '송미경', department: '철도기술연구소', title: '팀장', location: '의왕', courseId: 'demo-c2' },
    { id: 'demo-u10', company: '현대엔지니어링', name: '조민기', department: '플랜트설계', title: '책임', location: '본사', courseId: 'demo-c2' },
  ];

  const sessions: Session[] = [
    { id: 'demo-s1', courseId: 'demo-c1', name: 'AI 시대의 리더십', time: '09:00 - 10:30', module: 'Module 1', day: 'Day 1', isActive: true, instructor: '홍길동 교수' },
    { id: 'demo-s2', courseId: 'demo-c1', name: '조직 문화 혁신 워크숍', time: '10:40 - 12:00', module: 'Module 1', day: 'Day 1', isActive: true, instructor: '이순신 소장' },
    { id: 'demo-s3', courseId: 'demo-c1', name: '데이터 기반 의사결정', time: '13:00 - 15:00', module: 'Module 2', day: 'Day 1', isActive: false, instructor: '장영실 박사' },
  ];

  const interests: Interest[] = [
    { id: 'demo-i1', userId: 'demo-u1', type: 'giver', keyword: '자율주행 알고리즘', description: '레벨 4 자율주행 제어 로직 설계 경험을 공유할 수 있습니다.' },
    { id: 'demo-i2', userId: 'demo-u1', type: 'taker', keyword: '조직 관리', description: 'MZ세대 팀원들과의 효과적인 소통 방법을 배우고 싶습니다.' },
    { id: 'demo-i3', userId: 'demo-u2', type: 'giver', keyword: '배터리 매니지먼트', description: 'BMS 최적화 및 열관리 시스템 설계 노하우가 있습니다.' },
    { id: 'demo-i4', userId: 'demo-u2', type: 'taker', keyword: 'AI 트렌드', description: '생성형 AI를 실무 설계에 적용하는 사례가 궁금합니다.' },
    { id: 'demo-i5', userId: 'demo-u3', type: 'giver', keyword: '스마트 팩토리', description: '제조 공정 자동화 및 디지털 트윈 구축 경험이 있습니다.' },
    { id: 'demo-i6', userId: 'demo-u4', type: 'giver', keyword: '해외 사업 전략', description: '중동 및 동남아시아 시장 진출 전략 수립 경험을 공유합니다.' },
    { id: 'demo-i7', userId: 'demo-u5', type: 'taker', keyword: '물류 자동화', description: '최신 AGV/AMR 도입 시 고려사항에 대해 조언을 구합니다.' },
  ];

  const userInsights: UserInsight[] = [
    { id: 'demo-in1', userId: 'demo-u1', sessionId: 'demo-s1', keyword: '심리적 안전감', description: '팀원들이 실패를 두려워하지 않고 의견을 낼 수 있는 환경이 가장 중요하다는 것을 깨달았습니다.', likes: ['demo-u2', 'demo-u3'] },
    { id: 'demo-in2', userId: 'demo-u2', sessionId: 'demo-s1', keyword: '공감 능력', description: '기술적 탁월함보다 리더의 공감 능력이 조직의 성과를 좌우한다는 점이 인상적이었습니다.', likes: ['demo-u1'] },
    { id: 'demo-in3', userId: 'demo-u3', sessionId: 'demo-s2', keyword: '투명한 소통', description: '의사결정 과정을 투명하게 공개하는 것이 신뢰 구축의 핵심임을 배웠습니다.', likes: [] },
  ];

  const teaTimeRequests: TeaTimeRequest[] = [
    { id: 'demo-tr1', fromUserId: 'demo-u2', toUserId: 'demo-u1', message: '자율주행 제어 로직에 대해 궁금한 점이 많습니다. 짧게 티타임 가능할까요?', status: 'accepted', responseMessage: '네, 좋습니다. 오늘 오후 세션 쉬는 시간에 뵙죠.' },
    { id: 'demo-tr2', fromUserId: 'demo-u5', toUserId: 'demo-u3', message: '스마트 팩토리 구축 시 시행착오 사례를 듣고 싶습니다.', status: 'pending' },
  ];

  const canonicalTerms: CanonicalTerm[] = [
    { id: 'ct-1', term: '자율주행' },
    { id: 'ct-2', term: '리더십' },
    { id: 'ct-3', term: '스마트팩토리' },
  ];

  const presetInterests: PresetInterest[] = [
    { id: 'p1', keyword: '인공지능' },
    { id: 'p2', keyword: '모빌리티' },
    { id: 'p3', keyword: '조직문화' },
    { id: 'p4', keyword: '데이터분석' },
    { id: 'p5', keyword: '전동화' },
  ];

  return {
    courses,
    users,
    sessions,
    interests,
    userInsights,
    teaTimeRequests,
    canonicalTerms,
    presetInterests
  };
};
