import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';
import { Friends } from '../server/friends.js';
import { Progress } from '../server/progress.js';
import { specialForName, talentEffects, applyAction } from '../shared/rules.js';
import { RENAME_PRICE, TREASURE, SPECIALS, SPECIAL_PERKS, ITEMS } from '../shared/data.js';

function setup() {
  let now = Date.UTC(2026, 8, 26, 3);
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now, rng: () => 0 });
  const auth = new Auth(db, { now: () => now });
  const friends = new Friends(db, game);
  game.progress = new Progress(db, { game, friends, rng: () => 0 });
  return { db, game, auth };
}
const make = (game, auth, nick, name, breed = 'corgi') => {
  const { userId } = auth.signup(nick, '1234');
  const dog = game.createDog(userId, { name, breed, personality: 'sweet' });
  return { userId, dog };
};

test('스페셜 이름: 띄어쓰기 무시, 다른 이름은 그대로', () => {
  assert.equal(specialForName('뭉치'), 'mungchi');
  assert.equal(specialForName(' 뭉 치 '), 'mungchi');
  assert.equal(specialForName('뽀식이'), 'bbosik');
  assert.equal(specialForName('건'), 'gun');
  assert.equal(specialForName('건이'), null);
  assert.equal(specialForName('초코'), null);
});

test('이름을 뭉치로 지으면 누구나 미니비숑으로 변신, 원래 견종은 기억해요', () => {
  const { game, auth } = setup();
  const { userId, dog } = make(game, auth, '누구나', '뭉치', 'corgi');
  assert.equal(dog.special, 'mungchi');
  assert.equal(dog.breed, 'mini_bichon');
  assert.equal(dog.baseBreed, 'corgi');
  const view = game.dogView(dog);
  assert.ok(view.titles.includes('sp_mungchi'), '스페셜 칭호');
  // 이름표 바꾸기: 평범한 이름 → 원래 견종으로
  game.addCoins(userId, 100);
  const coins = game.getUser(userId).coins;
  const r1 = game.renameDog(userId, '초코');
  assert.equal(r1.events[0].type, 'specialLost');
  assert.equal(game.loadDog(userId).breed, 'corgi');
  assert.equal(game.getUser(userId).coins, coins - RENAME_PRICE);
  // 다시 스페셜 이름으로 → 요크 삼형제
  const r2 = game.renameDog(userId, '피츄');
  assert.deepEqual(r2.events[0], { type: 'special', key: 'pichu', from: 'corgi' });
  assert.equal(game.loadDog(userId).breed, 'yorkie_pichu');
  assert.throws(() => game.renameDog(userId, '피츄'), /같아요/);
});

test('원조 코드: 스페셜마다 한 계정만, 틀린 코드는 안 돼요', () => {
  const { game, auth } = setup();
  const a = make(game, auth, '가족이', '뽀식이');
  const b = make(game, auth, '다른애', '뽀식이');
  const c = make(game, auth, '평범이', '초코');
  assert.throws(() => game.claimOriginal(a.userId, 'x', null), /준비되지/);
  assert.throws(() => game.claimOriginal(a.userId, 'wrong', 'secret123'), /맞지/);
  assert.throws(() => game.claimOriginal(c.userId, 'secret123', 'secret123'), /스페셜 친구만/);
  const dog = game.claimOriginal(a.userId, 'secret123', 'secret123');
  assert.equal(dog.original, true);
  assert.equal(dog.title, 'sp_bbosik');
  assert.throws(() => game.claimOriginal(b.userId, 'secret123', 'secret123'), /이미 있어요/);
  // 놀이터에서도 원조·스페셜 표시는 보여요 (레벨은 숨김)
  const pub = game.plazaDog(game.loadDog(a.userId));
  assert.equal(pub.special, 'bbosik');
  assert.equal(pub.original, true);
  assert.equal(pub.level, undefined);
  // 이름을 바꾸면 원조 자리를 내놓아요
  game.addCoins(a.userId, 100);
  game.renameDog(a.userId, '구름');
  assert.equal(game.loadDog(a.userId).original, false);
  game.claimOriginal(b.userId, 'secret123', 'secret123');
});

test('스페셜 효과: 키리쿠 힌트, 건 체력, 뽀식이 쓰다듬기', () => {
  assert.ok(talentEffects({}, 'kiriku').warmRadius > TREASURE.warmRadius);
  assert.equal(talentEffects({}, 'gun').runnerHp, 30);
  assert.equal(talentEffects({}, 'gun').runnerShield, 1);
  assert.equal(talentEffects({}, 'pichu').runnerJumps, 3);
  assert.equal(talentEffects({}, 'mungchi').runnerMagnet, true);
  assert.equal(talentEffects({}, null).runnerJumps, 2);
  const base = { personality: 'smart', fullness: 80, cleanliness: 80, affection: 40, fluff: 0, exp: 0, stage: 0 };
  const normal = applyAction(base, 'pet').dog.affection;
  const big = applyAction({ ...base, special: 'bbosik' }, 'pet').dog.affection;
  assert.equal(big - normal, 3);
});

test('요크 삼형제가 모두 모이면 배지', () => {
  const { game, auth } = setup();
  const k = make(game, auth, '형제일', '키리쿠');
  const g = make(game, auth, '형제이', '건');
  const p = make(game, auth, '형제삼', '피츄');
  const entries = [k, g, p].map((x) => ({ userId: x.userId, special: x.dog.special }));
  assert.equal(game.trioGathering(k.userId, entries.slice(0, 1)), null);
  assert.deepEqual(game.trioGathering(g.userId, entries.slice(0, 2)), { names: ['키리쿠', '건'], all: false });
  const all = game.trioGathering(p.userId, entries);
  assert.equal(all.all, true);
  assert.ok(game.progress.view(k.userId).badges.includes('trio'));
  assert.equal(Object.values(SPECIALS).filter((s) => s.trio).length, 3);
});

test('스페셜 친구 혜택: 시작 선물(경험치·코인·전용 소품)은 한 마리당 한 번, 경험치 +20%', () => {
  const { game, auth } = setup();
  const m = make(game, auth, '뭉치주인', '뭉치', 'bichon');
  const coins0 = game.getUser(m.userId).coins;
  const ev = game.specialGifts(m.userId);
  const gift = ev.find((e) => e.type === 'specialGift');
  assert.deepEqual([gift.key, gift.item], ['mungchi', 'sp_cloud_pin']);
  assert.ok(ev.some((e) => e.type === 'levelUp'), '시작 선물로 레벨이 올라요');
  assert.equal(game.loadDog(m.userId).exp, SPECIAL_PERKS.startExp);
  assert.ok(game.getUser(m.userId).owned.includes('sp_cloud_pin'));
  assert.ok(game.getUser(m.userId).coins >= coins0 + SPECIAL_PERKS.startCoins);
  assert.equal(game.specialGifts(m.userId).length, 0, '두 번 받지 않아요');
  // 이름을 바꿨다가 다시 뭉치로 해도 선물은 한 번뿐
  game.addCoins(m.userId, 100);
  game.renameDog(m.userId, '구름');
  game.renameDog(m.userId, '뭉치');
  assert.equal(game.specialGifts(m.userId).length, 0);
  // 경험치 +20%
  const n = make(game, auth, '보통주인', '초코');
  const e1 = game.grant(n.userId, { exp: 10 }) && game.loadDog(n.userId).exp;
  const e0 = game.loadDog(m.userId).exp;
  game.grant(m.userId, { exp: 10 });
  assert.equal(e1, 10);
  assert.equal(game.loadDog(m.userId).exp - e0, 12);
  assert.equal(ITEMS.sp_cloud_pin.gacha, false);
});
