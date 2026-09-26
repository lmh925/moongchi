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
// rarity: common(일반) / rare(레어) / epic(전설). shop: false면 뽑기에서만 나와요.
export const ITEMS = {
  // 강아지 액세서리 - 머리
  ribbon: { name: '분홍 리본', slot: 'head', stage: 0, price: 30, rarity: 'common' },
  sprout: { name: '새싹 핀', slot: 'head', stage: 0, price: 25, rarity: 'common' },
  strawberry: { name: '딸기 모자', slot: 'head', stage: 0, price: 50, rarity: 'common' },
  bear_hat: { name: '곰돌이 모자', slot: 'head', stage: 0, price: 60, rarity: 'common' },
  cat_ears: { name: '고양이 귀 머리띠', slot: 'head', stage: 0, price: null, rarity: 'rare', shop: false },
  bunny_ears: { name: '토끼 귀 머리띠', slot: 'head', stage: 0, price: null, rarity: 'rare', shop: false },
  flower: { name: '꽃 화관', slot: 'head', stage: 1, price: 80, rarity: 'rare' },
  straw_hat: { name: '밀짚모자', slot: 'head', stage: 1, price: 70, rarity: 'common' },
  santa: { name: '산타 모자', slot: 'head', stage: 1, price: null, rarity: 'rare', shop: false },
  wizard: { name: '마법사 모자', slot: 'head', stage: 2, price: 120, rarity: 'rare' },
  crown: { name: '왕관', slot: 'head', stage: 2, price: 150, rarity: 'epic' },
  pirate: { name: '해적 선장 모자', slot: 'head', stage: 0, price: null, rarity: 'epic', shop: false },
  halo: { name: '천사 링', slot: 'head', stage: 0, price: null, rarity: 'epic', shop: false },
  // 목
  bib: { name: '아기 턱받이', slot: 'neck', stage: 0, price: 20, rarity: 'common' },
  bell: { name: '방울 목걸이', slot: 'neck', stage: 0, price: 35, rarity: 'common' },
  scarf: { name: '파랑 목도리', slot: 'neck', stage: 0, price: 45, rarity: 'common' },
  bandana: { name: '빨간 반다나', slot: 'neck', stage: 1, price: 40, rarity: 'common' },
  pearl: { name: '진주 목걸이', slot: 'neck', stage: 0, price: null, rarity: 'rare', shop: false },
  bowtie: { name: '나비넥타이', slot: 'neck', stage: 2, price: 60, rarity: 'rare' },
  medal: { name: '금메달', slot: 'neck', stage: 0, price: null, rarity: 'epic', shop: false },
  // 얼굴
  round_glasses: { name: '동그란 안경', slot: 'face', stage: 0, price: 40, rarity: 'common' },
  heart_glasses: { name: '하트 안경', slot: 'face', stage: 0, price: null, rarity: 'rare', shop: false },
  star_glasses: { name: '별 안경', slot: 'face', stage: 1, price: 60, rarity: 'rare' },
  sunglasses: { name: '선글라스', slot: 'face', stage: 2, price: 80, rarity: 'rare' },
  // 방 가구 - 벽지
  wall_wood: { name: '포근한 나무 벽', slot: 'wallpaper', stage: 0, price: 0, rarity: 'common', shop: false, gacha: false },
  wall_pink: { name: '딸기우유 벽지', slot: 'wallpaper', stage: 0, price: 60, rarity: 'common' },
  wall_mint: { name: '민트 줄무늬 벽지', slot: 'wallpaper', stage: 0, price: 60, rarity: 'common' },
  wall_candy: { name: '사탕 줄무늬 벽지', slot: 'wallpaper', stage: 0, price: 70, rarity: 'common' },
  wall_night: { name: '별밤 벽지', slot: 'wallpaper', stage: 0, price: 100, rarity: 'rare' },
  wall_sky: { name: '구름 하늘 벽지', slot: 'wallpaper', stage: 0, price: null, rarity: 'rare', shop: false },
  wall_forest: { name: '숲속 오두막 벽지', slot: 'wallpaper', stage: 0, price: null, rarity: 'epic', shop: false },
  // 러그
  rug_round: { name: '분홍 동그라미 러그', slot: 'rug', stage: 0, price: 40, rarity: 'common' },
  rug_check: { name: '체크무늬 러그', slot: 'rug', stage: 0, price: 45, rarity: 'common' },
  rug_grass: { name: '잔디 매트', slot: 'rug', stage: 0, price: 50, rarity: 'common' },
  rug_rainbow: { name: '무지개 러그', slot: 'rug', stage: 0, price: 90, rarity: 'rare' },
  rug_star: { name: '별님 러그', slot: 'rug', stage: 0, price: null, rarity: 'rare', shop: false },
  // 침대
  bed_basket: { name: '바구니 침대', slot: 'bed', stage: 0, price: 0, rarity: 'common', shop: false, gacha: false },
  bed_cloud: { name: '구름 침대', slot: 'bed', stage: 0, price: 80, rarity: 'rare' },
  bed_house: { name: '빨간 지붕 집', slot: 'bed', stage: 0, price: 120, rarity: 'rare' },
  bed_tent: { name: '캠핑 텐트', slot: 'bed', stage: 0, price: null, rarity: 'rare', shop: false },
  bed_castle: { name: '공주님 성 침대', slot: 'bed', stage: 0, price: null, rarity: 'epic', shop: false },
  // 장난감
  toy_ball: { name: '통통 공', slot: 'toy', stage: 0, price: 20, rarity: 'common' },
  toy_bone: { name: '뼈다귀 인형', slot: 'toy', stage: 0, price: 30, rarity: 'common' },
  toy_duck: { name: '꽥꽥 오리', slot: 'toy', stage: 0, price: 35, rarity: 'common' },
  toy_bear: { name: '곰돌이 인형', slot: 'toy', stage: 0, price: 60, rarity: 'rare' },
  toy_cactus: { name: '선인장 화분', slot: 'toy', stage: 0, price: null, rarity: 'common', shop: false },
  clover: { name: '네잎클로버 핀', slot: 'head', stage: 0, price: null, rarity: 'rare', shop: false, gacha: false, reward: true },
  toy_rocket: { name: '우주 로켓', slot: 'toy', stage: 0, price: null, rarity: 'epic', shop: false },
};

export const RARITY = {
  common: { name: '일반', weight: 70, refund: 5, color: '#8fb0c8' },
  rare: { name: '레어', weight: 25, refund: 15, color: '#b07cff' },
  epic: { name: '전설', weight: 5, refund: 40, color: '#ffb000' },
};

// 캡슐 뽑기 (현금 결제 없이 게임 코인으로만)
export const GACHA = { price: 30, freePerDay: 1 };

export const DOG_SLOTS = ['head', 'neck', 'face'];
export const ROOM_SLOTS = ['wallpaper', 'rug', 'bed', 'toy'];
export const DEFAULT_OWNED = ['wall_wood', 'bed_basket'];
export const DEFAULT_ROOM = { wallpaper: 'wall_wood', rug: null, bed: 'bed_basket', toy: null };

// 멍뭉 학교 코스 (minutes: 실제 시간 기준)
export const SCHOOL_COURSES = {
  snack: { name: '간식 수업', minutes: 10, coins: 5, exp: 8, trickChance: 0.2, desc: '잠깐 다녀오는 짧은 수업! 간식 예절을 배워요.' },
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

// 함께 등교 (훈련 수업): 선생님 명령에 맞춰 버튼을 눌러 강아지를 훈련해요.
export const TRAINING = {
  rounds: 10,
  targetRounds: 3, // 한 번 수업에서 배울 개인기가 나오는 횟수
  learnHits: 3, // 배울 개인기를 이만큼 성공하면 바로 배워요 (여러 번에 나눠도 돼요)
  minSeconds: 10,
  dailyLimit: 15,
  coinsPerCorrect: 1,
  expPerCorrect: 3,
};

// 조퇴했을 때 선생님 한마디
export const EARLY_COMMENTS = [
  '오늘은 보호자님이 일찍 데리러 오셨어요. 다음엔 끝까지 함께해요!',
  '수업 중간에 집에 갔어요. 친구들이 벌써 보고 싶어 했답니다.',
  '짧았지만 즐거운 시간이었어요. 또 만나요!',
];

// 강아지끼리 친밀도 단계 (같은 방에서 놀수록 올라가요)
export const BOND_LEVELS = [
  { min: 0, name: '처음 만난 사이' },
  { min: 10, name: '아는 사이' },
  { min: 30, name: '친한 친구' },
  { min: 60, name: '단짝' },
  { min: 100, name: '영혼의 단짝' },
];

export const BOND_RULES = {
  together: 1, // 같은 방에 1분 함께 있을 때
  pet: 1, // 친구 강아지를 쓰다듬을 때
  play: 2, // 같이 놀기
  petGapMs: 10_000,
  playGapMs: 20_000,
  dailyCap: 30,
};

// 친구와 실시간 미니게임: 간식 파티 (같은 방에서 30초 동안 간식 먼저 먹기)
export const PARTY = {
  seconds: 30,
  spawnMs: 600,
  treatLifeMs: 6000,
  grabRadius: 0.16, // 바닥 크기를 1로 봤을 때 간식을 먹을 수 있는 거리
  maxCoins: 10,
  winnerBonus: 5,
  dailyCoinCap: 60,
};

// 멍뭉 놀이터 (공개 광장)
export const PLAZA = {
  cap: 20, // 한 놀이터(채널)에 들어갈 수 있는 강아지 수
  worldW: 480,
  worldH: 360,
  speed: 62, // 초당 이동 거리 (월드 픽셀)
  posHz: 10,
  reportBanThreshold: 3, // 서로 다른 친구 3명에게 신고받으면
  banHours: 24, // 하루 동안 놀이터에 못 들어와요
};

// 놀이터 곳곳의 놀이 장소
export const PLAZA_SPOTS = {
  fountain: { name: '분수대', x: 240, y: 176 },
  tag: { name: '술래잡기 마당', x: 392, y: 76, w: 120, h: 96 },
  ribbon: { name: '대왕 선물 상자', x: 104, y: 250, game: 'ribbon' },
  sand: { name: '보물 모래밭', x: 90, y: 110, soon: true },
  soccer: { name: '멍멍 축구장', x: 380, y: 280, soon: true },
};

export const TAG = { seconds: 60, radius: 14, immuneMs: 1500, minPlayers: 2, countdownMs: 4000, coins: 5, coinsPerTag: 2, maxCoins: 15 };

// 2인 협동 미니게임 (공통 규칙)
export const COOP_GAMES = {
  ribbon: {
    name: '으쌰으쌰 대왕 리본 풀기',
    desc: '두 친구가 게이지가 초록 칸에 올 때 동시에 영차! 매듭 3개를 풀면 선물 상자가 팡!',
    timeLimit: 90,
    syncMs: 300,
    stages: [
      { periodMs: 1700, zone: [0.36, 0.64] },
      { periodMs: 1400, zone: [0.39, 0.61] },
      { periodMs: 1150, zone: [0.41, 0.59] },
    ],
    reward: { clear: 12, timeout: 3, item: 'clover' },
  },
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
  minigame: {
    seconds: 30, maxCoins: 15, dailyPlays: 10,
    types: {
      catch: { name: '간식 받아먹기', minSeconds: 27, scorePerCoin: 2, maxScore: 200 },
      run: { name: '멍뭉 런', minSeconds: 5, scorePerCoin: 6, maxScore: 2000 },
    },
  },
};

export const CHAT_MAX_LEN = 20;
