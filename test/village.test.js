import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { Asks } from '../server/asks.js';
import { Village, tasteOf } from '../server/village.js';
import { PLACES, TREATS, YARD, ROOM_SETS, SET_REWARD, TASTES } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 27, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0.3 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  game.progress = new Progress(db, { game, friends, rng: () => 0.5 });
  const asks = new Asks(db, { game, friends });
  const village = new Village(db, { game, asks });
  Object.assign(game, { asks, village });
  const { userId } = auth.signup('마을이', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
  return { db, game, asks, village, clock, userId };
}

test('모은 💗가 충분하면 마을 장소가 열려요 (써서 없어지지 않아요)', () => {
  const { village, asks, userId } = setup();
  assert.throws(() => village.open(userId, 'yard'), /더 모으면/);
  asks.addHearts(userId, PLACES.yard.hearts);
  assert.equal(village.open(userId, 'yard').type, 'placeOpen');
  assert.throws(() => village.open(userId, 'yard'), /벌써/);
  assert.equal(asks.view(userId).hearts, PLACES.yard.hearts, '💗는 그대로');
  assert.deepEqual(village.view(userId).places, ['yard']);
});

test('마당 땅 파기: 하루 3번, 무언가 나와요', () => {
  const { village, asks, userId, clock } = setup();
  assert.throws(() => village.dig(userId), /마당/);
  asks.addHearts(userId, PLACES.yard.hearts);
  village.open(userId, 'yard');
  for (let i = 0; i < YARD.digsPerDay; i++) assert.ok(village.dig(userId).found.kind);
  assert.throws(() => village.dig(userId), /내일/);
  clock.advance(24 * 3600_000);
  assert.ok(village.dig(userId).found);
});

test('간식 반응: 강아지마다 최애 1개·별로 1개, 최애면 애정 보너스와 하루 2번 💗', () => {
  const { game, asks, userId, db } = setup();
  const dog = game.loadDog(userId);
  const ratings = Object.keys(TREATS).map((t) => tasteOf(dog.id, t));
  assert.equal(ratings.filter((r) => r === 3).length, 1);
  assert.equal(ratings.filter((r) => r === 0).length, 1);
  const love = Object.keys(TREATS).find((t) => tasteOf(dog.id, t) === 3);
  db.prepare('UPDATE users SET treats = ? WHERE id = ?').run(JSON.stringify({ [love]: 5 }), userId);
  let hearts = 0;
  for (let i = 0; i < 3; i++) {
    db.prepare('UPDATE dogs SET fullness = 20, affection = 20 WHERE user_id = ?').run(userId);
    const r = game.giveTreat(userId, love);
    const t = r.events.find((e) => e.type === 'taste');
    assert.equal(t.rating, 3);
    assert.equal(t.first, i === 0);
    hearts += t.hearts;
    assert.ok(r.dog.affection >= 20 + TREATS[love].affection + TASTES.loveAffection);
  }
  assert.equal(hearts, TASTES.loveHeartsPerDay);
  assert.equal(game.loadDog(userId).tastes[love], 3);
  assert.equal(asks.view(userId).hearts >= 2, true);
});

test('가구 세트를 맞추면 처음 한 번 💗와 코인', () => {
  const { village, game, userId } = setup();
  const S = ROOM_SETS.cozy;
  const room = { wallpaper: S.items[0], rug: S.items[1], bed: S.items[2], toy: S.items[3] };
  const coins0 = game.getUser(userId).coins;
  const ev = village.checkSets(userId, room);
  assert.deepEqual(ev.map((e) => e.id), ['cozy']);
  assert.equal(game.getUser(userId).coins, coins0 + SET_REWARD.coins);
  assert.equal(village.checkSets(userId, room).length, 0, '한 번만');
  assert.equal(village.checkSets(userId, { ...room, toy: null }).length, 0);
});

test('💗가 기준을 넘으면 장소가 저절로 열려요', async () => {
  const { openDb } = await import('../server/db.js');
  const { Game } = await import('../server/game.js');
  const { Auth } = await import('../server/auth.js');
  const { Friends } = await import('../server/friends.js');
  const { Asks } = await import('../server/asks.js');
  const { Village } = await import('../server/village.js');
  const { PLACES } = await import('../shared/data.js');
  const db = openDb(':memory:');
  const game = new Game(db, {});
  const friends = new Friends(db, game);
  const asks = new Asks(db, { game, friends });
  const village = new Village(db, { game, asks });
  const { userId } = new Auth(db, {}).signup('자동열림', '1234');
  assert.deepEqual(village.autoOpen(userId), []);
  asks.addHearts(userId, PLACES.cafe.hearts);
  const evs = village.autoOpen(userId);
  assert.deepEqual(evs.map((e) => e.id), ['yard', 'cafe']);
  assert.deepEqual(village.autoOpen(userId), [], '한 번만 열려요');
  assert.ok(village.has(userId, 'cafe') && !village.has(userId, 'spa'));
});
