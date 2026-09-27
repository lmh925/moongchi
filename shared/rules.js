// 멍뭉고치 게임 규칙 (순수 함수 — 서버가 최종 판정하고, 브라우저는 화면 표시용으로 사용)
import {
  STAGES, PERSONALITIES, QUIZ, RULES, TRICKS, SCHOOL_COURSES, BREEDS, BOND_LEVELS,
  LEVEL, EMOTES, TALENTS, TALENT_STEPS, TITLES, TRAINING, TREASURE, BOOST_RULES, SPECIALS, POOP,
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
    const poops = stat === 'cleanliness' ? (dog.poop?.list?.length ?? 0) : 0; // 똥을 오래 두면 청결도가 더 빨리 줄어요
    const drop = RULES.decayPerHour[stat] * (mult[stat] ?? 1) * (1 + poops * POOP.decayBoost) * hours;
    next[stat] = Math.max(RULES.statFloor, cur - drop);
  }
  next.fluff = Math.max(0, (dog.fluff ?? 0) - RULES.fluffDecayPerHour * hours);
  next.updatedAt = Math.max(dog.updatedAt, until);
  return next;
}

// 함께한 날: 한국 시간 자정이 지날 때마다 하루씩 늘어요 (밤 9시에 입양해도 다음 날 아침엔 1일)
// GAME_SPEED로 빠르게 돌릴 때(개발용)는 흐른 시간 그대로 세요.
export function ageDays(dog, now, speed = 1) {
  if (speed !== 1) return (Math.max(0, now - dog.bornAt) / DAY) * speed;
  const midnight = (t) => Math.floor((t + 9 * HOUR) / DAY);
  return Math.max(0, midnight(now) - midnight(dog.bornAt));
}

// ---------- 레벨 ----------
// level → level+1 에 필요한 경험치
export function expToNext(level) {
  const extra = Math.max(0, level - LEVEL.needCurveFrom);
  return Math.round(LEVEL.needBase + LEVEL.needPerLevel * level + LEVEL.needCurve * extra * extra);
}

// 누적 경험치 → { level, into(이번 레벨에서 모은 양), need(다음 레벨까지 필요한 양) }
export function levelInfo(exp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(exp || 0));
  while (rest >= expToNext(level) && level < 999) { rest -= expToNext(level); level += 1; }
  return { level, into: rest, need: expToNext(level) };
}
export const levelFromExp = (exp) => levelInfo(exp).level;

// 이 레벨에 도달하면 받는 선물
export function levelRewards(level) {
  const emotes = Object.entries(EMOTES).filter(([, e]) => e.level === level && level > 1).map(([id]) => id);
  const titles = Object.entries(TITLES).filter(([, t]) => t.level === level && level > 1).map(([id]) => id);
  return {
    coins: LEVEL.coinsBase + level,
    tickets: level % LEVEL.ticketEvery === 0 ? 1 : 0,
    emotes,
    titles,
    frame: level % LEVEL.frameEvery === 0 ? frameTier(level) : 0,
    hourglass: level % BOOST_RULES.hourglassEvery === 0 ? 1 : 0,
  };
}

// 이름표 테두리 단계 (0~5)
export const frameTier = (level) => Math.min(5, Math.floor(level / LEVEL.frameEvery));

export const unlockedEmotes = (level) => Object.keys(EMOTES).filter((id) => EMOTES[id].level <= level);

// ---------- 재능 ----------
export function talentStage(points) {
  let stage = 1;
  TALENT_STEPS.forEach((min, i) => { if ((points ?? 0) >= min) stage = i + 1; });
  return stage;
}

export function talentStages(talents = {}) {
  return Object.fromEntries(Object.keys(TALENTS).map((k) => [k, talentStage(talents[k] ?? 0)]));
}

// 재능 단계에 따른 작은 효과 (혼자 하는 놀이 / 협동 놀이에만). special: 스페셜 캐릭터 효과
export function talentEffects(talents = {}, special = null) {
  const st = talentStages(talents);
  return {
    runnerHp: (st.strong >= 5 ? 25 : 0) + (st.strong >= 10 ? 25 : 0) + (special === 'gun' ? 15 : 0),
    learnHits: st.smart >= 5 ? TRAINING.learnHits - 1 : TRAINING.learnHits,
    bondBonus: st.kind >= 5 ? 1 : 0,
    charmProps: st.charm,
    warmRadius: TREASURE.warmRadius + (st.curious >= 5 ? 12 : 0) + (st.curious >= 10 ? 8 : 0) + (special === 'kiriku' ? 8 : 0),
  };
}

// 지금 달 수 있는 칭호 목록
export function unlockedTitles(level, talents = {}, special = null, kids = 0) {
  const st = talentStages(talents);
  return Object.keys(TITLES).filter((id) => {
    const t = TITLES[id];
    if (t.special) return t.special === special;
    if (t.parent) return kids > 0;
    return t.talent ? st[t.talent] >= t.stage : level >= t.level;
  });
}

// 견종 정보. 'mix:털색견종:모양견종'은 두 부모를 반씩 닮은 믹스견이에요 (아기 강아지 선물).
const mixCache = new Map();
export function breedOf(id) {
  if (BREEDS[id]) return BREEDS[id];
  if (typeof id !== 'string' || !id.startsWith('mix:')) return null;
  if (mixCache.has(id)) return mixCache.get(id);
  const [, colorId, shapeId] = id.split(':');
  const color = BREEDS[colorId]; const shape = BREEDS[shapeId];
  if (!color || !shape) return null;
  const { geo: _g, fluffBase: _f, topknot: _t, special: _s, ...shapeParams } = shape;
  const mix = {
    ...shapeParams,
    fur: color.fur, furShade: color.furShade, furLight: color.furLight, accent: color.accent, tanHead: color.tanHead,
    name: `믹스견 (${color.name.replace(' 프리제', '')}×${shape.name.replace(' 프리제', '')})`,
    desc: '두 부모 강아지를 반씩 닮은, 세상에 하나뿐인 믹스 강아지예요.',
    mix: true,
  };
  mixCache.set(id, mix);
  return mix;
}

// 이름 → 스페셜 캐릭터 (띄어쓰기는 무시해요)
export function specialForName(name) {
  const n = String(name ?? '').replace(/\s+/g, '');
  return Object.keys(SPECIALS).find((k) => SPECIALS[k].name === n) ?? null;
}

export function computeStage(dog, now, speed = 1) {
  const days = ageDays(dog, now, speed);
  const level = levelFromExp(dog.exp);
  let stage = 0;
  for (const s of STAGES) {
    if (level >= s.minLevel && days >= s.minDays) stage = s.id;
  }
  // 한 번 자란 강아지는 다시 작아지지 않아요
  return Math.max(stage, dog.stage ?? 0);
}

// 다음 성장까지 남은 조건 (UI 진행바용)
export function growthProgress(dog, now, speed = 1) {
  const next = STAGES[dog.stage + 1];
  if (!next) return null;
  const days = ageDays(dog, now, speed);
  const level = levelFromExp(dog.exp);
  return {
    next: next.name,
    level, needLevel: next.minLevel,
    days: Math.floor(days), needDays: next.minDays,
    ratio: Math.min(1, level / next.minLevel) * 0.7 + Math.min(1, days / next.minDays) * 0.3,
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
  // 뽀식이(빅말티)는 쓰다듬으면 애정도가 조금 더
  if (action === 'pet' && dog.special === 'bbosik') next.affection = clamp(next.affection + 3, 0, RULES.statMax);
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
