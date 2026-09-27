// 🗺️ 멍뭉 마을(장소 열기 · 마당 땅 파기) + 🔍 취향(간식 반응) + 가구 세트
import crypto from 'node:crypto';
import { PLACES, YARD, TASTES, TREATS, ITEMS, ROOM_SETS, SET_REWARD } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';
import { GameError } from './game.js';

// 강아지마다 간식 반응이 달라요: 가장 좋아하는 간식 1개(😍), 별로인 간식 1개(😖), 나머지는 😐·😊
export function tasteOf(dogId, treatId) {
  const ids = Object.keys(TREATS);
  const score = (id) => crypto.createHash('md5').update(`${dogId}:${id}`).digest().readUInt32BE(0);
  const order = [...ids].sort((a, b) => score(a) - score(b));
  const i = order.indexOf(treatId);
  if (i === order.length - 1) return 3;
  if (i === 0) return 0;
  return i >= order.length / 2 ? 2 : 1;
}

export class Village {
  constructor(db, { game, asks }) {
    this.db = db;
    this.game = game;
    this.asks = asks;
  }

  now() { return this.game.now(); }

  row(userId) {
    const r = this.db.prepare('SELECT places, yard, sets, hearts_total, taste_day FROM users WHERE id = ?').get(userId);
    return {
      places: JSON.parse(r?.places ?? '[]'), yard: JSON.parse(r?.yard ?? '{}'), sets: JSON.parse(r?.sets ?? '[]'),
      heartsTotal: r?.hearts_total ?? 0, tasteDay: JSON.parse(r?.taste_day ?? '{}'),
    };
  }

  // 모은 💗가 충분하면 새 장소 열기
  open(userId, id) {
    const P = PLACES[id];
    if (!P) throw new GameError('그런 곳은 없어요.');
    const r = this.row(userId);
    if (r.places.includes(id)) throw new GameError('벌써 열린 곳이에요!');
    if (r.heartsTotal < P.hearts) throw new GameError(`💗를 ${P.hearts - r.heartsTotal}개 더 모으면 열 수 있어요!`);
    r.places.push(id);
    this.db.prepare('UPDATE users SET places = ? WHERE id = ?').run(JSON.stringify(r.places), userId);
    return { type: 'placeOpen', id, name: P.name, emoji: P.emoji };
  }

  has(userId, id) { return this.row(userId).places.includes(id); }

  // 🌳 마당 땅 파기 (하루 3번)
  dig(userId) {
    if (!this.has(userId, 'yard')) throw new GameError('아직 마당이 열리지 않았어요.');
    const r = this.row(userId);
    const today = kstDate(this.now());
    const y = r.yard.day === today ? r.yard : { day: today, n: 0 };
    if (y.n >= YARD.digsPerDay) throw new GameError('오늘은 충분히 팠어요! 내일 또 파 봐요.');
    y.n += 1;
    this.db.prepare('UPDATE users SET yard = ? WHERE id = ?').run(JSON.stringify(y), userId);
    const rng = this.game.rng;
    const total = YARD.rewards.reduce((a, x) => a + x.weight, 0);
    let roll = rng() * total;
    let rw = YARD.rewards[0];
    for (const x of YARD.rewards) { roll -= x.weight; if (roll < 0) { rw = x; break; } }
    const user = this.game.getUser(userId);
    const out = { kind: rw.kind, text: rw.text, left: YARD.digsPerDay - y.n };
    if (rw.kind === 'item') {
      const pool = Object.keys(ITEMS).filter((id) => ITEMS[id].rarity === 'common' && ITEMS[id].gacha !== false && !ITEMS[id].reward && !user.owned.includes(id));
      if (pool.length) {
        out.item = pool[Math.floor(rng() * pool.length)];
        this.db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify([...user.owned, out.item]), userId);
      } else { out.kind = 'coins'; }
    }
    if (rw.kind === 'treat') {
      const ids = Object.keys(TREATS).filter((id) => id !== 'cake');
      out.treat = ids[Math.floor(rng() * ids.length)];
      user.treats[out.treat] = (user.treats[out.treat] ?? 0) + 1;
      this.db.prepare('UPDATE users SET treats = ? WHERE id = ?').run(JSON.stringify(user.treats), userId);
    }
    if (rw.kind === 'hearts') { out.hearts = rw.n; this.asks.addHearts(userId, rw.n); }
    if (out.kind === 'coins') { out.coins = (rw.min ?? 5) + Math.floor(rng() * ((rw.max ?? 15) - (rw.min ?? 5) + 1)); this.game.addCoins(userId, out.coins); }
    const events = this.game.track(userId, 'yardDig');
    return { found: out, events };
  }

  // 🔍 간식 반응 기록 (giveTreat에서 불러요). 😍는 애정 보너스 + 하루 몇 번 💗
  taste(userId, dog, treatId) {
    const rating = tasteOf(dog.id, treatId);
    const known = JSON.parse(this.db.prepare('SELECT tastes FROM dogs WHERE id = ?').get(dog.id)?.tastes ?? '{}');
    const first = known[treatId] === undefined;
    known[treatId] = rating;
    this.db.prepare('UPDATE dogs SET tastes = ? WHERE id = ?').run(JSON.stringify(known), dog.id);
    let hearts = 0;
    if (rating === 3) {
      const r = this.row(userId);
      const today = kstDate(this.now());
      const td = r.tasteDay.day === today ? r.tasteDay : { day: today, n: 0 };
      if (td.n < TASTES.loveHeartsPerDay) {
        td.n += 1; hearts = 1;
        this.asks.addHearts(userId, 1);
        this.db.prepare('UPDATE users SET taste_day = ? WHERE id = ?').run(JSON.stringify(td), userId);
      }
    }
    return { type: 'taste', treat: treatId, rating, first, hearts, dogName: dog.name };
  }

  // 가구 세트: 방 4칸이 한 세트면 처음 한 번 보상
  checkSets(userId, room) {
    const r = this.row(userId);
    const events = [];
    for (const [id, S] of Object.entries(ROOM_SETS)) {
      if (r.sets.includes(id)) continue;
      const placed = Object.values(room ?? {});
      if (!S.items.every((it) => placed.includes(it))) continue;
      r.sets.push(id);
      this.asks.addHearts(userId, SET_REWARD.hearts);
      this.game.addCoins(userId, SET_REWARD.coins);
      events.push({ type: 'setDone', id, name: S.name, ...SET_REWARD });
    }
    if (events.length) this.db.prepare('UPDATE users SET sets = ? WHERE id = ?').run(JSON.stringify(r.sets), userId);
    return events;
  }

  view(userId) {
    const r = this.row(userId);
    const today = kstDate(this.now());
    return { places: r.places, sets: r.sets, digsLeft: YARD.digsPerDay - (r.yard.day === today ? r.yard.n : 0) };
  }
}

export const tasteFace = (rating) => TASTES.faces[rating];
