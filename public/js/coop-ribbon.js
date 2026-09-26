// 으쌰으쌰 대왕 리본 풀기 — 화면 그리기 (규칙은 shared/coop/ribbon.js, 판정은 서버)
import { COOP_GAMES } from '../shared/data.js';
import { gaugeAt } from '../shared/coop/ribbon.js';
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

const W = 192;
const H = 120;
const OUT = '#4a3330';
const cfg = COOP_GAMES.ribbon;

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

export class RibbonRenderer {
  constructor(host, { role, players, state, send, now }) {
    this.role = role; this.players = players; this.state = state; this.send = send; this.now = now;
    this.canvas = el('canvas', { width: W, height: H, class: 'pixel coop-canvas' });
    this.zoneEl = el('div', { class: 'gauge-zone' });
    this.markEl = el('div', { class: 'gauge-mark' });
    this.gauge = el('div', { class: 'gauge' }, this.zoneEl, this.markEl);
    this.msg = el('div', { class: 'coop-msg' }, '');
    this.knots = el('div', { class: 'knots' });
    this.btn = el('button', { class: 'btn primary big coop-btn', type: 'button' }, '영차!');
    this.timer = el('div', { class: 'bar coop-time' }, el('i', {}));
    host.append(
      el('p', { class: 'hint center' }, '게이지가 초록 칸에 오면 친구랑 같이 "영차!" (0.3초 안에)'),
      this.timer, this.gauge,
      el('div', { class: 'coop-stage' }, this.canvas, this.msg, this.knots),
      this.btn);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.pull = { p1: 0, p2: 0 };
    this.shake = 0;
    this.pop = 0;
    this.confetti = [];
    this.t = 0;
    this.myTapAt = 0;
    const press = (e) => {
      e.preventDefault();
      if (this.state.status !== 'play' || this.now() < this.state.stageStart) return;
      if (performance.now() - this.myTapAt < 400) return;
      this.myTapAt = performance.now();
      const pos = gaugeAt(this.state, this.now());
      this.pull[this.role] = 0.6; // 누르자마자 내 강아지가 당겨요 (반응이 빠르게 느껴지도록)
      sfx.jump();
      this.send({ type: 'pull', pos });
    };
    this.btn.addEventListener('pointerdown', press);
    this.canvas.addEventListener('pointerdown', press);
    this.onKey = (e) => { if (e.code === 'Space') press(e); };
    window.addEventListener('keydown', this.onKey);
    this.renderKnots();
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this.onKey);
  }

  renderKnots() {
    this.knots.replaceChildren(...Array.from({ length: this.state.stages }, (_, i) => el('span', { class: `knot ${i < this.state.stage ? 'done' : ''}` })));
  }

  say(text, kind = '') {
    this.msg.textContent = text;
    this.msg.className = `coop-msg show ${kind}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msg.className = 'coop-msg'; }, 1300);
  }

  onState(state, events) {
    this.state = state;
    for (const ev of events) {
      if (ev.type === 'pull') {
        this.pull[ev.role] = 0.6;
        if (ev.role !== this.role) sfx.tap();
      }
      if (ev.type === 'success') {
        sfx.love(); sfx.bark(1.1, 2);
        this.pop = 1;
        this.say(ev.stage >= state.stages ? '대성공!' : `매듭 ${ev.stage}개 풀었다!`, 'good');
        this.renderKnots();
      }
      if (ev.type === 'fail') {
        this.shake = 0.5;
        sfx.error();
        const text = ev.why === 'alone' ? (ev.alone === this.role ? '친구랑 같이 당겨요!' : '친구가 당겼어요! 같이 영차!')
          : ev.why === 'sync' ? '조금만 더 동시에!' : '초록 칸에서 당겨요!';
        this.say(text, 'bad');
      }
      if (ev.type === 'clear') {
        for (let i = 0; i < 40; i++) {
          this.confetti.push({ x: W / 2, y: 58, vx: (Math.random() - 0.5) * 140, vy: -60 - Math.random() * 90, icon: i % 8 === 0 ? 'clover' : 'coin', rot: 0 });
        }
      }
      if (ev.type === 'timeout') this.say('시간이 다 됐어요~');
    }
  }

  update(dt) {
    this.t += dt;
    for (const r of ['p1', 'p2']) this.pull[r] = Math.max(0, this.pull[r] - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.pop = Math.max(0, this.pop - dt * 1.5);
    for (const c of this.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 160 * dt; }
    const now = this.now();
    const st = cfg.stages[Math.min(this.state.stage, cfg.stages.length - 1)];
    const g = gaugeAt(this.state, now);
    this.zoneEl.style.left = `${st.zone[0] * 100}%`;
    this.zoneEl.style.width = `${(st.zone[1] - st.zone[0]) * 100}%`;
    this.markEl.style.left = `${g * 100}%`;
    const inZone = g >= st.zone[0] && g <= st.zone[1];
    this.gauge.classList.toggle('hot', inZone && this.state.status === 'play');
    this.btn.classList.toggle('glow', inZone && this.state.status === 'play');
    const left = Math.max(0, this.state.endsAt - now);
    this.timer.firstChild.style.width = `${(left / (cfg.timeLimit * 1000)) * 100}%`;
    if (now < this.state.stageStart && this.state.status === 'play') this.btn.textContent = '준비…';
    else this.btn.textContent = '영차!';
  }

  draw() {
    const { ctx } = this;
    rect(ctx, 0, 0, W, H, '#fff1c9');
    for (let x = 0; x < W; x += 16) for (let y = 0; y < 80; y += 16) rect(ctx, x + ((y / 16) % 2) * 8, y, 2, 2, '#ffe3a0');
    rect(ctx, 0, 92, W, H - 92, '#e3b27a');
    for (let x = 0; x < W; x += 24) rect(ctx, x, 92, 1, H - 92, '#c68c52');
    const cleared = this.state.status === 'clear';
    const shakeX = this.shake > 0 ? Math.round(Math.sin(this.t * 60) * 2) : 0;
    const cx = W / 2 + shakeX;
    // 리본 (두 강아지가 양쪽에서 당겨요)
    const tension = this.pull.p1 + this.pull.p2;
    const ribbonY = 70 + (this.shake > 0 ? Math.round(Math.sin(this.t * 40) * 3) : 0);
    const leftX = 38 - this.pull.p1 * 6; const rightX = W - 38 + this.pull.p2 * 6;
    if (!cleared) {
      for (let x = leftX; x < cx - 30; x += 1) rect(ctx, x, ribbonY + Math.round(Math.sin((x + this.t * 30) / 6) * (1 - tension)), 1, 3, '#ffd23f');
      for (let x = cx + 30; x < rightX; x += 1) rect(ctx, x, ribbonY + Math.round(Math.sin((x - this.t * 30) / 6) * (1 - tension)), 1, 3, '#ffd23f');
    }
    // 선물 상자
    if (!cleared) {
      const squash = this.pop > 0 ? Math.round(this.pop * 3) : 0;
      rect(ctx, cx - 30, 52 - squash, 60, 40 + squash, OUT); rect(ctx, cx - 29, 53 - squash, 58, 38 + squash, '#ff9fb8');
      rect(ctx, cx - 4, 53 - squash, 8, 38 + squash, '#ffd23f'); rect(ctx, cx - 29, ribbonY - 1, 58, 5, '#ffd23f');
      rect(ctx, cx - 33, 44 - squash, 66, 10, OUT); rect(ctx, cx - 32, 45 - squash, 64, 8, '#ffb3c8'); rect(ctx, cx - 4, 45 - squash, 8, 8, '#ffd23f');
      // 매듭 리본 (단계마다 작아져요)
      const size = 1 - this.state.stage * 0.22;
      ellipse(ctx, cx - 10 * size, 38 - squash, 11 * size, 7 * size, OUT); ellipse(ctx, cx + 10 * size, 38 - squash, 11 * size, 7 * size, OUT);
      ellipse(ctx, cx - 10 * size, 38 - squash, 10 * size, 6 * size, '#ffe066'); ellipse(ctx, cx + 10 * size, 38 - squash, 10 * size, 6 * size, '#ffe066');
      rect(ctx, cx - 3, 34 - squash, 6, 8, '#ffb000');
    } else {
      // 뚜껑이 팡! 날아가고 상자가 열려요
      rect(ctx, cx - 30, 58, 60, 34, OUT); rect(ctx, cx - 29, 59, 58, 32, '#ff9fb8');
      rect(ctx, cx - 26, 56, 52, 5, '#5a3a40');
      rect(ctx, cx - 40, 18, 30, 8, OUT); rect(ctx, cx - 39, 19, 28, 6, '#ffb3c8');
    }
    // 강아지 두 마리 (왼쪽 p1은 왼쪽을, 오른쪽 p2는 오른쪽을 보고 뒤로 당겨요)
    [['p1', 30, -1], ['p2', W - 30, 1]].forEach(([r, x, face]) => {
      const dog = this.players[r].dog;
      const pulling = this.pull[r] > 0;
      const happy = cleared || this.pop > 0;
      const pose = cleared ? (Math.floor(this.t * 4) % 2 ? 'beg' : 'front') : pulling ? 'bow' : 'stand';
      const opts = { eyes: happy ? 'happy' : this.shake > 0 ? 'sad' : 'open', mouth: pulling || happy ? 'open' : 'tongue', tail: Math.floor(this.t * 6) % 2, equip: dog.equip };
      const spr = dogSprite(dog.breed, dog.stage, pose, opts);
      const bx = x + (pulling ? face * 3 : 0);
      const hop = cleared ? -Math.round(Math.abs(Math.sin(this.t * 6 + (r === 'p1' ? 0 : 1))) * 6) : 0;
      ellipse(ctx, bx, 101, 10, 2, 'rgba(74,51,48,0.25)');
      ctx.save();
      ctx.translate(Math.round(bx), 100 + hop);
      // 리본을 입에 물고 상자를 바라보며 뒤로 당겨요 (오른쪽 강아지는 왼쪽을 봐요)
      if (pose !== 'front' && r === 'p2') ctx.scale(-1, 1);
      ctx.drawImage(spr.canvas, pose === 'front' ? -DOG_W / 2 : -DOG_W / 2 + 2, -41);
      ctx.restore();
      if (r === this.role) { rect(ctx, bx - 6, 104, 12, 2, '#e8708f'); }
      if (this.shake > 0) ctx.drawImage(iconCanvas('sweat'), bx + 6, 56);
      if (cleared) ctx.drawImage(iconCanvas('heart'), bx - 5, 52 + Math.round(Math.sin(this.t * 5) * 2));
    });
    for (const c of this.confetti) {
      if (c.y > H + 10) continue;
      ctx.drawImage(iconCanvas(c.icon), Math.round(c.x - 5), Math.round(c.y - 5));
    }
  }
}
