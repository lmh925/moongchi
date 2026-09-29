import test from 'node:test';
import assert from 'node:assert/strict';
import { BREEDS, QUIZ } from '../shared/data.js';
import { breedOf, quizResult } from '../shared/rules.js';

const normal = Object.keys(BREEDS).filter((k) => !BREEDS[k].special);
test('무늬는 털색 부모에게서 물려받아요', () => {
  const m = breedOf('mix:dalmatian:dachshund');
  assert.equal(m.pattern, 'spots');
  assert.equal(m.bodyLong, true);
  assert.equal(breedOf('mix:dachshund:dalmatian').pattern, undefined);
});

test('퀴즈를 건너뛰어도(답 없음) 스페셜 견종은 나오지 않아요', () => {
  for (let i = 0; i < 200; i++) assert.ok(!BREEDS[quizResult([]).breed].special);
  for (const r of [0, 0.5, 0.999]) assert.ok(!BREEDS[quizResult([], () => r).breed].special);
});

test('심리테스트로 모든 보통 견종을 만날 수 있어요', () => {
  const reach = new Set();
  const rec = (a) => {
    if (a.length === QUIZ.length) {
      for (const r of [0, 0.34, 0.67, 0.999]) reach.add(quizResult(a, () => r).breed);
      return;
    }
    for (let i = 0; i < 4; i++) rec([...a, i]);
  };
  rec([]);
  assert.deepEqual(normal.filter((k) => !reach.has(k)), []);
});

test('스페셜 모습은 직접 골라서 입양할 수 없어요 (이름으로만 만나요)', async () => {
  const { openDb } = await import('../server/db.js');
  const { Game } = await import('../server/game.js');
  const { Auth } = await import('../server/auth.js');
  const db = openDb(':memory:');
  const game = new Game(db, {});
  const { userId } = new Auth(db, {}).signup('고르기', '1234');
  assert.throws(() => game.createDog(userId, { name: '콩', breed: 'mini_bichon', personality: 'sweet' }), /올바르지/);
  game.createDog(userId, { name: '하늘', breed: 'husky', personality: 'smart' });
  assert.equal(game.loadDog(userId).breed, 'husky');
});
