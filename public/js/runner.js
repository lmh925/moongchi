// 미니게임: 멍뭉 런 (쿠키런 스타일 가로 달리기)
// 강아지가 자동으로 달려요. 점프(2단 점프)와 슬라이드로 장애물을 피하고 간식을 모아요.
// 체력은 시간이 지나면 조금씩 줄어들고, 하트를 먹으면 다시 차요. 맵은 모습만 다르고 규칙은 같아요.
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el } from './ui.js';
import { sfx, playBgm } from './audio.js';

// 가로 폭은 기기 화면 비율에 맞춰 게임마다 정해요 (240~340)
let W = 240;
const H = 144;
const GROUND = 122;
let DOG_X = 52; // 넓은 가로 화면에서는 점프 버튼에 가리지 않게 오른쪽으로 옮겨요
const GRAVITY = 760;
const JUMP_V = -270;
const DOUBLE_V = -235;
// 체력: 처음엔 천천히 줄고, 오래 달릴수록 조금씩 빨라져요 (아무것도 안 부딪혀도 1분 넘게 달려요)
const HP = { drain: (t) => 1.3 + Math.min(1.2, t / 100), hit: 14, heart: 35, heartEvery: 9 };
const OUT = '#4a3330';

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function ellipse(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
  }
}

// ---------- 배경 레이어 (반복 타일) ----------
function layer(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  return c;
}
const tri = (ctx, cx, top, h, c) => { for (let i = 0; i < h; i++) rect(ctx, cx - Math.floor(i / 2), top + i, Math.floor(i / 2) * 2 + 1, 1, c); };

// 맵마다 하늘·먼 풍경·가까운 풍경·땅·장애물 모습이 달라요 (규칙은 같아요)
const THEMES = {
  // 초록 들판
  meadow: {
    sky: ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'],
    haze: 'rgba(216,241,255,0.45)',
    sun: (ctx, w) => { ellipse(ctx, w - 26, 22, 8, 8, '#fff3b0'); ellipse(ctx, w - 26, 22, 6, 6, '#ffe066'); },
    far: (w) => layer(w, 60, (ctx) => {
      for (const [x, r, c] of [[20, 34, '#4f9e44'], [90, 44, '#3f8f3a'], [160, 30, '#4f9e44'], [220, 40, '#3f8f3a']]) {
        ellipse(ctx, x, 60, r, r * 0.9, OUT); ellipse(ctx, x, 61, r - 1, r * 0.9 - 1, c);
        ellipse(ctx, x - r * 0.3, 60 - r * 0.6, r * 0.25, r * 0.12, '#6cc070');
      }
    }),
    mid: (w) => layer(w, 60, (ctx) => {
      for (const x of [30, 110, 190]) {
        rect(ctx, x - 2, 34, 5, 26, '#7a4b2a'); rect(ctx, x - 2, 34, 1, 26, '#94603a');
        ellipse(ctx, x, 28, 14, 12, OUT); ellipse(ctx, x, 28, 13, 11, '#2f7a33'); ellipse(ctx, x - 4, 23, 6, 4, '#4f9e44');
      }
      for (const x of [70, 150, 230]) {
        ellipse(ctx, x, 54, 12, 7, OUT); ellipse(ctx, x, 54, 11, 6, '#3f8f3a'); ellipse(ctx, x - 3, 51, 4, 2, '#6cc070');
        rect(ctx, x + 3, 50, 2, 2, '#ff9fb8'); rect(ctx, x - 6, 53, 2, 2, '#ffe066');
      }
    }),
    // 배경 울타리는 연하고 흐리게 (장애물이 잘 보이도록)
    near: (w) => layer(w, 24, (ctx) => {
      const line = '#c9b8a4';
      rect(ctx, 0, 8, w, 3, '#e8dccb'); rect(ctx, 0, 15, w, 3, '#e8dccb');
      for (let x = 4; x < w; x += 16) {
        rect(ctx, x - 1, 1, 7, 23, line); rect(ctx, x, 2, 5, 22, '#f6efe4'); rect(ctx, x, 2, 1, 22, '#fffaf2');
        rect(ctx, x + 1, 0, 3, 2, line);
      }
    }),
    ground: (w) => layer(w, H - GROUND, (ctx) => {
      rect(ctx, 0, 0, w, 5, '#57a84b');
      for (let x = 0; x < w; x += 4) rect(ctx, x, 0, 2, 2 + ((x / 4) % 2), '#6cc070');
      rect(ctx, 0, 5, w, H - GROUND - 5, '#c98a4b');
      rect(ctx, 0, 5, w, 1, '#8a5429');
      for (let i = 0; i < 40; i++) rect(ctx, (i * 37) % w, 9 + ((i * 11) % (H - GROUND - 11)), 3, 2, i % 2 ? '#b0743c' : '#dca36a');
    }),
    low: drawHydrant,
    blocks: [['#4f7dff', '#8fb0ff', '#2f58d6'], ['#ff4f86', '#ff9dbb', '#d62f63'], ['#8a4fff', '#b99bff', '#6a2fdc']],
    wash: { line: OUT, sock: '#2f6fff', shirt: '#ff8a1c', towel: '#e8408a', stripe: '#ffffff', peg: '#ffe066' },
  },
  // 햇살 바닷가
  beach: {
    sky: ['#7fd0ff', '#95d9ff', '#aee3ff', '#c6ecff'],
    haze: 'rgba(198,236,255,0.35)',
    sun: (ctx, w) => { ellipse(ctx, w - 30, 20, 11, 11, '#fff3b0'); ellipse(ctx, w - 30, 20, 8, 8, '#ffd23f'); },
    far: (w) => layer(w, 60, (ctx) => {
      ellipse(ctx, 60, 30, 26, 8, '#6cc070'); rect(ctx, 30, 30, 60, 4, '#6cc070'); // 먼 섬
      rect(ctx, 0, 30, w, 30, '#3fa9f5');
      for (let y = 34; y < 60; y += 6) for (let x = (y * 7) % 18; x < w; x += 18) rect(ctx, x, y, 6, 1, '#8fd4ff');
      rect(ctx, 0, 30, w, 2, '#bfe9ff');
    }),
    mid: (w) => layer(w, 60, (ctx) => {
      for (const x of [40, 170]) { // 야자수
        for (let i = 0; i < 30; i++) rect(ctx, x + Math.round(Math.sin(i / 10) * 3), 30 + i, 4, 1, i % 4 ? '#b07a45' : '#8a5a2b');
        for (const [dx, dy] of [[-10, -2], [10, -2], [-6, -6], [6, -6], [0, -8]]) { ellipse(ctx, x + 2 + dx, 30 + dy, 9, 3, OUT); ellipse(ctx, x + 2 + dx, 30 + dy, 8, 2, '#2f9e5a'); }
        ellipse(ctx, x + 1, 32, 2, 2, '#7a4b2a'); ellipse(ctx, x + 4, 33, 2, 2, '#7a4b2a');
      }
      // 파라솔
      const x = 105;
      rect(ctx, x, 36, 2, 24, '#ffffff');
      for (let i = 0; i < 8; i++) rect(ctx, x - 14 + i * 2, 36 - Math.min(i, 7 - i), 30 - i * 4 < 0 ? 0 : 30 - i * 4, 1, i % 2 ? '#ff5d7a' : '#ffffff');
    }),
    near: (w) => layer(w, 24, (ctx) => {
      rect(ctx, 0, 10, w, 2, '#e3c38a');
      for (let x = 6; x < w; x += 24) { rect(ctx, x, 6, 4, 18, '#e8d2a8'); rect(ctx, x, 6, 4, 1, '#f7ead0'); }
    }),
    ground: (w) => layer(w, H - GROUND, (ctx) => {
      rect(ctx, 0, 0, w, H - GROUND, '#f2cf86');
      rect(ctx, 0, 0, w, 3, '#fbe3a8');
      for (let i = 0; i < 40; i++) rect(ctx, (i * 31) % w, 5 + ((i * 7) % (H - GROUND - 6)), 2, 1, i % 3 ? '#d9b06a' : '#ffffff');
      for (let x = 20; x < w; x += 70) { rect(ctx, x, 10, 3, 2, '#ff9fb8'); rect(ctx, x + 1, 9, 1, 1, '#ffc2d6'); }
    }),
    low: drawSandcastle,
    blocks: [['#ff6f3c', '#ffa27f', '#d6481a'], ['#1fb5a8', '#6fe0d6', '#0f8a80'], ['#4f7dff', '#8fb0ff', '#2f58d6']],
    wash: { line: OUT, sock: '#ff4f86', shirt: '#1fb5a8', towel: '#ffb000', stripe: '#ffffff', peg: '#ff6f3c' },
  },
  // 눈꽃 마을
  snow: {
    sky: ['#9fb4e0', '#b2c4e8', '#c6d4f0', '#d9e3f6'],
    haze: 'rgba(217,227,246,0.4)',
    sun: () => {},
    flakes: true,
    far: (w) => layer(w, 60, (ctx) => {
      for (const [x, r] of [[20, 34], [90, 44], [160, 30], [220, 40]]) {
        ellipse(ctx, x, 60, r, r * 0.9, '#8fa3c8'); ellipse(ctx, x, 61, r - 1, r * 0.9 - 1, '#eef4ff');
        ellipse(ctx, x + r * 0.3, 60 - r * 0.2, r * 0.4, r * 0.5, '#d3e0f5');
      }
    }),
    mid: (w) => layer(w, 60, (ctx) => {
      for (const x of [25, 95, 150, 215]) {
        rect(ctx, x - 1, 50, 3, 10, '#6b4a33');
        tri(ctx, x, 14, 38, OUT); tri(ctx, x, 16, 35, '#2d6b4a');
        tri(ctx, x, 16, 9, '#ffffff'); rect(ctx, x - 8, 34, 6, 2, '#ffffff'); rect(ctx, x + 3, 42, 7, 2, '#ffffff');
      }
    }),
    near: (w) => layer(w, 24, (ctx) => {
      rect(ctx, 0, 9, w, 3, '#d9c7b4'); rect(ctx, 0, 16, w, 3, '#d9c7b4');
      for (let x = 4; x < w; x += 16) { rect(ctx, x, 3, 5, 21, '#e8dccb'); rect(ctx, x - 1, 1, 7, 3, '#ffffff'); }
    }),
    ground: (w) => layer(w, H - GROUND, (ctx) => {
      rect(ctx, 0, 0, w, H - GROUND, '#d6e4f7');
      rect(ctx, 0, 0, w, 5, '#ffffff');
      for (let x = 0; x < w; x += 6) rect(ctx, x, 5, 3, 1 + (x % 12 ? 0 : 1), '#ffffff');
      for (let i = 0; i < 40; i++) rect(ctx, (i * 29) % w, 9 + ((i * 13) % (H - GROUND - 10)), 2, 1, i % 2 ? '#b8cce9' : '#ffffff');
    }),
    low: drawSnowman,
    blocks: [['#e84a5f', '#ff8f9f', '#b8283c'], ['#2f9e5a', '#6cd08a', '#1d7440'], ['#7b5cff', '#a893ff', '#5a3bdc']],
    wash: { line: OUT, sock: '#e84a5f', shirt: '#2f9e5a', towel: '#7b5cff', stripe: '#ffffff', peg: '#ffd23f' },
  },
  // 사탕 나라
  candy: {
    sky: ['#ffc4e6', '#ffd2ec', '#ffe0f2', '#ffedf8'],
    haze: 'rgba(255,237,248,0.35)',
    sun: (ctx, w) => {
      ['#ff5d7a', '#ffb000', '#ffe066', '#6cc070', '#5bc0ff'].forEach((c, i) => {
        for (let a = 0; a <= 20; a++) { const t = Math.PI * (a / 20); rect(ctx, 30 - Math.cos(t) * (22 - i * 2), 40 - Math.sin(t) * (22 - i * 2), 2, 2, c); }
      });
      ellipse(ctx, w - 26, 22, 8, 8, '#fff3b0'); ellipse(ctx, w - 26, 22, 6, 6, '#ffb3d9');
    },
    far: (w) => layer(w, 60, (ctx) => {
      for (const [x, r] of [[20, 34], [90, 44], [160, 30], [220, 40]]) {
        ellipse(ctx, x, 60, r, r * 0.9, '#c2508a'); ellipse(ctx, x, 61, r - 1, r * 0.9 - 1, '#ff9fd0');
        ellipse(ctx, x, 60 - r * 0.75, r * 0.5, r * 0.18, '#ffffff');
        for (let i = -2; i <= 2; i++) rect(ctx, x + i * r * 0.2, 60 - r * 0.7, 2, 3 + ((i + 3) % 3) * 2, '#ffffff');
      }
    }),
    mid: (w) => layer(w, 60, (ctx) => {
      [[30, '#ff5d7a'], [100, '#5bc0ff'], [170, '#ffb000'], [230, '#8a4fff']].forEach(([x, c]) => {
        rect(ctx, x - 1, 30, 3, 30, '#ffffff'); rect(ctx, x - 1, 30, 1, 30, '#f0d0e0');
        ellipse(ctx, x, 24, 11, 11, OUT); ellipse(ctx, x, 24, 10, 10, c);
        ellipse(ctx, x, 24, 6, 6, '#ffffff'); ellipse(ctx, x, 24, 4, 4, c); ellipse(ctx, x, 24, 1.5, 1.5, '#ffffff');
      });
    }),
    near: (w) => layer(w, 24, (ctx) => {
      for (let x = 4; x < w; x += 18) {
        rect(ctx, x, 4, 4, 20, '#fff4f8');
        for (let y = 5; y < 24; y += 5) rect(ctx, x, y, 4, 2, '#ffb3c6');
        rect(ctx, x + 1, 1, 4, 3, '#fff4f8'); rect(ctx, x + 4, 3, 2, 3, '#ffb3c6');
      }
    }),
    ground: (w) => layer(w, H - GROUND, (ctx) => {
      rect(ctx, 0, 0, w, H - GROUND, '#8a5429');
      rect(ctx, 0, 0, w, 5, '#ff8fc8');
      for (let x = 0; x < w; x += 7) rect(ctx, x, 5, 4, 2 + (x % 14 ? 0 : 2), '#ff8fc8');
      ['#ffe066', '#5bc0ff', '#ffffff', '#6cc070'].forEach((c, k) => { for (let x = k * 5; x < w; x += 19) rect(ctx, x, 1 + (k % 3), 2, 1, c); });
      for (let i = 0; i < 30; i++) rect(ctx, (i * 37) % w, 10 + ((i * 11) % (H - GROUND - 12)), 3, 2, '#a86b3a');
    }),
    low: drawCupcake,
    blocks: [['#4fc3ff', '#a0e2ff', '#1f93d6'], ['#8a4fff', '#b99bff', '#6a2fdc'], ['#29c46a', '#7fe0a4', '#1a9450']],
    wash: { line: '#c2508a', sock: '#ff5d5d', shirt: '#29c46a', towel: '#4fc3ff', stripe: '#ffffff', peg: '#ffe066' },
  },
};
let T = THEMES.meadow;

// ---------- 장애물 그리기 ----------
function drawHydrant(ctx, x, y) {
  rect(ctx, x - 2, y - 2, 18, 21, OUT);
  rect(ctx, x + 1, y + 2, 12, 15, '#e84a5f'); rect(ctx, x + 2, y + 2, 2, 15, '#ff7f8f');
  rect(ctx, x + 3, y, 8, 3, '#e84a5f'); rect(ctx, x - 1, y + 7, 16, 4, OUT); rect(ctx, x, y + 8, 14, 2, '#c2334a');
  rect(ctx, x + 6, y + 11, 2, 2, '#ffe066');
}
// 모래성 (진한 주황 + 빨간 깃발)
function drawSandcastle(ctx, x, y) {
  rect(ctx, x - 2, y + 3, 18, 16, OUT);
  rect(ctx, x, y + 5, 14, 12, '#e0892f'); rect(ctx, x, y + 5, 14, 2, '#f5a94f');
  for (const cx of [x - 1, x + 5, x + 11]) { rect(ctx, cx, y, 5, 6, OUT); rect(ctx, cx + 1, y + 1, 3, 4, '#e0892f'); }
  rect(ctx, x + 5, y + 11, 4, 6, '#8a4a1c');
  rect(ctx, x + 7, y - 8, 1, 8, OUT); rect(ctx, x + 8, y - 8, 5, 3, '#e84a5f');
}
// 눈사람 (진한 테두리 + 빨간 목도리)
function drawSnowman(ctx, x, y) {
  ellipse(ctx, x + 7, y + 12, 8, 6, OUT); ellipse(ctx, x + 7, y + 12, 7, 5, '#ffffff');
  ellipse(ctx, x + 7, y + 4, 6, 5, OUT); ellipse(ctx, x + 7, y + 4, 5, 4, '#ffffff');
  rect(ctx, x + 2, y + 7, 11, 2, '#e84a5f'); rect(ctx, x + 10, y + 8, 2, 4, '#e84a5f');
  rect(ctx, x + 5, y + 3, 1, 1, OUT); rect(ctx, x + 9, y + 3, 1, 1, OUT); rect(ctx, x + 7, y + 5, 3, 1, '#ff8a1c');
  rect(ctx, x + 3, y - 3, 9, 3, OUT); rect(ctx, x + 5, y - 7, 5, 5, OUT); rect(ctx, x + 6, y - 6, 3, 3, '#3a3a4a');
  rect(ctx, x + 7, y + 12, 1, 1, OUT); rect(ctx, x + 7, y + 14, 1, 1, OUT);
}
// 컵케이크 (파란 컵 + 흰 크림 + 체리)
function drawCupcake(ctx, x, y) {
  rect(ctx, x - 1, y + 7, 16, 11, OUT);
  rect(ctx, x + 1, y + 8, 12, 9, '#4fc3ff');
  for (let i = 0; i < 12; i += 3) rect(ctx, x + 1 + i, y + 8, 1, 9, '#1f93d6');
  ellipse(ctx, x + 7, y + 5, 9, 5, OUT); ellipse(ctx, x + 7, y + 5, 8, 4, '#ffffff'); ellipse(ctx, x + 7, y + 3, 5, 3, '#ffe3f0');
  ellipse(ctx, x + 7, y - 2, 3, 3, OUT); ellipse(ctx, x + 7, y - 2, 2, 2, '#e8264a');
  rect(ctx, x + 3, y + 4, 1, 1, '#ff5d7a'); rect(ctx, x + 10, y + 5, 1, 1, '#29c46a'); rect(ctx, x + 6, y + 6, 1, 1, '#ffb000');
}
// 장난감 블록: 배경(하늘·풀·흙)과 겹치지 않는 선명한 색 + 두꺼운 테두리 (맵마다 색이 달라요)
function drawBox(ctx, x, y, h, c0 = 0) {
  let i = c0;
  for (let yy = y; yy < y + h; yy += 17) {
    const [c, l, d] = T.blocks[i % T.blocks.length]; i += 1;
    rect(ctx, x - 2, yy - 2, 20, 20, OUT);
    rect(ctx, x, yy, 16, 16, c); rect(ctx, x, yy, 16, 3, l); rect(ctx, x, yy + 13, 16, 3, d);
    rect(ctx, x + 5, yy + 5, 6, 6, '#ffffff'); rect(ctx, x + 6, yy + 6, 4, 4, l); // 가운데 별 무늬
  }
}

// 땅 그림자 + 테두리 강조
function obstacleShadow(ctx, x, w) {
  ctx.fillStyle = 'rgba(40,20,10,0.35)';
  ctx.fillRect(Math.round(x - 1), GROUND - 1, w + 2, 3);
}
// 빨랫줄: 굵고 진한 줄 + 선명한 빨래 (아래로 슬라이드해서 지나가요)
function drawLaundry(ctx, x, y) {
  const c = T.wash;
  rect(ctx, x - 8, y - 3, 50, 3, c.line);
  // 양말
  rect(ctx, x - 2, y - 1, 10, 14, OUT); rect(ctx, x, y + 1, 6, 10, c.sock); rect(ctx, x - 2, y + 9, 12, 7, OUT); rect(ctx, x, y + 11, 8, 3, c.sock);
  rect(ctx, x, y + 1, 6, 2, '#ffffff');
  // 셔츠
  rect(ctx, x + 10, y - 1, 16, 22, OUT); rect(ctx, x + 12, y + 1, 12, 18, c.shirt); rect(ctx, x + 7, y, 5, 8, OUT); rect(ctx, x + 24, y, 5, 8, OUT);
  rect(ctx, x + 8, y + 1, 3, 6, c.shirt); rect(ctx, x + 25, y + 1, 3, 6, c.shirt); rect(ctx, x + 16, y + 6, 4, 4, '#ffffff');
  // 수건 (줄무늬)
  rect(ctx, x + 30, y - 1, 9, 19, OUT); rect(ctx, x + 32, y + 1, 5, 15, c.towel); rect(ctx, x + 32, y + 5, 5, 2, c.stripe); rect(ctx, x + 32, y + 11, 5, 2, c.stripe);
  // 빨래집게
  for (const cx of [x + 2, x + 17, x + 33]) rect(ctx, cx, y - 5, 3, 5, c.peg);
}

const OBSTACLES = {
  hydrant: { w: 14, h: 17, draw: (ctx, o) => T.low(ctx, o.x, GROUND - 17), box: (o) => ({ x: o.x + 1, y: GROUND - 16, w: 12, h: 16 }) },
  box: { w: 16, h: 16, draw: (ctx, o) => drawBox(ctx, o.x, GROUND - 16, 16, o.c ?? 0), box: (o) => ({ x: o.x + 1, y: GROUND - 15, w: 14, h: 15 }) },
  tower: { w: 16, h: 33, draw: (ctx, o) => drawBox(ctx, o.x, GROUND - 33, 33, o.c ?? 0), box: (o) => ({ x: o.x + 1, y: GROUND - 32, w: 14, h: 32 }) },
  laundry: { w: 34, h: 20, draw: (ctx, o) => drawLaundry(ctx, o.x, GROUND - 38), box: (o) => ({ x: o.x, y: GROUND - 40, w: 34, h: 25 }) },
};

// 하늘 + 풍경 (게임 화면과 맵 고르기 미리보기에서 같이 써요)
function drawScenery(ctx, w, layers, dist, t) {
  T.sky.forEach((c, i) => rect(ctx, 0, i * 16, w, 16, c));
  rect(ctx, 0, 64, w, 40, T.sky[3]);
  T.sun(ctx, w);
  for (const [x, y] of [[30, 16], [120, 26], [200, 12]]) {
    const cx = ((x - dist * 0.05) % (w + 40) + w + 40) % (w + 40) - 20;
    ellipse(ctx, cx, y, 10, 3, '#fff'); ellipse(ctx, cx + 5, y - 3, 6, 3, '#fff');
  }
  const tile = (img, offset, y) => {
    const x = -Math.floor(offset % img.width);
    ctx.drawImage(img, x, y);
    ctx.drawImage(img, x + img.width, y);
  };
  tile(layers.far, dist * 0.15, 46);
  tile(layers.mid, dist * 0.35, 58);
  ctx.fillStyle = T.haze; ctx.fillRect(0, 40, w, GROUND - 40); // 먼 풍경은 흐릿하게
  tile(layers.near, dist * 0.7, GROUND - 22);
  tile(layers.ground, dist, GROUND);
  if (T.flakes) {
    for (let i = 0; i < 26; i++) {
      const fx = ((i * 53 + t * 12 - dist * 0.3) % w + w) % w;
      const fy = ((i * 29 + t * (18 + (i % 5) * 4)) % (GROUND + 4));
      rect(ctx, fx, fy, i % 3 ? 1 : 2, i % 3 ? 1 : 2, '#ffffff');
    }
  }
}
const makeLayers = (w) => ({ far: T.far(w), mid: T.mid(w), near: T.near(w), ground: T.ground(w) });

// 맵 고르기 화면용 작은 그림
export function runnerMapPreview(map, w = 200) {
  const before = T;
  T = THEMES[map] ?? THEMES.meadow;
  const c = document.createElement('canvas');
  c.width = w; c.height = H;
  const ctx = c.getContext('2d');
  drawScenery(ctx, w, makeLayers(w), 0, 0);
  obstacleShadow(ctx, w * 0.55, 14);
  T.low(ctx, w * 0.55, GROUND - 17);
  drawBox(ctx, w * 0.8, GROUND - 16, 16, 1);
  T = before;
  return c.toDataURL();
}

// ---------- 맵별 간식(젤리) · 새 장애물 ----------
// 맵마다 먹는 간식 모양이 달라요: 들판 뼈다귀 · 바닷가 조개 · 눈꽃 마을 눈송이 · 사탕 나라 사탕
const JELLY = {
  meadow: null, // 기본 뼈다귀 코인 그림
  beach: ['..ooooo..', '.oppwppo.', 'oppwpwppo', 'opwpppwpo', 'oppppppo.', '.ooooooo.'],
  snow: ['...o...', '.o.w.o.', '..www..', 'owwlwwo', '..www..', '.o.w.o.', '...o...'],
  candy: ['o..ooo..o', 'oooyryooo', 'o.oryro.o', '...ooo...'],
};
const JELLY_COLORS = { o: OUT, p: '#ff9fb8', w: '#ffffff', l: '#9fd8ff', y: '#ffe066', r: '#ff5d7a' };
const jellyCache = {};
function jellyCanvas(map) {
  if (!JELLY[map]) return iconCanvas('coin');
  if (jellyCache[map]) return jellyCache[map];
  const rows = JELLY[map];
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length)); c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (JELLY_COLORS[ch]) { ctx.fillStyle = JELLY_COLORS[ch]; ctx.fillRect(x, y, 1, 1); } }));
  jellyCache[map] = c;
  return c;
}
// 날아오는 새: 슬라이드로 밑을 지나가요
function drawBird(ctx, x, y, t) {
  const flap = Math.floor(t * 8) % 2;
  rect(ctx, x, y + 2, 12, 6, OUT); rect(ctx, x + 1, y + 3, 10, 4, '#5b8cff');
  rect(ctx, x - 2, y + 3, 3, 2, '#ffb000'); rect(ctx, x + 2, y + 3, 1, 1, '#ffffff');
  if (flap) { rect(ctx, x + 4, y - 3, 6, 5, OUT); rect(ctx, x + 5, y - 2, 4, 3, '#8fb0ff'); } else { rect(ctx, x + 4, y + 7, 6, 4, OUT); rect(ctx, x + 5, y + 7, 4, 3, '#8fb0ff'); }
}
OBSTACLES.bird = { w: 12, h: 10, draw: (ctx, o, t) => drawBird(ctx, o.x, GROUND - 34, t), box: (o) => ({ x: o.x, y: GROUND - 33, w: 12, h: 9 }) };
const PLAT = { meadow: ['#6cc070', '#b0743c'], beach: ['#f7dc9b', '#c98a4b'], snow: ['#ffffff', '#8fc4f0'], candy: ['#ff8fc8', '#a86b3a'] };

// ---------- 패턴 (구간이 올라갈수록 어려운 모양이 섞여요) ----------
function makeChunk(x, stage, rnd, stars = 1, fever = false) {
  const items = []; const obs = []; const pits = []; const plats = [];
  const bone = (bx, by, kind = 'bone') => items.push({ x: bx, y: by, kind });
  if (fever) { // 피버: 간식이 세 줄로 쏟아져요
    for (let i = 0; i < 10; i++) for (const h of [12, 40, 68]) bone(x + i * 12, GROUND - h);
    return { items, obs, pits, plats, len: 120 };
  }
  const hard = Math.min(1, (stage - 1) / 5);
  const pool = [['line', 3], ['hydrant', 3], ['laundry', 2], ['tower', 1 + hard * 2], ['boxes', 2], ['plat', 2]];
  if (stage >= 2) pool.push(['pit', 2 + hard * 2]);
  if (stage >= 3) pool.push(['bird', 1.5 + hard * 2], ['platPit', 1 + hard]);
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rnd() * total; let kind = pool[0][0];
  for (const [k, w] of pool) { r -= w; if (r < 0) { kind = k; break; } }
  let len = 110;
  if (kind === 'line') { for (let i = 0; i < 7; i++) bone(x + i * 14, GROUND - 12); len = 98; }
  if (kind === 'hydrant') { obs.push({ type: 'hydrant', x: x + 42 }); for (let i = 0; i < 7; i++) bone(x + 12 + i * 12, GROUND - 14 - Math.sin((i / 6) * Math.PI) * 38); }
  if (kind === 'laundry') { obs.push({ type: 'laundry', x: x + 30 }); for (let i = 0; i < 6; i++) bone(x + 20 + i * 11, GROUND - 7); }
  if (kind === 'tower') { obs.push({ type: 'tower', x: x + 50, c: Math.floor(rnd() * 3) }); for (let i = 0; i < 8; i++) bone(x + 14 + i * 12, GROUND - 16 - Math.sin((i / 7) * Math.PI) * 62); len = 130; }
  if (kind === 'boxes') {
    obs.push({ type: 'box', x: x + 20, c: Math.floor(rnd() * 3) }, { type: 'box', x: x + 90 - hard * 16, c: Math.floor(rnd() * 3) });
    for (let i = 0; i < 4; i++) bone(x + 8 + i * 10, GROUND - 26 - i * 4);
    len = 120;
  }
  // 🕳️ 구멍: 빠지면 체력이 줄어요 (점프로 넘어요)
  if (kind === 'pit') {
    const w = Math.min(46, 26 + stage * 3);
    pits.push({ x: x + 40, w });
    for (let i = 0; i < 6; i++) bone(x + 30 + i * ((w + 20) / 5), GROUND - 16 - Math.sin((i / 5) * Math.PI) * 36);
    len = 90 + w;
  }
  // 🧱 2층 발판: 위로 올라가면 간식이 더 많아요
  if (kind === 'plat' || kind === 'platPit') {
    const h = 36 + Math.floor(rnd() * 10);
    plats.push({ x: x + 24, w: 84, h });
    for (let i = 0; i < 6; i++) bone(x + 32 + i * 13, GROUND - h - 10);
    if (kind === 'platPit') { pits.push({ x: x + 40, w: 52 }); len = 130; } else { obs.push({ type: 'hydrant', x: x + 60 }); len = 120; }
  }
  // 🐦 새: 슬라이드로 밑을 지나가요
  if (kind === 'bird') { obs.push({ type: 'bird', x: x + 50, vx: 30 + hard * 20 }); for (let i = 0; i < 6; i++) bone(x + 30 + i * 11, GROUND - 7); }
  if (rnd() < 0.25 * stars) items.push({ x: x + len / 2, y: GROUND - 74, kind: 'star' });
  return { items, obs, pits, plats, len };
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// 전체 화면 + 가로 고정 (안드로이드 크롬에서 동작, 아이폰은 안내 화면으로 대신해요)
// 사용자가 버튼을 누른 직후에 불러야 해요.
export function enterLandscape() {
  try {
    const p = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    Promise.resolve(p).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch { /* 지원하지 않는 브라우저 */ }
}

export function exitLandscape() {
  try { screen.orientation?.unlock?.(); } catch { /* 무시 */ }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

const STAGE_M = 300; // 이만큼 달릴 때마다 다음 구간 (더 빨라져요)
const FEVER = { perBone: 3, perStar: 12, secs: 6 };

// opts: { map, best, bestDist, boosters: ['hp','magnet','dash','fever'] }
// 결과: { score, dist(m), newBest }
export function playRunner(dog, { map = 'meadow', best = 0, bestDist = 0, boosters = [] } = {}) {
  T = THEMES[map] ?? THEMES.meadow;
  const plat = PLAT[map] ?? PLAT.meadow;
  const jelly = jellyCanvas(map);
  return new Promise((resolve) => {
    const touch = matchMedia('(pointer: coarse)').matches;
    const portrait = matchMedia('(orientation: portrait)');
    const aspect = touch
      ? Math.max(innerWidth, innerHeight) / Math.min(innerWidth, innerHeight)
      : innerWidth / innerHeight;
    W = Math.round(Math.min(340, Math.max(240, H * aspect)));
    DOG_X = W >= 280 ? 92 : 52;
    let allowPortrait = false;
    const needRotate = () => touch && portrait.matches && !allowPortrait;

    const canvas = el('canvas', { width: W, height: H, class: 'pixel runner-canvas' });
    const hud = {
      score: el('span', {}, '0개'), hp: el('i', {}), fever: el('i', {}), dist: el('span', {}, '0m'),
      best: el('span', { class: 'best' }, best ? `최고 ${best}개` : ''),
      shield: el('span', { class: 'score', hidden: true }, '🛡️ 방패'),
    };
    const jumpBtn = el('button', { class: 'run-btn jump', type: 'button', 'aria-label': '점프' }, '점프');
    const slideBtn = el('button', { class: 'run-btn slide', type: 'button', 'aria-label': '슬라이드' }, '슬라이드');
    const quitBtn = el('button', { class: 'run-quit', type: 'button' }, '그만하기');
    const rotateHint = el('div', { class: 'rotate-hint', hidden: true },
      el('div', { class: 'phone' }),
      el('p', {}, '휴대폰을 가로로 돌려 주세요!'),
      el('p', { class: 'small' }, '가로로 하면 앞이 더 멀리 보여서 장애물을 피하기 쉬워요.'),
      el('button', { class: 'btn small secondary', type: 'button', onclick: () => { allowPortrait = true; } }, '세로로 그냥 할래요'));
    const root = el('div', { class: 'runner-screen', role: 'dialog', 'aria-label': '멍뭉 런' },
      canvas,
      el('div', { class: 'run-hud' },
        el('span', { class: 'hp' }, '체력', el('span', { class: 'bar hp-bar' }, hud.hp)),
        el('span', { class: 'hp fever' }, '피버', el('span', { class: 'bar fever-bar' }, hud.fever)),
        el('span', { class: 'score' }, '간식 ', hud.score, ' · ', hud.dist),
        hud.best, hud.shield,
        quitBtn),
      jumpBtn, slideBtn, rotateHint);
    document.body.append(root);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const layers = makeLayers(W);
    let seed = (Date.now() % 100000) + 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xffff) / 0x10000; };

    // 튼튼 재능 · 출발 아이템(튼튼 체력)으로 체력이 늘어요
    const maxHp = 100 + (dog.effects?.runnerHp ?? 0) + (boosters.includes('hp') ? 40 : 0);
    // 스페셜 친구 능력: 간식 자석(뭉치) · 튼튼한 몸(뽀식이) · 별 두 배(키리쿠) · 방패(건) · 3단 점프(피츄)
    const fx = {
      magnet: !!dog.effects?.runnerMagnet, tough: !!dog.effects?.runnerTough,
      stars: dog.effects?.runnerStars ?? 1, jumps: dog.effects?.runnerJumps ?? 2,
    };
    let shield = dog.effects?.runnerShield ?? 0;
    const s = {
      t: 0, dist: 0, speed: 95, hp: maxHp, score: 0, y: 0, vy: 0, jumps: 0, sliding: false, slideHeld: false,
      hurtT: 0, items: [], obs: [], pits: [], plats: [], onPlat: null, falling: false,
      nextChunk: 30, nextHeart: 9, countdown: 3, over: false, overT: 0, pops: [], dust: [], paused: false,
      stage: 1, banner: null, fever: boosters.includes('fever') ? 50 : 0, feverT: 0,
      dashT: boosters.includes('dash') ? 4 : 0, magnetT: boosters.includes('magnet') ? 20 : 0, newBest: false,
    };

    const jump = () => {
      if (s.over || s.countdown > 0 || s.paused) return;
      if (s.jumps < fx.jumps) {
        s.vy = s.jumps === 0 ? JUMP_V : DOUBLE_V;
        s.jumps += 1;
        s.sliding = false;
        s.onPlat = null;
        sfx.jump();
      }
    };
    const slide = (on) => {
      s.slideHeld = on;
      if (on && s.jumps === 0 && !s.over && s.countdown <= 0 && !s.paused) { if (!s.sliding) sfx.slide(); s.sliding = true; }
      if (!on) s.sliding = false;
    };
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jumpBtn.classList.add('down'); jump(); });
    jumpBtn.addEventListener('pointerup', () => jumpBtn.classList.remove('down'));
    jumpBtn.addEventListener('pointercancel', () => jumpBtn.classList.remove('down'));
    slideBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); slideBtn.setPointerCapture(e.pointerId); slideBtn.classList.add('down'); slide(true); });
    const slideUp = () => { slideBtn.classList.remove('down'); slide(false); };
    slideBtn.addEventListener('pointerup', slideUp);
    slideBtn.addEventListener('pointercancel', slideUp);
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); if (s.over && s.overT > 1) finish(); else jump(); });
    quitBtn.addEventListener('click', () => {
      if (s.over) finish();
      else { s.over = true; s.hp = Math.max(0, s.hp); sfx.gameOver(); }
    });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    const onKey = (e) => {
      if (e.repeat && e.type === 'keydown') return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (e.type === 'keydown') jump(); }
      if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); slide(e.type === 'keydown'); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      playBgm('home');
      exitLandscape();
      root.remove();
      resolve({ score: s.score, dist: Math.floor(s.dist / 10), newBest: s.newBest });
    };
    playBgm('play');

    const dogBox = () => {
      const h = s.sliding ? 12 : 24;
      return { x: DOG_X - 10, y: GROUND - h + s.y, w: 20, h };
    };
    const pop = (text, y = GROUND - 34, x = DOG_X) => s.pops.push({ x, y, text, age: 0 });
    const hurt = (amount, text) => {
      s.hurtT = 1.2;
      if (shield > 0) { shield -= 1; sfx.star(); pop('방패!'); return; }
      s.hp -= fx.tough ? amount / 2 : amount;
      sfx.hurt(); pop(text);
      if (s.hp <= 0) { s.hp = 0; s.over = true; sfx.gameOver(); }
    };
    const overPit = () => s.pits.some((p) => !p.bridged && DOG_X > p.x + 3 && DOG_X < p.x + p.w - 3);
    const invincible = () => s.feverT > 0 || s.dashT > 0;

    const update = (dt) => {
      s.t += dt;
      if (s.countdown > 0) { s.countdown -= dt; return; }
      if (s.over) { s.overT += dt; s.speed = Math.max(0, s.speed - 200 * dt); }
      else {
        // 구간: 달릴수록 빨라지고 어려워져요 (무한의 계단처럼)
        const stage = 1 + Math.floor(s.dist / 10 / STAGE_M);
        if (stage > s.stage) { s.stage = stage; s.banner = { text: `구간 ${stage}! 더 빨라져요`, age: 0 }; sfx.levelUp(); }
        const base = Math.min(230, 95 + (s.stage - 1) * 14 + ((s.dist / 10) % STAGE_M) * 0.02);
        s.speed = base * (s.feverT > 0 ? 1.25 : 1) * (s.dashT > 0 ? 1.6 : 1);
        s.hp -= HP.drain(s.t) * dt;
        if (s.hp <= 0) { s.hp = 0; s.over = true; sfx.gameOver(); }
      }
      if (s.feverT > 0) { s.feverT -= dt; s.fever = Math.max(0, (s.feverT / FEVER.secs) * 100); if (s.feverT <= 0) s.fever = 0; }
      if (s.dashT > 0) s.dashT -= dt;
      if (s.magnetT > 0) s.magnetT -= dt;
      const dx = s.speed * dt;
      s.dist += dx;
      // 물리: 2층 발판 → 땅 (구멍이면 빠져요)
      const prevY = s.y;
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.onPlat) {
        const p = s.onPlat;
        if (DOG_X < p.x - 4 || DOG_X > p.x + p.w + 4) { s.onPlat = null; s.jumps = Math.max(s.jumps, 1); } else { s.y = -p.h; s.vy = 0; }
      }
      if (!s.onPlat && s.vy >= 0) {
        for (const p of s.plats) {
          if (DOG_X >= p.x - 4 && DOG_X <= p.x + p.w + 4 && prevY <= -p.h + 1 && s.y >= -p.h) {
            s.y = -p.h; s.vy = 0; s.onPlat = p;
            if (s.jumps > 0) sfx.land();
            s.jumps = 0; break;
          }
        }
      }
      if (!s.onPlat && s.y >= 0) {
        if (overPit() && !s.over) {
          if (!s.falling) { s.falling = true; s.jumps = Math.max(s.jumps, 1); }
          if (s.y > 34) { // 쏙 빠졌어요 → 구름 다리를 놓고 위에서 다시 출발
            for (const p of s.pits) if (DOG_X > p.x - 10 && DOG_X < p.x + p.w + 10) p.bridged = true;
            s.y = -46; s.vy = 0; s.falling = false; s.jumps = 1;
            if (invincible()) pop('퐁!'); else hurt(25, '앗, 퐁당!');
            s.hurtT = 1.5;
          }
        } else {
          if (s.jumps > 0 || s.falling) { sfx.land(); for (let i = 0; i < 3; i++) s.dust.push({ x: DOG_X - 6 + i * 4, y: GROUND - 2, age: 0 }); }
          s.y = 0; s.vy = 0; s.jumps = 0; s.falling = false;
          if (s.slideHeld && !s.sliding) s.sliding = true;
        }
      }
      // 새 구간 만들기
      s.nextChunk -= dx;
      if (s.nextChunk <= 0 && !s.over) {
        const c = makeChunk(W + 10, s.stage, rnd, fx.stars, s.feverT > 0);
        s.items.push(...c.items); s.obs.push(...c.obs); s.pits.push(...c.pits); s.plats.push(...c.plats);
        s.nextChunk = c.len + Math.max(30, 60 - s.stage * 4) + rnd() * 40;
      }
      s.nextHeart -= dt;
      if (s.nextHeart <= 0 && !s.over) { s.items.push({ x: W + 20, y: GROUND - 44, kind: 'heart' }); s.nextHeart = HP.heartEvery + rnd() * 4; }
      for (const it of s.items) it.x -= dx;
      for (const o of s.obs) o.x -= dx + (o.vx ?? 0) * dt;
      for (const p of s.pits) p.x -= dx;
      for (const p of s.plats) p.x -= dx;
      // 자석: 뭉치 · 간식 자석 아이템 · 피버
      if ((fx.magnet || s.magnetT > 0 || s.feverT > 0) && !s.over) {
        const r = s.feverT > 0 ? 60 : 36;
        for (const it of s.items) {
          if (it.kind === 'heart') continue;
          const mx = DOG_X - it.x; const my = GROUND - 12 + s.y - it.y;
          if (mx * mx + my * my < r * r) { it.x += mx * Math.min(1, 6 * dt); it.y += my * Math.min(1, 6 * dt); }
        }
      }
      s.items = s.items.filter((it) => it.x > -20 && !it.taken);
      s.obs = s.obs.filter((o) => o.x > -50);
      s.pits = s.pits.filter((p) => p.x + p.w > -20);
      s.plats = s.plats.filter((p) => p.x + p.w > -20);
      if (s.hurtT > 0) s.hurtT -= dt;
      if (!s.over) {
        const box = dogBox();
        for (const it of s.items) {
          const ib = { x: it.x - 5, y: it.y - 5, w: 10, h: 10 };
          if (!hit(box, ib)) continue;
          it.taken = true;
          const mult = s.feverT > 0 ? 2 : 1;
          if (it.kind === 'bone') { s.score += mult; sfx.catch(); if (!s.feverT) s.fever = Math.min(100, s.fever + FEVER.perBone); }
          if (it.kind === 'star') { s.score += 10 * mult; sfx.star(); pop(`+${10 * mult}`, it.y, it.x); if (!s.feverT) s.fever = Math.min(100, s.fever + FEVER.perStar); }
          if (it.kind === 'heart') { s.hp = Math.min(maxHp, s.hp + HP.heart); sfx.love(); pop('체력 UP', it.y, it.x); }
        }
        // 🔥 피버 타임!
        if (s.fever >= 100 && s.feverT <= 0) { s.feverT = FEVER.secs; s.banner = { text: '🔥 피버 타임! 🔥', age: 0, fever: true }; sfx.levelUp(); }
        if (!s.newBest && best > 0 && s.score > best) { s.newBest = true; s.banner = { text: '🎉 최고 기록 경신!', age: 0 }; sfx.star(); }
        if (s.hurtT <= 0 && !invincible()) {
          for (const o of s.obs) {
            if (!o.hit && hit(box, OBSTACLES[o.type].box(o))) {
              o.hit = true;
              hurt(HP.hit, '아야!');
              break;
            }
          }
        }
      }
      if (!s.over && s.jumps === 0 && Math.floor(s.t * 8) !== Math.floor((s.t - dt) * 8)) s.dust.push({ x: DOG_X - 10, y: GROUND - 2 + s.y, age: 0 });
      for (const p of s.pops) { p.age += dt; p.y -= 18 * dt; }
      s.pops = s.pops.filter((p) => p.age < 0.9);
      for (const d of s.dust) { d.age += dt; d.x -= dx * 0.6; d.y -= 6 * dt; }
      s.dust = s.dust.filter((d) => d.age < 0.4);
      if (s.banner) { s.banner.age += dt; if (s.banner.age > 1.8) s.banner = null; }
    };

    const draw = () => {
      drawScenery(ctx, W, layers, s.dist, s.t);
      // 🕳️ 구멍 (구름 다리가 놓이면 건널 수 있어요)
      for (const p of s.pits) {
        if (p.bridged) { for (let x = p.x; x < p.x + p.w; x += 6) { ellipse(ctx, x + 3, GROUND + 1, 5, 3, '#ffffff'); } continue; }
        rect(ctx, p.x, GROUND, p.w, H - GROUND, '#2a1d18');
        rect(ctx, p.x, GROUND, p.w, 3, '#140c0a');
        rect(ctx, p.x - 1, GROUND, 2, H - GROUND, OUT); rect(ctx, p.x + p.w - 1, GROUND, 2, H - GROUND, OUT);
      }
      // 🧱 2층 발판
      for (const p of s.plats) {
        const top = GROUND - p.h;
        rect(ctx, p.x - 1, top - 1, p.w + 2, 10, OUT);
        rect(ctx, p.x, top, p.w, 8, plat[1]); rect(ctx, p.x, top, p.w, 3, plat[0]);
        for (let x = p.x + 6; x < p.x + p.w - 4; x += 12) rect(ctx, x, top + 4, 2, 2, OUT);
      }
      // 장애물 (그림자 → 본체), 간식
      for (const o of s.obs) if (o.type !== 'bird') obstacleShadow(ctx, o.x, OBSTACLES[o.type].w);
      for (const o of s.obs) OBSTACLES[o.type].draw(ctx, o, s.t);
      // 곧 나타날 장애물 미리 알림: 오른쪽 끝에 빨간 "!"
      for (const o of s.obs) {
        if (o.x <= W || o.x > W + 70) continue;
        if (Math.floor(s.t * 6) % 2) continue;
        const def = OBSTACLES[o.type];
        const my = o.type === 'laundry' ? GROUND - 30 : o.type === 'bird' ? GROUND - 28 : GROUND - def.h / 2 - 2;
        ellipse(ctx, W - 7, my, 6, 6, OUT); ellipse(ctx, W - 7, my, 5, 5, '#e84a5f');
        rect(ctx, W - 8, my - 3, 2, 4, '#ffffff'); rect(ctx, W - 8, my + 2, 2, 1, '#ffffff');
      }
      for (const it of s.items) {
        const bob = Math.round(Math.sin(s.t * 6 + it.x * 0.1));
        const ic = it.kind === 'bone' ? jelly : iconCanvas(it.kind);
        ctx.drawImage(ic, Math.round(it.x - ic.width / 2), Math.round(it.y - ic.height / 2) + bob);
      }
      for (const d of s.dust) {
        ctx.globalAlpha = 1 - d.age / 0.4;
        rect(ctx, d.x, d.y, 3, 2, '#f0dcc0');
        ctx.globalAlpha = 1;
      }
      // 강아지 (피버·부스트 때는 무지개 잔상)
      if (s.feverT > 0 || s.dashT > 0) {
        ['#ff6f91', '#ffe066', '#6cc070', '#5b8cff'].forEach((c, i) => { ctx.globalAlpha = 0.35; rect(ctx, DOG_X - 22 - i * 5, GROUND - 22 + s.y + i * 2, 12, 4, c); });
        ctx.globalAlpha = 1;
      }
      const blink = s.hurtT > 0 && Math.floor(s.t * 12) % 2 === 0;
      if (!blink) {
        let pose; let opts;
        if (s.over) { pose = 'lie'; opts = { eyes: 'closed' }; }
        else if (s.sliding) { pose = 'lie'; opts = { eyes: 'happy', mouth: 'tongue' }; }
        else if (s.jumps > 0 || s.falling) { pose = 'walk1'; opts = { eyes: s.falling ? 'sad' : 'happy', mouth: 'open', tail: 1 }; }
        else { pose = Math.floor(s.t * 10) % 2 ? 'walk1' : 'walk2'; opts = { eyes: s.hurtT > 0 ? 'sad' : 'open', mouth: 'tongue', tail: Math.floor(s.t * 8) % 2 }; }
        const spr = dogSprite(dog.breed, dog.stage, pose, { ...opts, equip: dog.equip });
        const bounce = s.jumps === 0 && !s.sliding && !s.over ? -(Math.floor(s.t * 10) % 2) : 0;
        ctx.drawImage(spr.canvas, DOG_X - DOG_W / 2 + 2, Math.round(GROUND - 41 + s.y) + bounce);
      }
      if (s.feverT > 0) { ctx.fillStyle = `hsla(${(s.t * 200) % 360}, 90%, 70%, 0.12)`; ctx.fillRect(0, 0, W, H); }
      ctx.font = 'bold 11px Galmuri11';
      ctx.textAlign = 'center';
      for (const p of s.pops) {
        ctx.fillStyle = '#fff';
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(p.text, p.x + ox, p.y + oy);
        ctx.fillStyle = OUT; ctx.fillText(p.text, p.x, p.y);
      }
      if (s.banner) {
        const a = Math.min(1, (1.8 - s.banner.age) * 3);
        ctx.globalAlpha = a;
        ctx.font = 'bold 15px Galmuri11';
        const bw = ctx.measureText(s.banner.text).width + 24;
        ctx.fillStyle = s.banner.fever ? '#ff5d7a' : '#fffaf0'; ctx.fillRect(W / 2 - bw / 2, 26, bw, 24);
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - bw / 2, 26, bw, 24);
        ctx.fillStyle = s.banner.fever ? '#fff' : OUT; ctx.fillText(s.banner.text, W / 2, 43);
        ctx.globalAlpha = 1;
      }
      if (s.countdown > 0) {
        ctx.font = 'bold 24px Galmuri11';
        ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(s.countdown)), W / 2 + 2, 62);
        ctx.fillStyle = '#e8708f'; ctx.fillText(String(Math.ceil(s.countdown)), W / 2, 60);
        if (boosters.length) { ctx.font = 'bold 10px Galmuri11'; ctx.fillStyle = OUT; ctx.fillText(`출발 아이템: ${boosters.map((b) => ({ hp: '💪', magnet: '🧲', dash: '🚀', fever: '🔥' }[b])).join(' ')}`, W / 2, 80); }
      }
      if (s.over) {
        ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
        ctx.fillRect(W / 2 - 80, 22, 160, 72);
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 80, 22, 160, 72);
        ctx.fillStyle = OUT;
        ctx.font = 'bold 11px Galmuri11'; ctx.fillText(s.newBest ? '🎉 새 최고 기록!' : '헥헥… 다 뛰었어요!', W / 2, 39);
        ctx.font = '9px Galmuri11';
        ctx.fillText(`간식 ${s.score}개 · ${Math.floor(s.dist / 10)}m · 구간 ${s.stage}`, W / 2, 55);
        ctx.fillText(`최고 기록 ${Math.max(best, s.score)}개 · ${Math.max(bestDist, Math.floor(s.dist / 10))}m`, W / 2, 69);
        if (s.overT > 1) ctx.fillText('화면을 누르면 끝나요', W / 2, 85);
      }
      ctx.textAlign = 'start';
      hud.score.textContent = `${s.score}개`;
      hud.dist.textContent = `${Math.floor(s.dist / 10)}m`;
      hud.shield.hidden = shield <= 0;
      if (s.newBest) hud.best.textContent = '🎉 최고 기록!';
      const hpRatio = Math.max(0, s.hp) / maxHp;
      hud.hp.style.width = `${hpRatio * 100}%`;
      hud.hp.style.background = hpRatio > 0.5 ? 'var(--grass-l)' : hpRatio > 0.25 ? 'var(--butter)' : 'var(--red)';
      hud.fever.style.width = `${s.fever}%`;
      hud.fever.parentElement.classList.toggle('on', s.feverT > 0);
    };

    let last = performance.now();
    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // 세로로 들고 있으면 가로로 돌릴 때까지 잠깐 멈춰요
      const wait = needRotate();
      rotateHint.hidden = !wait;
      root.classList.toggle('portrait', portrait.matches);
      if (wait) {
        if (!s.paused) { s.paused = true; s.sliding = false; }
      } else {
        if (s.paused) { s.paused = false; if (!s.over) s.countdown = Math.max(s.countdown, 2); }
        update(dt);
      }
      draw();
      if (s.over && s.overT > 5) { finish(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
