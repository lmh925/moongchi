// 캡슐 뽑기 기계 연출: 손잡이를 돌리면 캡슐이 떨어지고, 열면 아이템이 나와요.
import { ITEMS, RARITY } from '../shared/data.js';
import { iconCanvas } from './sprites.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

const W = 120;
const H = 132;
const OUT = '#4a3330';
const CAPSULE_COLORS = ['#ff9fb8', '#7cc7ff', '#ffe066', '#9fe0c8', '#c9a8ff'];

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

function capsule(ctx, x, y, color, open = 0) {
  ellipse(ctx, x, y, 7, 7, OUT);
  ellipse(ctx, x, y, 6, 6, '#ffffff');
  // 위쪽 반은 색깔, 열리면 위로 들려요
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 8, y - 8 - open, 16, 8); ctx.clip();
  ellipse(ctx, x, y - open, 7, 7, OUT);
  ellipse(ctx, x, y - open, 6, 6, color);
  rect(ctx, x - 3, y - 4 - open, 2, 2, '#ffffff');
  ctx.restore();
}

function drawMachine(ctx, t, crank, shake) {
  ctx.clearRect(0, 0, W, H);
  const sx = shake ? Math.round(Math.sin(t * 60) * 1) : 0;
  // 유리 돔과 캡슐들
  ellipse(ctx, 60 + sx, 40, 36, 34, OUT);
  ellipse(ctx, 60 + sx, 40, 34, 32, '#e8f6ff');
  const caps = [[42, 52], [58, 58], [76, 52], [50, 40], [68, 42], [60, 28], [40, 30], [80, 32], [66, 64], [48, 64]];
  caps.forEach(([x, y], i) => {
    const wob = shake ? Math.round(Math.sin(t * 30 + i) * 2) : 0;
    capsule(ctx, x + sx, y + wob, CAPSULE_COLORS[i % CAPSULE_COLORS.length]);
  });
  rect(ctx, 38 + sx, 16, 6, 10, '#ffffff');
  // 몸통
  rect(ctx, 22 + sx, 68, 76, 56, OUT);
  rect(ctx, 24 + sx, 70, 72, 52, '#ff7fa3');
  rect(ctx, 24 + sx, 70, 72, 4, '#ffb3c8');
  rect(ctx, 24 + sx, 118, 72, 4, '#e0507f');
  // 코인 넣는 곳, 배출구
  rect(ctx, 76 + sx, 80, 12, 16, OUT); rect(ctx, 78 + sx, 82, 8, 12, '#ffe066'); rect(ctx, 81 + sx, 84, 2, 8, OUT);
  rect(ctx, 32 + sx, 100, 26, 16, OUT); rect(ctx, 34 + sx, 102, 22, 12, '#5a3a40');
  // 손잡이 (돌아가요)
  ellipse(ctx, 45 + sx, 86, 10, 10, OUT); ellipse(ctx, 45 + sx, 86, 9, 9, '#ffffff');
  const a = crank;
  const hx = 45 + Math.cos(a) * 7; const hy = 86 + Math.sin(a) * 7;
  const hx2 = 45 - Math.cos(a) * 7; const hy2 = 86 - Math.sin(a) * 7;
  for (let i = 0; i <= 8; i++) {
    const px = hx2 + ((hx - hx2) * i) / 8; const py = hy2 + ((hy - hy2) * i) / 8;
    rect(ctx, px - 1 + sx, py - 1, 3, 3, '#e84a5f');
  }
}

// result: { itemId, rarity, duplicate, refund, free }, thumb(itemId) → dataURL
export function playGacha(result, thumb) {
  return new Promise((resolve) => {
    const canvas = el('canvas', { width: W, height: H, class: 'pixel gacha-canvas' });
    const reveal = el('div', { class: 'gacha-reveal', hidden: true });
    const wrap = el('div', { class: 'modal-wrap' },
      el('div', { class: 'modal-card gacha-card' }, el('h2', { class: 'modal-title' }, '두근두근 캡슐 뽑기!'), canvas, reveal));
    document.getElementById('modal-root').append(wrap);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const item = ITEMS[result.itemId];
    const rar = RARITY[result.rarity];
    const color = result.rarity === 'epic' ? '#ffd23f' : result.rarity === 'rare' ? '#c9a8ff' : CAPSULE_COLORS[Math.floor(Math.random() * 3)];
    let t = 0;
    let last = performance.now();
    let clicked = 0;
    const close = (again) => { wrap.remove(); resolve(again); };
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const crank = t < 1.2 ? t * 9 : 1.2 * 9;
      if (t < 1.2 && Math.floor(t * 6) !== clicked) { clicked = Math.floor(t * 6); sfx.tap(); }
      drawMachine(ctx, t, crank, t < 1.2);
      // 캡슐이 떨어져서 통통 튀어요
      if (t > 1.2) {
        const k = Math.min(1, (t - 1.2) / 0.5);
        const y = 96 + k * 12 - Math.abs(Math.sin(k * Math.PI * 2)) * 6 * (1 - k);
        const open = t > 2 ? Math.min(10, (t - 2) * 30) : 0;
        capsule(ctx, 45, y, color, open);
        if (t > 2) {
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + t * 2;
            const r = 8 + (t - 2) * 30;
            ctx.drawImage(iconCanvas('sparkle'), Math.round(45 + Math.cos(ang) * r - 5), Math.round(y + Math.sin(ang) * r * 0.6 - 5));
          }
        }
      }
      if (Math.abs(t - 1.25) < dt) sfx.pop();
      if (t > 2.3) {
        showResult();
        return;
      }
      requestAnimationFrame(frame);
    };
    const showResult = () => {
      canvas.hidden = true;
      reveal.hidden = false;
      if (result.rarity === 'epic') sfx.levelUp(); else if (result.rarity === 'rare') sfx.star(); else sfx.love();
      reveal.append(
        el('div', { class: `gacha-item ${result.rarity}`, style: { '--glow': rar.color } },
          el('img', { class: 'pixel', src: thumb(result.itemId), alt: '' })),
        el('div', { class: 'rarity', style: { background: rar.color } }, rar.name),
        el('h3', {}, item.name),
        result.duplicate
          ? el('p', { class: 'help' }, `이미 가지고 있어서 뼈다귀 코인 ${result.refund}개로 바꿨어요!`)
          : el('p', { class: 'help' }, '새 아이템을 얻었어요! 꾸미기에서 써 보세요.'),
        el('div', { class: 'modal-buttons' },
          el('button', { class: 'btn secondary', onclick: () => close(false) }, '닫기'),
          el('button', { class: 'btn primary', onclick: () => close(true) }, '한 번 더!')));
    };
    requestAnimationFrame(frame);
  });
}
