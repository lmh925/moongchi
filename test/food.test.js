import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { applyDecay, HOUR } from '../shared/rules.js';
import { FOOD, POOP, TREATS } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 }); // rng 0: 똥은 늘 싸요
  const auth = new Auth(db, { now: clock.now });
  const { userId } = auth.signup('밥줘요', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'foodie' });
  const hungry = () => db.prepare('UPDATE dogs SET fullness = 20 WHERE user_id = ?').run(userId);
  return { db, game, clock, userId, hungry };
}

test('사료 그릇: 쓰면 줄고, 떨어지면 못 주고, 시간이 지나면 다시 채워져요', () => {
  const { game, clock, userId, hungry } = setup();
  assert.equal(game.kibble(userId).n, FOOD.kibbleMax);
  for (let i = 0; i < FOOD.kibbleMax; i++) { hungry(); game.act(userId, 'feed'); }
  assert.equal(game.kibble(userId).n, 0);
  hungry();
  assert.throws(() => game.act(userId, 'feed'), /사료가 다 떨어졌어요/);
  clock.advance(FOOD.refillMs + 1000);
  assert.equal(game.kibble(userId).n, 1);
  game.act(userId, 'feed');
  assert.equal(game.kibble(userId).n, 0);
  clock.advance(FOOD.refillMs * 100);
  assert.equal(game.kibble(userId).n, FOOD.kibbleMax, '최대까지만');
  // 배부르면 사료를 쓰지 않아요
  const before = game.kibble(userId).n;
  game.refreshDog(userId);
  game.db.prepare('UPDATE dogs SET fullness = 99 WHERE user_id = ?').run(userId);
  assert.equal(game.act(userId, 'feed').reaction, 'full');
  assert.equal(game.kibble(userId).n, before);
});

test('똥: 먹고 조금 뒤에 생기고, 치우면 청결도·코인, 오래 두면 청결도가 더 빨리 줄어요', () => {
  const { game, clock, userId, hungry } = setup();
  hungry();
  game.act(userId, 'feed');
  assert.equal(game.loadDog(userId).poop.list?.length ?? 0, 0, '바로는 안 싸요');
  clock.advance(POOP.delayMs + 1000);
  const { dog } = game.refreshDog(userId);
  assert.equal(dog.poop.list.length, 1);
  const base = { personality: 'smart', fullness: 80, cleanliness: 80, affection: 80, fluff: 0, updatedAt: 0, school: null };
  const clean = applyDecay(base, 10 * HOUR).cleanliness;
  const dirty = applyDecay({ ...base, poop: { list: [{}, {}] } }, 10 * HOUR).cleanliness;
  assert.ok(dirty < clean);
  const coins = game.getUser(userId).coins;
  const res = game.cleanPoop(userId, dog.poop.list[0].id);
  assert.equal(res.dog.poop.list.length, 0);
  assert.equal(game.getUser(userId).coins, coins + POOP.cleanCoins);
  assert.throws(() => game.cleanPoop(userId, dog.poop.list[0].id), /이미 치웠어요/);
});

test('간식: 사서 주면 포만감·애정도, 좋아하는 간식이면 더, 배가 너무 부르면 안 먹어요', () => {
  const { game, userId, hungry, db } = setup();
  game.addCoins(userId, 100);
  assert.throws(() => game.giveTreat(userId, 'jerky'), /간식이 없어요/);
  game.buyTreat(userId, 'jerky');
  game.buyTreat(userId, 'milk');
  assert.equal(game.getUser(userId).treats.jerky, 1);
  hungry();
  db.prepare('UPDATE dogs SET affection = 30 WHERE user_id = ?').run(userId);
  const r = game.giveTreat(userId, 'jerky'); // 먹보는 육포를 좋아해요
  assert.equal(r.fav, true);
  assert.equal(r.dog.affection, 30 + TREATS.jerky.affection + 6);
  assert.equal(game.getUser(userId).treats.jerky, 0);
  db.prepare('UPDATE dogs SET fullness = 99 WHERE user_id = ?').run(userId);
  assert.throws(() => game.giveTreat(userId, 'milk'), /배가 너무 불러요/);
});
