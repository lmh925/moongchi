// 놀이터(공개 광장), 술래잡기, 2인 협동 게임, 안전장치 테스트
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../server/index.js';
import { ribbon, gaugeAt } from '../shared/coop/ribbon.js';
import { COOP_GAMES } from '../shared/data.js';

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

const { server, safety } = createServer({ dbFile: ':memory:' });
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
  const nick = `놀이${'가나다라마바사아자차카타파하'[n]}`;
  const { data } = await call('/signup', { body: { nickname: nick, pin: '1234' } });
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
  assert.deepEqual([ev[0].ok, ev[0].missed, s.lives, s.combo], [false, ['p2'], 2, 0]);
  // 너무 이르면 판정 안 됨 (벌칙도 없음)
  J = s.nextJ;
  assert.equal(jumprope.input(s, { role: 'p1', input: { type: 'jump', at: J - 600 }, now: J - 600 })[0].good, false);
  // 하트를 다 잃으면 끝
  for (let i = 0; i < 2; i++) jumprope.tick(s, s.nextJ + 1000);
  assert.equal(s.status, 'over');
  assert.ok(jumprope.reward(s).coins >= 2);
});
