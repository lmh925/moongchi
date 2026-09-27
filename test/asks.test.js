import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { Asks } from '../server/asks.js';
import { ASK_RULES, TREATS } from '../shared/data.js';

// 소원 종류에 맞게 들어주기
const trackFor = (cur) => ({ treat: ['treat', { treat: cur.target }], wear: ['equip', { item: cur.target }], train: ['train', { course: cur.target }], friend: ['visit', {}] }[cur.kind] ?? [cur.kind, {}]);

function setup(rngValue = 0.5) {
  let now = Date.UTC(2026, 8, 27, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  let r = rngValue;
  const game = new Game(db, { now: clock.now, rng: () => r });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  game.progress = new Progress(db, { game, friends, rng: () => 0.5 });
  const asks = new Asks(db, { game, friends });
  game.asks = asks;
  const { userId } = auth.signup('소원이', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
  return { db, game, asks, clock, userId, setRng: (v) => { r = v; } };
}

test('소원이 생기고, 들어주면 💗와 코인, 다음 소원은 조금 뒤에', () => {
  const { game, asks, userId, clock } = setup(0.5);
  asks.check(userId, game.loadDog(userId));
  let v = asks.view(userId);
  assert.ok(v.cur, '소원이 생겨요');
  assert.equal(v.cur.rainbow, false);
  assert.ok(v.cur.text && v.cur.emoji && v.cur.how);
  assert.deepEqual(asks.onTrack(userId, 'nothing', {}), [], '다른 일로는 안 이루어져요');
  const coins0 = game.getUser(userId).coins;
  const [kind, extra] = trackFor(v.cur);
  const ev = asks.onTrack(userId, kind, extra);
  assert.equal(ev[0].type, 'askDone');
  v = asks.view(userId);
  assert.equal(v.cur, null);
  assert.equal(v.hearts, ASK_RULES.hearts);
  assert.equal(v.heartsTotal, ASK_RULES.hearts);
  assert.equal(game.getUser(userId).coins, coins0 + ASK_RULES.coins);
  // 바로는 새 소원이 안 생기고, 시간이 지나면 생겨요
  asks.check(userId, game.loadDog(userId));
  assert.equal(asks.view(userId).cur, null);
  clock.advance(ASK_RULES.gapMs + 1);
  asks.check(userId, game.loadDog(userId));
  assert.ok(asks.view(userId).cur);
});

test('간식 소원은 간식을 주면 이루어지고, 오래 두면 조용히 사라져요', () => {
  const { game, asks, userId, clock, db } = setup(0.01); // 첫 후보 = 간식, 0.01 < 무지개 확률이라 무지개
  asks.check(userId, game.loadDog(userId));
  const cur = asks.view(userId).cur;
  assert.equal(cur.kind, 'treat');
  assert.ok(TREATS[cur.target]);
  assert.deepEqual(asks.onTrack(userId, 'treat', { treat: 'nope' }), [], '다른 간식은 안 돼요');
  db.prepare('UPDATE users SET treats = ? WHERE id = ?').run(JSON.stringify({ [cur.target]: 1 }), userId);
  db.prepare('UPDATE dogs SET fullness = 40 WHERE user_id = ?').run(userId);
  const res = game.giveTreat(userId, cur.target);
  assert.ok(res.events.some((e) => e.type === 'askDone'));
  asks.chooseGift(userId, 2);
  clock.advance(ASK_RULES.gapMs + 1);
  asks.check(userId, game.loadDog(userId));
  const next = asks.view(userId).cur;
  assert.ok(next);
  clock.advance(ASK_RULES.lifeMs + 1);
  assert.equal(asks.view(userId).cur, null, '시간이 지나면 사라져요');
});

test('🌈 무지개 소원은 선물 3개 중 하나를 골라요 (한 번만)', () => {
  const { game, asks, userId } = setup(0.05); // 0.05 < rainbowChance
  asks.check(userId, game.loadDog(userId));
  const cur = asks.view(userId).cur;
  assert.equal(cur.rainbow, true);
  const [kind, extra] = trackFor(cur);
  const ev = asks.onTrack(userId, kind, extra);
  assert.equal(ev[0].gift.length, 3);
  const coins0 = game.getUser(userId).coins;
  assert.equal(asks.chooseGift(userId, 1).kind, 'coins');
  assert.equal(game.getUser(userId).coins, coins0 + 30);
  assert.equal(asks.chooseGift(userId, 0), null, '두 번은 못 골라요');
});

test('돌봄 대성공: 가끔 경험치·코인이 두 배', () => {
  const { game, userId, db } = setup(0); // rng 0 → 항상 대성공
  db.prepare('UPDATE dogs SET cleanliness = 30 WHERE user_id = ?').run(userId);
  const r = game.act(userId, 'brush');
  assert.ok(r.events.some((e) => e.type === 'lucky'));
  assert.equal(r.coins, 4);
});
