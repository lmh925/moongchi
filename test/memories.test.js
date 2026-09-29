import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { Asks } from '../server/asks.js';
import { Memories } from '../server/memories.js';
import { BIRTHDAY } from '../shared/data.js';
import { zodiacOf, daysUntilBirthday } from '../shared/rules.js';

function setup(start) {
  let now = start;
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now, rng: () => 0.5 });
  const auth = new Auth(db, { now: () => now });
  const friends = new Friends(db, game);
  const progress = new Progress(db, { game, friends });
  game.progress = progress;
  const asks = new Asks(db, { game, friends });
  game.asks = asks;
  const notes = [];
  const memories = new Memories(db, { game, friends, progress, asks, notify: (id, ev, data) => notes.push({ id, ev, data }) });
  game.memories = memories;
  const mk = (nick, dogName) => {
    const { userId } = auth.signup(nick, '1234');
    game.createDog(userId, { name: dogName, breed: 'corgi', personality: 'sweet' });
    db.prepare('UPDATE dogs SET born_at = born_at - ? WHERE user_id = ?').run(30 * 86_400_000, userId); // 한 달 전에 만났어요
    return userId;
  };
  return { db, game, friends, progress, memories, notes, mk, tick: (ms) => { now += ms; }, now: () => now };
}

test('별자리와 생일까지 남은 날', () => {
  assert.equal(zodiacOf('09-29').name, '천칭자리');
  assert.equal(zodiacOf('01-10').name, '염소자리');
  assert.equal(zodiacOf('13-01'), null);
  assert.equal(daysUntilBirthday('09-30', Date.UTC(2026, 8, 28, 20)), 1); // KST 9/29
});

test('생일 당일에 한 번만 축하하고, 친구들에게 알리고, 친구가 축하해 줄 수 있어요', () => {
  const s = setup(Date.UTC(2026, 8, 29, 3)); // KST 9/29 정오
  const a = s.mk('생일주인', '콩');
  const b = s.mk('친구', '보리');
  s.friends.makeFriends(a, b);
  const dogA = s.game.loadDog(a);
  const coins0 = s.game.getUser(a).coins;
  const r = s.memories.setBirthday(a, dogA.id, '09-29');
  assert.equal(r.birthday.zodiac.name, '천칭자리');
  assert.equal(r.events.length, 1);
  const ev = r.events[0];
  assert.equal(ev.type, 'birthday'); assert.equal(ev.count, 1); assert.equal(ev.item, BIRTHDAY.item);
  assert.equal(s.game.getUser(a).coins, coins0 + BIRTHDAY.coins);
  assert.ok(s.game.getUser(a).owned.includes(BIRTHDAY.item));
  assert.equal(s.memories.checkBirthdays(a).length, 0, '같은 해에는 한 번만');
  // 친구에게 초대장 우편 + 실시간 알림
  assert.ok(s.progress.listMail(b).some((m) => m.kind === 'bdayNotice'));
  assert.ok(s.notes.some((n) => n.id === b && n.ev === 'friend:birthday'));
  // 친구가 축하해요 (한 번만)
  const coinsB = s.game.getUser(b).coins;
  const c = s.memories.cheer(b, a);
  assert.deepEqual(c.names, ['콩']);
  assert.equal(s.game.getUser(b).coins, coinsB + BIRTHDAY.cheerCoins);
  assert.throws(() => s.memories.cheer(b, a), /벌써/);
  assert.ok(s.progress.listMail(a).some((m) => m.kind === 'bdayCheer' && m.hearts === 1));
  // 생일 바꾸기는 한동안 못 해요
  assert.throws(() => s.memories.setBirthday(a, dogA.id, '10-01'), /다시 바꿀/);
  // 다음 해에 또 축하
  s.tick(365 * 86_400_000);
  const next = s.memories.checkBirthdays(a);
  assert.equal(next.length, 1); assert.equal(next[0].count, 2); assert.equal(next[0].item, null, '모자는 이미 있어요');
});

test('생일이 아닌 날에는 축하할 수 없고, 친구가 아니면 안 돼요', () => {
  const s = setup(Date.UTC(2026, 8, 29, 3));
  const a = s.mk('주인', '콩'); const b = s.mk('모르는애', '보리');
  s.memories.setBirthday(a, s.game.loadDog(a).id, '12-25');
  assert.throws(() => s.memories.cheer(b, a), /친구/);
  s.friends.makeFriends(a, b);
  assert.throws(() => s.memories.cheer(b, a), /생일이 아니/);
});

test('멍뭉달력: 처음 한 날은 한 번만 적히고, 메모와 한마디를 남길 수 있어요', () => {
  const s = setup(Date.UTC(2026, 8, 29, 3));
  const a = s.mk('달력', '콩');
  s.game.track(a, 'run'); s.game.track(a, 'run');
  const m = s.memories.month(a, '2026-09');
  assert.equal(m.entries.filter((e) => e.kind === 'first' && e.title.includes('멍뭉런')).length, 1);
  assert.ok(s.memories.month(a, '2026-08').entries.some((e) => e.kind === 'adopt'), '처음 만난 날(한 달 전)이 채워져요');
  const run = m.entries.find((e) => e.title.includes('멍뭉런'));
  s.memories.comment(a, run.id, '엄청 빨랐어!');
  s.memories.addNote(a, '2026-09-29', '🌈', '오늘 무지개 봤다');
  assert.throws(() => s.memories.addNote(a, '2026-12-01', '📝', '미래'), /오늘까지/);
  const m2 = s.memories.month(a, '2026-09');
  assert.equal(m2.entries.find((e) => e.id === run.id).comment, '엄청 빨랐어!');
  const note = m2.entries.find((e) => e.note);
  assert.equal(note.title, '오늘 무지개 봤다');
  s.memories.deleteNote(a, note.id);
  assert.ok(!s.memories.month(a, '2026-09').entries.some((e) => e.note));
});

test('오늘 막 데려온 강아지는 생일이 오늘이어도 첫 생일 파티는 내년에 해요', () => {
  const s = setup(Date.UTC(2026, 8, 29, 3));
  const { userId } = new Auth(s.db, { now: s.now }).signup('새내기', '1234');
  s.game.createDog(userId, { name: '막둥', breed: 'pug', personality: 'shy' });
  const r = s.memories.setBirthday(userId, s.game.loadDog(userId).id, 'adopt');
  assert.equal(r.birthday.date, '09-29');
  assert.equal(r.events.length, 0);
});

test('친구가 된 날은 달력에 한 번만 적혀요', () => {
  const s = setup(Date.UTC(2026, 8, 29, 3));
  const a = s.mk('하나', '콩'); const b = s.mk('두울', '보리');
  s.friends.makeFriends(a, b);
  s.memories.month(a, '2026-09'); s.memories.month(a, '2026-09');
  assert.equal(s.memories.month(a, '2026-09').entries.filter((e) => e.kind === 'friend').length, 1);
});
