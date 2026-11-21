// 🌗 실제 시간(한국 시간)에 맞춘 낮·밤과 계절 날씨
// 친구 집에 놀러 가도 같은 날씨예요 (날짜로 정해져요).
// 시험할 때: 주소에 ?debug&hour=22&weather=snow 처럼 붙이면 그 시간·날씨로 보여요.

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const DEBUG = params.has('debug');
const FORCE_HOUR = DEBUG && params.has('hour') ? Number(params.get('hour')) : null;
const FORCE_WEATHER = DEBUG ? params.get('weather') : null;

const KST = 9 * 3600_000;

// 한국 시간 기준 { y, mo(1~12), d, hour(소수) }
export function kstClock(now = Date.now()) {
  const t = new Date(now + KST);
  const hour = FORCE_HOUR ?? (t.getUTCHours() + t.getUTCMinutes() / 60);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), hour };
}

// 밤 곡 · 귀뚜라미 · 강아지가 졸린 시간
export function isNight(now = Date.now()) {
  const { hour } = kstClock(now);
  return hour >= 21 || hour < 6;
}

export function season(mo = kstClock().mo) {
  if (mo === 12 || mo <= 2) return 'winter';
  if (mo <= 5) return 'spring';
  if (mo <= 8) return 'summer';
  return 'autumn';
}

// 날짜마다 정해지는 0~1 사이 수 (모두에게 같아요)
function dayHash(y, mo, d) {
  let h = (y * 372 + mo * 31 + d) * 2654435761;
  h = (h ^ (h >>> 15)) >>> 0;
  return (h % 1000) / 1000;
}

// 오늘 날씨: 'clear' | 'snow' | 'rain' | 'petals' | 'leaves'
export function weatherToday(now = Date.now()) {
  if (FORCE_WEATHER) return FORCE_WEATHER;
  const { y, mo, d } = kstClock(now);
  const r = dayHash(y, mo, d);
  switch (season(mo)) {
    case 'winter': return r < 0.6 ? 'snow' : 'clear';
    case 'spring': return r < 0.55 ? 'petals' : r < 0.7 ? 'rain' : 'clear';
    case 'summer': return r < 0.3 ? 'rain' : 'clear';
    default: return r < 0.55 ? 'leaves' : r < 0.7 ? 'rain' : 'clear';
  }
}

// ---------- 하늘 색 ----------
// 시간(시) → [하늘 네 줄 색], 방 조명 색(곱하기), 어둡기
const KEYS = [
  { h: 0, sky: ['#141c4c', '#1c2660', '#26347a', '#30408a'], light: '#7478bc', dark: 1 },
  { h: 5, sky: ['#141c4c', '#1c2660', '#26347a', '#30408a'], light: '#7478bc', dark: 1 },
  { h: 6, sky: ['#8fa8e0', '#c4b0e2', '#ffc6c0', '#ffe0b8'], light: '#ead8ee', dark: 0.35 },
  { h: 7.5, sky: ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'], light: '#ffffff', dark: 0 },
  { h: 16.5, sky: ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'], light: '#ffffff', dark: 0 },
  { h: 18, sky: ['#7a8ede', '#e79cc0', '#ffb08a', '#ffd49a'], light: '#ffdcb6', dark: 0.2 },
  { h: 19.5, sky: ['#2f3d80', '#4f529e', '#8c70b0', '#c890a8'], light: '#aaa2d4', dark: 0.6 },
  { h: 21, sky: ['#141c4c', '#1c2660', '#26347a', '#30408a'], light: '#7478bc', dark: 1 },
  { h: 24, sky: ['#141c4c', '#1c2660', '#26347a', '#30408a'], light: '#7478bc', dark: 1 },
];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a, b, k) => { const A = hex(a); const B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * k)); };

// 지금 방의 분위기
export function envAt(now = Date.now()) {
  const { hour } = kstClock(now);
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
  const a = KEYS[i]; const b = KEYS[i + 1];
  const k = Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h || 1)));
  const weather = weatherToday(now);
  let sky = a.sky.map((c, j) => mix(c, b.sky[j], k));
  let light = mix(a.light, b.light, k);
  const dark = a.dark + (b.dark - a.dark) * k;
  // 비 오는 날은 하늘이 잿빛, 방도 살짝 어둑해요
  if (weather === 'rain') { sky = sky.map((c) => mix(c, '#8a93a6', 0.55)); light = mix(light, '#c9cfdc', 0.5); }
  if (weather === 'snow') sky = sky.map((c) => mix(c, '#d8e0ee', dark > 0.5 ? 0.1 : 0.35));
  return {
    hour, sky, light, dark, weather,
    season: season(kstClock(now).mo),
    night: hour >= 21 || hour < 6,
    stars: dark > 0.55 && weather !== 'rain',
    sun: dark < 0.3 && weather === 'clear',
    // 강아지가 졸린 시간 (밤 10시 ~ 아침 7시)
    sleepy: hour >= 22 || hour < 7,
  };
}
