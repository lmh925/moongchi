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
