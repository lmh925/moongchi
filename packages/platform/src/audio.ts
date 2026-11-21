// 🔊 모든 게임이 같이 쓰는 소리 엔진
// - 배경음: 음원 파일(OGG/M4A)을 Web Audio로 끊김 없이 반복, 곡이 바뀌면 크로스페이드
// - 효과음: 파일 없이 합성 (가볍고 즉시 재생)
// - 음량: 배경음/효과음 따로, 기기에 저장
import { store } from './storage';

export interface BgmTrack {
  /** 파일 경로 (확장자 없이). 예: 'assets/bgm/bgm_home_day' */
  src: string;
  /** 한 바퀴 길이(초). 이 지점에서 처음으로 돌아가요 (인코더가 붙인 꼬리 무음 제거) */
  loop: number;
}

type Vol = { bgm: number; sfx: number; muted: boolean };
const VOL_KEY = 'platform.volume';

let ctx: AudioContext | null = null;
let master: GainNode;
let bgmBus: GainNode;
let sfxBus: GainNode;
let vol: Vol = store.get<Vol>(VOL_KEY, { bgm: 0.7, sfx: 0.85, muted: false });
const tracks = new Map<string, BgmTrack>();
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: { name: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
let wanted: string | null = null;
let ext: 'ogg' | 'mp3' = 'ogg';

function build(): boolean {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12; comp.ratio.value = 3;
  comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = vol.muted ? 0 : 1; master.connect(comp);
  bgmBus = ctx.createGain(); bgmBus.gain.value = vol.bgm; bgmBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx * 0.5; sfxBus.connect(master);
  const probe = document.createElement('audio');
  ext = probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  return true;
}

/** 첫 터치 때 불러 주세요 (브라우저는 사용자가 누른 뒤에만 소리를 내요) */
export function unlockAudio(): void {
  if (!ctx && !build()) return;
  if (ctx!.state !== 'running') ctx!.resume().catch(() => {});
  if (wanted && !current) void playBgm(wanted);
}

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else ctx.resume().catch(() => {});
});

export function registerBgm(list: Record<string, BgmTrack>): void {
  for (const [k, v] of Object.entries(list)) tracks.set(k, v);
}

function load(name: string): Promise<AudioBuffer | null> {
  if (!buffers.has(name)) {
    const t = tracks.get(name);
    buffers.set(name, !t || !ctx ? Promise.resolve(null) : fetch(`${t.src}.${ext}`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx!.decodeAudioData(b))
      .catch(() => null));
  }
  return buffers.get(name)!;
}

/** 미리 받아 두기 (다음 장면 곡) */
export function preloadBgm(name: string): void { if (ctx) void load(name); }

const FADE = 1.0;

export async function playBgm(name: string): Promise<void> {
  wanted = name;
  if (!ctx || current?.name === name) return;
  const buf = await load(name);
  if (!buf || wanted !== name || current?.name === name) return;
  const t = tracks.get(name)!;
  const now = ctx.currentTime;
  if (current) {
    const old = current;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + FADE);
    old.src.stop(now + FADE + 0.05);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = Math.min(t.loop, buf.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + (current ? FADE : 0.4));
  src.connect(gain).connect(bgmBus);
  src.start(now);
  current = { name, src, gain };
}

export function stopBgm(): void {
  wanted = null;
  if (!ctx || !current) return;
  const now = ctx.currentTime;
  current.gain.gain.linearRampToValueAtTime(0, now + 0.5);
  current.src.stop(now + 0.6);
  current = null;
}

export function getVolume(): Vol { return { ...vol }; }
export function setVolume(patch: Partial<Vol>): void {
  vol = { ...vol, ...patch };
  store.set(VOL_KEY, vol);
  if (!ctx) return;
  const t = ctx.currentTime;
  bgmBus.gain.setTargetAtTime(vol.bgm, t, 0.05);
  sfxBus.gain.setTargetAtTime(vol.sfx * 0.5, t, 0.05);
  master.gain.setTargetAtTime(vol.muted ? 0 : 1, t, 0.05);
}

// ---------- 효과음 (합성) ----------
const ready = () => !!ctx && ctx.state === 'running' && !vol.muted;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const N = (n: string) => { const m = /^([A-G])(#?)(\d)$/.exec(n)!; return mtof((+m[3] + 1) * 12 + NOTE[m[1]] + (m[2] ? 1 : 0)); };

function tone(o: { type?: OscillatorType; f: number; to?: number; dur: number; vol: number; at?: number; attack?: number }) {
  const c = ctx!;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack ?? 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(sfxBus);
  osc.start(t); osc.stop(t + o.dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(o: { dur: number; vol: number; f: number; q?: number; at?: number; type?: BiquadFilterType; sweep?: number }) {
  const c = ctx!;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + (o.at ?? 0);
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = o.type ?? 'bandpass'; f.frequency.setValueAtTime(o.f, t); f.Q.value = o.q ?? 1;
  if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur);
  const g = c.createGain(); g.gain.setValueAtTime(o.vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + o.dur + 0.02);
}

export const sfx = {
  tap() { if (ready()) tone({ f: 620, to: 880, dur: 0.07, vol: 0.35 }); },
  tab() { if (ready()) { tone({ f: 740, to: 620, dur: 0.06, vol: 0.3 }); noise({ dur: 0.025, vol: 0.1, f: 3200, q: 2 }); } },
  open() { if (ready()) { tone({ type: 'sine', f: 420, to: 840, dur: 0.1, vol: 0.3 }); tone({ f: N('E6'), dur: 0.12, vol: 0.08, at: 0.06 }); } },
  close() { if (ready()) tone({ type: 'sine', f: 760, to: 380, dur: 0.09, vol: 0.24 }); },
  bark(pitch = 1) {
    if (!ready()) return;
    tone({ type: 'square', f: 700 * pitch, to: 380 * pitch, dur: 0.11, vol: 0.18 });
    tone({ type: 'sawtooth', f: 350 * pitch, to: 200 * pitch, dur: 0.1, vol: 0.08 });
    noise({ dur: 0.05, vol: 0.1, f: 1800 * pitch });
  },
  eat() {
    if (!ready()) return;
    for (let i = 0; i < 4; i++) noise({ dur: 0.06, vol: 0.45, f: 900 + i * 150, q: 3, at: i * 0.13 });
    tone({ f: N('G5'), dur: 0.12, vol: 0.16, at: 0.55 }); tone({ f: N('C6'), dur: 0.2, vol: 0.16, at: 0.65 });
  },
  brush() {
    if (!ready()) return;
    for (let i = 0; i < 3; i++) noise({ dur: 0.18, vol: 0.3, f: 2500, sweep: 6000, q: 0.8, at: i * 0.2, type: 'highpass' });
    ['E6', 'G6', 'C7'].forEach((n, i) => tone({ type: 'sine', f: N(n), dur: 0.15, vol: 0.16, at: 0.45 + i * 0.07 }));
  },
  pet() { if (ready()) ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone({ f: N(n), dur: 0.2, vol: 0.28, at: i * 0.07 })); },
  coin() { if (ready()) { tone({ type: 'square', f: N('B5'), dur: 0.07, vol: 0.14 }); tone({ type: 'square', f: N('E6'), dur: 0.22, vol: 0.14, at: 0.07 }); } },
  sparkle() { if (ready()) for (let i = 0; i < 4; i++) tone({ type: 'sine', f: N(['E6', 'G6', 'B6', 'D7'][i]), dur: 0.16, vol: 0.1, at: i * 0.06 }); },
  cheer() {
    if (!ready()) return;
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => tone({ type: 'square', f: N(n), dur: i === 4 ? 0.35 : 0.1, vol: 0.1, at: i * 0.08 }));
    tone({ f: N('C4'), dur: 0.5, vol: 0.24, at: 0.32 });
  },
  error() { if (ready()) tone({ type: 'square', f: 220, to: 180, dur: 0.15, vol: 0.12 }); },
};
