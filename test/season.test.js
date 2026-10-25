import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonActive, pickShowTheme } from '../shared/rules.js';
import { FASHION, ITEMS, SHOW_WARDROBE } from '../shared/data.js';
import { openDb } from '../server/db.js';
import { Game } from '../server/game.js';
import { Auth } from '../server/auth.js';

const kst = (m, d) => Date.parse(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+09:00`);

test('할로윈 기간: 10월 15일 ~ 11월 7일 (한국 시간)', () => {
  assert.equal(seasonActive('halloween', kst(10, 14)), false);
  assert.equal(seasonActive('halloween', kst(10, 15)), true);
  assert.equal(seasonActive('halloween', kst(10, 31)), true);
  assert.equal(seasonActive('halloween', kst(11, 7)), true);
  assert.equal(seasonActive('halloween', kst(11, 8)), false);
  assert.equal(seasonActive('nope', kst(10, 31)), false);
});

test('패션쇼 주제: 최근 주제는 다시 안 나오고, 할로윈 주제는 기간에만', () => {
  let rnd = 0.37;
  const rng = () => { rnd = (rnd * 9301 + 49297) % 233280 / 233280; return rnd; };
  const recent = [];
  for (let i = 0; i < 60; i++) {
    const t = pickShowTheme(recent, kst(6, 1), rng);
    assert.notEqual(t.key, 'halloween', '할로윈 기간이 아니면 안 나와요');
    assert.ok(!recent.includes(t.key), `${t.key}가 너무 빨리 다시 나왔어요`);
    recent.unshift(t.key); recent.length = Math.min(recent.length, FASHION.noRepeat);
  }
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(pickShowTheme([], kst(10, 31), rng).key);
  assert.ok(seen.has('halloween'));
  // 모든 주제에 무대 의상이 2개 이상
  for (const t of FASHION.themes) assert.ok(Object.values(SHOW_WARDROBE).filter((w) => w.theme === t.key).length >= 2, t.key);
});

test('할로윈 옷은 기간에만 살 수 있고, 산 옷은 계속 가져요', () => {
  let now = kst(10, 20);
  const db = openDb(':memory:');
  const game = new Game(db, { now: () => now, rng: () => 0.5 });
  const { userId } = new Auth(db, { now: () => now }).signup('할로윈', '1234');
  game.createDog(userId, { name: '콩', breed: 'corgi', personality: 'sweet' });
  game.addCoins(userId, 500);
  game.buy(userId, 'hw_ghost');
  assert.ok(game.getUser(userId).owned.includes('hw_ghost'));
  now = kst(12, 1);
  assert.throws(() => game.buy(userId, 'hw_bat'), /계절 한정/);
  assert.ok(game.getUser(userId).owned.includes('hw_ghost'));
  assert.ok(Object.values(ITEMS).filter((i) => i.season === 'halloween').every((i) => i.gacha === false));
});
