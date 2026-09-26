// 멍뭉 놀이터: 누구나 들어오는 공개 광장 (채널당 최대 20마리)
// 흐름: 클라이언트 입력(plaza:pos, plaza:emote ...) → 서버 상태 갱신 → 같은 채널에 방송 → 각자 화면 그리기
import { PLAZA, PLAZA_SPOTS, STICKERS, PHRASES, TAG, TREASURE, ITEMS, SOCCER, EMOTES, TALENT_GAINS, PLAY_EXP } from '../shared/data.js';
import { kstDate, levelFromExp } from '../shared/rules.js';
import { REPORT_REASONS } from './safety.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));

export class PlazaHub {
  constructor(io, { game, friends, safety, bonds }) {
    this.io = io;
    this.game = game;
    this.friends = friends;
    this.safety = safety;
    this.bonds = bonds;
    this.channels = new Map(); // id -> { id, members: Map<userId, member>, tag }
    this.tagCoins = new Map();
    this.treasureCoins = new Map();
    this.soccerCoins = new Map();
    this.onLeave = null; // 협동 게임 등에서 알림 받기
    this.ticker = setInterval(() => this.tick(), 100);
    this.ticker.unref?.();
  }

  bind(socket) {
    const { userId } = socket.data;
    const ack = (fn) => (typeof fn === 'function' ? fn : () => {});
    socket.on('plaza:join', (msg, cb) => ack(cb)(this.join(socket, msg?.channel)));
    socket.on('plaza:leave', () => this.leave(socket));
    socket.on('plaza:channels', (_, cb) => ack(cb)(this.channelList(userId)));
    socket.on('plaza:pos', (msg) => {
      const m = this.member(socket);
      if (!m) return;
      const now = Date.now();
      if (now - m.lastPos < 1000 / (PLAZA.posHz * 2)) return;
      m.lastPos = now;
      m.x = clamp(msg?.x, 0, PLAZA.worldW);
      m.y = clamp(msg?.y, 0, PLAZA.worldH);
      m.dir = msg?.dir === -1 ? -1 : 1;
      m.vx = (m.x - (m.px ?? m.x)) / Math.max(0.05, (now - (m.pt ?? now - 100)) / 1000);
      m.vy = (m.y - (m.py ?? m.y)) / Math.max(0.05, (now - (m.pt ?? now - 100)) / 1000);
      m.px = m.x; m.py = m.y; m.pt = now;
      m.moving = !!msg?.moving;
      m.dirty = true; // 0.1초마다 모아서 한 번에 보내요 (tick → flushPositions)
    });
    socket.on('plaza:sticker', (msg) => {
      const m = this.member(socket);
      if (!m || !STICKERS[msg?.id] || !this.gate(m, 1200)) return;
      this.broadcast(m, 'plaza:bubble', { userId, kind: 'sticker', value: msg.id });
    });
    socket.on('plaza:phrase', (msg) => {
      const m = this.member(socket);
      const text = PHRASES[msg?.index];
      if (!m || !text || !this.gate(m, 1200)) return;
      this.broadcast(m, 'plaza:bubble', { userId, kind: 'text', value: text });
    });
    socket.on('plaza:emote', (msg) => {
      const m = this.member(socket);
      const emote = EMOTES[msg?.kind];
      if (!m || !emote || !this.gate(m, 700)) return;
      if (emote.level > 1 && levelFromExp(this.game.loadDog(userId)?.exp ?? 0) < emote.level) return;
      this.broadcast(m, 'plaza:emote', { userId, kind: msg.kind });
    });
    socket.on('plaza:block', (msg, cb) => {
      const target = Number(msg?.userId);
      try {
        this.safety.block(userId, target);
        this.hidePair(userId, target);
        ack(cb)({ ok: true });
      } catch (err) { ack(cb)({ ok: false, reason: err.message }); }
    });
    socket.on('plaza:report', (msg, cb) => {
      const target = Number(msg?.userId);
      try {
        const res = this.safety.report(userId, target, msg?.reason, 'plaza');
        this.hidePair(userId, target);
        if (res.banned) this.kickUser(target, '신고가 여러 번 들어와서 오늘은 놀이터에 들어갈 수 없어요.');
        ack(cb)({ ok: true });
      } catch (err) { ack(cb)({ ok: false, reason: err.message }); }
    });
    socket.on('treasure:dig', (msg, cb) => ack(cb)(this.dig(socket, msg)));
    socket.on('soccer:join', (_, cb) => ack(cb)(this.soccerJoin(socket)));
    socket.on('soccer:leave', () => this.soccerLeave(socket.data.plaza, userId));
    socket.on('soccer:kick', () => this.soccerKick(socket));
    socket.on('tag:join', (_, cb) => ack(cb)(this.tagJoin(socket)));
    socket.on('tag:leave', () => this.tagLeave(socket.data.plaza, userId));
    socket.on('disconnect', () => this.leave(socket));
  }

  // ---------- 입장/퇴장 ----------
  channelList(userId) {
    const friendIds = new Set(this.friends.friendIds(userId));
    const list = [...this.channels.values()].map((c) => ({
      id: c.id, count: c.members.size, full: c.members.size >= PLAZA.cap,
      friends: [...c.members.keys()].filter((id) => friendIds.has(id)).length,
    }));
    return list.sort((a, b) => a.id - b.id);
  }

  pickChannel(userId, wanted) {
    if (wanted && this.channels.get(wanted)?.members.size < PLAZA.cap) return wanted;
    // 친구가 있는 놀이터 먼저, 그다음 사람이 있는 놀이터, 다 차면 새 놀이터
    const list = this.channelList(userId).filter((c) => !c.full);
    list.sort((a, b) => b.friends - a.friends || b.count - a.count);
    if (list.length) return list[0].id;
    let id = 1;
    while (this.channels.has(id)) id += 1;
    return id;
  }

  join(socket, wanted) {
    const { userId } = socket.data;
    const until = this.safety.bannedUntil(userId);
    if (until) return { ok: false, reason: '신고가 여러 번 들어와서 지금은 놀이터에 들어갈 수 없어요. 내일 다시 와 주세요.' };
    const { dog } = this.game.refreshDog(userId);
    if (!dog) return { ok: false, reason: '강아지가 없어요.' };
    if (dog.school) return { ok: false, reason: `${dog.name}(은)는 학교에 가 있어요!` };
    this.leave(socket);
    // 다른 창에서 놀이터에 있었다면 내보내요
    for (const c of this.channels.values()) {
      const old = c.members.get(userId);
      if (old) {
        const s = this.io.sockets.sockets.get(old.socketId);
        if (s) { this.leave(s); s.emit('plaza:kicked', { reason: '다른 창에서 놀이터에 들어갔어요.' }); }
      }
    }
    const id = this.pickChannel(userId, Number(wanted) || null);
    if (!this.channels.has(id)) this.channels.set(id, { id, members: new Map(), tag: null, treasures: [], nextTreasure: 0, diggers: new Map() });
    const ch = this.channels.get(id);
    const spot = PLAZA_SPOTS.fountain;
    const m = {
      userId, socketId: socket.id, nickname: this.game.getUser(userId).nickname, dog: this.game.plazaDog(dog),
      hidden: new Set(this.hiddenFor(userId)),
      x: spot.x + (Math.random() - 0.5) * 60, y: spot.y + 40 + Math.random() * 20, dir: 1, moving: false, lastPos: 0, lastEmote: 0,
    };
    ch.members.set(userId, m);
    socket.data.plaza = id;
    socket.join(`plaza:${id}`);
    const blocked = m.hidden;
    this.broadcast(m, 'plaza:enter', this.view(m));
    this.game.track(userId, 'plaza', 1, { push: true });
    const others = [...ch.members.values()].filter((o) => o.userId !== userId && !blocked.has(o.userId));
    if (others.length) this.game.seeBreeds(userId, others.map((o) => o.dog?.breed));
    for (const o of others) this.game.seeBreeds(o.userId, [m.dog?.breed]);
    const trio = this.game.trioGathering(userId, [m, ...others].map((o) => ({ userId: o.userId, special: o.dog?.special })));
    if (trio) setTimeout(() => this.io.to(`plaza:${id}`).emit('trio', trio), 600);
    return {
      ok: true,
      channel: id,
      channels: this.channelList(userId),
      members: [...ch.members.values()].filter((o) => !blocked.has(o.userId)).map((o) => this.view(o)),
      tag: this.tagView(ch),
      treasures: ch.treasures.length,
      soccer: this.soccerView(ch),
      friends: this.friends.friendIds(userId),
    };
  }

  leave(socket) {
    const id = socket.data.plaza;
    if (id === undefined) return;
    const ch = this.channels.get(id);
    const m = ch?.members.get(socket.data.userId);
    if (m && m.socketId === socket.id) {
      ch.members.delete(socket.data.userId);
      this.tagLeave(id, socket.data.userId);
      this.soccerLeave(id, socket.data.userId);
      socket.to(`plaza:${id}`).emit('plaza:exit', { userId: socket.data.userId });
      if (ch.members.size === 0) this.channels.delete(id);
      this.onLeave?.(socket.data.userId);
    }
    socket.leave(`plaza:${id}`);
    socket.data.plaza = undefined;
  }

  kickUser(userId, reason) {
    for (const c of this.channels.values()) {
      const m = c.members.get(userId);
      const s = m && this.io.sockets.sockets.get(m.socketId);
      if (s) { this.leave(s); s.emit('plaza:kicked', { reason }); }
    }
  }

  // 운영자가 놀이터 입장을 막으면 지금 있는 놀이터에서도 내보내요
  kick(userId, reason) {
    for (const ch of this.channels.values()) {
      const m = ch.members.get(userId);
      const s = m && this.io.sockets.sockets.get(m.socketId);
      if (s) { this.leave(s); s.emit('plaza:kicked', { reason }); }
    }
  }

  // 칭호·성장 모습이 바뀌면 놀이터 친구들에게도 알려요
  dogChanged(userId) {
    for (const ch of this.channels.values()) {
      const m = ch.members.get(userId);
      if (!m) continue;
      m.dog = this.game.plazaDog(this.game.loadDog(userId));
      this.broadcast(m, 'plaza:dog', { userId, dog: m.dog });
      this.io.sockets.sockets.get(m.socketId)?.emit('plaza:dog', { userId, dog: m.dog });
    }
  }

  member(socket) {
    const m = this.channels.get(socket.data.plaza)?.members.get(socket.data.userId);
    return m && m.socketId === socket.id ? m : null;
  }

  view(m) {
    return { userId: m.userId, nickname: m.nickname, dog: m.dog, x: m.x, y: m.y, dir: m.dir, moving: m.moving };
  }

  gate(m, gap) {
    const now = Date.now();
    if (now - m.lastEmote < gap) return false;
    m.lastEmote = now;
    return true;
  }

  // 나를 차단했거나 내가 차단한 사람 목록
  hiddenFor(userId) {
    const mine = this.safety.blockedBy(userId);
    const theirs = this.safety.db.prepare('SELECT user_id FROM blocks WHERE blocked_id = ?').all(userId).map((r) => r.user_id);
    return [...new Set([...mine, ...theirs])];
  }

  // 같은 채널 사람들에게 보내되, 서로 차단한 사이에는 보내지 않아요
  broadcast(from, event, payload, volatile = false) {
    const ch = [...this.channels.values()].find((c) => c.members.get(from.userId) === from);
    if (!ch) return;
    const hidden = from.hidden;
    for (const o of ch.members.values()) {
      if (o.userId === from.userId && event !== 'plaza:bubble' && event !== 'plaza:emote') continue;
      if (hidden.has(o.userId)) continue;
      const s = this.io.sockets.sockets.get(o.socketId);
      if (!s) continue;
      (volatile ? s.volatile : s).emit(event, payload);
    }
  }

  hidePair(a, b) {
    for (const c of this.channels.values()) {
      const ma = c.members.get(a); const mb = c.members.get(b);
      ma?.hidden.add(b); mb?.hidden.add(a);
      if (ma && mb) {
        this.io.sockets.sockets.get(ma.socketId)?.emit('plaza:exit', { userId: b });
        this.io.sockets.sockets.get(mb.socketId)?.emit('plaza:exit', { userId: a });
      }
    }
  }

  // ---------- 보물찾기 (모래밭) ----------
  inSand(m) {
    const s = PLAZA_SPOTS.sand;
    return Math.abs(m.x - s.x) < s.w / 2 && Math.abs(m.y - s.y) < s.h / 2;
  }

  spawnTreasure(ch) {
    const s = PLAZA_SPOTS.sand;
    const total = Object.values(TREASURE.kinds).reduce((a, k) => a + k.weight, 0);
    let roll = Math.random() * total;
    let kind = 'coin';
    for (const [k, v] of Object.entries(TREASURE.kinds)) { if (roll < v.weight) { kind = k; break; } roll -= v.weight; }
    ch.treasures.push({
      id: Math.random().toString(36).slice(2, 8), kind,
      x: s.x - s.w / 2 + 6 + Math.random() * (s.w - 12), y: s.y - s.h / 2 + 8 + Math.random() * (s.h - 12),
    });
    this.io.to(`plaza:${ch.id}`).emit('treasure:count', { n: ch.treasures.length });
  }

  dig(socket, msg) {
    const m = this.member(socket);
    if (!m) return { ok: false, reason: '놀이터에 있을 때 할 수 있어요.' };
    // 멈춘 자리가 마지막 위치 전송보다 조금 앞설 수 있어서, 가까운 거리면 보내 준 위치를 믿어요
    if (msg && Number.isFinite(msg.x) && Number.isFinite(msg.y) && Math.hypot(msg.x - m.x, msg.y - m.y) < 40) {
      m.x = clamp(msg.x, 0, PLAZA.worldW); m.y = clamp(msg.y, 0, PLAZA.worldH);
    }
    if (!this.inSand(m)) return { ok: false, reason: '모래밭 안에서 파 주세요!' };
    const now = Date.now();
    if (now - (m.lastDig ?? 0) < TREASURE.digGapMs) return { ok: false, reason: '영차영차… 조금만 천천히!' };
    m.lastDig = now;
    const ch = this.channels.get(socket.data.plaza);
    ch.diggers.set(m.userId, now);
    this.game.track(m.userId, 'dig', 1, { push: true });
    this.broadcast(m, 'treasure:dig', { userId: m.userId, x: m.x, y: m.y });
    const near = ch.treasures.map((t) => ({ t, d: Math.hypot(t.x - m.x, (t.y - m.y) * 1.3) })).sort((a, b) => a.d - b.d)[0];
    if (!near) return { ok: true, found: false, hint: 'none' };
    if (near.d > TREASURE.findRadius) {
      const warm = this.game.effects(m.userId).warmRadius; // 호기심이 자라면 힌트 범위가 넓어져요
      return { ok: true, found: false, hint: near.d < TREASURE.hotRadius ? 'hot' : near.d < warm ? 'warm' : 'cold' };
    }
    // 찾았어요!
    ch.treasures = ch.treasures.filter((t) => t !== near.t);
    const kind = TREASURE.kinds[near.t.kind];
    const coins = this.giveTreasureCoins(m.userId, kind.coins);
    let item = null;
    if (kind.item) {
      const user = this.game.getUser(m.userId);
      const pool = Object.keys(ITEMS).filter((id) => ITEMS[id].gacha !== false && !ITEMS[id].reward && !user.owned.includes(id) && ITEMS[id].rarity !== 'epic');
      if (pool.length) {
        item = pool[Math.floor(Math.random() * pool.length)];
        user.owned.push(item);
        this.game.db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify(user.owned), m.userId);
      }
    }
    // 최근에 같이 판 친구들도 코인 1개씩
    const helpers = [];
    for (const [uid, at] of ch.diggers) {
      if (uid === m.userId || now - at > TREASURE.helperMs || !ch.members.has(uid) || m.hidden.has(uid)) continue;
      if (this.giveTreasureCoins(uid, 1)) helpers.push(uid);
      this.game.grant(uid, { talents: { curious: 1 } });
    }
    this.game.grant(m.userId, { exp: PLAY_EXP.treasure, talents: TALENT_GAINS.treasure });
    this.game.track(m.userId, 'treasure', 1, { push: true });
    this.io.to(`plaza:${ch.id}`).emit('treasure:found', {
      userId: m.userId, nickname: m.nickname, kind: near.t.kind, x: near.t.x, y: near.t.y, helpers, n: ch.treasures.length,
    });
    return { ok: true, found: true, kind: near.t.kind, coins, item };
  }

  giveTreasureCoins(userId, amount) {
    const key = `${userId}:${kstDate(Date.now())}`;
    const got = this.treasureCoins.get(key) ?? 0;
    const coins = Math.max(0, Math.min(amount, TREASURE.dailyCoins - got));
    if (this.treasureCoins.size > 5000) this.treasureCoins.clear();
    this.treasureCoins.set(key, got + coins);
    this.game.addCoins(userId, coins);
    return coins;
  }

  // ---------- 멍멍 축구 ----------
  field() {
    const f = PLAZA_SPOTS.soccer;
    return { x0: f.x - f.w / 2, x1: f.x + f.w / 2, y0: f.y - f.h / 2, y1: f.y + f.h / 2, cx: f.x, cy: f.y };
  }

  soccerView(ch) {
    const g = ch.soccer;
    if (!g) return null;
    return {
      status: g.status, teams: Object.fromEntries(g.teams), score: g.score, startsAt: g.startsAt, endsAt: g.endsAt,
      ball: { x: g.ball.x, y: g.ball.y, vx: g.ball.vx, vy: g.ball.vy },
    };
  }

  emitSoccer(ch) { this.io.to(`plaza:${ch.id}`).emit('soccer:state', this.soccerView(ch)); }

  soccerJoin(socket) {
    const m = this.member(socket);
    if (!m) return { ok: false, reason: '놀이터에 들어가 있지 않아요.' };
    const ch = this.channels.get(socket.data.plaza);
    const f = this.field();
    if (!ch.soccer) {
      ch.soccer = { status: 'waiting', teams: new Map(), goals: new Map(), score: { pink: 0, blue: 0 }, startsAt: 0, endsAt: 0, ball: { x: f.cx, y: f.cy, vx: 0, vy: 0 }, pauseUntil: 0, kicks: new Map() };
    }
    const g = ch.soccer;
    if (g.teams.has(m.userId)) return { ok: true, team: g.teams.get(m.userId) };
    const count = (t) => [...g.teams.values()].filter((x) => x === t).length;
    const team = count('pink') <= count('blue') ? 'pink' : 'blue';
    g.teams.set(m.userId, team);
    if (g.status === 'waiting' && count('pink') >= 1 && count('blue') >= 1 && !g.startsAt) g.startsAt = Date.now() + SOCCER.countdownMs;
    this.emitSoccer(ch);
    return { ok: true, team };
  }

  soccerLeave(channelId, userId) {
    const ch = this.channels.get(channelId);
    const g = ch?.soccer;
    if (!g || !g.teams.has(userId)) return;
    g.teams.delete(userId);
    if (g.teams.size === 0) { ch.soccer = null; this.io.to(`plaza:${ch.id}`).emit('soccer:state', null); return; }
    const teams = new Set(g.teams.values());
    if (g.status === 'waiting' && teams.size < 2) g.startsAt = 0;
    this.emitSoccer(ch);
  }

  // 강하게 차기 버튼: 공 가까이에 있으면 멀리 뻥!
  soccerKick(socket) {
    const m = this.member(socket);
    const ch = m && this.channels.get(socket.data.plaza);
    const g = ch?.soccer;
    if (!g || g.status !== 'play' || !g.teams.has(m.userId) || Date.now() < g.pauseUntil) return;
    const b = g.ball;
    const dx = b.x - m.x; const dy = b.y - (m.y - 2);
    const d = Math.hypot(dx, dy);
    if (d > SOCCER.kickRadius) return;
    const nx = d ? dx / d : m.dir; const ny = d ? dy / d : 0;
    b.vx = nx * SOCCER.kickSpeed; b.vy = ny * SOCCER.kickSpeed;
    g.lastTouch = m.userId;
    this.io.to(`plaza:${ch.id}`).emit('soccer:kick', { userId: m.userId, strong: true });
  }

  soccerTick(ch, now) {
    const g = ch.soccer;
    if (!g) return;
    const f = this.field();
    if (g.status === 'waiting') {
      if (g.startsAt && now >= g.startsAt) {
        g.status = 'play'; g.endsAt = now + SOCCER.seconds * 1000;
        Object.assign(g.ball, { x: f.cx, y: f.cy, vx: 0, vy: 0 });
        this.emitSoccer(ch);
      }
      return;
    }
    if (now >= g.endsAt) { this.soccerEnd(ch); return; }
    if (now < g.pauseUntil) return;
    const b = g.ball;
    // 공 물리: 0.1초를 4번 나눠서 계산해요
    for (let step = 0; step < 4; step++) {
      const dt = 0.025;
      // 강아지가 공에 닿으면 톡 밀어요 (강아지가 달리던 방향도 조금 더해요)
      for (const [uid] of g.teams) {
        const m = ch.members.get(uid);
        if (!m) continue;
        const dx = b.x - m.x; const dy = b.y - (m.y - 2);
        const d = Math.hypot(dx, dy);
        if (d < SOCCER.touchRadius && now - (g.kicks.get(uid) ?? 0) > 200) {
          g.kicks.set(uid, now);
          const nx = d ? dx / d : m.dir; const ny = d ? dy / d : 0;
          const run = Math.min(80, Math.hypot(m.vx ?? 0, m.vy ?? 0));
          b.vx = nx * (SOCCER.touchSpeed + run * 0.4); b.vy = ny * (SOCCER.touchSpeed + run * 0.4);
          g.lastTouch = uid;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      const fr = SOCCER.friction ** dt;
      b.vx *= fr; b.vy *= fr;
      if (Math.hypot(b.vx, b.vy) < 3) { b.vx = 0; b.vy = 0; }
      if (b.y < f.y0 + 3) { b.y = f.y0 + 3; b.vy = Math.abs(b.vy) * 0.8; }
      if (b.y > f.y1 - 3) { b.y = f.y1 - 3; b.vy = -Math.abs(b.vy) * 0.8; }
      const inMouth = Math.abs(b.y - f.cy) < SOCCER.goalHalf;
      if (b.x < f.x0 + 2) {
        if (inMouth) { this.soccerGoal(ch, 'blue', now); return; }
        b.x = f.x0 + 2; b.vx = Math.abs(b.vx) * 0.8;
      }
      if (b.x > f.x1 - 2) {
        if (inMouth) { this.soccerGoal(ch, 'pink', now); return; }
        b.x = f.x1 - 2; b.vx = -Math.abs(b.vx) * 0.8;
      }
    }
    this.io.to(`plaza:${ch.id}`).volatile.emit('soccer:ball', [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.vx), Math.round(b.vy)]);
  }

  soccerGoal(ch, team, now) {
    const g = ch.soccer;
    const f = this.field();
    g.score[team] += 1;
    const by = g.lastTouch && g.teams.get(g.lastTouch) === team ? g.lastTouch : null;
    if (by) { g.goals.set(by, (g.goals.get(by) ?? 0) + 1); this.game.track(by, 'goal', 1, { push: true }); }
    Object.assign(g.ball, { x: f.cx, y: f.cy, vx: 0, vy: 0 });
    g.pauseUntil = now + 1800;
    this.io.to(`plaza:${ch.id}`).emit('soccer:goal', { team, by, byName: by ? ch.members.get(by)?.nickname : null, score: g.score });
    this.emitSoccer(ch);
  }

  soccerEnd(ch) {
    const g = ch.soccer;
    const { pink, blue } = g.score;
    const winner = pink === blue ? null : pink > blue ? 'pink' : 'blue';
    const today = kstDate(Date.now());
    const results = [...g.teams.entries()].map(([userId, team]) => {
      const base = winner === null ? SOCCER.coins.draw : winner === team ? SOCCER.coins.win : SOCCER.coins.lose;
      const goals = g.goals.get(userId) ?? 0;
      const key = `${userId}:${today}`;
      const got = this.soccerCoins.get(key) ?? 0;
      const coins = Math.max(0, Math.min(base + goals * SOCCER.coins.perGoal, SOCCER.dailyCoins - got));
      this.soccerCoins.set(key, got + coins);
      this.game.addCoins(userId, coins);
      this.game.grant(userId, { exp: PLAY_EXP.soccer, talents: TALENT_GAINS.soccer });
      return { userId, nickname: ch.members.get(userId)?.nickname ?? '친구', team, goals, coins };
    });
    if (this.soccerCoins.size > 5000) this.soccerCoins.clear();
    ch.soccer = null;
    this.io.to(`plaza:${ch.id}`).emit('soccer:end', { score: { pink, blue }, winner, results });
    this.io.to(`plaza:${ch.id}`).emit('soccer:state', null);
  }

  // ---------- 술래잡기 ----------
  tagView(ch) {
    const t = ch.tag;
    if (!t) return null;
    return { status: t.status, players: [...t.players], it: t.it, startsAt: t.startsAt, endsAt: t.endsAt, scores: Object.fromEntries(t.scores) };
  }

  emitTag(ch) {
    this.io.to(`plaza:${ch.id}`).emit('tag:state', this.tagView(ch));
  }

  tagJoin(socket) {
    const m = this.member(socket);
    if (!m) return { ok: false, reason: '놀이터에 들어가 있지 않아요.' };
    const ch = this.channels.get(socket.data.plaza);
    const now = Date.now();
    if (!ch.tag) ch.tag = { status: 'waiting', players: new Set(), scores: new Map(), it: null, startsAt: 0, endsAt: 0, immuneUntil: 0 };
    const t = ch.tag;
    if (t.status === 'play') return { ok: false, reason: '지금 한 판 하는 중이에요. 끝나면 같이 해요!' };
    t.players.add(m.userId);
    t.scores.set(m.userId, 0);
    if (t.players.size >= TAG.minPlayers && !t.startsAt) t.startsAt = now + TAG.countdownMs;
    this.emitTag(ch);
    return { ok: true };
  }

  tagLeave(channelId, userId) {
    const ch = this.channels.get(channelId);
    const t = ch?.tag;
    if (!t || !t.players.has(userId)) return;
    t.players.delete(userId);
    if (t.players.size < TAG.minPlayers) {
      if (t.status === 'play') this.tagEnd(ch);
      else { t.startsAt = 0; this.emitTag(ch); }
      return;
    }
    if (t.it === userId) {
      t.it = [...t.players][Math.floor(Math.random() * t.players.size)];
      t.immuneUntil = Date.now() + TAG.immuneMs;
    }
    this.emitTag(ch);
  }

  tagEnd(ch) {
    const t = ch.tag;
    if (!t) return;
    const today = kstDate(Date.now());
    const results = [...t.scores.entries()].map(([userId, tags]) => {
      const key = `${userId}:${today}`;
      const got = this.tagCoins.get(key) ?? 0;
      const coins = Math.max(0, Math.min(TAG.coins + tags * TAG.coinsPerTag, 60 - got));
      if (t.status === 'play') {
        this.tagCoins.set(key, got + coins);
        this.game.addCoins(userId, coins);
        this.game.grant(userId, { exp: PLAY_EXP.tag, talents: TALENT_GAINS.tag });
        this.game.track(userId, 'tag', 1, { push: true });
      }
      return { userId, nickname: ch.members.get(userId)?.nickname ?? '친구', tags, coins: t.status === 'play' ? coins : 0 };
    }).sort((a, b) => b.tags - a.tags);
    ch.tag = null;
    this.io.to(`plaza:${ch.id}`).emit('tag:end', { results });
  }

  // 움직인 강아지들의 위치를 채널마다 한 묶음으로 보내요.
  // 20마리가 다 움직여도 한 사람이 받는 메시지는 초당 10개예요 (묶지 않으면 190개).
  flushPositions(ch) {
    const moved = [...ch.members.values()].filter((m) => m.dirty);
    if (!moved.length) return;
    for (const m of moved) m.dirty = false;
    const packed = moved.map((m) => [m.userId, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, m.dir, m.moving ? 1 : 0]);
    for (const o of ch.members.values()) {
      const list = packed.filter((p) => p[0] !== o.userId && !o.hidden.has(p[0]));
      if (!list.length) continue;
      this.io.sockets.sockets.get(o.socketId)?.volatile.emit('plaza:snap', list);
    }
  }

  tick() {
    const now = Date.now();
    for (const ch of this.channels.values()) {
      this.flushPositions(ch);
      this.soccerTick(ch, now);
      if (ch.treasures.length < TREASURE.max && now >= ch.nextTreasure) {
        ch.nextTreasure = now + TREASURE.spawnMs;
        this.spawnTreasure(ch);
      }
      const t = ch.tag;
      if (!t) continue;
      if (t.status === 'waiting' && t.startsAt && now >= t.startsAt) {
        t.status = 'play';
        t.endsAt = now + TAG.seconds * 1000;
        t.it = [...t.players][Math.floor(Math.random() * t.players.size)];
        t.immuneUntil = now + TAG.immuneMs;
        this.emitTag(ch);
        continue;
      }
      if (t.status !== 'play') continue;
      if (now >= t.endsAt) { this.tagEnd(ch); continue; }
      if (now < t.immuneUntil) continue;
      const it = ch.members.get(t.it);
      if (!it) continue;
      for (const pid of t.players) {
        if (pid === t.it) continue;
        const o = ch.members.get(pid);
        if (!o || o.hidden.has(t.it)) continue;
        if (Math.hypot(o.x - it.x, (o.y - it.y) * 1.4) < TAG.radius) {
          t.scores.set(t.it, (t.scores.get(t.it) ?? 0) + 1);
          this.io.to(`plaza:${ch.id}`).emit('tag:tagged', { from: t.it, to: pid });
          t.it = pid;
          t.immuneUntil = now + TAG.immuneMs;
          this.emitTag(ch);
          break;
        }
      }
    }
  }
}

export { REPORT_REASONS };
