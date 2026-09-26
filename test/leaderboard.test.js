import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Safety } from '../server/safety.js';
import { Progress } from '../server/progress.js';
import { Leaderboard, weekKey } from '../server/leaderboard.js';
import { LEADERBOARD } from '../shared/data.js';

const DAY = 24 * 3600_000;

function setup() {
  let now = Date.UTC(2026, 8, 23, 3); // 2026-09-23 수요일 정오 (한국)
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  const safety = new Safety(db, { now: clock.now });
  const progress = new Progress(db, { game, friends, rng: () => 0 });
  game.progress = progress;
  const lb = new Leaderboard(db, { game, friends, safety, progress });
  const user = (nick) => {
    const { userId } = auth.signup(nick, '1234');
    game.createDog(userId, { name: `${nick}멍`, breed: 'corgi', personality: 'sweet' });
    return userId;
  };
  const befriend = (a, b) => {
    friends.request(a, game.getUser(b).friendCode);
    friends.respond(b, friends.list(b).incoming[0].id, true);
  };
  return { db, lb, clock, user, befriend, safety, progress };
}

test('이번 주는 한국 시간 월요일부터 시작해요', () => {
  assert.equal(weekKey(Date.UTC(2026, 8, 23, 3)), '2026-09-21');
  assert.equal(weekKey(Date.UTC(2026, 8, 20, 14, 59)), '2026-09-14'); // 일요일 밤 11:59 (한국)
  assert.equal(weekKey(Date.UTC(2026, 8, 20, 15, 0)), '2026-09-21'); // 월요일 0시 (한국)
});

test('최고 기록만 남고, 친구 랭킹과 전체 랭킹이 따로 보여요', () => {
  const { lb, user, befriend, safety } = setup();
  const a = user('가람'); const b = user('나래'); const c = user('다온');
  befriend(a, b);
  assert.equal(lb.submit(a, 'run', 0), null);
  let r = lb.submit(a, 'run', 30);
  assert.deepEqual([r.best, r.newBest, r.rank], [30, true, 1]);
  r = lb.submit(a, 'run', 12);
  assert.deepEqual([r.best, r.newBest], [30, false], '낮은 점수는 기록을 덮지 않아요');
  lb.submit(b, 'run', 40);
  lb.submit(c, 'run', 50);
  const friendsBoard = lb.board(a, 'run', 'friends');
  assert.deepEqual(friendsBoard.entries.map((e) => e.nickname), ['나래', '가람']);
  assert.equal(friendsBoard.entries[1].me, true);
  assert.equal(friendsBoard.entries[0].dog.name, '나래멍');
  assert.deepEqual(friendsBoard.mine, { score: 30, rank: 3 });
  assert.deepEqual(lb.board(a, 'run', 'all').entries.map((e) => e.nickname), ['다온', '나래', '가람']);
  // 차단한 친구는 전체 랭킹에서 안 보여요
  safety.block(a, c);
  assert.deepEqual(lb.board(a, 'run', 'all').entries.map((e) => e.nickname), ['나래', '가람']);
  // 놀이마다 따로
  assert.equal(lb.board(a, 'catch', 'all').entries.length, 0);
  assert.throws(() => lb.board(a, 'nope'));
});

test('다음 주에는 새로 시작하고, 지난주 1~3등은 편지로 선물을 한 번만 받아요', () => {
  const { lb, user, clock, progress } = setup();
  const ids = ['하나', '두리', '세찌', '네찌'].map(user);
  ids.forEach((id, i) => lb.submit(id, 'catch', 100 - i));
  clock.advance(7 * DAY);
  assert.equal(lb.board(ids[0], 'catch', 'all').entries.length, 0, '새 주는 비어 있어요');
  const ev = lb.rewardLastWeek(ids[0]);
  assert.ok(ev.some((e) => e.type === 'mail'));
  const mail = progress.listMail(ids[0]).find((m) => m.from === '멍뭉 운동회');
  assert.equal(mail.coins, LEADERBOARD.rewards[0]);
  assert.equal(lb.rewardLastWeek(ids[0]).length, 0, '두 번 받지 않아요');
  assert.equal(progress.listMail(ids[2]).length, 0);
  lb.rewardLastWeek(ids[2]);
  assert.equal(progress.listMail(ids[2]).find((m) => m.from === '멍뭉 운동회').coins, LEADERBOARD.rewards[2]);
  assert.equal(lb.rewardLastWeek(ids[3]).length, 0, '4등은 선물이 없어요');
});

test('합동 줄넘기 콤보는 논 시간만큼만 인정해요', () => {
  const { lb, user, clock } = setup();
  const a = user('줄넘기');
  const { ropeId } = lb.ropeStart(a);
  clock.advance(9000); // 9초 → 최대 10콤보
  assert.equal(lb.ropeFinish(a, ropeId, 999).best, 10);
  assert.throws(() => lb.ropeFinish(a, ropeId, 5), /이미 끝난/);
  const two = lb.ropeStart(a);
  clock.advance(60_000);
  const r = lb.ropeFinish(a, two.ropeId, 25);
  assert.deepEqual([r.best, r.newBest, r.game], [25, true, 'rope']);
});
