import { PromptTemplate, Teacher } from './types';
import { CUSTOM_PROMPTS, CUSTOM_DESIGN_PROMPTS } from './custom_templates';

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'p1',
    title: '만 3세 주간 가정통신문 작성기',
    category: '가정통신문',
    description: '한 주간의 햇살반 놀이 관찰 주제(흙 놀이, 나뭇잎 콜라주)를 쉽고 따뜻한 부모 맞춤형 문체로 요약합니다.',
    promptText: '학부모 대상 주간 가정통신문을 작성해줘. 연령은 만 3세이고, 이번 주 주요 활동은 "부드러운 흙 놀이"와 "알록달록 나뭇잎 콜라주"야. 다정하고 신뢰감 있는 어조로 작성해줘.',
    systemGuidance: '너는 만 3세 유아 발달에 적합한 주간 알림장 및 가정통신문을 기획하는 15년 차 경력의 숙련된 담임 교사야. 학부모들이 읽었을 때 심리적 안도감을 느끼고 신뢰할 수 있게 정중하고 따뜻한 영유아 주간 뉴스레터 대리 문체로 정성스럽게 작성하여라.',
    canvasTemplate: '이번 주 햇살반 어린이들이 야외로 나가 즐거운 {{메인놀이:부드러운 흙 놀이}} 활동을 마음껏 즐겼습니다. 고사리손으로 나뭇잎을 콜라주하며 한껏 상상의 나라를 펼친 이번 한 주간의 사진기록을 가정통신문으로 공유해 드립니다. 가정에서도 주말 동안 아리따운 {{연계체험:가을 단풍잎 찾기}} 놀이로 아이의 무한한 창의적 예술성을 자극하며 행복한 추억 만드시길 소망합니다.',
    tags: ['가정통신문', '만3세', '활동안내', '따뜻한문체'],
    runs: 142,
    satisfaction: 98,
    efficiency: 85,
    isHidden: false,
    createdAt: '2026-06-10'
  },
  {
    id: 'p2',
    title: '봄 소풍 안내용 카드뉴스 카피라이팅',
    category: '카드뉴스',
    description: '인스타그램 및 알림장 앱 업로드용 카드뉴스 슬라이드별 핵심 카피와 이미지 프롬프트를 일괄 출력합니다.',
    promptText: '유치원 인스타그램용 봄 소풍 안내 카드뉴스 카피를 5장 분량으로 작성해줘. 각 장마다 핵심 한 줄 카피와 추천 배경 이미지 가이드를 작성하되, 피크닉 감성이 드러나게 해줘.',
    tags: ['카드뉴스', '인스타그램', '만3세', '소풍안내'],
    runs: 95,
    satisfaction: 94,
    efficiency: 92,
    isHidden: false,
    createdAt: '2026-06-12'
  },
  {
    id: 'p3',
    title: '자연 친화 PPT 프레젠테이션 스토리보드',
    category: 'PPT',
    description: '공개 수업용 생태 교육 PPT 슬라이드의 개요와 교사용 발화 시나리오(내러티브 가이드)를 구성합니다.',
    promptText: '교실 및 학부모 참관 수업용 "지구를 사랑하는 꼬마 정원사" PPT의 8슬라이드 기획안을 짜줘. 슬라이드 제목, 포함할 캐릭터 일러스트 아이디어, 그리고 교사의 대사 스크립트를 포함해줘.',
    tags: ['PPT', '부모참관', '생태교육', '스토리보드'],
    runs: 121,
    satisfaction: 96,
    efficiency: 80,
    isHidden: false,
    createdAt: '2026-06-08'
  },
  {
    id: 'p4',
    title: '동물 역할놀이 세부 학습지도안',
    category: '학습지도안',
    description: '역할놀이를 통해 협동심을 기를 수 있도록 놀이 단계별 교사의 풍부한 개입 발문 및 지원책을 제공합니다.',
    promptText: '만 3세 유아들이 흥미를 가질 만한 "숲속 꼬마 동물들의 생일파티" 역할놀이 수업안을 만들어줘. 놀이 시작-심화-평가 단계별 유도 질문과 교사의 환경 지원 요소를 꼼꼼히 설계해줘.',
    tags: ['학습지도안', '역할놀이', '사회성', '교사개입'],
    runs: 78,
    satisfaction: 91,
    efficiency: 88,
    isHidden: false,
    createdAt: '2026-06-14'
  },
  {
    id: 'p5',
    title: '친환경 재활용 미술 활동지 원고',
    category: '활동지',
    description: '휴지심과 종이컵을 리사이클링하는 미술 놀이를 유아가 직관적으로 이해할 수 있게 퀴즈 형태로 기획합니다.',
    promptText: '학습지 형태의 미술 활동 가이드를 제안해줘. 주제는 "우주선 휴지심 인형 만들기"이며 단계별 제작 미션을 어린이 눈높이에 맞는 귀여운 그림 묘사 형태로 적어줘.',
    tags: ['활동지', '미술놀이', '친환경', '퀴즈'],
    runs: 110,
    satisfaction: 95,
    efficiency: 76,
    isHidden: false,
    createdAt: '2026-06-05'
  },
  {
    id: 'p6',
    title: '영유아 행동 발달 관찰일지 코멘터',
    category: '관찰일지',
    description: '신체발달, 사회관계, 예술경험 등 누리과정 5개 영역별 핵심 관찰 내용을 바탕으로 정교한 해석을 도출합니다.',
    promptText: '누리과정 기반 관찰 요약문을 작성해줘. 유아 정보: 또래와 장난감 블록을 나누어 쓰는 수준 높은 양보 행동을 보임. 영역: "사회관계", "의사소통" 중심으로 풍부한 긍정적 종합 코멘트를 적어줘.',
    systemGuidance: '너는 아동 행동 발달 전문가 및 심리학 박사야. 누리과정 5대 영역과 아동의 구체적 상호작용 지표를 완벽히 매칭하는 종합 해석문을 학술적이면서도 따뜻한 조언체로 작성하여라.',
    canvasTemplate: '상기 {{유아이름:민철}} 어린이는 평소 또래 소유 장난감이나 블록 도구를 원활히 나누어 쓰며 타인 소통과 갈등 조율 수준이 성숙한 공감 행동을 보여주었습니다. 누리과정의 {{관심영역:사회관계 및 의사소통}} 지표에 대입해볼 때, 우수한 자아조절력을 획득한 단계이며 향후 놀이 그룹의 리더 역할을 정서 피드백과 연계 지도할 수 있는 촉진 환경을 설계하겠습니다.',
    tags: ['관찰일지', '누리과정', '행동분석', '신뢰가득'],
    runs: 232,
    satisfaction: 99,
    efficiency: 95,
    isHidden: false,
    createdAt: '2026-06-16'
  },
  {
    id: 'p7',
    title: '영어 그림책 구연동화 감정 대사 가이드',
    category: '영어 교육',
    description: '원어민 발음 리듬에 맞는 챈트 율동 활용 팁 및 교사용 의태어 가사집을 작성합니다.',
    promptText: '영어 동화 "The Grumpy Caterpillar" 구연 시 아이들의 흥미를 자극할 수 있는 챈트와 율동 가이드, 영아 맞춤식 감정 표현 리스트를 발음 팁과 함께 알려줘.',
    tags: ['영어 교육', '구연동화', '챈트', '영어율동'],
    runs: 64,
    satisfaction: 89,
    efficiency: 78,
    isHidden: false,
    createdAt: '2026-06-15'
  },
  {
    id: 'p8',
    title: '정서 불안 표출 영유아 학부모 맞춤 상담',
    category: '학부모 상담',
    description: '교실에서 부적응 행동(예: 등원 거부, 깨물기)을 보이는 아동의 학부모에게 발송할 공감 중심의 전문 상담 메일 초안을 구성합니다.',
    promptText: '학부모가 상처받지 않으면서도 가정과의 연계 지도가 반드시 필요함을 자연스럽게 어필하는 전문 상담 피드백 편지를 써줘. 아동이 놀이 도중 친구의 영역을 방해하는 경향이 있는 케이스야.',
    systemGuidance: '너는 20년 경력의 유아 발달 행동 치료 연구 센터의 수석 전문 연구원이야. 등원 거부나 친구 방해 등 정서 불안과 적응 지연 행동을 표출하는 아동의 부모 상담 서신을 따뜻한 어조로 가이드하되, 가정과의 즉각적이고 다각적인 치료 연계 지침의 필요성을 부드럽게 설득해라.',
    canvasTemplate: '안녕하십니까, 어머니. 이번 주 교실에서 {{유아이름:서현}}이가 또래의 블록 성 쌓기 영역에 적극 참여하는 도중에 친구들의 동선을 {{표출행동:일시적으로 차단하거나 방해하는}} 행동을 보여 자세히 상담드립니다. 놀이 발달과정 중의 자연스러운 애착 표정이나 불안 완화 작용의 과도기로 분석되오니, 주말 동안 가정에서도 {{가정연계방안:일대일 블록 촉감 맞춤 대화}} 처방법을 동행하시며 아이의 안전 정서를 회복시키는 든든한 등대가 되어주시기를 소망합니다.',
    tags: ['학부모 상담', '상담가이드', '누리과정', '소통'],
    runs: 184,
    satisfaction: 97,
    efficiency: 91,
    isHidden: false,
    createdAt: '2026-06-17'
  }
];

export const INITIAL_PROMPTS: PromptTemplate[] = CUSTOM_PROMPTS.length > 0 ? CUSTOM_PROMPTS : DEFAULT_PROMPTS;

const DEFAULT_DESIGN_PROMPTS: PromptTemplate[] = [
  {
    id: 'dp1',
    title: '가을 학부모 오리엔테이션 Canva 템플릿',
    category: '학부모 교육',
    mainCategory: '원운영',
    description: '가을 학기 학부모 오리엔테이션을 완벽하게 준비하는 Canva 디자인 레이아웃 및 교사 인사말 구성안입니다.',
    promptText: 'Canva에서 사용하기 좋은 가을 오리엔테이션 디자인 서식을 제안해줘. 슬라이드 구성은 "[인사말] -> [교육목표] -> [연간일정] -> [가정연계]" 순서이고, 따뜻한 파스텔 톤 가이드라인을 적어줘.',
    systemGuidance: '너는 캔바(Canva) 템플릿 및 카드뉴스 전문 디자이너이자 교육 기획자야. 시각적 구조와 배치 설명, 텍스트 배치가 완벽한 구성 가이드를 제공하여라.',
    canvasTemplate: '가을 학부모 {{행사명:오리엔테이션}} Canva 프레임 워크입니다. 메인 테마 색상은 #E6C594 바탕에 가을 단풍 무드를 추천합니다. [비주얼 레이블:상단 일러스트]와 함께 {{인사말:안녕하십니까, 햇살반 담임교사입니다.}} 문구를 중앙 정렬로 배치하여 학부모님의 마음을 문으로 이끌어주세요.',
    tags: ['오리엔테이션', 'Canva', 'PPT레이아웃', '학부모 교육'],
    runs: 95,
    satisfaction: 98,
    efficiency: 88,
    isHidden: false,
    createdAt: '2026-06-20'
  },
  {
    id: 'dp2',
    title: '원내 가을 운동회 안내 카드뉴스 배너',
    category: '행사/이벤트',
    mainCategory: '원운영',
    description: '원내 가을 운동회 행사를 학부모님께 눈에 띄게 안내할 수 있는 카드뉴스 및 모바일 배너 세트 디자인 가이드입니다.',
    promptText: '가을 운동회 안내 모바일 배너와 카드뉴스 텍스트 레이아웃을 작성해줘. 필수 포함 항목: 일시, 장소, 준비물, 부모 참가 안내 문구.',
    systemGuidance: '너는 유아 교육 전문 카드뉴스 및 포스터 디자이너야. 모바일 환경에 최적화된 3:4 스케일 가로세로 줄무늬 및 시각 여백을 깔끔하게 살리는 디자인 상세 코디를 추천하여라.',
    canvasTemplate: '가을 맞이 {{이벤트:원내 운동회}} 카드뉴스 레이아웃입니다. 슬라이드 1 카피는 "[가을 운동회 열린다!]"를 볼드 서체로 크게 넣고, 일시인 {{일정:10월 24일 토요일 오전 10시}}는 하단 흰색 둥근 사각형 안에 담으세요. 카드 2에서는 준비물 리스트 {{준비물:운동화 및 간편복}} 문구를 귀여운 아이콘과 병렬 배치하여 가독성을 보강합니다.',
    tags: ['카드뉴스', '배너', '행사/이벤트', 'Canva'],
    runs: 120,
    satisfaction: 94,
    efficiency: 82,
    isHidden: false,
    createdAt: '2026-06-21'
  },
  {
    id: 'dp3',
    title: '🎨 인스타그램 카드뉴스 레이아웃 디자인',
    category: '홍보/안내',
    mainCategory: '기타',
    description: '인스타그램 피드 맞춤형 카드뉴스를 빌드하기 위한 마스터 템플릿입니다.',
    promptText: '인스타그램 카드뉴스 5장 분량 제작 가이드를 빌드해라.',
    systemGuidance: '너는 소셜 미디어 인스타그램 카드뉴스 디자인 가이드 제작자야. 레이아웃과 서체, 색상을 정밀 분석하여 리포트를 제공하라.',
    canvasTemplate: '인스타그램 피드 전용 카드뉴스 시안입니다. 권장되는 제작 {{분량:5장 내외}}을 절대적으로 준수해 주시고, 전체 비주얼 톤앤매너는 {{무드 & 레퍼런스:따뜻하고 부드러운 파스텔}} 감성으로 가공해 주세요. 한편, 디테일한 {{디자인 특성:둥근 테두리와 깔끔한 고딕체}}을 배합하여 가독성과 심미성을 모두 완비해 주시길 권장합니다.',
    tags: ['인스타그램', '디자인', '홍보', '카드뉴스'],
    runs: 184,
    satisfaction: 99,
    efficiency: 95,
    isHidden: false,
    createdAt: '2026-06-25'
  }
];

export const INITIAL_DESIGN_PROMPTS: PromptTemplate[] = CUSTOM_DESIGN_PROMPTS.length > 0 ? CUSTOM_DESIGN_PROMPTS : DEFAULT_DESIGN_PROMPTS;

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 't1',
    name: '김지아 교사',
    badge: '에듀테크 마스터',
    badgeColor: 'mint',
    runs: 148,
    institution: '해오름 유치원'
  },
  {
    id: 't2',
    name: '전소은 교사',
    badge: '소통왕 선임교사',
    badgeColor: 'yellow',
    runs: 125,
    institution: '새싹 어린이집'
  },
  {
    id: 't3',
    name: '박서우 교사',
    badge: '창의활동 개척자',
    badgeColor: 'coral',
    runs: 98,
    institution: '해오름 유치원'
  },
  {
    id: 't4',
    name: '최나경 교사',
    badge: '동료교사 등대',
    badgeColor: 'navy',
    runs: 87,
    institution: '새싹 어린이집'
  }
];

export const CATEGORIES = [
  '전체',
  '원운영',
  '반운영',
  '관찰/평가',
  '기타',
  '지원자료'
];

export const TAGS = [
  '전체',
  '만3세',
  '누리과정',
  '활동안내',
  '소풍안내',
  '생태교육',
  '역할놀이',
  '따뜻한문체',
  '행동분석'
];
