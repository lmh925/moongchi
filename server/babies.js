// 아기 강아지 선물: 다 자란 두 강아지가 영혼의 단짝이면, 두 친구가 함께 소원을 빌어요.
// 소원 → 친구가 수락 → 며칠 뒤 두 집 우편함에 아기 강아지 선물 상자 → 이름을 지어 주면 새 가족!
import crypto from 'node:crypto';
import { BABY, PERSONALITIES, BREEDS } from '../shared/data.js';
import { breedOf } from '../shared/rules.js';
import { tx } from './db.js';
import { GameError } from './game.js';

export class Babies {
  constructor(db, { game, friends, safety, bonds, progress, rng = Math.random }) {
    this.db = db;
    this.game = game;
    this.friends = friends;
    this.safety = safety;
    this.bonds = bonds;
    this.progress = progress;
    this.rng = rng;
  }

  now() { return this.game.now(); }

  // 소원을 빌 수 있는지 (이유를 같이 알려 줘요)
  check(a, b) {
    if (a === b || !this.friends.areFriends(a, b)) return '친구하고만 소원을 빌 수 있어요.';
    if (this.safety?.isBlocked(a, b)) return '이 친구와는 소원을 빌 수 없어요.';
    const bond = this.bonds.get(a, b);
    if (bond.level < BABY.bondLevel) return '두 강아지가 "영혼의 단짝"이 되어야 해요.';
    const open = this.db.prepare(`SELECT 1 FROM wishes WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
      AND (status = 'pending' OR (status = 'accepted' AND delivered < 2))`).get(a, b, b, a);
    if (open) return '이미 소원을 빌었어요. 선물을 기다려 주세요!';
    const last = this.db.prepare(`SELECT MAX(created_at) AS t FROM wishes WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) AND status = 'accepted'`).get(a, b, b, a).t;
    if (last && this.now() - last < BABY.cooldownMs / this.game.speed) return '조금 더 지나서 다시 소원을 빌 수 있어요.';
    const da = this.game.loadDog(a); const db = this.game.loadDog(b);
    if (!da || !db || da.stage < 2 || db.stage < 2) return '두 대표 강아지가 모두 늠름한 강아지로 다 자라야 해요.';
    return null;
  }

  wish(fromId, toId) {
    toId = Number(toId);
    const why = this.check(fromId, toId);
    if (why) throw new GameError(why);
    const res = this.db.prepare('INSERT INTO wishes (from_id, to_id, from_dog, created_at) VALUES (?, ?, ?, ?)')
      .run(fromId, toId, this.game.loadDog(fromId).id, this.now());
    return this.view(Number(res.lastInsertRowid), fromId);
  }

  get(id) {
    return this.db.prepare('SELECT * FROM wishes WHERE id = ?').get(Number(id));
  }

  view(id, viewerId) {
    const w = this.get(id);
    if (!w) return null;
    const otherId = w.from_id === viewerId ? w.to_id : w.from_id;
    const other = this.game.getUser(otherId);
    const fromDog = this.game.loadDogById(w.from_dog);
    return {
      id: w.id, status: w.status, incoming: w.to_id === viewerId, arrivesAt: w.arrives_at,
      with: { id: otherId, nickname: other?.nickname ?? '(떠난 친구)' },
      fromDog: fromDog ? { name: fromDog.name, breed: fromDog.breed, stage: fromDog.stage } : null,
    };
  }

  list(userId) {
    return this.db.prepare(`SELECT id FROM wishes WHERE (from_id = ? OR to_id = ?) AND (status = 'pending' OR (status = 'accepted' AND delivered < 2))
      ORDER BY created_at DESC`).all(userId, userId).map((r) => this.view(r.id, userId));
  }

  // 두 부모를 반씩 닮은 아기: 같은 견종이면 그 견종, 다르면 털색·모양을 한쪽씩
  makeBaby(a, b) {
    // 스페셜 모습은 물려주지 않아요: 원래 견종(없으면 닮은 보통 견종)으로
    const NORMAL = { mini_bichon: 'bichon', big_maltese: 'maltese', bipoo_kiki: 'bichon' };
    const base = (d) => {
      let id = d.special ? d.baseBreed ?? d.breed : d.breed;
      if (id.startsWith('mix:')) id = id.split(':')[1 + Math.floor(this.rng() * 2)];
      if (BREEDS[id]?.special) id = NORMAL[id] ?? null;
      return id;
    };
    const ca = base(a) ?? base(b) ?? 'bichon'; const cb = base(b) ?? ca;
    const breed = ca === cb ? ca : (this.rng() < 0.5 ? `mix:${ca}:${cb}` : `mix:${cb}:${ca}`);
    const personality = this.rng() < 0.5 ? a.personality : b.personality;
    return { breed, personality: PERSONALITIES[personality] ? personality : 'sweet' };
  }

  respond(userId, wishId, accept) {
    const w = this.get(wishId);
    if (!w || w.to_id !== userId) throw new GameError('그런 소원은 없어요.');
    if (w.status !== 'pending') throw new GameError('이미 끝난 소원이에요.');
    if (!accept) {
      this.db.prepare("UPDATE wishes SET status = 'declined' WHERE id = ?").run(w.id);
      return this.view(w.id, userId);
    }
    const again = this.check(w.from_id, w.to_id === userId ? userId : w.to_id);
    if (again && !again.startsWith('이미')) throw new GameError(again);
    const fromDog = this.game.loadDogById(w.from_dog) ?? this.game.loadDog(w.from_id);
    const toDog = this.game.loadDog(userId);
    const baby = this.makeBaby(fromDog, toDog);
    baby.parents = [
      { name: fromDog.name, owner: this.game.getUser(w.from_id).nickname, dogId: fromDog.id },
      { name: toDog.name, owner: this.game.getUser(userId).nickname, dogId: toDog.id },
    ];
    this.db.prepare("UPDATE wishes SET status = 'accepted', to_dog = ?, baby = ?, arrives_at = ? WHERE id = ?")
      .run(toDog.id, JSON.stringify(baby), this.now() + BABY.arriveMs / this.game.speed, w.id);
    return this.view(w.id, userId);
  }

  cancel(userId, wishId) {
    const w = this.get(wishId);
    if (!w || w.from_id !== userId || w.status !== 'pending') throw new GameError('취소할 수 없는 소원이에요.');
    this.db.prepare("UPDATE wishes SET status = 'cancelled' WHERE id = ?").run(w.id);
  }

  // 도착할 시간이 된 선물을 두 집 우편함에 넣어요 (/me 때마다)
  deliver(userId) {
    const rows = this.db.prepare(`SELECT * FROM wishes WHERE status = 'accepted' AND arrives_at <= ? AND delivered < 2 AND (from_id = ? OR to_id = ?)`)
      .all(this.now(), userId, userId);
    const events = [];
    for (const w of rows) {
      const baby = JSON.parse(w.baby);
      tx(this.db, () => {
        for (const uid of [w.from_id, w.to_id]) {
          this.progress.sendMail(uid, 'baby', {
            from: '멍뭉 우체부', title: '아기 강아지 선물 상자!', wishId: w.id, gift: crypto.randomBytes(6).toString('hex'),
            body: `${baby.parents[0].name}와(과) ${baby.parents[1].name}의 소원이 이루어졌어요! 상자 안에서 꼬물꼬물… 누가 있을까요?`,
            baby,
          });
        }
        this.db.prepare('UPDATE wishes SET delivered = 2 WHERE id = ?').run(w.id);
        for (const d of [w.from_dog, w.to_dog]) this.db.prepare('UPDATE dogs SET kids = kids + 1 WHERE id = ?').run(d);
      });
      events.push({ type: 'mail', from: '멍뭉 우체부' });
    }
    return events;
  }

  // 선물 상자를 열고 이름을 지어 주면 새 가족이 돼요 (입양 칸 레벨 조건 없이, 최대 3마리까지)
  adopt(userId, mailId, name) {
    const m = this.db.prepare("SELECT * FROM mail WHERE id = ? AND user_id = ? AND kind = 'baby'").get(Number(mailId), userId);
    if (!m) throw new GameError('그런 선물 상자는 없어요.', 404);
    const data = JSON.parse(m.data);
    if (data.claimed) throw new GameError('이미 가족이 되었어요!');
    if (this.game.loadDogs(userId).length >= BABY.maxDogs) throw new GameError(`우리 집에는 강아지가 ${BABY.maxDogs}마리까지 살 수 있어요.`);
    if (!breedOf(data.baby.breed)) throw new GameError('선물 상자가 이상해요.');
    if (this.game.loadDog(userId)) this.game.refreshDog(userId); // 지금 대표의 상태를 먼저 저장
    return tx(this.db, () => {
      const dog = this.game.createBaby(userId, { name, breed: data.baby.breed, personality: data.baby.personality, parents: data.baby.parents });
      this.db.prepare('UPDATE mail SET opened = 1, data = ? WHERE id = ?').run(JSON.stringify({ ...data, claimed: true }), m.id);
      return dog;
    });
  }
}
