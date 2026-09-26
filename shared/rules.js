// 멍뭉고치 게임 규칙 (순수 함수 — 서버가 최종 판정하고, 브라우저는 화면 표시용으로 사용)
import {
  STAGES, PERSONALITIES, QUIZ, RULES, TRICKS, SCHOOL_COURSES, BREEDS, BOND_LEVELS,
} from './data.js';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
const STATS = ['fullness', 'cleanliness', 'affection'];

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 마지막 갱신 이후 흐른 시간만큼 수치를 천천히 낮춥니다. 학교에 있는 동안은 선생님이 돌봐줘서 줄지 않아요.
export function applyDecay(dog, now, speed = 1) {
  const next = { ...dog };
  const until = dog.school ? Math.min(now, dog.updatedAt) : now;
  const hours = (Math.max(0, until - dog.updatedAt) / HOUR) * speed;
  const mult = PERSONALITIES[dog.personality]?.decay ?? {};
  for (const stat of STATS) {
    const cur = dog[stat];
    if (cur <= RULES.statFloor) continue;
    const drop = RULES.decayPerHour[stat] * (mult[stat] ?? 1) * hours;
    next[stat] = Math.max(RULES.statFloor, cur - drop);
  }
  next.fluff = Math.max(0, (dog.fluff ?? 0) - RULES.fluffDecayPerHour * hours);
  next.updatedAt = Math.max(dog.updatedAt, until);
  return next;
}

export function ageDays(dog, now, speed = 1) {
  return (Math.max(0, now - dog.bornAt) / DAY) * speed;
}

export function computeStage(dog, now, speed = 1) {
  const days = ageDays(dog, now, speed);
  let stage = 0;
  for (const s of STAGES) {
    if (dog.exp >= s.minExp && days >= s.minDays) stage = s.id;
  }
  // 한 번 자란 강아지는 다시 작아지지 않아요
  return Math.max(stage, dog.stage ?? 0);
}

// 다음 성장까지 남은 조건 (UI 진행바용)
export function growthProgress(dog, now, speed = 1) {
  const next = STAGES[dog.stage + 1];
  if (!next) return null;
  const days = ageDays(dog, now, speed);
  return {
    next: next.name,
    exp: dog.exp, needExp: next.minExp,
    days: Math.floor(days), needDays: next.minDays,
    ratio: Math.min(1, dog.exp / next.minExp) * 0.7 + Math.min(1, days / next.minDays) * 0.3,
  };
}

export function mood(dog) {
  if (dog.school) return 'away';
  const low = Math.min(dog.fullness, dog.cleanliness, dog.affection);
  if (low < 35) return 'sad';
  if (low >= 70) return 'happy';
  return 'normal';
}

// 돌봄 액션 결과를 계산합니다. { dog, exp, coins, reaction }
export function applyAction(dog, action) {
  const rule = RULES.actions[action];
  if (!rule) throw new Error('unknown action');
  const before = dog[rule.stat];
  const next = { ...dog };
  if (before >= rule.fullAt) {
    return { dog: next, exp: 0, coins: 0, reaction: 'full' };
  }
  next[rule.stat] = clamp(before + rule.gain, 0, RULES.statMax);
  if (action === 'brush') next.fluff = 100;
  let exp = before < rule.expBelow ? rule.exp : 0;
  const coins = before < rule.coinBelow ? rule.coins : 0;
  const fav = PERSONALITIES[dog.personality]?.favorite === action;
  if (fav) next.affection = clamp(next.affection + RULES.favoriteBonus, 0, RULES.statMax);
  if (fav && exp > 0) exp += 2;
  next.exp = dog.exp + exp;
  return { dog: next, exp, coins, reaction: fav ? 'love' : 'happy' };
}

// 심리테스트 답변(선택지 인덱스 배열) → { personality, breed }
export function quizResult(answers) {
  const p = Object.fromEntries(Object.keys(PERSONALITIES).map((k) => [k, 0]));
  const b = Object.fromEntries(Object.keys(BREEDS).map((k) => [k, 0]));
  QUIZ.forEach((question, i) => {
    const opt = question.options[answers[i]];
    if (!opt) return;
    for (const [k, v] of Object.entries(opt.p)) p[k] += v;
    for (const [k, v] of Object.entries(opt.b)) b[k] += v;
  });
  const top = (scores) => Object.entries(scores).reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  return { personality: top(p), breed: top(b) };
}

export function bondLevel(points) {
  let level = 0;
  BOND_LEVELS.forEach((l, i) => { if (points >= l.min) level = i; });
  return level;
}

export function learnableTricks(dog) {
  return Object.entries(TRICKS)
    .filter(([id, t]) => t.stage <= dog.stage && !dog.tricks.includes(id))
    .map(([id]) => id);
}

export function schoolDurationMs(courseId, speed = 1) {
  return (SCHOOL_COURSES[courseId].minutes * MINUTE) / speed;
}

// 한국 시간 기준 날짜 문자열 (출석 보상, 하루 제한용)
export function kstDate(now) {
  return new Date(now + 9 * HOUR).toISOString().slice(0, 10);
}
