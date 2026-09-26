// 장난감 방 정리 정돈 (언패킹 스타일) — 순수 게임 규칙, 실패 없는 평화로운 놀이
// 두 사람 모두 장난감을 끌어서 옮길 수 있어요. 맞는 곳에 놓으면 쏙! 틀린 곳이면 원래 자리로 돌아가요.
import { COOP_GAMES } from '../data.js';

const cfg = COOP_GAMES.tidy;
export const TIDY = {
  W: 192, H: 144,
  targets: {
    ball: { name: '노란 바구니', x: 8, y: 96, w: 44, h: 34, slots: [[16, 104], [28, 108], [40, 104]] },
    bone: { name: '파란 상자', x: 140, y: 96, w: 44, h: 34, slots: [[150, 106], [162, 110], [174, 106]] },
    bear: { name: '침대 위', x: 66, y: 22, w: 60, h: 30, slots: [[82, 34], [108, 34]] },
  },
  toys: [
    ['ball', 70, 84], ['ball', 120, 118], ['ball', 96, 104],
    ['bone', 60, 116], ['bone', 132, 76], ['bone', 88, 128],
    ['bear', 110, 92], ['bear', 44, 76],
  ],
};

const inside = (t, x, y) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h;

export const tidy = {
  id: 'tidy',
  init({ now }) {
    return {
      game: 'tidy', status: 'play', startedAt: now, endsAt: now + cfg.timeLimit * 1000,
      toys: TIDY.toys.map(([kind, x, y], i) => ({ id: i, kind, x, y, ox: x, oy: y, placed: false, holder: null })),
      placed: { p1: 0, p2: 0 },
    };
  },

  input(state, { role, input }) {
    if (state.status !== 'play' || !input) return [];
    const toy = state.toys.find((t) => t.id === input.id);
    if (!toy || toy.placed) return [];
    const x = Math.max(0, Math.min(TIDY.W, Number(input.x) || 0));
    const y = Math.max(0, Math.min(TIDY.H, Number(input.y) || 0));
    if (input.type === 'grab') {
      if (toy.holder && toy.holder !== role) return [];
      toy.holder = role;
      return [{ type: 'grab', id: toy.id, role }];
    }
    if (toy.holder !== role) return [];
    if (input.type === 'move') { toy.x = x; toy.y = y; return [{ type: 'move', id: toy.id }]; }
    if (input.type === 'drop') {
      toy.holder = null;
      const target = TIDY.targets[toy.kind];
      if (inside(target, x, y)) {
        const used = state.toys.filter((t) => t.placed && t.kind === toy.kind).length;
        [toy.x, toy.y] = target.slots[used] ?? [x, y];
        toy.placed = true;
        state.placed[role] += 1;
        const events = [{ type: 'placed', id: toy.id, role }];
        if (state.toys.every((t) => t.placed)) { state.status = 'clear'; events.push({ type: 'clear' }); }
        return events;
      }
      toy.x = toy.ox; toy.y = toy.oy;
      return [{ type: 'return', id: toy.id, role, wrong: Object.values(TIDY.targets).some((t) => inside(t, x, y)) }];
    }
    return [];
  },

  tick(state, now) {
    if (state.status === 'play' && now >= state.endsAt) { state.status = 'timeout'; return [{ type: 'timeout' }]; }
    return [];
  },

  reward(state) { return { coins: state.status === 'clear' ? cfg.reward.clear : cfg.reward.timeout, item: null }; },
  summary(state) {
    const n = state.toys.filter((t) => t.placed).length;
    return state.status === 'clear' ? '방이 반짝반짝 깨끗해졌어요!' : `장난감 ${n}/${state.toys.length}개를 정리했어요`;
  },
};
