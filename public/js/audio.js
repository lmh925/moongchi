// 효과음 & 배경음: 파일 없이 Web Audio로 직접 만드는 8비트 사운드
const PREF_KEY = 'meongmung.sound';

let ctx = null;
let master = null;
let sfxBus = null;
let bgmBus = null;
let muted = readPref();
let bgm = null; // { name, timer, step, nextTime }
let wantBgm = null;

function readPref() {
  try { return localStorage.getItem(PREF_KEY) === 'off'; } catch { return false; }
}

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(PREF_KEY, v ? 'off' : 'on'); } catch { /* 무시 */ }
  if (master) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.05);
  if (v) stopBgm(false);
  else if (wantBgm) playBgm(wantBgm);
}

// 브라우저는 사용자가 한 번 누른 뒤에만 소리를 낼 수 있어요.
// 아이폰은 앱을 나갔다 오면 소리 장치가 'interrupted'가 되거나, 'running'인데도 조용해지는 일이 있어요.
// 그래서 나갔다 돌아오면(stale) 다음 터치 때 소리 장치를 새로 만들어요.
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let stale = false;

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.35; sfxBus.connect(master);
  bgmBus = ctx.createGain(); bgmBus.gain.value = 0.12; bgmBus.connect(master);
  noiseBuf = null;
  ensureNoise();
  return true;
}

function rebuild() {
  stopBgm(false);
  try { ctx.close(); } catch { /* 이미 닫혔어요 */ }
  ctx = null;
  build();
}

export function unlock() {
  if (ctx && (ctx.state === 'closed' || (stale && (IOS || ctx.state !== 'running')))) rebuild();
  stale = false;
  if (!ctx && !build()) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  if (wantBgm && !bgm) playBgm(wantBgm);
}

// 화면을 떠나면 잠시 멈추고, 돌아오면 다시 켜요 (아이폰은 첫 터치 때 새로 만들어요)
function onHide() {
  if (!ctx) return;
  stale = true;
  stopBgm(false);
  ctx.suspend?.().catch(() => {});
}
function onShow() {
  if (!ctx || IOS) return;
  ctx.resume().then(() => {
    if (ctx?.state === 'running') { stale = false; if (wantBgm && !bgm) playBgm(wantBgm); }
  }).catch(() => {});
}
document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
window.addEventListener('pagehide', onHide);
window.addEventListener('pageshow', (e) => { if (e.persisted) { stale = true; onShow(); } });

const ready = () => ctx && ctx.state === 'running' && !muted;

function tone({ type = 'square', freq = 440, to = null, dur = 0.1, vol = 0.5, at = 0, bus = sfxBus, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let noiseBuf = null;
function ensureNoise() {
  if (noiseBuf) return;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function noise({ dur = 0.1, vol = 0.4, at = 0, freq = 2000, q = 1, type = 'bandpass', sweep = null }) {
  ensureNoise();
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const N = (name) => {
  // 'C4' → 주파수
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * 2 ** ((midi - 69) / 12);
};

// ---------- 효과음 ----------
export const sfx = {
  click() { if (ready()) tone({ type: 'square', freq: 880, to: 1320, dur: 0.05, vol: 0.18 }); },
  tap() { if (ready()) { tone({ type: 'triangle', freq: 520, to: 780, dur: 0.07, vol: 0.4 }); } },
  // 멍! (작은 강아지일수록 높은 소리) pitch: 0.8 ~ 1.4
  bark(pitch = 1, times = 1) {
    if (!ready()) return;
    for (let i = 0; i < times; i++) {
      const at = i * 0.16;
      tone({ type: 'square', freq: 700 * pitch, to: 380 * pitch, dur: 0.11, vol: 0.28, at });
      tone({ type: 'sawtooth', freq: 350 * pitch, to: 200 * pitch, dur: 0.1, vol: 0.12, at });
      noise({ dur: 0.05, vol: 0.12, freq: 1800 * pitch, at });
    }
  },
  eat() {
    if (!ready()) return;
    for (let i = 0; i < 4; i++) noise({ dur: 0.06, vol: 0.5, freq: 900 + i * 150, q: 3, at: i * 0.13 });
  },
  brush() {
    if (!ready()) return;
    for (let i = 0; i < 3; i++) noise({ dur: 0.18, vol: 0.35, freq: 2500, sweep: 6000, q: 0.8, at: i * 0.2, type: 'highpass' });
    [N('E6'), N('G6'), N('C7')].forEach((f, i) => tone({ type: 'sine', freq: f, dur: 0.15, vol: 0.18, at: 0.45 + i * 0.07 }));
  },
  pet() {
    if (!ready()) return;
    [N('C5'), N('E5'), N('G5')].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.35, at: i * 0.08 }));
  },
  love() {
    if (!ready()) return;
    [N('E5'), N('G5'), N('C6'), N('E6')].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.2, vol: 0.3, at: i * 0.07 }));
  },
  coin() {
    if (!ready()) return;
    tone({ type: 'square', freq: N('B5'), dur: 0.07, vol: 0.22 });
    tone({ type: 'square', freq: N('E6'), dur: 0.22, vol: 0.22, at: 0.07 });
  },
  pop() { if (ready()) tone({ type: 'sine', freq: 300, to: 900, dur: 0.09, vol: 0.4 }); },
  whoosh() { if (ready()) noise({ dur: 0.3, vol: 0.3, freq: 400, sweep: 3000, q: 1.2 }); },
  jump() { if (ready()) tone({ type: 'square', freq: 300, to: 750, dur: 0.14, vol: 0.2 }); },
  land() { if (ready()) noise({ dur: 0.06, vol: 0.25, freq: 300, q: 1 }); },
  slide() { if (ready()) noise({ dur: 0.25, vol: 0.25, freq: 1200, sweep: 500, q: 1 }); },
  hurt() {
    if (!ready()) return;
    tone({ type: 'square', freq: 400, to: 150, dur: 0.25, vol: 0.25 });
    noise({ dur: 0.12, vol: 0.2, freq: 600 });
  },
  catch() { if (ready()) tone({ type: 'square', freq: N('A5'), to: N('E6'), dur: 0.08, vol: 0.18 }); },
  star() {
    if (!ready()) return;
    [N('C6'), N('E6'), N('G6'), N('C7')].forEach((f, i) => tone({ type: 'square', freq: f, dur: 0.08, vol: 0.15, at: i * 0.05 }));
  },
  bell() {
    if (!ready()) return;
    [N('G5'), N('E5'), N('C5'), N('G4')].forEach((f, i) => {
      tone({ type: 'sine', freq: f, dur: 0.5, vol: 0.35, at: i * 0.18 });
      tone({ type: 'sine', freq: f * 2.01, dur: 0.3, vol: 0.08, at: i * 0.18 });
    });
  },
  notify() {
    if (!ready()) return;
    tone({ type: 'triangle', freq: N('A5'), dur: 0.12, vol: 0.35 });
    tone({ type: 'triangle', freq: N('D6'), dur: 0.25, vol: 0.35, at: 0.12 });
  },
  levelUp() {
    if (!ready()) return;
    const seq = ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'];
    seq.forEach((n, i) => tone({ type: 'square', freq: N(n), dur: i === seq.length - 1 ? 0.5 : 0.1, vol: 0.2, at: i * 0.09 }));
    tone({ type: 'triangle', freq: N('C4'), dur: 0.8, vol: 0.3, at: 0.5 });
  },
  gameOver() {
    if (!ready()) return;
    ['G5', 'E5', 'C5', 'D5', 'C5'].forEach((n, i) => tone({ type: 'triangle', freq: N(n), dur: 0.2, vol: 0.3, at: i * 0.14 }));
  },
  shutter() {
    if (!ready()) return;
    noise({ dur: 0.04, vol: 0.6, freq: 4000, type: 'highpass' });
    noise({ dur: 0.08, vol: 0.4, freq: 2500, type: 'highpass', at: 0.07 });
    tone({ type: 'square', freq: 1800, dur: 0.03, vol: 0.1, at: 0.02 });
  },
  error() { if (ready()) tone({ type: 'square', freq: 220, to: 180, dur: 0.15, vol: 0.18 }); },
};

// ---------- 배경음 ----------
// [음, 박자] 목록. '-'는 쉼표.
const TRACKS = {
  // 우리집: 포근하고 느긋한 C장조
  home: {
    bpm: 92,
    lead: [
      ['E5', 1], ['G5', 1], ['C6', 1], ['G5', 1], ['A5', 2], ['G5', 2],
      ['F5', 1], ['A5', 1], ['G5', 1], ['E5', 1], ['D5', 3], ['-', 1],
      ['E5', 1], ['G5', 1], ['C6', 1], ['D6', 1], ['E6', 2], ['D6', 1], ['C6', 1],
      ['A5', 1], ['B5', 1], ['D6', 1], ['B5', 1], ['C6', 3], ['-', 1],
    ],
    bass: [
      ['C3', 2], ['G3', 2], ['F3', 2], ['C3', 2], ['D3', 2], ['G3', 2], ['G2', 2], ['B2', 2],
      ['C3', 2], ['E3', 2], ['A2', 2], ['E3', 2], ['F3', 2], ['G3', 2], ['C3', 2], ['G2', 2],
    ],
    leadType: 'triangle', leadVol: 0.5, bassVol: 0.6,
  },
  // 놀이: 신나는 달리기
  play: {
    bpm: 150,
    lead: [
      ['C5', 0.5], ['E5', 0.5], ['G5', 0.5], ['E5', 0.5], ['C6', 1], ['G5', 1],
      ['A5', 0.5], ['G5', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 2],
      ['E5', 0.5], ['F5', 0.5], ['G5', 0.5], ['A5', 0.5], ['G5', 1], ['E5', 1],
      ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['B4', 0.5], ['C5', 2],
    ],
    bass: [
      ['C3', 1], ['G2', 1], ['C3', 1], ['G2', 1], ['F2', 1], ['C3', 1], ['G2', 1], ['D3', 1],
      ['C3', 1], ['A2', 1], ['E3', 1], ['C3', 1], ['F2', 1], ['G2', 1], ['C3', 1], ['G2', 1],
    ],
    leadType: 'square', leadVol: 0.28, bassVol: 0.55, drums: true,
  },
};

function flatten(seq) {
  const out = [];
  let beat = 0;
  for (const [n, len] of seq) { out.push({ n, beat, len }); beat += len; }
  return { notes: out, length: beat };
}

export function playBgm(name) {
  wantBgm = name;
  if (!ctx || muted) return;
  if (bgm?.name === name) return;
  stopBgm(false);
  const tr = TRACKS[name];
  const lead = flatten(tr.lead);
  const bass = flatten(tr.bass);
  const loopBeats = Math.max(lead.length, bass.length);
  const spb = 60 / tr.bpm;
  const state = { name, loopStart: ctx.currentTime + 0.1, scheduledUntil: 0 };
  const schedule = () => {
    if (!ctx || muted) return;
    const horizon = ctx.currentTime + 0.5;
    // 탭이 백그라운드였다가 돌아오면 밀린 음을 한꺼번에 치지 않고 건너뛰어요
    const behind = (ctx.currentTime - state.loopStart) / spb;
    if (behind > state.scheduledUntil + 1) state.scheduledUntil = Math.ceil(behind);
    while (state.loopStart + state.scheduledUntil * spb < horizon) {
      const from = state.scheduledUntil;
      const to = from + 1;
      const loopIndex = Math.floor(from / loopBeats);
      const base = state.loopStart + loopIndex * loopBeats * spb;
      const inLoop = (b) => b - loopIndex * loopBeats;
      for (const note of lead.notes) {
        const b = note.beat + loopIndex * loopBeats;
        if (b >= from && b < to && note.n !== '-') {
          tone({ type: tr.leadType, freq: N(note.n), dur: note.len * spb * 0.9, vol: tr.leadVol, at: base + inLoop(b) * spb - ctx.currentTime, bus: bgmBus, attack: 0.01 });
        }
      }
      for (const note of bass.notes) {
        const b = note.beat + loopIndex * loopBeats;
        if (b >= from && b < to) {
          tone({ type: 'triangle', freq: N(note.n), dur: note.len * spb * 0.8, vol: tr.bassVol, at: base + inLoop(b) * spb - ctx.currentTime, bus: bgmBus, attack: 0.01 });
        }
      }
      if (tr.drums) {
        const at = base + inLoop(from) * spb - ctx.currentTime;
        const n = ctx.createBufferSource();
        {
          n.buffer = noiseBuf;
          const g = ctx.createGain();
          const t = ctx.currentTime + at;
          g.gain.setValueAtTime(from % 2 ? 0.25 : 0.12, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = from % 2 ? 1500 : 6000;
          n.connect(f).connect(g).connect(bgmBus);
          n.start(t); n.stop(t + 0.06);
        }
      }
      state.scheduledUntil = to;
    }
  };
  state.timer = setInterval(schedule, 120);
  schedule();
  bgm = state;
}

export function stopBgm(forget = true) {
  if (forget) wantBgm = null;
  if (bgm) { clearInterval(bgm.timer); bgm = null; }
}
