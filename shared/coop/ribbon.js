// 으쌰으쌰 대왕 리본 풀기 (2인 동기화 게임) — 순수 게임 규칙
// 좌우로 오가는 게이지가 초록 칸(퍼펙트 존)에 있을 때, 두 사람이 0.3초 안에 같이 "영차!"하면 매듭이 하나 풀려요.
import { COOP_GAMES } from '../data.js';

const cfg = COOP_GAMES.ribbon;
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const other = (role) => (role === 'p1' ? 'p2' : 'p1');

export function gaugeAt(state, t) {
  const st = cfg.stages[Math.min(state.stage, cfg.stages.length - 1)];
  if (t < state.stageStart) return 0;
  const u = ((t - state.stageStart) / st.periodMs) % 2;
  return u < 1 ? u : 2 - u;
}

export const ribbon = {
  id: 'ribbon',
  init({ now }) {
    return {
      game: 'ribbon', status: 'play', stage: 0, stages: cfg.stages.length,
      stageStart: now + 1500, startedAt: now, endsAt: now + cfg.timeLimit * 1000,
      taps: {}, success: 0, tries: 0,
    };
  },

  // 입력: { type: 'pull', pos } — pos는 누른 순간 내 화면의 게이지 위치 (0~1)
  input(state, { role, input, now }) {
    if (state.status !== 'play' || input?.type !== 'pull' || now < state.stageStart) return [];
    if (state.taps[role]) return [];
    const pos = typeof input.pos === 'number' ? clamp01(input.pos) : gaugeAt(state, now);
    state.taps[role] = { at: now, pos };
    const o = state.taps[other(role)];
    if (!o) return [{ type: 'pull', role }];
    const zone = cfg.stages[state.stage].zone;
    const inZone = (p) => p >= zone[0] && p <= zone[1];
    const sync = Math.abs(o.at - now) <= cfg.syncMs;
    state.taps = {};
    state.tries += 1;
    if (sync && inZone(pos) && inZone(o.pos)) {
      state.stage += 1;
      state.success += 1;
      if (state.stage >= state.stages) {
        state.status = 'clear';
        return [{ type: 'pull', role }, { type: 'success', stage: state.stage }, { type: 'clear' }];
      }
      state.stageStart = now + 1200;
      return [{ type: 'pull', role }, { type: 'success', stage: state.stage }];
    }
    const missed = [role, other(role)].filter((r) => !inZone(r === role ? pos : o.pos));
    return [{ type: 'pull', role }, { type: 'fail', why: sync ? 'zone' : 'sync', missed }];
  },

  tick(state, now) {
    if (state.status !== 'play') return [];
    const events = [];
    for (const role of ['p1', 'p2']) {
      const t = state.taps[role];
      if (t && now - t.at > cfg.syncMs) {
        state.taps = {};
        events.push({ type: 'fail', why: 'alone', alone: role });
        break;
      }
    }
    if (now >= state.endsAt) { state.status = 'timeout'; events.push({ type: 'timeout' }); }
    return events;
  },

  reward(state) {
    return state.status === 'clear'
      ? { coins: cfg.reward.clear, item: cfg.reward.item }
      : { coins: cfg.reward.timeout, item: null };
  },
};
