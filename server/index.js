import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { openDb } from './db.js';
import { Game, GameError } from './game.js';
import { Auth } from './auth.js';
import { Friends } from './friends.js';
import { RoomHub } from './rooms.js';
import { Bonds } from './bonds.js';
import { Safety } from './safety.js';
import { PlazaHub } from './plaza.js';
import { CoopHub } from './coop/index.js';
import { checkDogName } from './filter.js';
import { RULES } from '../shared/data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createServer({ dbFile = process.env.DB_FILE ?? path.join(root, 'data', 'meongmung.db'), speed = Number(process.env.GAME_SPEED) || 1, now, rateLimit = true } = {}) {
  const db = openDb(dbFile);
  const game = new Game(db, { speed, now });
  const auth = new Auth(db, { now });
  const friends = new Friends(db, game);
  const bonds = new Bonds(db, { now });

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const hub = new RoomHub(io, { auth, game, friends, bonds });
  const safety = new Safety(db, { now });
  const plaza = new PlazaHub(io, { game, friends, safety, bonds });
  const coop = new CoopHub(io, { game, bonds, safety, plaza, now });
  io.on('connection', (socket) => { plaza.bind(socket); coop.bind(socket); });

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.static(path.join(root, 'public')));
  app.use('/shared', express.static(path.join(root, 'shared')));

  // 간단한 IP별 요청 제한 (로그인/가입 무차별 시도 방지)
  const hits = new Map();
  const limiter = (max, windowMs) => (req, res, next) => {
    if (!rateLimit) return next(); // 자동 테스트에서만 꺼요
    const key = `${req.ip}:${req.path}`;
    const t = Date.now();
    const rec = hits.get(key);
    if (!rec || t - rec.start > windowMs) hits.set(key, { start: t, n: 1 });
    else if (++rec.n > max) return res.status(429).json({ error: '너무 많이 시도했어요. 잠시 후에 다시 해 주세요.' });
    next();
  };
  setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (t - v.start > 10 * 60_000) hits.delete(k);
  }, 60_000).unref();

  const wrap = (fn) => (req, res) => {
    try {
      res.json(fn(req, res) ?? { ok: true });
    } catch (err) {
      if (err instanceof GameError) return res.status(err.status).json({ error: err.message });
      console.error(err);
      res.status(500).json({ error: '앗, 문제가 생겼어요. 잠시 후 다시 해 주세요.' });
    }
  };

  const authed = (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const userId = auth.userIdForToken(token);
    if (!userId) return res.status(401).json({ error: '다시 로그인해 주세요.' });
    req.userId = userId;
    req.token = token;
    next();
  };

  const api = express.Router();

  api.get('/config', wrap(() => ({ speed })));
  api.post('/signup', limiter(10, 10 * 60_000), wrap((req) => auth.signup(req.body?.nickname, req.body?.pin)));
  api.post('/login', limiter(20, 10 * 60_000), wrap((req) => auth.login(req.body?.nickname, req.body?.pin)));
  api.post('/logout', authed, wrap((req) => { auth.logout(req.token); }));

  const me = (userId, extra = {}) => {
    const { dog, events } = game.refreshDog(userId);
    if (events.length) hub.dogChanged(userId);
    const user = game.getUser(userId);
    return {
      user,
      dog: game.dogView(dog),
      unreadReports: game.unreadReports(userId),
      pendingFriends: friends.list(userId).incoming.length,
      events: [...(extra.events ?? []), ...events],
      speed,
      serverNow: game.now(),
      ...extra,
    };
  };

  api.get('/me', authed, wrap((req) => {
    const dailyCoins = game.loadDog(req.userId) ? game.claimDaily(req.userId) : 0;
    return me(req.userId, { dailyCoins });
  }));

  api.post('/dog', authed, wrap((req) => {
    const name = checkDogName(req.body?.name);
    if (!name.ok) throw new GameError(name.reason);
    game.createDog(req.userId, { name: name.name, breed: req.body?.breed, personality: req.body?.personality });
    return me(req.userId);
  }));

  api.post('/dog/action', authed, wrap((req) => {
    const res = game.act(req.userId, req.body?.action);
    if (res.events.some((e) => e.type === 'grew')) hub.dogChanged(req.userId);
    return { ...me(req.userId, { events: res.events }), result: { coins: res.coins, exp: res.exp, reaction: res.reaction } };
  }));

  api.post('/school', authed, wrap((req) => {
    const res = game.startSchool(req.userId, req.body?.course);
    hub.dogChanged(req.userId);
    return me(req.userId, { events: res.events });
  }));

  api.post('/training/start', authed, wrap((req) => game.startTraining(req.userId)));
  api.post('/training/finish', authed, wrap((req) => {
    const result = game.finishTraining(req.userId, req.body?.trainingId, req.body ?? {});
    if (result.learned || result.events.length) hub.dogChanged(req.userId);
    return { ...me(req.userId, { events: result.events }), result };
  }));

  api.post('/school/leave', authed, wrap((req) => {
    const res = game.leaveSchool(req.userId);
    hub.dogChanged(req.userId);
    return me(req.userId, { events: res.events });
  }));

  api.get('/reports', authed, wrap((req) => ({ reports: game.listReports(req.userId) })));
  api.post('/reports/:id/read', authed, wrap((req) => { game.markReportRead(req.userId, Number(req.params.id)); }));

  api.post('/shop/buy', authed, wrap((req) => {
    game.buy(req.userId, req.body?.itemId);
    return me(req.userId);
  }));

  api.post('/gacha', authed, wrap((req) => {
    const result = game.gacha(req.userId);
    return { ...me(req.userId), result };
  }));

  api.post('/equip', authed, wrap((req) => {
    const slot = req.body?.slot;
    game.equip(req.userId, slot, req.body?.itemId ?? null);
    if (['head', 'neck', 'face'].includes(slot)) hub.dogChanged(req.userId);
    else hub.roomDecorChanged(req.userId);
    return me(req.userId);
  }));

  api.post('/minigame/start', authed, wrap((req) => game.startMinigame(req.userId, req.body?.type ?? 'catch')));
  api.post('/minigame/finish', authed, wrap((req) => {
    const res = game.finishMinigame(req.userId, req.body?.gameId, req.body?.score);
    return { ...me(req.userId), result: res };
  }));

  api.get('/friends', authed, wrap((req) => {
    const list = friends.list(req.userId);
    list.friends = list.friends.map((f) => ({ ...f, online: hub.online(f.id), bond: bonds.get(req.userId, f.id) }));
    return list;
  }));
  api.get('/friends/lookup/:code', authed, wrap((req) => {
    const target = game.getUserByCode(req.params.code);
    if (!target) throw new GameError('그런 친구 코드는 없어요.', 404);
    return { id: target.id, nickname: target.nickname, isMe: target.id === req.userId, isFriend: friends.areFriends(req.userId, target.id) };
  }));
  api.post('/friends/request', authed, limiter(30, 10 * 60_000), wrap((req) => {
    const target = game.getUserByCode(String(req.body?.code ?? '').trim());
    if (target && safety.isBlocked(req.userId, target.id)) throw new GameError('친구 신청을 보낼 수 없어요.');
    const res = friends.request(req.userId, req.body?.code);
    hub.emitToUser(res.target.id, 'friends:changed', {});
    return { status: res.status, nickname: res.target.nickname };
  }));
  api.post('/friends/respond', authed, wrap((req) => {
    const res = friends.respond(req.userId, Number(req.body?.requestId), !!req.body?.accept);
    hub.emitToUser(res.fromId, 'friends:changed', {});
  }));
  api.delete('/friends/:id', authed, wrap((req) => {
    const friendId = Number(req.params.id);
    friends.remove(req.userId, friendId);
    hub.emitToUser(friendId, 'friends:changed', {});
  }));

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: '없는 주소예요.' }));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

  return { app, server, io, db, game, auth, friends, bonds, hub, safety, plaza, coop, rules: RULES };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createServer();
  server.listen(port, () => {
    console.log(`🐶 멍뭉고치 서버가 http://localhost:${port} 에서 열렸어요! (GAME_SPEED=${Number(process.env.GAME_SPEED) || 1})`);
  });
}
