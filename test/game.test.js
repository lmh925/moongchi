import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { applyDecay, applyAction, computeStage, quizResult, HOUR, DAY } from '../shared/rules.js';
import { checkText, checkNickname } from '../server/filter.js';
import { RULES, QUIZ, BREEDS, PERSONALITIES } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  return { db, game, auth, friends, clock };
}

const baseDog = { personality: 'smart', fullness: 80, cleanliness: 80, affection: 80, fluff: 100, exp: 0, stage: 0, updatedAt: 0, bornAt: 0, school: null };

test('수치는 천천히 줄지만 바닥(20) 아래로는 떨어지지 않아요', () => {
  const d1 = applyDecay(baseDog, 2 * HOUR);
  assert.equal(d1.fullness, 80 - RULES.decayPerHour.fullness * 2);
  assert.equal(d1.fluff, 0);
  const d2 = applyDecay(baseDog, 30 * DAY);
  assert.equal(d2.fullness, RULES.statFloor);
  assert.equal(d2.affection, RULES.statFloor);
});

test('학교에 있는 동안은 수치가 줄지 않아요', () => {
  const d = applyDecay({ ...baseDog, school: { endsAt: 5 * HOUR } }, 3 * HOUR);
  assert.equal(d.fullness, 80);
});

test('배부를 땐 밥을 더 먹지 않고, 좋아하는 돌봄엔 애정도 보너스', () => {
  assert.equal(applyAction({ ...baseDog, fullness: 96 }, 'feed').reaction, 'full');
  const r = applyAction({ ...baseDog, fullness: 50 }, 'feed'); // smart는 feed를 좋아해요
  assert.equal(r.dog.fullness, 80);
  assert.equal(r.reaction, 'love');
  assert.equal(r.dog.affection, 85);
  assert.ok(r.coins > 0 && r.exp > 0);
});

test('성장은 경험치와 함께한 날짜가 모두 필요해요', () => {
  assert.equal(computeStage({ ...baseDog, exp: 1000 }, 1 * DAY), 0);
  assert.equal(computeStage({ ...baseDog, exp: 150 }, 3 * DAY), 1);
  assert.equal(computeStage({ ...baseDog, exp: 500 }, 7 * DAY), 2);
  assert.equal(computeStage({ ...baseDog, exp: 0, stage: 2 }, 0), 2, '다시 작아지지 않아요');
});

test('심리테스트 결과는 항상 올바른 견종/성격이에요', () => {
  for (let i = 0; i < 4; i++) {
    const r = quizResult(QUIZ.map(() => i));
    assert.ok(BREEDS[r.breed] && PERSONALITIES[r.personality]);
  }
  assert.equal(quizResult([0, 0, 0, 0, 0]).personality, 'sleepy');
});

test('채팅 필터: 욕설과 개인정보를 막아요', () => {
  assert.equal(checkText('안녕 반가워!').ok, true);
  assert.equal(checkText('시바견 귀여워').ok, true);
  assert.equal(checkText('씨 발').ok, false);
  assert.equal(checkText('010-1234-5678').ok, false);
  assert.equal(checkText('내 카톡 알려줄게').ok, false);
  assert.equal(checkText('www.naver.com').ok, false);
  assert.equal(checkText('가'.repeat(21)).ok, false);
  assert.equal(checkNickname('하늘').ok, true);
  assert.equal(checkNickname('a').ok, false);
  assert.equal(checkNickname('병신').ok, false);
});

test('가입, 로그인, 비밀번호 잠금', () => {
  const { auth, clock } = setup();
  const { userId } = auth.signup('하늘', '1234');
  assert.throws(() => auth.signup('하늘', '9999'), /이미/);
  assert.equal(auth.login('하늘', '1234').userId, userId);
  for (let i = 0; i < 4; i++) assert.throws(() => auth.login('하늘', '0000'), /달라요/);
  assert.throws(() => auth.login('하늘', '0000'), /잠겼어요/);
  assert.throws(() => auth.login('하늘', '1234'), /잠겼어요/);
  clock.advance(11 * 60_000);
  const { token } = auth.login('하늘', '1234');
  assert.equal(auth.userIdForToken(token), userId);
  auth.logout(token);
  assert.equal(auth.userIdForToken(token), null);
});

test('돌봄, 학교 알림장, 성장까지 한 바퀴', () => {
  const { auth, game, clock } = setup();
  const { userId } = auth.signup('구름', '1111');
  game.createDog(userId, { name: '뭉치', breed: 'corgi', personality: 'smart' });
  const fed = game.act(userId, 'feed');
  assert.ok(fed.dog.fullness > 80);
  const { dog } = game.startSchool(userId, 'manner');
  assert.ok(dog.school);
  assert.throws(() => game.act(userId, 'pet'), /학교/);
  clock.advance(3 * HOUR + 1000);
  const back = game.refreshDog(userId);
  const done = back.events.find((e) => e.type === 'schoolDone');
  assert.ok(done, '하교 이벤트가 있어야 해요');
  assert.equal(done.report.trick !== null, true, '예절 수업은 개인기를 꼭 배워요');
  assert.equal(back.dog.school, null);
  assert.equal(game.listReports(userId).length, 1);
  assert.equal(game.unreadReports(userId), 1);
  // 경험치를 채우고 날짜가 지나면 꼬마로 자라요
  game.db.prepare('UPDATE dogs SET exp = 200 WHERE user_id = ?').run(userId);
  clock.advance(3 * DAY);
  const grown = game.refreshDog(userId);
  assert.equal(grown.dog.stage, 1);
  assert.ok(grown.events.some((e) => e.type === 'grew' && e.trick === 'jump'));
});

test('상점: 코인, 성장 단계 제한, 착용', () => {
  const { auth, game } = setup();
  const { userId } = auth.signup('별이', '2222');
  game.createDog(userId, { name: '콩', breed: 'bichon', personality: 'sweet' });
  assert.throws(() => game.buy(userId, 'crown'), /자라면/);
  game.buy(userId, 'ribbon');
  assert.throws(() => game.buy(userId, 'ribbon'), /이미/);
  assert.throws(() => game.buy(userId, 'strawberry'), /부족/);
  const { dog } = game.equip(userId, 'head', 'ribbon');
  assert.equal(dog.equip.head, 'ribbon');
  assert.throws(() => game.equip(userId, 'head', 'bib'), /놓을 수 없어요/);
  assert.throws(() => game.equip(userId, 'wallpaper', null), /꼭/);
});

test('미니게임 코인은 최대치가 있고 너무 빨리 끝낼 수 없어요', () => {
  const { auth, game, clock } = setup();
  const { userId } = auth.signup('달이', '3333');
  game.createDog(userId, { name: '콩', breed: 'shiba', personality: 'hyper' });
  const { gameId } = game.startMinigame(userId);
  assert.throws(() => game.finishMinigame(userId, gameId, 999), /조금 더/);
  clock.advance(30_000);
  assert.equal(game.finishMinigame(userId, gameId, 999).coins, RULES.minigame.maxCoins);
  assert.throws(() => game.finishMinigame(userId, gameId, 10), /이미/);
});

test('친구: 신청 → 수락, 서로 신청하면 바로 친구', () => {
  const { auth, game, friends } = setup();
  const a = auth.signup('가람', '1234').userId;
  const b = auth.signup('나래', '1234').userId;
  const c = auth.signup('다온', '1234').userId;
  const codeOf = (id) => game.getUser(id).friendCode;
  assert.throws(() => friends.request(a, codeOf(a)), /내 친구 코드/);
  assert.equal(friends.request(a, codeOf(b)).status, 'sent');
  assert.equal(friends.areFriends(a, b), false);
  const req = friends.list(b).incoming[0];
  friends.respond(b, req.id, true);
  assert.equal(friends.areFriends(a, b), true);
  friends.request(a, codeOf(c));
  assert.equal(friends.request(c, codeOf(a)).status, 'friends');
  friends.remove(a, c);
  assert.equal(friends.areFriends(c, a), false);
});

test('조퇴: 다닌 시간만큼만 보상, 절반 전이면 개인기 없음', () => {
  const { auth, game, clock } = setup();
  const { userId } = auth.signup('조퇴', '1111');
  game.createDog(userId, { name: '콩', breed: 'poodle', personality: 'smart' });
  const coins0 = game.getUser(userId).coins;
  game.startSchool(userId, 'manner'); // 3시간, 코인 80
  clock.advance(45 * 60_000); // 1/4
  const res = game.leaveSchool(userId);
  const report = res.events.find((e) => e.type === 'schoolDone').report;
  assert.equal(report.early, true);
  assert.equal(report.coins, 20);
  assert.equal(report.trick, null);
  assert.equal(res.dog.school, null);
  const levelCoins = res.events.filter((e) => e.type === 'levelUp').reduce((n, e) => n + (e.rewards?.coins ?? 0), 0);
  assert.equal(game.getUser(userId).coins, coins0 + 20 + levelCoins);
  assert.throws(() => game.leaveSchool(userId), /학교에 가 있지 않아요/);
});

test('짧은 간식 수업은 10분이에요', () => {
  const { auth, game, clock } = setup();
  const { userId } = auth.signup('간식', '1111');
  game.createDog(userId, { name: '콩', breed: 'bichon', personality: 'foodie' });
  game.startSchool(userId, 'snack');
  clock.advance(10 * 60_000 + 1);
  assert.ok(game.refreshDog(userId).events.some((e) => e.type === 'schoolDone'));
});

test('멍뭉 런: 빨리 끝나도 되고 점수 기준이 달라요', () => {
  const { auth, game, clock } = setup();
  const { userId } = auth.signup('달리기', '1111');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'hyper' });
  assert.throws(() => game.startMinigame(userId, 'nope'), /없어요/);
  const { gameId } = game.startMinigame(userId, 'run');
  clock.advance(6000);
  assert.equal(game.finishMinigame(userId, gameId, 30).coins, 5);
});

test('강아지 친밀도: 단계가 오르고 하루 최대치가 있어요', async () => {
  const { Bonds } = await import('../server/bonds.js');
  const { auth, db, clock } = setup();
  const bonds = new Bonds(db, { now: clock.now });
  const a = auth.signup('가가', '1111').userId;
  const b = auth.signup('나나', '1111').userId;
  assert.equal(bonds.get(a, b).level, 0);
  let up = null;
  for (let i = 0; i < 10; i++) { const r = bonds.add(a, b, 'together'); if (r.after.level > r.before) up = r.after; }
  assert.equal(up?.name, '아는 사이');
  assert.equal(bonds.get(b, a).points, 10, '순서와 상관없이 같은 친밀도');
  assert.ok(bonds.add(a, b, 'pet'));
  assert.equal(bonds.add(a, b, 'pet'), null, '쓰다듬기는 잠깐 쉬었다가');
  for (let i = 0; i < 40; i++) bonds.add(a, b, 'together');
  assert.equal(bonds.get(a, b).points, 30, '하루 최대 30');
  clock.advance(24 * 3600_000);
  bonds.add(a, b, 'together');
  assert.equal(bonds.get(a, b).points, 31);
});

test('캡슐 뽑기: 하루 1번 무료, 그다음은 코인, 중복은 환급', () => {
  const { auth, game, db } = setup();
  const { userId } = auth.signup('뽑기', '1111');
  game.createDog(userId, { name: '콩', breed: 'bichon', personality: 'sweet' });
  const coins0 = game.getUser(userId).coins;
  const r1 = game.gacha(userId);
  assert.equal(r1.free, true);
  assert.equal(game.getUser(userId).coins, coins0);
  assert.ok(game.getUser(userId).owned.includes(r1.itemId));
  const r2 = game.gacha(userId); // rng=0 → 항상 같은 아이템 → 중복
  assert.equal(r2.free, false);
  assert.equal(r2.duplicate, true);
  assert.equal(game.getUser(userId).coins, coins0 - 30 + r2.refund);
  db.prepare('UPDATE users SET coins = 0 WHERE id = ?').run(userId);
  assert.throws(() => game.gacha(userId), /부족/);
  assert.throws(() => game.buy(userId, 'halo'), /뽑기에서만/);
});

test('함께 등교 훈련: 배울 개인기를 3번 성공하면 바로 배워요', () => {
  const { auth, game, clock } = setup();
  const { userId } = auth.signup('훈련', '1111');
  game.createDog(userId, { name: '콩', breed: 'shiba', personality: 'shy' });
  const t1 = game.startTraining(userId);
  assert.equal(t1.target, 'paw');
  assert.throws(() => game.finishTraining(userId, t1.trainingId, { correct: 5, targetHits: 2, target: 'paw' }), /조금 더/);
  clock.advance(20_000);
  const r1 = game.finishTraining(userId, t1.trainingId, { correct: 5, targetHits: 2, target: 'paw' });
  assert.equal(r1.learned, null);
  assert.equal(r1.progress, 2);
  assert.equal(r1.coins, 5);
  const t2 = game.startTraining(userId);
  assert.equal(t2.progress, 2);
  clock.advance(20_000);
  const r2 = game.finishTraining(userId, t2.trainingId, { correct: 99, targetHits: 99, target: 'paw' });
  assert.equal(r2.learned, 'paw');
  assert.equal(r2.coins, 10, '점수는 최대 10개까지만 인정');
  assert.ok(game.loadDog(userId).tricks.includes('paw'));
  game.startSchool(userId, 'walk');
  assert.throws(() => game.startTraining(userId), /학교/);
});
