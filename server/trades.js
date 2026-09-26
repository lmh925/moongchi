// 멍뭉거래: 친구끼리 소품·옷을 바꿔요. 제안 → 친구가 확인하고 수락하면 서버가 한 번에 맞바꿔요.
import { ITEMS, TRADE, DEFAULT_OWNED } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';
import { tx } from './db.js';
import { GameError } from './game.js';

const parse = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };

export function tradeValue(ids) {
  return ids.reduce((a, id) => a + (TRADE.value[ITEMS[id]?.rarity] ?? 1), 0);
}

// 주는 쪽이 받는 쪽보다 훨씬 많이 주면 true (아이 스스로 한 번 더 생각하게)
export function isUnfair(give, ask) {
  const g = tradeValue(give); const a = tradeValue(ask);
  return g >= Math.max(1, a) * TRADE.unfairRatio || a >= Math.max(1, g) * TRADE.unfairRatio;
}

export class Trades {
  constructor(db, { game, friends, safety, progress }) {
    this.db = db;
    this.game = game;
    this.friends = friends;
    this.safety = safety;
    this.progress = progress;
  }

  now() { return this.game.now(); }

  locks(userId) {
    return parse(this.db.prepare('SELECT trade_locks FROM users WHERE id = ?').get(userId)?.trade_locks, {});
  }

  // 착용 중(강아지 누구든, 방 꾸미기)인 아이템
  inUse(userId) {
    const used = new Set();
    for (const d of this.game.loadDogs(userId)) for (const id of Object.values(d.equip ?? {})) used.add(id);
    for (const id of Object.values(this.game.getUser(userId).room ?? {})) if (id) used.add(id);
    return used;
  }

  // 한 사람의 아이템마다 거래할 수 있는지와 이유
  itemStates(userId) {
    const user = this.game.getUser(userId);
    const locks = this.locks(userId);
    const used = this.inUse(userId);
    const now = this.now();
    return user.owned.filter((id) => ITEMS[id]).map((id) => {
      let why = null;
      if (DEFAULT_OWNED.includes(id)) why = 'basic';
      else if (ITEMS[id].reward) why = 'reward';
      else if (used.has(id)) why = 'equipped';
      else if ((locks[id] ?? 0) > now) why = 'locked';
      return { id, why, until: why === 'locked' ? locks[id] : undefined };
    });
  }

  tradable(userId) {
    return this.itemStates(userId).filter((s) => !s.why).map((s) => s.id);
  }

  checkFriend(userId, otherId) {
    if (userId === otherId || !this.friends.areFriends(userId, otherId)) throw new GameError('친구하고만 거래할 수 있어요.');
    if (this.safety?.isBlocked(userId, otherId)) throw new GameError('이 친구와는 거래할 수 없어요.');
  }

  // 거래 창에 보여 줄 목록: 내가 내놓을 수 있는 것 / 친구에게 받고 싶은 것
  options(userId, friendId) {
    this.checkFriend(userId, friendId);
    const mineOwned = new Set(this.game.getUser(userId).owned);
    const theirOwned = new Set(this.game.getUser(friendId).owned);
    return {
      mine: this.itemStates(userId).map((s) => ({ ...s, why: s.why ?? (theirOwned.has(s.id) ? 'theyHave' : null) })),
      theirs: this.tradable(friendId).filter((id) => !mineOwned.has(id)),
      doneToday: this.doneToday(userId),
    };
  }

  doneToday(userId) {
    const dayStart = Date.parse(`${kstDate(this.now())}T00:00:00+09:00`);
    return this.db.prepare("SELECT COUNT(*) AS n FROM trades WHERE status = 'accepted' AND done_at >= ? AND (from_id = ? OR to_id = ?)")
      .get(dayStart, userId, userId).n;
  }

  cleanList(list) {
    if (!Array.isArray(list)) return [];
    return [...new Set(list.map(String))].filter((id) => ITEMS[id]);
  }

  // 양쪽 아이템이 지금도 거래 가능한지 확인
  validate(fromId, toId, give, ask) {
    const fromOK = new Set(this.tradable(fromId));
    const toOK = new Set(this.tradable(toId));
    const fromOwned = new Set(this.game.getUser(fromId).owned);
    const toOwned = new Set(this.game.getUser(toId).owned);
    for (const id of give) {
      if (!fromOK.has(id)) throw new GameError(`${ITEMS[id].name}은(는) 지금 거래할 수 없어요.`);
      if (toOwned.has(id)) throw new GameError(`친구가 이미 ${ITEMS[id].name}을(를) 가지고 있어요.`);
    }
    for (const id of ask) {
      if (!toOK.has(id)) throw new GameError(`${ITEMS[id].name}은(는) 지금 거래할 수 없어요.`);
      if (fromOwned.has(id)) throw new GameError(`이미 ${ITEMS[id].name}을(를) 가지고 있어요.`);
    }
  }

  offer(fromId, toId, give, ask) {
    toId = Number(toId);
    this.checkFriend(fromId, toId);
    give = this.cleanList(give); ask = this.cleanList(ask);
    if (!give.length && !ask.length) throw new GameError('주거나 받을 아이템을 골라 주세요.');
    if (give.length > TRADE.maxItems || ask.length > TRADE.maxItems) throw new GameError(`한 번에 ${TRADE.maxItems}개까지 골라요.`);
    if (!give.length) throw new GameError('받기만 할 수는 없어요. 줄 아이템도 하나 골라 주세요!');
    this.expireOld();
    const pending = this.db.prepare("SELECT COUNT(*) AS n FROM trades WHERE from_id = ? AND status = 'pending'").get(fromId).n;
    if (pending >= TRADE.maxPending) throw new GameError(`보낸 제안이 ${TRADE.maxPending}개예요. 친구가 답할 때까지 기다려 주세요.`);
    this.validate(fromId, toId, give, ask);
    const res = this.db.prepare('INSERT INTO trades (from_id, to_id, give, ask, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(fromId, toId, JSON.stringify(give), JSON.stringify(ask), this.now());
    return this.view(this.get(Number(res.lastInsertRowid)), fromId);
  }

  get(id) {
    const r = this.db.prepare('SELECT * FROM trades WHERE id = ?').get(Number(id));
    if (!r) return null;
    return { id: r.id, fromId: r.from_id, toId: r.to_id, give: parse(r.give, []), ask: parse(r.ask, []), status: r.status, createdAt: r.created_at, doneAt: r.done_at };
  }

  // 보는 사람 기준으로: 내가 주는 것 / 받는 것
  view(t, viewerId) {
    const incoming = t.toId === viewerId;
    const other = this.game.getUser(incoming ? t.fromId : t.toId);
    const iGive = incoming ? t.ask : t.give;
    const iGet = incoming ? t.give : t.ask;
    return {
      id: t.id, status: t.status, incoming, createdAt: t.createdAt, doneAt: t.doneAt,
      with: { id: other?.id, nickname: other?.nickname ?? '(떠난 친구)' },
      iGive, iGet, unfair: isUnfair(iGive, iGet), giveMore: tradeValue(iGive) > tradeValue(iGet),
      expiresAt: t.createdAt + TRADE.expireMs,
    };
  }

  expireOld() {
    this.db.prepare("UPDATE trades SET status = 'expired', done_at = ? WHERE status = 'pending' AND created_at < ?")
      .run(this.now(), this.now() - TRADE.expireMs);
  }

  list(userId) {
    this.expireOld();
    const rows = this.db.prepare(`SELECT id FROM trades WHERE (from_id = ? OR to_id = ?) AND (status = 'pending' OR done_at >= ?)
      ORDER BY created_at DESC LIMIT 40`).all(userId, userId, this.now() - 7 * 24 * 3600_000);
    const all = rows.map((r) => this.view(this.get(r.id), userId));
    return {
      incoming: all.filter((t) => t.status === 'pending' && t.incoming),
      outgoing: all.filter((t) => t.status === 'pending' && !t.incoming),
      history: all.filter((t) => t.status !== 'pending').slice(0, 20),
      doneToday: this.doneToday(userId),
    };
  }

  pendingFor(userId) {
    this.expireOld();
    return this.db.prepare("SELECT COUNT(*) AS n FROM trades WHERE to_id = ? AND status = 'pending'").get(userId).n;
  }

  respond(userId, tradeId, accept) {
    const t = this.get(tradeId);
    if (!t || t.toId !== userId) throw new GameError('그런 제안은 없어요.');
    this.expireOld();
    if (this.get(tradeId).status !== 'pending') throw new GameError('이미 끝난 제안이에요.');
    if (!accept) {
      this.db.prepare("UPDATE trades SET status = 'declined', done_at = ? WHERE id = ?").run(this.now(), t.id);
      return { trade: this.view(this.get(t.id), userId), events: [] };
    }
    this.checkFriend(t.fromId, t.toId);
    for (const uid of [t.fromId, t.toId]) {
      if (this.doneToday(uid) >= TRADE.dailyTrades) throw new GameError(`오늘은 거래를 ${TRADE.dailyTrades}번 다 했어요. 내일 또 해요!`);
    }
    const events = tx(this.db, () => {
      this.validate(t.fromId, t.toId, t.give, t.ask);
      const until = this.now() + TRADE.lockMs;
      const move = (uid, remove, add) => {
        const user = this.game.getUser(uid);
        const owned = user.owned.filter((id) => !remove.includes(id)).concat(add);
        const locks = this.locks(uid);
        for (const id of remove) delete locks[id];
        for (const id of add) locks[id] = until;
        this.db.prepare('UPDATE users SET owned = ?, trade_locks = ? WHERE id = ?').run(JSON.stringify(owned), JSON.stringify(locks), uid);
      };
      move(t.fromId, t.give, t.ask);
      move(t.toId, t.ask, t.give);
      this.db.prepare("UPDATE trades SET status = 'accepted', done_at = ? WHERE id = ?").run(this.now(), t.id);
      return this.progress?.track(userId, 'trade') ?? [];
    });
    const fromEvents = this.progress?.track(t.fromId, 'trade') ?? [];
    return { trade: this.view(this.get(t.id), userId), events, fromEvents };
  }

  cancel(userId, tradeId) {
    const t = this.get(tradeId);
    if (!t || t.fromId !== userId) throw new GameError('그런 제안은 없어요.');
    if (t.status !== 'pending') throw new GameError('이미 끝난 제안이에요.');
    this.db.prepare("UPDATE trades SET status = 'cancelled', done_at = ? WHERE id = ?").run(this.now(), t.id);
    return this.view(this.get(t.id), userId);
  }
}
