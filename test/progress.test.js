import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { QUESTS, STAMP, BADGE_COINS, LETTER, SHOWCASE_MAX } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  const progress = new Progress(db, { game, friends, rng: () => 0 });
  game.progress = progress;
  return { db, game, auth, friends, progress, clock };
}

function newDog(game, auth, nick) {
  const { userId } = auth.signup(nick, '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
  return userId;
}

// 오늘 뽑힌 약속을 모두 지키기
function finishToday(progress, userId) {
  const events = [];
  for (const q of progress.view(userId).quest.list) events.push(...progress.track(userId, q.id, QUESTS[q.id].n));
  return events;
}

test('오늘의 약속: 하루 3개(돌봄·놀이·바깥), 새로고침해도 그대로, 다 지키면 도장', () => {
  const { game, auth, progress } = setup();
  const userId = newDog(game, auth, '약속이');
  const q1 = progress.view(userId).quest;
  assert.equal(q1.list.length, 3);
  assert.deepEqual(q1.list.map((q) => QUESTS[q.id].group), ['care', 'play', 'out']);
  assert.ok(!q1.list.some((q) => QUESTS[q.id].needFriend), '친구가 없으면 친구 약속은 안 나와요');
  assert.deepEqual(progress.view(userId).quest.list.map((q) => q.id), q1.list.map((q) => q.id));
  const coins0 = game.getUser(userId).coins;
  const events = finishToday(progress, userId);
  assert.equal(events.filter((e) => e.type === 'questDone').length, 3);
  const stamp = events.find((e) => e.type === 'stamp');
  assert.equal(stamp.stamps, 1);
  assert.ok(game.getUser(userId).coins >= coins0 + STAMP.questCoins * 3);
  // 같은 날 다시 해도 도장은 한 번만
  assert.equal(finishToday(progress, userId).filter((e) => e.type === 'stamp').length, 0);
});

test('도장판: 하루 빠져도 모은 도장은 그대로, 7칸이면 특별 캡슐 편지', () => {
  const { game, auth, progress, clock } = setup();
  const userId = newDog(game, auth, '도장이');
  for (let d = 0; d < STAMP.card; d++) {
    finishToday(progress, userId);
    clock.advance((d === 2 ? 3 : 1) * 24 * 3600_000); // 중간에 이틀 쉬어도 괜찮아요
  }
  const view = progress.view(userId);
  assert.equal(view.quest.stamps, 0, '다 채우면 새 도장판');
  assert.ok(view.badges.includes('promise'));
  const capsule = progress.listMail(userId).find((m) => m.kind === 'capsule');
  assert.ok(capsule);
  const opened = progress.openMail(userId, capsule.id);
  assert.ok(['rare', 'epic'].includes(opened.capsule.rarity), '특별 캡슐은 희귀 이상');
  assert.equal(opened.capsule.special, true);
  // 두 번 열어도 한 번만
  assert.equal(progress.openMail(userId, capsule.id).capsule, undefined);
});

test('배지: 조건을 채우면 코인과 함께 얻고, 대표 배지는 3개까지', () => {
  const { game, auth, progress } = setup();
  const userId = newDog(game, auth, '배지요');
  const coins0 = game.getUser(userId).coins;
  const ev = progress.track(userId, 'run', 10);
  assert.ok(ev.some((e) => e.type === 'badge' && e.id === 'runner'));
  assert.ok(game.getUser(userId).coins >= coins0 + BADGE_COINS);
  progress.track(userId, 'catch', 10);
  progress.track(userId, 'train', 20);
  progress.track(userId, 'school', 10);
  const v = progress.view(userId);
  assert.equal(v.showcase.length, SHOWCASE_MAX, '처음 3개는 자동으로 달아요');
  assert.deepEqual(progress.setShowcase(userId, ['scholar', 'legend', 'runner', 'catcher', 'trainer']), ['scholar', 'runner', 'catcher']);
  // 협동 마스터: 5종 모두
  for (const g of ['ribbon', 'jumprope', 'cushion', 'bakery']) progress.track(userId, 'coop', 1, { game: g });
  assert.ok(!progress.view(userId).badges.includes('coopAll'));
  assert.ok(progress.track(userId, 'coop', 1, { game: 'tidy' }).some((e) => e.id === 'coopAll'));
  // 친구는 대표 배지를 볼 수 있어요 (놀이터에는 안 보여요)
  const dog = game.loadDog(userId);
  assert.deepEqual(game.publicDog(dog).showcase, ['scholar', 'runner', 'catcher']);
  assert.equal(game.plazaDog(dog).showcase, undefined);
});

test('견종 도감: 만난 견종이 쌓이고, 모두 만나면 배지', () => {
  const { game, auth, progress } = setup();
  const userId = newDog(game, auth, '도감이');
  const ev = progress.seeBreeds(userId, ['bichon', 'bichon', 'nope']);
  assert.deepEqual(ev.filter((e) => e.type === 'dex').map((e) => e.breed), ['bichon']);
  assert.deepEqual(progress.seeBreeds(userId, ['bichon']), []);
  assert.deepEqual(progress.view(userId).seenBreeds.sort(), ['bichon', 'corgi']);
});

test('편지: 처음엔 환영 편지, 오랜만에 오면 강아지 편지(선물), 너무 자주는 안 와요', () => {
  const { game, auth, progress, clock } = setup();
  const userId = newDog(game, auth, '편지요');
  const dog = () => game.loadDog(userId);
  assert.equal(progress.onMe(userId, dog()).length, 1, '환영 편지');
  assert.equal(progress.onMe(userId, dog()).length, 0);
  clock.advance(LETTER.awayMs - 1000);
  assert.equal(progress.onMe(userId, dog()).length, 0, '아직 이르면 편지 없음');
  clock.advance(LETTER.awayMs + 1000);
  assert.equal(progress.onMe(userId, dog()).length, 1);
  const mail = progress.listMail(userId);
  assert.equal(mail.length, 2);
  assert.match(mail[0].body, /편지요/);
  const coins0 = game.getUser(userId).coins;
  const res = progress.openMail(userId, mail[0].id);
  assert.ok(res.first);
  assert.ok(game.getUser(userId).coins >= coins0 + (mail[0].coins ?? 0));
  assert.equal(progress.unreadMail(userId), 1);
});

test('게임 속 활동이 약속과 배지로 이어져요 (돌봄 → feed 기록)', () => {
  const { game, auth, progress, db } = setup();
  const userId = newDog(game, auth, '돌봄이');
  db.prepare('UPDATE dogs SET fullness = 10 WHERE user_id = ?').run(userId);
  game.act(userId, 'feed');
  const stats = JSON.parse(db.prepare('SELECT stats FROM users WHERE id = ?').get(userId).stats);
  assert.equal(stats.feed, 1);
  assert.ok(progress.view(userId).badgeProgress.carer.have >= 1);
});

test('학교 시간 아이템: 버스표는 남은 시간 절반, 모래시계는 바로 하교(선물 다 받음), 하루 3번까지', () => {
  const { game, auth, progress, clock } = setup();
  const userId = newDog(game, auth, '버스요');
  progress.onMe(userId, game.loadDog(userId)); // 환영 편지에 모래시계
  const welcome = progress.listMail(userId)[0];
  assert.equal(welcome.boost, 'hourglass');
  progress.openMail(userId, welcome.id);
  assert.equal(game.getUser(userId).boosts.hourglass, 1);
  assert.throws(() => game.buyBoost(userId, 'hourglass'), /선물로만/);
  game.addCoins(userId, 100);
  game.buyBoost(userId, 'bus');
  game.buyBoost(userId, 'bus');
  assert.equal(game.getUser(userId).boosts.bus, 2);
  assert.throws(() => game.useBoost(userId, 'bus'), /학교에 가 있을 때/);

  game.startSchool(userId, 'manner');
  const before = game.loadDog(userId).school;
  const left0 = before.endsAt - clock.now();
  game.useBoost(userId, 'bus');
  const after = game.loadDog(userId).school;
  assert.ok(Math.abs((after.endsAt - clock.now()) - left0 / 2) <= 1, '남은 시간 절반');
  assert.equal(after.endsAt - after.startedAt, before.endsAt - before.startedAt, '수업 길이는 그대로');

  const coins0 = game.getUser(userId).coins;
  const res = game.useBoost(userId, 'hourglass');
  const done = res.events.find((e) => e.type === 'schoolDone');
  assert.ok(done, '바로 하교');
  assert.equal(done.report.early, false);
  assert.ok(game.getUser(userId).coins >= coins0 + done.report.coins, '수업 선물을 다 받아요 (레벨업 코인은 덤)');
  assert.equal(game.loadDog(userId).school, null);

  game.startSchool(userId, 'manner');
  game.useBoost(userId, 'bus'); // 오늘 3번째
  game.buyBoost(userId, 'bus');
  assert.throws(() => game.useBoost(userId, 'bus'), /다 썼어요/);
});
