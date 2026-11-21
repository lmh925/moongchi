// 🌗 한국 시간 기준 낮·밤과 날씨 (모든 기기에서 같은 날씨)
// 테스트: 주소에 ?hour=22&weather=snow
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const FORCE_HOUR = q.has('hour') ? Number(q.get('hour')) : null;
const FORCE_WEATHER = q.get('weather');

export type Weather = 'clear' | 'snow' | 'rain' | 'petals' | 'leaves';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function kstClock(now = Date.now()) {
  const t = new Date(now + 9 * 3600_000);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), hour: FORCE_HOUR ?? t.getUTCHours() + t.getUTCMinutes() / 60 };
}

export function season(mo: number): Season {
  if (mo === 12 || mo <= 2) return 'winter';
  if (mo <= 5) return 'spring';
  if (mo <= 8) return 'summer';
  return 'autumn';
}

function dayHash(y: number, mo: number, d: number) {
  let h = Math.imul(y * 372 + mo * 31 + d, 2654435761);
  h = (h ^ (h >>> 15)) >>> 0;
  return (h % 1000) / 1000;
}

export function weatherToday(now = Date.now()): Weather {
  if (FORCE_WEATHER) return FORCE_WEATHER as Weather;
  const { y, mo, d } = kstClock(now);
  const r = dayHash(y, mo, d);
  switch (season(mo)) {
    case 'winter': return r < 0.6 ? 'snow' : 'clear';
    case 'spring': return r < 0.55 ? 'petals' : r < 0.7 ? 'rain' : 'clear';
    case 'summer': return r < 0.3 ? 'rain' : 'clear';
    default: return r < 0.55 ? 'leaves' : r < 0.7 ? 'rain' : 'clear';
  }
}

// 시간 → 하늘 위/아래 색, 방 조명(곱하기 색), 어둡기
const KEYS: { h: number; top: number; bottom: number; light: number; dark: number }[] = [
  { h: 0, top: 0x1b2457, bottom: 0x33458f, light: 0x8a8fd0, dark: 1 },
  { h: 5, top: 0x1b2457, bottom: 0x33458f, light: 0x8a8fd0, dark: 1 },
  { h: 6.2, top: 0x9fb2ea, bottom: 0xffd9c2, light: 0xf2e4f0, dark: 0.3 },
  { h: 7.5, top: 0x9fd8ff, bottom: 0xdff3ff, light: 0xffffff, dark: 0 },
  { h: 16.5, top: 0x9fd8ff, bottom: 0xdff3ff, light: 0xffffff, dark: 0 },
  { h: 18, top: 0x7d8fe0, bottom: 0xffc499, light: 0xffe2c2, dark: 0.2 },
  { h: 19.6, top: 0x34408a, bottom: 0xc690b0, light: 0xb6aedc, dark: 0.6 },
  { h: 21, top: 0x1b2457, bottom: 0x33458f, light: 0x8a8fd0, dark: 1 },
  { h: 24, top: 0x1b2457, bottom: 0x33458f, light: 0x8a8fd0, dark: 1 },
];

export function mixColor(a: number, b: number, k: number): number {
  const ch = (c: number, s: number) => (c >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

export interface Env {
  hour: number; skyTop: number; skyBottom: number; light: number; dark: number;
  weather: Weather; season: Season; night: boolean; sleepy: boolean;
}

export function envAt(now = Date.now()): Env {
  const { hour, mo } = kstClock(now);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i]; const b = KEYS[i + 1];
  const k = Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h || 1)));
  const weather = weatherToday(now);
  let skyTop = mixColor(a.top, b.top, k);
  let skyBottom = mixColor(a.bottom, b.bottom, k);
  let light = mixColor(a.light, b.light, k);
  if (weather === 'rain') { skyTop = mixColor(skyTop, 0x8a93a6, 0.55); skyBottom = mixColor(skyBottom, 0x9aa3b4, 0.55); light = mixColor(light, 0xd3d8e4, 0.45); }
  return {
    hour, skyTop, skyBottom, light, weather, season: season(mo),
    dark: a.dark + (b.dark - a.dark) * k,
    night: hour >= 21 || hour < 6,
    sleepy: hour >= 22 || hour < 7,
  };
}
