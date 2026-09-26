// 마이룸 장면: 픽셀 방 + 돌아다니는 강아지들 + 효과
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { PERSONALITIES } from '/shared/data.js';
import { el } from './ui.js';

export const SCENE_W = 192;
export const SCENE_H = 144;
const FLOOR_TOP = 72;
const AREA = { x0: 22, x1: 170, y0: 94, y1: 138 };
const BED = { x: 36, y: 100 };
const BOWL = { x: 168, y: 104 };
const FOOT = 41; // 스프라이트 안의 발바닥 위치

const toLogical = (nx, ny) => ({ x: AREA.x0 + nx * (AREA.x1 - AREA.x0), y: AREA.y0 + ny * (AREA.y1 - AREA.y0) });
const toNorm = (x, y) => ({ x: (x - AREA.x0) / (AREA.x1 - AREA.x0), y: (y - AREA.y0) / (AREA.y1 - AREA.y0) });

// ---------- 방 배경 그리기 ----------
function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function ellipse(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
  }
}
const OUT = '#4a3330';

function drawWall(ctx, id) {
  if (id === 'wall_pink') {
    rect(ctx, 0, 0, SCENE_W, FLOOR_TOP, '#ffd9e3');
    for (let y = 6; y < FLOOR_TOP - 6; y += 12) {
      for (let x = (y / 12) % 2 ? 4 : 10; x < SCENE_W; x += 12) {
        rect(ctx, x, y, 3, 2, '#fff0f4'); rect(ctx, x + 1, y + 2, 1, 1, '#fff0f4');
      }
    }
  } else if (id === 'wall_mint') {
    for (let x = 0; x < SCENE_W; x += 8) rect(ctx, x, 0, 8, FLOOR_TOP, (x / 8) % 2 ? '#c9eedd' : '#b3e2cc');
  } else if (id === 'wall_night') {
    rect(ctx, 0, 0, SCENE_W, FLOOR_TOP, '#2f3a6b');
    const stars = [[8, 8], [30, 20], [50, 6], [140, 12], [160, 30], [178, 8], [128, 40], [18, 44], [60, 50], [150, 52]];
    for (const [x, y] of stars) { rect(ctx, x, y, 1, 1, '#fff6c2'); rect(ctx, x - 1, y, 3, 1, '#c9c2ff'); rect(ctx, x, y - 1, 1, 3, '#c9c2ff'); rect(ctx, x, y, 1, 1, '#fffbe0'); }
    ellipse(ctx, 164, 18, 6, 6, '#fff3b0'); ellipse(ctx, 167, 16, 5, 5, '#2f3a6b');
  } else if (id === 'wall_candy') {
    for (let x = -FLOOR_TOP; x < SCENE_W; x += 12) {
      for (let y = 0; y < FLOOR_TOP; y++) {
        rect(ctx, x + y, y, 6, 1, '#ffe3ef');
        rect(ctx, x + y + 6, y, 6, 1, '#fff6fa');
      }
    }
    for (let x = 6; x < SCENE_W; x += 24) { rect(ctx, x, 30, 3, 3, '#ff9fb8'); rect(ctx, x + 12, 50, 3, 3, '#9fe0c8'); }
  } else if (id === 'wall_sky') {
    const bands = ['#9fd6ff', '#b0ddff', '#c2e6ff', '#d4eeff'];
    bands.forEach((c, i) => rect(ctx, 0, i * 17, SCENE_W, 18, c));
    for (const [x, y, r] of [[20, 14, 7], [150, 22, 9], [60, 44, 6], [175, 52, 5], [130, 48, 4]]) {
      ellipse(ctx, x, y, r * 1.6, r * 0.6, '#ffffff'); ellipse(ctx, x + r * 0.5, y - r * 0.4, r * 0.9, r * 0.5, '#ffffff');
    }
    for (const [x, y] of [[40, 30], [110, 8]]) { rect(ctx, x, y, 3, 1, '#4a3330'); rect(ctx, x + 4, y - 1, 3, 1, '#4a3330'); }
  } else if (id === 'wall_forest') {
    rect(ctx, 0, 0, SCENE_W, FLOOR_TOP, '#8a5a34');
    for (let y = 0; y < FLOOR_TOP; y += 8) {
      rect(ctx, 0, y, SCENE_W, 7, (y / 8) % 2 ? '#9c6a3f' : '#a87444');
      rect(ctx, 0, y + 7, SCENE_W, 1, '#6b4225');
      for (let x = (y * 3) % 20; x < SCENE_W; x += 40) ellipse(ctx, x, y + 3, 1.5, 1, '#7a4b2a');
    }
    // 덩굴과 잎사귀
    for (let x = 0; x < SCENE_W; x += 3) rect(ctx, x, 3 + Math.round(Math.sin(x / 8) * 2), 2, 2, '#3f8f3a');
    for (let x = 4; x < SCENE_W; x += 14) { ellipse(ctx, x, 7 + Math.round(Math.sin(x / 8) * 2), 3, 2, '#57a84b'); rect(ctx, x, 10, 1, 4 + (x % 3) * 2, '#3f8f3a'); }
    for (const x of [14, 62, 172]) { ellipse(ctx, x, 34, 4, 3, '#ff9fb8'); rect(ctx, x, 34, 1, 1, '#ffe066'); }
  } else {
    rect(ctx, 0, 0, SCENE_W, FLOOR_TOP, '#d7a067');
    for (let x = 0; x < SCENE_W; x += 12) {
      rect(ctx, x, 0, 1, FLOOR_TOP, '#b87f47');
      rect(ctx, x + 1, 0, 1, FLOOR_TOP, '#e4b47c');
      rect(ctx, x + 6, ((x * 7) % 40) + 8, 1, 2, '#c08850');
    }
  }
  rect(ctx, 0, 0, SCENE_W, 3, '#8a5429');
  rect(ctx, 0, FLOOR_TOP - 5, SCENE_W, 5, '#8a5429');
  rect(ctx, 0, FLOOR_TOP - 5, SCENE_W, 1, '#a86b3a');
}

function drawWindow(ctx) {
  const x = 74; const y = 10; const w = 48; const h = 36;
  rect(ctx, x - 3, y - 3, w + 6, h + 6, OUT);
  rect(ctx, x - 2, y - 2, w + 4, h + 4, '#9c6b3f');
  // 하늘
  const sky = ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'];
  sky.forEach((c, i) => rect(ctx, x, y + i * 5, w, 5, c));
  rect(ctx, x, y + 20, w, 4, '#d8f1ff');
  // 구름
  ellipse(ctx, x + 12, y + 7, 6, 2.5, '#ffffff'); ellipse(ctx, x + 16, y + 5, 4, 2.5, '#ffffff');
  ellipse(ctx, x + 36, y + 12, 5, 2, '#ffffff');
  // 짙은 초록 잔디밭과 나무
  rect(ctx, x, y + 24, w, h - 24, '#3f8f3a');
  for (let i = 0; i < w; i += 3) rect(ctx, x + i, y + 24 - (i % 2), 2, 1, '#57a84b');
  rect(ctx, x, y + h - 4, w, 4, '#2f6f2c');
  rect(ctx, x + 36, y + 14, 3, 12, '#7a4b2a');
  ellipse(ctx, x + 37, y + 12, 7, 6, '#2f7a33'); ellipse(ctx, x + 35, y + 10, 4, 3, '#4f9e44');
  ellipse(ctx, x + 10, y + 27, 3, 1.5, '#ff9fb8'); rect(ctx, x + 10, y + 27, 1, 1, '#ffe066');
  // 창틀 십자
  rect(ctx, x + w / 2 - 1, y, 2, h, '#9c6b3f');
  rect(ctx, x, y + h / 2 - 1, w, 2, '#9c6b3f');
  // 커튼
  for (const cx of [x - 8, x + w + 2]) {
    rect(ctx, cx, y - 5, 6, h + 12, OUT);
    rect(ctx, cx + 1, y - 4, 4, h + 10, '#ff9fb8');
    rect(ctx, cx + 1, y - 4, 1, h + 10, '#ffc2d3');
    rect(ctx, cx, y + h / 2, 6, 2, '#e8708f');
  }
  rect(ctx, x - 10, y - 6, w + 20, 2, '#8a5429');
}

function drawFrame(ctx) {
  const x = 22; const y = 16;
  rect(ctx, x - 1, y - 1, 20, 18, OUT);
  rect(ctx, x, y, 18, 16, '#e0a800');
  rect(ctx, x + 2, y + 2, 14, 12, '#fff6e6');
  ctx.drawImage(iconCanvas('paw'), x + 4, y + 3);
  // 선반과 화분
  rect(ctx, 146, 38, 30, 3, '#8a5429'); rect(ctx, 146, 38, 30, 1, '#b07a45');
  rect(ctx, 152, 30, 8, 8, OUT); rect(ctx, 153, 31, 6, 7, '#e07a5f');
  ellipse(ctx, 156, 26, 5, 4, '#2f7a33'); ellipse(ctx, 155, 25, 2, 2, '#57a84b');
  rect(ctx, 164, 30, 3, 8, '#5bc0ff'); rect(ctx, 168, 32, 3, 6, '#ffd23f'); rect(ctx, 172, 29, 3, 9, '#ff9fb8');
}

function drawFloor(ctx) {
  rect(ctx, 0, FLOOR_TOP, SCENE_W, SCENE_H - FLOOR_TOP, '#dca36a');
  for (let y = FLOOR_TOP, row = 0; y < SCENE_H; y += 9, row++) {
    rect(ctx, 0, y, SCENE_W, 1, '#b97f47');
    rect(ctx, 0, y + 1, SCENE_W, 1, '#e9b983');
    for (let x = (row % 2) * 20; x < SCENE_W; x += 40) rect(ctx, x, y, 1, 9, '#b97f47');
  }
}

function drawRug(ctx, id) {
  const cx = 100; const cy = 120;
  if (!id) return;
  ellipse(ctx, cx, cy, 46, 13, OUT);
  if (id === 'rug_round') {
    ellipse(ctx, cx, cy, 45, 12, '#ff9fb8');
    ellipse(ctx, cx, cy, 38, 9, '#ffc2d3');
    for (let a = 0; a < 12; a++) rect(ctx, Math.round(cx + Math.cos(a / 2) * 40), Math.round(cy + Math.sin(a / 2) * 10), 2, 1, '#ffffff');
  } else if (id === 'rug_grass') {
    ellipse(ctx, cx, cy, 45, 12, '#3f8f3a');
    for (let i = 0; i < 60; i++) {
      const x = cx - 40 + ((i * 37) % 80); const y = cy - 8 + ((i * 13) % 16);
      rect(ctx, x, y, 1, 2, i % 3 ? '#57a84b' : '#2f6f2c');
    }
  } else if (id === 'rug_check') {
    ellipse(ctx, cx, cy, 45, 12, '#e84a5f');
    for (let y = cy - 12; y <= cy + 12; y++) {
      for (let x = cx - 45; x <= cx + 45; x++) {
        const dx = (x - cx) / 45; const dy = (y - cy) / 12;
        if (dx * dx + dy * dy > 0.92) continue;
        if ((Math.floor((x - cx + 60) / 6) + Math.floor((y - cy + 60) / 4)) % 2) rect(ctx, x, y, 1, 1, '#fff6e6');
      }
    }
  } else if (id === 'rug_star') {
    ellipse(ctx, cx, cy, 45, 12, '#3d4a8a');
    ellipse(ctx, cx, cy, 40, 10, '#4a5aa8');
    for (const [x, y] of [[-30, -3], [-14, 4], [0, -5], [16, 3], [32, -2], [-22, -7], [24, 7], [8, 8]]) {
      rect(ctx, cx + x, cy + y, 1, 1, '#fff6c2'); rect(ctx, cx + x - 1, cy + y, 3, 1, '#ffe066'); rect(ctx, cx + x, cy + y - 1, 1, 3, '#ffe066');
    }
    ellipse(ctx, cx - 4, cy, 5, 4, '#fff3a0'); ellipse(ctx, cx - 2, cy - 1, 4, 3, '#4a5aa8');
  } else if (id === 'rug_rainbow') {
    const bands = ['#ff7f9f', '#ffb86b', '#ffe066', '#8fe08a', '#7cc7ff', '#b69cff'];
    bands.forEach((c, i) => ellipse(ctx, cx, cy, 45 - i * 6.5, 12 - i * 1.8, c));
  }
}

function drawBed(ctx, id) {
  const { x, y } = BED;
  if (id === 'bed_cloud') {
    ellipse(ctx, x, y, 25, 11, OUT);
    ellipse(ctx, x, y, 24, 10, '#ffffff');
    for (const [dx, dy] of [[-14, -6], [-4, -9], [8, -8], [17, -4]]) { ellipse(ctx, x + dx, y + dy, 7, 5, OUT); ellipse(ctx, x + dx, y + dy, 6, 4, '#ffffff'); }
    ellipse(ctx, x, y + 3, 20, 5, '#dde9ff');
    ellipse(ctx, x, y - 1, 16, 5, '#eaf2ff');
  } else if (id === 'bed_tent') {
    for (let i = 0; i < 26; i++) {
      const w = Math.round(i * 1.1);
      rect(ctx, x - w - 1, y - 26 + i, w * 2 + 2, 1, OUT);
      rect(ctx, x - w, y - 26 + i, w * 2, 1, i % 6 < 3 ? '#6cc070' : '#57a84b');
    }
    rect(ctx, x - 29, y, 58, 2, OUT);
    for (let i = 0; i < 18; i++) rect(ctx, x - Math.round(i * 0.55), y - 17 + i, Math.round(i * 1.1) + 1, 1, '#2d4a2a');
    rect(ctx, x - 1, y - 30, 2, 5, OUT); rect(ctx, x + 1, y - 30, 5, 3, '#ffe066');
    ellipse(ctx, x, y - 2, 8, 2.5, '#ff9fb8');
  } else if (id === 'bed_castle') {
    rect(ctx, x - 25, y - 14, 50, 22, OUT);
    rect(ctx, x - 24, y - 13, 48, 20, '#ffd9e3');
    for (const tx of [x - 24, x + 16]) {
      rect(ctx, tx - 1, y - 27, 10, 14, OUT); rect(ctx, tx, y - 26, 8, 13, '#ffc2d3');
      for (let i = 0; i < 6; i++) rect(ctx, tx + 4 - i * 0.8, y - 33 + i, i * 1.6 + 1, 1, '#b07cff');
      rect(ctx, tx + 3, y - 20, 2, 3, '#b07cff');
    }
    for (let i = x - 14; i < x + 14; i += 4) rect(ctx, i, y - 17, 3, 3, '#ffc2d3');
    ellipse(ctx, x, y - 2, 13, 4, '#ffffff'); ellipse(ctx, x - 5, y - 4, 5, 2, '#ffe3ef');
    rect(ctx, x - 3, y - 24, 6, 3, '#ffd23f'); rect(ctx, x - 3, y - 26, 1, 2, '#ffd23f'); rect(ctx, x, y - 26, 1, 2, '#ffd23f'); rect(ctx, x + 2, y - 26, 1, 2, '#ffd23f');
  } else if (id === 'bed_house') {
    rect(ctx, x - 22, y - 26, 44, 34, OUT);
    rect(ctx, x - 21, y - 20, 42, 27, '#f5d7a1');
    for (let i = 0; i < 16; i++) rect(ctx, x - 24 + i, y - 20 - i, 48 - i * 2, 2, i % 3 ? '#e84a5f' : '#c2334a');
    ellipse(ctx, x, y - 2, 9, 10, OUT); ellipse(ctx, x, y - 2, 8, 9, '#6b3f2a');
    rect(ctx, x - 21, y + 4, 42, 4, '#d9b07a');
    rect(ctx, x - 6, y - 16, 12, 4, '#fff6e6'); rect(ctx, x - 5, y - 15, 10, 2, '#b87f47');
  } else {
    ellipse(ctx, x, y, 24, 10, OUT);
    ellipse(ctx, x, y, 23, 9, '#b87f47');
    for (let i = -20; i < 22; i += 4) rect(ctx, x + i, y - 3, 2, 8, '#d49a5f');
    ellipse(ctx, x, y - 2, 18, 5, '#ff9fb8');
    ellipse(ctx, x - 3, y - 3, 10, 2, '#ffc2d3');
  }
}

function drawToy(ctx, id) {
  const x = 150; const y = 128;
  if (id === 'toy_ball') {
    ellipse(ctx, x, y, 5, 5, OUT); ellipse(ctx, x, y, 4, 4, '#ff5d7a');
    rect(ctx, x - 4, y - 1, 8, 2, '#ffe066'); rect(ctx, x - 2, y - 3, 1, 1, '#ffffff');
  } else if (id === 'toy_bone') {
    for (const dx of [-6, 6]) { ellipse(ctx, x + dx, y - 1, 2.5, 2.5, OUT); ellipse(ctx, x + dx, y + 2, 2.5, 2.5, OUT); }
    rect(ctx, x - 6, y - 1, 12, 4, OUT);
    for (const dx of [-6, 6]) { ellipse(ctx, x + dx, y - 1, 1.6, 1.6, '#fff6e6'); ellipse(ctx, x + dx, y + 2, 1.6, 1.6, '#fff6e6'); }
    rect(ctx, x - 6, y, 12, 2, '#fff6e6');
  } else if (id === 'toy_duck') {
    ellipse(ctx, x, y, 7, 5, OUT); ellipse(ctx, x + 4, y - 6, 4, 4, OUT);
    ellipse(ctx, x, y, 6, 4, '#ffe066'); ellipse(ctx, x + 4, y - 6, 3, 3, '#ffe066');
    rect(ctx, x + 7, y - 6, 3, 2, '#ff9f3a'); rect(ctx, x + 5, y - 7, 1, 1, OUT);
    ellipse(ctx, x - 1, y - 1, 3, 1.5, '#fff3a0');
  } else if (id === 'toy_cactus') {
    rect(ctx, x - 5, y - 4, 10, 7, OUT); rect(ctx, x - 4, y - 3, 8, 6, '#e07a5f');
    ellipse(ctx, x, y - 11, 3.5, 7, OUT); ellipse(ctx, x, y - 11, 2.5, 6, '#57a84b');
    rect(ctx, x - 6, y - 13, 3, 5, OUT); rect(ctx, x - 5, y - 12, 1, 3, '#57a84b');
    rect(ctx, x + 3, y - 15, 3, 5, OUT); rect(ctx, x + 4, y - 14, 1, 3, '#57a84b');
    rect(ctx, x, y - 18, 2, 2, '#ff9fb8');
  } else if (id === 'toy_rocket') {
    ellipse(ctx, x, y - 10, 5, 11, OUT); ellipse(ctx, x, y - 10, 4, 10, '#f5f5ff');
    rect(ctx, x - 7, y - 4, 4, 6, OUT); rect(ctx, x + 3, y - 4, 4, 6, OUT);
    rect(ctx, x - 6, y - 3, 3, 4, '#e84a5f'); rect(ctx, x + 3, y - 3, 3, 4, '#e84a5f');
    ellipse(ctx, x, y - 12, 2, 2, '#5bc0ff'); rect(ctx, x - 1, y - 13, 1, 1, '#fff');
    rect(ctx, x - 4, y - 19, 8, 3, '#e84a5f');
    rect(ctx, x - 2, y + 1, 4, 2, '#ffb000'); rect(ctx, x - 1, y + 3, 2, 1, '#ffe066');
  } else if (id === 'toy_bear') {
    ellipse(ctx, x, y - 2, 6, 7, OUT); ellipse(ctx, x, y - 10, 5, 5, OUT);
    ellipse(ctx, x - 4, y - 14, 2, 2, OUT); ellipse(ctx, x + 4, y - 14, 2, 2, OUT);
    ellipse(ctx, x, y - 2, 5, 6, '#c68642'); ellipse(ctx, x, y - 10, 4, 4, '#c68642');
    ellipse(ctx, x - 4, y - 14, 1.2, 1.2, '#e0a96d'); ellipse(ctx, x + 4, y - 14, 1.2, 1.2, '#e0a96d');
    ellipse(ctx, x, y - 1, 3, 3, '#e0a96d');
    rect(ctx, x - 2, y - 11, 1, 1, OUT); rect(ctx, x + 2, y - 11, 1, 1, OUT); rect(ctx, x, y - 9, 1, 1, OUT);
    rect(ctx, x - 3, y - 6, 6, 1, '#ff5d7a');
  }
}

function drawBowl(ctx, full) {
  const { x, y } = BOWL;
  ellipse(ctx, x, y, 9, 4, OUT);
  rect(ctx, x - 8, y, 16, 4, OUT);
  ellipse(ctx, x, y + 4, 8, 2, OUT);
  rect(ctx, x - 7, y + 1, 14, 3, '#e85d75');
  ellipse(ctx, x, y, 8, 3, full ? '#c98a3e' : '#b83a52');
  if (full) for (let i = -6; i < 7; i += 3) rect(ctx, x + i, y - 1 - (i % 2 ? 1 : 0), 2, 2, i % 2 ? '#e0a45a' : '#a86b2d');
}

export function renderRoom(decor = {}) {
  const c = document.createElement('canvas');
  c.width = SCENE_W; c.height = SCENE_H;
  const ctx = c.getContext('2d');
  drawWall(ctx, decor.wallpaper);
  drawWindow(ctx);
  drawFrame(ctx);
  drawFloor(ctx);
  drawRug(ctx, decor.rug);
  drawBed(ctx, decor.bed);
  drawToy(ctx, decor.toy);
  return c;
}

// ---------- 장면 ----------
const TRICK_TIME = { sit: 1.8, paw: 1.8, spin: 1.4, jump: 1.4, bow: 1.6, roll: 1.6, dance: 2.4, bang: 2.4, sing: 2.4 };

export class Scene {
  constructor(canvas, overlay, handlers = {}) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = canvas.getContext('2d');
    canvas.width = SCENE_W; canvas.height = SCENE_H;
    this.ctx.imageSmoothingEnabled = false;
    this.handlers = handlers;
    this.entities = new Map();
    this.particles = [];
    this.bg = renderRoom({});
    this.bowlFull = 0;
    this.showNames = false;
    this.showBowl = true;
    this.running = true;
    this.last = performance.now();
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    this.overlay.replaceChildren();
  }

  setDecor(decor) { this.bg = renderRoom(decor ?? {}); }

  // info: { dog, nickname, x, y (0~1), mine, home, auto }
  upsert(id, info) {
    let e = this.entities.get(id);
    if (!e) {
      const p = toLogical(info.x ?? Math.random(), info.y ?? Math.random());
      e = {
        id, x: p.x, y: p.y, tx: p.x, ty: p.y, facing: Math.random() < 0.5 ? 1 : -1,
        state: 'idle', t: 0, stateT: 0, idleFor: 2 + Math.random() * 3,
        tag: el('div', { class: 'name-tag' }), bubble: null,
      };
      this.overlay.append(e.tag);
      this.entities.set(id, e);
    }
    Object.assign(e, { dog: info.dog, nickname: info.nickname, mine: !!info.mine, home: !!info.home, auto: !!info.auto });
    e.tag.textContent = info.nickname ?? '';
    e.tag.classList.toggle('mine', e.mine);
    return e;
  }

  remove(id) {
    const e = this.entities.get(id);
    if (!e) return;
    e.tag.remove();
    e.bubble?.node.remove();
    this.entities.delete(id);
  }

  clear() {
    for (const id of [...this.entities.keys()]) this.remove(id);
    this.particles = [];
  }

  moveTo(id, nx, ny) {
    const e = this.entities.get(id);
    if (!e || e.state === 'trick' || e.state === 'care') return;
    const p = toLogical(Math.min(1, Math.max(0, nx)), Math.min(1, Math.max(0, ny)));
    e.tx = p.x; e.ty = p.y;
    e.state = 'walk';
  }

  norm(id) {
    const e = this.entities.get(id);
    return e ? toNorm(e.tx, e.ty) : { x: 0.5, y: 0.5 };
  }

  trick(id, trick) {
    const e = this.entities.get(id);
    if (!e || !e.dog || e.dog.atSchool) return;
    e.state = 'trick'; e.trick = trick; e.stateT = 0; e.tx = e.x; e.ty = e.y;
    if (trick === 'dance' || trick === 'sing') this.burst(e, 'note', 3);
    if (trick === 'jump' || trick === 'spin') this.burst(e, 'sparkle', 2);
  }

  // action: feed | brush | pet | love
  care(id, action) {
    const e = this.entities.get(id);
    if (!e) return;
    e.state = 'care'; e.care = action; e.stateT = 0; e.tx = e.x; e.ty = e.y;
    if (action === 'feed') {
      this.bowlFull = 3;
      e.x = Math.min(e.x, BOWL.x - 22); e.tx = e.x; e.facing = 1;
      if (Math.abs(e.y - BOWL.y) > 4) { e.y = BOWL.y + 3; e.ty = e.y; }
    }
    if (action === 'brush') { this.burst(e, 'sparkle', 4); this.bubbles(e); }
    if (action === 'pet' || action === 'love') this.burst(e, 'heart', action === 'love' ? 5 : 3);
  }

  sleep(id, seconds = 6) {
    const e = this.entities.get(id);
    if (!e) return;
    e.state = 'toBed'; e.tx = BED.x + 4; e.ty = BED.y + 4; e.sleepFor = seconds;
  }

  bubble(id, kind, value) {
    const e = this.entities.get(id);
    if (!e) return;
    e.bubble?.node.remove();
    const node = el('div', { class: `bubble ${kind}` });
    if (kind === 'sticker') node.append(iconCanvas(value, 3));
    else node.textContent = value;
    this.overlay.append(node);
    e.bubble = { node, until: performance.now() + 4000 };
  }

  burst(e, icon, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        icon, x: e.x + (Math.random() - 0.5) * 20, y: e.y - 30 - Math.random() * 6,
        vx: (Math.random() - 0.5) * 12, vy: -14 - Math.random() * 10, life: 1.4 + Math.random() * 0.6, age: -i * 0.15,
      });
    }
  }

  bubbles(e) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        bubble: true, x: e.x + (Math.random() - 0.5) * 24, y: e.y - 12 - Math.random() * 14,
        vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 6, life: 1.2 + Math.random(), age: -i * 0.12, r: 1 + Math.floor(Math.random() * 2),
      });
    }
  }

  effectAt(id, icon, n = 3) {
    const e = this.entities.get(id);
    if (e) this.burst(e, icon, n);
  }

  hit(x, y) {
    let best = null;
    for (const e of this.entities.values()) {
      if (!e.dog || e.dog.atSchool) continue;
      if (Math.abs(x - e.x) < 16 && y < e.y + 3 && y > e.y - 34) {
        if (!best || e.y > best.y) best = e;
      }
    }
    return best;
  }

  onPointer(ev) {
    const r = this.canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * SCENE_W;
    const y = ((ev.clientY - r.top) / r.height) * SCENE_H;
    const e = this.hit(x, y);
    if (e) {
      const combo = this.poke(e);
      return this.handlers.onDogTap?.(e, combo);
    }
    if (y > FLOOR_TOP + 10) {
      const cx = Math.min(AREA.x1, Math.max(AREA.x0, x)); const cy = Math.min(AREA.y1, Math.max(AREA.y0, y));
      this.particles.push({ marker: true, x: cx, y: cy, vx: 0, vy: 0, life: 0.7, age: 0 });
      this.handlers.onFloorTap?.(toNorm(cx, cy));
    }
  }

  // 강아지를 톡 누르면 말랑하게 찌그러졌다가 폴짝! 연속으로 누르면 빙글 돌아요.
  poke(e) {
    const now = performance.now();
    e.pokes = (e.pokes ?? []).filter((t) => now - t < 1500);
    e.pokes.push(now);
    e.pokeT = 0.45;
    if (e.state === 'sleep') { e.state = 'idle'; e.stateT = 0; e.idleFor = 3; }
    if (e.state === 'idle' || e.state === 'walk') { e.state = 'idle'; e.stateT = 0; e.idleFor = 3; e.tx = e.x; e.ty = e.y; }
    this.particles.push({ icon: 'heart', x: e.x + (Math.random() - 0.5) * 10, y: e.y - 30, vx: 0, vy: -18, life: 0.8, age: 0, small: true });
    if (e.pokes.length >= 4) {
      e.pokes = [];
      this.trick(e.id, 'spin');
      return 'spin';
    }
    return e.pokes.length;
  }

  // 같이 놀기: from 강아지가 to 강아지에게 달려가서 함께 폴짝폴짝 뛰어놀아요.
  playTogether(fromId, toId) {
    const a = this.entities.get(fromId); const b = this.entities.get(toId);
    if (!a || !b || !a.dog || !b.dog || a.dog.atSchool || b.dog.atSchool) return;
    const side = a.x < b.x ? -1 : 1;
    a.tx = Math.min(AREA.x1, Math.max(AREA.x0, b.x + side * 20));
    a.ty = b.y;
    a.state = 'rush'; a.stateT = 0; a.partner = toId;
    b.state = 'idle'; b.stateT = 0; b.idleFor = 6; b.tx = b.x; b.ty = b.y;
  }

  update(dt) {
    for (const e of this.entities.values()) {
      e.t += dt; e.stateT += dt;
      if (!e.dog || e.dog.atSchool) continue;
      const speed = 30 * (PERSONALITIES[e.dog.personality]?.speed ?? 1);
      if (e.pokeT > 0) e.pokeT -= dt;
      if (e.state === 'walk' || e.state === 'toBed' || e.state === 'rush') {
        const dx = e.tx - e.x; const dy = e.ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          e.x = e.tx; e.y = e.ty;
          if (e.state === 'toBed') { e.state = 'sleep'; e.stateT = 0; }
          else if (e.state === 'rush') this.startFrolic(e);
          else { e.state = 'idle'; e.stateT = 0; e.idleFor = 3 + Math.random() * 5; }
        } else {
          // 걸을 때 발밑에 흙먼지가 폴폴
          if (Math.floor(e.t * 6) !== Math.floor((e.t - dt) * 6)) {
            this.particles.push({ dust: true, x: e.x - e.facing * 8, y: e.y - 1, vx: -e.facing * 6, vy: -4, life: 0.45, age: 0 });
          }
          const step = Math.min(d, speed * (e.state === 'rush' ? 2.2 : 1) * dt);
          e.x += (dx / d) * step; e.y += (dy / d) * step;
          if (Math.abs(dx) > 0.5) e.facing = dx > 0 ? 1 : -1;
        }
      } else if (e.state === 'trick' && e.stateT > (TRICK_TIME[e.trick] ?? 1.5)) {
        e.state = 'idle'; e.stateT = 0; e.idleFor = 2 + Math.random() * 3; e.facing = e.facing || 1;
      } else if (e.state === 'frolic' && e.stateT > 2.4) {
        e.state = 'idle'; e.stateT = 0; e.idleFor = 2 + Math.random() * 3;
      } else if (e.state === 'care' && e.stateT > 1.8) {
        e.state = 'idle'; e.stateT = 0; e.idleFor = 2 + Math.random() * 3;
      } else if (e.state === 'sleep') {
        if (Math.random() < dt * 0.6) this.particles.push({ icon: 'sleepy', x: e.x + 8, y: e.y - 24, vx: 4, vy: -8, life: 1.6, age: 0, small: true });
        if (e.stateT > (e.sleepFor ?? 6)) { e.state = 'idle'; e.stateT = 0; e.idleFor = 2; }
      } else if (e.state === 'idle' && e.auto && e.stateT > e.idleFor) {
        // 혼자 놀기: 가끔 산책하고, 잠꾸러기는 침대로 가서 낮잠을 자요.
        const nap = PERSONALITIES[e.dog.personality]?.napChance ?? 0.1;
        if (Math.random() < nap) this.sleep(e.id, 5 + Math.random() * 6);
        else {
          const nx = Math.random(); const ny = Math.random();
          this.moveTo(e.id, nx, ny);
          if (e.mine) this.handlers.onMove?.({ x: nx, y: ny });
        }
      }
      if (e.bubble && performance.now() > e.bubble.until) { e.bubble.node.remove(); e.bubble = null; }
    }
    if (this.bowlFull > 0) this.bowlFull -= dt;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age < 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 4 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  startFrolic(a) {
    const b = this.entities.get(a.partner);
    a.state = 'frolic'; a.stateT = 0;
    if (b && b.dog && !b.dog.atSchool) {
      b.state = 'frolic'; b.stateT = 0.2; b.tx = b.x; b.ty = b.y;
      a.facing = b.x > a.x ? 1 : -1; b.facing = -a.facing;
      for (let i = 0; i < 4; i++) {
        this.particles.push({ icon: 'heart', x: (a.x + b.x) / 2 + (Math.random() - 0.5) * 16, y: a.y - 28, vx: (Math.random() - 0.5) * 10, vy: -16, life: 1.5, age: -i * 0.3 });
      }
    }
  }

  // 현재 상태 → 스프라이트 포즈
  pose(e) {
    const d = e.dog;
    const fluff = d.fluff > 60 ? 2 : d.fluff > 20 ? 1 : 0;
    const base = { fluff, equip: d.equip, tail: Math.floor(e.t * 3) % 2 };
    const moodEyes = d.mood === 'sad' ? 'sad' : 'open';
    let pose = 'stand'; let opts = { ...base, eyes: moodEyes }; let dy = 0; let rot = 0; let facing = e.facing;
    const blink = e.t % 4 < 0.12;
    if (blink && opts.eyes === 'open') opts.eyes = 'closed';
    switch (e.state) {
      case 'walk': case 'toBed':
        pose = Math.floor(e.t * 7) % 2 ? 'walk1' : 'walk2';
        dy = Math.floor(e.t * 7) % 2 ? -1 : 0;
        if (d.mood === 'happy') opts.mouth = 'tongue';
        break;
      case 'sleep':
        pose = 'lie'; opts = { ...base, tail: 0, eyes: 'closed' };
        break;
      case 'care': {
        const s = e.stateT;
        opts = { ...base, eyes: 'happy', mouth: 'tongue', tail: Math.floor(s * 8) % 2 };
        if (e.care === 'feed') { opts.headDy = Math.floor(s * 5) % 2 ? 3 : 2; opts.mouth = 'open'; opts.eyes = 'closed'; }
        if (e.care === 'pet' || e.care === 'love') { pose = 'front'; }
        if (e.care === 'brush') { pose = 'front'; dy = Math.floor(s * 6) % 2 ? -1 : 0; }
        break;
      }
      case 'trick': {
        const s = e.stateT;
        opts = { ...base, eyes: 'happy', mouth: 'tongue', tail: Math.floor(s * 8) % 2 };
        switch (e.trick) {
          case 'sit': pose = 'sit'; break;
          case 'paw': pose = s > 0.4 ? 'paw' : 'sit'; break;
          case 'spin': facing = Math.floor(s * 8) % 2 ? 1 : -1; dy = -Math.round(Math.abs(Math.sin(s * 8)) * 3); break;
          case 'jump': dy = -Math.round(Math.abs(Math.sin(s * Math.PI * 1.4)) * 16); pose = dy < -4 ? 'walk1' : 'stand'; break;
          case 'bow': pose = s > 0.3 && s < 1.3 ? 'bow' : 'stand'; opts.eyes = pose === 'bow' ? 'closed' : 'happy'; break;
          case 'roll': pose = 'lie'; rot = Math.floor(s * 6) % 4; opts.eyes = 'happy'; break;
          case 'dance': pose = 'beg'; facing = Math.floor(s * 3) % 2 ? 1 : -1; dy = -Math.round(Math.abs(Math.sin(s * 6)) * 3); opts.mouth = 'open'; break;
          case 'bang': if (s < 0.5) { pose = 'beg'; } else { pose = 'lie'; rot = 2; opts.eyes = 'closed'; opts.mouth = 'tongue'; } break;
          case 'sing': pose = 'front'; opts.mouth = Math.floor(s * 4) % 2 ? 'open' : 'closed'; opts.eyes = 'closed'; opts.headDy = -1; break;
          default: break;
        }
        break;
      }
      case 'rush':
        pose = Math.floor(e.t * 10) % 2 ? 'walk1' : 'walk2';
        dy = Math.floor(e.t * 10) % 2 ? -2 : 0;
        opts.mouth = 'tongue'; opts.eyes = 'happy';
        break;
      case 'frolic': {
        const s = e.stateT;
        pose = Math.floor(s * 4) % 2 ? 'beg' : 'stand';
        dy = -Math.round(Math.abs(Math.sin(s * 7)) * 5);
        opts = { ...base, eyes: 'happy', mouth: 'open', tail: Math.floor(s * 10) % 2 };
        break;
      }
      default:
        if (d.mood === 'happy' && Math.floor(e.t / 3) % 3 === 0) opts.mouth = 'tongue';
        // 가끔 화면(나)을 바라봐요
        if (Math.floor((e.t + (e.id % 7)) / 3.5) % 3 === 1) pose = 'front';
    }
    if (e.pokeT > 0) {
      pose = 'front';
      opts = { ...opts, eyes: 'happy', mouth: 'tongue', tail: Math.floor(e.t * 12) % 2 };
    }
    return { pose, opts, dy, rot, facing };
  }

  draw() {
    const { ctx } = this;
    ctx.drawImage(this.bg, 0, 0);
    if (this.showBowl) drawBowl(ctx, this.bowlFull > 0);
    const list = [...this.entities.values()].filter((e) => e.dog && !e.dog.atSchool).sort((a, b) => a.y - b.y);
    const rect = this.canvas.getBoundingClientRect();
    const sx = rect.width / SCENE_W;
    for (const e of list) {
      const { pose, opts, dy, rot, facing } = this.pose(e);
      const spr = dogSprite(e.dog.breed, e.dog.stage, pose, opts);
      const x = Math.round(e.x); const y = Math.round(e.y);
      // 그림자
      ctx.fillStyle = 'rgba(74,51,48,0.22)';
      ellipse(ctx, x, y + 1, 11 + e.dog.stage * 2, 2.5, 'rgba(74,51,48,0.22)');
      ctx.save();
      ctx.translate(x, y + dy);
      if (rot) {
        ctx.translate(0, -12);
        ctx.rotate((rot * Math.PI) / 2);
        ctx.translate(0, 12);
      }
      if (e.pokeT > 0) {
        // 말랑 찌그러짐 → 폴짝
        const k = 1 - e.pokeT / 0.45;
        const squash = k < 0.35 ? Math.sin((k / 0.35) * Math.PI) * 0.22 : 0;
        const hop = k >= 0.35 ? Math.round(Math.sin(((k - 0.35) / 0.65) * Math.PI) * 7) : 0;
        ctx.translate(0, -hop);
        ctx.scale(1 + squash * 0.7, 1 - squash);
      }
      if (facing < 0 && pose !== 'front') ctx.scale(-1, 1);
      ctx.drawImage(spr.canvas, pose === 'front' ? -DOG_W / 2 : -DOG_W / 2 + 2, -FOOT);
      ctx.restore();
      // 이름표와 말풍선 (DOM, 선명한 글씨)
      const headY = y + dy - 38 + (e.dog.stage === 0 ? 8 : e.dog.stage === 1 ? 4 : 0);
      e.tag.style.display = this.showNames || e.bubble ? 'block' : 'none';
      e.tag.style.transform = `translate(${x * sx}px, ${(y + 4) * sx}px) translate(-50%, 0)`;
      if (e.bubble) e.bubble.node.style.transform = `translate(${x * sx}px, ${headY * sx}px) translate(-50%, -100%)`;
    }
    for (const e of this.entities.values()) {
      if (!e.dog || e.dog.atSchool) e.tag.style.display = 'none';
    }
    for (const p of this.particles) {
      if (p.age < 0) continue;
      const alpha = Math.min(1, (p.life - p.age) * 2);
      ctx.globalAlpha = alpha;
      if (p.marker) {
        // 바닥을 누른 곳에 동그라미 + 발자국
        const k = p.age / p.life;
        ctx.globalAlpha = 1 - k;
        const r = 3 + k * 9;
        for (let a = 0; a < 16; a++) {
          const ang = (a / 16) * Math.PI * 2;
          ctx.fillStyle = '#fff6e6';
          ctx.fillRect(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + Math.sin(ang) * r * 0.45), 1, 1);
        }
        const ic = iconCanvas('paw');
        ctx.drawImage(ic, Math.round(p.x - 3), Math.round(p.y - 4), 7, 7);
      } else if (p.dust) {
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = '#f5e6cf';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) + 1, 1, 1);
      } else if (p.bubble) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.r + 1, p.r + 1);
        ctx.fillStyle = '#8fd3ff';
        ctx.fillRect(Math.round(p.x) + p.r, Math.round(p.y) + p.r, 1, 1);
      } else {
        const ic = iconCanvas(p.icon);
        const s = p.small ? 0.7 : 1;
        ctx.drawImage(ic, Math.round(p.x - (ic.width * s) / 2), Math.round(p.y), Math.round(ic.width * s), Math.round(ic.height * s));
      }
      ctx.globalAlpha = 1;
    }
  }
}

// 스티커/효과에서 쓰는 도구 모음 내보내기
export { toNorm, toLogical };
