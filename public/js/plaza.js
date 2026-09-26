// 멍뭉 놀이터 화면: 넓은 공원 맵 + 카메라 + 조이스틱/탭 이동 + 다른 강아지들
import { PLAZA, PLAZA_SPOTS } from '../shared/data.js';
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el } from './ui.js';

const VW = 192; // 화면에 보이는 크기 (월드 픽셀)
const VH = 144;
const WW = PLAZA.worldW;
const WH = PLAZA.worldH;
const OUT = '#4a3330';
const LONG_EMOTES = ['roll', 'dance', 'bang', 'sing'];

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

// 부딪히는 곳 (연못, 분수대, 나무 기둥, 선물 상자)
const TREES = [[18, 150], [36, 300], [150, 24], [300, 18], [462, 190], [466, 340], [196, 336], [300, 340], [20, 230], [160, 200], [330, 160]];
const OBSTACLES = [
  { x: 26, y: 34, w: 108, h: 52 }, // 연못
  { x: 218, y: 158, w: 44, h: 30 }, // 분수대
  { x: 92, y: 240, w: 26, h: 16 }, // 선물 상자
  ...TREES.map(([x, y]) => ({ x: x - 4, y: y - 3, w: 8, h: 5 })),
];

function blocked(x, y) {
  if (x < 6 || y < 14 || x > WW - 6 || y > WH - 4) return true;
  return OBSTACLES.some((o) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h);
}

function drawWorld() {
  const c = document.createElement('canvas');
  c.width = WW; c.height = WH;
  const ctx = c.getContext('2d');
  rect(ctx, 0, 0, WW, WH, '#57a84b');
  for (let i = 0; i < 900; i++) rect(ctx, (i * 53) % WW, (i * 97) % WH, 2, 1, i % 3 ? '#6cc070' : '#3f8f3a');
  // 산책길과 분수대 광장
  rect(ctx, 0, 168, WW, 22, '#e8c98f'); rect(ctx, 230, 0, 22, WH, '#e8c98f');
  ellipse(ctx, 240, 178, 52, 40, '#e8c98f');
  for (let x = 0; x < WW; x += 10) { rect(ctx, x, 168, 4, 1, '#d4b173'); rect(ctx, x + 5, 189, 4, 1, '#d4b173'); }
  // 연못
  ellipse(ctx, 80, 60, 58, 32, OUT); ellipse(ctx, 80, 60, 56, 30, '#5bb8e8'); ellipse(ctx, 70, 54, 40, 18, '#7cc7ff');
  for (const [x, y] of [[50, 58], [100, 66], [84, 48]]) { ellipse(ctx, x, y, 5, 3, '#3f8f3a'); rect(ctx, x, y - 1, 2, 2, '#ff9fb8'); }
  // 분수대
  ellipse(ctx, 240, 172, 26, 16, OUT); ellipse(ctx, 240, 172, 25, 15, '#c9c2d6'); ellipse(ctx, 240, 171, 20, 11, '#7cc7ff');
  rect(ctx, 237, 150, 6, 20, OUT); rect(ctx, 238, 151, 4, 18, '#e3dcef');
  // 보물 모래밭
  rect(ctx, 57, 100, 68, 38, OUT); rect(ctx, 58, 101, 66, 36, '#f5d38b');
  for (let i = 0; i < 40; i++) rect(ctx, 60 + ((i * 17) % 62), 103 + ((i * 7) % 32), 1, 1, '#e0b865');
  rect(ctx, 104, 110, 3, 10, '#e84a5f'); rect(ctx, 101, 118, 9, 4, '#5bc0ff');
  // 술래잡기 마당
  const t = PLAZA_SPOTS.tag;
  rect(ctx, t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, '#6cc070');
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
  ctx.strokeRect(t.x - t.w / 2 + 2.5, t.y - t.h / 2 + 2.5, t.w - 5, t.h - 5);
  for (const [fx, fy, col] of [[t.x - t.w / 2 + 2, t.y - t.h / 2 + 2, '#ff5d7a'], [t.x + t.w / 2 - 3, t.y - t.h / 2 + 2, '#5bc0ff'], [t.x - t.w / 2 + 2, t.y + t.h / 2 - 12, '#ffe066'], [t.x + t.w / 2 - 3, t.y + t.h / 2 - 12, '#b07cff']]) {
    rect(ctx, fx, fy - 10, 1, 12, OUT); rect(ctx, fx + 1, fy - 10, 6, 4, col);
  }
  // 멍멍 축구장
  const s = PLAZA_SPOTS.soccer;
  rect(ctx, s.x - 80, s.y - 44, 160, 88, '#4f9e44');
  for (let x = s.x - 80; x < s.x + 80; x += 20) rect(ctx, x, s.y - 44, 10, 88, '#57a84b');
  ctx.strokeRect(s.x - 77.5, s.y - 41.5, 155, 83);
  rect(ctx, s.x, s.y - 41, 1, 82, '#ffffff');
  ctx.beginPath(); ctx.arc(s.x + 0.5, s.y + 0.5, 12, 0, Math.PI * 2); ctx.stroke();
  for (const gx of [s.x - 84, s.x + 78]) { rect(ctx, gx, s.y - 12, 6, 24, '#ffffff'); rect(ctx, gx + 1, s.y - 11, 4, 22, '#dfe6f0'); }
  // 줄넘기 터: 말뚝 두 개와 바닥에 놓인 줄
  const j = PLAZA_SPOTS.jumprope;
  ellipse(ctx, j.x, j.y + 2, 34, 9, '#6cc070');
  for (const px of [j.x - 30, j.x + 30]) { rect(ctx, px - 2, j.y - 16, 4, 18, OUT); rect(ctx, px - 1, j.y - 15, 2, 16, '#c98a4b'); ellipse(ctx, px, j.y - 16, 3, 3, '#ff9fb8'); }
  for (let x = -28; x <= 28; x++) rect(ctx, j.x + x, j.y - 14 + Math.round((1 - (x / 28) ** 2) * 14), 1, 2, '#e84a5f');
  // 쿠션 탑 놀이터: 알록달록 쿠션 더미
  const cu = PLAZA_SPOTS.cushion;
  ellipse(ctx, cu.x, cu.y + 4, 24, 7, '#fff1c9');
  [['#ff9fb8', 0], ['#9fe0c8', -7], ['#ffe066', -14]].forEach(([c, dy], i) => {
    rect(ctx, cu.x - 12 + i * 2, cu.y - 6 + dy, 22, 8, OUT); rect(ctx, cu.x - 11 + i * 2, cu.y - 5 + dy, 20, 6, c);
  });
  // 멍뭉 간식 공장: 줄무늬 차양이 있는 가게
  const bk = PLAZA_SPOTS.bakery;
  rect(ctx, bk.x - 18, bk.y - 22, 36, 26, OUT); rect(ctx, bk.x - 17, bk.y - 12, 34, 15, '#fff6e6');
  for (let i = 0; i < 6; i++) rect(ctx, bk.x - 17 + i * 6, bk.y - 21, 6, 8, i % 2 ? '#ffffff' : '#ff9fb8');
  rect(ctx, bk.x - 6, bk.y - 8, 12, 6, '#f2c078'); rect(ctx, bk.x - 4, bk.y - 11, 8, 3, '#ffffff'); rect(ctx, bk.x - 1, bk.y - 13, 2, 2, '#ff4d6d');
  // 장난감 방: 장난감 바구니
  const td = PLAZA_SPOTS.tidy;
  ellipse(ctx, td.x, td.y + 2, 14, 5, OUT); rect(ctx, td.x - 13, td.y - 8, 26, 10, OUT); rect(ctx, td.x - 12, td.y - 7, 24, 8, '#ffd23f');
  ellipse(ctx, td.x - 5, td.y - 10, 4, 4, '#ff5d7a'); rect(ctx, td.x + 1, td.y - 12, 8, 3, '#fff6e6'); ellipse(ctx, td.x + 7, td.y - 11, 3, 3, '#c68642');
  // 멍뭉 패션쇼 무대: 무대 바닥 + 분홍 커튼 + 전구
  const sg = PLAZA_SPOTS.stage;
  rect(ctx, sg.x - 28, sg.y - 30, 56, 6, OUT); rect(ctx, sg.x - 27, sg.y - 29, 54, 4, '#b9773f');
  for (const cx of [sg.x - 28, sg.x + 20]) { rect(ctx, cx, sg.y - 26, 8, 22, OUT); rect(ctx, cx + 1, sg.y - 25, 6, 20, '#ff7fa3'); rect(ctx, cx + 2, sg.y - 25, 1, 20, '#ffb3c8'); }
  rect(ctx, sg.x - 22, sg.y - 6, 44, 10, OUT); rect(ctx, sg.x - 21, sg.y - 5, 42, 8, '#dca36a');
  for (let x = sg.x - 20; x < sg.x + 20; x += 6) rect(ctx, x, sg.y - 4, 3, 1, '#f0c58c');
  rect(ctx, sg.x - 4, sg.y + 5, 8, 16, '#ff9fb8'); rect(ctx, sg.x - 3, sg.y + 5, 6, 16, '#ffc2d6'); // 레드카펫(분홍)
  for (let i = 0; i < 7; i++) rect(ctx, sg.x - 24 + i * 8, sg.y - 31, 2, 2, ['#ffe066', '#ff6f91', '#7cc7ff'][i % 3]);
  // 선물 상자 받침
  const r = PLAZA_SPOTS.ribbon;
  ellipse(ctx, r.x, r.y + 8, 26, 9, '#ffd9e3');
  // 꽃밭과 벤치
  for (let i = 0; i < 70; i++) {
    const x = (i * 131) % WW; const y = (i * 71) % WH;
    if (blocked(x, y) || (y > 160 && y < 196)) continue;
    rect(ctx, x, y, 2, 2, ['#ff9fb8', '#ffe066', '#ffffff', '#b07cff'][i % 4]);
  }
  for (const [bx, by] of [[190, 120], [280, 230]]) {
    rect(ctx, bx, by, 24, 4, OUT); rect(ctx, bx + 1, by + 1, 22, 2, '#c98a4b'); rect(ctx, bx + 2, by + 4, 2, 5, OUT); rect(ctx, bx + 20, by + 4, 2, 5, OUT);
  }
  // 울타리
  for (let x = 0; x < WW; x += 8) { rect(ctx, x, 2, 3, 10, '#f0d6b0'); rect(ctx, x, WH - 6, 3, 6, '#f0d6b0'); }
  rect(ctx, 0, 5, WW, 2, '#c98a4b');
  return c;
}

// 나무는 강아지 앞에 그려야 해서 따로 그려요
function drawTree(ctx, x, y) {
  rect(ctx, x - 3, y - 12, 6, 13, OUT); rect(ctx, x - 2, y - 12, 4, 12, '#7a4b2a');
  ellipse(ctx, x, y - 22, 17, 14, OUT); ellipse(ctx, x, y - 22, 16, 13, '#2f7a33'); ellipse(ctx, x - 5, y - 27, 7, 5, '#4f9e44');
}

function drawGiftBox(ctx, x, y, t) {
  const bob = Math.round(Math.sin(t * 3));
  rect(ctx, x - 14, y - 20 + bob, 28, 22, OUT); rect(ctx, x - 13, y - 19 + bob, 26, 20, '#ff9fb8');
  rect(ctx, x - 2, y - 19 + bob, 4, 20, '#ffe066'); rect(ctx, x - 13, y - 11 + bob, 26, 4, '#ffe066');
  ellipse(ctx, x - 6, y - 23 + bob, 6, 4, OUT); ellipse(ctx, x + 6, y - 23 + bob, 6, 4, OUT);
  ellipse(ctx, x - 6, y - 23 + bob, 5, 3, '#ffe066'); ellipse(ctx, x + 6, y - 23 + bob, 5, 3, '#ffe066');
  rect(ctx, x - 2, y - 25 + bob, 4, 4, '#ffb000');
}

export class PlazaView {
  // handlers: { onPos(pos), onTapDog(entity), onSpot(spotKey|null), onFloor() }
  constructor(host, me, handlers = {}) {
    this.host = host;
    this.handlers = handlers;
    this.canvas = el('canvas', { width: VW, height: VH, class: 'pixel plaza-canvas' });
    this.overlay = el('div', { class: 'overlay' });
    this.knob = el('div', { class: 'joy-knob' });
    this.joy = el('div', { class: 'joystick', 'aria-label': '조이스틱' }, this.knob);
    this.hud = el('div', { class: 'plaza-hud' });
    this.root = el('div', { class: 'plaza-view' }, this.canvas, this.overlay, this.joy, this.hud);
    host.append(this.root);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.world = drawWorld();
    this.entities = new Map();
    this.meId = me.userId;
    this.cam = { x: 0, y: 0 };
    this.joyVec = null;
    this.target = null;
    this.lastSent = 0;
    this.sentMoving = false;
    this.spot = null;
    this.tag = null;
    this.waiting = {}; // 놀이 장소에서 기다리는 친구
    this.soccer = null; // { teams: {userId: 'pink'|'blue'} }
    this.ball = null; // { x, y, vx, vy }
    this.particles = [];
    this.t = 0;
    this.running = true;
    this.upsert({ ...me, x: me.x ?? PLAZA_SPOTS.fountain.x, y: me.y ?? PLAZA_SPOTS.fountain.y + 44 });
    this.bindInput();
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    this.root.remove();
  }

  get me() { return this.entities.get(this.meId); }

  upsert(info) {
    let e = this.entities.get(info.userId);
    if (!e) {
      e = { x: info.x, y: info.y, tx: info.x, ty: info.y, dir: 1, moving: false, t: Math.random() * 3, emote: null, emoteT: 0, bubble: null,
        tag: el('div', { class: 'name-tag plaza-name' }) };
      this.overlay.append(e.tag);
      this.entities.set(info.userId, e);
    }
    Object.assign(e, { userId: info.userId, nickname: info.nickname, dog: info.dog, isMe: info.userId === this.meId, friend: !!info.friend });
    if (info.x !== undefined && info.userId !== this.meId) { e.tx = info.x; e.ty = info.y; }
    if (info.dir) e.dir = info.dir;
    // 공개 놀이터에서는 레벨 숫자 대신 칭호와 이름표 테두리만 보여요
    e.tag.replaceChildren(
      info.dog?.titleName ? el('small', { class: 'plaza-title' }, info.dog.titleName) : '',
      info.dog?.special ? (info.dog.original ? '👑 ' : '✨ ') : '',
      info.nickname);
    e.tag.className = `name-tag plaza-name frame-${info.dog?.frame ?? 0} ${info.dog?.special ? 'special' : ''}`;
    e.tag.classList.toggle('mine', e.isMe);
    e.tag.classList.toggle('friend', e.friend);
    return e;
  }

  remove(userId) {
    const e = this.entities.get(userId);
    if (!e || userId === this.meId) return;
    e.tag.remove();
    e.bubble?.node.remove();
    this.entities.delete(userId);
  }

  move(userId, x, y, dir, moving) {
    const e = this.entities.get(userId);
    if (!e || e.isMe) return;
    e.tx = x; e.ty = y; e.dir = dir; e.remoteMoving = moving;
    if (Math.hypot(e.x - x, e.y - y) > 90) { e.x = x; e.y = y; }
  }

  emote(userId, kind) {
    const e = this.entities.get(userId);
    if (!e) return;
    e.emote = kind; e.emoteT = 0;
    if (kind === 'bark') this.bubble(userId, 'text', '멍!');
    if (kind === 'wave') this.burst(e, 'heart', 2);
    if (kind === 'jump') this.burst(e, 'sparkle', 1);
    if (kind === 'dance' || kind === 'sing') this.burst(e, 'note', 2);
    if (kind === 'bang') this.bubble(userId, 'text', '빵야!');
  }

  setDog(userId, dog) {
    const e = this.entities.get(userId);
    if (e) this.upsert({ userId, nickname: e.nickname, dog, friend: e.friend });
  }

  // 보물찾기: 땅 파는 모습 + 흙 튀기기
  dig(userId) {
    const e = this.entities.get(userId);
    if (!e) return;
    e.emote = 'dig'; e.emoteT = 0;
    for (let i = 0; i < 8; i++) {
      this.particles.push({ dirt: true, x: e.x + e.dir * 8, y: e.y - 2, vx: (Math.random() - 0.5) * 40 - e.dir * 20, vy: -30 - Math.random() * 30, life: 0.6, age: 0 });
    }
  }

  treasurePop(x, y, icon) {
    for (let i = 0; i < 5; i++) this.particles.push({ icon: 'sparkle', x: x + (Math.random() - 0.5) * 20, y: y - 10, vy: -20, life: 1, age: -i * 0.1 });
    this.particles.push({ icon, x, y: y - 14, vy: -14, life: 1.6, age: 0 });
  }

  bubble(userId, kind, value) {
    const e = this.entities.get(userId);
    if (!e) return;
    e.bubble?.node.remove();
    const node = el('div', { class: `bubble ${kind}` });
    if (kind === 'sticker') node.append(iconCanvas(value, 3)); else node.textContent = value;
    this.overlay.append(node);
    e.bubble = { node, until: performance.now() + 3500 };
  }

  burst(e, icon, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ icon, x: e.x + (Math.random() - 0.5) * 16, y: e.y - 30, vy: -16, life: 1.2, age: -i * 0.15 });
    }
  }

  setBall(x, y, vx, vy) {
    if (!this.ball || Math.hypot(this.ball.x - x, this.ball.y - y) > 30) this.ball = { x, y, vx, vy, tx: x, ty: y };
    Object.assign(this.ball, { tx: x, ty: y, vx, vy });
  }

  // ---------- 조작 ----------
  bindInput() {
    const joyR = 34;
    let joyId = null;
    const setJoy = (ev) => {
      const r = this.joy.getBoundingClientRect();
      let dx = ev.clientX - (r.left + r.width / 2); let dy = ev.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > joyR) { dx = (dx / d) * joyR; dy = (dy / d) * joyR; }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joyVec = d < 6 ? null : { x: dx / joyR, y: dy / joyR };
      if (this.joyVec) this.target = null;
    };
    // iOS는 꾹 누르면 글자 선택·돋보기가 떠요 → 터치 기본 동작을 막아요
    const noTouchDefault = (e) => { if (e.cancelable) e.preventDefault(); };
    for (const t of [this.joy, this.canvas]) {
      t.addEventListener('touchstart', noTouchDefault, { passive: false });
      t.addEventListener('touchmove', noTouchDefault, { passive: false });
    }
    this.joy.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      joyId = ev.pointerId;
      this.joy.setPointerCapture(ev.pointerId);
      this.joy.classList.add('active');
      setJoy(ev);
    });
    this.joy.addEventListener('pointermove', (ev) => { if (ev.pointerId === joyId) setJoy(ev); });
    const end = (ev) => {
      if (ev.pointerId !== joyId) return;
      joyId = null;
      this.joyVec = null;
      this.knob.style.transform = '';
      this.joy.classList.remove('active');
    };
    this.joy.addEventListener('pointerup', end);
    this.joy.addEventListener('pointercancel', end);

    this.canvas.addEventListener('pointerdown', (ev) => {
      const r = this.canvas.getBoundingClientRect();
      const wx = this.cam.x + ((ev.clientX - r.left) / r.width) * VW;
      const wy = this.cam.y + ((ev.clientY - r.top) / r.height) * VH;
      const hit = [...this.entities.values()].filter((e) => !e.isMe && Math.abs(wx - e.x) < 13 && wy < e.y + 3 && wy > e.y - 32)
        .sort((a, b) => b.y - a.y)[0];
      if (hit) { this.handlers.onTapDog?.(hit); return; }
      this.target = { x: wx, y: wy };
      this.particles.push({ marker: true, x: wx, y: wy, life: 0.6, age: 0 });
      this.handlers.onFloor?.();
    });

    // 키보드 (방향키/WASD)
    this.keys = new Set();
    this.onKey = (e) => {
      const map = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
      const k = map[e.code];
      if (!k || e.target.closest?.('input')) return;
      e.preventDefault();
      if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k);
    };
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    const origDestroy = this.destroy.bind(this);
    this.destroy = () => { window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); origDestroy(); };
  }

  // ---------- 갱신 ----------
  update(dt) {
    this.t += dt;
    const me = this.me;
    let vx = 0; let vy = 0;
    if (this.keys.size) {
      vx = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0);
      vy = (this.keys.has('d') ? 1 : 0) - (this.keys.has('u') ? 1 : 0);
      const d = Math.hypot(vx, vy) || 1; vx /= d; vy /= d;
      this.target = null;
    } else if (this.joyVec) {
      vx = this.joyVec.x; vy = this.joyVec.y;
    } else if (this.target) {
      const dx = this.target.x - me.x; const dy = this.target.y - me.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) this.target = null; else { vx = dx / d; vy = dy / d; }
    }
    const speed = PLAZA.speed;
    const moving = Math.hypot(vx, vy) > 0.05;
    if (moving && me.emote !== 'jump') {
      const nx = me.x + vx * speed * dt; const ny = me.y + vy * speed * dt;
      if (!blocked(nx, me.y)) me.x = nx; else if (this.target) this.target = null;
      if (!blocked(me.x, ny)) me.y = ny; else if (this.target) this.target = null;
      if (Math.abs(vx) > 0.1) me.dir = vx > 0 ? 1 : -1;
      if (Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) this.particles.push({ dust: true, x: me.x - me.dir * 7, y: me.y - 1, life: 0.4, age: 0 });
    }
    me.moving = moving;
    const now = performance.now();
    if ((moving && now - this.lastSent > 1000 / PLAZA.posHz) || (moving !== this.sentMoving && now - this.lastSent > 60)) {
      this.lastSent = now;
      this.sentMoving = moving;
      this.handlers.onPos?.({ x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, dir: me.dir, moving });
    }
    // 다른 강아지들은 받은 위치로 부드럽게 따라가요
    for (const e of this.entities.values()) {
      e.t += dt;
      if (e.emote) { e.emoteT += dt; if (e.emoteT > (LONG_EMOTES.includes(e.emote) ? 1.8 : 0.9)) e.emote = null; }
      if (e.isMe) continue;
      const dx = e.tx - e.x; const dy = e.ty - e.y;
      const d = Math.hypot(dx, dy);
      e.moving = d > 1.5 || e.remoteMoving;
      if (d > 0.5) {
        const step = Math.min(d, speed * (d > 30 ? 2 : 1.2) * dt);
        e.x += (dx / d) * step; e.y += (dy / d) * step;
      }
    }
    // 카메라는 내 강아지를 따라가요
    const cx = Math.min(WW - VW, Math.max(0, me.x - VW / 2));
    const cy = Math.min(WH - VH, Math.max(0, me.y - VH * 0.6));
    this.cam.x += (cx - this.cam.x) * Math.min(1, dt * 8);
    this.cam.y += (cy - this.cam.y) * Math.min(1, dt * 8);
    // 놀이 장소 근처인지
    let spot = null;
    for (const [key, s] of Object.entries(PLAZA_SPOTS)) {
      if (key === 'fountain') continue;
      const inside = s.w ? Math.abs(me.x - s.x) < s.w / 2 && Math.abs(me.y - s.y) < s.h / 2 : Math.hypot(me.x - s.x, me.y - s.y) < 42;
      if (inside) spot = key;
    }
    if (spot !== this.spot) { this.spot = spot; this.handlers.onSpot?.(spot); }
    if (this.ball) {
      // 서버 위치로 부드럽게 다가가면서, 받은 속도로 앞질러 움직여요
      const b = this.ball;
      b.tx += b.vx * dt; b.ty += b.vy * dt;
      b.vx *= 0.55 ** dt; b.vy *= 0.55 ** dt;
      b.x += (b.tx - b.x) * Math.min(1, dt * 12); b.y += (b.ty - b.y) * Math.min(1, dt * 12);
    }
    for (const p of this.particles) {
      p.age += dt;
      if (p.vx) p.x += p.vx * dt;
      if (p.vy) p.y += p.vy * dt;
      if (p.dirt) p.vy += 120 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  // ---------- 그리기 ----------
  draw() {
    const { ctx } = this;
    const camX = Math.round(this.cam.x); const camY = Math.round(this.cam.y);
    ctx.drawImage(this.world, camX, camY, VW, VH, 0, 0, VW, VH);
    ctx.save();
    ctx.translate(-camX, -camY);
    // 분수 물방울
    for (let i = 0; i < 4; i++) {
      const a = this.t * 3 + i * 1.6;
      rect(ctx, 240 + Math.cos(a) * 8, 150 + Math.abs(Math.sin(a)) * 12, 2, 2, '#bfe6ff');
    }
    for (const p of this.particles) {
      if (p.marker) {
        const k = p.age / p.life;
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(iconCanvas('paw'), Math.round(p.x - 4), Math.round(p.y - 4), 8, 7);
        ctx.globalAlpha = 1;
      } else if (p.dirt) {
        rect(ctx, p.x, p.y, 2, 2, '#d9a95b');
      } else if (p.dust) {
        ctx.globalAlpha = 1 - p.age / p.life;
        rect(ctx, p.x, p.y, 2, 2, '#f5e6cf');
        ctx.globalAlpha = 1;
      }
    }
    // 강아지, 나무, 선물 상자를 y 순서로
    const drawables = [
      ...[...this.entities.values()].map((e) => ({ y: e.y, draw: () => this.drawDog(e) })),
      ...TREES.map(([x, y]) => ({ y, draw: () => drawTree(ctx, x, y) })),
      { y: PLAZA_SPOTS.ribbon.y, draw: () => drawGiftBox(ctx, PLAZA_SPOTS.ribbon.x, PLAZA_SPOTS.ribbon.y, this.t) },
      ...(this.ball ? [{ y: this.ball.y, draw: () => this.drawBall() }] : []),
    ].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    this.drawShow();
    for (const p of this.particles) {
      if (!p.icon || p.age < 0) continue;
      ctx.globalAlpha = Math.min(1, (p.life - p.age) * 2);
      ctx.drawImage(iconCanvas(p.icon), Math.round(p.x - 5), Math.round(p.y));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    this.drawTags(camX, camY);
  }

  // 패션쇼: 무대에 선 친구를 조명 아래 정면으로 보여 줘요
  setShow(show) { this.show = show; }

  drawShow() {
    const s = this.show;
    if (!s || s.status !== 'walk' || !s.walker) return;
    const e = this.entities.get(s.walker);
    if (!e?.dog) return;
    const { ctx } = this;
    const sg = PLAZA_SPOTS.stage;
    ctx.fillStyle = 'rgba(255,245,180,0.35)';
    ctx.beginPath(); ctx.moveTo(sg.x - 6, sg.y - 30); ctx.lineTo(sg.x + 6, sg.y - 30); ctx.lineTo(sg.x + 18, sg.y + 2); ctx.lineTo(sg.x - 18, sg.y + 2); ctx.fill();
    const pose = Math.floor(this.t * 1.5) % 3 === 2 ? 'beg' : 'front';
    const spr = dogSprite(e.dog.breed, e.dog.stage, pose, { eyes: 'happy', mouth: 'tongue', tail: Math.floor(this.t * 6) % 2, equip: e.dog.equip, fluff: 2 });
    ctx.drawImage(spr.canvas, Math.round(sg.x - DOG_W / 2), sg.y - 41 + 1);
    if (Math.floor(this.t * 4) % 2) rect(ctx, sg.x + 12, sg.y - 30, 2, 2, '#fff7a8');
  }

  // 응원 효과 (무대 위로 아이콘이 퐁퐁)
  cheer(kind) {
    const sg = PLAZA_SPOTS.stage;
    this.particles.push({ icon: kind, x: sg.x + (Math.random() - 0.5) * 24, y: sg.y - 30, vx: (Math.random() - 0.5) * 16, vy: -18 - Math.random() * 10, life: 1.4, age: 0 });
  }

  drawBall() {
    const { ctx } = this;
    const b = this.ball;
    ellipse(ctx, b.x, b.y + 1, 4, 1.5, 'rgba(74,51,48,0.3)');
    const spin = Math.floor((b.x + b.y) / 3) % 2;
    ellipse(ctx, b.x, b.y - 3, 4, 4, OUT);
    ellipse(ctx, b.x, b.y - 3, 3, 3, '#ffffff');
    rect(ctx, b.x - 1 + spin, b.y - 4, 2, 2, OUT);
    rect(ctx, b.x + 1 - spin * 2, b.y - 2, 1, 1, OUT);
  }

  drawDog(e) {
    const { ctx } = this;
    let pose = 'stand'; let dy = 0; let facing = e.dir;
    const opts = { eyes: 'open', mouth: 'tongue', tail: Math.floor(e.t * 4) % 2, equip: e.dog?.equip, fluff: 0 };
    if (e.moving) { pose = Math.floor(e.t * 8) % 2 ? 'walk1' : 'walk2'; dy = Math.floor(e.t * 8) % 2 ? -1 : 0; }
    else if (Math.floor((e.t + e.userId) / 4) % 3 === 1) { pose = 'front'; opts.eyes = 'happy'; }
    if (e.emote === 'jump') { dy = -Math.round(Math.sin((e.emoteT / 0.9) * Math.PI) * 14); pose = 'walk1'; opts.eyes = 'happy'; }
    if (e.emote === 'bark') { opts.mouth = 'open'; pose = 'stand'; }
    if (e.emote === 'wave') { pose = 'paw'; opts.eyes = 'happy'; }
    if (e.emote === 'spin') { facing = Math.floor(e.emoteT * 10) % 2 ? 1 : -1; }
    const s = e.emoteT;
    if (e.emote === 'roll') { pose = 'lie'; facing = Math.floor(s * 6) % 2 ? 1 : -1; opts.eyes = 'happy'; }
    if (e.emote === 'dance') { pose = 'beg'; facing = Math.floor(s * 3) % 2 ? 1 : -1; dy = -Math.round(Math.abs(Math.sin(s * 6)) * 3); opts.mouth = 'open'; opts.eyes = 'happy'; }
    if (e.emote === 'bang') { if (s < 0.5) pose = 'beg'; else { pose = 'lie'; opts.eyes = 'closed'; } }
    if (e.emote === 'sing') { pose = 'front'; opts.mouth = Math.floor(s * 4) % 2 ? 'open' : 'closed'; opts.eyes = 'closed'; opts.headDy = -1; }
    if (e.emote === 'dig') { pose = 'bow'; dy = Math.floor(e.emoteT * 12) % 2; opts.eyes = 'closed'; }
    const it = this.tag?.status === 'play' && this.tag.it === e.userId;
    const team = this.soccer?.teams?.[e.userId];
    const ring = it ? 'rgba(232,74,95,0.55)' : team === 'pink' ? 'rgba(255,111,145,0.8)' : team === 'blue' ? 'rgba(91,140,255,0.8)' : 'rgba(74,51,48,0.22)';
    ellipse(ctx, e.x, e.y + 1, team ? 11 : 10, team ? 3 : 2.5, ring);
    const spr = dogSprite(e.dog.breed, e.dog.stage, pose, opts);
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y) + dy);
    if (facing < 0 && pose !== 'front') ctx.scale(-1, 1);
    ctx.drawImage(spr.canvas, pose === 'front' ? -DOG_W / 2 : -DOG_W / 2 + 2, -41);
    ctx.restore();
    if (it) {
      // 술래 표시: 머리 위 빨간 깃발
      const hx = Math.round(e.x) - 1; const hy = Math.round(e.y) - 40 + dy - (e.dog.stage === 0 ? -8 : e.dog.stage === 1 ? -4 : 0);
      rect(ctx, hx, hy - 8, 1, 10, OUT); rect(ctx, hx + 1, hy - 8, 7, 5, '#e84a5f'); rect(ctx, hx + 2, hy - 7, 2, 1, '#fff');
    }
  }

  drawTags(camX, camY) {
    const r = this.canvas.getBoundingClientRect();
    const s = r.width / VW;
    for (const e of this.entities.values()) {
      const x = (e.x - camX) * s; const y = (e.y - camY) * s;
      const visible = e.x > camX - 20 && e.x < camX + VW + 20 && e.y > camY - 10 && e.y < camY + VH + 40;
      e.tag.style.display = visible ? 'block' : 'none';
      e.tag.style.transform = `translate(${x}px, ${y + 4 * s}px) translate(-50%, 0)`;
      if (e.bubble) {
        if (performance.now() > e.bubble.until || !visible) { e.bubble.node.remove(); e.bubble = null; continue; }
        const headY = e.y - 38 + (e.dog.stage === 0 ? 8 : e.dog.stage === 1 ? 4 : 0);
        e.bubble.node.style.transform = `translate(${x}px, ${(headY - camY) * s}px) translate(-50%, -100%)`;
      }
    }
  }
}
