import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { RULES, REFUSALS } from '../shared/data.js';

test('쓰다듬기는 참을성만큼만 좋아하고, 넘치면 성격대로 재밌게 거절해요 (벌칙 없음)', () => {
  let now = Date.UTC(2026, 8, 28, 3);
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now, rng: () => 0.9 });
  const { userId } = new Auth(db, { now: () => now }).signup('참을성', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'hyper' });
  db.prepare('UPDATE dogs SET affection = 10').run();
  const cap = RULES.patience.cap.hyper;
  for (let i = 0; i < cap; i++) assert.notEqual(game.act(userId, 'pet').reaction, 'grumpy');
  const aff = game.loadDog(userId).affection;
  const r1 = game.act(userId, 'pet');
  assert.equal(r1.reaction, 'grumpy');
  assert.deepEqual(r1.refusal, REFUSALS.hyper[0]);
  assert.equal(r1.patience.n, 0);
  assert.ok(r1.patience.nextIn > 0);
  assert.equal(game.act(userId, 'brush').refusal.text, REFUSALS.hyper[1].text, '계속 조르면 다른 반응');
  assert.equal(game.loadDog(userId).affection, aff, '거절당해도 애정도는 그대로 (벌칙 없음)');
  // 시간이 지나면 다시 좋아해요
  now += RULES.patience.refillSec * 1000;
  const r2 = game.act(userId, 'pet');
  assert.notEqual(r2.reaction, 'grumpy');
  assert.equal(r2.patience.n, 0);
  now += RULES.patience.refillSec * 1000 * cap;
  assert.equal(game.act(userId, 'pet').patience.n, cap - 1, '다 차면 최대까지만');
  // 밥 주기는 참을성과 상관없어요
  assert.notEqual(game.act(userId, 'feed').reaction, 'grumpy');
});
