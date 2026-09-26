// HTTP API + 실시간 방(Socket.io) 통합 테스트
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createServer } from '../server/index.js';

const { server, hub } = createServer({ dbFile: ':memory:' });
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const sockets = [];
after(() => { sockets.forEach((s) => s.close()); server.close(); });

async function call(path, { token, body, method } = {}) {
  const res = await fetch(`${base}/api${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function player(nickname, breed) {
  const { data } = await call('/signup', { body: { nickname, pin: '1234', consent: true } });
  const me = await call('/dog', { token: data.token, body: { name: `${nickname}멍`, breed, personality: 'sweet' } });
  const socket = ioClient(base, { auth: { token: data.token }, transports: ['websocket'] });
  sockets.push(socket);
  await new Promise((r) => socket.on('connect', r));
  return { token: data.token, me: me.data, socket };
}

const ask = (socket, ev, payload) => new Promise((r) => socket.emit(ev, payload, r));
const next = (socket, ev) => new Promise((r) => socket.once(ev, r));

test('인증 없이는 API를 쓸 수 없어요', async () => {
  assert.equal((await call('/me')).status, 401);
});

test('두 친구가 서로의 집에 놀러 가서 스티커와 채팅을 나눠요', async () => {
  const a = await player('해님', 'poodle');
  const b = await player('달님', 'maltese');
  const c = await player('별님', 'corgi');

  // 친구가 아니면 방에 못 들어가요
  assert.equal((await ask(b.socket, 'room:join', { ownerId: a.me.user.id })).ok, false);

  const req = await call('/friends/request', { token: b.token, body: { code: a.me.user.friendCode } });
  assert.equal(req.data.status, 'sent');
  const list = await call('/friends', { token: a.token });
  await call('/friends/respond', { token: a.token, body: { requestId: list.data.incoming[0].id, accept: true } });

  assert.equal((await ask(a.socket, 'room:join', { ownerId: a.me.user.id })).ok, true);
  const entered = next(a.socket, 'room:enter');
  const join = await ask(b.socket, 'room:join', { ownerId: a.me.user.id });
  assert.equal(join.ok, true);
  assert.equal(join.room.owner.nickname, '해님');
  assert.equal((await entered).nickname, '달님');

  const bubble = next(a.socket, 'room:bubble');
  b.socket.emit('room:sticker', { id: 'heart' });
  assert.deepEqual(await bubble, { userId: b.me.user.id, kind: 'sticker', value: 'heart' });

  await new Promise((r) => setTimeout(r, 1300));
  assert.equal((await ask(b.socket, 'room:chat', { text: '010-1234-5678' })).ok, false);
  await new Promise((r) => setTimeout(r, 1300));
  const chat = next(a.socket, 'room:bubble');
  assert.equal((await ask(b.socket, 'room:chat', { text: '안녕 반가워' })).ok, true);
  assert.equal((await chat).value, '안녕 반가워');

  // 별님은 해님과만 친구 → 방에 들어오면 달님과는 친구가 아니라서 글자 채팅이 막혀요
  await call('/friends/request', { token: c.token, body: { code: a.me.user.friendCode } });
  const l2 = await call('/friends', { token: a.token });
  await call('/friends/respond', { token: a.token, body: { requestId: l2.data.incoming[0].id, accept: true } });
  const allowed = next(b.socket, 'room:chat-allowed');
  assert.equal((await ask(c.socket, 'room:join', { ownerId: a.me.user.id })).ok, true);
  assert.equal((await allowed).allowed, false);
  await new Promise((r) => setTimeout(r, 1300));
  assert.equal((await ask(c.socket, 'room:chat', { text: '안녕' })).ok, false);
});

test('돌봄 API와 학교 보내기', async () => {
  const p = await player('초롱', 'shiba');
  const fed = await call('/dog/action', { token: p.token, body: { action: 'feed' } });
  assert.equal(fed.status, 200);
  assert.ok(fed.data.dog.fullness > p.me.dog.fullness);
  const school = await call('/school', { token: p.token, body: { course: 'walk' } });
  assert.ok(school.data.dog.school);
  const blocked = await call('/dog/action', { token: p.token, body: { action: 'pet' } });
  assert.equal(blocked.status, 400);
});

test('간식 파티: 가까이 있는 강아지만 간식을 먹고, 끝나면 코인을 받아요', async () => {
  const a = await player('파티장', 'bichon');
  const b = await player('손님', 'corgi');
  await call('/friends/request', { token: b.token, body: { code: a.me.user.friendCode } });
  const l = await call('/friends', { token: a.token });
  await call('/friends/respond', { token: a.token, body: { requestId: l.data.incoming[0].id, accept: true } });
  await ask(a.socket, 'room:join', { ownerId: a.me.user.id });
  assert.equal((await ask(a.socket, 'party:start', {})).ok, false, '혼자서는 파티 불가');
  await ask(b.socket, 'room:join', { ownerId: a.me.user.id });
  const started = next(a.socket, 'party:start');
  const treat = next(a.socket, 'party:treat');
  assert.equal((await ask(b.socket, 'party:start', {})).ok, true);
  await started;
  const t = await treat;
  b.socket.emit('party:grab', { treatId: t.id, x: (t.x + 0.5) % 1, y: t.y }); // 너무 멀어요
  const grabbed = next(a.socket, 'party:grabbed');
  b.socket.emit('party:grab', { treatId: t.id, x: t.x, y: t.y });
  const g = await grabbed;
  assert.equal(g.userId, b.me.user.id);
  const coinsBefore = (await call('/me', { token: b.token })).data.user.coins;
  const ended = next(a.socket, 'party:end');
  hub.endParty(a.me.user.id);
  const { results } = await ended;
  assert.equal(results[0].userId, b.me.user.id);
  assert.ok(results[0].winner);
  const coinsAfter = (await call('/me', { token: b.token })).data.user.coins;
  assert.equal(coinsAfter - coinsBefore, results[0].coins);
});

test('게임 파일은 버전 주소로 불러와서 옛 캐시가 남지 않아요', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const html = await res.text();
  const m = /\/v\/([0-9a-f]{10})\/js\/main\.js/.exec(html);
  assert.ok(m, '버전이 들어간 main.js 주소');
  const { build } = await (await fetch(`${base}/api/version`)).json();
  assert.equal(build, m[1]);
  const js = await fetch(`${base}/v/${build}/js/main.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('cache-control'), /immutable/);
  const shared = await fetch(`${base}/v/${build}/shared/data.js`);
  assert.equal(shared.status, 200);
  const plain = await fetch(`${base}/js/main.js`);
  assert.equal(plain.headers.get('cache-control'), 'no-cache');
});

test('가입은 보호자 확인 체크가 필요하고, 계정 지우기는 비밀번호를 다시 확인해요', async () => {
  const no = await call('/signup', { body: { nickname: '동의안함', pin: '1234' } });
  assert.equal(no.status, 400);
  const p = await player('지울계정', 'poodle');
  let closed = false;
  p.socket.on('disconnect', () => { closed = true; });
  const wrong = await call('/account/delete', { token: p.token, body: { pin: '9999' } });
  assert.equal(wrong.status, 401);
  const ok = await call('/account/delete', { token: p.token, body: { pin: '1234' } });
  assert.equal(ok.status, 200);
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(closed, '열린 창도 닫혀요');
  assert.equal((await call('/me', { token: p.token })).status, 401);
  const again = await call('/login', { body: { nickname: '지울계정', pin: '1234' } });
  assert.equal(again.status, 400, '닉네임도 사라져요');
  const page = await fetch(`${base}/privacy`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /개인정보처리방침/);
});
