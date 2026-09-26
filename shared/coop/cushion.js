// 영차영차 쿠션 탑 쌓기 (피코 파크 스타일) — 순수 게임 규칙
// p1(쿠션 담당): 떨어지는 쿠션을 좌우로 옮기고 빨리 내릴 수 있어요.
// p2(등반 담당): 좌우로 걷고 점프해서 쿠션을 밟고 올라가요. 선반 위 뼈다귀에 닿으면 클리어!
// 쿠션이 아래 쿠션에 반도 안 걸치면 와르르 무너지고, 잠깐 뒤 처음부터 다시 해요 (벌칙 없음).
import { COOP_GAMES } from '../data.js';

const cfg = COOP_GAMES.cushion;
export const CUSHION = {
  W: 192, H: 144, FLOOR: 128, WALL: 8,
  CW: 28, CH: 10, SPAWN_MS: 3000, FALL: 34, FAST: 170, STEP: 6,
  SHELF: { x: 150, y: 40 }, BONE: { x: 176, y: 32 },
  DOG_W: 14, GRAVITY: 430, JUMP: 200, WALK: 52, STABLE: 0.45,
};
const C = CUSHION;

function surfaces(state) {
  return [
    { x0: 0, x1: C.W, y: C.FLOOR },
    { x0: C.SHELF.x, x1: C.W, y: C.SHELF.y },
    ...state.stack.map((c) => ({ x0: c.x, x1: c.x + C.CW, y: c.y, cushion: c })),
  ];
}

function freshDog() { return { x: 40, y: C.FLOOR, vy: 0, onGround: true, walk: 0, dir: 1 }; }

export const cushion = {
  id: 'cushion',
  realtime: true, // 20번/초 상태를 보내요 (움직임이 있는 게임)
  init({ now }) {
    return {
      game: 'cushion', status: 'play', phase: 'play', startedAt: now, endsAt: now + cfg.timeLimit * 1000,
      stack: [], falling: null, nextSpawn: now + 1500, dog: freshDog(), retries: 0, collapsedUntil: 0, placed: 0,
    };
  },

  input(state, { role, input, now }) {
    if (state.status !== 'play' || state.phase !== 'play') return [];
    if (role === 'p1' && state.falling) {
      if (input?.type === 'move') {
        const dir = input.dir > 0 ? 1 : -1;
        state.falling.x = Math.max(C.WALL, Math.min(C.SHELF.x - C.CW, state.falling.x + dir * C.STEP));
      }
      if (input?.type === 'drop') state.falling.fast = true;
    }
    if (role === 'p2') {
      if (input?.type === 'walk') state.dog.walk = Math.max(-1, Math.min(1, Math.round(Number(input.dir) || 0)));
      if (input?.type === 'jump' && state.dog.onGround) {
        state.dog.vy = -C.JUMP; state.dog.onGround = false;
        return [{ type: 'jump' }];
      }
    }
    return [];
  },

  tick(state, now, dt = 0.05) {
    if (state.status !== 'play') return [];
    const events = [];
    if (now >= state.endsAt) { state.status = 'timeout'; return [{ type: 'timeout' }]; }
    if (state.phase === 'collapsed') {
      if (now >= state.collapsedUntil) {
        state.phase = 'play'; state.stack = []; state.falling = null; state.dog = freshDog(); state.nextSpawn = now + 800;
        events.push({ type: 'reset' });
      }
      return events;
    }
    // 쿠션 떨어뜨리기
    if (!state.falling && now >= state.nextSpawn) {
      state.falling = { x: 60, y: 6, fast: false };
      events.push({ type: 'spawn' });
    }
    const f = state.falling;
    if (f) {
      const ny = f.y + (f.fast ? C.FAST : C.FALL) * dt;
      // 아래에서 가장 높은 받침 찾기
      let support = null;
      for (const s of surfaces(state)) {
        const overlap = Math.min(f.x + C.CW, s.x1) - Math.max(f.x, s.x0);
        if (overlap <= 0 || s.y < f.y + C.CH - 0.01) continue;
        if (!support || s.y < support.y) support = { ...s, overlap };
      }
      if (support && ny + C.CH >= support.y) {
        f.y = support.y - C.CH;
        state.falling = null;
        state.nextSpawn = now + C.SPAWN_MS;
        if (support.cushion && support.overlap < C.CW * C.STABLE) {
          state.phase = 'collapsed'; state.collapsedUntil = now + 2200; state.retries += 1;
          events.push({ type: 'collapse' });
          return events;
        }
        state.stack.push({ x: f.x, y: f.y });
        state.placed += 1;
        events.push({ type: 'land', height: state.stack.length });
      } else f.y = ny;
    }
    // 강아지 움직이기 (한 발판씩 두 번 나눠서)
    const d = state.dog;
    for (let i = 0; i < 2; i++) {
      const sdt = dt / 2;
      if (d.walk) { d.dir = d.walk; d.x = Math.max(C.WALL + C.DOG_W / 2, Math.min(C.W - C.DOG_W / 2, d.x + d.walk * C.WALK * sdt)); }
      const prevY = d.y;
      d.vy += C.GRAVITY * sdt;
      d.y += d.vy * sdt;
      d.onGround = false;
      if (d.vy >= 0) {
        for (const s of surfaces(state)) {
          if (d.x + C.DOG_W / 2 <= s.x0 || d.x - C.DOG_W / 2 >= s.x1) continue;
          if (prevY <= s.y + 0.01 && d.y >= s.y) { d.y = s.y; d.vy = 0; d.onGround = true; break; }
        }
      }
    }
    if (Math.hypot(d.x - C.BONE.x, d.y - 6 - C.BONE.y) < 14) {
      state.status = 'clear';
      events.push({ type: 'clear' });
    }
    return events;
  },

  reward(state) {
    return state.status === 'clear' ? { coins: Math.max(8, cfg.reward.clear - state.retries), item: null } : { coins: cfg.reward.timeout, item: null };
  },

  summary(state) {
    return state.status === 'clear' ? `쿠션 ${state.stack.length}개로 성공! (다시 한 횟수 ${state.retries})` : `쿠션을 ${state.placed}개 쌓았어요`;
  },
};
