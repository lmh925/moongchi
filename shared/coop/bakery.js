// 우당탕탕 수제 간식 공장 (오버쿡드 스타일) — 순수 게임 규칙
// p1(빵 굽기): 반죽을 오븐에 넣고, 다 구워지면(3초) 꺼내서 벨트로 보내요. 너무 오래 두면 타 버려요.
// p2(토핑 얹기): 벨트에서 빵을 가져와 생크림과 과일을 올리고 포장해요. 주문과 같으면 납품 완료!
import { COOP_GAMES } from '../data.js';

const cfg = COOP_GAMES.bakery;
export const BAKERY = {
  BAKE_MS: 3000, BURN_MS: 7500, BELT_MAX: 3, ORDERS: 3,
  breads: { plain: '우유빵', choco: '초코빵' },
  fruits: { strawberry: '딸기', banana: '바나나', blueberry: '블루베리' },
};
const B = BAKERY;

export function ovenStatus(oven, now) {
  if (!oven.dough) return 'empty';
  const t = now - oven.at;
  return t < B.BAKE_MS ? 'baking' : t < B.BURN_MS ? 'ready' : 'burnt';
}

function randomOrder(rng = Math.random) {
  const breads = Object.keys(B.breads); const fruits = Object.keys(B.fruits);
  return { bread: breads[Math.floor(rng() * breads.length)], fruit: fruits[Math.floor(rng() * fruits.length)] };
}

export function stars(done) { return done >= 8 ? 3 : done >= 5 ? 2 : done >= 2 ? 1 : 0; }

export const bakery = {
  id: 'bakery',
  init({ now, rng = Math.random }) {
    return {
      game: 'bakery', status: 'play', startedAt: now, endsAt: now + cfg.timeLimit * 1000,
      ovens: [{ dough: null, at: 0, burnt: false }, { dough: null, at: 0, burnt: false }],
      belt: [], station: null, orders: Array.from({ length: B.ORDERS }, () => randomOrder(rng)), done: 0, seq: 0,
    };
  },

  input(state, { role, input, now }) {
    if (state.status !== 'play' || !input) return [];
    if (role === 'p1') {
      const oven = state.ovens[input.slot];
      if (!oven) return [];
      if (input.type === 'bake' && !oven.dough && B.breads[input.dough]) {
        Object.assign(oven, { dough: input.dough, at: now, burnt: false });
        return [{ type: 'bake', slot: input.slot }];
      }
      if (input.type === 'take' && oven.dough) {
        const st = ovenStatus(oven, now);
        if (st === 'baking') return [{ type: 'notyet', role }];
        if (st === 'burnt') { Object.assign(oven, { dough: null, burnt: false }); return [{ type: 'trash', slot: input.slot }]; }
        if (state.belt.length >= B.BELT_MAX) return [{ type: 'beltfull', role }];
        state.belt.push({ id: ++state.seq, type: oven.dough });
        oven.dough = null;
        return [{ type: 'send', slot: input.slot }];
      }
      return [];
    }
    // p2
    if (input.type === 'pick' && !state.station) {
      const i = state.belt.findIndex((b) => b.id === input.id);
      if (i < 0) return [];
      const [bread] = state.belt.splice(i, 1);
      state.station = { type: bread.type, cream: false, fruit: null };
      return [{ type: 'pick' }];
    }
    if (!state.station) return [];
    if (input.type === 'cream' && !state.station.cream) { state.station.cream = true; return [{ type: 'cream' }]; }
    if (input.type === 'fruit' && B.fruits[input.fruit] && !state.station.fruit) { state.station.fruit = input.fruit; return [{ type: 'fruit' }]; }
    if (input.type === 'trash') { state.station = null; return [{ type: 'trash' }]; }
    if (input.type === 'pack') {
      const s = state.station;
      if (!s.cream || !s.fruit) return [{ type: 'unfinished', role }];
      const i = state.orders.findIndex((o) => o.bread === s.type && o.fruit === s.fruit);
      if (i < 0) return [{ type: 'mismatch', role }];
      state.orders.splice(i, 1);
      state.orders.push(randomOrder());
      state.station = null;
      state.done += 1;
      return [{ type: 'deliver', done: state.done, stars: stars(state.done) }];
    }
    return [];
  },

  tick(state, now) {
    if (state.status !== 'play') return [];
    const events = [];
    state.ovens.forEach((o, slot) => {
      if (o.dough && !o.burnt && ovenStatus(o, now) === 'burnt') { o.burnt = true; events.push({ type: 'burnt', slot }); }
      if (o.dough && !o.readyAnnounced && ovenStatus(o, now) === 'ready') { o.readyAnnounced = true; events.push({ type: 'ready', slot }); }
      if (!o.dough) o.readyAnnounced = false;
    });
    if (now >= state.endsAt) { state.status = 'timeout'; events.push({ type: 'timeout' }); }
    return events;
  },

  reward(state) {
    return { coins: Math.min(cfg.reward.max, cfg.reward.base + state.done * cfg.reward.perCake), item: null };
  },

  summary(state) {
    const s = stars(state.done);
    return `컵케이크 ${state.done}개 완성! ${'★'.repeat(s)}${'☆'.repeat(3 - s)}`;
  },
};
