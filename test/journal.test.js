import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Asks } from '../server/asks.js';
import { Safety } from '../server/safety.js';
import { Journal } from '../server/journal.js';
import { JOURNAL } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 30, 3);
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now });
  const auth = new Auth(db, { now: () => now });
  const friends = new Friends(db, game);
  const asks = new Asks(db, { game, friends });
  game.asks = asks;
  const safety = new Safety(db, { now: () => now });
  const notes = [];
  const journal = new Journal(db, { game, friends, safety, asks, notify: (id, ev, d) => notes.push({ id, ev, d }) });
  const mk = (nick) => { const { userId } = auth.signup(nick, '1234'); game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' }); return userId; };
  return { db, game, friends, journal, notes, mk, tick: (ms) => { now += ms; } };
}

test('일기는 하루 한 편: 처음 쓰면 선물, 다시 쓰면 고쳐져요. 며칠째인지도 세요', () => {
  const s = setup();
  const a = s.mk('일기왕');
  const c0 = s.game.getUser(a).coins;
  const r = s.journal.write(a, { weather: '☀️', mood: '😊', title: '산책', body: '콩이랑 공원에 갔다\n재밌었다', isPublic: false });
  assert.deepEqual(r.reward, { coins: JOURNAL.coins, hearts: JOURNAL.hearts });
  assert.equal(s.game.getUser(a).coins, c0 + JOURNAL.coins);
  const r2 = s.journal.write(a, { weather: '🌧️', mood: '😢', title: '비', body: '비가 왔다', isPublic: true });
  assert.equal(r2.reward, null, '같은 날 다시 쓰면 선물 없이 고쳐져요');
  const mine = s.journal.mine(a);
  assert.equal(mine.entries.length, 1); assert.equal(mine.entries[0].title, '비'); assert.equal(mine.written, true);
  s.tick(86_400_000);
  assert.equal(s.journal.write(a, { weather: '☀️', mood: '😆', title: '둘째 날', body: '또 썼다', isPublic: false }).streak, 2);
});

test('나쁜 말·비밀 정보는 쓸 수 없어요', () => {
  const s = setup();
  const a = s.mk('필터');
  assert.throws(() => s.journal.write(a, { title: '안녕', body: '내 번호는 010 1234 5678' }), /비밀 정보/);
  assert.throws(() => s.journal.write(a, { title: '안녕', body: '바보 멍청이 존나' }), /고운 말/);
  assert.throws(() => s.journal.write(a, { title: '', body: '내용' }), /적어/);
});

test('친구 공개 일기만 친구가 보고, 반응 스티커를 남기고, 신고가 둘이면 숨겨져요', () => {
  const s = setup();
  const a = s.mk('작가'); const b = s.mk('독자'); const c = s.mk('독자둘'); const x = s.mk('모르는애');
  s.friends.makeFriends(a, b); s.friends.makeFriends(a, c);
  s.journal.write(a, { title: '비밀', body: '나만 볼래', isPublic: false });
  assert.equal(s.journal.feed(b).entries.length, 0, '나만 보기는 친구도 못 봐요');
  s.tick(60_000);
  s.journal.write(a, { title: '공개', body: '다 같이 봐요', isPublic: true });
  assert.equal(s.journal.unread(b), 1);
  const feed = s.journal.feed(b).entries;
  assert.equal(feed.length, 1); assert.equal(feed[0].owner, '작가');
  assert.equal(s.journal.unread(b), 0, '봤으면 새 일기 표시가 사라져요');
  assert.equal(s.journal.feed(x).entries.length, 0, '친구가 아니면 못 봐요');
  assert.throws(() => s.journal.react(x, feed[0].id, '💗'), /볼 수 없는/);
  const v = s.journal.react(b, feed[0].id, '💗');
  assert.equal(v.reactions['💗'], 1); assert.equal(v.myReaction, '💗');
  assert.ok(s.notes.some((n) => n.id === a && n.ev === 'journal:react'));
  assert.equal(s.journal.react(b, feed[0].id, '💗').reactions['💗'], 0, '다시 누르면 빼요');
  s.journal.report(b, feed[0].id, 'diary_bad');
  assert.equal(s.journal.feed(c).entries.length, 1);
  s.journal.report(c, feed[0].id, 'diary_bad');
  assert.equal(s.journal.feed(c).entries.length, 0, '신고가 둘이면 숨겨요');
});
