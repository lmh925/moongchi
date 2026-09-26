// 멍뭉고치 게임 데이터 (서버와 브라우저가 함께 사용)

export const STAGES = [
  { id: 0, key: 'baby', name: '아기', minExp: 0, minDays: 0 },
  { id: 1, key: 'kid', name: '꼬마', minExp: 150, minDays: 3 },
  { id: 2, key: 'adult', name: '늠름한 강아지', minExp: 500, minDays: 7 },
];

// 견종: 색상과 생김새 파라미터는 sprites.js에서 픽셀 아트로 그려집니다.
export const BREEDS = {
  bichon: {
    name: '비숑 프리제',
    desc: '구름 솜사탕처럼 몽실몽실한 하얀 털뭉치예요.',
    fur: '#fbf7ef', furShade: '#e3d9c9', furLight: '#ffffff', accent: null,
    ear: 'hidden', coat: 'curly', tail: 'plume', legs: 'normal', snout: 'short', headFluff: 2,
  },
  pomeranian: {
    name: '포메라니안',
    desc: '여우 같은 얼굴에 사자 갈기처럼 풍성한 털을 가졌어요.',
    fur: '#f2a444', furShade: '#d27f25', furLight: '#ffc877', accent: '#ffe2b0',
    ear: 'pointySmall', coat: 'fluffy', tail: 'curl', legs: 'normal', snout: 'tiny', headFluff: 1,
  },
  poodle: {
    name: '토이 푸들',
    desc: '곱슬곱슬 초코 푸딩 색 털과 긴 귀가 매력이에요.',
    fur: '#b87a4b', furShade: '#8f5a33', furLight: '#d49a6a', accent: null,
    ear: 'longCurly', coat: 'curly', tail: 'pompom', legs: 'long', snout: 'normal', headFluff: 1,
  },
  maltese: {
    name: '말티즈',
    desc: '새하얀 비단결 털과 까만 콩 같은 눈이 반짝여요.',
    fur: '#ffffff', furShade: '#e6e1ea', furLight: '#ffffff', accent: null,
    ear: 'longSilky', coat: 'silky', tail: 'plume', legs: 'normal', snout: 'short', headFluff: 0,
  },
  corgi: {
    name: '웰시코기',
    desc: '짧은 다리로 뽈뽈뽈! 식빵 같은 엉덩이가 자랑이에요.',
    fur: '#e8923a', furShade: '#c06f22', furLight: '#f7b366', accent: '#fff6e8',
    ear: 'pointyBig', coat: 'smooth', tail: 'stub', legs: 'short', snout: 'long', headFluff: 0,
  },
  shiba: {
    name: '시바견',
    desc: '돌돌 말린 꼬리와 웃는 얼굴의 씩씩한 친구예요.',
    fur: '#d9803c', furShade: '#b3622a', furLight: '#eba062', accent: '#fff1dc',
    ear: 'pointy', coat: 'smooth', tail: 'curl', legs: 'normal', snout: 'normal', headFluff: 0,
  },
};

// 성격: decay는 시간당 수치 감소 배율, favorite은 좋아하는 돌봄(애정도 보너스)
export const PERSONALITIES = {
  sleepy: {
    name: '잠꾸러기', emoji: '💤',
    desc: '틈만 나면 꾸벅꾸벅~ 푹신한 침대를 제일 좋아해요.',
    decay: { fullness: 0.8, cleanliness: 0.8, affection: 0.8 }, favorite: 'pet', speed: 0.7, napChance: 0.35,
  },
  hyper: {
    name: '천방지축', emoji: '⚡',
    desc: '온 방을 뛰어다니는 에너자이저! 금방 꼬질꼬질해져요.',
    decay: { fullness: 1.1, cleanliness: 1.4, affection: 1.0 }, favorite: 'brush', speed: 1.6, napChance: 0.05,
  },
  foodie: {
    name: '먹보', emoji: '🍖',
    desc: '밥그릇 소리만 들려도 꼬리가 프로펠러가 돼요.',
    decay: { fullness: 1.4, cleanliness: 1.0, affection: 0.9 }, favorite: 'feed', speed: 1.0, napChance: 0.15,
  },
  sweet: {
    name: '애교쟁이', emoji: '💕',
    desc: '졸졸 따라다니며 쓰다듬어 달라고 해요.',
    decay: { fullness: 1.0, cleanliness: 1.0, affection: 1.3 }, favorite: 'pet', speed: 1.1, napChance: 0.1,
  },
  shy: {
    name: '수줍음쟁이', emoji: '🌸',
    desc: '처음엔 부끄러워하지만 친해지면 누구보다 다정해요.',
    decay: { fullness: 0.9, cleanliness: 0.9, affection: 1.1 }, favorite: 'brush', speed: 0.8, napChance: 0.2,
  },
  smart: {
    name: '똑똑이', emoji: '🎓',
    desc: '한 번 배운 건 절대 안 잊어요. 학교를 제일 좋아해요!',
    decay: { fullness: 1.0, cleanliness: 1.0, affection: 1.0 }, favorite: 'feed', speed: 1.0, napChance: 0.1,
  },
};

// 도입부 심리테스트: 각 선택지가 성격/견종 점수를 더합니다.
export const QUIZ = [
  {
    q: '주말 아침! 눈을 떴을 때 가장 하고 싶은 일은?',
    options: [
      { text: '이불 속에서 5분만 더… 쿨쿨', p: { sleepy: 3 }, b: { bichon: 2, maltese: 1 } },
      { text: '벌떡 일어나서 밖으로 뛰어나가기!', p: { hyper: 3 }, b: { corgi: 2, shiba: 1 } },
      { text: '맛있는 아침밥 먹기', p: { foodie: 3 }, b: { corgi: 1, pomeranian: 1 } },
      { text: '재미있는 책 읽기', p: { smart: 3 }, b: { poodle: 2 } },
    ],
  },
  {
    q: '친구들과 놀 때 나는 어떤 친구일까?',
    options: [
      { text: '먼저 다가가서 꼭 안아주는 친구', p: { sweet: 3 }, b: { maltese: 2, bichon: 1 } },
      { text: '새로운 놀이를 만드는 친구', p: { smart: 2, hyper: 1 }, b: { poodle: 1, shiba: 1 } },
      { text: '조용히 옆에서 웃어주는 친구', p: { shy: 3 }, b: { maltese: 1, bichon: 1 } },
      { text: '간식을 나눠주는 친구', p: { foodie: 2, sweet: 1 }, b: { pomeranian: 2 } },
    ],
  },
  {
    q: '마법 구름을 탈 수 있다면 어디로 갈까?',
    options: [
      { text: '솜사탕 구름 나라', p: { sweet: 1, sleepy: 1 }, b: { bichon: 3 } },
      { text: '끝없는 초록 들판', p: { hyper: 2 }, b: { corgi: 3 } },
      { text: '반짝이는 별빛 도서관', p: { smart: 2 }, b: { poodle: 3 } },
      { text: '단풍잎이 춤추는 숲', p: { shy: 1, hyper: 1 }, b: { shiba: 3 } },
    ],
  },
  {
    q: '가장 좋아하는 간식은?',
    options: [
      { text: '폭신폭신 딸기 케이크', p: { sweet: 2 }, b: { maltese: 2 } },
      { text: '바삭바삭 고구마 칩', p: { foodie: 2 }, b: { shiba: 2 } },
      { text: '말랑말랑 마시멜로', p: { sleepy: 2 }, b: { bichon: 2 } },
      { text: '새콤달콤 귤', p: { hyper: 1, smart: 1 }, b: { pomeranian: 2 } },
    ],
  },
  {
    q: '비가 오는 날, 창밖을 보며 드는 생각은?',
    options: [
      { text: '빗소리 들으며 낮잠 자고 싶다~', p: { sleepy: 3 }, b: { maltese: 1 } },
      { text: '장화 신고 웅덩이에서 첨벙첨벙!', p: { hyper: 2 }, b: { corgi: 1, pomeranian: 1 } },
      { text: '누가 우산을 같이 써줬으면…', p: { shy: 2, sweet: 1 }, b: { bichon: 1, poodle: 1 } },
      { text: '비는 왜 내릴까? 궁금해!', p: { smart: 3 }, b: { poodle: 1, shiba: 1 } },
    ],
  },
];

export const TRICKS = {
  sit: { name: '앉아', stage: 0, desc: '얌전히 엉덩이를 붙여요.' },
  paw: { name: '손!', stage: 0, desc: '작은 앞발을 쏙 내밀어요.' },
  spin: { name: '빙글빙글', stage: 0, desc: '제자리에서 한 바퀴 뱅그르르~' },
  jump: { name: '점프', stage: 1, desc: '높이높이 폴짝!' },
  bow: { name: '인사', stage: 1, desc: '꾸벅~ 공손하게 인사해요.' },
  roll: { name: '데굴데굴', stage: 1, desc: '바닥을 데굴데굴 굴러요.' },
  dance: { name: '춤추기', stage: 2, desc: '두 발로 서서 신나게 춤춰요.' },
  bang: { name: '빵야!', stage: 2, desc: '빵야! 하면 쓰러지는 연기 천재.' },
  sing: { name: '노래하기', stage: 2, desc: '아우~ 멋진 노래를 불러요.' },
};

// 성장할 때 선물로 배우는 개인기
export const STAGE_GIFT_TRICK = { 1: 'jump', 2: 'dance' };
export const STARTING_TRICKS = ['sit'];

// 꾸미기 아이템: 강아지 액세서리(head/neck/face)와 방 가구(wallpaper/rug/bed/toy)
export const ITEMS = {
  // 강아지 액세서리
  ribbon: { name: '분홍 리본', slot: 'head', stage: 0, price: 30 },
  bib: { name: '아기 턱받이', slot: 'neck', stage: 0, price: 20 },
  strawberry: { name: '딸기 모자', slot: 'head', stage: 0, price: 50 },
  bandana: { name: '빨간 반다나', slot: 'neck', stage: 1, price: 40 },
  star_glasses: { name: '별 안경', slot: 'face', stage: 1, price: 60 },
  flower: { name: '꽃 화관', slot: 'head', stage: 1, price: 80 },
  straw_hat: { name: '밀짚모자', slot: 'head', stage: 1, price: 70 },
  bowtie: { name: '나비넥타이', slot: 'neck', stage: 2, price: 60 },
  sunglasses: { name: '선글라스', slot: 'face', stage: 2, price: 80 },
  wizard: { name: '마법사 모자', slot: 'head', stage: 2, price: 120 },
  crown: { name: '왕관', slot: 'head', stage: 2, price: 150 },
  // 방 가구
  wall_wood: { name: '포근한 나무 벽', slot: 'wallpaper', stage: 0, price: 0 },
  wall_pink: { name: '딸기우유 벽지', slot: 'wallpaper', stage: 0, price: 60 },
  wall_mint: { name: '민트 줄무늬 벽지', slot: 'wallpaper', stage: 0, price: 60 },
  wall_night: { name: '별밤 벽지', slot: 'wallpaper', stage: 0, price: 100 },
  rug_round: { name: '분홍 동그라미 러그', slot: 'rug', stage: 0, price: 40 },
  rug_grass: { name: '잔디 매트', slot: 'rug', stage: 0, price: 50 },
  rug_rainbow: { name: '무지개 러그', slot: 'rug', stage: 0, price: 90 },
  bed_basket: { name: '바구니 침대', slot: 'bed', stage: 0, price: 0 },
  bed_cloud: { name: '구름 침대', slot: 'bed', stage: 0, price: 80 },
  bed_house: { name: '빨간 지붕 집', slot: 'bed', stage: 0, price: 120 },
  toy_ball: { name: '통통 공', slot: 'toy', stage: 0, price: 20 },
  toy_bone: { name: '뼈다귀 인형', slot: 'toy', stage: 0, price: 30 },
  toy_bear: { name: '곰돌이 인형', slot: 'toy', stage: 0, price: 60 },
};

export const DOG_SLOTS = ['head', 'neck', 'face'];
export const ROOM_SLOTS = ['wallpaper', 'rug', 'bed', 'toy'];
export const DEFAULT_OWNED = ['wall_wood', 'bed_basket'];
export const DEFAULT_ROOM = { wallpaper: 'wall_wood', rug: null, bed: 'bed_basket', toy: null };

// 멍뭉 학교 코스 (minutes: 실제 시간 기준)
export const SCHOOL_COURSES = {
  walk: { name: '산책 수업', minutes: 30, coins: 15, exp: 20, trickChance: 0.5, desc: '동네 한 바퀴! 친구들과 함께 걸어요.' },
  play: { name: '놀이 수업', minutes: 60, coins: 30, exp: 40, trickChance: 0.8, desc: '공놀이, 숨바꼭질! 신나게 놀아요.' },
  manner: { name: '예절 수업', minutes: 180, coins: 80, exp: 100, trickChance: 1.0, desc: '선생님께 새로운 개인기를 꼭 배워와요.' },
};

export const REPORT_SUBJECTS = ['친구 사귀기', '집중력', '달리기', '간식 예절'];

// 알림장 선생님 한마디 (성격별)
export const TEACHER_COMMENTS = {
  sleepy: [
    '오늘은 낮잠 시간에 제일 먼저 잠들었어요. 코 고는 소리가 너무 귀여웠답니다!',
    '수업 중에 살짝 졸았지만, 깨어나서는 누구보다 열심히 했어요.',
    '햇살 드는 창가 자리를 찜했어요. 다음엔 조금만 덜 졸기로 약속했답니다.',
  ],
  hyper: [
    '운동장을 스무 바퀴나 뛰었어요! 에너지가 넘치는 하루였답니다.',
    '친구들에게 달리기 시합을 신청했어요. 모두 신났어요!',
    '신나게 놀다가 흙탕물에 퐁당! 그래도 웃는 얼굴이 최고였어요.',
  ],
  foodie: [
    '간식 시간에 제일 반짝이는 눈이었어요. 예절도 잘 지켰답니다!',
    '점심을 싹싹 비웠어요. 친구에게 간식을 나눠주기도 했어요.',
    '간식 냄새를 맡고 제일 먼저 달려왔어요. 코가 정말 좋아요!',
  ],
  sweet: [
    '선생님 무릎에 쏙 올라와서 애교를 부렸어요. 모두의 인기 스타!',
    '새로 온 친구에게 먼저 꼬리를 흔들어 줬어요. 정말 다정해요.',
    '오늘 받은 쓰다듬기가 백 번은 넘을 거예요!',
  ],
  shy: [
    '처음엔 구석에 숨어 있었지만, 금방 친구와 함께 놀았어요. 용기 최고!',
    '작은 목소리로 "멍" 하고 대답했어요. 한 걸음 성장했어요.',
    '조용히 친구 옆을 지켜주는 멋진 모습을 보여줬어요.',
  ],
  smart: [
    '새로운 개인기를 한 번에 따라 했어요! 선생님도 깜짝 놀랐답니다.',
    '친구들에게 앉아! 를 가르쳐 주는 꼬마 선생님이었어요.',
    '퍼즐 장난감을 제일 먼저 풀었어요. 반짝반짝 똑똑이!',
  ],
};

// 채팅: 표정 스티커와 정해진 문장
export const STICKERS = {
  heart: '하트', laugh: '웃음', sweat: '땀방울', sparkle: '반짝',
  surprise: '깜짝', sleepy: '쿨쿨', tear: '눈물', note: '음표',
};

export const PHRASES = [
  '안녕! 반가워!',
  '놀러와 줘서 고마워!',
  '우리 강아지 귀엽지?',
  '같이 놀자!',
  '너무 귀여워!',
  '최고야!',
  '또 놀러 올게!',
  '잘 가~ 안녕!',
];

// 밸런스 수치
export const RULES = {
  statMax: 100,
  statFloor: 20, // 아무리 방치해도 이 아래로는 떨어지지 않아요 (강아지는 아프거나 떠나지 않아요)
  decayPerHour: { fullness: 5, cleanliness: 3, affection: 4 },
  fluffDecayPerHour: 200, // 빗질로 뽕긋해진 털은 30분 정도 유지돼요
  actions: {
    feed: { stat: 'fullness', gain: 30, exp: 10, coins: 2, expBelow: 90, coinBelow: 80, fullAt: 95 },
    brush: { stat: 'cleanliness', gain: 25, exp: 8, coins: 2, expBelow: 90, coinBelow: 80, fullAt: 101 },
    pet: { stat: 'affection', gain: 10, exp: 3, coins: 1, expBelow: 90, coinBelow: 60, fullAt: 101 },
  },
  favoriteBonus: 5, // 좋아하는 돌봄을 받으면 애정도가 추가로 올라요
  dailyCoins: 20,
  startingCoins: 50,
  minigame: { seconds: 30, maxCoins: 15, dailyPlays: 10 },
};

export const CHAT_MAX_LEN = 20;
