// 영차영차 쿠션 탑 쌓기 — 화면 그리기 (규칙은 shared/coop/cushion.js, 판정은 서버)
import { CUSHION as C } from '../shared/coop/cushion.js';
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

const OUT = '#4a3330';
const COLORS = [['#ff9fb8', '#ffc2d3'], ['#9fe0c8', '#c9f2e2'], ['#ffe066', '#fff3a0'], ['#c9a8ff', '#e3d4ff'], ['#7cc7ff', '#bfe6ff']];

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

function drawCushion(ctx, x, y, i, alpha = 1) {
  const [c, l] = COLORS[i % COLORS.length];
  ctx.globalAlpha = alpha;
  rect(ctx, x, y + 1, C.CW, C.CH - 1, OUT);
  rect(ctx, x + 1, y, C.CW - 2, C.CH, OUT);
  rect(ctx, x + 1, y + 1, C.CW - 2, C.CH - 2, c);
  rect(ctx, x + 2, y + 1, C.CW - 6, 2, l);
  rect(ctx, x + C.CW / 2 - 1, y + 4, 2, 2, OUT);
  ctx.globalAlpha = 1;
}

export class CushionRenderer {
  constructor(host, { role, players, state, send, now }) {
    Object.assign(this, { role, players, state, send, now });
    this.canvas = el('canvas', { width: C.W, height: C.H, class: 'pixel coop-canvas' });
    this.msg = el('div', { class: 'coop-msg' }, '');
    const roleText = role === 'p1' ? '나는 쿠션 담당! 떨어지는 쿠션을 옮겨서 탑을 쌓아요.' : '나는 등반 담당! 쿠션을 밟고 올라가 뼈다귀를 잡아요.';
    const btn = (label, cls = '') => el('button', { class: `btn big cushion-btn ${cls}`, type: 'button' }, label);
    this.left = btn('◀');
    this.right = btn('▶');
    this.action = btn(role === 'p1' ? '빨리 내리기' : '점프!', 'primary');
    this.timer = el('div', { class: 'bar coop-time' }, el('i', {}));
    host.append(
      el('p', { class: 'hint center' }, roleText),
      this.timer,
      el('div', { class: 'coop-stage cushion-stage' }, this.canvas, this.msg),
      el('div', { class: 'cushion-controls' }, this.left, this.action, this.right));
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.view = { dogX: state.dog.x, dogY: state.dog.y, fx: 0, fy: 0 };
    this.t = 0; this.dizzy = 0; this.hop = 0;
    this.bindControls();
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.t += dt;
      this.dizzy = Math.max(0, this.dizzy - dt);
      this.hop = Math.max(0, this.hop - dt);
      this.draw(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  bindControls() {
    const hold = (btn, onDown, onUp) => {
      let timer = null;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('down');
        onDown();
        if (this.role === 'p1' && onUp === null) timer = setInterval(onDown, 90); // 꾹 누르면 계속 옮겨요
      });
      const up = () => { btn.classList.remove('down'); clearInterval(timer); timer = null; if (onUp) onUp(); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    };
    if (this.role === 'p1') {
      hold(this.left, () => this.send({ type: 'move', dir: -1 }), null);
      hold(this.right, () => this.send({ type: 'move', dir: 1 }), null);
      hold(this.action, () => { this.send({ type: 'drop' }); sfx.whoosh(); }, () => {});
    } else {
      hold(this.left, () => this.send({ type: 'walk', dir: -1 }), () => this.send({ type: 'walk', dir: 0 }));
      hold(this.right, () => this.send({ type: 'walk', dir: 1 }), () => this.send({ type: 'walk', dir: 0 }));
      hold(this.action, () => { this.send({ type: 'jump' }); }, () => {});
    }
    this.keys = new Set();
    this.onKey = (e) => {
      const down = e.type === 'keydown';
      if (e.repeat && !(this.role === 'p1' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) return;
      const map = { ArrowLeft: -1, ArrowRight: 1 };
      if (e.code in map) {
        e.preventDefault();
        if (this.role === 'p1') { if (down) this.send({ type: 'move', dir: map[e.code] }); }
        else this.send({ type: 'walk', dir: down ? map[e.code] : 0 });
      }
      if ((e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown') && down) {
        e.preventDefault();
        this.send(this.role === 'p1' ? { type: 'drop' } : { type: 'jump' });
      }
    };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
  }

  say(text, kind = '') {
    this.msg.textContent = text;
    this.msg.className = `coop-msg show ${kind}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msg.className = 'coop-msg'; }, 1400);
  }

  onState(state, events) {
    this.state = state;
    for (const ev of events) {
      if (ev.type === 'land') { sfx.pop(); this.hop = 0.3; if (ev.height >= 3) this.say(`쿠션 ${ev.height}층!`, 'good'); }
      if (ev.type === 'jump') sfx.jump();
      if (ev.type === 'collapse') { sfx.hurt(); this.dizzy = 2.2; this.say('와르르! 다시 해 봐요', 'bad'); }
      if (ev.type === 'reset') this.say('다시 시작!');
      if (ev.type === 'clear') { sfx.levelUp(); this.say('성공!', 'good'); }
    }
  }

  draw(dt) {
    const { ctx } = this;
    const s = this.state;
    const v = this.view;
    const k = Math.min(1, dt * 18);
    v.dogX += (s.dog.x - v.dogX) * k;
    v.dogY += (s.dog.y - v.dogY) * k;
    if (s.falling) { v.fx += (s.falling.x - v.fx) * Math.min(1, dt * 25); v.fy = s.falling.y; } else { v.fx = 60; }
    const left = Math.max(0, s.endsAt - this.now());
    this.timer.firstChild.style.width = `${Math.min(100, (left / (s.endsAt - s.startedAt)) * 100)}%`;
    // 방
    rect(ctx, 0, 0, C.W, C.H, '#fff1c9');
    for (let y = 8; y < C.FLOOR; y += 16) for (let x = (y / 16) % 2 ? 4 : 12; x < C.W; x += 16) rect(ctx, x, y, 2, 2, '#ffe3a0');
    rect(ctx, 0, C.FLOOR, C.W, C.H - C.FLOOR, '#dca36a');
    for (let x = 0; x < C.W; x += 20) rect(ctx, x, C.FLOOR, 1, C.H - C.FLOOR, '#b97f47');
    rect(ctx, 0, C.FLOOR, C.W, 2, '#8a5429');
    rect(ctx, 0, 0, C.WALL, C.FLOOR, '#c98a4b'); rect(ctx, C.WALL - 1, 0, 1, C.FLOOR, OUT);
    // 선반과 뼈다귀
    rect(ctx, C.SHELF.x, C.SHELF.y, C.W - C.SHELF.x, 5, OUT); rect(ctx, C.SHELF.x + 1, C.SHELF.y + 1, C.W - C.SHELF.x - 1, 3, '#b97f47');
    rect(ctx, C.SHELF.x + 6, C.SHELF.y + 5, 3, 10, OUT);
    const bob = Math.round(Math.sin(this.t * 3) * 1.5);
    if (s.status !== 'clear') ctx.drawImage(iconCanvas('coin', 2), C.BONE.x - 10, C.BONE.y - 12 + bob);
    // 쿠션 탑
    const collapsed = s.phase === 'collapsed';
    s.stack.forEach((c, i) => {
      if (collapsed) {
        const fall = Math.min(1, (2.2 - this.dizzy) * 1.5);
        const dir = i % 2 ? 1 : -1;
        drawCushion(ctx, c.x + dir * fall * (10 + i * 6), c.y + fall * (C.FLOOR - C.CH - c.y) * 0.9, i, 1 - fall * 0.3);
      } else drawCushion(ctx, c.x, c.y, i);
    });
    // 떨어지는 쿠션 + 떨어질 자리 안내선
    if (s.falling && !collapsed) {
      const idx = s.stack.length;
      for (let y = v.fy + C.CH + 2; y < C.FLOOR; y += 5) rect(ctx, v.fx + C.CW / 2, y, 1, 2, 'rgba(74,51,48,0.35)');
      drawCushion(ctx, v.fx, v.fy, idx);
    }
    // 강아지들: p1은 왼쪽 구석에서 응원, p2는 올라가요
    const cheer = this.players.p1.dog;
    const hop = this.hop > 0 ? -Math.round(Math.sin((this.hop / 0.3) * Math.PI) * 5) : 0;
    const p1spr = dogSprite(cheer.breed, cheer.stage, 'front', { eyes: s.status === 'clear' ? 'happy' : collapsed ? 'sad' : 'open', mouth: 'tongue', tail: Math.floor(this.t * 5) % 2, equip: cheer.equip });
    ctx.drawImage(p1spr.canvas, 24 - DOG_W / 2, C.FLOOR - 41 + hop);
    const climber = this.players.p2.dog;
    const air = !s.dog.onGround;
    const pose = air ? 'walk1' : s.dog.walk ? (Math.floor(this.t * 8) % 2 ? 'walk1' : 'walk2') : 'stand';
    const spr = dogSprite(climber.breed, climber.stage, pose, { eyes: collapsed ? 'sad' : 'happy', mouth: air ? 'open' : 'tongue', tail: Math.floor(this.t * 6) % 2, equip: climber.equip });
    ctx.save();
    ctx.translate(Math.round(v.dogX), Math.round(v.dogY));
    if (s.dog.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(spr.canvas, -DOG_W / 2 + 2, -41);
    ctx.restore();
    // 내 역할 표시
    const mine = this.role === 'p1' ? 24 : v.dogX;
    const mineY = this.role === 'p1' ? C.FLOOR + 4 : v.dogY + 4;
    rect(ctx, mine - 5, mineY, 10, 2, '#e8708f');
    // 어지러운 별
    if (this.dizzy > 0) {
      for (const [x, y] of [[24, C.FLOOR - 36], [v.dogX, v.dogY - 36]]) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 6 + (i * Math.PI * 2) / 3;
          ctx.drawImage(iconCanvas('star'), Math.round(x + Math.cos(a) * 9 - 5), Math.round(y + Math.sin(a) * 3 - 4));
        }
      }
    }
    if (s.status === 'clear') {
      for (const [x, y] of [[24, C.FLOOR - 44], [v.dogX, v.dogY - 44]]) ctx.drawImage(iconCanvas('heart'), Math.round(x - 5), Math.round(y + Math.sin(this.t * 5) * 2));
    }
  }
}
