import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { runnerLevel, runnerMaps } from '../shared/rules.js';
import { RUNNER } from '../shared/data.js';

test('멍뭉런 레벨 곡선과 맵 열리는 조건', () => {
  assert.equal(runnerLevel(0).level, 1);
  assert.equal(runnerLevel(149).level, 1);
  assert.equal(runnerLevel(150).level, 2);
  assert.ok(runnerLevel(100000).level > 20, '끝없이 올라가요');
  assert.deepEqual(runnerMaps({}), ['meadow']);
  assert.deepEqual(runnerMaps({ xp: 400 }), ['meadow', 'beach'], '많이 하면 (런 Lv3)');
  assert.deepEqual(runnerMaps({ best: 200 }), ['meadow', 'beach', 'snow'], '잘하면 (최고 기록)');
});

test('멍뭉런을 하면 런 경험치가 쌓이고, 새 맵이 열리면 알려 줘요', () => {
  let now = Date.UTC(2026, 8, 27, 3);
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now, rng: () => 0 });
  const auth = new Auth(db, { now: () => now });
  const { userId } = auth.signup('달리기', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'hyper' });
  const play = (score) => {
    const { gameId } = game.startMinigame(userId, 'run');
    now += 30_000;
    return game.finishMinigame(userId, gameId, score).events;
  };
  let ev = play(50);
  assert.equal(game.getUser(userId).runner.xp, RUNNER.xpPerRun + 50);
  assert.ok(!ev.some((e) => e.type === 'runMap'));
  ev = play(120); // 최고 기록 120 → 바닷가
  assert.ok(ev.some((e) => e.type === 'runLevel' && e.level === 2));
  assert.deepEqual(ev.filter((e) => e.type === 'runMap').map((e) => e.map), ['beach']);
  const r = game.getUser(userId).runner;
  assert.deepEqual([r.best, r.plays], [120, 2]);
});

test('멍뭉런 출발 아이템은 코인으로 사고, 달린 거리만큼 보물 상자를 받아요', async () => {
  const { RUN_BOOSTERS, RUN_CHESTS } = await import('../shared/data.js');
  let now = Date.UTC(2026, 8, 27, 3);
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now, rng: () => 0.1 });
  const auth = new Auth(db, { now: () => now });
  const { userId } = auth.signup('부스터', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'hyper' });
  const coins0 = game.getUser(userId).coins;
  const s = game.startMinigame(userId, 'run', { boosters: ['hp', 'magnet', 'hp', 'nope'] });
  assert.deepEqual(s.boosters, ['hp', 'magnet']);
  assert.equal(game.getUser(userId).coins, coins0 - RUN_BOOSTERS.hp.price - RUN_BOOSTERS.magnet.price);
  db.prepare('UPDATE users SET coins = 0 WHERE id = ?').run(userId);
  assert.throws(() => game.startMinigame(userId, 'run', { boosters: ['dash'] }), /부족/);
  // 60초 동안 1300m → 상자 2개 (거리는 1초에 26m까지만 인정)
  now += 60_000;
  const r = game.finishMinigame(userId, s.gameId, 40, { dist: 1300 });
  assert.equal(r.dist, 1300);
  assert.equal(r.chests.length, Math.floor(1300 / RUN_CHESTS.everyM));
  assert.equal(game.getUser(userId).runner.bestDist, 1300);
  const s2 = game.startMinigame(userId, 'run');
  now += 10_000;
  const r2 = game.finishMinigame(userId, s2.gameId, 10, { dist: 99999 });
  assert.equal(r2.dist, 260, '너무 먼 거리는 인정하지 않아요');
  assert.equal(r2.chests.length, 0);
});
