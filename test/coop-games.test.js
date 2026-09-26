// 2인 협동 게임 규칙 테스트 (쿠션 탑, 간식 공장, 장난감 정리)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cushion, CUSHION as C } from '../shared/coop/cushion.js';
import { bakery, BAKERY as B } from '../shared/coop/bakery.js';
import { tidy, TIDY } from '../shared/coop/tidy.js';

function run(game, state, from, to, step = 50) {
  const events = [];
  for (let t = from; t <= to; t += step) events.push(...game.tick(state, t, step / 1000));
  return events;
}

test('쿠션 탑: 쿠션을 쌓고 손님 강아지가 올라가 뼈다귀를 잡으면 클리어', () => {
  const s = cushion.init({ now: 0 });
  let now = 0;
  // p1이 쿠션을 선반 바로 옆(x=122)에 차곡차곡 쌓아요
  for (let i = 0; i < 6; i++) {
    while (!s.falling) { now += 50; cushion.tick(s, now); }
    for (let k = 0; k < 20; k++) cushion.input(s, { role: 'p1', input: { type: 'move', dir: 1 }, now });
    cushion.input(s, { role: 'p1', input: { type: 'drop' }, now });
    const before = s.stack.length;
    while (s.stack.length === before && s.phase === 'play') { now += 50; cushion.tick(s, now); }
  }
  assert.equal(s.stack.length, 6);
  assert.equal(s.stack.at(-1).x, C.SHELF.x - C.CW);
  // p2가 탑 위로 올라가요: 점프하며 오른쪽으로 걸어서 한 칸씩
  // 탑 꼭대기까지는 탑 위에 머물며 폴짝폴짝, 꼭대기에 오르면 오른쪽 선반으로 점프
  const top = s.stack.at(-1).y;
  for (let i = 0; i < 600 && s.status === 'play'; i++) {
    const onTop = s.dog.onGround && Math.abs(s.dog.y - top) < 0.5;
    const dir = onTop || s.dog.y < top ? 1 : s.dog.x < 134 ? 1 : s.dog.x > 140 ? -1 : 0;
    cushion.input(s, { role: 'p2', input: { type: 'walk', dir }, now });
    if (s.dog.onGround) cushion.input(s, { role: 'p2', input: { type: 'jump' }, now });
    now += 50;
    cushion.tick(s, now);
  }
  assert.equal(s.status, 'clear');
  assert.ok(cushion.reward(s).coins >= 8);
});

test('쿠션 탑: 반도 안 걸치면 와르르 무너지고 잠시 뒤 다시 시작해요', () => {
  const s = cushion.init({ now: 0 });
  let now = 0;
  const drop = (dx) => {
    while (!s.falling) { now += 50; cushion.tick(s, now); }
    for (let k = 0; k < Math.abs(dx); k++) cushion.input(s, { role: 'p1', input: { type: 'move', dir: Math.sign(dx) }, now });
    cushion.input(s, { role: 'p1', input: { type: 'drop' }, now });
    const events = [];
    while (s.falling || (!events.length && s.phase === 'play')) { now += 50; events.push(...cushion.tick(s, now)); if (events.some((e) => e.type === 'land' || e.type === 'collapse')) break; }
    return events;
  };
  drop(0);
  const ev = drop(4); // 24픽셀 옆으로 → 4픽셀만 걸쳐요
  assert.ok(ev.some((e) => e.type === 'collapse'));
  assert.equal(s.phase, 'collapsed');
  const reset = run(cushion, s, now + 50, now + 2500);
  assert.ok(reset.some((e) => e.type === 'reset'));
  assert.equal(s.stack.length, 0);
  assert.equal(s.retries, 1);
});

test('간식 공장: 굽기 → 벨트 → 토핑 → 포장, 너무 오래 두면 타요', () => {
  const s = bakery.init({ now: 0, rng: () => 0 }); // 주문은 모두 우유빵 + 딸기
  assert.deepEqual(s.orders[0], { bread: 'plain', fruit: 'strawberry' });
  bakery.input(s, { role: 'p1', input: { type: 'bake', slot: 0, dough: 'plain' }, now: 0 });
  assert.equal(bakery.input(s, { role: 'p1', input: { type: 'take', slot: 0 }, now: 1000 })[0].type, 'notyet');
  assert.equal(bakery.input(s, { role: 'p1', input: { type: 'take', slot: 0 }, now: B.BAKE_MS + 10 })[0].type, 'send');
  const id = s.belt[0].id;
  // 손님은 오븐을 못 만져요
  assert.deepEqual(bakery.input(s, { role: 'p2', input: { type: 'bake', slot: 1, dough: 'plain' }, now: 0 }), []);
  bakery.input(s, { role: 'p2', input: { type: 'pick', id }, now: 4000 });
  assert.equal(bakery.input(s, { role: 'p2', input: { type: 'pack' }, now: 4000 })[0].type, 'unfinished');
  bakery.input(s, { role: 'p2', input: { type: 'cream' }, now: 4000 });
  bakery.input(s, { role: 'p2', input: { type: 'fruit', fruit: 'banana' }, now: 4000 });
  assert.equal(bakery.input(s, { role: 'p2', input: { type: 'pack' }, now: 4000 })[0].type, 'mismatch');
  bakery.input(s, { role: 'p2', input: { type: 'trash' }, now: 4000 });
  // 다시: 이번엔 딸기
  bakery.input(s, { role: 'p1', input: { type: 'bake', slot: 1, dough: 'plain' }, now: 5000 });
  bakery.input(s, { role: 'p1', input: { type: 'take', slot: 1 }, now: 8500 });
  bakery.input(s, { role: 'p2', input: { type: 'pick', id: s.belt[0].id }, now: 8600 });
  bakery.input(s, { role: 'p2', input: { type: 'cream' }, now: 8600 });
  bakery.input(s, { role: 'p2', input: { type: 'fruit', fruit: 'strawberry' }, now: 8600 });
  assert.equal(bakery.input(s, { role: 'p2', input: { type: 'pack' }, now: 8600 })[0].type, 'deliver');
  assert.equal(s.done, 1);
  // 탄 빵
  bakery.input(s, { role: 'p1', input: { type: 'bake', slot: 0, dough: 'choco' }, now: 9000 });
  const ev = run(bakery, s, 9000, 9000 + B.BURN_MS + 100, 100);
  assert.ok(ev.some((e) => e.type === 'burnt'));
  assert.equal(bakery.input(s, { role: 'p1', input: { type: 'take', slot: 0 }, now: 17000 })[0].type, 'trash');
  run(bakery, s, 17000, 61000, 1000);
  assert.equal(s.status, 'timeout');
  assert.equal(bakery.reward(s).coins, 4);
});

test('장난감 정리: 맞는 곳엔 쏙, 틀린 곳이면 제자리로, 다 치우면 클리어', () => {
  const s = tidy.init({ now: 0 });
  const ball = s.toys.find((t) => t.kind === 'ball');
  tidy.input(s, { role: 'p1', input: { type: 'grab', id: ball.id } });
  assert.deepEqual(tidy.input(s, { role: 'p2', input: { type: 'grab', id: ball.id } }), [], '친구가 들고 있는 건 못 집어요');
  const bed = TIDY.targets.bear;
  const back = tidy.input(s, { role: 'p1', input: { type: 'drop', id: ball.id, x: bed.x + 10, y: bed.y + 10 } });
  assert.equal(back[0].type, 'return');
  assert.equal(back[0].wrong, true);
  assert.deepEqual([ball.x, ball.y], [ball.ox, ball.oy]);
  let events = [];
  for (const toy of s.toys) {
    const role = toy.id % 2 ? 'p1' : 'p2';
    const t = TIDY.targets[toy.kind];
    tidy.input(s, { role, input: { type: 'grab', id: toy.id } });
    events = tidy.input(s, { role, input: { type: 'drop', id: toy.id, x: t.x + t.w / 2, y: t.y + t.h / 2 } });
  }
  assert.ok(events.some((e) => e.type === 'clear'));
  assert.equal(s.status, 'clear');
  assert.equal(s.placed.p1 + s.placed.p2, 8);
});
