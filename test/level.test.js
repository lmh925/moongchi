import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, migrateLevels } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import {
  levelInfo, levelFromExp, levelRewards, talentStage, talentEffects, unlockedTitles, unlockedEmotes, expToNext,
} from '../shared/rules.js';
import { TALENT_DAILY_CAP, TALENT_STEPS, TRAINING, TREASURE } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  return { db, game, auth, clock };
}

function newDog(game, auth, nick, personality = 'hyper') {
  const { userId } = auth.signup(nick, '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality });
  return userId;
}

test('레벨 곡선: Lv5 ≈ 경험치 150, Lv12 ≈ 500, 끝없이 올라가요', () => {
  assert.equal(levelFromExp(0), 1);
  assert.equal(levelFromExp(150), 5);
  assert.equal(levelFromExp(500), 12);
  const deep = levelInfo(20000);
  assert.ok(deep.level > 50);
  for (let l = 1; l < 60; l++) assert.ok(expToNext(l + 1) >= expToNext(l), '필요 경험치는 줄지 않아요');
  assert.deepEqual(levelRewards(3).tickets, 1);
  assert.deepEqual(levelRewards(5).emotes, ['roll']);
  assert.deepEqual(levelRewards(10).titles, ['walker']);
  assert.deepEqual(unlockedEmotes(1), ['bark', 'jump', 'wave', 'spin']);
});

test('레벨업하면 코인·뽑기권을 받고, 뽑기권으로 캡슐을 뽑아요', () => {
  const { game, auth, db } = setup();
  const userId = newDog(game, auth, '레벨이');
  const coins0 = game.getUser(userId).coins;
  const events = game.grant(userId, { exp: 33 + 35 }); // Lv1 → Lv3
  const ups = events.filter((e) => e.type === 'levelUp');
  assert.deepEqual(ups.map((e) => e.level), [2, 3]);
  const user = game.getUser(userId);
  assert.equal(user.coins, coins0 + (10 + 2) + (10 + 3));
  assert.equal(user.gachaTickets, 1);
  // 같은 레벨로 다시 보상받지 않아요
  assert.equal(game.grant(userId, { exp: 1 }).filter((e) => e.type === 'levelUp').length, 0);
  // 오늘 무료 뽑기 → 그다음은 뽑기권 → 그다음은 코인
  const free = game.gacha(userId);
  assert.equal(free.free, true);
  const t = game.gacha(userId);
  assert.equal(t.ticket, true);
  assert.equal(game.getUser(userId).gachaTickets, 0);
  const before = game.getUser(userId).coins;
  const paid = game.gacha(userId);
  assert.equal(paid.free || paid.ticket, false);
  assert.ok(game.getUser(userId).coins < before + 1 + paid.refund);
  assert.equal(db.prepare('SELECT level FROM dogs WHERE user_id = ?').get(userId).level, 3);
});

test('재능: 하루 한도, 성격 보너스, 단계가 오르면 알려 줘요', () => {
  const { game, auth, clock } = setup();
  const userId = newDog(game, auth, '튼튼이', 'hyper'); // 천방지축 → 튼튼 +20%
  const ev = game.grant(userId, { talents: { strong: 10, smart: 10 } });
  const dog = game.loadDog(userId);
  assert.equal(dog.talents.strong, 12);
  assert.equal(dog.talents.smart, 10);
  assert.ok(ev.some((e) => e.type === 'talentUp' && e.talent === 'strong' && e.stage === 2));
  game.grant(userId, { talents: { strong: 100 } });
  assert.equal(game.loadDog(userId).talents.strong, TALENT_DAILY_CAP, '하루 한도');
  clock.advance(24 * 3600_000);
  game.grant(userId, { talents: { strong: 5 } });
  assert.equal(game.loadDog(userId).talents.strong, TALENT_DAILY_CAP + 6, '다음 날엔 다시 자라요');
});

test('재능 효과: 똑똑 5단계면 개인기를 2번 만에, 호기심은 힌트 범위, 튼튼은 멍뭉런 체력', () => {
  assert.equal(talentStage(0), 1);
  assert.equal(talentStage(TALENT_STEPS[4]), 5);
  assert.equal(talentStage(99999), 10);
  const base = talentEffects({});
  assert.equal(base.learnHits, TRAINING.learnHits);
  assert.equal(base.runnerHp, 0);
  assert.equal(base.warmRadius, TREASURE.warmRadius);
  const pro = talentEffects({ smart: TALENT_STEPS[4], strong: TALENT_STEPS[9], curious: TALENT_STEPS[4], kind: TALENT_STEPS[4] });
  assert.equal(pro.learnHits, TRAINING.learnHits - 1);
  assert.equal(pro.runnerHp, 50);
  assert.ok(pro.warmRadius > TREASURE.warmRadius);
  assert.equal(pro.bondBonus, 1);
});

test('훈련: 똑똑 재능이 높으면 필요한 성공 횟수가 줄어요', () => {
  const { game, auth, db, clock } = setup();
  const userId = newDog(game, auth, '똑똑이', 'smart');
  db.prepare('UPDATE dogs SET talents = ? WHERE user_id = ?').run(JSON.stringify({ smart: TALENT_STEPS[4] }), userId);
  const start = game.startTraining(userId);
  assert.equal(start.need, TRAINING.learnHits - 1);
  clock.advance(TRAINING.minSeconds * 1000);
  const res = game.finishTraining(userId, start.trainingId, { correct: 5, targetHits: 2, target: start.target });
  assert.equal(res.learned, start.target);
});

test('칭호: 얻은 것만 달 수 있고, 놀이터에는 레벨 숫자가 보이지 않아요', () => {
  const { game, auth } = setup();
  const userId = newDog(game, auth, '칭호요');
  assert.throws(() => game.setTitle(userId, 'legend'), /아직/);
  assert.equal(game.setTitle(userId, 'sprout').title, 'sprout');
  game.grant(userId, { exp: 600 });
  const lv = levelFromExp(game.loadDog(userId).exp);
  assert.ok(unlockedTitles(lv, {}).includes('walker') === (lv >= 10));
  game.setTitle(userId, 'brave');
  const dog = game.loadDog(userId);
  const pub = game.publicDog(dog);
  assert.equal(pub.level, lv);
  assert.equal(pub.titleName, '씩씩한 꼬마');
  const plaza = game.plazaDog(dog);
  assert.equal(plaza.level, undefined);
  assert.equal(plaza.talents, undefined);
  assert.equal(plaza.titleName, '씩씩한 꼬마');
});

test('레벨이 생기기 전 강아지는 지금 경험치로 레벨을 매기고 재능을 조금 채워 줘요', () => {
  const { game, auth, db } = setup();
  const userId = newDog(game, auth, '옛날이', 'foodie');
  db.prepare("UPDATE dogs SET exp = 500, level = 0, talents = '{}' WHERE user_id = ?").run(userId);
  migrateLevels(db); // openDb가 하는 옮기기를 같은 DB에 다시 돌려요
  const dog = game.loadDog(userId);
  assert.equal(dog.level, 12);
  assert.ok(dog.talents.curious > dog.talents.strong, '성격에 맞는 재능이 더 자라 있어요');
  // 옮긴 뒤에는 보상을 다시 주지 않아요
  assert.equal(game.grant(userId, { exp: 1 }).filter((e) => e.type === 'levelUp').length, 0);
});
