// 효과음 & 배경음: 파일 없이 Web Audio로 직접 만드는 사운드 엔진
//
// 구조
//   효과음(sfxBus) ─┐                ┌→ 리버브(방 울림) ─┐
//   배경음(bgmBus) ─┼→ (보내기) ──────┘                   ├→ master → 컴프레서 → 스피커
//                   └────────────────────────────────────┘
// 배경음은 5채널(멜로디 · 화음 패드 · 아르페지오 · 베이스 · 드럼) 시퀀서로 연주하고,
// 곡이 바뀔 때는 1초 동안 겹쳐서(크로스페이드) 넘어가요.
import { isNight } from './ambience.js';

const PREF_KEY = 'meongmung.sound';
const VOL_KEY = 'meongmung.volume';
const HAPTIC_KEY = 'meongmung.haptic';

let ctx = null;
let master = null;
let sfxBus = null;
let bgmBus = null;
let reverb = null;
let muted = readPref();
let volumes = readVolumes();
let bgm = null; // 지금 흐르는 곡
let wantBgm = null;
let wantAmbience = null;
let ambTimer = null;

function readPref() {
  try { return localStorage.getItem(PREF_KEY) === 'off'; } catch { return false; }
}
function readVolumes() {
  try {
    const v = JSON.parse(localStorage.getItem(VOL_KEY) ?? 'null');
    if (v && typeof v.bgm === 'number' && typeof v.sfx === 'number') return { bgm: clamp01(v.bgm), sfx: clamp01(v.sfx) };
  } catch { /* 처음이에요 */ }
  return { bgm: 0.7, sfx: 0.85 };
}
const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

// 음량 기준값 (슬라이더 1.0일 때)
const BGM_BASE = 0.2;
const SFX_BASE = 0.42;

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(PREF_KEY, v ? 'off' : 'on'); } catch { /* 무시 */ }
  if (master) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.05);
  if (v) { stopBgm(false); stopAmbienceTimer(); } else {
    if (wantBgm) playBgm(wantBgm);
    if (wantAmbience) setAmbience(wantAmbience);
  }
}

export function getVolumes() { return { ...volumes }; }

// kind: 'bgm' | 'sfx', v: 0~1
export function setVolume(kind, v) {
  volumes[kind] = clamp01(v);
  try { localStorage.setItem(VOL_KEY, JSON.stringify(volumes)); } catch { /* 무시 */ }
  if (!ctx) return;
  if (kind === 'bgm') bgmBus.gain.setTargetAtTime(BGM_BASE * volumes.bgm, ctx.currentTime, 0.05);
  else sfxBus.gain.setTargetAtTime(SFX_BASE * volumes.sfx, ctx.currentTime, 0.05);
}

// ---------- 진동 (지원하는 기기만) ----------
let hapticOn = (() => { try { return localStorage.getItem(HAPTIC_KEY) !== 'off'; } catch { return true; } })();
export function isHapticOn() { return hapticOn; }
export function setHaptic(v) {
  hapticOn = !!v;
  try { localStorage.setItem(HAPTIC_KEY, v ? 'on' : 'off'); } catch { /* 무시 */ }
}
export function hapticSupported() { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
const HAPTICS = { tap: 8, light: 12, good: [14, 40, 14], big: [20, 50, 20, 50, 40] };
export function haptic(kind = 'light') {
  if (!hapticOn || !hapticSupported()) return;
  try { navigator.vibrate(HAPTICS[kind] ?? HAPTICS.light); } catch { /* 무시 */ }
}

// 브라우저는 사용자가 한 번 누른 뒤에만 소리를 낼 수 있어요.
// 아이폰은 앱을 나갔다 오면 소리 장치가 'interrupted'가 되거나, 'running'인데도 조용해지는 일이 있어요.
// 그래서 나갔다 돌아오면(stale) 다음 터치 때 소리 장치를 새로 만들어요.
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let stale = false;

// 방 울림: 잡음을 점점 작아지게 만든 2초짜리 "울림 지문"
function impulse(seconds = 1.8, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.2;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(comp);
  try {
    reverb = ctx.createConvolver();
    reverb.buffer = impulse();
    const ret = ctx.createGain(); ret.gain.value = 0.9;
    reverb.connect(ret).connect(master);
  } catch { reverb = null; }
  sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_BASE * volumes.sfx; sfxBus.connect(master);
  bgmBus = ctx.createGain(); bgmBus.gain.value = BGM_BASE * volumes.bgm; bgmBus.connect(master);
  if (reverb) {
    const s1 = ctx.createGain(); s1.gain.value = 0.12; sfxBus.connect(s1).connect(reverb);
    const s2 = ctx.createGain(); s2.gain.value = 0.32; bgmBus.connect(s2).connect(reverb);
  }
  noiseBuf = null;
  ensureNoise();
  return true;
}

function rebuild() {
  stopBgm(false);
  stopAmbienceTimer();
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
  if (wantAmbience && !ambTimer) setAmbience(wantAmbience);
}

// 화면을 떠나면 잠시 멈추고, 돌아오면 다시 켜요 (아이폰은 첫 터치 때 새로 만들어요)
function onHide() {
  if (!ctx) return;
  stale = true;
  stopBgm(false);
  stopAmbienceTimer();
  ctx.suspend?.().catch(() => {});
}
function onShow() {
  if (!ctx || IOS) return;
  ctx.resume().then(() => {
    if (ctx?.state === 'running') {
      stale = false;
      if (wantBgm && !bgm) playBgm(wantBgm);
      if (wantAmbience && !ambTimer) setAmbience(wantAmbience);
    }
  }).catch(() => {});
}
document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
window.addEventListener('pagehide', onHide);
window.addEventListener('pageshow', (e) => { if (e.persisted) { stale = true; onShow(); } });

const ready = () => ctx && ctx.state === 'running' && !muted;

function panNode(pan) {
  if (!pan || !ctx.createStereoPanner) return null;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  return p;
}

function tone({ type = 'square', freq = 440, to = null, dur = 0.1, vol = 0.5, at = 0, bus = sfxBus, attack = 0.005, pan = 0, lp = 0 }) {
  const t = ctx.currentTime + Math.max(0, at);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = osc;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
  node.connect(g);
  const p = panNode(pan);
  if (p) g.connect(p).connect(bus); else g.connect(bus);
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

function noise({ dur = 0.1, vol = 0.4, at = 0, freq = 2000, q = 1, type = 'bandpass', sweep = null, bus = sfxBus, pan = 0 }) {
  ensureNoise();
  const t = ctx.currentTime + Math.max(0, at);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  const p = panNode(pan);
  if (p) g.connect(p).connect(bus); else g.connect(bus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// 'C4', 'F#5', 'Bb3' → MIDI 번호
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 60;
  return (Number(m[3]) + 1) * 12 + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const N = (name) => mtof(midi(name));

// ---------- 효과음 ----------
export const sfx = {
  click() { if (ready()) tone({ type: 'square', freq: 880, to: 1320, dur: 0.05, vol: 0.14, lp: 3000 }); },
  tap() { if (ready()) { tone({ type: 'triangle', freq: 520, to: 780, dur: 0.07, vol: 0.4 }); } },
  // 탭 바꾸기: 나무 블록을 톡
  tab() {
    if (!ready()) return;
    tone({ type: 'triangle', freq: 740, to: 620, dur: 0.06, vol: 0.32 });
    noise({ dur: 0.025, vol: 0.12, freq: 3200, q: 2 });
  },
  // 창이 뿅 열려요 / 쏙 닫혀요
  open() {
    if (!ready()) return;
    tone({ type: 'sine', freq: 420, to: 840, dur: 0.1, vol: 0.32 });
    tone({ type: 'triangle', freq: N('E6'), dur: 0.12, vol: 0.08, at: 0.06 });
  },
  close() { if (ready()) tone({ type: 'sine', freq: 760, to: 380, dur: 0.09, vol: 0.26 }); },
  // 멍! (작은 강아지일수록 높은 소리) pitch: 0.8 ~ 1.4
  bark(pitch = 1, times = 1) {
    if (!ready()) return;
    for (let i = 0; i < times; i++) {
      const at = i * 0.16;
      tone({ type: 'square', freq: 700 * pitch, to: 380 * pitch, dur: 0.11, vol: 0.24, at, lp: 2600 });
      tone({ type: 'sawtooth', freq: 350 * pitch, to: 200 * pitch, dur: 0.1, vol: 0.12, at, lp: 1800 });
      noise({ dur: 0.05, vol: 0.12, freq: 1800 * pitch, at });
    }
  },
  eat() {
    if (!ready()) return;
    for (let i = 0; i < 4; i++) noise({ dur: 0.06, vol: 0.5, freq: 900 + i * 150, q: 3, at: i * 0.13, pan: i % 2 ? 0.15 : -0.15 });
    tone({ type: 'triangle', freq: N('G5'), dur: 0.12, vol: 0.18, at: 0.55 });
    tone({ type: 'triangle', freq: N('C6'), dur: 0.2, vol: 0.18, at: 0.65 });
  },
  brush() {
    if (!ready()) return;
    for (let i = 0; i < 3; i++) noise({ dur: 0.18, vol: 0.35, freq: 2500, sweep: 6000, q: 0.8, at: i * 0.2, type: 'highpass', pan: i % 2 ? 0.3 : -0.3 });
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
    haptic('light');
    if (!ready()) return;
    tone({ type: 'square', freq: N('B5'), dur: 0.07, vol: 0.2, lp: 4000 });
    tone({ type: 'square', freq: N('E6'), dur: 0.22, vol: 0.2, at: 0.07, lp: 4000 });
  },
  // 물건 사기: 짤랑 + 계산대 띵
  buy() {
    haptic('light');
    if (!ready()) return;
    noise({ dur: 0.08, vol: 0.25, freq: 5000, q: 4 });
    tone({ type: 'square', freq: N('E6'), dur: 0.07, vol: 0.16, at: 0.04, lp: 4000 });
    tone({ type: 'sine', freq: N('B6'), dur: 0.4, vol: 0.22, at: 0.11 });
    tone({ type: 'sine', freq: N('B7'), dur: 0.25, vol: 0.05, at: 0.11 });
  },
  // 옷 입기: 휙 + 반짝 세 번
  equip() {
    haptic('light');
    if (!ready()) return;
    noise({ dur: 0.16, vol: 0.2, freq: 800, sweep: 3200, q: 1.4 });
    [N('A5'), N('C#6'), N('E6')].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.12, vol: 0.22, at: 0.1 + i * 0.06, pan: (i - 1) * 0.3 }));
  },
  // 반짝반짝 (기분이 좋아요)
  sparkle() {
    if (!ready()) return;
    for (let i = 0; i < 4; i++) {
      const f = N(['E6', 'G6', 'B6', 'D7', 'E7'][Math.floor(Math.random() * 5)]);
      tone({ type: 'sine', freq: f, dur: 0.16, vol: 0.14, at: i * 0.07, pan: Math.random() * 1.2 - 0.6 });
    }
  },
  // 작은 성공 (잘했어요!)
  success() {
    haptic('good');
    if (!ready()) return;
    tone({ type: 'triangle', freq: N('G5'), dur: 0.1, vol: 0.3 });
    tone({ type: 'triangle', freq: N('C6'), dur: 0.1, vol: 0.3, at: 0.08 });
    tone({ type: 'triangle', freq: N('E6'), dur: 0.3, vol: 0.3, at: 0.16 });
    tone({ type: 'sine', freq: N('E7'), dur: 0.25, vol: 0.06, at: 0.16 });
  },
  // 중간 축하 (도장, 미션 완료, 새 장소 …)
  cheer() {
    haptic('good');
    if (!ready()) return;
    const seq = [['C5', 0], ['E5', 0.08], ['G5', 0.16], ['C6', 0.24], ['E6', 0.36]];
    seq.forEach(([n, at], i) => tone({ type: 'square', freq: N(n), dur: i === seq.length - 1 ? 0.35 : 0.1, vol: 0.15, at, lp: 3500, pan: (i - 2) * 0.12 }));
    tone({ type: 'triangle', freq: N('C4'), dur: 0.5, vol: 0.28, at: 0.36 });
    noise({ dur: 0.25, vol: 0.06, freq: 8000, type: 'highpass', at: 0.36 });
  },
  // 안내 손가락이 콕콕
  guide() {
    if (!ready()) return;
    tone({ type: 'sine', freq: N('A5'), dur: 0.25, vol: 0.22 });
    tone({ type: 'sine', freq: N('E6'), dur: 0.35, vol: 0.18, at: 0.12 });
  },
  // 하아암~ (하품)
  yawn(pitch = 1) {
    if (!ready()) return;
    tone({ type: 'triangle', freq: 560 * pitch, to: 260 * pitch, dur: 0.6, vol: 0.16, attack: 0.08, lp: 1400 });
    noise({ dur: 0.5, vol: 0.06, freq: 700, q: 0.7, at: 0.05 });
  },
  pop() { if (ready()) tone({ type: 'sine', freq: 300, to: 900, dur: 0.09, vol: 0.4 }); },
  whoosh() { if (ready()) noise({ dur: 0.3, vol: 0.3, freq: 400, sweep: 3000, q: 1.2 }); },
  jump() { if (ready()) tone({ type: 'square', freq: 300, to: 750, dur: 0.14, vol: 0.18, lp: 3000 }); },
  land() { if (ready()) noise({ dur: 0.06, vol: 0.25, freq: 300, q: 1 }); },
  slide() { if (ready()) noise({ dur: 0.25, vol: 0.25, freq: 1200, sweep: 500, q: 1 }); },
  hurt() {
    if (!ready()) return;
    tone({ type: 'square', freq: 400, to: 150, dur: 0.25, vol: 0.22, lp: 2200 });
    noise({ dur: 0.12, vol: 0.2, freq: 600 });
  },
  catch() { if (ready()) tone({ type: 'square', freq: N('A5'), to: N('E6'), dur: 0.08, vol: 0.16, lp: 4000 }); },
  star() {
    if (!ready()) return;
    [N('C6'), N('E6'), N('G6'), N('C7')].forEach((f, i) => tone({ type: 'square', freq: f, dur: 0.08, vol: 0.13, at: i * 0.05, lp: 5000, pan: (i - 1.5) * 0.2 }));
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
  // 큰 축하 (레벨업 · 성장 · 전설 뽑기) — 진짜 큰 일에만 써요
  levelUp() {
    haptic('big');
    if (!ready()) return;
    const seq = ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'];
    seq.forEach((n, i) => tone({ type: 'square', freq: N(n), dur: i === seq.length - 1 ? 0.6 : 0.1, vol: 0.17, at: i * 0.09, lp: 4000, pan: (i % 2 ? 0.2 : -0.2) }));
    seq.forEach((n, i) => tone({ type: 'triangle', freq: N(n) / 2, dur: 0.09, vol: 0.14, at: i * 0.09 }));
    ['C4', 'E4', 'G4'].forEach((n) => tone({ type: 'triangle', freq: N(n), dur: 0.9, vol: 0.18, at: 0.54 }));
    noise({ dur: 0.5, vol: 0.08, freq: 9000, type: 'highpass', at: 0.54 });
    for (let i = 0; i < 5; i++) tone({ type: 'sine', freq: N(['C7', 'E7', 'G7'][i % 3]), dur: 0.12, vol: 0.05, at: 0.6 + i * 0.06, pan: Math.random() - 0.5 });
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
  error() { if (ready()) tone({ type: 'square', freq: 220, to: 180, dur: 0.15, vol: 0.16, lp: 1800 }); },
  // 흥! (귀찮아하는 소리)
  huff() {
    if (!ready()) return;
    noise({ dur: 0.12, vol: 0.25, freq: 900, sweep: 400, q: 1 });
    tone({ type: 'triangle', freq: 520, to: 300, dur: 0.18, vol: 0.28, at: 0.05 });
  },
};

// ---------- 악기 ----------
// 모든 악기는 (주파수, 시작 시각, 길이, 음량, 출력) 을 받아 소리를 예약해요.
function env(g, t, vol, attack, dur, release, sustain = 0.75) {
  const hold = t + Math.max(attack + 0.01, dur);
  const sus = Math.max(0.0002, vol * sustain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  const dEnd = Math.min(t + attack + Math.min(0.2, dur * 0.5), hold - 0.002);
  if (dEnd > t + attack + 0.002) g.gain.exponentialRampToValueAtTime(sus, dEnd);
  g.gain.setValueAtTime(dEnd > t + attack + 0.002 ? sus : vol, hold);
  g.gain.exponentialRampToValueAtTime(0.0001, hold + release);
}
function osc(type, f, t, end, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
  o.start(t); o.stop(end);
  return o;
}
function lowpass(freq, q = 0.7) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; return f; }
function out(node, dest, pan) { const p = panNode(pan); if (p) node.connect(p).connect(dest); else node.connect(dest); }

const INSTRUMENTS = {
  // 부드러운 플루트 같은 세모파 멜로디
  soft(f, t, d, v, dest, pan) {
    const g = ctx.createGain(); env(g, t, v, 0.02, d, 0.12, 0.8);
    const lp = lowpass(2600);
    const o = osc('triangle', f, t, t + d + 0.2);
    const o2 = osc('sine', f * 2, t, t + d + 0.2); const g2 = ctx.createGain(); g2.gain.value = 0.12;
    // 살짝 떨리는 비브라토
    const lfo = osc('sine', 5.2, t, t + d + 0.2); const lg = ctx.createGain(); lg.gain.value = f * 0.004;
    lfo.connect(lg).connect(o.frequency);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g); out(g, dest, pan);
  },
  // 동글동글한 8비트 (네모파를 필터로 다듬어요)
  chip(f, t, d, v, dest, pan) {
    const g = ctx.createGain(); env(g, t, v, 0.008, d, 0.06, 0.65);
    const lp = lowpass(2400, 1);
    osc('square', f, t, t + d + 0.1).connect(lp);
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    osc('square', f, t, t + d + 0.1, 7).connect(g2).connect(lp);
    lp.connect(g); out(g, dest, pan);
  },
  // 금관 (행진곡)
  brass(f, t, d, v, dest, pan) {
    const g = ctx.createGain(); env(g, t, v, 0.03, d, 0.1, 0.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.05); lp.frequency.linearRampToValueAtTime(1500, t + 0.25);
    osc('sawtooth', f, t, t + d + 0.15).connect(lp);
    const g2 = ctx.createGain(); g2.gain.value = 0.6; osc('sawtooth', f, t, t + d + 0.15, -8).connect(g2).connect(lp);
    lp.connect(g); out(g, dest, pan);
  },
  // 오르골 (짧게 울리고 길게 사라지는 종소리)
  musicbox(f, t, d, v, dest, pan) {
    const len = Math.max(0.9, d + 0.6);
    for (const [mul, amp, dec] of [[1, 1, len], [2, 0.25, len * 0.5], [3.01, 0.12, len * 0.3], [4.2, 0.05, 0.25]]) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      osc('sine', f * mul, t, t + dec + 0.05).connect(g); out(g, dest, pan);
    }
  },
  // 통통 튕기는 기타·하프 느낌
  pluck(f, t, d, v, dest, pan) {
    const dec = Math.min(0.5, d + 0.25);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dec);
    osc('triangle', f, t, t + dec + 0.05).connect(lp);
    const g2 = ctx.createGain(); g2.gain.value = 0.3; osc('square', f, t, t + dec + 0.05).connect(g2).connect(lp);
    lp.connect(g); out(g, dest, pan);
  },
  // 포근한 화음 깔개
  pad(f, t, d, v, dest, pan) {
    const g = ctx.createGain(); env(g, t, v, Math.min(0.35, d * 0.3), d, 0.45, 0.9);
    const lp = lowpass(1100);
    osc('sawtooth', f, t, t + d + 0.5, -7).connect(lp);
    osc('sawtooth', f, t, t + d + 0.5, 7).connect(lp);
    osc('triangle', f / 2, t, t + d + 0.5).connect(lp);
    lp.connect(g); out(g, dest, pan);
  },
  bass(f, t, d, v, dest) {
    const g = ctx.createGain(); env(g, t, v, 0.008, d, 0.06, 0.7);
    const lp = lowpass(900);
    osc('triangle', f, t, t + d + 0.1).connect(lp);
    const g2 = ctx.createGain(); g2.gain.value = 0.5; osc('sine', f / 2, t, t + d + 0.1).connect(g2).connect(lp);
    lp.connect(g); g.connect(dest);
  },
  // 예전 곡(멍뭉런)을 위한 단순한 소리
  square(f, t, d, v, dest, pan) { const g = ctx.createGain(); env(g, t, v, 0.01, d, 0.04, 0.85); const lp = lowpass(3200); osc('square', f, t, t + d + 0.1).connect(lp); lp.connect(g); out(g, dest, pan); },
  triangle(f, t, d, v, dest, pan) { const g = ctx.createGain(); env(g, t, v, 0.01, d, 0.05, 0.85); osc('triangle', f, t, t + d + 0.1).connect(g); out(g, dest, pan); },
  sine(f, t, d, v, dest, pan) { const g = ctx.createGain(); env(g, t, v, 0.01, d, 0.08, 0.85); osc('sine', f, t, t + d + 0.15).connect(g); out(g, dest, pan); },
};

const DRUMS = {
  kick(t, v, dest) {
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const o = osc('sine', 140, t, t + 0.25); o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    o.connect(g).connect(dest);
  },
  snare(t, v, dest) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    src.connect(f).connect(g).connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + 0.16);
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(v * 0.6, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    const o = osc('triangle', 200, t, t + 0.1); o.frequency.exponentialRampToValueAtTime(140, t + 0.08); o.connect(g2).connect(dest);
  },
  // 손뼉 (가벼운 스네어 대신)
  clap(t, v, dest) {
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.012;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 1.2;
      const g = ctx.createGain(); g.gain.setValueAtTime(v * (i === 2 ? 1 : 0.6), s); g.gain.exponentialRampToValueAtTime(0.0001, s + (i === 2 ? 0.12 : 0.02));
      src.connect(f).connect(g).connect(dest); src.start(s, Math.random() * 0.5); src.stop(s + 0.14);
    }
  },
  hat(t, v, dest) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    const p = panNode(0.25);
    src.connect(f).connect(g); if (p) g.connect(p).connect(dest); else g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.05);
  },
  // 사각사각 셰이커
  shaker(t, v, dest) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    const p = panNode(-0.25);
    src.connect(f).connect(g); if (p) g.connect(p).connect(dest); else g.connect(dest);
    src.start(t, Math.random() * 0.5); src.stop(t + 0.1);
  },
};

// ---------- 작곡 도구 ----------
// 코드 이름 → 음정 (반음)
const QUALITY = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], 6: [0, 4, 7, 9],
};
function chordNotes(sym) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  const root = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root: ((root % 12) + 12) % 12, ivs: QUALITY[m[3]] ?? QUALITY[''] };
}
// 'A4:1 C5:0.5 -:1' → [{ m, len }]
function parseLine(str) {
  return str.trim().split(/\s+/).filter(Boolean).map((tok) => {
    const [n, l] = tok.split(':');
    return { m: n === '-' ? null : midi(n), len: Number(l ?? 1) };
  });
}
const inRange = (pc, lo) => { let m = lo + ((pc - lo) % 12 + 12) % 12; return m; };

// 곡 데이터 → 한 바퀴 동안의 음표 목록 (박자 단위)
function compile(song) {
  const meter = song.meter ?? 4;
  const events = [];
  let bar0 = 0;
  const swing = song.swing ?? 0;
  const sw = (b) => (Math.abs((b % 1) - 0.5) < 1e-6 ? b + swing : b);
  const ins = song.inst;
  for (const entry of song.form) {
    const { sec, drums = true, lead = true } = typeof entry === 'string' ? { sec: entry } : entry;
    const S = song.sections[sec];
    const bars = S.chords.split('|').map((b) => b.trim().split(',').map((c) => c.trim()));
    // 화음 · 아르페지오 · 베이스
    bars.forEach((chs, bi) => {
      const per = meter / chs.length;
      chs.forEach((sym, ci) => {
        const at = (bar0 + bi) * meter + ci * per;
        const { root, ivs } = chordNotes(sym);
        if (ins.pad) {
          const base = inRange(root, 53);
          ivs.slice(0, 4).forEach((iv) => events.push({ b: at, inst: 'pad', m: base + iv, len: per, v: ins.pad.vol, pan: 0 }));
        }
        if (ins.arp) {
          const base = inRange(root, ins.arp.lo ?? 60);
          const tones = ivs.map((iv) => base + iv);
          const pat = ins.arp.pattern ?? [0, 1, 2, 1];
          const rate = ins.arp.rate ?? 0.5;
          for (let k = 0; k * rate < per - 1e-6; k++) {
            const idx = pat[k % pat.length];
            const m = idx >= tones.length ? tones[0] + 12 : tones[idx];
            events.push({ b: sw(at + k * rate), inst: ins.arp.inst ?? 'pluck', m, len: rate, v: ins.arp.vol * (k % 2 ? 0.8 : 1), pan: ins.arp.pan ?? 0.3 });
          }
        }
        if (ins.bass) {
          const r = inRange(root, 40);
          const fifth = r + 7;
          const style = ins.bass.style ?? 'root';
          const hits = {
            root: [[0, per, r]],
            half: per >= 2 ? [[0, per / 2, r], [per / 2, per / 2, fifth - 12 >= 36 ? fifth - 12 : fifth]] : [[0, per, r]],
            rootfifth: per >= 4 ? [[0, 1, r], [1, 1, fifth], [2, 1, r + 12], [3, 1, fifth]] : per >= 2 ? [[0, 1, r], [1, 1, fifth]] : [[0, per, r]],
            octave: Array.from({ length: Math.round(per * 2) }, (_, k) => [k * 0.5, 0.45, k % 2 ? r + 12 : r]),
            waltz: [[0, 1, r], [1, 1, fifth], [2, 1, fifth]],
            march: Array.from({ length: Math.round(per) }, (_, k) => [k, 0.8, k % 2 ? fifth : r]),
          }[style];
          for (const [o, l, m] of hits) if (o < per) events.push({ b: sw(at + o), inst: 'bass', m, len: Math.min(l, per - o), v: ins.bass.vol * (style === 'waltz' && o > 0 ? 0.55 : 1) });
        }
      });
    });
    // 멜로디
    if (lead && S.melody) {
      let b = bar0 * meter;
      for (const n of parseLine(S.melody)) {
        if (n.m !== null) events.push({ b: sw(b), inst: ins.lead.inst, m: n.m + (ins.lead.shift ?? 0), len: n.len, v: ins.lead.vol, pan: ins.lead.pan ?? -0.1, lead: true });
        b += n.len;
      }
    }
    // 드럼
    if (drums && song.drums) {
      const steps = meter * 4;
      for (let bi = 0; bi < bars.length; bi++) {
        for (const [kind, pat] of Object.entries(song.drums)) {
          for (let s = 0; s < steps; s++) {
            const ch = pat[s % pat.length];
            if (ch === '-' || ch === undefined) continue;
            const acc = ch === 'X' ? 1 : ch === 'x' ? 0.75 : 0.45; // X 강하게, x 보통, . 약하게
            events.push({ b: sw((bar0 + bi) * meter + s / 4), drum: kind, v: (song.drumVol?.[kind] ?? 0.5) * acc });
          }
        }
      }
    }
    bar0 += bars.length;
  }
  events.sort((a, b) => a.b - b.b);
  return { events, length: bar0 * meter };
}

// 예전 형식(멜로디 + 베이스 목록) → 음표 목록
function compileLegacy(tr) {
  const events = [];
  let b = 0;
  for (const [n, len] of tr.lead) { if (n !== '-') events.push({ b, inst: tr.leadType, m: midi(n), len: len * 0.9, v: tr.leadVol * 0.85, pan: -0.1, lead: true }); b += len; }
  const leadLen = b;
  if (tr.bells) {
    for (const e of [...events]) events.push({ b: e.b, inst: 'musicbox', m: e.m + 12, len: 0.2, v: tr.leadVol * 0.25, pan: 0.3 });
  }
  b = 0;
  for (const [n, len] of tr.bass) { if (n !== '-') events.push({ b, inst: 'bass', m: midi(n), len: len * 0.8, v: tr.bassVol }); b += len; }
  const length = Math.max(leadLen, b);
  if (tr.drums) {
    for (let k = 0; k < length; k += 0.5) {
      const onBeat = k % 1 === 0;
      if (onBeat && k % 2 === 0) events.push({ b: k, drum: 'kick', v: 0.55 });
      if (onBeat && k % 2 === 1) events.push({ b: k, drum: 'snare', v: 0.28 });
      events.push({ b: k, drum: 'hat', v: onBeat ? 0.12 : 0.2 });
    }
  }
  events.sort((x, y) => x.b - y.b);
  return { events, length };
}

// ---------- 배경음 곡 목록 ----------
const SONGS = {
  // 🎵 타이틀: 오르골 왈츠 (3/4)
  title: {
    bpm: 100, meter: 3,
    inst: {
      lead: { inst: 'musicbox', vol: 0.42, pan: 0 },
      pad: { vol: 0.05 },
      bass: { vol: 0.32, style: 'waltz' },
    },
    sections: {
      A: {
        chords: 'C | Am | F | G | Em | Am | Dm | G',
        melody: 'E5:1 G5:1 C6:1  B5:2 A5:1  A5:1 C6:1 F6:1  E6:2 D6:1  G5:1 B5:1 E6:1  D6:2 C6:1  F5:1 A5:1 D6:1  D6:1 B5:1 G5:1',
      },
      A2: {
        chords: 'C | Am | F | G | Em | Am | G | C',
        melody: 'E5:1 G5:1 C6:1  B5:2 A5:1  A5:1 C6:1 F6:1  E6:2 D6:1  G5:1 B5:1 E6:1  D6:2 C6:1  D6:1 B5:1 G5:1  C6:3',
      },
      B: {
        chords: 'F | G | Em | Am | F | G | C | C',
        melody: 'C6:2 A5:1  B5:2 G5:1  G5:1 B5:1 E6:1  E6:2 C6:1  A5:1 C6:1 F6:1  F6:1 E6:1 D6:1  E6:1 D6:1 C6:1  C6:2 -:1',
      },
    },
    form: ['A', 'A2', 'B', 'A2'],
  },
  // 🏠 우리집 (낮): 느긋한 F장조 어쿠스틱 팝
  home: {
    bpm: 94, swing: 0.06,
    inst: {
      lead: { inst: 'soft', vol: 0.36, pan: -0.1 },
      pad: { vol: 0.045 },
      arp: { inst: 'pluck', vol: 0.13, rate: 0.5, pattern: [0, 2, 1, 2], pan: 0.35 },
      bass: { vol: 0.34, style: 'half' },
    },
    drums: { kick: 'x-------x-------', snare: '------------.---', shaker: '--x---x---x---x-' },
    drumVol: { kick: 0.4, snare: 0.12, shaker: 0.1 },
    sections: {
      A: {
        chords: 'F | C | Dm | Bb | F | C | Bb | C',
        melody: 'A4:1 C5:1 F5:1.5 E5:0.5  E5:1 D5:0.5 C5:0.5 G4:2  A4:1 D5:1 F5:1.5 A5:0.5  G5:1 F5:0.5 D5:0.5 F5:2  A4:1 C5:1 F5:1.5 E5:0.5  E5:1 G5:0.5 E5:0.5 C5:2  D5:1 F5:1 A5:1 G5:0.5 F5:0.5  E5:2 G5:2',
      },
      A2: {
        chords: 'F | C | Dm | Bb | F | C | Bb,C | F',
        melody: 'A4:1 C5:1 F5:1.5 E5:0.5  E5:1 D5:0.5 C5:0.5 G4:2  A4:1 D5:1 F5:1.5 A5:0.5  G5:1 F5:0.5 D5:0.5 F5:2  A4:1 C5:1 F5:1.5 E5:0.5  E5:1 G5:0.5 E5:0.5 C5:2  D5:1 F5:1 E5:1 G5:1  F5:3 -:1',
      },
      B: {
        chords: 'Dm | Am | Bb | F | Dm | Am | Gm | C7',
        melody: 'F5:1.5 E5:0.5 D5:1 A4:1  C5:1 E5:1 A5:2  G5:1 F5:1 D5:1 Bb4:1  C5:2 A4:2  D5:1 F5:1 A5:1.5 G5:0.5  E5:1 A5:1 C6:2  Bb5:1 A5:1 G5:1 D5:1  E5:1 G5:1 Bb5:1 G5:0.5 E5:0.5',
      },
    },
    form: [{ sec: 'A', drums: false }, 'A2', 'B', 'A2'],
  },
  // 🌙 우리집 (밤): 오르골 자장가
  home_night: {
    bpm: 70,
    inst: {
      lead: { inst: 'musicbox', vol: 0.36, pan: 0 },
      pad: { vol: 0.05 },
      arp: { inst: 'musicbox', vol: 0.07, rate: 1, pattern: [0, 1, 2, 1], lo: 67, pan: 0.4 },
      bass: { vol: 0.22, style: 'root' },
    },
    sections: {
      A: {
        chords: 'C | Em | F | C | Am | Dm | G | C',
        melody: 'E5:2 G5:2  G5:1 E5:1 B4:2  A4:1 C5:1 F5:2  E5:4  C5:1 E5:1 A5:2  F5:1 E5:1 D5:2  B4:1 D5:1 G5:1 F5:1  E5:2 C5:2',
      },
      B: {
        chords: 'F | C | F | C | Dm | Am | F,G | C',
        melody: 'A5:2 C6:2  G5:2 E5:2  F5:1 A5:1 C6:1 A5:1  G5:4  F5:2 D5:2  E5:2 C5:2  A4:2 B4:2  C5:4',
      },
    },
    form: ['A', 'B', 'A', { sec: 'B', lead: false }],
  },
  // 🌳 멍뭉 놀이터: 통통 튀는 셔플
  plaza: {
    bpm: 118, swing: 0.14,
    inst: {
      lead: { inst: 'chip', vol: 0.2, pan: -0.15 },
      pad: { vol: 0.03 },
      arp: { inst: 'pluck', vol: 0.09, rate: 0.5, pattern: [0, 1, 2, 3], pan: 0.35 },
      bass: { vol: 0.32, style: 'octave' },
    },
    drums: { kick: 'x-----x-x-------', clap: '----x-------x---', hat: 'x.x.x.x.x.x.x.x.' },
    drumVol: { kick: 0.45, clap: 0.18, hat: 0.1 },
    sections: {
      A: {
        chords: 'G | Em | C | D | G | Em | C,D | G',
        melody: 'D5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 D5:1  E5:0.5 G5:0.5 B5:1 G5:1 E5:1  E5:0.5 G5:0.5 C6:1 B5:0.5 A5:0.5 G5:1  F#5:1 A5:1 D5:2  D5:0.5 G5:0.5 B5:1 D6:1 B5:1  E6:1 D6:0.5 B5:0.5 G5:2  E5:1 G5:1 F#5:1 A5:1  G5:2 -:2',
      },
      B: {
        chords: 'C | D | Bm | Em | Am | D | G,Em | Am,D',
        melody: 'E5:1 G5:0.5 E5:0.5 C5:2  F#5:1 A5:0.5 F#5:0.5 D5:2  B4:0.5 D5:0.5 F#5:1 B5:1 A5:1  G5:1 E5:1 B4:2  C5:0.5 E5:0.5 A5:1 G5:0.5 E5:0.5 C5:1  D5:0.5 F#5:0.5 A5:1 C6:1 A5:1  B5:1 G5:1 E5:1 G5:1  A5:1 C6:1 B5:0.5 A5:0.5 F#5:1',
      },
    },
    form: ['A', 'B', 'A', { sec: 'B', drums: false }],
  },
  // 🎓 훈련 수업: 경쾌한 행진곡
  school: {
    bpm: 116,
    inst: {
      lead: { inst: 'brass', vol: 0.2, pan: -0.1 },
      pad: { vol: 0.035 },
      arp: { inst: 'pluck', vol: 0.08, rate: 0.5, pattern: [0, 2, 1, 2], pan: 0.3 },
      bass: { vol: 0.3, style: 'march' },
    },
    drums: { kick: 'x-------x-------', snare: '----x--.----x.xx', hat: '--x---x---x---x-' },
    drumVol: { kick: 0.42, snare: 0.18, hat: 0.07 },
    sections: {
      A: {
        chords: 'D | A | D | G,A | D | Bm | Em,A | D',
        melody: 'A4:1 D5:1 F#5:1 A5:1  E5:1.5 C#5:0.5 A4:2  F#5:1 A5:1 D6:1.5 A5:0.5  B5:1 G5:1 E5:1 C#5:1  D5:1 F#5:0.5 A5:0.5 D6:1 A5:1  B5:1.5 A5:0.5 F#5:1 D5:1  G5:1 B5:1 A5:1 C#6:1  D6:2 -:2',
      },
      B: {
        chords: 'G | D | A | D | G | D | Em | A',
        melody: 'B5:1 G5:1 D5:2  A5:1 F#5:1 D5:2  C#5:1 E5:1 A5:2  F#5:1 A5:0.5 F#5:0.5 D5:2  G5:0.5 A5:0.5 B5:1 D6:1 B5:1  A5:1 F#5:1 D5:1 F#5:1  G5:1 B5:1 E5:1 G5:1  A5:2 E5:2',
      },
    },
    form: ['A', 'B', 'A', { sec: 'B', lead: false }],
  },
  // 🎮 놀이 (미니게임 · 협동): 신나는 업템포
  play: {
    bpm: 148,
    inst: {
      lead: { inst: 'chip', vol: 0.2, pan: -0.1 },
      pad: { vol: 0.03 },
      arp: { inst: 'pluck', vol: 0.08, rate: 0.5, pattern: [0, 1, 2, 1], pan: 0.35 },
      bass: { vol: 0.3, style: 'octave' },
    },
    drums: { kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' },
    drumVol: { kick: 0.42, snare: 0.18, hat: 0.1 },
    sections: {
      A: {
        chords: 'C | F,G | Am,Em | G,C',
        melody: 'C5:0.5 E5:0.5 G5:0.5 E5:0.5 C6:1 G5:1  A5:0.5 G5:0.5 F5:0.5 E5:0.5 D5:2  E5:0.5 F5:0.5 G5:0.5 A5:0.5 G5:1 E5:1  F5:0.5 E5:0.5 D5:0.5 B4:0.5 C5:2',
      },
      B: {
        chords: 'F | G | Em | Am | F | G | C | C',
        melody: 'A5:0.5 C6:0.5 A5:0.5 F5:0.5 C6:1 A5:1  B5:0.5 D6:0.5 B5:0.5 G5:0.5 D6:2  G5:0.5 B5:0.5 E6:1 D6:0.5 B5:0.5 G5:1  A5:0.5 C6:0.5 E6:1 C6:1 A5:1  F5:0.5 A5:0.5 C6:0.5 A5:0.5 F5:1 C6:1  D6:1 B5:1 G5:1 D6:1  E6:1 C6:0.5 G5:0.5 E5:1 G5:1  C6:2 -:2',
      },
    },
    form: ['A', 'A', 'B', 'A'],
  },
};

// 🏃 멍뭉런 전용 곡 (맵마다 달라요). 구간이 오를수록 setBgmTempo로 빨라져요.
const LEGACY = {
  // 초록 들판: 통통 튀는 F장조
  run_meadow: {
    bpm: 144,
    lead: [
      ['F5', 0.5], ['A5', 0.5], ['C6', 0.5], ['A5', 0.5], ['F5', 0.5], ['C6', 0.5], ['D6', 1],
      ['C6', 0.5], ['A5', 0.5], ['G5', 0.5], ['A5', 0.5], ['F5', 2],
      ['G5', 0.5], ['A5', 0.5], ['A#5', 0.5], ['C6', 0.5], ['D6', 0.5], ['C6', 0.5], ['A#5', 0.5], ['A5', 0.5],
      ['G5', 0.5], ['E5', 0.5], ['F5', 0.5], ['G5', 0.5], ['C6', 1], ['-', 1],
      ['A5', 0.5], ['C6', 0.5], ['F6', 0.5], ['C6', 0.5], ['D6', 0.5], ['C6', 0.5], ['A5', 1],
      ['A#5', 0.5], ['A5', 0.5], ['G5', 0.5], ['F5', 0.5], ['G5', 2],
      ['F5', 0.5], ['G5', 0.5], ['A5', 0.5], ['C6', 0.5], ['A#5', 0.5], ['A5', 0.5], ['G5', 0.5], ['E5', 0.5],
      ['F5', 1], ['C5', 0.5], ['F5', 0.5], ['F5', 1], ['-', 1],
    ],
    bass: [
      ['F2', 1], ['C3', 1], ['F2', 1], ['C3', 1], ['A#2', 1], ['F3', 1], ['F2', 1], ['C3', 1],
      ['A#2', 1], ['D3', 1], ['F2', 1], ['A2', 1], ['C3', 1], ['G2', 1], ['C3', 1], ['E3', 1],
      ['F2', 1], ['C3', 1], ['D3', 1], ['A2', 1], ['A#2', 1], ['F3', 1], ['C3', 1], ['G2', 1],
      ['A#2', 1], ['C3', 1], ['A2', 1], ['D3', 1], ['C3', 1], ['C3', 1], ['F2', 1], ['C3', 1],
    ],
    leadType: 'chip', leadVol: 0.26, bassVol: 0.36, drums: true,
  },
  // 햇살 바닷가: 찰랑찰랑 엇박자 G장조
  run_beach: {
    bpm: 132,
    lead: [
      ['D5', 0.5], ['G5', 1], ['B5', 0.5], ['-', 0.5], ['A5', 0.5], ['G5', 1],
      ['E5', 0.5], ['G5', 1], ['A5', 0.5], ['-', 0.5], ['B5', 1.5],
      ['C6', 0.5], ['B5', 0.5], ['A5', 0.5], ['G5', 1], ['E5', 0.5], ['D5', 1],
      ['E5', 0.5], ['F#5', 0.5], ['G5', 0.5], ['A5', 0.5], ['D5', 2],
      ['D5', 0.5], ['G5', 1], ['B5', 0.5], ['-', 0.5], ['D6', 0.5], ['B5', 1],
      ['C6', 0.5], ['E6', 1], ['C6', 0.5], ['-', 0.5], ['B5', 1.5],
      ['A5', 0.5], ['B5', 0.5], ['C6', 0.5], ['B5', 0.5], ['A5', 0.5], ['F#5', 0.5], ['D5', 1],
      ['G5', 1.5], ['B4', 0.5], ['G5', 1], ['-', 1],
    ],
    bass: [
      ['G2', 1.5], ['D3', 0.5], ['G2', 1], ['B2', 1], ['C3', 1.5], ['G3', 0.5], ['C3', 1], ['E3', 1],
      ['D3', 1.5], ['A2', 0.5], ['D3', 1], ['F#3', 1], ['G2', 1.5], ['D3', 0.5], ['D3', 1], ['D2', 1],
      ['G2', 1.5], ['D3', 0.5], ['G2', 1], ['B2', 1], ['C3', 1.5], ['G3', 0.5], ['C3', 1], ['E3', 1],
      ['D3', 1.5], ['A2', 0.5], ['D3', 1], ['F#3', 1], ['G2', 1.5], ['D3', 0.5], ['G2', 2],
    ],
    leadType: 'soft', leadVol: 0.4, bassVol: 0.38, drums: true,
  },
  // 눈꽃 마을: 방울 소리 짤랑짤랑 A단조 → C장조
  run_snow: {
    bpm: 138,
    lead: [
      ['E6', 0.5], ['E6', 0.5], ['E6', 1], ['E6', 0.5], ['E6', 0.5], ['E6', 1],
      ['E6', 0.5], ['G6', 0.5], ['C6', 0.75], ['D6', 0.25], ['E6', 2],
      ['F6', 0.5], ['F6', 0.5], ['F6', 0.75], ['F6', 0.25], ['F6', 0.5], ['E6', 0.5], ['E6', 0.5], ['E6', 0.5],
      ['E6', 0.5], ['D6', 0.5], ['D6', 0.5], ['E6', 0.5], ['D6', 1], ['G6', 1],
      ['A5', 0.5], ['C6', 0.5], ['E6', 0.5], ['C6', 0.5], ['B5', 0.5], ['D6', 0.5], ['G6', 1],
      ['A6', 0.5], ['G6', 0.5], ['E6', 0.5], ['C6', 0.5], ['D6', 2],
      ['C6', 0.5], ['E6', 0.5], ['A6', 0.5], ['G6', 0.5], ['F6', 0.5], ['E6', 0.5], ['D6', 0.5], ['B5', 0.5],
      ['C6', 1.5], ['G5', 0.5], ['C6', 1], ['-', 1],
    ],
    bass: [
      ['C3', 1], ['G3', 1], ['C3', 1], ['G3', 1], ['C3', 1], ['E3', 1], ['G3', 1], ['C3', 1],
      ['F3', 1], ['C3', 1], ['C3', 1], ['G3', 1], ['G2', 1], ['D3', 1], ['G2', 1], ['B2', 1],
      ['A2', 1], ['E3', 1], ['G2', 1], ['D3', 1], ['F2', 1], ['C3', 1], ['G2', 1], ['D3', 1],
      ['A2', 1], ['F3', 1], ['G2', 1], ['G2', 1], ['C3', 1], ['G2', 1], ['C3', 2],
    ],
    leadType: 'sine', leadVol: 0.42, bassVol: 0.36, drums: true, bells: true,
  },
  // 사탕 나라: 뿅뿅 달콤한 E장조
  run_candy: {
    bpm: 152,
    lead: [
      ['B5', 0.5], ['G#5', 0.5], ['E5', 0.5], ['G#5', 0.5], ['B5', 0.5], ['E6', 0.5], ['D#6', 0.5], ['B5', 0.5],
      ['C#6', 0.5], ['B5', 0.5], ['A5', 0.5], ['G#5', 0.5], ['F#5', 2],
      ['A5', 0.5], ['F#5', 0.5], ['D#5', 0.5], ['F#5', 0.5], ['A5', 0.5], ['D#6', 0.5], ['C#6', 0.5], ['A5', 0.5],
      ['B5', 0.5], ['A5', 0.5], ['G#5', 0.5], ['F#5', 0.5], ['E5', 2],
      ['E6', 0.5], ['B5', 0.5], ['G#5', 0.5], ['B5', 0.5], ['E6', 0.5], ['F#6', 0.5], ['G#6', 1],
      ['F#6', 0.5], ['E6', 0.5], ['D#6', 0.5], ['C#6', 0.5], ['B5', 2],
      ['C#6', 0.5], ['D#6', 0.5], ['E6', 0.5], ['C#6', 0.5], ['B5', 0.5], ['A5', 0.5], ['G#5', 0.5], ['F#5', 0.5],
      ['E5', 1], ['B4', 0.5], ['E5', 0.5], ['E5', 1], ['-', 1],
    ],
    bass: [
      ['E2', 0.5], ['E3', 0.5], ['B2', 0.5], ['E3', 0.5], ['E2', 0.5], ['E3', 0.5], ['B2', 0.5], ['E3', 0.5],
      ['A2', 0.5], ['A3', 0.5], ['E3', 0.5], ['A3', 0.5], ['B2', 0.5], ['B3', 0.5], ['F#3', 0.5], ['B3', 0.5],
      ['B2', 0.5], ['B3', 0.5], ['F#3', 0.5], ['B3', 0.5], ['B2', 0.5], ['B3', 0.5], ['F#3', 0.5], ['B3', 0.5],
      ['B2', 0.5], ['B3', 0.5], ['F#3', 0.5], ['B3', 0.5], ['E2', 0.5], ['E3', 0.5], ['B2', 0.5], ['E3', 0.5],
      ['E2', 0.5], ['E3', 0.5], ['B2', 0.5], ['E3', 0.5], ['C#3', 0.5], ['C#4', 0.5], ['G#3', 0.5], ['C#4', 0.5],
      ['A2', 0.5], ['A3', 0.5], ['E3', 0.5], ['A3', 0.5], ['B2', 0.5], ['B3', 0.5], ['F#3', 0.5], ['B3', 0.5],
      ['A2', 0.5], ['A3', 0.5], ['B2', 0.5], ['B3', 0.5], ['C#3', 0.5], ['C#4', 0.5], ['D#3', 0.5], ['D#4', 0.5],
      ['E2', 0.5], ['E3', 0.5], ['B2', 0.5], ['E3', 0.5], ['E2', 1], ['-', 1],
    ],
    leadType: 'chip', leadVol: 0.22, bassVol: 0.34, drums: true,
  },
};

const compiled = {};
function getSong(name) {
  if (!compiled[name]) {
    if (SONGS[name]) compiled[name] = { bpm: SONGS[name].bpm, ...compile(SONGS[name]) };
    else if (LEGACY[name]) compiled[name] = { bpm: LEGACY[name].bpm, ...compileLegacy(LEGACY[name]) };
  }
  return compiled[name] ?? null;
}
export const BGM_NAMES = [...Object.keys(SONGS), ...Object.keys(LEGACY)];

// ---------- 배경음 재생 ----------
// 빠르기(tempo 배수)와 음높이(반음)를 곡이 흐르는 중에도 바꿀 수 있어요
let tempo = 1;
let semis = 0;

export function setBgmTempo(mult = 1, shift = 0) {
  tempo = mult; semis = shift;
  if (!bgm || !ctx) return;
  // 지금까지 예약한 박자에서 새 빠르기로 이어 가요 (끊김 없이)
  bgm.anchorTime = bgm.beatTime(bgm.lastBeat);
  bgm.anchorBeat = bgm.lastBeat;
  bgm.spb = 60 / (bgm.song.bpm * tempo);
}

const FADE = 0.9;

export function playBgm(name) {
  if (name !== wantBgm) { tempo = 1; semis = 0; }
  wantBgm = name;
  // 우리집 곡은 밤(9시~아침 6시)이 되면 자장가로 바뀌고, 새소리 대신 귀뚜라미가 울어요
  const real = name === 'home' && isNight() ? 'home_night' : name;
  const amb = real === 'home' ? 'day' : real === 'home_night' ? 'night' : null;
  if (amb !== wantAmbience) setAmbience(amb);
  if (!ctx || muted) return;
  if (bgm?.name === real) return;
  name = real;
  const song = getSong(name) ?? getSong('play');
  // 앞 곡은 천천히 작아지며 사라져요
  if (bgm) fadeOut(bgm);
  const gain = ctx.createGain();
  const start = ctx.currentTime + 0.08;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(1, start + (bgm === null ? 0.25 : FADE));
  gain.connect(bgmBus);
  // 멜로디에만 살짝 메아리
  let leadOut = gain;
  try {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = Math.min(0.9, (60 / song.bpm) * 0.75);
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    const wet = ctx.createGain(); wet.gain.value = 0.22;
    const lp = lowpass(2400);
    leadOut = ctx.createGain();
    leadOut.connect(gain);
    leadOut.connect(delay); delay.connect(lp).connect(fb).connect(delay); lp.connect(wet).connect(gain);
  } catch { /* 메아리 없이 */ }
  const st = {
    name: SONGS[name] || LEGACY[name] ? name : 'play',
    song, gain, leadOut,
    anchorTime: start, anchorBeat: 0, spb: 60 / (song.bpm * tempo),
    idx: 0, loop: 0, lastBeat: 0,
  };
  st.beatTime = (b) => st.anchorTime + (b - st.anchorBeat) * st.spb;
  const schedule = () => {
    if (!ctx || muted || !song.events.length) return;
    const now = ctx.currentTime;
    const horizon = now + 0.4;
    const L = song.length;
    // 탭이 백그라운드였다가 돌아오면 밀린 음을 한꺼번에 치지 않고 건너뛰어요
    const curBeat = st.anchorBeat + (now - st.anchorTime) / st.spb;
    let guard = 0;
    while (song.events[st.idx].b + st.loop * L < curBeat - 0.25 && guard++ < 5000) {
      st.idx++; if (st.idx >= song.events.length) { st.idx = 0; st.loop++; }
    }
    guard = 0;
    while (guard++ < 400) {
      const ev = song.events[st.idx];
      const abs = ev.b + st.loop * L;
      const t = st.beatTime(abs);
      if (t > horizon) break;
      playEvent(ev, Math.max(t, now), st);
      st.lastBeat = abs;
      st.idx++; if (st.idx >= song.events.length) { st.idx = 0; st.loop++; }
    }
  };
  st.timer = setInterval(schedule, 100);
  schedule();
  bgm = st;
}

function playEvent(ev, t, st) {
  if (ev.drum) { DRUMS[ev.drum]?.(t, ev.v, st.gain); return; }
  const f = mtof(ev.m + semis);
  const d = Math.max(0.05, ev.len * st.spb * (ev.inst === 'pad' ? 1 : 0.92));
  (INSTRUMENTS[ev.inst] ?? INSTRUMENTS.triangle)(f, t, d, ev.v, ev.lead ? st.leadOut : st.gain, ev.pan ?? 0);
}

function fadeOut(st) {
  clearInterval(st.timer);
  try {
    const now = ctx.currentTime;
    st.gain.gain.cancelScheduledValues(now);
    st.gain.gain.setValueAtTime(Math.max(0.0001, st.gain.gain.value), now);
    st.gain.gain.exponentialRampToValueAtTime(0.0001, now + FADE);
    setTimeout(() => { try { st.gain.disconnect(); } catch { /* 이미 끊겼어요 */ } }, (FADE + 2.5) * 1000);
  } catch { /* 무시 */ }
}

export function stopBgm(forget = true) {
  if (forget) wantBgm = null;
  if (bgm) {
    if (ctx && ctx.state === 'running' && !muted) fadeOut(bgm);
    else { clearInterval(bgm.timer); try { bgm.gain.disconnect(); } catch { /* 무시 */ } }
    bgm = null;
  }
}

export function currentBgm() { return wantBgm; }

// 시간이 흘러 낮↔밤이 바뀌었으면 곡을 바꿔요 (1분마다 불러 주세요)
export function refreshBgm() { if (wantBgm) playBgm(wantBgm); }

// ---------- 환경음 ----------
// 'day': 가끔 짹짹 새소리 · 'night': 귀뚤귀뚤 귀뚜라미 · null: 조용히
function stopAmbienceTimer() { if (ambTimer) { clearInterval(ambTimer); ambTimer = null; } }

function chirp() {
  const pan = Math.random() * 1.6 - 0.8;
  const base = 2600 + Math.random() * 1400;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    tone({ type: 'sine', freq: base, to: base * (1.25 + Math.random() * 0.3), dur: 0.07, vol: 0.05, at: i * (0.09 + Math.random() * 0.04), bus: bgmBus, pan, attack: 0.01 });
  }
}
function cricket() {
  const pan = Math.random() * 1.4 - 0.7;
  const f = 4200 + Math.random() * 500;
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) tone({ type: 'sine', freq: f, dur: 0.025, vol: 0.018, at: r * 0.32 + i * 0.045, bus: bgmBus, pan, attack: 0.004 });
  }
}

export function setAmbience(kind) {
  wantAmbience = kind;
  stopAmbienceTimer();
  if (!kind || !ctx || muted) return;
  ambTimer = setInterval(() => {
    if (!ready() || document.hidden) return;
    if (kind === 'day' && Math.random() < 0.18) chirp();
    if (kind === 'night' && Math.random() < 0.45) cricket();
  }, 1000);
}

// 자동 테스트용: 지금 소리 크기 재기 (주소에 ?debug 가 있을 때만)
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  window.__audio = {
    get ctx() { return ctx; },
    meter() {
      if (!ctx) return null;
      const an = ctx.createAnalyser(); an.fftSize = 2048; master.connect(an);
      return () => { const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let pk = 0; let s = 0; for (const x of d) { pk = Math.max(pk, Math.abs(x)); s += x * x; } return { peak: pk, rms: Math.sqrt(s / d.length) }; };
    },
    // 곡마다 마디 수와 멜로디 박자가 맞는지 확인해요
    check: () => Object.entries(SONGS).flatMap(([n, song]) => Object.entries(song.sections).map(([k, S]) => {
      const bars = S.chords.split('|').length * (song.meter ?? 4);
      const mel = parseLine(S.melody).reduce((a, x) => a + x.len, 0);
      return { n, k, bars, mel, ok: bars === mel };
    })),
    songs: () => BGM_NAMES.map((n) => ({ n, beats: getSong(n)?.length, events: getSong(n)?.events.length })),
  };
}
