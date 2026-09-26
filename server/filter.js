// 아이들을 위한 채팅/닉네임 안전 필터
import { CHAT_MAX_LEN } from '../shared/data.js';

const BAD_WORDS = [
  '시발', '씨발', '씨바', '시바ㄹ', '씹', 'ㅅㅂ', 'ㅆㅂ', 'ㅅ ㅂ', '병신', '븅신', 'ㅂㅅ', '개새', '새끼', 'ㅅㄲ',
  '존나', '졸라', 'ㅈㄴ', '좆', '지랄', 'ㅈㄹ', '미친', 'ㅁㅊ', '닥쳐', '꺼져', '죽어', '죽을래', '뒤져', '디져',
  '엠창', '엄창', '느금', '니애미', '니미', '애미', '애비', '썅', '염병', '등신', '찐따', '장애인',
  '섹스', '야동', 'fuck', 'shit', 'bitch', 'sex', 'damn',
];

// 개인정보/외부 연락 유도 단어
const PRIVATE_WORDS = [
  '카톡', '카카오', '인스타', '페북', '페이스북', '틱톡', '디엠', 'dm', '라인아이디', '오픈채팅', '톡방',
  '전화', '전번', '폰번', '번호', '주소', '사는곳', '어디살', '몇동', '몇호', '아파트', '공일공', '010',
  'http', 'www', '.com', '.kr', '.net', '@',
];

function normalize(text) {
  return text.toLowerCase().replace(/[\s~!?.,·_\-*^'"()[\]{}<>/\\|=+:;`]/g, '');
}

export function checkText(raw, { maxLen = CHAT_MAX_LEN } = {}) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: '내용을 입력해 주세요.' };
  if (text.length > maxLen) return { ok: false, reason: `${maxLen}글자까지만 쓸 수 있어요.` };
  const flat = normalize(text);
  if (BAD_WORDS.some((w) => flat.includes(normalize(w)) || text.includes(w))) {
    return { ok: false, reason: '고운 말을 써 주세요! 강아지들이 깜짝 놀라요.' };
  }
  const digits = text.replace(/[\s\-.]/g, '');
  if (/\d{3,}/.test(digits) || PRIVATE_WORDS.some((w) => flat.includes(normalize(w)))) {
    return { ok: false, reason: '전화번호, 주소 같은 비밀 정보는 쓸 수 없어요.' };
  }
  return { ok: true, text };
}

export function checkNickname(raw) {
  const nickname = String(raw ?? '').trim();
  if (!/^[가-힣a-zA-Z0-9]{2,8}$/.test(nickname)) {
    return { ok: false, reason: '닉네임은 한글, 영어, 숫자로 2~8글자로 지어 주세요.' };
  }
  const res = checkText(nickname, { maxLen: 8 });
  if (!res.ok) return { ok: false, reason: '다른 닉네임을 골라 주세요.' };
  return { ok: true, nickname };
}

export function checkDogName(raw) {
  const name = String(raw ?? '').trim();
  if (!/^[가-힣a-zA-Z0-9 ]{1,8}$/.test(name)) {
    return { ok: false, reason: '이름은 한글, 영어로 1~8글자로 지어 주세요.' };
  }
  const res = checkText(name, { maxLen: 8 });
  if (!res.ok) return { ok: false, reason: '다른 이름을 지어 주세요.' };
  return { ok: true, name };
}
