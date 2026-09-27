// 놀이터(공개 광장), 술래잡기, 2인 협동 게임, 안전장치 테스트
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../server/index.js';
import { ribbon, gaugeAt } from '../shared/coop/ribbon.js';
import { FASHION, COOP_GAMES, SHOW_WARDROBE } from '../shared/data.js';

test('리본 풀기 규칙: 둘이 0.3초 안에 초록 칸에서 당겨야 성공', () => {
  const s = ribbon.init({ now: 0 });
  const t0 = s.stageStart;
  assert.deepEqual(ribbon.input(s, { role: 'p1', input: { type: 'pull', pos: 0.5 }, now: t0 - 10 }), [], '시작 전엔 무시');
  // 한 명만 당기면 0.3초 뒤 실패
  ribbon.input(s, { role: 'p1', input: { type: 'pull', pos: 0.5 }, now: t0 + 100 });
  const alone = ribbon.tick(s, t0 + 500);
  assert.equal(alone[0].why, 'alone');
  // 같이 당겼지만 한 명이 초록 칸 밖
  ribbon.input(s, { role: 'p1', input: { type: 'pull', pos: 0.5 }, now: t0 + 1000 });
  const zone = ribbon.input(s, { role: 'p2', input: { type: 'pull', pos: 0.95 }, now: t0 + 1100 });
  assert.equal(zone.at(-1).why, 'zone');
  assert.deepEqual(zone.at(-1).missed, ['p2']);
  // 3단계 모두 성공 → 클리어
  let now = t0 + 2000;
  for (let i = 0; i < 3; i++) {
    now = Math.max(now, s.stageStart) + 10;
    ribbon.input(s, { role: 'p1', input: { type: 'pull', pos: 0.5 }, now });
    const ev = ribbon.input(s, { role: 'p2', input: { type: 'pull', pos: 0.5 }, now: now + 250 });
    assert.equal(ev.find((e) => e.type === 'success').stage, i + 1);
    now += 300;
  }
  assert.equal(s.status, 'clear');
  assert.equal(ribbon.reward(s).item, 'clover');
  // 게이지는 0~1을 왕복해요
  const g = ribbon.init({ now: 0 });
  const p = COOP_GAMES.ribbon.stages[0].periodMs;
  assert.equal(gaugeAt(g, g.stageStart + p / 2), 0.5);
  assert.equal(gaugeAt(g, g.stageStart + p * 1.5), 0.5);
});

const { server, safety, plaza: plazaHub } = createServer({ dbFile: ':memory:', rateLimit: false });
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const sockets = [];
after(() => { sockets.forEach((s) => s.close()); server.close(); });

async function call(path, { token, body } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
let n = 0;
async function player(breed = 'bichon') {
  n += 1;
  const nick = `놀이${'가나다라마바사아자차카타파하구누두루무부수우주'[n]}`;
  const { data } = await call('/signup', { body: { nickname: nick, pin: '1234', consent: true } });
  const me = await call('/dog', { token: data.token, body: { name: `멍${n}`, breed, personality: 'sweet' } });
  const socket = ioClient(base, { auth: { token: data.token }, transports: ['websocket'] });
  sockets.push(socket);
  await new Promise((r) => socket.on('connect', r));
  return { token: data.token, id: me.data.user.id, socket };
}
const ask = (s, ev, payload) => new Promise((r) => s.emit(ev, payload, r));
const next = (s, ev, filter = () => true) => new Promise((r) => {
  const h = (p) => { if (filter(p)) { s.off(ev, h); r(p); } };
  s.on(ev, h);
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('놀이터: 누구나 같은 채널에 들어와서 서로의 움직임을 봐요 (친구가 아니어도)', async () => {
  const a = await player(); const b = await player('corgi');
  const ja = await ask(a.socket, 'plaza:join', {});
  assert.equal(ja.ok, true);
  const entered = next(a.socket, 'plaza:enter');
  const jb = await ask(b.socket, 'plaza:join', {});
  assert.equal(jb.channel, ja.channel);
  assert.equal((await entered).userId, b.id);
  const moved = next(a.socket, 'plaza:snap', (list) => list.some((p) => p[0] === b.id));
  await wait(120);
  b.socket.emit('plaza:pos', { x: 100, y: 120, dir: -1, moving: true });
  const pos = (await moved).find((p) => p[0] === b.id);
  assert.deepEqual(pos.slice(0, 4), [b.id, 100, 120, -1]);
  // 글자 채팅 대신 스티커만
  const bubble = next(a.socket, 'plaza:bubble');
  b.socket.emit('plaza:sticker', { id: 'heart' });
  assert.equal((await bubble).value, 'heart');
  // 차단하면 서로 안 보여요
  const gone = next(b.socket, 'plaza:exit');
  assert.equal((await ask(a.socket, 'plaza:block', { userId: b.id })).ok, true);
  assert.equal((await gone).userId, a.id);
  let heard = false;
  a.socket.once('plaza:bubble', () => { heard = true; });
  await wait(1300);
  b.socket.emit('plaza:sticker', { id: 'laugh' });
  await wait(200);
  assert.equal(heard, false);
  assert.equal(safety.isBlocked(b.id, a.id), true);
  a.socket.emit('plaza:leave'); b.socket.emit('plaza:leave');
});

test('신고가 3명에게서 들어오면 하루 동안 놀이터에 못 들어와요', async () => {
  const bad = await player();
  const reporters = [await player(), await player(), await player()];
  await ask(bad.socket, 'plaza:join', {});
  for (const r of reporters) await ask(r.socket, 'plaza:join', {});
  const kicked = next(bad.socket, 'plaza:kicked');
  for (const r of reporters) assert.equal((await ask(r.socket, 'plaza:report', { userId: bad.id, reason: 'mean' })).ok, true);
  await kicked;
  assert.equal((await ask(bad.socket, 'plaza:join', {})).ok, false);
  for (const r of reporters) r.socket.emit('plaza:leave');
});

test('술래잡기: 술래가 가까이 가면 술래가 바뀌어요', async () => {
  const a = await player(); const b = await player();
  await ask(a.socket, 'plaza:join', {});
  const jb = await ask(b.socket, 'plaza:join', {});
  assert.ok(jb.ok);
  // 처음엔 멀리 떨어져 있어요
  a.socket.emit('plaza:pos', { x: 40, y: 300 });
  b.socket.emit('plaza:pos', { x: 440, y: 300 });
  await wait(120);
  await ask(a.socket, 'tag:join', {});
  const playing = next(a.socket, 'tag:state', (t) => t?.status === 'play');
  await ask(b.socket, 'tag:join', {});
  const st = await playing;
  const it = st.it === a.id ? a : b; const runner = it === a ? b : a;
  await wait(1600); // 시작 직후 잠깐은 무적
  runner.socket.emit('plaza:pos', { x: 200, y: 200 });
  await wait(120);
  const tagged = next(a.socket, 'tag:tagged');
  it.socket.emit('plaza:pos', { x: 205, y: 200 });
  const ev = await tagged;
  assert.deepEqual([ev.from, ev.to], [it.id, runner.id]);
  a.socket.emit('plaza:leave'); b.socket.emit('plaza:leave');
});

test('협동 게임: 같은 놀이 장소에서 기다리던 두 명이 짝이 되고, 클리어하면 보상을 받아요', async () => {
  const a = await player(); const b = await player('poodle');
  await ask(a.socket, 'plaza:join', {});
  await ask(b.socket, 'plaza:join', {});
  assert.equal((await ask(a.socket, 'coop:queue', { game: 'ribbon' })).waiting, true);
  const startA = next(a.socket, 'coop:start');
  const startB = next(b.socket, 'coop:start');
  assert.equal((await ask(b.socket, 'coop:queue', { game: 'ribbon' })).started, true);
  const [sa, sb] = await Promise.all([startA, startB]);
  assert.equal(sa.role, 'p1');
  assert.equal(sb.role, 'p2');
  const coinsBefore = (await call('/me', { token: a.token })).data.user.coins;
  const ended = next(a.socket, 'coop:end');
  for (let i = 0; i < 3; i++) {
    const st = i === 0 ? sa.state : (await next(a.socket, 'coop:state', (p) => p.events.some((e) => e.type === 'success'))).state;
    await wait(Math.max(0, st.stageStart - Date.now()) + 50);
    a.socket.emit('coop:input', { sid: sa.sid, input: { type: 'pull', pos: 0.5 } });
    b.socket.emit('coop:input', { sid: sa.sid, input: { type: 'pull', pos: 0.5 } });
  }
  const end = await ended;
  assert.equal(end.status, 'clear');
  assert.equal(end.results.p1.item, 'clover');
  const me = (await call('/me', { token: a.token })).data;
  assert.equal(me.user.coins - coinsBefore, end.results.p1.coins);
  assert.ok(me.user.owned.includes('clover'));
  // 협동 게임은 경험치와 다정 재능도 줘요
  assert.ok(me.dog.exp >= 8);
  assert.ok(me.dog.talents.kind >= 4);
});

test('놀이터: 레벨 숫자는 숨기고 칭호만 보여요, 레벨이 모자란 몸짓은 막아요', async () => {
  const a = await player(); const b = await player();
  await ask(a.socket, 'plaza:join', {});
  const join = await ask(b.socket, 'plaza:join', {});
  const seenA = join.members.find((m) => m.userId === a.id);
  assert.equal(seenA.dog.titleName, '새싹 멍뭉이');
  assert.equal(seenA.dog.level, undefined);
  assert.equal(seenA.dog.talents, undefined);
  const got = [];
  b.socket.on('plaza:emote', (p) => got.push(p.kind));
  a.socket.emit('plaza:emote', { kind: 'dance' }); // Lv 10 몸짓
  await wait(800);
  a.socket.emit('plaza:emote', { kind: 'bark' });
  await wait(300);
  assert.deepEqual(got, ['bark']);
});

test('실시간 줄넘기 규칙: 둘 다 판정 범위 안에서 뛰어야 넘어가요', async () => {
  const { jumprope, ropePhase } = await import('../shared/coop/jumprope.js');
  const s = jumprope.init({ now: 0 });
  assert.equal(ropePhase(s, s.nextJ), 0.5);
  // 둘 다 성공
  let J = s.nextJ;
  jumprope.input(s, { role: 'p1', input: { type: 'jump', at: J - 50 }, now: J });
  jumprope.input(s, { role: 'p2', input: { type: 'jump', at: J + 60 }, now: J + 100 });
  let ev = jumprope.tick(s, J + 1000);
  assert.equal(ev[0].ok, true);
  assert.equal(s.combo, 1);
  // 한 명만 뛰면 하트가 줄어요
  J = s.nextJ;
  jumprope.input(s, { role: 'p1', input: { type: 'jump', at: J }, now: J });
  ev = jumprope.tick(s, J + 1000);
  assert.deepEqual([ev[0].ok, ev[0].missed, s.lives, s.combo], [false, ['p2'], COOP_GAMES.jumprope.lives - 1, 0]);
  // 너무 이르면 판정 안 됨 (벌칙도 없음)
  J = s.nextJ;
  assert.equal(jumprope.input(s, { role: 'p1', input: { type: 'jump', at: J - 700 }, now: J - 700 })[0].good, false);
  // 하트를 다 잃으면 끝
  for (let i = 0; i < COOP_GAMES.jumprope.lives - 1; i++) jumprope.tick(s, s.nextJ + 1000);
  assert.equal(s.status, 'over');
  assert.ok(jumprope.reward(s).coins >= 2);
});

test('보물찾기: 모래밭에서 파면 힌트를 주고, 가까이 파면 보물을 찾아요', async () => {
  const a = await player(); const b = await player();
  const ja = await ask(a.socket, 'plaza:join', {});
  await ask(b.socket, 'plaza:join', {});
  // 모래밭 밖에서는 못 파요
  a.socket.emit('plaza:pos', { x: 300, y: 300 });
  await wait(150);
  assert.equal((await ask(a.socket, 'treasure:dig', {})).ok, false);
  // 보물이 생길 때까지 기다린 뒤, 서버가 알려 준 채널의 보물 위치를 테스트에서 직접 꺼내 봐요
  await wait(300);
  const ch = plazaHub.channels.get(ja.channel);
  assert.ok(ch.treasures.length >= 1);
  const t = ch.treasures[0];
  // 모래밭 안쪽(가운데 방향)으로 25픽셀 떨어진 곳을 파요
  b.socket.emit('plaza:pos', { x: t.x + (t.x > 91 ? -25 : 25), y: t.y });
  await wait(150);
  const miss = await ask(b.socket, 'treasure:dig', {});
  assert.equal(miss.ok, true, miss.reason);
  assert.equal(miss.found, false);
  assert.ok(['warm', 'hot', 'cold'].includes(miss.hint));
  a.socket.emit('plaza:pos', { x: t.x, y: t.y });
  await wait(150);
  const found = next(b.socket, 'treasure:found');
  const res = await ask(a.socket, 'treasure:dig', {});
  assert.equal(res.found, true);
  const ev = await found;
  assert.equal(ev.userId, a.id);
  assert.deepEqual(ev.helpers, [b.id], '같이 판 친구도 선물을 받아요');
  a.socket.emit('plaza:leave'); b.socket.emit('plaza:leave');
});

test('멍멍 축구: 두 팀으로 나뉘고, 공을 골대에 넣으면 점수가 올라요', async () => {
  const a = await player(); const b = await player();
  const ja = await ask(a.socket, 'plaza:join', {});
  await ask(b.socket, 'plaza:join', {});
  a.socket.emit('plaza:pos', { x: 320, y: 250 });
  b.socket.emit('plaza:pos', { x: 440, y: 310 });
  const ta = await ask(a.socket, 'soccer:join', {});
  const playing = next(a.socket, 'soccer:state', (s) => s?.status === 'play');
  const tb = await ask(b.socket, 'soccer:join', {});
  assert.notEqual(ta.team, tb.team, '팀이 골고루 나뉘어요');
  await playing;
  // 핑크팀은 오른쪽 골대로 공격해요. 공을 오른쪽 골대 바로 앞에 놓고 핑크팀 강아지가 뒤에서 차요
  const g = plazaHub.channels.get(ja.channel).soccer;
  const pinkPlayer = ta.team === 'pink' ? a : b;
  Object.assign(g.ball, { x: 452, y: 280, vx: 0, vy: 0 });
  const goal = next(a.socket, 'soccer:goal');
  await wait(120);
  pinkPlayer.socket.emit('plaza:pos', { x: 444, y: 282 });
  pinkPlayer.socket.emit('soccer:kick');
  const ev = await goal;
  assert.equal(ev.team, 'pink');
  assert.equal(ev.score.pink, 1);
  // 경기가 끝나면 모두 코인을 받아요
  const ended = next(a.socket, 'soccer:end');
  g.endsAt = Date.now();
  const end = await ended;
  assert.equal(end.winner, 'pink');
  assert.ok(end.results.every((r) => r.coins > 0));
  a.socket.emit('plaza:leave'); b.socket.emit('plaza:leave');
});

test('운영자 화면: 코드가 있어야 하고, 신고를 보고 놀이터 제한·풀기·확인 완료를 해요', async () => {
  const a = await player(); const b = await player(); const c = await player();
  safety.report(a.id, c.id, 'mean');
  safety.report(b.id, c.id, 'follow');
  const admin = (path, body, code) => fetch(`${base}/api/admin${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(code ? { 'x-admin-code': code } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  delete process.env.ADMIN_CODE;
  assert.equal((await admin('/reports')).status, 404, '코드를 안 정하면 꺼져 있어요');
  process.env.ADMIN_CODE = 'admin-secret';
  assert.equal((await admin('/reports', null, 'wrong-secret')).status, 401);
  const { targets } = await (await admin('/reports', null, 'admin-secret')).json();
  const t = targets.find((x) => x.targetId === c.id);
  assert.equal(t.reporters, 2);
  assert.equal((await admin('/ban', { userId: c.id, hours: 24 }, 'admin-secret')).status, 200);
  assert.ok(safety.bannedUntil(c.id) > Date.now());
  const join = await ask(c.socket, 'plaza:join', {});
  assert.equal(join.ok, false, '제한 중엔 놀이터에 못 들어가요');
  await admin('/unban', { userId: c.id }, 'admin-secret');
  assert.equal(safety.bannedUntil(c.id), 0);
  await admin('/resolve', { userId: c.id }, 'admin-secret');
  const after = await (await admin('/reports', null, 'admin-secret')).json();
  assert.ok(!after.targets.some((x) => x.targetId === c.id), '확인한 신고는 목록에서 빠져요');
  delete process.env.ADMIN_CODE;
});

test('멍뭉 패션쇼: 참가 → 옷 갈아입기 → 한 명씩 무대, 응원은 한 친구에게 3번까지 → 결과', async () => {
  const saved = { ...FASHION };
  Object.assign(FASHION, { countdownMs: 100, dressMs: 700, walkMs: 1200 });
  try {
    const a = await player(); const b = await player(); const fan = await player();
    for (const p of [a, b, fan]) await ask(p.socket, 'plaza:join', {});
    assert.equal((await ask(a.socket, 'show:join', {})).ok, true);
    const dress = next(fan.socket, 'show:state', (s) => s?.status === 'dress');
    assert.equal((await ask(b.socket, 'show:join', {})).ok, true);
    const st = await dress;
    assert.ok(st.theme);
    assert.equal((await ask(fan.socket, 'show:join', {})).ok, false, '시작하면 더 못 들어와요');
    // 의상실: 참가한 친구만, 무대 의상만 빌려 입어요. 주제에 맞으면 응원 +1
    // 주제마다 의상 자리가 달라요 (학교 주제는 머리 의상이 없어요)
    const match = Object.keys(SHOW_WARDROBE).find((id) => SHOW_WARDROBE[id].theme === st.themeKey);
    const slot = SHOW_WARDROBE[match].slot;
    const wrongSlot = slot === 'neck' ? 'head' : 'neck';
    const other = Object.keys(SHOW_WARDROBE).find((id) => SHOW_WARDROBE[id].theme !== st.themeKey && SHOW_WARDROBE[id].slot === wrongSlot);
    assert.equal((await ask(fan.socket, 'show:dress', { slot, itemId: match })).ok, false, '구경하는 친구는 못 입어요');
    assert.equal((await ask(a.socket, 'show:dress', { slot: 'head', itemId: 'crown' })).ok, false, '의상실 옷만 빌려요');
    assert.equal((await ask(a.socket, 'show:dress', { slot: wrongSlot, itemId: match })).ok, false, '자리에 맞는 옷만');
    const seen = next(fan.socket, 'plaza:dog', (d) => d.userId === a.id && d.dog.equip[slot] === match);
    assert.equal((await ask(a.socket, 'show:dress', { slot, itemId: match })).ok, true);
    await seen;
    await wait(170);
    assert.equal((await ask(b.socket, 'show:dress', { slot: wrongSlot, itemId: other })).ok, true);
    const walkA = await next(fan.socket, 'show:state', (s) => s?.status === 'walk' && s.walker === a.id);
    assert.equal(walkA.players.length, 2);
    assert.deepEqual([walkA.bonus, walkA.cheers], [1, 1], '주제에 맞는 의상 보너스');
    assert.equal((await ask(a.socket, 'show:dress', { slot, itemId: null })).ok, false, '무대에선 못 갈아입어요');
    const back = next(fan.socket, 'plaza:dog', (d) => d.userId === a.id && d.dog.equip[slot] !== match);
    for (let i = 0; i < 5; i++) { fan.socket.emit('show:react', { kind: 'heart' }); await wait(170); }
    a.socket.emit('show:react', { kind: 'heart' }); // 나 자신은 응원 못 해요
    const end = await next(fan.socket, 'show:end');
    const ra = end.results.find((r) => r.userId === a.id);
    const rb = end.results.find((r) => r.userId === b.id);
    assert.equal(ra.cheers, 4, '한 친구에게 3번까지 + 주제 보너스 1');
    await back; // 쇼가 끝나면 빌린 의상은 돌려줘요
    assert.equal(ra.star, true);
    assert.equal(rb.star, false);
    assert.ok(ra.coins > rb.coins);
  } finally {
    Object.assign(FASHION, saved);
  }
});
