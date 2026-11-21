// 🏠 방 그리기 (벽지·바닥 무늬는 코드로, 가구는 나중에 그림 파일로 바뀌어요)
// 모든 좌표는 화면 CSS 픽셀 기준 (카메라 확대로 선명하게)
import Phaser from 'phaser';
import { mixColor, type Env } from '@platform';

export const INK = 0x5a3a28;
const LINE = 3;

export interface RoomLayout {
  W: number; H: number;
  floorY: number;
  win: { x: number; y: number; w: number; h: number };
  walk: { x0: number; x1: number; y0: number; y1: number }; // 강아지가 다닐 수 있는 곳
  bed: { x: number; y: number };
  bowl: { x: number; y: number };
}

export function layout(W: number, H: number, topUi: number, bottomUi: number): RoomLayout {
  const floorY = Math.round(Math.max(topUi + 190, H * 0.46));
  const ww = Math.min(W * 0.5, 230);
  const wh = Math.round(ww * 0.74);
  const win = { x: Math.round(W / 2 - ww / 2), y: Math.round(Math.max(topUi + 14, floorY - wh - 64)), w: Math.round(ww), h: wh };
  const y0 = floorY + 70;
  const y1 = Math.max(y0 + 40, H - bottomUi - 12);
  return {
    W, H, floorY, win,
    walk: { x0: 70, x1: W - 70, y0, y1 },
    bed: { x: Math.round(W * 0.2), y: Math.round(y0 + 10) },
    bowl: { x: Math.round(W * 0.84), y: Math.round(y0 + 16) },
  };
}

/** 벽 · 바닥 · 창틀 · 커튼 · 액자 · 선반 · 러그 · 침대 */
export function drawRoom(g: Phaser.GameObjects.Graphics, L: RoomLayout): void {
  const { W, H, floorY, win } = L;
  g.clear();
  // 벽지: 크림색 + 부드러운 세로 줄무늬
  g.fillStyle(0xfff1de).fillRect(0, 0, W, floorY);
  g.fillStyle(0xffe6cc);
  for (let x = 0; x < W; x += 36) g.fillRect(x, 0, 16, floorY);
  // 벽 아래 나무 판 (징두리)
  g.fillStyle(0xf3cf9f).fillRect(0, floorY - 58, W, 58);
  g.fillStyle(0xe9bd86);
  for (let x = 12; x < W; x += 44) g.fillRoundedRect(x, floorY - 50, 32, 40, 6);
  g.lineStyle(LINE, INK).lineBetween(0, floorY - 58, W, floorY - 58);
  // 바닥: 나무 마루 (아래로 갈수록 판이 넓어 보이게)
  g.fillStyle(0xefc08b).fillRect(0, floorY, W, H - floorY);
  g.lineStyle(2, 0xd9a36d);
  let y = floorY; let step = 22; let row = 0;
  while (y < H) {
    y += step; step *= 1.12; row++;
    g.lineBetween(0, y, W, y);
    const off = row % 2 ? 0 : 60;
    for (let x = off; x < W; x += 120) g.lineBetween(x, y - step / 1.12, x, y);
  }
  g.fillStyle(0xd28f55).fillRect(0, floorY, W, 8); // 걸레받이
  g.lineStyle(LINE, INK).lineBetween(0, floorY, W, floorY).lineBetween(0, floorY + 8, W, floorY + 8);

  // 창틀 (하늘은 따로 그려요: drawSky)
  const f = 12;
  g.fillStyle(0xc98b55).fillRoundedRect(win.x - f, win.y - f, win.w + f * 2, win.h + f * 2, 20);
  g.lineStyle(LINE, INK).strokeRoundedRect(win.x - f, win.y - f, win.w + f * 2, win.h + f * 2, 20);
  g.strokeRoundedRect(win.x, win.y, win.w, win.h, 12);
  // 창턱
  g.fillStyle(0xd99a62).fillRoundedRect(win.x - f - 10, win.y + win.h + f - 4, win.w + (f + 10) * 2, 14, 7);
  g.lineStyle(LINE, INK).strokeRoundedRect(win.x - f - 10, win.y + win.h + f - 4, win.w + (f + 10) * 2, 14, 7);
  // 커튼
  for (const side of [-1, 1]) {
    const cx = side < 0 ? win.x - f - 26 : win.x + win.w + f - 4;
    g.fillStyle(0xffb3c2).fillRoundedRect(cx, win.y - f - 18, 30, win.h + f * 2 + 30, 14);
    g.fillStyle(0xffc9d4).fillRoundedRect(cx + 5, win.y - f - 14, 8, win.h + f * 2 + 20, 4);
    g.lineStyle(LINE, INK).strokeRoundedRect(cx, win.y - f - 18, 30, win.h + f * 2 + 30, 14);
    g.fillStyle(0xea7590).fillRoundedRect(cx - 3, win.y + win.h * 0.55, 36, 10, 5);
    g.lineStyle(2, INK).strokeRoundedRect(cx - 3, win.y + win.h * 0.55, 36, 10, 5);
  }
  g.fillStyle(0xb07444).fillRoundedRect(win.x - f - 40, win.y - f - 26, win.w + (f + 40) * 2, 10, 5);
  g.lineStyle(2, INK).strokeRoundedRect(win.x - f - 40, win.y - f - 26, win.w + (f + 40) * 2, 10, 5);

  // 왼쪽 벽: 발바닥 액자
  const fx = Math.max(18, win.x - 110); const fy = win.y + 4;
  if (fx + 64 < win.x - 40) {
    g.fillStyle(0xc98b55).fillRoundedRect(fx, fy, 64, 70, 10);
    g.lineStyle(LINE, INK).strokeRoundedRect(fx, fy, 64, 70, 10);
    g.fillStyle(0xfff8ee).fillRoundedRect(fx + 8, fy + 8, 48, 54, 6);
    g.fillStyle(0xf2a65a).fillCircle(fx + 32, fy + 42, 9);
    for (const [dx, dy] of [[-12, -4], [-5, -14], [5, -14], [12, -4]]) g.fillCircle(fx + 32 + dx, fy + 30 + dy, 4.5);
  }
  // 오른쪽 벽: 선반 + 화분
  const sx = Math.min(W - 92, win.x + win.w + 52); const sy = win.y + win.h * 0.5;
  if (sx > win.x + win.w + 40) {
    g.fillStyle(0xc98b55).fillRoundedRect(sx, sy, 78, 12, 5);
    g.lineStyle(LINE, INK).strokeRoundedRect(sx, sy, 78, 12, 5);
    g.fillStyle(0xe58b5b).fillRoundedRect(sx + 8, sy - 26, 26, 26, 6);
    g.lineStyle(LINE, INK).strokeRoundedRect(sx + 8, sy - 26, 26, 26, 6);
    g.fillStyle(0x7cc576).fillEllipse(sx + 21, sy - 36, 34, 26);
    g.lineStyle(LINE, INK).strokeEllipse(sx + 21, sy - 36, 34, 26);
    for (const [i, c] of [[0, 0x9fd8ff], [1, 0xffe38f], [2, 0xff9fb3]] as const) {
      g.fillStyle(c).fillRoundedRect(sx + 44 + i * 10, sy - 30 + (i % 2) * 4, 9, 30 - (i % 2) * 4, 3);
      g.lineStyle(2, INK).strokeRoundedRect(sx + 44 + i * 10, sy - 30 + (i % 2) * 4, 9, 30 - (i % 2) * 4, 3);
    }
  }
  // 러그
  const ry = (L.walk.y0 + L.walk.y1) / 2;
  g.fillStyle(0xffc1cc).fillEllipse(W / 2, ry, W * 0.66, (L.walk.y1 - L.walk.y0) * 0.75 + 30);
  g.fillStyle(0xffd6de).fillEllipse(W / 2, ry, W * 0.5, (L.walk.y1 - L.walk.y0) * 0.5 + 18);
  g.lineStyle(LINE, INK).strokeEllipse(W / 2, ry, W * 0.66, (L.walk.y1 - L.walk.y0) * 0.75 + 30);
  // 바구니 침대
  const b = L.bed;
  g.fillStyle(0xd6965a).fillEllipse(b.x, b.y, 128, 52);
  g.lineStyle(LINE, INK).strokeEllipse(b.x, b.y, 128, 52);
  g.fillStyle(0xffd6de).fillEllipse(b.x, b.y - 4, 100, 32);
  g.lineStyle(2, INK).strokeEllipse(b.x, b.y - 4, 100, 32);
}

/** 밥그릇 (가득 / 빈) */
export function drawBowl(g: Phaser.GameObjects.Graphics, L: RoomLayout, full: boolean): void {
  const { x, y } = L.bowl;
  g.clear();
  if (full) {
    g.fillStyle(0xb5713e);
    for (let i = 0; i < 9; i++) g.fillCircle(x - 18 + (i % 5) * 9, y - 12 - Math.floor(i / 5) * 5, 5);
  }
  g.fillStyle(0xef5d6c).fillRoundedRect(x - 30, y - 10, 60, 22, { tl: 4, tr: 4, bl: 14, br: 14 });
  g.lineStyle(LINE, INK).strokeRoundedRect(x - 30, y - 10, 60, 22, { tl: 4, tr: 4, bl: 14, br: 14 });
  g.fillStyle(0xffffff, 0.5).fillRoundedRect(x - 22, y - 5, 14, 4, 2);
}

/** 창밖 하늘 · 해 · 구름 · 달 (시간에 따라) */
export function drawSky(g: Phaser.GameObjects.Graphics, L: RoomLayout, env: Env): void {
  const { win } = L;
  g.clear();
  // 하늘 그라디언트: 2px 띠를 쌓아서 둥근 모서리 안쪽만 칠해요 (삼각형 이음새 없이 매끈하게)
  const r = 10; const top = win.y + 2; const hh = win.h - 4;
  for (let yy = 0; yy < hh; yy += 2) {
    const k = yy / hh;
    const dy = yy < r ? r - yy : yy > hh - r ? yy - (hh - r) : 0;
    const inset = dy ? r - Math.sqrt(Math.max(0, r * r - dy * dy)) : 0;
    g.fillStyle(mixColor(env.skyTop, env.skyBottom, k)).fillRect(win.x + 2 + inset, top + yy, win.w - 4 - inset * 2, 2);
  }
  const cw = win.w;
  if (env.dark < 0.3 && env.weather === 'clear') {
    g.fillStyle(0xfff3a6).fillCircle(win.x + cw * 0.78, win.y + win.h * 0.24, 13);
  }
  if (env.dark < 0.85) {
    const c = env.weather === 'rain' ? 0xc4cad6 : 0xffffff;
    g.fillStyle(c, 1 - env.dark * 0.5);
    g.fillEllipse(win.x + cw * 0.28, win.y + win.h * 0.3, 54, 18).fillEllipse(win.x + cw * 0.36, win.y + win.h * 0.24, 34, 18);
    g.fillEllipse(win.x + cw * 0.62, win.y + win.h * 0.48, 44, 14);
  }
  if (env.dark > 0.6) {
    g.fillStyle(0xfff1b8).fillCircle(win.x + cw * 0.76, win.y + win.h * 0.26, 12);
    g.fillStyle(env.skyTop).fillCircle(win.x + cw * 0.76 + 6, win.y + win.h * 0.26 - 3, 11);
  }
  // 먼 언덕과 나무 (계절 색)
  const hill = env.weather === 'snow' ? 0xeef3fb : 0x8fd27f;
  const shade = (c: number) => Phaser.Display.Color.ValueToColor(c).darken(Math.round(env.dark * 45)).color;
  // (모든 도형이 창 안쪽에만 그려지게 크기를 맞췄어요)
  const gy = win.y + win.h * 0.74;
  g.fillStyle(shade(hill)).fillEllipse(win.x + cw * 0.3, gy, cw * 0.5, win.h * 0.18);
  g.fillStyle(shade(env.weather === 'snow' ? 0xdfe8f5 : 0x74c06a)).fillEllipse(win.x + cw * 0.72, gy + 2, cw * 0.46, win.h * 0.14);
  g.fillStyle(shade(hill)).fillRoundedRect(win.x + 2, gy, win.w - 4, win.y + win.h - 2 - gy, { tl: 0, tr: 0, bl: 10, br: 10 });
  const tree = { spring: 0xf6a9c5, summer: 0x4f9e44, autumn: 0xe08a3c, winter: 0x7f9a86 }[env.season];
  g.fillStyle(shade(0x8a5a36)).fillRect(win.x + cw * 0.8 - 3, gy - win.h * 0.16, 6, win.h * 0.2);
  g.fillStyle(shade(tree)).fillCircle(win.x + cw * 0.8, gy - win.h * 0.2, Math.min(16, win.h * 0.14));
  // 창 십자와 안쪽 테두리 (하늘 위에)
  g.fillStyle(0xc98b55).fillRect(win.x + win.w / 2 - 4, win.y, 8, win.h).fillRect(win.x, win.y + win.h / 2 - 4, win.w, 8);
  g.lineStyle(2, INK).strokeRect(win.x + win.w / 2 - 4, win.y, 8, win.h).strokeRect(win.x, win.y + win.h / 2 - 4, win.w, 8);
  g.lineStyle(LINE, INK).strokeRoundedRect(win.x, win.y, win.w, win.h, 12);
}
