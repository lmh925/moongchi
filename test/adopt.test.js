import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { HOUR } from '../shared/rules.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  return { db, game, auth, clock };
}

test('둘째 입양: Lv 10부터, 새 친구가 대표가 되고, 대표를 바꿀 수 있어요', () => {
  const { game, auth, db } = setup();
  const { userId } = auth.signup('입양이', '1234');
  const first = game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
  assert.throws(() => game.createDog(userId, { name: '둘째', breed: 'bichon', personality: 'shy' }), /Lv 10/);
  assert.deepEqual({ used: 1, max: 1, nextLevel: 10 }, (({ used, max, nextLevel }) => ({ used, max, nextLevel }))(game.dogSlots(userId)));
  db.prepare('UPDATE dogs SET exp = 1000 WHERE id = ?').run(first.id); // Lv 10 넘게
  const second = game.createDog(userId, { name: '뭉치', breed: 'bichon', personality: 'shy' });
  assert.equal(second.special, 'mungchi', '둘째도 스페셜 이름이면 변신');
  assert.equal(game.loadDog(userId).id, second.id, '새 친구가 대표');
  assert.equal(game.dogList(userId).length, 2);
  assert.throws(() => game.createDog(userId, { name: '셋째', breed: 'poodle', personality: 'shy' }), /Lv 25/);
  game.switchDog(userId, first.id);
  assert.equal(game.loadDog(userId).id, first.id);
  assert.throws(() => game.switchDog(userId, first.id), /이미 대표/);
  const { userId: other } = auth.signup('남의집', '1234');
  const theirs = game.createDog(other, { name: '초코', breed: 'shiba', personality: 'shy' });
  assert.throws(() => game.switchDog(userId, theirs.id), /우리 집 강아지가 아니에요/);
});

test('대표가 아닌 강아지: 학교에서 돌아오고, 쉬는 동안은 천천히 배고파져요', () => {
  const { game, auth, db, clock } = setup();
  const { userId } = auth.signup('둘키우기', '1234');
  const first = game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'smart' });
  db.prepare('UPDATE dogs SET exp = 1000 WHERE id = ?').run(first.id);
  game.startSchool(userId, 'snack'); // 첫째는 학교로
  const second = game.createDog(userId, { name: '보리', breed: 'bichon', personality: 'smart' });
  assert.equal(game.loadDog(userId).id, second.id);
  clock.advance(HOUR);
  const events = game.refreshOthers(userId);
  assert.ok(events.some((e) => e.type === 'schoolDone' && e.report.dogName === '콩'), '첫째 하교 알림장');
  assert.equal(game.loadDogById(first.id).school, null);
  // 둘째를 10시간 쉬게 하고 대표로 바꾸면, 절반 속도로만 줄어요
  db.prepare('UPDATE dogs SET fullness = 80 WHERE id = ?').run(second.id);
  game.switchDog(userId, first.id);
  const before = game.loadDogById(second.id);
  clock.advance(10 * HOUR);
  game.switchDog(userId, second.id);
  const rested = game.loadDog(userId);
  const fullDrop = 5 * 10; // 보통은 시간당 5
  assert.ok(before.fullness - rested.fullness <= fullDrop / 2 + 1);
  assert.ok(before.fullness - rested.fullness > 0);
});
