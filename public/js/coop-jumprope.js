// 깡총깡총 실시간 줄넘기 — 화면 그리기 (규칙은 shared/coop/jumprope.js, 판정은 서버)
// 내 강아지는 누르자마자 뛰고, 친구 강아지는 친구가 눌렀다는 소식(jump 이벤트)이 오면 뛰어요.
import { ropePhase } from '/shared/coop/jumprope.js';
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { drawField, drawRope, ROPE_W as W, ROPE_H as H, ROPE_FEET as FEET, ROPE_DOGS_X as DOGS_X } from './jumprope.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

const JUMP_TIME = 0.42;

export class JumpRopeRenderer {
  constructor(host, { role, players, state, send, now }) {
    Object.assign(this, { role, players, state, send, now });
    this.canvas = el('canvas', { width: W, height: H, class: 'pixel coop-canvas' });
    this.msg = el('div', { class: 'coop-msg' }, '');
    this.count = el('div', { class: 'jr-msg' }, '');
    this.lives = el('span', { class: 'hearts big-hearts' });
    this.progress = el('span', {});
    this.combo = el('div', { class: 'jr-combo' }, '');
    this.btn = el('button', { class: 'btn primary big coop-btn', type: 'button' }, '깡총!');
    host.append(
      el('div', { class: 'game-hud' }, this.lives, this.progress),
      el('div', { class: 'coop-stage jr-coop-stage' }, this.canvas, this.combo, this.msg, this.count),
      this.btn,
      el('p', { class: 'hint center' }, '밧줄이 발밑 선에 닿을 때 톡! 친구도 자기 화면에서 같이 뛰어야 해요.'));
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.field = document.createElement('canvas');
    this.field.width = W; this.field.height = H;
    drawField(this.field.getContext('2d'));
    this.jumpT = { p1: 9, p2: 9 };
    this.sweat = { p1: 0, p2: 0 };
    this.t = 0;
    this.lastTap = 0;
    const press = (e) => {
      e.preventDefault();
      if (this.state.status !== 'play' || performance.now() - this.lastTap < 250) return;
      this.lastTap = performance.now();
      this.jumpT[this.role] = 0;
      sfx.jump();
      this.send({ type: 'jump', at: this.now() });
    };
    this.btn.addEventListener('pointerdown', press);
    this.canvas.addEventListener('pointerdown', press);
    this.onKey = (e) => { if (e.code === 'Space') press(e); };
    window.addEventListener('keydown', this.onKey);
    this.renderHud();
    this.running = true;
    let last = performance.now();
    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      this.t += dt;
      for (const r of ['p1', 'p2']) { this.jumpT[r] += dt; this.sweat[r] = Math.max(0, this.sweat[r] - dt); }
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this.onKey);
  }

  renderHud() {
    const s = this.state;
    this.lives.textContent = '♥'.repeat(Math.max(0, s.lives)) + '♡'.repeat(Math.max(0, 3 - s.lives));
    this.progress.textContent = `넘은 횟수 ${s.jumps}/${s.goal}`;
  }

  say(text, kind = '') {
    this.msg.textContent = text;
    this.msg.className = `coop-msg show ${kind}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msg.className = 'coop-msg'; }, 1100);
  }

  onState(state, events) {
    this.state = state;
    for (const ev of events) {
      if (ev.type === 'jump' && ev.role !== this.role) { this.jumpT[ev.role] = 0; }
      if (ev.type === 'jump' && ev.role === this.role && ev.good && ev.perfect) this.say('완벽!', 'good');
      if (ev.type === 'cycle' && ev.ok) {
        sfx.catch();
        this.combo.textContent = `${ev.combo} 콤보!`;
        this.combo.classList.remove('bump'); void this.combo.offsetWidth; this.combo.classList.add('bump');
        if (ev.perfect) sfx.star();
      }
      if (ev.type === 'cycle' && !ev.ok) {
        sfx.hurt();
        for (const r of ev.missed) this.sweat[r] = 1.2;
        const partnerMissed = ev.missed.some((r) => r !== this.role);
        const iMissed = ev.missed.includes(this.role);
        this.say(iMissed && partnerMissed ? '앗! 둘 다 놓쳤어요' : iMissed ? '앗! 내가 놓쳤어요' : '앗! 친구가 놓쳤어요', 'bad');
        this.combo.textContent = '';
      }
      if (ev.type === 'speedup') this.say('줄이 빨라진다!', 'good');
      if (ev.type === 'clear') { this.say('대성공!', 'good'); sfx.levelUp(); }
    }
    this.renderHud();
  }

  draw() {
    const { ctx } = this;
    const s = this.state;
    const now = this.now();
    // 판정까지 반 바퀴보다 많이 남았으면 줄은 위에서 기다려요 (시작 전, 틀린 뒤 잠깐 쉬기)
    const until = s.nextJ - now;
    const waiting = until > s.period * 0.5;
    const phase = waiting ? 0 : ropePhase(s, now);
    const startIn = s.nextJ - s.period / 2 - now;
    this.count.textContent = s.status === 'play' && startIn > 0 && s.jumps === 0 && s.lives === 3 ? String(Math.ceil(startIn / 1000)) : '';
    ctx.drawImage(this.field, 0, 0);
    const front = phase <= 0.5;
    if (!front) drawRope(ctx, phase, false);
    const near = !waiting && Math.abs(until) <= s.window;
    for (let x = 50; x < 142; x += 6) { ctx.fillStyle = near ? '#ffe066' : 'rgba(255,255,255,0.7)'; ctx.fillRect(x, FEET + 3, 3, 1); }
    this.btn.classList.toggle('glow', near && s.status === 'play');
    ['p1', 'p2'].forEach((r, i) => {
      const dog = this.players[r].dog;
      const j = this.jumpT[r];
      const y = j < JUMP_TIME ? -Math.round(Math.sin((j / JUMP_TIME) * Math.PI) * 20) : 0;
      const sad = this.sweat[r] > 0 || s.status === 'over';
      const pose = y < 0 ? 'walk1' : sad ? 'sit' : s.status === 'clear' ? 'front' : 'stand';
      const opts = { eyes: sad ? 'sad' : 'happy', mouth: y < 0 ? 'open' : 'tongue', tail: Math.floor(this.t * 6) % 2, equip: dog.equip };
      const spr = dogSprite(dog.breed, dog.stage, pose, opts);
      ctx.fillStyle = 'rgba(74,51,48,0.25)';
      ctx.fillRect(DOGS_X[i] - 9, FEET, 18, 2);
      ctx.save();
      ctx.translate(DOGS_X[i], FEET + y);
      if (i === 1 && pose !== 'front') ctx.scale(-1, 1);
      ctx.drawImage(spr.canvas, pose === 'front' ? -DOG_W / 2 : -DOG_W / 2 + 2, -41);
      ctx.restore();
      if (r === this.role) { ctx.fillStyle = '#e8708f'; ctx.fillRect(DOGS_X[i] - 5, FEET + 6, 10, 2); }
      if (this.sweat[r] > 0) ctx.drawImage(iconCanvas('sweat'), DOGS_X[i] + 8, FEET - 44);
      if (s.status === 'clear') ctx.drawImage(iconCanvas('heart'), DOGS_X[i] - 5, FEET - 50 + Math.round(Math.sin(this.t * 5) * 2));
    });
    if (front) drawRope(ctx, phase, true);
  }
}
