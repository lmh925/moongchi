// 강아지/유저 데이터 로직 (서버가 최종 판정)
import crypto from 'node:crypto';
import {
  PERSONALITIES, BREEDS, RULES, SCHOOL_COURSES, REPORT_SUBJECTS, TEACHER_COMMENTS, EARLY_COMMENTS, TRICKS,
  STAGE_GIFT_TRICK, STARTING_TRICKS, ITEMS, RARITY, GACHA, TRAINING, DOG_SLOTS, ROOM_SLOTS, DEFAULT_OWNED, DEFAULT_ROOM, STAGES,
  SPECIAL_CAPSULE, SPECIALS, RENAME_PRICE, ADOPT, FOOD, TREATS, TREAT_RULES, POOP, SCHOOL_BOOSTS, BOOST_RULES, TALENTS, TALENT_DAILY_CAP, TALENT_PERSONALITY, TALENT_PERSONALITY_BONUS, TALENT_GAINS, TALENT_PERKS, TITLES, RUNNER,
} from '../shared/data.js';
import {
  applyDecay, computeStage, applyAction, learnableTricks, schoolDurationMs, kstDate, growthProgress, mood,
  specialForName, levelInfo, levelFromExp, levelRewards, talentStage, talentStages, talentEffects, unlockedTitles, unlockedEmotes, frameTier, runnerLevel, runnerMaps,
} from '../shared/rules.js';
import { tx } from './db.js';

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

function rowToDog(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    breed: row.breed,
    personality: row.personality,
    fullness: row.fullness,
    cleanliness: row.cleanliness,
    affection: row.affection,
    fluff: row.fluff,
    exp: row.exp,
    stage: row.stage,
    tricks: JSON.parse(row.tricks),
    equip: JSON.parse(row.equip),
    school: row.school ? JSON.parse(row.school) : null,
    bornAt: row.born_at,
    updatedAt: row.updated_at,
    level: row.level || levelFromExp(row.exp),
    talents: JSON.parse(row.talents ?? '{}'),
    talentDay: JSON.parse(row.talent_day ?? '{}'),
    title: row.title ?? null,
    special: row.special ?? null,
    baseBreed: row.base_breed ?? null,
    original: !!row.original,
    poop: JSON.parse(row.poop ?? '{}'),
    parents: row.parents ? JSON.parse(row.parents) : null,
    kids: row.kids ?? 0,
  };
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    nickname: row.nickname,
    friendCode: row.friend_code,
    coins: row.coins,
    owned: JSON.parse(row.owned),
    room: { ...DEFAULT_ROOM, ...JSON.parse(row.room) },
    lastDaily: row.last_daily,
    minigameDate: row.minigame_date,
    minigamePlays: row.minigame_plays,
    gachaDate: row.gacha_date,
    trainProgress: JSON.parse(row.train_progress ?? '{}'),
    gachaTickets: row.gacha_tickets ?? 0,
    boosts: JSON.parse(row.boosts ?? '{}'),
    boostDay: JSON.parse(row.boost_day ?? '{}'),
    kibble: row.kibble ?? FOOD.kibbleMax,
    kibbleAt: row.kibble_at ?? null,
    treats: JSON.parse(row.treats ?? '{}'),
    runner: { xp: 0, best: 0, plays: 0, ...JSON.parse(row.runner ?? '{}') },
  };
}

export class Game {
  constructor(db, { speed = 1, now = () => Date.now(), rng = Math.random } = {}) {
    this.db = db;
    this.speed = speed;
    this.now = now;
    this.rng = rng;
  }

  // ---------- 유저 ----------
  getUser(userId) {
    return rowToUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId));
  }

  getUserByCode(code) {
    return rowToUser(this.db.prepare('SELECT * FROM users WHERE friend_code = ?').get(String(code).toUpperCase()));
  }

  addCoins(userId, amount) {
    if (!amount) return;
    this.db.prepare('UPDATE users SET coins = MAX(0, coins + ?) WHERE id = ?').run(amount, userId);
  }

  // 하루 한 번 출석 보상
  claimDaily(userId) {
    const today = kstDate(this.now());
    const res = this.db.prepare('UPDATE users SET last_daily = ?, coins = coins + ? WHERE id = ? AND (last_daily IS NULL OR last_daily <> ?)')
      .run(today, RULES.dailyCoins, userId, today);
    return res.changes > 0 ? RULES.dailyCoins : 0;
  }

  // ---------- 강아지 ----------
  loadDog(userId) {
    // 대표 강아지 (여러 마리면 users.active_dog, 없으면 첫째)
    return rowToDog(this.db.prepare(`SELECT d.* FROM dogs d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?
      ORDER BY (d.id = u.active_dog) DESC, d.id LIMIT 1`).get(userId));
  }

  loadDogById(dogId) {
    return rowToDog(this.db.prepare('SELECT * FROM dogs WHERE id = ?').get(dogId));
  }

  loadDogs(userId) {
    return this.db.prepare('SELECT * FROM dogs WHERE user_id = ? ORDER BY id').all(userId).map(rowToDog);
  }

  // ---------- 둘째 입양 ----------
  dogSlots(userId) {
    const dogs = this.loadDogs(userId);
    const best = Math.max(0, ...dogs.map((d) => levelFromExp(d.exp)));
    const max = 1 + ADOPT.slotLevels.filter((lv) => best >= lv).length;
    const next = ADOPT.slotLevels.find((lv) => best < lv) ?? null;
    return { used: dogs.length, max, nextLevel: dogs.length && next ? next : null, best };
  }

  dogList(userId) {
    const active = this.loadDog(userId)?.id;
    return this.loadDogs(userId).map((d) => ({
      id: d.id, name: d.name, breed: d.breed, stage: d.stage, equip: d.equip, level: levelFromExp(d.exp),
      special: d.special, original: d.original, active: d.id === active, atSchool: !!d.school,
    }));
  }

  // 대표 강아지 바꾸기. 쉬고 있던 동안은 수치가 절반 속도로만 줄어요.
  switchDog(userId, dogId) {
    const target = this.loadDogById(Number(dogId));
    if (!target || target.userId !== userId) throw new GameError('우리 집 강아지가 아니에요.');
    const current = this.loadDog(userId);
    if (current?.id === target.id) throw new GameError('이미 대표 강아지예요!');
    this.refreshDog(userId); // 지금 대표의 상태를 저장해 둬요
    const now = this.now();
    if (!target.school) {
      const rested = applyDecay(target, now, this.speed * ADOPT.inactiveDecay);
      this.saveDog(rested);
    }
    this.db.prepare('UPDATE users SET active_dog = ? WHERE id = ?').run(target.id, userId);
    return this.refreshDog(userId);
  }

  // 대표가 아닌 강아지가 학교에서 돌아올 시간이 됐으면 하교시켜요
  refreshOthers(userId) {
    const active = this.loadDog(userId)?.id;
    const now = this.now();
    const events = [];
    for (const d of this.loadDogs(userId)) {
      if (d.id === active || !d.school || now < d.school.endsAt) continue;
      tx(this.db, () => {
        const { dog, report, events: grew } = this.finishSchool(d);
        this.saveDog(dog);
        events.push(...grew, { type: 'schoolDone', report });
      });
    }
    return events;
  }

  saveDog(dog) {
    this.db.prepare(`UPDATE dogs SET fullness=?, cleanliness=?, affection=?, fluff=?, exp=?, stage=?, tricks=?, equip=?, school=?, updated_at=?,
      level=?, talents=?, talent_day=?, title=?, name=?, breed=?, special=?, base_breed=?, original=?, poop=? WHERE id=?`)
      .run(dog.fullness, dog.cleanliness, dog.affection, dog.fluff, dog.exp, dog.stage,
        JSON.stringify(dog.tricks), JSON.stringify(dog.equip), dog.school ? JSON.stringify(dog.school) : null,
        dog.updatedAt, dog.level, JSON.stringify(dog.talents ?? {}), JSON.stringify(dog.talentDay ?? {}), dog.title ?? null,
        dog.name, dog.breed, dog.special ?? null, dog.baseBreed ?? null, dog.original ? 1 : 0, JSON.stringify(dog.poop ?? {}), dog.id);
  }

  createDog(userId, { name, breed, personality }) {
    if (!BREEDS[breed] || !PERSONALITIES[personality]) throw new GameError('강아지 정보가 올바르지 않아요.');
    const slots = this.dogSlots(userId);
    if (slots.used >= slots.max) {
      throw new GameError(slots.nextLevel ? `강아지가 Lv ${slots.nextLevel}이 되면 새 친구를 입양할 수 있어요.` : '더 이상 입양할 수 없어요.');
    }
    const now = this.now();
    this.db.prepare(`INSERT INTO dogs (user_id, name, breed, personality, fullness, cleanliness, affection, fluff, exp, stage, tricks, equip, born_at, updated_at, level, title)
      VALUES (?, ?, ?, ?, 80, 80, 60, 0, 0, 0, ?, '{}', ?, ?, 1, 'sprout')`)
      .run(userId, name, breed, personality, JSON.stringify(STARTING_TRICKS), now, now);
    const newId = this.db.prepare('SELECT MAX(id) AS id FROM dogs WHERE user_id = ?').get(userId).id;
    if (slots.used) this.refreshDog(userId); // 첫째 상태를 저장하고
    this.db.prepare('UPDATE users SET active_dog = ? WHERE id = ?').run(newId, userId); // 새 친구가 대표가 돼요
    const dog = this.loadDogById(newId);
    this.applySpecial(dog, specialForName(name));
    this.saveDog(dog);
    return dog;
  }

  // 아기 강아지 선물: 믹스 견종도 괜찮아요. 새 아기가 대표가 돼요.
  createBaby(userId, { name, breed, personality, parents }) {
    const now = this.now();
    const res = this.db.prepare(`INSERT INTO dogs (user_id, name, breed, personality, fullness, cleanliness, affection, fluff, exp, stage, tricks, equip, born_at, updated_at, level, title, parents)
      VALUES (?, ?, ?, ?, 80, 80, 70, 0, 0, 0, ?, '{}', ?, ?, 1, 'sprout', ?)`)
      .run(userId, name, breed, personality, JSON.stringify(STARTING_TRICKS), now, now, JSON.stringify(parents ?? null));
    const id = Number(res.lastInsertRowid);
    this.db.prepare('UPDATE users SET active_dog = ? WHERE id = ?').run(id, userId);
    const dog = this.loadDogById(id);
    this.applySpecial(dog, specialForName(name));
    this.saveDog(dog);
    return dog;
  }

  // ---------- 스페셜 캐릭터 ----------
  // 이름이 스페셜 이름이면 변신, 아니면 원래 견종으로 돌아가요. 바뀐 게 있으면 이벤트를 돌려줘요.
  applySpecial(dog, key) {
    if ((dog.special ?? null) === (key ?? null)) return null;
    const from = dog.special;
    if (key) {
      if (!dog.special) dog.baseBreed = dog.breed;
      dog.special = key;
      dog.breed = SPECIALS[key].breed;
      dog.original = false;
      // 스페셜 칭호를 바로 달아 줘요 (직접 고른 칭호가 있으면 그대로)
      if (!dog.title || dog.title === 'sprout' || dog.title.startsWith('sp_')) dog.title = `sp_${key}`;
      return { type: 'special', key, from: dog.baseBreed };
    }
    dog.breed = dog.baseBreed ?? dog.breed;
    dog.special = null;
    dog.original = false;
    if (dog.title?.startsWith('sp_')) dog.title = null;
    return { type: 'specialLost', key: from };
  }

  renameDog(userId, name) {
    return tx(this.db, () => {
      const dog = this.loadDog(userId);
      if (!dog) throw new GameError('강아지가 없어요.', 404);
      if (dog.name === name) throw new GameError('지금 이름과 같아요!');
      const user = this.getUser(userId);
      if (user.coins < RENAME_PRICE) throw new GameError('뼈다귀 코인이 부족해요.');
      this.addCoins(userId, -RENAME_PRICE);
      dog.name = name;
      const ev = this.applySpecial(dog, specialForName(name));
      this.saveDog(dog);
      return { dog, events: ev ? [ev] : [] };
    });
  }

  // 원조 코드: 스페셜 캐릭터마다 한 계정만 "👑 원조"가 될 수 있어요
  claimOriginal(userId, code, secret) {
    if (!secret) throw new GameError('원조 코드가 아직 준비되지 않았어요.');
    const dog = this.loadDog(userId);
    if (!dog?.special) throw new GameError('스페셜 친구만 원조가 될 수 있어요.');
    if (dog.original) throw new GameError('이미 원조예요!');
    const a = Buffer.from(String(code ?? '').trim());
    const b = Buffer.from(String(secret));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new GameError('코드가 맞지 않아요.');
    const taken = this.db.prepare('SELECT 1 FROM dogs WHERE special = ? AND original = 1 AND id <> ?').get(dog.special, dog.id);
    if (taken) throw new GameError('이 친구의 원조는 이미 있어요.');
    dog.original = true;
    dog.title = `sp_${dog.special}`;
    this.saveDog(dog);
    return dog;
  }

  // 시간 경과 반영: 학교 하교 처리 → 수치 감소 → 성장 확인. 발생한 이벤트를 함께 돌려줍니다.
  refreshDog(userId) {
    return tx(this.db, () => {
      let dog = this.loadDog(userId);
      if (!dog) return { dog: null, events: [] };
      const now = this.now();
      const events = [];
      if (dog.school && now >= dog.school.endsAt) {
        const { dog: back, report, events: grew } = this.finishSchool(dog);
        dog = back;
        events.push(...grew, { type: 'schoolDone', report });
      }
      dog = this.materializePoop(dog, now);
      dog = applyDecay(dog, now, this.speed);
      events.push(...this.checkGrowth(dog, now));
      this.saveDog(dog);
      return { dog, events };
    });
  }

  // 경험치가 늘었을 때: 레벨업(보상 지급) → 성장 단계 확인
  checkGrowth(dog, now) {
    const events = [];
    const level = levelFromExp(dog.exp);
    while ((dog.level ?? 1) < level) {
      dog.level = (dog.level ?? 1) + 1;
      const rewards = levelRewards(dog.level);
      this.addCoins(dog.userId, rewards.coins);
      if (rewards.tickets) this.db.prepare('UPDATE users SET gacha_tickets = gacha_tickets + ? WHERE id = ?').run(rewards.tickets, dog.userId);
      if (rewards.hourglass) this.addBoost(dog.userId, 'hourglass', rewards.hourglass);
      events.push({
        type: 'levelUp', level: dog.level, rewards,
        emoteNames: rewards.emotes, titleNames: rewards.titles.map((t) => TITLES[t].name),
      });
    }
    const stage = computeStage(dog, now, this.speed);
    while (dog.stage < stage) {
      dog.stage += 1;
      const gift = STAGE_GIFT_TRICK[dog.stage];
      if (gift && !dog.tricks.includes(gift)) dog.tricks.push(gift);
      events.push({ type: 'grew', stage: dog.stage, stageName: STAGES[dog.stage].name, trick: gift ?? null });
    }
    return events;
  }

  // 재능 점수 더하기 (하루 한도, 성격 보너스). dog를 직접 바꾸고 이벤트를 돌려줘요.
  addTalents(dog, gains = {}, now = this.now()) {
    const events = [];
    const today = kstDate(now);
    if (dog.talentDay?.date !== today) dog.talentDay = { date: today, got: {} };
    dog.talents = { ...(dog.talents ?? {}) };
    const fav = TALENT_PERSONALITY[dog.personality];
    const level = levelFromExp(dog.exp);
    for (const [k, raw] of Object.entries(gains)) {
      if (!TALENTS[k] || !(raw > 0)) continue;
      const got = dog.talentDay.got[k] ?? 0;
      const amount = Math.min(raw * (k === fav ? TALENT_PERSONALITY_BONUS : 1), TALENT_DAILY_CAP - got);
      if (amount <= 0) continue;
      const before = talentStage(dog.talents[k] ?? 0);
      const titlesBefore = unlockedTitles(level, dog.talents, dog.special, dog.kids);
      dog.talents[k] = Math.round(((dog.talents[k] ?? 0) + amount) * 10) / 10;
      dog.talentDay.got[k] = Math.round((got + amount) * 10) / 10;
      const after = talentStage(dog.talents[k]);
      if (after > before) {
        const perks = TALENT_PERKS[k].filter((p) => p.stage > before && p.stage <= after).map((p) => p.text);
        const titles = unlockedTitles(level, dog.talents, dog.special, dog.kids).filter((t) => !titlesBefore.includes(t)).map((t) => TITLES[t].name);
        events.push({ type: 'talentUp', talent: k, name: TALENTS[k].name, stage: after, perks, titleNames: titles });
      }
    }
    return events;
  }

  // 여럿이 하는 놀이(소켓)에서 받는 경험치·재능. 이벤트는 onGrowth로 그 친구 화면에 알려요.
  grant(userId, { exp = 0, talents = {} } = {}) {
    const events = tx(this.db, () => {
      const dog = this.loadDog(userId);
      if (!dog) return [];
      const now = this.now();
      const out = this.addTalents(dog, talents, now);
      if (exp > 0) { dog.exp += Math.floor(exp); out.push(...this.checkGrowth(dog, now)); }
      this.saveDog(dog);
      return out;
    });
    if (events.length) this.onGrowth?.(userId, events);
    return events;
  }

  // 오늘의 약속·배지 기록 (server/progress.js). push면 소켓으로 그 친구 화면에 바로 알려요.
  track(userId, kind, n = 1, { push = false, ...extra } = {}) {
    const events = this.progress?.track(userId, kind, n, extra) ?? [];
    if (push && events.length) this.onGrowth?.(userId, events);
    return events;
  }

  seeBreeds(userId, breeds) {
    const events = this.progress?.seeBreeds(userId, breeds) ?? [];
    if (events.length) this.onGrowth?.(userId, events);
    return events;
  }

  // 요크 삼형제가 한자리에 모였는지 (userId -> dog.special 목록에서). 들어온 친구가 삼형제일 때만 알려요.
  trioGathering(joinerId, entries) {
    const trio = entries.filter((e) => e.special && SPECIALS[e.special]?.trio);
    const keys = [...new Set(trio.map((e) => e.special))];
    if (!trio.some((e) => e.userId === joinerId) || keys.length < 2) return null;
    const all = keys.length === Object.values(SPECIALS).filter((s) => s.trio).length;
    if (all) for (const e of trio) this.track(e.userId, 'trio', 1, { push: true });
    return { names: keys.map((k) => SPECIALS[k].name), all };
  }

  // 둘 중 한 강아지라도 다정 5단계면 친밀도 +1
  bondBonus(a, b) {
    return Math.max(this.effects(a).bondBonus, this.effects(b).bondBonus);
  }

  effects(userId) {
    const dog = this.loadDog(userId);
    return talentEffects(dog?.talents ?? {}, dog?.special);
  }

  setTitle(userId, titleId) {
    const dog = this.loadDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    if (titleId !== null && !unlockedTitles(levelFromExp(dog.exp), dog.talents, dog.special, dog.kids).includes(titleId)) throw new GameError('아직 얻지 못한 칭호예요.');
    dog.title = titleId;
    this.saveDog(dog);
    return dog;
  }

  act(userId, action) {
    if (!RULES.actions[action]) throw new GameError('알 수 없는 돌봄이에요.');
    const { dog: fresh, events } = this.refreshDog(userId);
    if (!fresh) throw new GameError('강아지가 없어요.', 404);
    if (fresh.school) throw new GameError(`${fresh.name}(이)가 학교에 가 있어요!`);
    return tx(this.db, () => {
      // 밥: 사료 그릇에서 한 번 분량을 써요 (배부르면 안 먹으니까 쓰지 않아요)
      if (action === 'feed' && fresh.fullness < RULES.actions.feed.fullAt) {
        const food = this.kibble(userId);
        if (food.n <= 0) throw new GameError('사료가 다 떨어졌어요! 조금 있으면 다시 채워져요. 간식을 줘도 돼요.');
        this.useKibble(userId, food);
      }
      const res = applyAction(fresh, action);
      const dog = res.dog;
      if (action === 'feed' && res.reaction !== 'full') this.schedulePoop(dog);
      if (res.reaction !== 'full') events.push(...this.addTalents(dog, TALENT_GAINS[action]));
      events.push(...this.checkGrowth(dog, this.now()));
      this.saveDog(dog);
      this.addCoins(userId, res.coins);
      if (res.reaction !== 'full') events.push(...this.track(userId, action));
      return { dog, coins: res.coins, exp: res.exp, reaction: res.reaction, events };
    });
  }

  startSchool(userId, courseId) {
    const course = SCHOOL_COURSES[courseId];
    if (!course) throw new GameError('그런 수업은 없어요.');
    const { dog, events } = this.refreshDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    if (dog.school) throw new GameError('벌써 학교에 가 있어요!');
    const now = this.now();
    dog.school = { course: courseId, startedAt: now, endsAt: now + schoolDurationMs(courseId, this.speed) };
    this.saveDog(dog);
    events.push(...this.track(userId, 'school'));
    return { dog, events };
  }

  // 수업이 끝났을 때(또는 조퇴할 때) 알림장을 쓰고 보상을 줘요. 조퇴하면 다닌 시간만큼만 받아요.
  finishSchool(dog, { at = dog.school.endsAt, early = false } = {}) {
    const course = SCHOOL_COURSES[dog.school.course];
    const total = dog.school.endsAt - dog.school.startedAt;
    const ratio = early ? Math.max(0, Math.min(1, (at - dog.school.startedAt) / total)) : 1;
    const coins = Math.floor(course.coins * ratio);
    const exp = Math.floor(course.exp * ratio);
    const next = { ...dog, tricks: [...dog.tricks], school: null, updatedAt: at };
    next.exp += exp;
    const gains = Object.fromEntries(Object.entries(TALENT_GAINS.school[dog.school.course] ?? {}).map(([k, v]) => [k, Math.floor(v * ratio)]));
    const events = [...this.addTalents(next, gains, at), ...this.checkGrowth(next, at)];
    let trick = null;
    const chance = (course.trickChance + (dog.personality === 'smart' ? 0.2 : 0)) * (early ? ratio : 1);
    const learnable = learnableTricks(next);
    if (learnable.length && (!early || ratio >= 0.5) && this.rng() < chance) {
      trick = pick(learnable, this.rng);
      next.tricks.push(trick);
    }
    const bias = {
      hyper: { '달리기': 1 }, foodie: { '간식 예절': 1 }, sweet: { '친구 사귀기': 1 },
      smart: { '집중력': 1 }, sleepy: { '집중력': -1 }, shy: { '친구 사귀기': -1 },
    }[dog.personality] ?? {};
    const maxStamp = early && ratio < 0.5 ? 2 : 3;
    const stamps = Object.fromEntries(REPORT_SUBJECTS.map((s) => {
      const base = 1 + Math.floor(this.rng() * 3);
      return [s, Math.max(1, Math.min(maxStamp, base + (bias[s] ?? 0)))];
    }));
    const report = {
      dogName: dog.name,
      breed: dog.breed,
      personality: dog.personality,
      stage: next.stage,
      course: dog.school.course,
      courseName: early ? `${course.name} (조퇴)` : course.name,
      early,
      stamps,
      comment: pick(early ? EARLY_COMMENTS : TEACHER_COMMENTS[dog.personality], this.rng),
      trick,
      trickName: trick ? TRICKS[trick].name : null,
      coins,
      exp,
      date: at,
    };
    const res = this.db.prepare('INSERT INTO reports (user_id, data, created_at) VALUES (?, ?, ?)')
      .run(dog.userId, JSON.stringify(report), at);
    this.addCoins(dog.userId, coins);
    report.id = Number(res.lastInsertRowid);
    return { dog: next, report, events };
  }

  // ---------- 사료 · 간식 · 똥 ----------
  // 사료 그릇: 쓸수록 줄고, refillMs마다 하나씩 다시 채워져요 (계정 전체가 함께 써요)
  kibble(userId) {
    const user = this.getUser(userId);
    const now = this.now();
    const step = FOOD.refillMs / this.speed;
    let n = user.kibble; let at = user.kibbleAt ?? now;
    if (n >= FOOD.kibbleMax) return { n: FOOD.kibbleMax, at: now, nextAt: null };
    const gained = Math.floor((now - at) / step);
    n = Math.min(FOOD.kibbleMax, n + gained);
    at = n >= FOOD.kibbleMax ? now : at + gained * step;
    return { n, at, nextAt: n >= FOOD.kibbleMax ? null : at + step };
  }

  useKibble(userId, food) {
    const at = food.n >= FOOD.kibbleMax ? this.now() : food.at; // 가득 찬 상태에서 쓰면 지금부터 다시 채우기 시작
    this.db.prepare('UPDATE users SET kibble = ?, kibble_at = ? WHERE id = ?').run(food.n - 1, at, userId);
  }

  // 먹고 나면 조금 뒤에 똥을 쌀 수도 있어요
  schedulePoop(dog) {
    const p = { list: [], ...(dog.poop ?? {}) };
    if (p.pending || p.list.length >= POOP.max || this.rng() >= POOP.chance) return;
    p.pending = this.now() + POOP.delayMs / this.speed;
    dog.poop = p;
  }

  materializePoop(dog, now) {
    const p = dog.poop;
    if (!p?.pending || now < p.pending || dog.school) return dog;
    const list = [...(p.list ?? [])];
    if (list.length < POOP.max) {
      list.push({ id: crypto.randomBytes(4).toString('hex'), x: 0.15 + this.rng() * 0.7, y: 0.25 + this.rng() * 0.65, at: p.pending });
    }
    return { ...dog, poop: { list } };
  }

  cleanPoop(userId, poopId) {
    const { dog: fresh, events } = this.refreshDog(userId);
    if (!fresh) throw new GameError('강아지가 없어요.', 404);
    const list = fresh.poop?.list ?? [];
    if (!list.some((x) => x.id === poopId)) throw new GameError('이미 치웠어요!');
    return tx(this.db, () => {
      const dog = { ...fresh, poop: { ...fresh.poop, list: list.filter((x) => x.id !== poopId) } };
      dog.cleanliness = Math.min(RULES.statMax, dog.cleanliness + POOP.cleanliness);
      events.push(...this.addTalents(dog, { kind: 1 }));
      this.saveDog(dog);
      this.addCoins(userId, POOP.cleanCoins);
      events.push(...this.track(userId, 'clean'));
      return { dog, coins: POOP.cleanCoins, events };
    });
  }

  buyTreat(userId, treatId) {
    const t = TREATS[treatId];
    if (!t) throw new GameError('그런 간식은 없어요.');
    return tx(this.db, () => {
      const user = this.getUser(userId);
      if ((user.treats[treatId] ?? 0) >= TREAT_RULES.maxHold) throw new GameError(`${TREAT_RULES.maxHold}개까지만 가질 수 있어요.`);
      if (user.coins < t.price) throw new GameError('뼈다귀 코인이 부족해요.');
      user.treats[treatId] = (user.treats[treatId] ?? 0) + 1;
      this.db.prepare('UPDATE users SET coins = coins - ?, treats = ? WHERE id = ?').run(t.price, JSON.stringify(user.treats), userId);
      return this.getUser(userId);
    });
  }

  giveTreat(userId, treatId) {
    const t = TREATS[treatId];
    if (!t) throw new GameError('그런 간식은 없어요.');
    const { dog: fresh, events } = this.refreshDog(userId);
    if (!fresh) throw new GameError('강아지가 없어요.', 404);
    if (fresh.school) throw new GameError(`${fresh.name}(이)가 학교에 가 있어요!`);
    if (fresh.fullness >= TREAT_RULES.fullAt) throw new GameError('배가 너무 불러요! 간식은 조금 있다가 줘요.');
    return tx(this.db, () => {
      const user = this.getUser(userId);
      if (!(user.treats[treatId] > 0)) throw new GameError('그 간식이 없어요. 간식 가게에서 사 주세요!');
      user.treats[treatId] -= 1;
      this.db.prepare('UPDATE users SET treats = ? WHERE id = ?').run(JSON.stringify(user.treats), userId);
      const fav = t.fav.includes(fresh.personality);
      const dog = { ...fresh };
      dog.fullness = Math.min(RULES.statMax, dog.fullness + t.fullness);
      dog.affection = Math.min(RULES.statMax, dog.affection + t.affection + (fav ? TREAT_RULES.favBonus : 0));
      dog.exp += TREAT_RULES.exp;
      this.schedulePoop(dog);
      events.push(...this.addTalents(dog, { kind: 1 }), ...this.checkGrowth(dog, this.now()));
      this.saveDog(dog);
      events.push(...this.track(userId, 'feed'));
      return { dog, fav, events };
    });
  }

  // ---------- 학교 시간 아이템 ----------
  addBoost(userId, id, n = 1) {
    if (!SCHOOL_BOOSTS[id] || n <= 0) return 0;
    const user = this.getUser(userId);
    const have = user.boosts[id] ?? 0;
    const add = Math.min(n, BOOST_RULES.maxHold - have);
    if (add <= 0) return 0;
    user.boosts[id] = have + add;
    this.db.prepare('UPDATE users SET boosts = ? WHERE id = ?').run(JSON.stringify(user.boosts), userId);
    return add;
  }

  buyBoost(userId, id) {
    const b = SCHOOL_BOOSTS[id];
    if (!b) throw new GameError('그런 아이템은 없어요.');
    if (!b.price) throw new GameError('이건 선물로만 받을 수 있어요!');
    return tx(this.db, () => {
      const user = this.getUser(userId);
      if ((user.boosts[id] ?? 0) >= BOOST_RULES.maxHold) throw new GameError(`${BOOST_RULES.maxHold}개까지만 가질 수 있어요.`);
      if (user.coins < b.price) throw new GameError('뼈다귀 코인이 부족해요.');
      this.addCoins(userId, -b.price);
      this.addBoost(userId, id);
      return this.getUser(userId);
    });
  }

  // 셔틀버스표: 남은 시간 절반 / 모래시계: 바로 하교 (조퇴가 아니라서 선물을 다 받아요)
  useBoost(userId, id) {
    if (!SCHOOL_BOOSTS[id]) throw new GameError('그런 아이템은 없어요.');
    const { dog } = this.refreshDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    if (!dog.school) throw new GameError('학교에 가 있을 때 쓸 수 있어요.');
    tx(this.db, () => {
      const user = this.getUser(userId);
      if (!(user.boosts[id] > 0)) throw new GameError('아이템이 없어요.');
      const today = kstDate(this.now());
      const used = user.boostDay.date === today ? user.boostDay.n : 0;
      if (used >= BOOST_RULES.dailyUses) throw new GameError(`오늘은 ${BOOST_RULES.dailyUses}번 다 썼어요. 내일 또 써요!`);
      user.boosts[id] -= 1;
      this.db.prepare('UPDATE users SET boosts = ?, boost_day = ? WHERE id = ?')
        .run(JSON.stringify(user.boosts), JSON.stringify({ date: today, n: used + 1 }), userId);
      const now = this.now();
      const left = Math.max(0, dog.school.endsAt - now);
      // 시작 시각도 같이 당겨서 수업 길이(조퇴 계산용)가 그대로 유지돼요
      const cut = id === 'hourglass' ? left : Math.ceil(left / 2);
      dog.school = { ...dog.school, startedAt: dog.school.startedAt - cut, endsAt: dog.school.endsAt - cut };
      this.saveDog(dog);
    });
    const res = this.refreshDog(userId); // 끝났으면 여기서 하교 + 알림장
    return { dog: res.dog, events: res.events, boost: id };
  }

  leaveSchool(userId) {
    const { dog, events } = this.refreshDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    if (!dog.school) throw new GameError('학교에 가 있지 않아요.');
    return tx(this.db, () => {
      const res = this.finishSchool(dog, { at: this.now(), early: true });
      this.saveDog(res.dog);
      return { dog: res.dog, events: [...events, ...res.events, { type: 'schoolDone', report: res.report }] };
    });
  }

  listReports(userId) {
    return this.db.prepare('SELECT id, data, read, created_at FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(userId)
      .map((r) => ({ id: r.id, read: !!r.read, ...JSON.parse(r.data) }));
  }

  markReportRead(userId, reportId) {
    this.db.prepare('UPDATE reports SET read = 1 WHERE id = ? AND user_id = ?').run(reportId, userId);
  }

  unreadReports(userId) {
    return this.db.prepare('SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND read = 0').get(userId).n;
  }

  // ---------- 상점/꾸미기 ----------
  buy(userId, itemId) {
    const item = ITEMS[itemId];
    if (!item) throw new GameError('그런 물건은 없어요.');
    return tx(this.db, () => {
      const user = this.getUser(userId);
      if (item.shop === false) throw new GameError('이건 뽑기에서만 나와요!');
      if (user.owned.includes(itemId)) throw new GameError('이미 가지고 있어요!');
      const dog = this.loadDog(userId);
      if (DOG_SLOTS.includes(item.slot) && (dog?.stage ?? 0) < item.stage) {
        throw new GameError(`${STAGES[item.stage].name}(으)로 자라면 살 수 있어요.`);
      }
      if (user.coins < item.price) throw new GameError('뼈다귀 코인이 부족해요.');
      user.owned.push(itemId);
      this.db.prepare('UPDATE users SET coins = coins - ?, owned = ? WHERE id = ?')
        .run(item.price, JSON.stringify(user.owned), userId);
      return this.getUser(userId);
    });
  }

  equip(userId, slot, itemId) {
    const user = this.getUser(userId);
    if (itemId !== null) {
      const item = ITEMS[itemId];
      if (!item || item.slot !== slot) throw new GameError('그 자리에는 놓을 수 없어요.');
      if (!user.owned.includes(itemId)) throw new GameError('아직 가지고 있지 않아요.');
    }
    if (DOG_SLOTS.includes(slot)) {
      const dog = this.loadDog(userId);
      if (!dog) throw new GameError('강아지가 없어요.', 404);
      if (itemId && dog.stage < ITEMS[itemId].stage) throw new GameError(`${STAGES[ITEMS[itemId].stage].name}(으)로 자라면 쓸 수 있어요.`);
      const changed = itemId && dog.equip[slot] !== itemId;
      if (itemId) dog.equip[slot] = itemId; else delete dog.equip[slot];
      const events = changed ? this.addTalents(dog, TALENT_GAINS.equip) : [];
      this.saveDog(dog);
      if (changed) events.push(...this.track(userId, 'equip'));
      return { dog, user, events };
    }
    if (ROOM_SLOTS.includes(slot)) {
      if (itemId === null && (slot === 'wallpaper' || slot === 'bed')) throw new GameError('이건 꼭 하나 있어야 해요.');
      const changed = user.room[slot] !== itemId;
      user.room[slot] = itemId;
      this.db.prepare('UPDATE users SET room = ? WHERE id = ?').run(JSON.stringify(user.room), userId);
      return { dog: this.loadDog(userId), user, events: changed ? this.track(userId, 'equip') : [] };
    }
    throw new GameError('알 수 없는 자리예요.');
  }

  // ---------- 함께 등교: 훈련 수업 ----------
  trainingsToday(userId) {
    const dayStart = Date.parse(`${kstDate(this.now())}T00:00:00+09:00`);
    return this.db.prepare("SELECT COUNT(*) AS n FROM minigames WHERE user_id = ? AND type = 'train' AND started_at >= ?")
      .get(userId, dayStart).n;
  }

  startTraining(userId) {
    const { dog } = this.refreshDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    if (dog.school) throw new GameError(`${dog.name}(은)는 벌써 학교에 가 있어요!`);
    const used = this.trainingsToday(userId);
    if (used >= TRAINING.dailyLimit) throw new GameError('오늘은 훈련을 많이 했어요! 내일 또 해요.');
    const id = crypto.randomBytes(12).toString('hex');
    this.db.prepare("INSERT INTO minigames (id, user_id, started_at, type) VALUES (?, ?, ?, 'train')").run(id, userId, this.now());
    const learnable = learnableTricks(dog);
    const target = learnable[0] ?? null;
    const progress = target ? (this.getUser(userId).trainProgress[target] ?? 0) : 0;
    return { trainingId: id, target, progress, need: talentEffects(dog.talents, dog.special).learnHits, left: TRAINING.dailyLimit - used - 1 };
  }

  finishTraining(userId, trainingId, { correct, targetHits, target }) {
    return tx(this.db, () => {
      const row = this.db.prepare("SELECT * FROM minigames WHERE id = ? AND user_id = ? AND type = 'train'").get(String(trainingId), userId);
      if (!row || row.finished) throw new GameError('이미 끝난 수업이에요.');
      if (this.now() - row.started_at < TRAINING.minSeconds * 1000) throw new GameError('수업을 조금 더 해야 해요!');
      this.db.prepare('UPDATE minigames SET finished = 1 WHERE id = ?').run(row.id);
      const ok = Math.max(0, Math.min(TRAINING.rounds, Math.floor(Number(correct) || 0)));
      const hits = Math.max(0, Math.min(ok, TRAINING.targetRounds, Math.floor(Number(targetHits) || 0)));
      const dog = this.loadDog(userId);
      const coins = ok * TRAINING.coinsPerCorrect;
      const exp = ok * TRAINING.expPerCorrect;
      dog.exp += exp;
      dog.affection = Math.min(RULES.statMax, dog.affection + Math.min(8, ok));
      const need = talentEffects(dog.talents, dog.special).learnHits;
      const events = [...this.addTalents(dog, { smart: Math.ceil(ok / 2) }), ...this.checkGrowth(dog, this.now())];
      let learned = null;
      const user = this.getUser(userId);
      if (target && hits > 0 && learnableTricks(dog).includes(target)) {
        const progress = (user.trainProgress[target] ?? 0) + hits;
        if (progress >= need) {
          dog.tricks.push(target);
          learned = target;
          delete user.trainProgress[target];
        } else user.trainProgress[target] = progress;
        this.db.prepare('UPDATE users SET train_progress = ? WHERE id = ?').run(JSON.stringify(user.trainProgress), userId);
      }
      this.saveDog(dog);
      this.addCoins(userId, coins);
      events.push(...this.track(userId, 'train'));
      return { coins, exp, learned, learnedName: learned ? TRICKS[learned].name : null, progress: target ? (this.getUser(userId).trainProgress[target] ?? (learned ? need : 0)) : 0, need, events };
    });
  }

  // ---------- 캡슐 뽑기 ----------
  // special: 도장판 특별 캡슐 (공짜, 희귀 이상만, 오늘 무료 뽑기와 상관없어요)
  gacha(userId, { special = false } = {}) {
    const run = () => {
      const user = this.getUser(userId);
      const today = kstDate(this.now());
      const free = !special && user.gachaDate !== today;
      const ticket = !special && !free && user.gachaTickets > 0;
      if (!special && !free && !ticket && user.coins < GACHA.price) throw new GameError('뼈다귀 코인이 부족해요.');
      const weights = special ? SPECIAL_CAPSULE : Object.fromEntries(Object.entries(RARITY).map(([k, r]) => [k, r.weight]));
      const total = Object.values(weights).reduce((a, w) => a + w, 0);
      let roll = this.rng() * total;
      let rarity = Object.keys(weights)[0];
      for (const [k, w] of Object.entries(weights)) {
        if (roll < w) { rarity = k; break; }
        roll -= w;
      }
      const pool = Object.keys(ITEMS).filter((id) => ITEMS[id].gacha !== false && ITEMS[id].rarity === rarity);
      const itemId = pick(pool, this.rng);
      const duplicate = user.owned.includes(itemId);
      const refund = duplicate ? RARITY[rarity].refund : 0;
      if (!duplicate) user.owned.push(itemId);
      this.db.prepare('UPDATE users SET coins = coins - ? + ?, owned = ?, gacha_date = ?, gacha_tickets = gacha_tickets - ? WHERE id = ?')
        .run(free || ticket || special ? 0 : GACHA.price, refund, JSON.stringify(user.owned), special ? user.gachaDate : today, ticket ? 1 : 0, userId);
      let events = [];
      const dog = this.loadDog(userId);
      if (dog) { events = this.addTalents(dog, TALENT_GAINS.gacha); this.saveDog(dog); }
      events.push(...this.track(userId, 'gacha'));
      return { itemId, rarity, duplicate, refund, free, ticket, special, events };
    };
    return special ? run() : tx(this.db, run);
  }

  // ---------- 미니게임 (간식 받아먹기) ----------
  startMinigame(userId, type = 'catch') {
    if (!RULES.minigame.types[type]) throw new GameError('그런 놀이는 없어요.');
    const user = this.getUser(userId);
    const today = kstDate(this.now());
    const plays = user.minigameDate === today ? user.minigamePlays : 0;
    if (plays >= RULES.minigame.dailyPlays) throw new GameError('오늘은 충분히 놀았어요! 내일 또 놀아요.');
    const id = crypto.randomBytes(12).toString('hex');
    this.db.prepare('INSERT INTO minigames (id, user_id, started_at, type) VALUES (?, ?, ?, ?)').run(id, userId, this.now(), type);
    this.db.prepare('UPDATE users SET minigame_date = ?, minigame_plays = ? WHERE id = ?').run(today, plays + 1, userId);
    return { gameId: id, playsLeft: RULES.minigame.dailyPlays - plays - 1 };
  }

  finishMinigame(userId, gameId, score) {
    return tx(this.db, () => {
      const game = this.db.prepare('SELECT * FROM minigames WHERE id = ? AND user_id = ?').get(String(gameId), userId);
      if (!game || game.finished) throw new GameError('이미 끝난 놀이예요.');
      const elapsed = this.now() - game.started_at;
      const kind = RULES.minigame.types[game.type] ?? RULES.minigame.types.catch;
      if (elapsed < kind.minSeconds * 1000) throw new GameError('조금 더 놀아야 해요!');
      this.db.prepare('UPDATE minigames SET finished = 1 WHERE id = ?').run(gameId);
      const safeScore = Math.max(0, Math.min(kind.maxScore, Math.floor(Number(score) || 0)));
      const coins = Math.min(RULES.minigame.maxCoins, Math.floor(safeScore / kind.scorePerCoin));
      this.addCoins(userId, coins);
      // 함께 놀면 애정도도 오르고, 경험치와 재능(멍뭉런 → 튼튼, 간식 받기 → 호기심)도 자라요
      const dog = this.loadDog(userId);
      let events = [];
      let exp = 0;
      if (dog && !dog.school && safeScore > 0) {
        dog.affection = Math.min(RULES.statMax, dog.affection + 5);
        exp = Math.min(15, 4 + Math.floor(coins / 2));
        dog.exp += exp;
        const talent = game.type === 'run' ? 'strong' : 'curious';
        events = [...this.addTalents(dog, { [talent]: Math.min(5, 1 + Math.floor(coins / 3)) }), ...this.checkGrowth(dog, this.now())];
        this.saveDog(dog);
      }
      if (game.type === 'run') events.push(...this.addRunnerXp(userId, safeScore));
      events.push(...this.track(userId, game.type === 'run' ? 'run' : 'catch'));
      return { coins, exp, events, type: game.type, safeScore };
    });
  }

  // 멍뭉런 레벨: 한 판마다 + 모은 간식만큼 런 경험치. 레벨이 오르거나 최고 기록을 넘으면 새 맵이 열려요
  addRunnerXp(userId, score) {
    const r = this.getUser(userId).runner;
    const before = { level: runnerLevel(r.xp).level, maps: runnerMaps(r) };
    r.xp += RUNNER.xpPerRun + Math.min(RUNNER.xpScoreCap, score);
    r.best = Math.max(r.best, score);
    r.plays += 1;
    this.db.prepare('UPDATE users SET runner = ? WHERE id = ?').run(JSON.stringify(r), userId);
    const events = [];
    const level = runnerLevel(r.xp).level;
    if (level > before.level) events.push({ type: 'runLevel', level });
    for (const map of runnerMaps(r)) if (!before.maps.includes(map)) events.push({ type: 'runMap', map, name: RUNNER.maps[map].name });
    return events;
  }

  // ---------- 화면용 정리 ----------
  dogView(dog) {
    if (!dog) return null;
    const now = this.now();
    return {
      ...dog,
      mood: mood(dog),
      growth: growthProgress(dog, now, this.speed),
      learnable: learnableTricks(dog).length,
      ...this.levelView(dog),
      talentDay: undefined,
      effects: talentEffects(dog.talents, dog.special),
      titles: unlockedTitles(levelFromExp(dog.exp), dog.talents, dog.special, dog.kids),
      emotes: unlockedEmotes(levelFromExp(dog.exp)),
    };
  }

  levelView(dog) {
    const info = levelInfo(dog.exp);
    return {
      level: info.level, levelInto: info.into, levelNeed: info.need,
      talents: Object.fromEntries(Object.keys(TALENTS).map((k) => [k, Math.floor(dog.talents?.[k] ?? 0)])),
      talentStages: talentStages(dog.talents),
      titleName: dog.title && TITLES[dog.title] ? TITLES[dog.title].name : null,
      frame: frameTier(info.level),
    };
  }

  // 다른 친구에게 보여주는 강아지 모습
  publicDog(dog) {
    if (!dog) return null;
    return {
      name: dog.name, breed: dog.breed, personality: dog.personality, stage: dog.stage,
      equip: dog.equip, fluff: dog.fluff, tricks: dog.tricks, mood: mood(dog),
      atSchool: !!dog.school,
      ...this.levelView(dog),
      showcase: this.progress?.showcase(dog.userId) ?? [],
      special: dog.special ?? null,
      original: !!dog.original,
      parents: dog.parents ?? null,
    };
  }

  // 놀이터(공개 광장)용: 레벨 숫자와 재능은 빼고 칭호와 이름표 테두리만 보여요
  plazaDog(dog) {
    const pub = this.publicDog(dog);
    if (!pub) return null;
    const { level, levelInto, levelNeed, talents, talentStages: _s, showcase: _b, ...rest } = pub;
    return rest;
  }
}
