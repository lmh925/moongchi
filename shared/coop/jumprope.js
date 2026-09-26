// 깡총깡총 실시간 줄넘기 (2인 협동) — 순수 게임 규칙
// 밧줄이 발밑을 지나는 "판정 시각"마다 두 사람이 각자 자기 화면에서 뛰어야 해요.
// 둘 다 판정 범위 안에서 뛰면 성공(콤보), 한 명이라도 놓치면 하트 하나가 줄어요. 하트가 없어지면 끝.
import { COOP_GAMES } from '../data.js';

const cfg = COOP_GAMES.jumprope;

// 밧줄 위치 (0 = 맨 위, 0.5 = 발밑). 판정 시각 nextJ에 0.5가 돼요.
export function ropePhase(state, t) {
  const p = 0.5 + (t - state.nextJ) / state.period;
  return ((p % 1) + 1) % 1;
}

export const jumprope = {
  id: 'jumprope',
  init({ now }) {
    return {
      game: 'jumprope', status: 'play', startedAt: now, endsAt: now + cfg.timeLimit * 1000,
      period: cfg.startPeriodMs, window: cfg.windowMs, nextJ: now + 3000 + cfg.startPeriodMs / 2,
      combo: 0, best: 0, jumps: 0, lives: cfg.lives, goal: cfg.goal, hits: {},
    };
  },

  // 입력: { type: 'jump', at } — at은 누른 순간의 (서버 기준) 시각
  input(state, { role, input, now }) {
    if (state.status !== 'play' || input?.type !== 'jump') return [];
    const at = Math.min(now + 50, Math.max(now - 800, Number(input.at) || now));
    const d = at - state.nextJ;
    if (Math.abs(d) <= state.window) {
      if (state.hits[role]) return [];
      state.hits[role] = { at, perfect: Math.abs(d) <= state.window * 0.4 };
      return [{ type: 'jump', role, good: true, perfect: state.hits[role].perfect }];
    }
    // 너무 일찍 뛰어도 벌칙은 없어요 (강아지만 폴짝)
    return [{ type: 'jump', role, good: false }];
  },

  tick(state, now) {
    if (state.status !== 'play') return [];
    const events = [];
    if (now > state.nextJ + state.window + cfg.graceMs) {
      const ok = !!(state.hits.p1 && state.hits.p2);
      const missed = ['p1', 'p2'].filter((r) => !state.hits[r]);
      if (ok) {
        state.combo += 1;
        state.jumps += 1;
        state.best = Math.max(state.best, state.combo);
        events.push({ type: 'cycle', ok: true, combo: state.combo, perfect: state.hits.p1.perfect && state.hits.p2.perfect });
        if (state.combo % cfg.speedupEvery === 0) {
          state.period = Math.max(cfg.minPeriodMs, state.period - cfg.speedupMs);
          state.window = Math.max(cfg.minWindowMs, state.window - 10);
          events.push({ type: 'speedup' });
        }
      } else {
        state.lives -= 1;
        state.combo = 0;
        events.push({ type: 'cycle', ok: false, missed, lives: state.lives });
      }
      state.hits = {};
      // 틀리면 줄이 잠깐 멈췄다가 다시 돌아요
      state.nextJ += ok ? state.period : state.period + 1200;
      if (state.jumps >= state.goal) { state.status = 'clear'; events.push({ type: 'clear' }); }
      else if (state.lives <= 0) { state.status = 'over'; events.push({ type: 'over' }); }
    }
    if (state.status === 'play' && now >= state.endsAt) { state.status = 'timeout'; events.push({ type: 'timeout' }); }
    return events;
  },

  reward(state) {
    if (state.status === 'clear') return { coins: cfg.reward.clear, item: null };
    return { coins: Math.max(2, Math.floor(state.jumps * cfg.reward.perCombo)), item: null };
  },

  summary(state) {
    return state.status === 'clear' ? `${state.goal}번 성공!` : `${state.jumps}번 넘었어요 (최고 ${state.best}콤보)`;
  },
};
