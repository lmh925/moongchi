import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Safety } from '../server/safety.js';
import { Progress } from '../server/progress.js';
import { Trades, isUnfair } from '../server/trades.js';
import { TRADE, ITEMS } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  const game = new Game(db, { now: clock.now, rng: () => 0 });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  const safety = new Safety(db, { now: clock.now });
  const progress = new Progress(db, { game, friends, rng: () => 0 });
  game.progress = progress;
  const trades = new Trades(db, { game, friends, safety, progress });
  const user = (nick, items) => {
    const { userId } = auth.signup(nick, '1234');
    game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
    const u = game.getUser(userId);
    db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify([...u.owned, ...items]), userId);
    return userId;
  };
  const befriend = (a, b) => {
    const code = game.getUser(b).friendCode;
    friends.request(a, code);
    const req = friends.list(b).incoming[0];
    friends.respond(b, req.id, true);
  };
  return { db, game, trades, friends, safety, clock, user, befriend };
}

test('멍뭉거래: 친구끼리만, 제안 → 수락하면 맞바꾸고, 받은 건 하루 동안 다시 못 팔아요', () => {
  const { game, trades, user, befriend, clock } = setup();
  const a = user('가나', ['ribbon', 'crown']);
  const b = user('다라', ['bowtie']);
  assert.throws(() => trades.offer(a, b, ['ribbon'], ['bowtie']), /친구하고만/);
  befriend(a, b);
  const opts = trades.options(a, b);
  assert.ok(opts.mine.find((s) => s.id === 'ribbon' && !s.why));
  assert.deepEqual(opts.theirs, ['bowtie']);
  assert.throws(() => trades.offer(a, b, [], ['bowtie']), /받기만/);
  const offer = trades.offer(a, b, ['ribbon'], ['bowtie']);
  assert.deepEqual(offer.iGive, ['ribbon']);
  assert.equal(trades.pendingFor(b), 1);
  const res = trades.respond(b, offer.id, true);
  assert.equal(res.trade.status, 'accepted');
  assert.ok(game.getUser(a).owned.includes('bowtie') && !game.getUser(a).owned.includes('ribbon'));
  assert.ok(game.getUser(b).owned.includes('ribbon') && !game.getUser(b).owned.includes('bowtie'));
  // 받은 리본은 하루 동안 잠겨요
  assert.equal(trades.options(b, a).mine.find((s) => s.id === 'ribbon').why, 'locked');
  assert.throws(() => trades.offer(b, a, ['ribbon'], []), /지금 거래할 수 없어요/);
  clock.advance(TRADE.lockMs + 1000);
  assert.ok(trades.offer(b, a, ['ribbon'], []), '선물(주기만)은 돼요');
});

test('멍뭉거래 안전장치: 착용 중·기본·보상 아이템, 이미 가진 것, 하루 한도, 만료, 취소', () => {
  const { game, trades, user, befriend, clock, db } = setup();
  const a = user('마바', ['ribbon', 'crown', 'clover', 'medal', 'bowtie', 'bandana', 'scarf', 'pearl']);
  const b = user('사아', ['crown']);
  befriend(a, b);
  game.equip(a, 'head', 'ribbon');
  const states = Object.fromEntries(trades.options(a, b).mine.map((s) => [s.id, s.why]));
  assert.equal(states.ribbon, 'equipped');
  assert.equal(states.wall_wood, 'basic');
  assert.equal(states.clover, 'reward');
  assert.equal(states.crown, 'theyHave');
  assert.throws(() => trades.offer(a, b, ['ribbon'], []), /지금 거래할 수 없어요/);
  assert.throws(() => trades.offer(a, b, ['crown'], []), /이미/);
  // 제안은 3개까지
  trades.offer(a, b, ['medal'], []);
  trades.offer(a, b, ['bowtie'], []);
  const t3 = trades.offer(a, b, ['bandana'], []);
  assert.throws(() => trades.offer(a, b, ['scarf'], []), /기다려/);
  trades.cancel(a, t3.id);
  assert.throws(() => trades.respond(b, t3.id, true), /끝난/);
  // 하루 지나면 만료
  clock.advance(TRADE.expireMs + 1000);
  assert.equal(trades.list(b).incoming.length, 0);
  assert.equal(trades.list(a).history.filter((t) => t.status === 'expired').length, 2);
  // 수락 전에 아이템이 사라지면 거래가 안 돼요
  const t4 = trades.offer(a, b, ['scarf'], []);
  const owned = game.getUser(a).owned.filter((id) => id !== 'scarf');
  db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify(owned), a);
  assert.throws(() => trades.respond(b, t4.id, true), /지금 거래할 수 없어요/);
});

test('공평하지 않은 거래는 표시해요', () => {
  const of = (r) => Object.keys(ITEMS).filter((id) => ITEMS[id].rarity === r && ITEMS[id].gacha !== false);
  const [c1, c2] = of('common');
  const [e1] = of('epic');
  assert.equal(isUnfair([c1], [c2]), false);
  assert.equal(isUnfair([e1], [c1]), true);
  assert.equal(isUnfair([c1], [e1]), true);
});
