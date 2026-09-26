// 멍뭉고치 게임 데이터 (서버와 브라우저가 함께 사용)

export const STAGES = [
  { id: 0, key: 'baby', name: '아기', minLevel: 1, minDays: 0 },
  { id: 1, key: 'kid', name: '꼬마', minLevel: 5, minDays: 3 },
  { id: 2, key: 'adult', name: '늠름한 강아지', minLevel: 12, minDays: 7 },
];

// ---------- 레벨 ----------
// 경험치가 쌓이면 레벨이 올라요 (끝없이). 다음 레벨까지 필요한 경험치는 조금씩 늘어나요.
// Lv 5 ≈ 경험치 150 (꼬마), Lv 12 ≈ 경험치 500 (늠름한 강아지)
export const LEVEL = {
  needBase: 30,
  needPerLevel: 2.5,
  needCurveFrom: 11, // 이 레벨부터는 조금 더 가파르게
  needCurve: 0.5,
  coinsBase: 10, // 레벨업 보상 코인 = coinsBase + 레벨
  ticketEvery: 3, // 3레벨마다 무료 캡슐 뽑기권
  frameEvery: 10, // 10레벨마다 이름표 테두리가 바뀌어요
};

// 레벨로 배우는 놀이터 몸짓 (기본: 멍!/점프/인사/빙글)
export const EMOTES = {
  bark: { name: '멍!', level: 1 },
  jump: { name: '점프', level: 1 },
  wave: { name: '인사', level: 1 },
  spin: { name: '빙글', level: 1 },
  roll: { name: '데굴', level: 5 },
  dance: { name: '춤', level: 10 },
  bang: { name: '빵야', level: 15 },
  sing: { name: '노래', level: 20 },
};

// ---------- 재능 능력치 ----------
// 싸우는 힘이 아니라 "우리 강아지는 이런 걸 잘해!" 하는 개성이에요. 절대 줄어들지 않아요.
export const TALENTS = {
  strong: { name: '튼튼', color: '#ff8a5c', desc: '멍뭉런, 축구, 술래잡기, 산책 수업을 하면 자라요.', icon: 'paw' },
  smart: { name: '똑똑', color: '#5b8cff', desc: '훈련과 학교 수업을 하면 자라요.', icon: 'star' },
  kind: { name: '다정', color: '#ff6f91', desc: '친구와 놀기, 협동 게임, 쓰다듬기로 자라요.', icon: 'heart' },
  charm: { name: '멋짐', color: '#b07cff', desc: '꾸미기, 빗질, 매너 수업으로 자라요.', icon: 'sparkle' },
  curious: { name: '호기심', color: '#3fb58a', desc: '보물찾기, 간식 받기 놀이, 캡슐 뽑기로 자라요.', icon: 'clover' },
};
// 단계(1~10)마다 필요한 누적 점수
export const TALENT_STEPS = [0, 8, 20, 36, 56, 80, 110, 146, 188, 236];
export const TALENT_DAILY_CAP = 20; // 재능 하나당 하루에 오를 수 있는 점수
export const TALENT_PERSONALITY = { hyper: 'strong', smart: 'smart', shy: 'kind', sweet: 'charm', sleepy: 'charm', foodie: 'curious' };
export const TALENT_PERSONALITY_BONUS = 1.2;
// 단계별 효과 (혼자 하는 놀이에만. 겨루는 놀이에는 효과가 없어요)
export const TALENT_PERKS = {
  strong: [{ stage: 5, text: '멍뭉런 체력 +25' }, { stage: 10, text: '멍뭉런 체력 +25 더!' }],
  smart: [{ stage: 5, text: '개인기를 2번만 성공해도 배워요' }],
  kind: [{ stage: 5, text: '친구와 친밀도가 조금 더 빨리 올라요' }],
  charm: [{ stage: 3, text: '포토부스 천사 링·진주·새싹 소품' }, { stage: 6, text: '포토부스 해적·곰돌이 모자·목도리 소품' }],
  curious: [{ stage: 5, text: '보물 "따뜻해요" 힌트 범위가 넓어져요' }, { stage: 10, text: '힌트 범위가 더 넓어져요' }],
};
// 활동별 재능 점수
export const TALENT_GAINS = {
  feed: {}, brush: { charm: 2 }, pet: { kind: 1 },
  school: { snack: { smart: 3, curious: 1 }, walk: { strong: 4 }, play: { strong: 3, kind: 1 }, manner: { smart: 3, charm: 2 } },
  equip: { charm: 1 },
  gacha: { curious: 2 },
  visit: { kind: 2 },
  coop: { kind: 4 },
  soccer: { strong: 4 },
  tag: { strong: 3 },
  treasure: { curious: 4 },
};
// 여럿이 하는 놀이의 경험치
export const PLAY_EXP = { coop: 8, soccer: 6, tag: 4, treasure: 4, party: 4 };

// 칭호: 레벨이나 재능으로 얻고, 강아지 카드에서 골라 달아요. 놀이터에서는 레벨 대신 칭호가 보여요.
export const TITLES = {
  sprout: { name: '새싹 멍뭉이', level: 1 },
  brave: { name: '씩씩한 꼬마', level: 5 },
  walker: { name: '산책 대장', level: 10 },
  star: { name: '놀이터 스타', level: 20 },
  doctor: { name: '멍뭉 박사', level: 30 },
  super: { name: '반짝반짝 슈퍼스타', level: 40 },
  legend: { name: '전설의 멍뭉이', level: 50 },
  runner: { name: '달리기 선수', talent: 'strong', stage: 7 },
  genius: { name: '척척박사', talent: 'smart', stage: 7 },
  bestie: { name: '다정한 단짝', talent: 'kind', stage: 7 },
  fashion: { name: '패션 리더', talent: 'charm', stage: 7 },
  explorer: { name: '보물 탐험가', talent: 'curious', stage: 7 },
  sp_mungchi: { name: '구름 뭉치', special: 'mungchi' },
  sp_bbosik: { name: '다정한 거인', special: 'bbosik' },
  sp_kiriku: { name: '모험가 키리쿠', special: 'kiriku' },
  sp_gun: { name: '씩씩한 대장 건', special: 'gun' },
  sp_pichu: { name: '애교 막내 피츄', special: 'pichu' },
};

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
  // ---------- 스페셜 캐릭터 (특별한 이름을 지어 주면 나타나요) ----------
  mini_bichon: {
    name: '미니비숑', special: true,
    desc: '다 자라도 아기만 한, 세상에서 제일 작은 구름 뭉치예요.',
    fur: '#fffdf8', furShade: '#eae1d3', furLight: '#ffffff', accent: null,
    ear: 'hidden', coat: 'curly', tail: 'plume', legs: 'normal', snout: 'short', headFluff: 3, geo: 'mini', fluffBase: 1,
  },
  big_maltese: {
    name: '빅말티', special: true,
    desc: '보통 말티즈보다 훨씬 큰, 바닥까지 찰랑이는 털의 순둥한 거인이에요.',
    fur: '#ffffff', furShade: '#e4dfe9', furLight: '#ffffff', accent: null,
    ear: 'longSilky', coat: 'silky', tail: 'plume', legs: 'long', snout: 'short', headFluff: 1, geo: 'big',
  },
  yorkie_kiriku: {
    name: '요크셔테리어', special: true,
    desc: '은빛 푸른 털과 황금빛 얼굴의 모험가 요키. 초록 리본이 트레이드마크!',
    fur: '#6d7a8e', furShade: '#566276', furLight: '#8e9bb0', accent: '#d9a05f',
    ear: 'pointy', coat: 'silky', tail: 'short', legs: 'normal', snout: 'normal', headFluff: 0, tanHead: true, topknot: '#3fb58a',
  },
  yorkie_gun: {
    name: '요크셔테리어', special: true,
    desc: '은빛 푸른 털과 황금빛 얼굴의 씩씩한 대장 요키. 파란 리본이 트레이드마크!',
    fur: '#667387', furShade: '#505c70', furLight: '#8794a9', accent: '#d39a58',
    ear: 'pointy', coat: 'silky', tail: 'short', legs: 'normal', snout: 'normal', headFluff: 0, tanHead: true, topknot: '#4f86ff',
  },
  yorkie_pichu: {
    name: '요크셔테리어', special: true,
    desc: '은빛 푸른 털과 황금빛 얼굴의 애교 막내 요키. 분홍 리본이 트레이드마크!',
    fur: '#717e92', furShade: '#5a6679', furLight: '#93a0b4', accent: '#e0a868',
    ear: 'pointySmall', coat: 'silky', tail: 'short', legs: 'normal', snout: 'short', headFluff: 0, tanHead: true, topknot: '#ff6f9c', geo: 'small',
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
  jumprope: { name: '줄넘기 터', x: 150, y: 298, game: 'jumprope' },
  cushion: { name: '쿠션 탑 놀이터', x: 318, y: 212, game: 'cushion' },
  bakery: { name: '멍뭉 간식 공장', x: 420, y: 212, game: 'bakery' },
  tidy: { name: '장난감 방', x: 184, y: 104, game: 'tidy' },
  sand: { name: '보물 모래밭', x: 91, y: 119, w: 68, h: 38 },
  soccer: { name: '멍멍 축구장', x: 380, y: 280, w: 160, h: 88 },
};

export const TREASURE = {
  max: 3, // 모래밭에 한 번에 숨어 있는 보물 수
  spawnMs: 12000,
  findRadius: 11,
  hotRadius: 22,
  warmRadius: 40,
  digGapMs: 700,
  helperMs: 10000, // 최근 10초 안에 같이 판 친구도 선물을 받아요
  dailyCoins: 60,
  kinds: {
    coin: { name: '뼈다귀 코인 주머니', coins: 3, weight: 70 },
    bone: { name: '황금 뼈다귀', coins: 6, weight: 22 },
    capsule: { name: '반짝 캡슐', coins: 4, weight: 8, item: true },
  },
};

export const SOCCER = {
  seconds: 90,
  countdownMs: 4000,
  goalHalf: 13, // 골대 입구 절반 높이
  touchRadius: 10,
  kickRadius: 16,
  touchSpeed: 95,
  kickSpeed: 175,
  friction: 0.55, // 1초에 남는 속도 비율
  coins: { win: 8, draw: 6, lose: 5, perGoal: 1 },
  dailyCoins: 60,
  teams: { pink: '핑크팀', blue: '파랑팀' },
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
  jumprope: {
    name: '깡총깡총 실시간 줄넘기',
    desc: '밧줄이 발밑에 올 때 두 친구가 각자 톡! 둘 다 뛰어야 넘어가요. 20번 넘으면 성공!',
    timeLimit: 120,
    goal: 20,
    lives: 3,
    startPeriodMs: 1600,
    minPeriodMs: 800,
    speedupEvery: 5,
    speedupMs: 120,
    windowMs: 220,
    minWindowMs: 150,
    graceMs: 180, // 네트워크 지연을 감안해 판정을 조금 기다려요
    reward: { clear: 12, perCombo: 0.4 },
  },
  cushion: {
    name: '영차영차 쿠션 탑 쌓기',
    desc: '방장은 떨어지는 쿠션을 옮겨 탑을 쌓고, 손님은 쿠션을 밟고 올라가 선반 위 뼈다귀를 잡아요!',
    timeLimit: 150,
    roles: { p1: '쿠션 담당', p2: '등반 담당' },
    reward: { clear: 14, timeout: 3 },
  },
  bakery: {
    name: '우당탕탕 수제 간식 공장',
    desc: '방장은 빵을 굽고, 손님은 생크림과 과일을 올려 포장해요. 60초 동안 주문을 많이 완성해요!',
    timeLimit: 60,
    roles: { p1: '빵 굽기', p2: '토핑 얹기' },
    reward: { base: 3, perCake: 1, max: 14 },
  },
  tidy: {
    name: '장난감 방 정리 정돈',
    desc: '어질러진 장난감을 제자리에! 공은 노란 바구니, 뼈다귀는 파란 상자, 인형은 침대 위로.',
    timeLimit: 240,
    roles: { p1: '같이 정리', p2: '같이 정리' },
    reward: { clear: 10, timeout: 4 },
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

// ---------- 오늘의 약속 (하루 3개) + 7칸 도장판 ----------
// group마다 하나씩 뽑아요: 돌봄(care) · 놀이(play) · 바깥(out)
export const QUESTS = {
  feed: { text: '밥 주기 2번', n: 2, group: 'care' },
  brush: { text: '빗질해 주기', n: 1, group: 'care' },
  pet: { text: '쓰다듬기 3번', n: 3, group: 'care' },
  trick: { text: '개인기 보여 주기', n: 1, group: 'care' },
  school: { text: '학교 보내기', n: 1, group: 'play' },
  train: { text: '훈련 수업 1번', n: 1, group: 'play' },
  run: { text: '멍뭉런 1판', n: 1, group: 'play' },
  catch: { text: '간식 받기 놀이 1판', n: 1, group: 'play' },
  plaza: { text: '놀이터 놀러 가기', n: 1, group: 'out' },
  dig: { text: '보물 모래밭 3번 파 보기', n: 3, group: 'out' },
  visit: { text: '친구 집 놀러 가기', n: 1, group: 'out', needFriend: true },
  equip: { text: '꾸미기 바꿔 보기', n: 1, group: 'out' },
};
export const STAMP = {
  card: 7, // 7칸을 채우면 특별 캡슐! (하루 빠져도 모은 도장은 그대로예요)
  questCoins: 5, // 약속 하나 지킬 때마다
};
export const SPECIAL_CAPSULE = { rare: 80, epic: 20 }; // 특별 캡슐 확률 (희귀 이상만)

// ---------- 배지 ----------
// stat: 모은 횟수(여러 개면 합), special: 따로 계산하는 조건
export const BADGES = {
  carer: { name: '돌봄 천사', desc: '밥·빗질·쓰다듬기 50번', icon: 'heart', color: '#ff6f91', stat: ['feed', 'brush', 'pet'], n: 50 },
  scholar: { name: '모범생', desc: '학교 10번 다녀오기', icon: 'star', color: '#5b8cff', stat: ['school'], n: 10 },
  trainer: { name: '훈련 대장', desc: '훈련 수업 20번', icon: 'star', color: '#3fb58a', stat: ['train'], n: 20 },
  runner: { name: '멍뭉런 달인', desc: '멍뭉런 10판', icon: 'paw', color: '#ff8a5c', stat: ['run'], n: 10 },
  catcher: { name: '간식 사냥꾼', desc: '간식 받기 놀이 10판', icon: 'food', color: '#ffb84d', stat: ['catch'], n: 10 },
  digger: { name: '보물 사냥꾼', desc: '보물 10개 찾기', icon: 'coin', color: '#d9a400', stat: ['treasure'], n: 10 },
  teamwork: { name: '환상의 짝꿍', desc: '협동 게임 10번 성공', icon: 'heart', color: '#ff5d7a', stat: ['coop'], n: 10 },
  coopAll: { name: '협동 마스터', desc: '협동 게임 5종 모두 성공', icon: 'sparkle', color: '#b07cff', special: 'coopAll', n: 5 },
  striker: { name: '골잡이', desc: '축구에서 골 5개', icon: 'paw', color: '#5b8cff', stat: ['goal'], n: 5 },
  tagger: { name: '술래잡기 왕', desc: '술래잡기 10판', icon: 'paw', color: '#e84a5f', stat: ['tag'], n: 10 },
  visitor: { name: '마실 대장', desc: '친구 집 10번 놀러 가기', icon: 'heart', color: '#3fb58a', stat: ['visit'], n: 10 },
  gacha: { name: '뽑기 요정', desc: '캡슐 뽑기 20번', icon: 'sparkle', color: '#ff9fb8', stat: ['gacha'], n: 20 },
  promise: { name: '약속 지킴이', desc: '도장판 한 장 다 채우기', icon: 'star', color: '#ffd23f', stat: ['stampCard'], n: 1 },
  letters: { name: '편지 친구', desc: '강아지 편지 10통 읽기', icon: 'mail', color: '#ff9fb8', stat: ['letter'], n: 10 },
  tricks: { name: '개인기 스타', desc: '개인기 모두 배우기', icon: 'star', color: '#ff8a5c', special: 'tricks' },
  collector: { name: '수집가', desc: '아이템 도감 절반 채우기', icon: 'book', color: '#6cc070', special: 'items' },
  breeds: { name: '견종 박사', desc: '모든 견종 친구 만나기', icon: 'book', color: '#5b8cff', special: 'breeds' },
  level10: { name: '쑥쑥 Lv 10', desc: '레벨 10 되기', icon: 'medal', color: '#ffd23f', special: 'level', n: 10 },
  level20: { name: '반짝 Lv 20', desc: '레벨 20 되기', icon: 'medal', color: '#b07cff', special: 'level', n: 20 },
  talent: { name: '재능 꽃', desc: '재능 하나를 10단계로', icon: 'sparkle', color: '#3fb58a', special: 'talent', n: 10 },
  legends: { name: '전설의 친구들', desc: '스페셜 강아지 5마리 모두 만나기', icon: 'star', color: '#ff9fe0', special: 'specials', n: 5 },
  trio: { name: '요크 삼형제 모임', desc: '키리쿠·건·피츄가 한자리에', icon: 'heart', color: '#6d7a8e', stat: ['trio'], n: 1 },
  trader: { name: '멍뭉 상인', desc: '친구와 거래 5번 하기', icon: 'coin', color: '#3fb58a', stat: ['trade'], n: 5 },
};
export const BADGE_COINS = 20; // 배지를 얻으면 받는 코인
export const SHOWCASE_MAX = 3; // 강아지 카드에 다는 대표 배지 수

// ---------- 강아지 편지 ----------
// 한동안 못 만났다가 돌아오면 강아지가 편지를 남겨요 (벌이 아니라 궁금함!). {name} = 강아지, {owner} = 보호자 닉네임
export const LETTER = {
  awayMs: 4 * 3600_000, // 이만큼 떨어져 있다 오면
  gapMs: 4 * 3600_000, // 편지는 이 간격보다 자주 오지 않아요
  maxUnread: 3,
  giftChance: 0.6,
  itemChance: 0.12,
};
export const LETTERS = {
  any: [
    '{owner}에게! 오늘 창밖에서 노랑나비를 봤어. 너한테 보여 주고 싶어서 꼬리를 막 흔들었어!',
    '{owner}, 내 밥그릇 옆에 반짝이는 걸 찾았어. 선물로 줄게! 우리 내일도 같이 놀자.',
    '있잖아 {owner}, 꿈에서 너랑 구름 위를 뛰어다녔어. 구름은 솜사탕 맛이었어!',
    '{owner}가 없는 동안 방을 지켰어. 문 소리 날 때마다 너인 줄 알고 달려갔어 멍!',
    '오늘 놀이터에서 새 친구 냄새가 났어. 다음에 같이 가 보자, {owner}!',
    '{owner}, 내가 제일 좋아하는 건… 비밀이야! 힌트: 지금 이 편지를 읽고 있는 사람!',
    '빗방울 소리를 들으면서 낮잠을 잤어. 일어나 보니 {owner} 생각이 났어.',
    '{owner}에게. 오늘 공을 굴리다가 침대 밑에 들어가 버렸어. 꺼내 줄 수 있어?',
    '{owner}, 소문 들었어? 구름보다 작은 비숑이 있대… 이름이 "ㅁㅊ"래!',
    '놀이터에서 요크셔테리어 삼형제 소문을 들었어. ㅋㄹㅋ, ㄱ, ㅍㅊ… 누구일까?',
    '{owner}, 엄청 커다란 말티즈가 있다는 소문이 있어. 이름이 "ㅃㅅㅇ"래. 만나 보고 싶다!',
  ],
  sp_mungchi: ['{owner}, 나 오늘도 안 컸어! 헤헤. 작아서 침대 밑 탐험은 내가 최고야. 구름 뭉치 뭉치가.', '바람이 불어서 데굴데굴 굴러갔어. 나 진짜 구름인가 봐, {owner}!'],
  sp_bbosik: ['{owner}… 나 또 커졌어. 문에 머리 쿵 했어 헤헤. 그래도 안아 줄 거지?', '오늘 작은 친구들을 등에 태워 줬어. 다정한 거인 뽀식이는 힘이 세!'],
  sp_kiriku: ['{owner}, 오늘 마당 끝까지 탐험했어! 보물 냄새가 났는데… 내일 같이 찾으러 가자!', '형제들이랑 숨바꼭질했는데 내가 다 찾았어. 모험가 키리쿠의 코는 최고야!'],
  sp_gun: ['{owner}! 오늘도 집을 씩씩하게 지켰어. 대장 건에게 맡겨! 경례!', '막내가 울길래 내가 달래 줬어. 대장은 멋있어야 하거든, {owner}.'],
  sp_pichu: ['{owner}~ 형아들이 나만 귀여워해 헤헤. 너도 나 귀엽지? 꼬리 프로펠러 빙글빙글!', '피츄는 {owner}가 세상에서 제일 좋아! 쓰다듬어 주면 하트가 퐁퐁 나와!'],
  sleepy: ['{owner}… 쿨쿨… 꿈에서 너랑 산책했어… 일어나면 진짜로 가자… 쿨…', '베개가 너무 폭신해서 {owner} 기다리다 잠들었어. 미안해 헤헤.'],
  hyper: ['{owner}!!! 방을 100바퀴 뛰었어!!! 너 오면 101바퀴 같이 뛰자!!!', '오늘 내 꼬리 잡기 신기록 세웠어! {owner}도 봤어야 했는데!'],
  foodie: ['{owner}, 부엌에서 맛있는 냄새가 났어… 혹시 나 주려고 만든 거야? 킁킁.', '간식 창고 지도를 그렸어! 보물 지도야. 같이 찾으러 가자 {owner}!'],
  sweet: ['{owner} 보고 싶어서 네 양말을 꼭 안고 있었어. 빨리 와서 쓰다듬어 줘!', '오늘도 {owner}가 세상에서 제일 좋아. 내일도, 모레도!'],
  shy: ['{owner}… 사실 할 말이 있었는데… 좋아한다고… 헤헤 말해 버렸다.', '오늘 처음 보는 새가 인사해서 깜짝 놀랐어. 그래도 용기 내서 멍! 했어.'],
  smart: ['{owner}, 오늘 혼자 "앉아"를 100번 연습했어. 이제 눈 감고도 할 수 있어!', '책장에 있는 책 냄새를 다 맡아 봤어. 제일 재밌는 책은 {owner} 사진첩!'],
  welcome: ['{owner}, 우리 오늘부터 가족이야! 매일매일 같이 놀자. 가끔 편지를 써서 우편함에 넣어 둘게!'],
};

// ---------- 학교 시간 아이템 ----------
// 셔틀버스표는 코인으로 사고, 모래시계는 선물로만 받아요 (환영 편지, 도장판 완성, 5레벨마다, 가끔 편지).
export const SCHOOL_BOOSTS = {
  bus: { name: '슝슝 셔틀버스표', desc: '남은 수업 시간이 절반으로 줄어요.', price: 15, icon: 'bus' },
  hourglass: { name: '반짝 모래시계', desc: '수업이 바로 끝나요! 선물도 다 받아요.', price: null, icon: 'hourglass' },
};
export const BOOST_RULES = {
  dailyUses: 3, // 하루에 쓸 수 있는 횟수 (두 아이템 합쳐서)
  maxHold: 9, // 한 종류당 가질 수 있는 최대 개수
  hourglassEvery: 5, // 이 레벨마다 모래시계 선물
  letterBusChance: 0.15, // 선물 편지에 셔틀버스표가 들어 있을 확률
};

// ---------- 스페셜 캐릭터 (이스터에그) ----------
// 강아지 이름을 이렇게 지어 주면 누구나 스페셜 친구로 변신해요. 가족 계정은 원조 코드로 "👑 원조" 표시를 받아요.
export const SPECIALS = {
  mungchi: {
    name: '뭉치', breed: 'mini_bichon', label: '전설의 미니비숑', title: '구름 뭉치', trick: 'cloudroll', hint: 'ㅁㅊ',
    perk: '빗질을 안 해도 늘 뽀송뽀송 몽실몽실해요',
  },
  bbosik: {
    name: '뽀식이', breed: 'big_maltese', label: '전설의 빅말티', title: '다정한 거인', trick: 'bighug', hint: 'ㅃㅅㅇ',
    perk: '쓰다듬으면 애정도가 조금 더 올라요',
  },
  kiriku: {
    name: '키리쿠', breed: 'yorkie_kiriku', label: '요크 삼형제 · 모험가', title: '모험가 키리쿠', trick: 'sniff', hint: 'ㅋㄹㅋ', trio: true,
    perk: '보물찾기 "따뜻해요" 힌트 범위가 넓어져요',
  },
  gun: {
    name: '건', breed: 'yorkie_gun', label: '요크 삼형제 · 대장', title: '씩씩한 대장 건', trick: 'salute', hint: 'ㄱ', trio: true,
    perk: '멍뭉런 체력 +15',
  },
  pichu: {
    name: '피츄', breed: 'yorkie_pichu', label: '요크 삼형제 · 막내', title: '애교 막내 피츄', trick: 'propeller', hint: 'ㅍㅊ', trio: true,
    perk: '쓰다듬으면 하트가 두 배로 퐁퐁',
  },
};
export const SPECIAL_TRICKS = {
  cloudroll: { name: '구름 데굴데굴', desc: '몸을 동그랗게 말고 구름처럼 데굴데굴~' },
  bighug: { name: '왕 포옹', desc: '커다란 몸으로 폭! 안아 줘요.' },
  sniff: { name: '킁킁 탐험', desc: '킁킁… 여기다! 보물 냄새를 찾아요.' },
  salute: { name: '멋진 경례', desc: '앞발을 척! 씩씩하게 경례해요.' },
  propeller: { name: '꼬리 프로펠러', desc: '꼬리를 빙글빙글 돌려서 날아오를 것 같아요!' },
};
export const RENAME_PRICE = 30; // 이름표 바꾸기

// ---------- 둘째 입양 ----------
// 강아지 중 한 마리라도 이 레벨이 되면 입양 칸이 하나씩 열려요 (최대 3마리)
export const ADOPT = { slotLevels: [10, 25], inactiveDecay: 0.5 };

// ---------- 멍뭉거래 (친구끼리 소품·옷 바꾸기) ----------
// 안전장치: 친구끼리만, 아이템끼리만(코인 거래 없음), 둘 다 확인해야 성사, 하루 횟수 제한,
// 받은 아이템은 하루 동안 다시 거래 못 해요(되팔기·속이기 방지), 착용 중인 건 못 내놓아요.
export const TRADE = {
  maxItems: 3, // 한쪽이 내놓을 수 있는 아이템 수
  dailyTrades: 5, // 하루에 성사되는 거래 수 (한 사람 기준)
  maxPending: 3, // 동시에 보낼 수 있는 제안 수
  expireMs: 24 * 3600_000, // 제안은 하루 뒤 사라져요
  lockMs: 24 * 3600_000, // 받은 아이템은 하루 동안 다시 거래 못 해요
  value: { common: 1, rare: 3, epic: 8 }, // 공평한지 알려 줄 때 쓰는 점수
  unfairRatio: 2.5, // 한쪽이 이만큼 더 많이 주면 "정말 괜찮아요?" 확인
};
