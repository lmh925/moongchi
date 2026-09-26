// 2인 협동 미니게임 공통 허브
// 구조: 입력 수신(coop:input) → 게임 규칙이 상태(State) 갱신 → 두 사람에게 상태 방송(coop:state) → 각자 화면 렌더링
// 역할: p1 = 먼저 기다린 사람(방장), p2 = 나중에 온 사람(손님)
import crypto from 'node:crypto';
import { COOP_GAMES, ITEMS } from '../../shared/data.js';
import { kstDate } from '../../shared/rules.js';
import { ribbon } from '../../shared/coop/ribbon.js';
import { jumprope } from '../../shared/coop/jumprope.js';
import { cushion } from '../../shared/coop/cushion.js';
import { bakery } from '../../shared/coop/bakery.js';
import { tidy } from '../../shared/coop/tidy.js';

export const GAMES = { ribbon, jumprope, cushion, bakery, tidy };
const DAILY_COIN_CAP = 80;

export class CoopHub {
  constructor(io, { game, bonds, safety, plaza, now = () => Date.now() }) {
    this.io = io;
    this.game = game;
    this.bonds = bonds;
    this.safety = safety;
    this.plaza = plaza;
    this.now = now;
    this.queues = new Map(); // `${channel}:${gameId}` -> { userId, socketId }
    this.sessions = new Map();
    this.byUser = new Map();
    this.coins = new Map();
    this.ticker = setInterval(() => this.tick(), 50);
    this.ticker.unref?.();
    plaza.onLeave = (userId) => this.cancel(userId);
  }

  bind(socket) {
    const { userId } = socket.data;
    const reply = (fn) => (typeof fn === 'function' ? fn : () => {});
    socket.on('coop:queue', (msg, cb) => reply(cb)(this.queue(socket, String(msg?.game ?? ''))));
    socket.on('coop:cancel', () => this.cancel(userId));
    socket.on('coop:input', (msg) => this.input(userId, String(msg?.sid ?? ''), msg?.input));
    socket.on('coop:leave', () => this.leaveSession(userId));
    socket.on('disconnect', () => { this.cancel(userId); this.leaveSession(userId); });
  }

  queueKey(channel, gameId) { return `${channel}:${gameId}`; }

  // 놀이 장소에서 "같이 하기" → 기다리는 친구가 있으면 바로 시작, 없으면 기다려요
  queue(socket, gameId) {
    const { userId } = socket.data;
    if (!GAMES[gameId]) return { ok: false, reason: '그런 놀이는 없어요.' };
    const m = this.plaza.member(socket);
    if (!m) return { ok: false, reason: '놀이터에서 할 수 있어요.' };
    if (this.byUser.has(userId)) return { ok: false, reason: '벌써 놀고 있어요!' };
    this.cancel(userId);
    const key = this.queueKey(socket.data.plaza, gameId);
    const waiting = this.queues.get(key);
    if (waiting && waiting.userId !== userId && !this.safety.isBlocked(waiting.userId, userId) && this.io.sockets.sockets.get(waiting.socketId)) {
      this.queues.delete(key);
      this.announce(socket.data.plaza, gameId, null);
      this.start(gameId, waiting, { userId, socketId: socket.id }, socket.data.plaza);
      return { ok: true, started: true };
    }
    this.queues.set(key, { userId, socketId: socket.id, nickname: m.nickname });
    this.announce(socket.data.plaza, gameId, { userId, nickname: m.nickname });
    return { ok: true, waiting: true };
  }

  announce(channel, gameId, waiting) {
    this.io.to(`plaza:${channel}`).emit('coop:queue', { game: gameId, waiting });
  }

  cancel(userId) {
    for (const [key, q] of this.queues) {
      if (q.userId === userId) {
        this.queues.delete(key);
        const [channel, gameId] = key.split(':');
        this.announce(channel, gameId, null);
      }
    }
  }

  player(p) {
    const user = this.game.getUser(p.userId);
    return { userId: p.userId, socketId: p.socketId, nickname: user.nickname, dog: this.game.publicDog(this.game.loadDog(p.userId)) };
  }

  start(gameId, a, b, channel) {
    const sid = crypto.randomBytes(8).toString('hex');
    const now = this.now();
    const session = {
      sid, gameId, channel,
      players: { p1: this.player(a), p2: this.player(b) },
      state: GAMES[gameId].init({ now }),
    };
    this.sessions.set(sid, session);
    this.byUser.set(a.userId, sid);
    this.byUser.set(b.userId, sid);
    const players = Object.fromEntries(Object.entries(session.players).map(([r, p]) => [r, { userId: p.userId, nickname: p.nickname, dog: p.dog }]));
    for (const role of ['p1', 'p2']) {
      this.io.sockets.sockets.get(session.players[role].socketId)?.emit('coop:start', {
        sid, game: gameId, name: COOP_GAMES[gameId].name, role, players, state: session.state, now,
      });
    }
    return session;
  }

  send(session, event, payload) {
    for (const role of ['p1', 'p2']) this.io.sockets.sockets.get(session.players[role].socketId)?.emit(event, payload);
  }

  input(userId, sid, input) {
    const session = this.sessions.get(sid);
    if (!session) return;
    const role = Object.keys(session.players).find((r) => session.players[r].userId === userId);
    if (!role) return;
    const events = GAMES[session.gameId].input(session.state, { role, input, now: this.now() });
    if (events.length) this.send(session, 'coop:state', { sid, state: session.state, events, now: this.now() });
    if (session.state.status !== 'play') this.finish(session);
  }

  tick() {
    const now = this.now();
    for (const session of this.sessions.values()) {
      const g = GAMES[session.gameId];
      const events = g.tick(session.state, now);
      // 움직임이 있는 게임은 변화가 없어도 매 틱(20번/초) 상태를 보내요
      if (events.length || g.realtime) this.send(session, 'coop:state', { sid: session.sid, state: session.state, events, now });
      if (session.state.status !== 'play') this.finish(session);
    }
  }

  finish(session, reason = null) {
    if (!this.sessions.has(session.sid)) return;
    this.sessions.delete(session.sid);
    const today = kstDate(this.now());
    const base = reason ? { coins: 0, item: null } : GAMES[session.gameId].reward(session.state);
    const results = {};
    for (const role of ['p1', 'p2']) {
      const { userId } = session.players[role];
      this.byUser.delete(userId);
      const key = `${userId}:${today}`;
      const got = this.coins.get(key) ?? 0;
      const coins = Math.max(0, Math.min(base.coins, DAILY_COIN_CAP - got));
      this.coins.set(key, got + coins);
      this.game.addCoins(userId, coins);
      let item = null;
      if (base.item && ITEMS[base.item]) {
        const user = this.game.getUser(userId);
        if (!user.owned.includes(base.item)) {
          user.owned.push(base.item);
          this.game.db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify(user.owned), userId);
          item = base.item;
        }
      }
      results[role] = { coins, item };
    }
    if (!reason) this.bonds.add(session.players.p1.userId, session.players.p2.userId, 'play');
    const summary = GAMES[session.gameId].summary?.(session.state) ?? null;
    this.send(session, 'coop:end', { sid: session.sid, status: reason ?? session.state.status, results, summary });
  }

  leaveSession(userId) {
    const sid = this.byUser.get(userId);
    const session = sid && this.sessions.get(sid);
    if (session) this.finish(session, 'left');
  }
}
