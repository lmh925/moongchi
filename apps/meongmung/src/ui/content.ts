// 목업 화면에 보여 줄 목록 (출시 범위 기준: 옷·소품 40 / 가구 30 / 미니게임 6)
export const PLACES = [
  { em: '🌳', name: '마당', desc: '땅을 파면 가끔 보물이 나와요', hearts: 10, lock: false },
  { em: '☕', name: '멍뭉 카페', desc: '동물 손님들이 찾아오는 작은 카페', hearts: 25, lock: false },
  { em: '🏫', name: '멍뭉 학교', desc: '선생님과 훈련하고 개인기를 배워요', hearts: 0, lock: false },
  { em: '🏖️', name: '바닷가', desc: '조개를 줍고 모래성을 쌓아요', hearts: 45, lock: true },
  { em: '🏛️', name: '박물관', desc: '주운 것들을 기증하면 전시돼요', hearts: 70, lock: true },
];

export const GAMES = [
  { em: '🏃', name: '멍뭉런', desc: '들판 · 바닷가 · 눈꽃 마을 · 사탕 나라를 달려요', tag: '들어 보기', music: 'run_meadow' },
  { em: '🏖️', name: '멍뭉런: 바닷가', desc: '스테이지 2 배경음', tag: '들어 보기', music: 'run_beach' },
  { em: '❄️', name: '멍뭉런: 눈꽃 마을', desc: '스테이지 3 배경음', tag: '들어 보기', music: 'run_snow' },
  { em: '🍭', name: '멍뭉런: 사탕 나라', desc: '스테이지 4 배경음', tag: '들어 보기', music: 'run_candy' },
  { em: '🍪', name: '간식 받기', desc: '혼자 또는 친구와 떨어지는 간식 받기', tag: '들어 보기', music: 'minigame' },
  { em: '🎓', name: '훈련 수업', desc: '선생님 말에 맞춰 개인기 배우기', tag: '들어 보기', music: 'school' },
  { em: '🛝', name: '멍뭉 놀이터', desc: '친구들과 술래잡기 · 협동 놀이', tag: '들어 보기', music: 'plaza' },
  { em: '🌙', name: '자장가', desc: '밤 9시 이후 우리집 배경음', tag: '들어 보기', music: 'home_night' },
  { em: '🎼', name: '타이틀', desc: '처음 화면 배경음', tag: '들어 보기', music: 'title' },
];

export const DIARY = [
  { em: '📒', name: '알림장', desc: '학교 선생님 한마디' },
  { em: '📔', name: '일기', desc: '오늘 있었던 일' },
  { em: '📅', name: '달력', desc: '처음 한 날들이 자동으로 적혀요' },
  { em: '🏅', name: '배지', desc: '모은 배지와 대표 배지' },
  { em: '📚', name: '도감', desc: '견종 · 아이템 · 채집 도감' },
  { em: '📸', name: '사진관 앨범', desc: '찍은 사진과 자랑 카드' },
];

export const SHOP = [
  { em: '🚫', name: '광고 제거', desc: '광고 없이 놀아요 + 매일 코인 보너스 (한 번 사면 계속)', price: '₩4,900' },
  { em: '❄️', name: '겨울 옷 세트', desc: '눈꽃 스웨터 · 털모자 · 목도리 (무엇을 받는지 그대로)', price: '₩2,500' },
  { em: '🐶', name: '강아지 칸 추가', desc: '레벨 조건 없이 둘째를 입양해요', price: '₩2,500' },
  { em: '🏠', name: '방 확장', desc: '2층 방 또는 마당을 꾸며요', price: '₩3,300' },
  { em: '🎟️', name: '멍뭉 패스 (시즌)', desc: '할 일을 하면 열리는 특별 보상 줄 (자동 결제 없음)', price: '₩4,900' },
];

type Item = { em: string; name: string; price: number; owned?: boolean };
export const CLOSET: Record<'wear' | 'room', Item[]> = {
  wear: [
    { em: '🎀', name: '분홍 리본', price: 30, owned: true }, { em: '🌱', name: '새싹 핀', price: 25 }, { em: '🍓', name: '딸기 모자', price: 50 },
    { em: '🐻', name: '곰돌이 모자', price: 60 }, { em: '🐱', name: '고양이 귀', price: 70 }, { em: '🐰', name: '토끼 귀', price: 70 },
    { em: '🌼', name: '꽃 화관', price: 80 }, { em: '👒', name: '밀짚모자', price: 60 }, { em: '🧙', name: '마법사 모자', price: 90 },
    { em: '👑', name: '왕관', price: 150 }, { em: '🔔', name: '방울 목걸이', price: 35 }, { em: '🧣', name: '파랑 목도리', price: 45 },
    { em: '👓', name: '동그란 안경', price: 40 }, { em: '🕶️', name: '선글라스', price: 80 }, { em: '👕', name: '줄무늬 티셔츠', price: 40 },
    { em: '🧥', name: '딸기우유 후드티', price: 55 }, { em: '🦺', name: '노란 우비', price: 50 }, { em: '👗', name: '꽃무늬 원피스', price: 80 },
    { em: '🐝', name: '꿀벌 옷', price: 90 }, { em: '🦖', name: '공룡 옷', price: 90 }, { em: '🦸', name: '히어로 망토', price: 120 },
  ],
  room: [
    { em: '🧺', name: '바구니 침대', price: 0, owned: true }, { em: '☁️', name: '구름 침대', price: 120 }, { em: '🏠', name: '빨간 지붕 집', price: 150 },
    { em: '⛺', name: '캠핑 텐트', price: 130 }, { em: '🛋️', name: '말랑 소파', price: 90 }, { em: '📚', name: '책장', price: 70 },
    { em: '💡', name: '스탠드 조명', price: 60 }, { em: '🪴', name: '커다란 화분', price: 50 }, { em: '🌈', name: '무지개 러그', price: 100 },
    { em: '🐾', name: '발바닥 러그', price: 60 }, { em: '⚽', name: '통통 공', price: 20 }, { em: '🦆', name: '꽥꽥 오리', price: 30 },
  ],
};
