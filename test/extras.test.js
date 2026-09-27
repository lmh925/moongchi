import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { Asks } from '../server/asks.js';
import { Village } from '../server/village.js';
import { Extras } from '../server/extras.js';
import { PLACES, DREAMS, FUN_NEWS } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 27, 3);
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const db = openDb(':memory:');
  let seed = 7;
  const game = new Game(db, { now: clock.now, rng: () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; } });
  const auth = new Auth(db, { now: clock.now });
  const friends = new Friends(db, game);
  game.progress = new Progress(db, { game, friends, rng: () => 0.5 });
  const asks = new Asks(db, { game, friends });
  const village = new Village(db, { game, asks });
  const extras = new Extras(db, { game, friends, asks, village });
  Object.assign(game, { asks, village });
  const user = (nick, dog) => { const { userId } = auth.signup(nick, '1234'); game.createDog(userId, { name: dog, breed: 'corgi', personality: 'sweet' }); return userId; };
  const befriend = (a, b) => { friends.request(a, game.getUser(b).friendCode); friends.respond(b, friends.list(b).incoming[0].id, true); };
  const unlock = (id, place) => { asks.addHearts(id, 200); village.open(id, place); };
  return { db, game, asks, village, extras, clock, user, befriend, unlock };
}

test('온천: 하루 한 번, 청결 가득 + 애정 + 뽀송', () => {
  const { extras, game, user, unlock, clock, db } = setup();
  const u = user('온천이', '콩');
  assert.throws(() => extras.bathe(u), /온천/);
  unlock(u, 'spa');
  db.prepare('UPDATE dogs SET cleanliness = 30, affection = 40 WHERE user_id = ?').run(u);
  extras.bathe(u);
  const d = game.loadDog(u);
  assert.equal(d.cleanliness, 100);
  assert.ok(d.affection >= 55);
  assert.ok(extras.spaToday(u));
  assert.throws(() => extras.bathe(u), /벌써/);
  clock.advance(24 * 3600_000);
  assert.ok(extras.bathe(u));
});

test('꿈 엿보기: 하루 한 번, 못 본 꿈이 먼저, 친구 강아지도 꿈에 나와요', () => {
  const { extras, user, unlock, clock, befriend } = setup();
  const a = user('꿈꾸미', '콩'); const b = user('친구', '초코');
  befriend(a, b);
  unlock(a, 'camp');
  const seen = new Set();
  for (let i = 0; i < Object.keys(DREAMS).length; i++) {
    const { dream } = extras.dream(a);
    assert.ok(dream.first, '처음 보는 꿈');
    assert.ok(!seen.has(dream.id));
    seen.add(dream.id);
    assert.ok(!dream.text.includes('{'), '빈칸이 다 채워져요');
    if (DREAMS[dream.id].friend) assert.match(dream.text, /초코/);
    assert.throws(() => extras.dream(a), /벌써/);
    clock.advance(24 * 3600_000);
  }
  assert.equal(extras.dreamView(a).seen.length, Object.keys(DREAMS).length);
});

test('멍뭉 뉴스: 친구의 자랑 소식만 보여요 + 오늘의 재미 뉴스', () => {
  const { extras, user, befriend } = setup();
  const a = user('기자', '콩'); const b = user('친구', '초코'); const c = user('모르는', '보리');
  befriend(a, b);
  extras.noteEvents(b, [{ type: 'levelUp', level: 10 }, { type: 'levelUp', level: 11 }]);
  extras.noteEvents(c, [{ type: 'cert', kind: 'master', name: '노즈워크' }]);
  const n = extras.news(a);
  assert.equal(n.friends.length, 1);
  assert.match(n.friends[0].text, /초코.*Lv 10/);
  assert.ok(FUN_NEWS.includes(n.fun));
});
