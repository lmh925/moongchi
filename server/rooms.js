// 실시간 마이룸: 방문, 이동, 스티커/문장/채팅, 개인기, 초대
import { STICKERS, PHRASES, TRICKS, PARTY, PLAY_EXP, TALENT_GAINS, SPECIALS, SPECIAL_TRICKS } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';
import { checkText } from './filter.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const CHAT_GAP_MS = 1200;
const INVITE_GAP_MS = 5000;

export class RoomHub {
  constructor(io, { auth, game, friends, bonds }) {
    this.io = io;
    this.auth = auth;
    this.game = game;
    this.friends = friends;
    this.bonds = bonds;
    // 같은 방에서 1분 함께 있으면 친밀도가 올라요
    this.togetherTimer = setInterval(() => this.tickTogether(), 60_000);
    this.togetherTimer.unref?.();
    this.rooms = new Map(); // ownerId -> Map<userId, member>
    this.parties = new Map(); // ownerId -> 간식 파티 상태
    this.partyCoins = new Map(); // `${userId}:${날짜}` -> 오늘 파티로 받은 코인
    this.sockets = new Map(); // userId -> Set<socket>
    io.use((socket, next) => {
      const userId = auth.userIdForToken(socket.handshake.auth?.token);
      if (!userId) return next(new Error('unauthorized'));
      socket.data.userId = userId;
      socket.data.lastChat = 0;
      socket.data.lastInvite = 0;
      next();
    });
    io.on('connection', (socket) => this.onConnect(socket));
  }

  online(userId) {
    return (this.sockets.get(userId)?.size ?? 0) > 0;
  }

  // 계정을 지울 때: 열려 있는 창을 모두 닫아요 (방·놀이터에서도 나가요)
  disconnectUser(userId) {
    for (const s of [...(this.sockets.get(userId) ?? [])]) s.disconnect(true);
  }

  emitToUser(userId, event, payload) {
    for (const s of this.sockets.get(userId) ?? []) s.emit(event, payload);
  }

  onConnect(socket) {
    const { userId } = socket.data;
    if (!this.sockets.has(userId)) this.sockets.set(userId, new Set());
    const set = this.sockets.get(userId);
    set.add(socket);
    if (set.size === 1) this.broadcastPresence(userId, true);

    socket.on('friends:online', (_, ack) => {
      if (typeof ack !== 'function') return;
      ack(this.friends.friendIds(userId).filter((id) => this.online(id)));
    });
    socket.on('room:join', (msg, ack) => this.join(socket, Number(msg?.ownerId), ack));
    socket.on('room:leave', () => this.leave(socket));
    socket.on('room:move', (msg) => {
      const m = this.member(socket);
      if (!m) return;
      m.x = clamp01(msg?.x);
      m.y = clamp01(msg?.y);
      socket.to(this.channel(socket.data.room)).emit('room:move', { userId, x: m.x, y: m.y });
    });
    socket.on('room:sticker', (msg) => {
      if (!STICKERS[msg?.id] || !this.chatGate(socket)) return;
      this.bubble(socket, 'sticker', msg.id);
    });
    socket.on('room:phrase', (msg) => {
      const text = PHRASES[msg?.index];
      if (!text || !this.chatGate(socket)) return;
      this.bubble(socket, 'text', text);
    });
    socket.on('room:chat', (msg, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const m = this.member(socket);
      if (!m) return reply({ ok: false, reason: '방에 들어가 있지 않아요.' });
      if (!this.canChat(socket.data.room, userId)) {
        return reply({ ok: false, reason: '모두와 친구일 때만 글자를 쓸 수 있어요. 스티커를 써 보세요!' });
      }
      const res = checkText(msg?.text);
      if (!res.ok) return reply(res);
      if (!this.chatGate(socket)) return reply({ ok: false, reason: '조금 천천히 보내 주세요~' });
      this.bubble(socket, 'text', res.text);
      reply({ ok: true });
    });
    socket.on('room:pet', (msg) => {
      const m = this.member(socket);
      const target = Number(msg?.userId);
      if (!m || !this.inRoom(socket.data.room, target) || !this.chatGate(socket, 600)) return;
      this.io.to(this.channel(socket.data.room)).emit('room:pet', { from: userId, to: target });
      if (target !== userId) this.addBond(socket.data.room, userId, target, 'pet');
    });
    // 같이 놀기: 내 강아지가 친구 강아지에게 달려가서 함께 뛰어놀아요
    socket.on('room:play', (msg) => {
      const m = this.member(socket);
      const target = Number(msg?.userId);
      if (!m || target === userId || !this.inRoom(socket.data.room, target) || !this.chatGate(socket, 1500)) return;
      this.io.to(this.channel(socket.data.room)).emit('room:play', { from: userId, to: target });
      this.addBond(socket.data.room, userId, target, 'play');
    });
    socket.on('room:trick', (msg) => {
      const m = this.member(socket);
      if (!m || !(TRICKS[msg?.trick] || SPECIAL_TRICKS[msg?.trick])) return;
      const dog = this.game.loadDog(userId);
      const known = dog?.tricks.includes(msg.trick) || (dog?.special && SPECIALS[dog.special].trick === msg.trick);
      if (!known || !this.chatGate(socket, 1500)) return;
      socket.to(this.channel(socket.data.room)).emit('room:trick', { userId, trick: msg.trick });
      this.game.track(userId, 'trick', 1, { push: true });
    });
    socket.on('party:start', (_, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const m = this.member(socket);
      if (!m) return reply({ ok: false, reason: '방에 들어가 있지 않아요.' });
      reply(this.startParty(socket.data.room));
    });
    socket.on('party:grab', (msg) => {
      const m = this.member(socket);
      if (!m) return;
      this.grabTreat(socket.data.room, userId, String(msg?.treatId ?? ''), clamp01(msg?.x), clamp01(msg?.y));
    });
    socket.on('invite', (msg, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const friendId = Number(msg?.friendId);
      if (!this.friends.areFriends(userId, friendId) || friendId === userId) return reply({ ok: false, reason: '친구만 초대할 수 있어요.' });
      if (!this.online(friendId)) return reply({ ok: false, reason: '친구가 지금 접속해 있지 않아요.' });
      const now = Date.now();
      if (now - socket.data.lastInvite < INVITE_GAP_MS) return reply({ ok: false, reason: '조금 뒤에 다시 초대해 주세요.' });
      socket.data.lastInvite = now;
      const me = this.game.getUser(userId);
      this.emitToUser(friendId, 'invite', { fromId: userId, nickname: me.nickname });
      reply({ ok: true });
    });
    socket.on('disconnect', () => {
      this.leave(socket);
      set.delete(socket);
      if (set.size === 0) {
        this.sockets.delete(userId);
        this.broadcastPresence(userId, false);
      }
    });
  }

  // ---------- 간식 파티 ----------
  startParty(ownerId) {
    const room = this.rooms.get(ownerId);
    if (!room || room.size < 2) return { ok: false, reason: '친구가 같이 있어야 파티를 열 수 있어요!' };
    if (this.parties.has(ownerId)) return { ok: false, reason: '벌써 파티 중이에요!' };
    const players = [...room.keys()].filter((id) => !this.game.loadDog(id)?.school);
    if (players.length < 2) return { ok: false, reason: '강아지가 학교에 간 친구가 있어요.' };
    const now = Date.now();
    const party = {
      id: now.toString(36), endsAt: now + PARTY.seconds * 1000, treats: new Map(), scores: new Map(players.map((p) => [p, 0])), seq: 0,
    };
    this.parties.set(ownerId, party);
    this.io.to(this.channel(ownerId)).emit('party:start', { endsAt: party.endsAt, seconds: PARTY.seconds, players });
    party.spawner = setInterval(() => this.spawnTreat(ownerId), PARTY.spawnMs);
    party.ender = setTimeout(() => this.endParty(ownerId), PARTY.seconds * 1000);
    return { ok: true };
  }

  spawnTreat(ownerId) {
    const party = this.parties.get(ownerId);
    if (!party) return;
    const now = Date.now();
    for (const [id, t] of party.treats) if (now - t.born > PARTY.treatLifeMs) party.treats.delete(id);
    const star = Math.random() < 0.12;
    const t = { id: `${party.id}-${party.seq++}`, x: 0.05 + Math.random() * 0.9, y: 0.05 + Math.random() * 0.9, kind: star ? 'star' : 'bone', value: star ? 3 : 1, born: now };
    party.treats.set(t.id, t);
    this.io.to(this.channel(ownerId)).emit('party:treat', { id: t.id, x: t.x, y: t.y, kind: t.kind });
  }

  grabTreat(ownerId, userId, treatId, x, y) {
    const party = this.parties.get(ownerId);
    const t = party?.treats.get(treatId);
    if (!t) return;
    // 강아지 비율을 고려해 가로 거리는 조금 더 느슨하게 봐요
    const d = Math.hypot((t.x - x) * 1.0, (t.y - y) * 0.5);
    if (d > PARTY.grabRadius) return;
    party.treats.delete(treatId);
    party.scores.set(userId, (party.scores.get(userId) ?? 0) + t.value);
    this.io.to(this.channel(ownerId)).emit('party:grabbed', { treatId, userId, value: t.value, scores: Object.fromEntries(party.scores) });
  }

  endParty(ownerId) {
    const party = this.parties.get(ownerId);
    if (!party) return;
    clearInterval(party.spawner);
    clearTimeout(party.ender);
    this.parties.delete(ownerId);
    const entries = [...party.scores.entries()];
    const best = Math.max(0, ...entries.map(([, v]) => v));
    const today = kstDate(Date.now());
    const results = entries.map(([userId, score]) => {
      const winner = best > 0 && score === best;
      const key = `${userId}:${today}`;
      const got = this.partyCoins.get(key) ?? 0;
      const coins = Math.max(0, Math.min(Math.min(score, PARTY.maxCoins) + (winner ? PARTY.winnerBonus : 0), PARTY.dailyCoinCap - got));
      this.partyCoins.set(key, got + coins);
      this.game.addCoins(userId, coins);
      if (score > 0) this.game.grant(userId, { exp: PLAY_EXP.party, talents: { kind: 1, strong: 1 } });
      return { userId, nickname: this.game.getUser(userId)?.nickname, score, coins, winner };
    }).sort((a, b) => b.score - a.score);
    if (this.partyCoins.size > 5000) this.partyCoins.clear();
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) this.addBond(ownerId, entries[i][0], entries[j][0], 'play');
    }
    this.io.to(this.channel(ownerId)).emit('party:end', { results });
  }

  inRoom(ownerId, userId) {
    return userId === ownerId || !!this.rooms.get(ownerId)?.has(userId);
  }

  addBond(ownerId, a, b, kind) {
    const res = this.bonds.add(a, b, kind, { bonus: kind === 'together' ? 0 : this.game.bondBonus(a, b) });
    if (!res) return;
    this.io.to(this.channel(ownerId)).emit('bond', { a, b, bond: res.after, up: res.after.level > res.before });
  }

  tickTogether() {
    for (const [ownerId, room] of this.rooms) {
      const ids = [...new Set([ownerId, ...room.keys()])].filter((id) => {
        const dog = this.game.loadDog(id);
        return dog && !dog.school;
      });
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) this.addBond(ownerId, ids[i], ids[j], 'together');
      }
    }
  }

  broadcastPresence(userId, online) {
    for (const fid of this.friends.friendIds(userId)) this.emitToUser(fid, 'presence', { userId, online });
  }

  channel(ownerId) {
    return `room:${ownerId}`;
  }

  member(socket) {
    const room = this.rooms.get(socket.data.room);
    const m = room?.get(socket.data.userId);
    return m && m.socketId === socket.id ? m : null;
  }

  chatGate(socket, gap = CHAT_GAP_MS) {
    if (!this.member(socket)) return false;
    const now = Date.now();
    if (now - socket.data.lastChat < gap) return false;
    socket.data.lastChat = now;
    return true;
  }

  bubble(socket, kind, value) {
    this.io.to(this.channel(socket.data.room)).emit('room:bubble', { userId: socket.data.userId, kind, value });
  }

  // 글자 채팅은 방 안의 모든 사람과 서로 친구일 때만 허용해요.
  canChat(ownerId, userId) {
    const room = this.rooms.get(ownerId);
    if (!room) return false;
    for (const other of room.keys()) {
      if (other !== userId && !this.friends.areFriends(userId, other)) return false;
    }
    return true;
  }

  memberView(m) {
    const { dog } = this.game.refreshDog(m.userId);
    return { userId: m.userId, nickname: m.nickname, x: m.x, y: m.y, dog: this.game.publicDog(dog) };
  }

  roomState(ownerId) {
    const owner = this.game.getUser(ownerId);
    const { dog } = this.game.refreshDog(ownerId);
    const room = this.rooms.get(ownerId) ?? new Map();
    return {
      owner: { id: owner.id, nickname: owner.nickname },
      decor: owner.room,
      homeDog: this.game.publicDog(dog),
      extras: this.extras(ownerId, dog?.id),
      members: [...room.values()].map((m) => this.memberView(m)),
    };
  }

  // 집에서 함께 지내는 대표가 아닌 강아지들 (학교에 간 친구는 빼고)
  extras(ownerId, activeId = this.game.loadDog(ownerId)?.id) {
    return this.game.loadDogs(ownerId).filter((d) => d.id !== activeId && !d.school)
      .map((d) => ({ id: d.id, dog: this.game.publicDog(d) }));
  }

  // 입양하거나 대표를 바꾸면 방에 있는 모두에게 알려요
  dogsChanged(ownerId) {
    this.dogChanged(ownerId);
    this.io.to(this.channel(ownerId)).emit('room:extras', { ownerId, extras: this.extras(ownerId) });
  }

  join(socket, ownerId, ack) {
    const reply = typeof ack === 'function' ? ack : () => {};
    const { userId } = socket.data;
    if (!this.game.getUser(ownerId)) return reply({ ok: false, reason: '그런 집은 없어요.' });
    if (!this.friends.areFriends(userId, ownerId)) return reply({ ok: false, reason: '친구의 집에만 놀러 갈 수 있어요.' });
    this.leave(socket);
    // 같은 계정의 다른 창이 방에 있다면 내보내요.
    for (const [rid, room] of this.rooms) {
      const old = room.get(userId);
      if (old) {
        const oldSocket = this.io.sockets.sockets.get(old.socketId);
        if (oldSocket) this.leave(oldSocket, '다른 창에서 접속했어요.');
        else room.delete(userId);
        if (room.size === 0) this.rooms.delete(rid);
      }
    }
    const user = this.game.getUser(userId);
    if (!this.rooms.has(ownerId)) this.rooms.set(ownerId, new Map());
    const m = { userId, nickname: user.nickname, socketId: socket.id, x: 0.3 + Math.random() * 0.4, y: 0.55 + Math.random() * 0.3 };
    this.rooms.get(ownerId).set(userId, m);
    socket.data.room = ownerId;
    socket.join(this.channel(ownerId));
    socket.to(this.channel(ownerId)).emit('room:enter', this.memberView(m));
    // 친구 집에 놀러 가면 다정 재능이 자라요 (하루 한도 안에서)
    if (ownerId !== userId) {
      this.game.grant(userId, { talents: TALENT_GAINS.visit });
      this.game.track(userId, 'visit', 1, { push: true });
    }
    // 친구 집에서 만난 견종은 견종 도감에 올라가요
    const breeds = [ownerId, ...this.rooms.get(ownerId).keys()].filter((id) => id !== userId).map((id) => this.game.loadDog(id)?.breed).filter(Boolean);
    if (breeds.length) this.game.seeBreeds(userId, breeds);
    const here = [ownerId, ...this.rooms.get(ownerId).keys()];
    const trio = this.game.trioGathering(userId, [...new Set(here)].map((id) => ({ userId: id, special: this.game.loadDog(id)?.special })));
    if (trio) setTimeout(() => this.io.to(this.channel(ownerId)).emit('trio', trio), 600);
    const others = [...new Set([ownerId, ...this.rooms.get(ownerId).keys()])].filter((id) => id !== userId);
    const running = this.parties.get(ownerId);
    reply({
      ok: true, room: this.roomState(ownerId), bonds: this.bonds.many(userId, others),
      party: running ? { endsAt: running.endsAt, scores: Object.fromEntries(running.scores), treats: [...running.treats.values()] } : null,
    });
    for (const other of others) {
      const om = this.rooms.get(ownerId).get(other);
      const s = om && this.io.sockets.sockets.get(om.socketId);
      s?.emit('bond', { a: other, b: userId, bond: this.bonds.get(other, userId), up: false });
    }
    this.updateChatPermissions(ownerId);
  }

  leave(socket, reason) {
    const ownerId = socket.data.room;
    if (ownerId === undefined) return;
    const room = this.rooms.get(ownerId);
    const m = room?.get(socket.data.userId);
    if (m && m.socketId === socket.id) {
      room.delete(socket.data.userId);
      if (room.size === 0) { this.rooms.delete(ownerId); this.endParty(ownerId); }
      socket.to(this.channel(ownerId)).emit('room:exit', { userId: socket.data.userId });
      this.updateChatPermissions(ownerId);
    }
    socket.leave(this.channel(ownerId));
    socket.data.room = undefined;
    if (reason) socket.emit('room:kicked', { reason });
  }

  updateChatPermissions(ownerId) {
    const room = this.rooms.get(ownerId);
    if (!room) return;
    for (const m of room.values()) {
      this.io.sockets.sockets.get(m.socketId)?.emit('room:chat-allowed', { allowed: this.canChat(ownerId, m.userId) });
    }
  }

  // 강아지 모습(옷, 성장 등)이 바뀌면 같은 방 친구들에게 알려요.
  dogChanged(userId) {
    const { dog } = this.game.refreshDog(userId);
    const payload = { userId, dog: this.game.publicDog(dog) };
    for (const [ownerId, room] of this.rooms) {
      if (room.has(userId) || ownerId === userId) this.io.to(this.channel(ownerId)).emit('room:dog', payload);
    }
  }

  roomDecorChanged(ownerId) {
    const owner = this.game.getUser(ownerId);
    this.io.to(this.channel(ownerId)).emit('room:decor', { decor: owner.room });
  }
}
