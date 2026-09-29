// 멍뭉고치 게임 규칙 (순수 함수 — 서버가 최종 판정하고, 브라우저는 화면 표시용으로 사용)
import {
  RUNNER, SPECIAL_PERKS, TRAIN_COURSES, TRAIN_LEVEL,
  STAGES, PERSONALITIES, QUIZ, RULES, TRICKS, SCHOOL_COURSES, BREEDS, BOND_LEVELS,
  LEVEL, EMOTES, TALENTS, TALENT_STEPS, TITLES, TRAINING, TREASURE, BOOST_RULES, SPECIALS, POOP, ZODIAC, BIRTH_FLOWERS,
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
    runnerHp: (st.strong >= 5 ? 25 : 0) + (st.strong >= 10 ? 25 : 0) + (special === 'gun' ? 30 : 0),
    // 스페셜 친구 놀이 능력
    runnerMagnet: special === 'mungchi',
    runnerTough: special === 'bbosik',
    runnerStars: special === 'kiriku' ? 2 : 1,
    runnerShield: special === 'gun' ? 1 : 0,
    runnerJumps: special === 'pichu' ? 3 : 2,
    catchReach: special === 'mungchi' ? 6 : special === 'bbosik' ? 4 : 0,
    catchSpeed: special === 'pichu' ? 1.3 : 1,
    expBoost: special ? SPECIAL_PERKS.expBoost : 1,
    learnHits: st.smart >= 5 ? TRAINING.learnHits - 1 : TRAINING.learnHits,
    bondBonus: st.kind >= 5 ? 1 : 0,
    charmProps: st.charm,
    warmRadius: TREASURE.warmRadius + (st.curious >= 5 ? 12 : 0) + (st.curious >= 10 ? 8 : 0) + (special === 'kiriku' ? 8 : 0),
  };
}

// 지금 달 수 있는 칭호 목록
export function unlockedTitles(level, talents = {}, special = null, kids = 0, certs = {}) {
  const st = talentStages(talents);
  return Object.keys(TITLES).filter((id) => {
    const t = TITLES[id];
    if (t.special) return t.special === special;
    if (t.cert) return certs?.[t.cert] === 'master';
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
  // 무늬와 털색은 털색 부모에게서, 몸 모양은 모양 부모에게서 받아요
  const COLOR_KEYS = ['fur', 'furShade', 'furLight', 'accent', 'tanHead', 'pattern', 'eyeColor', 'earColor', 'maskColor', 'spotColor', 'saddleColor', 'socks', 'tailTip'];
  const { geo: _g, fluffBase: _f, topknot: _t, special: _s, ...shape0 } = shape;
  const shapeParams = Object.fromEntries(Object.entries(shape0).filter(([k]) => !COLOR_KEYS.includes(k)));
  const mix = {
    ...shapeParams,
    ...Object.fromEntries(COLOR_KEYS.map((k) => [k, color[k]])),
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
  if (dog.special && exp > 0) exp = specialExp(exp);
  next.exp = dog.exp + exp;
  return { dog: next, exp, coins, reaction: fav ? 'love' : 'happy' };
}

// 심리테스트 답변(선택지 인덱스 배열) → { personality, breed }
// 견종 점수가 같으면 그중에서 골고루(무작위) 골라요 (앞쪽 견종만 나오지 않게)
export function quizResult(answers, rng = Math.random) {
  const p = Object.fromEntries(Object.keys(PERSONALITIES).map((k) => [k, 0]));
  // 스페셜 견종은 이름으로만 만나요 (퀴즈 결과로는 나오지 않아요)
  const b = Object.fromEntries(Object.keys(BREEDS).filter((k) => !BREEDS[k].special).map((k) => [k, 0]));
  QUIZ.forEach((question, i) => {
    const opt = question.options[answers[i]];
    if (!opt) return;
    for (const [k, v] of Object.entries(opt.p)) p[k] += v;
    for (const [k, v] of Object.entries(opt.b)) b[k] += v;
  });
  const top = (scores) => Object.entries(scores).reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  const best = Math.max(...Object.values(b));
  const tied = Object.keys(b).filter((k) => b[k] === best);
  return { personality: top(p), breed: tied[Math.min(tied.length - 1, Math.floor(rng() * tied.length))] };
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

// ---------- 멍뭉런 레벨 ----------
export function runnerLevel(xp = 0) {
  const L = RUNNER.levels;
  let level = 1;
  const at = (n) => (n <= L.length ? L[n - 1] : L[L.length - 1] + (n - L.length) * 1600);
  while (xp >= at(level + 1)) level += 1;
  return { level, into: xp - at(level), need: at(level + 1) - at(level) };
}

export function runnerMaps(runner = {}) {
  const { level } = runnerLevel(runner.xp ?? 0);
  return Object.entries(RUNNER.maps).filter(([, m]) => level >= m.level || (runner.best ?? 0) >= m.best).map(([id]) => id);
}

// 스페셜 친구는 경험치를 20% 더 받아요 (적어도 1 더)
export function specialExp(exp) {
  return exp > 0 ? Math.max(exp + 1, Math.round(exp * SPECIAL_PERKS.expBoost)) : exp;
}
export const expFor = (dog, exp) => (dog?.special ? specialExp(exp) : exp);

// ---------- 훈련 과목 ----------
export function trainLevel(xp = 0) {
  const L = TRAIN_LEVEL.xp;
  let level = 1;
  while (level < L.length && xp >= L[level]) level += 1;
  return { level, into: xp - L[level - 1], need: level < L.length ? L[level] - L[level - 1] : 0, max: level >= L.length };
}

// 오늘의 추천 과목 (한국 날짜마다 바뀌어요)
export function recommendedCourse(dateStr) {
  const keys = Object.keys(TRAIN_COURSES);
  let h = 0;
  for (const ch of String(dateStr)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return keys[h % keys.length];
}

// 지금 볼 수 있는 시험: Lv 3 → 초급, Lv 5 → 마스터 (초급을 먼저 따야 해요)
export function examFor(train = {}, course) {
  const { level } = trainLevel(train.xp?.[course] ?? 0);
  const cert = train.certs?.[course] ?? null;
  if (!cert && level >= 3) return 'basic';
  if (cert === 'basic' && level >= 5) return 'master';
  return null;
}

// ---------- 🎂 생일 ----------
export const kstMMDD = (now) => new Date(now + 9 * 3600_000).toISOString().slice(5, 10);
export function validMMDD(s) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return false;
  const mo = Number(m[1]); const d = Number(m[2]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
}
export function zodiacOf(mmdd) {
  if (!validMMDD(mmdd)) return null;
  let z = ZODIAC[ZODIAC.length - 1]; // 1월 초는 염소자리
  for (const row of ZODIAC) if (mmdd >= row[0]) z = row;
  return { key: z[1], name: z[2], emoji: z[3], trait: z[4] };
}
export const birthFlower = (mmdd) => (validMMDD(mmdd) ? BIRTH_FLOWERS[Number(mmdd.slice(0, 2)) - 1] : null);
// 다음 생일까지 남은 날 (오늘이면 0). 2월 29일은 평년엔 2월 28일에 축하해요
export function daysUntilBirthday(mmdd, now) {
  if (!validMMDD(mmdd)) return null;
  const today = new Date(now + 9 * 3600_000);
  const y = today.getUTCFullYear();
  const t0 = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  const at = (yy) => {
    let [mo, d] = mmdd.split('-').map(Number);
    const leap = (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
    if (mo === 2 && d === 29 && !leap) d = 28;
    return Date.UTC(yy, mo - 1, d);
  };
  let next = at(y);
  if (next < t0) next = at(y + 1);
  return Math.round((next - t0) / 86_400_000);
}
