// ☕ 멍뭉 카페: 메뉴를 고르고 문을 열어 두면, 시간이 지나 동물 손님이 다녀가요.
// 점장 = 대표 강아지, 직원 = 우리 강아지나 친구 강아지 알바(재능에 따라 요리사·서빙·손님 맞이), 손님 도감 · 단짝 소개
import { CAFE, CAFE_MENU, CAFE_GUESTS } from '../shared/data.js';
import { talentStages } from '../shared/rules.js';
import { GameError } from './game.js';

export function cafeLevel(xp = 0) {
  let level = 1;
  while (level < CAFE.xp.length && xp >= CAFE.xp[level]) level += 1;
  return { level, into: xp - CAFE.xp[level - 1], need: level < CAFE.xp.length ? CAFE.xp[level] - CAFE.xp[level - 1] : 0, slots: CAFE.slots[level - 1] };
}

const pairKey = (a, b) => [a, b].sort().join('+');

export class Cafe {
  constructor(db, { game, friends, asks, village }) {
    Object.assign(this, { db, game, friends, asks, village });
  }

  now() { return this.game.now(); }

  get(userId) {
    const raw = this.db.prepare('SELECT cafe FROM users WHERE id = ?').get(userId)?.cafe;
    return { xp: 0, open: null, dex: {}, pairs: [], staff: {}, last: null, served: 0, ...JSON.parse(raw ?? '{}') };
  }

  save(userId, c) { this.db.prepare('UPDATE users SET cafe = ? WHERE id = ?').run(JSON.stringify(c), userId); }

  need(userId) { if (!this.village.has(userId, 'cafe')) throw new GameError('아직 카페가 열리지 않았어요. 💗를 모아 마을 지도에서 열어요!'); }

  // 직원 정하기 (dogId가 null이면 비우기). 한 강아지는 한 가지 일만 해요
  // 우리 강아지는 숫자 id, 친구 알바는 'f:친구id' (친구의 대표 강아지가 와요)
  setStaff(userId, role, dogId) {
    this.need(userId);
    if (!CAFE.roles[role]) throw new GameError('그런 일은 없어요.');
    const c = this.get(userId);
    if (c.open) throw new GameError('영업 중에는 직원을 바꿀 수 없어요.');
    let value = null;
    if (typeof dogId === 'string' && dogId.startsWith('f:')) {
      const fid = Number(dogId.slice(2));
      if (!fid || !this.friends.areFriends(userId, fid)) throw new GameError('친구만 알바로 부를 수 있어요.');
      if (!this.game.loadDog(fid)) throw new GameError('그 친구는 아직 강아지가 없어요.');
      value = `f:${fid}`;
    } else if (dogId !== null && dogId !== '') {
      const dog = this.game.loadDogById(Number(dogId));
      if (!dog || dog.userId !== userId) throw new GameError('우리 강아지만 일할 수 있어요.');
      value = dog.id;
    }
    if (value !== null) {
      for (const r of Object.keys(c.staff)) if (c.staff[r] === value) delete c.staff[r];
      c.staff[role] = value;
    } else delete c.staff[role];
    this.save(userId, c);
    return this.view(userId);
  }

  // 직원 강아지 (친구 알바면 친구 id도 같이)
  staffDog(userId, c, role) {
    const id = c.staff[role];
    if (!id) return null;
    if (typeof id === 'string' && id.startsWith('f:')) {
      const fid = Number(id.slice(2));
      if (!this.friends.areFriends(userId, fid)) return null;
      const dog = this.game.loadDog(fid);
      return dog ? { dog, friendId: fid } : null;
    }
    const dog = this.game.loadDogById(id);
    return dog && dog.userId === userId ? { dog } : null;
  }

  open(userId, menu, duration) {
    this.need(userId);
    const c = this.get(userId);
    if (c.open) throw new GameError('벌써 영업 중이에요!');
    const D = CAFE.durations[duration];
    if (!D) throw new GameError('영업 시간을 골라 주세요.');
    const { level, slots } = cafeLevel(c.xp);
    const items = [...new Set((Array.isArray(menu) ? menu : []).map(String))].filter((m) => CAFE_MENU[m] && CAFE_MENU[m].level <= level);
    if (!items.length) throw new GameError('메뉴를 하나 이상 골라 주세요.');
    if (items.length > slots) throw new GameError(`메뉴는 ${slots}개까지 걸 수 있어요.`);
    const now = this.now();
    c.open = { menu: items, duration, startedAt: now, endsAt: now + (D.minutes * 60_000) / (this.game.speed ?? 1) };
    this.save(userId, c);
    return this.view(userId);
  }

  staffStage(userId, c, role) {
    const s = this.staffDog(userId, c, role);
    if (!s) return 0;
    const st = talentStages(s.dog.talents);
    return Math.max(...CAFE.roles[role].talents.map((t) => st[t] ?? 0));
  }

  // 정산: 끝났으면 다 받고, 일찍 닫으면 영업한 만큼만
  collect(userId) {
    this.need(userId);
    const c = this.get(userId);
    if (!c.open) throw new GameError('지금은 영업 중이 아니에요.');
    const now = this.now();
    const total = c.open.endsAt - c.open.startedAt;
    const ratio = Math.max(0, Math.min(1, (now - c.open.startedAt) / total));
    const rng = this.game.rng;
    const hours = (CAFE.durations[c.open.duration].minutes / 60) * ratio;
    const before = cafeLevel(c.xp).level;
    const cook = this.staffStage(userId, c, 'cook');
    const serve = this.staffStage(userId, c, 'serve');
    const host = this.staffStage(userId, c, 'host');
    let count = Math.round(CAFE.perHour * hours) + (ratio >= 1 ? Math.floor(serve / 3) + Math.min(3, c.pairs.length) : 0);
    if (ratio >= 1) count = Math.max(2, count);
    const pool = Object.entries(CAFE_GUESTS).filter(([, g]) => g.level <= before);
    const friendIds = this.friends.friendIds(userId);
    const guests = [];
    let coins = 0; let favs = 0; let starSum = 0;
    for (let i = 0; i < count; i++) {
      // 친구 강아지 손님
      if (friendIds.length && rng() < CAFE.friendChance) {
        const fid = friendIds[Math.floor(rng() * friendIds.length)];
        const fd = this.game.loadDog(fid);
        const fu = this.game.getUser(fid);
        if (fd && fu) {
          const got = CAFE.coinsPerGuest * 2;
          coins += got; starSum += 5; favs += 1;
          guests.push({ friend: true, nickname: fu.nickname, dog: { name: fd.name, breed: fd.breed, stage: fd.stage, equip: fd.equip }, stars: 5, coins: got, fav: true });
          continue;
        }
      }
      const choices = pool.filter(([, g]) => !g.rare || rng() < 0.15);
      const [id, g] = choices[Math.floor(rng() * choices.length)];
      const fav = c.open.menu.includes(g.fav);
      const got = Math.round(CAFE.coinsPerGuest * (fav ? CAFE.favTip : 1) * (1 + cook * 0.05));
      const stars = fav ? 5 : Math.min(5, 3 + (rng() < 0.3 + host * 0.05 ? 1 : 0));
      coins += got; starSum += stars; if (fav) favs += 1;
      const isNew = !c.dex[id];
      c.dex[id] = (c.dex[id] ?? 0) + 1;
      guests.push({ id, stars, coins: got, fav, isNew });
    }
    const hearts = Math.min(CAFE.maxHearts, Math.floor(favs / CAFE.heartsPerFav) + (host >= 5 && favs ? 1 : 0));
    c.xp += guests.length;
    c.served += guests.length;
    c.open = null;
    const after = cafeLevel(c.xp);
    const report = { at: now, guests, coins, hearts, stars: guests.length ? Math.round((starSum / guests.length) * 10) / 10 : 0, early: ratio < 1, levelUp: after.level > before ? after.level : null };
    c.last = report;
    this.game.addCoins(userId, coins);
    if (hearts) this.asks.addHearts(userId, hearts);
    // 끝까지 도와준 친구 알바에게 알바비 편지 (친구마다 하루 한 번)
    if (ratio >= 1) {
      const me = this.game.getUser(userId);
      const day = new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
      if (c.paid?.day !== day) c.paid = { day, ids: [] };
      for (const role of Object.keys(CAFE.roles)) {
        const s = this.staffDog(userId, c, role);
        if (!s?.friendId || c.paid.ids.includes(s.friendId)) continue;
        c.paid.ids.push(s.friendId);
        this.game.progress?.sendMail(s.friendId, 'cafeHelp', {
          from: me.nickname, coins: CAFE.helperPay, title: `${me.nickname}네 카페 알바비`,
          breed: s.dog.breed, stage: s.dog.stage, equip: s.dog.equip,
          body: `${s.dog.name}(이)가 ${me.nickname}네 멍뭉 카페에서 ${CAFE.roles[role].name} 일을 도와줬어요! 고마워서 알바비를 보내요. 🦴+${CAFE.helperPay}`,
        });
      }
    }
    this.save(userId, c);
    const events = this.game.track(userId, 'cafe');
    if (report.levelUp) events.push({ type: 'cafeLevel', level: after.level });
    return { report, events };
  }

  // 🤝 손님 소개: 둘 다 단골(3번 이상)이면 단짝이 돼요. 단짝은 같이 와서 손님이 늘어요
  introduce(userId, a, b) {
    this.need(userId);
    const c = this.get(userId);
    if (!CAFE_GUESTS[a] || !CAFE_GUESTS[b] || a === b) throw new GameError('소개할 두 손님을 골라요.');
    if ((c.dex[a] ?? 0) < CAFE.pairMin || (c.dex[b] ?? 0) < CAFE.pairMin) throw new GameError(`둘 다 ${CAFE.pairMin}번 이상 온 단골이어야 소개할 수 있어요.`);
    const key = pairKey(a, b);
    if (c.pairs.includes(key)) throw new GameError('벌써 단짝이에요!');
    c.pairs.push(key);
    this.save(userId, c);
    this.asks.addHearts(userId, CAFE.pairHearts);
    return { type: 'cafePair', a, b, hearts: CAFE.pairHearts };
  }

  view(userId) {
    const c = this.get(userId);
    // 알바로 부를 수 있는 친구들 (대표 강아지가 있는 친구만)
    const helpers = !this.village.has(userId, 'cafe') ? [] : this.friends.friendIds(userId).map((fid) => {
      const dog = this.game.loadDog(fid);
      const u = dog && this.game.getUser(fid);
      return u ? { id: `f:${fid}`, nickname: u.nickname, dog: { name: dog.name, breed: dog.breed, stage: dog.stage, equip: dog.equip } } : null;
    }).filter(Boolean);
    return { ...cafeLevel(c.xp), xp: c.xp, open: c.open, dex: c.dex, pairs: c.pairs, staff: c.staff, last: c.last, served: c.served, helpers };
  }
}
