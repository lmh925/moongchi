import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
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
import { Progress } from './progress.js';
import { Trades } from './trades.js';
import { Babies } from './babies.js';
import { Leaderboard } from './leaderboard.js';
import { startBackups } from './backup.js';
import QRCode from 'qrcode';
import { checkDogName } from './filter.js';
import { RULES } from '../shared/data.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createServer({ dbFile = process.env.DB_FILE ?? path.join(root, 'data', 'meongmung.db'), speed = Number(process.env.GAME_SPEED) || 1, now, rateLimit = true } = {}) {
  const db = openDb(dbFile);
  const backups = startBackups(db, dbFile);
  const game = new Game(db, { speed, now });
  const auth = new Auth(db, { now });
  const friends = new Friends(db, game);
  const progress = new Progress(db, { game, friends });
  game.progress = progress;
  const bonds = new Bonds(db, { now });

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const hub = new RoomHub(io, { auth, game, friends, bonds });
  const safety = new Safety(db, { now });
  const trades = new Trades(db, { game, friends, safety, progress });
  const babies = new Babies(db, { game, friends, safety, bonds, progress });
  const leaderboard = new Leaderboard(db, { game, friends, safety, progress });
  const plaza = new PlazaHub(io, { game, friends, safety, bonds });
  const coop = new CoopHub(io, { game, bonds, safety, plaza, now });
  // 여럿이 하는 놀이에서 레벨업·재능이 오르면 그 친구 화면에 바로 알려요
  game.onGrowth = (userId, events) => {
    hub.emitToUser(userId, 'growth', { events });
    if (events.some((e) => e.type === 'grew' || e.type === 'levelUp')) { hub.dogChanged(userId); plaza.dogChanged(userId); }
  };
  io.on('connection', (socket) => { plaza.bind(socket); coop.bind(socket); });

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  // ---------- 게임 파일 캐시 관리 ----------
  // 파일 내용으로 버전(BUILD)을 만들고, index.html이 /v/<BUILD>/... 주소로 게임 파일을 불러요.
  // 업데이트되면 주소가 바뀌어서 브라우저·Cloudflare에 남은 옛 파일을 쓸 수 없어요.
  const BUILD = buildId([path.join(root, 'public'), path.join(root, 'shared')]);
  const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8')
    .replace('<head>', `<head>\n  <meta name="build" content="${BUILD}">`)
    .replace('/js/main.js', `/v/${BUILD}/js/main.js`)
    .replace('/css/style.css', `/v/${BUILD}/css/style.css`);
  const sendIndex = (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(indexHtml);
  };
  const noCache = { setHeaders: (res) => res.set('Cache-Control', 'no-cache') };
  const forever = { immutable: true, maxAge: '365d' };
  app.get(['/', '/index.html'], sendIndex);
  // 개인정보처리방침 (문의처는 환경 변수 CONTACT_EMAIL)
  const privacyHtml = fs.readFileSync(path.join(root, 'public', 'privacy.html'), 'utf8')
    .replace('{{CONTACT}}', (process.env.CONTACT_EMAIL ?? '운영자에게 문의 (연락처 준비 중)').replace(/[<>&"]/g, ''));
  app.get(['/admin', '/admin/'], (req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(root, 'public', 'admin.html')); });
  app.get(['/privacy', '/privacy.html'], (req, res) => { res.set('Cache-Control', 'no-cache'); res.type('html').send(privacyHtml); });
  app.use('/v/:build/shared', express.static(path.join(root, 'shared'), forever));
  app.use('/v/:build', express.static(path.join(root, 'public'), forever));
  app.use(express.static(path.join(root, 'public'), { ...noCache, index: false }));
  app.use('/shared', express.static(path.join(root, 'shared'), noCache));

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
  api.get('/version', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ build: BUILD }); });
  api.post('/signup', limiter(10, 10 * 60_000), wrap((req) => {
    if (req.body?.consent !== true) throw new GameError('보호자와 함께 개인정보처리방침을 읽고 체크해 주세요.');
    return auth.signup(req.body?.nickname, req.body?.pin);
  }));
  api.post('/login', limiter(20, 10 * 60_000), wrap((req) => auth.login(req.body?.nickname, req.body?.pin)));
  api.post('/logout', authed, wrap((req) => { auth.logout(req.token); }));
  api.post('/account/delete', authed, limiter(10, 10 * 60_000), wrap((req) => {
    auth.verifyPin(req.userId, req.body?.pin);
    const friendIds = friends.friendIds(req.userId);
    hub.disconnectUser(req.userId);
    auth.deleteAccount(req.userId, req.body?.pin);
    for (const id of friendIds) hub.emitToUser(id, 'friends:changed', {});
  }));

  const me = (userId, extra = {}) => {
    const gifts = game.specialGifts(userId);
    const { dog, events } = game.refreshDog(userId);
    events.unshift(...gifts);
    if (events.length) hub.dogChanged(userId);
    if (extra.visit) events.push(...progress.onMe(userId, dog), ...leaderboard.rewardLastWeek(userId));
    events.push(...babies.deliver(userId));
    const others = game.refreshOthers(userId);
    if (others.length) { events.push(...others); hub.dogsChanged(userId); }
    const user = game.getUser(userId);
    return {
      user,
      dog: game.dogView(dog),
      dogs: game.dogList(userId),
      food: dog ? game.kibble(userId) : null,
      slots: game.dogSlots(userId),
      progress: dog ? progress.view(userId) : null,
      unreadReports: game.unreadReports(userId),
      pendingFriends: friends.list(userId).incoming.length,
      pendingTrades: trades.pendingFor(userId),
      wishes: babies.list(userId),
      events: [...(extra.events ?? []), ...events],
      speed,
      serverNow: game.now(),
      ...extra,
    };
  };

  api.get('/me', authed, wrap((req) => {
    const dailyCoins = game.loadDog(req.userId) ? game.claimDaily(req.userId) : 0;
    return me(req.userId, { dailyCoins, visit: true });
  }));

  // ---------- 우편함 · 배지 ----------
  api.get('/mail', authed, wrap((req) => ({ mail: progress.listMail(req.userId) })));
  api.post('/mail/:id/open', authed, wrap((req) => {
    const res = progress.openMail(req.userId, req.params.id);
    if (!res) throw new GameError('그런 편지는 없어요.', 404);
    return { ...me(req.userId, { events: [...res.events, ...(res.capsule?.events ?? [])] }), result: res };
  }));
  api.post('/badges/showcase', authed, wrap((req) => {
    progress.setShowcase(req.userId, req.body?.ids);
    hub.dogChanged(req.userId);
    return me(req.userId);
  }));

  // 친구 코드 QR (휴대폰 카메라로 찍으면 초대 주소가 열려요)
  const qrCache = new Map();
  api.get('/qr/:code', async (req, res) => {
    const code = String(req.params.code).replace(/\.svg$/, '').toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return res.status(400).json({ error: '코드가 올바르지 않아요.' });
    const origin = `${req.get('x-forwarded-proto') ?? req.protocol}://${req.get('host')}`;
    const key = `${origin}|${code}`;
    if (!qrCache.has(key)) {
      if (qrCache.size > 500) qrCache.clear();
      qrCache.set(key, await QRCode.toString(`${origin}/?code=${code}`, { type: 'svg', margin: 1, color: { dark: '#4a3330', light: '#ffffff' } }));
    }
    res.set('Content-Type', 'image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(qrCache.get(key));
  });

  api.post('/dog', authed, wrap((req) => {
    const name = checkDogName(req.body?.name);
    if (!name.ok) throw new GameError(name.reason);
    const first = !game.loadDog(req.userId);
    const dog = game.createDog(req.userId, { name: name.name, breed: req.body?.breed, personality: req.body?.personality });
    if (!first) hub.dogsChanged(req.userId);
    return me(req.userId, { visit: true, events: dog.special ? [{ type: 'special', key: dog.special, from: dog.baseBreed }] : [] });
  }));

  api.post('/dog/action', authed, wrap((req) => {
    const res = game.act(req.userId, req.body?.action);
    if (res.events.some((e) => e.type === 'grew')) hub.dogChanged(req.userId);
    return { ...me(req.userId, { events: res.events }), result: { coins: res.coins, exp: res.exp, reaction: res.reaction } };
  }));

  api.post('/dog/clean', authed, wrap((req) => {
    const res = game.cleanPoop(req.userId, String(req.body?.id ?? ''));
    return { ...me(req.userId, { events: res.events }), result: { coins: res.coins } };
  }));
  api.post('/dog/treat', authed, wrap((req) => {
    const res = game.giveTreat(req.userId, String(req.body?.id ?? ''));
    return { ...me(req.userId, { events: res.events }), result: { fav: res.fav } };
  }));
  api.post('/shop/treat', authed, wrap((req) => {
    game.buyTreat(req.userId, String(req.body?.id ?? ''));
    return me(req.userId);
  }));
  api.post('/dog/switch', authed, wrap((req) => {
    const res = game.switchDog(req.userId, req.body?.dogId);
    hub.dogsChanged(req.userId);
    plaza.dogChanged(req.userId);
    return me(req.userId, { events: res.events });
  }));
  api.post('/dog/rename', authed, wrap((req) => {
    const name = checkDogName(req.body?.name);
    if (!name.ok) throw new GameError(name.reason);
    const res = game.renameDog(req.userId, name.name);
    hub.dogChanged(req.userId);
    plaza.dogChanged(req.userId);
    return me(req.userId, { events: res.events });
  }));
  // 가족 계정용 원조 코드 (환경 변수 ORIGINAL_CODE). 틀린 코드를 계속 넣지 못하게 막아요.
  api.post('/dog/original', authed, limiter(5, 10 * 60_000), wrap((req) => {
    game.claimOriginal(req.userId, req.body?.code, process.env.ORIGINAL_CODE);
    hub.dogChanged(req.userId);
    plaza.dogChanged(req.userId);
    return me(req.userId);
  }));

  api.post('/dog/title', authed, wrap((req) => {
    const id = req.body?.title ?? null;
    game.setTitle(req.userId, id === null ? null : String(id));
    hub.dogChanged(req.userId);
    plaza.dogChanged(req.userId);
    return me(req.userId);
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

  api.post('/school/boost', authed, wrap((req) => {
    const res = game.useBoost(req.userId, String(req.body?.id ?? ''));
    hub.dogChanged(req.userId);
    return { ...me(req.userId, { events: res.events }), result: { boost: res.boost } };
  }));
  api.post('/shop/boost', authed, wrap((req) => {
    game.buyBoost(req.userId, String(req.body?.id ?? ''));
    return me(req.userId);
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
    return { ...me(req.userId, { events: result.events }), result };
  }));

  api.post('/equip', authed, wrap((req) => {
    const slot = req.body?.slot;
    const res = game.equip(req.userId, slot, req.body?.itemId ?? null);
    if (['head', 'neck', 'face'].includes(slot)) { hub.dogChanged(req.userId); plaza.dogChanged(req.userId); } else hub.roomDecorChanged(req.userId);
    return me(req.userId, { events: res.events ?? [] });
  }));

  api.post('/minigame/start', authed, wrap((req) => game.startMinigame(req.userId, req.body?.type ?? 'catch')));
  api.post('/minigame/finish', authed, wrap((req) => {
    const res = game.finishMinigame(req.userId, req.body?.gameId, req.body?.score);
    if (res.events.some((e) => e.type === 'grew')) hub.dogChanged(req.userId);
    res.lb = leaderboard.submit(req.userId, res.type, res.safeScore);
    return { ...me(req.userId, { events: res.events }), result: res };
  }));

  // ---------- 이번 주 랭킹 ----------
  api.get('/leaderboard', authed, wrap((req) => leaderboard.board(req.userId, String(req.query.game ?? 'run'), req.query.scope === 'all' ? 'all' : 'friends')));
  api.post('/rope/start', authed, limiter(60, 10 * 60_000), wrap((req) => leaderboard.ropeStart(req.userId)));
  api.post('/rope/finish', authed, wrap((req) => ({ lb: leaderboard.ropeFinish(req.userId, req.body?.ropeId, req.body?.combo) })));

  // ---------- 운영자 (신고 확인) ----------
  // 환경 변수 ADMIN_CODE가 있을 때만 켜져요. 요청마다 x-admin-code 헤더로 확인해요.
  const adminOnly = (req, res, next) => {
    const secret = process.env.ADMIN_CODE;
    if (!secret) return res.status(404).json({ error: '없는 주소예요.' });
    const a = Buffer.from(String(req.get('x-admin-code') ?? '')); const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: '운영자 코드가 맞지 않아요.' });
    next();
  };
  api.get('/admin/reports', limiter(60, 10 * 60_000), adminOnly, wrap((req) => ({ targets: safety.adminReports({ includeResolved: req.query.all === '1' }) })));
  api.post('/admin/ban', limiter(60, 10 * 60_000), adminOnly, wrap((req) => {
    const userId = Number(req.body?.userId);
    if (!game.getUser(userId)) throw new GameError('없는 계정이에요.', 404);
    const until = safety.ban(userId, req.body?.hours);
    plaza.kick(userId, '운영자 확인 결과 잠시 놀이터에 들어올 수 없어요.');
    return { until };
  }));
  api.post('/admin/unban', limiter(60, 10 * 60_000), adminOnly, wrap((req) => { safety.unban(Number(req.body?.userId)); }));
  api.post('/admin/resolve', limiter(60, 10 * 60_000), adminOnly, wrap((req) => ({ resolved: safety.resolve(Number(req.body?.userId)) })));

  // ---------- 아기 강아지 선물 ----------
  api.get('/baby/check/:friendId', authed, wrap((req) => ({ reason: babies.check(req.userId, Number(req.params.friendId)) })));
  api.post('/baby/wish', authed, wrap((req) => {
    const wish = babies.wish(req.userId, req.body?.to);
    hub.emitToUser(wish.with.id, 'baby:wish', { from: game.getUser(req.userId).nickname });
    return { wish };
  }));
  api.post('/baby/:id/respond', authed, wrap((req) => {
    const wish = babies.respond(req.userId, req.params.id, !!req.body?.accept);
    hub.emitToUser(wish.with.id, 'baby:answer', { accepted: wish.status === 'accepted', by: game.getUser(req.userId).nickname });
    return { ...me(req.userId), wish };
  }));
  api.post('/baby/:id/cancel', authed, wrap((req) => { babies.cancel(req.userId, req.params.id); }));
  api.post('/baby/adopt', authed, wrap((req) => {
    const name = checkDogName(req.body?.name);
    if (!name.ok) throw new GameError(name.reason);
    const dog = babies.adopt(req.userId, req.body?.mailId, name.name);
    hub.dogsChanged(req.userId);
    return me(req.userId, { events: dog.special ? [{ type: 'special', key: dog.special, from: dog.baseBreed }] : [] });
  }));

  // ---------- 멍뭉거래 ----------
  api.get('/trades', authed, wrap((req) => trades.list(req.userId)));
  api.get('/trades/options/:friendId', authed, wrap((req) => trades.options(req.userId, Number(req.params.friendId))));
  api.post('/trades', authed, limiter(30, 10 * 60_000), wrap((req) => {
    const trade = trades.offer(req.userId, req.body?.to, req.body?.give, req.body?.ask);
    hub.emitToUser(trade.with.id, 'trade:new', { from: game.getUser(req.userId).nickname });
    return { trade };
  }));
  api.post('/trades/:id/respond', authed, wrap((req) => {
    const res = trades.respond(req.userId, req.params.id, !!req.body?.accept);
    hub.emitToUser(res.trade.with.id, 'trade:answer', { accepted: res.trade.status === 'accepted', by: game.getUser(req.userId).nickname });
    if (res.fromEvents?.length) game.onGrowth(res.trade.with.id, res.fromEvents);
    return { ...me(req.userId, { events: res.events }), trade: res.trade };
  }));
  api.post('/trades/:id/cancel', authed, wrap((req) => {
    const trade = trades.cancel(req.userId, req.params.id);
    hub.emitToUser(trade.with.id, 'trade:cancelled', {});
    return { trade };
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
  app.get('/{*splat}', sendIndex);

  return { build: BUILD, app, server, io, db, game, auth, friends, bonds, hub, safety, plaza, coop, progress, trades, babies, backups, rules: RULES };
}

// public/, shared/ 파일들의 경로·크기·수정 시각으로 짧은 버전 값을 만들어요
function buildId(dirs) {
  const h = crypto.createHash('sha1');
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else h.update(`${p}:${st.size}:${st.mtimeMs}`);
    }
  };
  dirs.forEach(walk);
  return h.digest('hex').slice(0, 10);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const { server } = createServer();
  server.listen(port, () => {
    console.log(`🐶 멍뭉고치 서버가 http://localhost:${port} 에서 열렸어요! (GAME_SPEED=${Number(process.env.GAME_SPEED) || 1})`);
  });
}
