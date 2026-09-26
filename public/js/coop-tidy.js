// 장난감 방 정리 정돈 — 화면 (규칙은 shared/coop/tidy.js, 판정은 서버)
// 두 사람 모두 장난감을 끌어다 놓을 수 있어요. 다 치우면 방이 아늑해지고 강아지들이 낮잠을 자요.
import { TIDY } from '../shared/coop/tidy.js';
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

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

function drawRoom(ctx) {
  rect(ctx, 0, 0, TIDY.W, 62, '#ffe3ec');
  for (let x = 0; x < TIDY.W; x += 12) rect(ctx, x, 0, 6, 62, '#ffd6e3');
  rect(ctx, 0, 58, TIDY.W, 4, '#c98a4b');
  rect(ctx, 0, 62, TIDY.W, TIDY.H - 62, '#e3b27a');
  for (let y = 62; y < TIDY.H; y += 10) rect(ctx, 0, y, TIDY.W, 1, '#c68c52');
  // 침대 (인형 자리)
  const bed = TIDY.targets.bear;
  rect(ctx, bed.x - 2, bed.y - 8, bed.w + 4, bed.h + 12, OUT);
  rect(ctx, bed.x - 1, bed.y - 7, bed.w + 2, 8, '#9c6b3f');
  rect(ctx, bed.x, bed.y, bed.w, bed.h, '#fff6fa');
  rect(ctx, bed.x, bed.y + bed.h / 2, bed.w, bed.h / 2, '#b3e0ff');
  for (let x = bed.x + 4; x < bed.x + bed.w; x += 8) rect(ctx, x, bed.y + bed.h / 2 + 3, 3, 3, '#ffffff');
  // 노란 바구니 (공 자리)
  const bk = TIDY.targets.ball;
  ellipse(ctx, bk.x + bk.w / 2, bk.y + 8, bk.w / 2 + 1, 7, OUT);
  rect(ctx, bk.x, bk.y + 8, bk.w, bk.h - 8, OUT);
  rect(ctx, bk.x + 1, bk.y + 9, bk.w - 2, bk.h - 10, '#ffd23f');
  for (let x = bk.x + 3; x < bk.x + bk.w - 2; x += 5) rect(ctx, x, bk.y + 10, 2, bk.h - 12, '#e0a800');
  ellipse(ctx, bk.x + bk.w / 2, bk.y + 8, bk.w / 2 - 1, 5, '#8a6a20');
  // 파란 상자 (뼈다귀 자리)
  const bx = TIDY.targets.bone;
  rect(ctx, bx.x, bx.y + 4, bx.w, bx.h - 4, OUT);
  rect(ctx, bx.x + 1, bx.y + 5, bx.w - 2, bx.h - 6, '#5b8cff');
  rect(ctx, bx.x + 1, bx.y + 5, bx.w - 2, 4, '#8fb0ff');
  rect(ctx, bx.x + bx.w / 2 - 6, bx.y + 16, 12, 5, '#dfe6f0');
}

function drawToy(ctx, t, scale = 1) {
  const { x, y } = t;
  if (t.kind === 'ball') {
    ellipse(ctx, x, y, 5 * scale, 5 * scale, OUT); ellipse(ctx, x, y, 4 * scale, 4 * scale, '#ff5d7a');
    rect(ctx, x - 4 * scale, y - 1, 8 * scale, 2, '#ffe066'); rect(ctx, x - 2, y - 3, 1, 1, '#fff');
  } else if (t.kind === 'bone') {
    for (const dx of [-5, 5]) { ellipse(ctx, x + dx * scale, y - 1, 2.5 * scale, 2.5 * scale, OUT); ellipse(ctx, x + dx * scale, y + 2, 2.5 * scale, 2.5 * scale, OUT); }
    rect(ctx, x - 5 * scale, y - 1, 10 * scale, 4, OUT);
    for (const dx of [-5, 5]) { ellipse(ctx, x + dx * scale, y - 1, 1.5 * scale, 1.5 * scale, '#fff6e6'); ellipse(ctx, x + dx * scale, y + 2, 1.5 * scale, 1.5 * scale, '#fff6e6'); }
    rect(ctx, x - 5 * scale, y, 10 * scale, 2, '#fff6e6');
  } else {
    ellipse(ctx, x, y + 2, 5 * scale, 6 * scale, OUT); ellipse(ctx, x, y - 5, 4.5 * scale, 4.5 * scale, OUT);
    ellipse(ctx, x - 4, y - 9, 2, 2, OUT); ellipse(ctx, x + 4, y - 9, 2, 2, OUT);
    ellipse(ctx, x, y + 2, 4 * scale, 5 * scale, '#c68642'); ellipse(ctx, x, y - 5, 3.5 * scale, 3.5 * scale, '#c68642');
    rect(ctx, x - 2, y - 6, 1, 1, OUT); rect(ctx, x + 1, y - 6, 1, 1, OUT); rect(ctx, x - 1, y - 4, 2, 1, OUT);
    rect(ctx, x - 3, y - 1, 6, 1, '#ff5d7a');
  }
}

export class TidyRenderer {
  constructor(host, { role, players, state, send }) {
    Object.assign(this, { role, players, state, send });
    this.endDelay = 3600; // 낮잠 장면을 볼 시간
    this.canvas = el('canvas', { width: TIDY.W, height: TIDY.H, class: 'pixel coop-canvas tidy-canvas' });
    this.msg = el('div', { class: 'coop-msg' }, '');
    this.count = el('span', {});
    host.append(
      el('p', { class: 'hint center' }, '장난감을 끌어서 제자리에 놓아요. 공은 노란 바구니, 뼈다귀는 파란 상자, 인형은 침대 위!'),
      el('div', { class: 'game-hud' }, this.count, el('span', {}, '천천히 해도 괜찮아요')),
      el('div', { class: 'coop-stage tidy-stage' }, this.canvas, this.msg));
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.anim = new Map(); // id -> { x, y } 화면에 보이는 위치 (부드럽게 따라가요)
    this.pop = new Map();
    this.drag = null;
    this.sparkles = [];
    this.t = 0; this.clearT = 0;
    this.bindDrag();
    this.renderCount();
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.t += dt;
      if (this.state.status === 'clear') this.clearT += dt;
      this.draw(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() { this.running = false; }

  toLocal(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * TIDY.W, y: ((e.clientY - r.top) / r.height) * TIDY.H };
  }

  bindDrag() {
    let lastSent = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = this.toLocal(e);
      const toy = this.state.toys
        .filter((t) => !t.placed && (!t.holder || t.holder === this.role))
        .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (!toy || toy.d > 11) return;
      this.canvas.setPointerCapture(e.pointerId);
      this.drag = { id: toy.t.id, x: p.x, y: p.y };
      this.send({ type: 'grab', id: toy.t.id });
      sfx.tap();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const p = this.toLocal(e);
      this.drag.x = p.x; this.drag.y = p.y;
      const now = performance.now();
      if (now - lastSent > 60) { lastSent = now; this.send({ type: 'move', id: this.drag.id, x: p.x, y: p.y }); }
    });
    const end = (e) => {
      if (!this.drag) return;
      const p = this.toLocal(e);
      this.send({ type: 'drop', id: this.drag.id, x: p.x, y: p.y });
      const a = this.anim.get(this.drag.id);
      if (a) { a.x = p.x; a.y = p.y; }
      this.drag = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
  }

  renderCount() {
    const n = this.state.toys.filter((t) => t.placed).length;
    this.count.textContent = `정리한 장난감 ${n}/${this.state.toys.length}`;
  }

  say(text, kind = '') {
    this.msg.textContent = text;
    this.msg.className = `coop-msg show ${kind}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msg.className = 'coop-msg'; }, 1200);
  }

  onState(state, events) {
    this.state = state;
    for (const ev of events) {
      if (ev.type === 'placed') {
        sfx.pop();
        this.pop.set(ev.id, 0.4);
        const t = state.toys.find((x) => x.id === ev.id);
        for (let i = 0; i < 4; i++) this.sparkles.push({ x: t.x + (Math.random() - 0.5) * 14, y: t.y - 6, age: -i * 0.08 });
        this.say(ev.role === this.role ? '쏙!' : '친구가 쏙!', 'good');
      }
      if (ev.type === 'return' && ev.role === this.role) { sfx.error(); this.say(ev.wrong ? '여기가 아니에요~' : '제자리를 찾아 줘요', 'bad'); }
      if (ev.type === 'clear') { sfx.levelUp(); this.say('다 치웠다!', 'good'); }
    }
    this.renderCount();
  }

  draw(dt) {
    const { ctx } = this;
    drawRoom(ctx);
    const clear = this.state.status === 'clear';
    // 강아지 두 마리: 평소엔 방 아래에서 구경, 다 치우면 가운데 엎드려 낮잠
    ['p1', 'p2'].forEach((r, i) => {
      const dog = this.players[r].dog;
      const sleep = clear && this.clearT > 0.8;
      const x = sleep ? 84 + i * 26 : 70 + i * 52;
      const y = sleep ? 96 : 140;
      const spr = dogSprite(dog.breed, dog.stage, sleep ? 'lie' : 'front', sleep ? { eyes: 'closed', equip: dog.equip } : { eyes: 'happy', mouth: 'tongue', tail: Math.floor(this.t * 4) % 2, equip: dog.equip });
      ctx.save();
      ctx.translate(x, y);
      if (sleep && i === 1) ctx.scale(-1, 1);
      ctx.drawImage(spr.canvas, sleep ? -DOG_W / 2 + 2 : -DOG_W / 2, -41);
      ctx.restore();
      if (sleep && Math.floor(this.t * 1.5 + i) % 2) ctx.drawImage(iconCanvas('sleepy'), x + (i ? -14 : 6), y - 30 - Math.round((this.t * 6) % 6));
    });
    // 장난감 (화면 위치는 서버 위치로 부드럽게 따라가요, 내가 끄는 건 손가락을 바로 따라와요)
    for (const t of this.state.toys) {
      let a = this.anim.get(t.id);
      if (!a) { a = { x: t.x, y: t.y }; this.anim.set(t.id, a); }
      if (this.drag?.id === t.id) { a.x = this.drag.x; a.y = this.drag.y; }
      else { const k = Math.min(1, dt * 10); a.x += (t.x - a.x) * k; a.y += (t.y - a.y) * k; }
      const pop = this.pop.get(t.id) ?? 0;
      if (pop > 0) this.pop.set(t.id, pop - dt);
      const scale = pop > 0 ? 1 + Math.sin((pop / 0.4) * Math.PI) * 0.35 : 1;
      const held = t.holder && this.drag?.id !== t.id;
      if (held) ellipse(ctx, a.x, a.y + 5, 7, 2, t.holder === this.role ? 'rgba(232,112,143,0.5)' : 'rgba(91,140,255,0.5)');
      drawToy(ctx, { ...t, x: a.x, y: a.y - (held || this.drag?.id === t.id ? 3 : 0) }, scale);
      if (held && t.holder !== this.role) ctx.drawImage(iconCanvas('paw'), Math.round(a.x + 4), Math.round(a.y - 12), 8, 7);
    }
    for (const s of this.sparkles) { s.age += dt; if (s.age > 0) ctx.drawImage(iconCanvas('sparkle'), Math.round(s.x - 5), Math.round(s.y - s.age * 20)); }
    this.sparkles = this.sparkles.filter((s) => s.age < 0.8);
    // 다 치우면 조명이 아늑하게
    if (clear) {
      ctx.fillStyle = `rgba(255, 170, 90, ${Math.min(0.28, this.clearT * 0.2)})`;
      ctx.fillRect(0, 0, TIDY.W, TIDY.H);
    }
  }
}
