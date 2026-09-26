// 멍뭉 놀이터: 누구나 들어오는 공개 광장 (채널당 최대 20마리)
// 흐름: 클라이언트 입력(plaza:pos, plaza:emote ...) → 서버 상태 갱신 → 같은 채널에 방송 → 각자 화면 그리기
import { PLAZA, PLAZA_SPOTS, STICKERS, PHRASES, TAG } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';
import { REPORT_REASONS } from './safety.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
const EMOTES = ['bark', 'jump', 'wave', 'spin'];

export class PlazaHub {
  constructor(io, { game, friends, safety, bonds }) {
    this.io = io;
    this.game = game;
    this.friends = friends;
    this.safety = safety;
    this.bonds = bonds;
    this.channels = new Map(); // id -> { id, members: Map<userId, member>, tag }
    this.tagCoins = new Map();
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
      if (!m || !EMOTES.includes(msg?.kind) || !this.gate(m, 700)) return;
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
    if (!this.channels.has(id)) this.channels.set(id, { id, members: new Map(), tag: null });
    const ch = this.channels.get(id);
    const spot = PLAZA_SPOTS.fountain;
    const m = {
      userId, socketId: socket.id, nickname: this.game.getUser(userId).nickname, dog: this.game.publicDog(dog),
      hidden: new Set(this.hiddenFor(userId)),
      x: spot.x + (Math.random() - 0.5) * 60, y: spot.y + 40 + Math.random() * 20, dir: 1, moving: false, lastPos: 0, lastEmote: 0,
    };
    ch.members.set(userId, m);
    socket.data.plaza = id;
    socket.join(`plaza:${id}`);
    const blocked = m.hidden;
    this.broadcast(m, 'plaza:enter', this.view(m));
    return {
      ok: true,
      channel: id,
      channels: this.channelList(userId),
      members: [...ch.members.values()].filter((o) => !blocked.has(o.userId)).map((o) => this.view(o)),
      tag: this.tagView(ch),
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
      if (t.status === 'play') { this.tagCoins.set(key, got + coins); this.game.addCoins(userId, coins); }
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
