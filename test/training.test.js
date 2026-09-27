import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { TRAIN_COURSES, TRAIN_LEVEL, TRAINING } from '../shared/data.js';
import { trainLevel, examFor, recommendedCourse, unlockedTitles } from '../shared/rules.js';

function setup() {
  let now = Date.UTC(2026, 8, 27, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  game.progress = new Progress(db, { game, friends, rng: () => 0 });
  const { userId } = auth.signup('훈련왕', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'hyper' });
  const lesson = (course, correct, { exam = false, quit = false, wait = 30_000 } = {}) => {
    const s = game.startTraining(userId, { course, exam });
    clock.advance(wait);
    return game.finishTraining(userId, s.trainingId, { correct, quit });
  };
  return { db, game, clock, userId, lesson };
}

test('과목 레벨·추천 과목·시험 조건', () => {
  assert.deepEqual([trainLevel(0).level, trainLevel(3).level, trainLevel(25).level, trainLevel(99).max], [1, 2, 5, true]);
  assert.ok(TRAIN_COURSES[recommendedCourse('2026-09-27')]);
  assert.equal(examFor({ xp: { nose: 8 } }, 'nose'), 'basic');
  assert.equal(examFor({ xp: { nose: 8 }, certs: { nose: 'basic' } }, 'nose'), null);
  assert.equal(examFor({ xp: { nose: 25 }, certs: { nose: 'basic' } }, 'nose'), 'master');
  assert.ok(unlockedTitles(1, {}, null, 0, { nose: 'master' }).includes('tr_nose'));
  assert.ok(!unlockedTitles(1, {}, null, 0, { nose: 'basic' }).includes('tr_nose'));
});

test('과목마다 그 재능이 자라고, 만점이면 과목 경험 +1과 보너스 코인', () => {
  const { game, userId, lesson } = setup();
  const r = lesson('nose', TRAIN_COURSES.nose.rounds);
  assert.equal(r.perfect, true);
  assert.equal(r.talent, 'curious');
  assert.ok(r.talentGain > 0);
  assert.equal(game.loadDog(userId).train.xp.nose, 2);
  assert.ok(r.coins >= 10 + TRAIN_LEVEL.perfectCoins);
  assert.throws(() => game.startTraining(userId, { course: 'nope' }), /그런 수업/);
  assert.throws(() => game.startTraining(userId, { course: 'nose', exam: true }), /시험/);
});

test('그만두기: 한 문제도 못 풀었으면 횟수를 돌려주고, 풀었으면 푼 만큼 보상', () => {
  const { game, userId, lesson } = setup();
  const a = lesson('agility', 0, { quit: true, wait: 5000 });
  assert.equal(a.refunded, true);
  assert.equal(game.trainingsToday(userId), 0);
  const b = lesson('agility', 4, { quit: true });
  assert.equal(b.quit, true);
  assert.equal(b.ok, 4);
  assert.ok(b.coins > 0);
  assert.equal(game.trainingsToday(userId), 1);
  // 너무 빠른 점수는 인정하지 않아요 (한 문제 0.8초)
  const c = lesson('walk', 12, { wait: 2400 });
  assert.equal(c.ok, 3);
});

test('자격증: Lv 3 초급 → Lv 5 마스터 (전용 소품·칭호·배지), 시험 떨어져도 다시 볼 수 있어요', () => {
  const { game, userId, lesson, clock } = setup();
  const n = TRAIN_COURSES.walk.rounds;
  for (let i = 0; i < 4; i++) lesson('walk', n); // 만점 4번 = 8 → Lv 3
  let ev = [];
  const fail = lesson('walk', 3, { exam: true });
  assert.deepEqual([fail.exam.kind, fail.exam.passed], ['basic', false]);
  const pass = lesson('walk', n, { exam: true });
  assert.equal(pass.exam.passed, true);
  assert.ok(pass.events.some((e) => e.type === 'cert' && e.kind === 'basic'));
  assert.ok(pass.events.some((e) => e.type === 'badge'), '자격증 새내기 배지');
  assert.equal(game.loadDog(userId).train.certs.walk, 'basic');
  clock.advance(24 * 3600_000); // 다음 날 (하루 횟수)
  while (game.loadDog(userId).train.xp.walk < 25) ev = lesson('walk', n);
  const master = lesson('walk', n, { exam: true });
  const cert = master.events.find((e) => e.type === 'cert');
  assert.deepEqual([cert.kind, cert.item], ['master', 'tr_star_shades']);
  assert.ok(game.getUser(userId).owned.includes('tr_star_shades'));
  assert.ok(game.dogView(game.loadDog(userId)).titles.includes('tr_walk'));
  assert.ok(ev);
  assert.ok(TRAINING.dailyLimit >= 10);
});
