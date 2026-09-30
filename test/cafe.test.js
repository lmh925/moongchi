import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { Asks } from '../server/asks.js';
import { Village } from '../server/village.js';
import { Cafe, cafeLevel } from '../server/cafe.js';
import { CAFE, PLACES } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 27, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  let seed = 1;
  const game = new Game(db, { now: clock.now, rng: () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; } });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  game.progress = new Progress(db, { game, friends, rng: () => 0.5 });
  const asks = new Asks(db, { game, friends });
  const village = new Village(db, { game, asks });
  const cafe = new Cafe(db, { game, friends, asks, village });
  Object.assign(game, { asks, village });
  const { userId } = auth.signup('카페장', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
  return { db, game, asks, village, cafe, clock, userId };
}

test('카페는 마을에서 열어야 하고, 메뉴 수는 카페 Lv만큼', () => {
  const { cafe, asks, village, userId } = setup();
  assert.throws(() => cafe.open(userId, ['cookie'], 'short'), /카페/);
  asks.addHearts(userId, PLACES.cafe.hearts);
  village.open(userId, 'cafe');
  assert.throws(() => cafe.open(userId, [], 'short'), /메뉴/);
  assert.throws(() => cafe.open(userId, ['cookie', 'milk', 'fish'], 'short'), /2개까지/);
  assert.throws(() => cafe.open(userId, ['pancake'], 'short'), /메뉴/, '아직 못 쓰는 메뉴');
  assert.ok(cafe.open(userId, ['cookie', 'fish'], 'short').open);
  assert.throws(() => cafe.open(userId, ['cookie'], 'short'), /벌써/);
  assert.deepEqual([cafeLevel(0).level, cafeLevel(10).level, cafeLevel(160).level], [1, 2, 6]);
});

test('영업이 끝나면 손님이 다녀가고, 최애 메뉴 손님은 ⭐5 · 도감에 모여요', () => {
  const { cafe, asks, village, game, userId, clock } = setup();
  asks.addHearts(userId, PLACES.cafe.hearts);
  village.open(userId, 'cafe');
  cafe.open(userId, ['fish', 'carrot'], 'mid');
  clock.advance(60 * 60_000);
  const coins0 = game.getUser(userId).coins;
  const { report } = cafe.collect(userId);
  assert.ok(report.guests.length >= CAFE.perHour);
  assert.ok(report.guests.every((g) => !g.fav || g.stars === 5));
  assert.equal(game.getUser(userId).coins, coins0 + report.coins);
  const v = cafe.view(userId);
  assert.equal(v.open, null);
  assert.equal(v.xp, report.guests.length);
  assert.ok(Object.keys(v.dex).length > 0);
  assert.ok(report.guests.some((g) => g.isNew));
  assert.throws(() => cafe.collect(userId), /영업 중이 아니/);
});

test('일찍 닫으면 영업한 만큼만, 직원은 우리 강아지만', () => {
  const { cafe, asks, village, game, userId, clock } = setup();
  asks.addHearts(userId, PLACES.cafe.hearts);
  village.open(userId, 'cafe');
  const dog = game.loadDog(userId);
  cafe.setStaff(userId, 'serve', dog.id);
  assert.equal(cafe.view(userId).staff.serve, dog.id);
  cafe.setStaff(userId, 'cook', dog.id);
  assert.deepEqual(cafe.view(userId).staff, { cook: dog.id }, '한 강아지는 한 가지 일');
  assert.throws(() => cafe.setStaff(userId, 'cook', 99999), /우리 강아지/);
  cafe.open(userId, ['cookie'], 'long');
  assert.throws(() => cafe.setStaff(userId, 'host', dog.id), /영업 중/);
  clock.advance(18 * 60_000); // 3시간 중 18분
  const { report } = cafe.collect(userId);
  assert.equal(report.early, true);
  assert.ok(report.guests.length <= 2);
});

test('손님 소개: 둘 다 단골이면 단짝이 되고 💗', () => {
  const { cafe, asks, village, userId, db } = setup();
  asks.addHearts(userId, PLACES.cafe.hearts);
  village.open(userId, 'cafe');
  assert.throws(() => cafe.introduce(userId, 'cat', 'bunny'), /단골/);
  const c = JSON.parse(db.prepare('SELECT cafe FROM users WHERE id = ?').get(userId).cafe);
  db.prepare('UPDATE users SET cafe = ? WHERE id = ?').run(JSON.stringify({ ...c, dex: { cat: 3, bunny: 4 } }), userId);
  const h0 = asks.view(userId).hearts;
  assert.equal(cafe.introduce(userId, 'cat', 'bunny').type, 'cafePair');
  assert.equal(asks.view(userId).hearts, h0 + CAFE.pairHearts);
  assert.throws(() => cafe.introduce(userId, 'bunny', 'cat'), /벌써/);
});

test('친구 강아지를 알바로 부를 수 있고, 끝까지 영업하면 알바비 편지 (하루 한 번)', () => {
  const { db, cafe, asks, village, game, userId, clock } = setup();
  const auth = new Auth(db, { now: clock.now });
  const friends = cafe.friends;
  const { userId: fid } = auth.signup('알바친구', '1234');
  game.createDog(fid, { name: '보리', breed: 'shiba', personality: 'sweet' });
  const { userId: stranger } = auth.signup('모르는애', '1234');
  game.createDog(stranger, { name: '남', breed: 'shiba', personality: 'sweet' });
  asks.addHearts(userId, PLACES.cafe.hearts);
  village.open(userId, 'cafe');
  assert.throws(() => cafe.setStaff(userId, 'host', `f:${fid}`), /친구만/);
  friends.request(userId, game.getUser(fid).friendCode);
  friends.respond(fid, friends.list(fid).incoming[0].id, true);
  assert.deepEqual(cafe.view(userId).helpers.map((h) => h.dog.name), ['보리']);
  assert.throws(() => cafe.setStaff(userId, 'host', `f:${stranger}`), /친구만/);
  const dog = game.loadDog(userId);
  cafe.setStaff(userId, 'cook', dog.id);
  cafe.setStaff(userId, 'host', `f:${fid}`);
  cafe.setStaff(userId, 'serve', `f:${fid}`);
  assert.deepEqual(cafe.view(userId).staff, { cook: dog.id, serve: `f:${fid}` }, '친구 알바도 한 가지 일만');
  const mails = () => game.progress.listMail(fid).filter((m) => m.kind === 'cafeHelp').length;
  cafe.open(userId, ['cookie'], 'short');
  clock.advance(30 * 60_000);
  cafe.collect(userId);
  assert.equal(mails(), 1);
  cafe.open(userId, ['cookie'], 'short');
  clock.advance(30 * 60_000);
  cafe.collect(userId);
  assert.equal(mails(), 1, '같은 날은 한 번만');
});
