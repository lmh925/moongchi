import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Bonds } from '../server/bonds.js';
import { Safety } from '../server/safety.js';
import { Progress } from '../server/progress.js';
import { Babies } from '../server/babies.js';
import { breedOf } from '../shared/rules.js';
import { BABY } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0.3 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  const bonds = new Bonds(db, { now: clock.now });
  const safety = new Safety(db, { now: clock.now });
  const progress = new Progress(db, { game, friends, rng: () => 0 });
  game.progress = progress;
  const babies = new Babies(db, { game, friends, safety, bonds, progress, rng: () => 0.3 });
  const user = (nick, breed, personality) => {
    const { userId } = auth.signup(nick, '1234');
    const dog = game.createDog(userId, { name: `${nick}멍`, breed, personality });
    return { userId, dog };
  };
  const grownUp = (u) => db.prepare('UPDATE dogs SET exp = 600, stage = 2, level = 13 WHERE id = ?').run(u.dog.id);
  const befriend = (a, b) => {
    friends.request(a.userId, game.getUser(b.userId).friendCode);
    friends.respond(b.userId, friends.list(b.userId).incoming[0].id, true);
  };
  const soulmates = (a, b) => {
    const [x, y] = a.userId < b.userId ? [a.userId, b.userId] : [b.userId, a.userId];
    db.prepare('INSERT INTO bonds (a, b, points, day, day_points) VALUES (?, ?, 120, ?, 0)').run(x, y, 'x');
  };
  return { db, game, babies, clock, user, grownUp, befriend, soulmates, progress };
}

test('아기 강아지 선물: 조건 확인 → 소원 → 수락 → 이틀 뒤 두 집에 선물 상자 → 이름 지어 주면 믹스 아기', () => {
  const { db, game, babies, clock, user, grownUp, befriend, soulmates, progress } = setup();
  const a = user('소원이', 'corgi', 'hyper');
  const b = user('단짝이', 'bichon', 'sweet');
  assert.match(babies.check(a.userId, b.userId), /친구/);
  befriend(a, b);
  assert.match(babies.check(a.userId, b.userId), /영혼의 단짝/);
  soulmates(a, b);
  assert.match(babies.check(a.userId, b.userId), /다 자라야/);
  grownUp(a); grownUp(b);
  assert.equal(babies.check(a.userId, b.userId), null);
  const wish = babies.wish(a.userId, b.userId);
  assert.throws(() => babies.wish(b.userId, a.userId), /이미/);
  const accepted = babies.respond(b.userId, wish.id, true);
  assert.equal(accepted.status, 'accepted');
  assert.deepEqual(babies.deliver(a.userId), [], '아직 도착 전');
  clock.advance(BABY.arriveMs + 1000);
  assert.equal(babies.deliver(a.userId).length, 1);
  assert.deepEqual(babies.deliver(b.userId), [], '한 번만 보내요 (두 집 모두)');
  const mailA = progress.listMail(a.userId).find((m) => m.kind === 'baby');
  const mailB = progress.listMail(b.userId).find((m) => m.kind === 'baby');
  assert.ok(mailA && mailB);
  assert.ok(breedOf(mailA.baby.breed).mix, '코기와 비숑의 믹스');
  assert.equal(mailA.baby.parents[0].name, '소원이멍');
  const baby = babies.adopt(a.userId, mailA.id, '꼬물이');
  assert.equal(baby.breed, mailA.baby.breed);
  assert.equal(baby.parents[1].owner, '단짝이');
  assert.equal(game.loadDog(a.userId).id, baby.id, '아기가 대표');
  assert.throws(() => babies.adopt(a.userId, mailA.id, '또또'), /이미/);
  // 부모 강아지는 "다정한 엄마아빠 멍" 칭호
  const parent = game.loadDogById(a.dog.id);
  assert.equal(parent.kids, 1);
  assert.ok(game.dogView(parent).titles.includes('parent'));
  // 쿨다운: 바로 다시는 못 빌어요
  assert.match(babies.check(a.userId, b.userId), /조금 더/);
  // 최대 3마리
  db.prepare("INSERT INTO dogs (user_id, name, breed, personality, fullness, cleanliness, affection, exp, born_at, updated_at) VALUES (?, '셋째', 'poodle', 'sweet', 50, 50, 50, 0, 1, 1)").run(b.userId);
  db.prepare("INSERT INTO dogs (user_id, name, breed, personality, fullness, cleanliness, affection, exp, born_at, updated_at) VALUES (?, '넷째', 'poodle', 'sweet', 50, 50, 50, 0, 1, 1)").run(b.userId);
  assert.throws(() => babies.adopt(b.userId, mailB.id, '막내'), /3마리/);
});

test('스페셜 모습은 물려주지 않고, 같은 견종이면 그 견종 아기', () => {
  const { babies } = setup();
  const same = babies.makeBaby({ breed: 'maltese', personality: 'shy' }, { breed: 'maltese', personality: 'smart' });
  assert.equal(same.breed, 'maltese');
  const sp = babies.makeBaby({ breed: 'mini_bichon', special: 'mungchi', baseBreed: 'corgi', personality: 'shy' }, { breed: 'big_maltese', special: 'bbosik', baseBreed: null, personality: 'shy' });
  assert.ok(!sp.breed.includes('mini_bichon') && !sp.breed.includes('big_maltese'));
});
