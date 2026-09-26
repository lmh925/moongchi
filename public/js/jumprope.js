// 미니게임: 깡총깡총 합동 줄넘기
// 밧줄이 위에서 내려와 발밑 판정선에 닿는 순간 화면을 톡! 두 강아지가 같이 뛰어요.
// 놓치면 '앗!' 땀방울과 함께 게임 오버.
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el } from './ui.js';
import { sfx, playBgm } from './audio.js';

const W = 192;
const H = 144;
const FEET = 118;
const HANDS = { l: { x: 12, y: 78 }, r: { x: 180, y: 78 } };
const DOGS_X = [74, 118];
const TOP_Y = 14; // 밧줄 가장 높은 곳
const BEST_KEY = 'meongmung.jumprope.best';
const JUMP_TIME = 0.42;
// 난이도: 넉넉한 판정, 천천히 빨라지기, 하트 3개 (한 번 걸려도 괜찮아요)
const EASY = { period: 1.8, window: 0.3, minPeriod: 0.95, minWindow: 0.2, speedEvery: 8, lives: 3 };
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

function drawField(ctx) {
  ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'].forEach((c, i) => rect(ctx, 0, i * 16, W, 16, c));
  rect(ctx, 0, 64, W, 30, '#d8f1ff');
  ellipse(ctx, 26, 20, 12, 4, '#fff'); ellipse(ctx, 31, 17, 7, 3, '#fff');
  ellipse(ctx, 150, 30, 10, 3, '#fff');
  ellipse(ctx, 176, 18, 7, 7, '#fff3a0'); ellipse(ctx, 176, 18, 5, 5, '#ffe066');
  for (const [x, r] of [[30, 30], [110, 40], [175, 28]]) { ellipse(ctx, x, 96, r, r * 0.6, '#4f9e44'); }
  rect(ctx, 0, 92, W, H - 92, '#57a84b');
  for (let i = 0; i < 60; i++) rect(ctx, (i * 41) % W, 96 + ((i * 17) % 44), 2, 1, i % 2 ? '#6cc070' : '#3f8f3a');
  // 줄을 돌려 주는 말뚝
  for (const h of [HANDS.l, HANDS.r]) {
    rect(ctx, h.x - 3, h.y, 6, FEET - h.y + 4, OUT);
    rect(ctx, h.x - 2, h.y + 1, 4, FEET - h.y + 2, '#c98a4b');
    ellipse(ctx, h.x, h.y, 4, 4, OUT); ellipse(ctx, h.x, h.y, 3, 3, '#ff9fb8');
  }
}

// 밧줄: 두 손잡이 사이의 곡선. phase 0 = 맨 위, 0.5 = 발밑(판정), 0.5~1은 뒤로 넘어가요
function ropeY(phase) {
  const mid = (TOP_Y + FEET) / 2; const amp = (FEET - TOP_Y) / 2;
  return mid - amp * Math.cos(phase * Math.PI * 2);
}

function drawRope(ctx, phase, front) {
  const cy = ropeY(phase);
  const color = front ? '#e84a5f' : '#b0566a';
  // 이차 곡선: 손잡이 두 개 + 가운데 높이
  const ctrlY = 2 * cy - (HANDS.l.y + HANDS.r.y) / 2;
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const x = (1 - t) ** 2 * HANDS.l.x + 2 * (1 - t) * t * (W / 2) + t ** 2 * HANDS.r.x;
    const y = (1 - t) ** 2 * HANDS.l.y + 2 * (1 - t) * t * ctrlY + t ** 2 * HANDS.r.y;
    rect(ctx, x, y, 2, 2, front ? OUT : 'rgba(74,51,48,0.4)');
    rect(ctx, x, y, 2, 1, color);
  }
}

// me/friend: publicDog 형태, names: [내 이름, 친구 이름]
export function playJumpRope(me, friend, names) {
  return new Promise((resolve) => {
    const canvas = el('canvas', { width: W, height: H, class: 'pixel jr-canvas' });
    const comboEl = el('div', { class: 'jr-combo' }, '');
    const msgEl = el('div', { class: 'jr-msg' }, '화면을 누르면 시작!');
    const stage = el('div', { class: 'jr-stage' }, canvas, comboEl, msgEl);
    const jumpBtn = el('button', { class: 'btn primary big jr-btn', type: 'button' }, '깡총!');
    const bestEl = el('span', {}, `최고 ${loadBest()}콤보`);
    const result = el('div', { class: 'jr-result', hidden: true });
    const wrap = el('div', { class: 'modal-wrap' },
      el('div', { class: 'modal-card jr-card' },
        el('div', { class: 'pb-head' }, el('h2', { class: 'modal-title' }, '깡총깡총 합동 줄넘기'), bestEl),
        el('p', { class: 'hint center' }, `${names[0]} & ${names[1]} · 밧줄이 발밑 선에 닿을 때 톡!`),
        stage, jumpBtn, result,
        el('div', { class: 'modal-buttons' }, el('button', { class: 'btn ghost', type: 'button', onclick: () => close() }, '그만하기'))));
    document.getElementById('modal-root').append(wrap);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const field = document.createElement('canvas');
    field.width = W; field.height = H;
    drawField(field.getContext('2d'));

    // 상태: ready → count → play → over
    const s = {
      mode: 'ready', t: 0, count: 0, phase: 0.1, period: EASY.period, window: EASY.window, combo: 0, best: loadBest(), lives: EASY.lives,
      judged: false, jumpT: [9, 9], fail: 0, pops: [], perfect: 0,
    };

    const judgeTime = () => (0.5 - s.phase) * s.period; // 다음 판정까지 남은 초 (음수면 지남)

    const tap = () => {
      if (s.mode === 'ready' || s.mode === 'over') {
        if (s.mode === 'over' && s.fail < 0.8) return;
        start();
        return;
      }
      if (s.mode !== 'play') return;
      if (s.judged) return;
      const dt = judgeTime();
      if (Math.abs(dt) <= s.window) {
        s.judged = true;
        s.combo += 1;
        s.best = Math.max(s.best, s.combo);
        s.jumpT = [0, 0.04];
        const perfect = Math.abs(dt) <= s.window * 0.35;
        sfx.jump();
        if (perfect) sfx.star(); else sfx.catch();
        s.pops.push({ text: perfect ? '완벽!' : '좋아!', age: 0 });
        comboEl.textContent = `${s.combo} 콤보!`;
        comboEl.classList.remove('bump'); void comboEl.offsetWidth; comboEl.classList.add('bump');
        // 콤보가 쌓일수록 줄이 빨라지고 판정이 조금씩 좁아져요
        if (s.combo % EASY.speedEvery === 0) {
          s.period = Math.max(EASY.minPeriod, s.period - 0.08);
          s.window = Math.max(EASY.minWindow, s.window - 0.01);
          s.pops.push({ text: '빨라진다!', age: 0 });
        }
      } else if (dt > s.window) {
        msgEl.textContent = '아직이에요~ 줄이 발밑에 올 때!';
      }
    };

    const start = () => {
      Object.assign(s, { mode: 'count', count: 3, phase: 0.95, period: EASY.period, window: EASY.window, combo: 0, judged: false, fail: 0, pops: [], lives: EASY.lives });
      comboEl.textContent = '';
      result.hidden = true;
      jumpBtn.hidden = false;
      msgEl.textContent = '3';
      playBgm('play');
      sfx.pop();
    };

    // 걸렸어요: 하트가 남았으면 잠깐 쉬고 계속 (콤보는 그대로 이어져요)
    const miss = () => {
      s.lives -= 1;
      if (s.lives <= 0) { gameOver(); return; }
      s.judged = true;
      s.hurtT = 0.6;
      sfx.hurt();
      s.pops.push({ text: `앗! 하트 ${s.lives}개 남았어요`, age: 0 });
    };

    const gameOver = () => {
      s.sessionBest = Math.max(s.sessionBest ?? 0, s.combo); // 이번에 논 것 중 최고 (랭킹용)
      s.mode = 'over';
      s.fail = 0;
      sfx.hurt();
      msgEl.textContent = '앗!';
      saveBest(s.best);
      bestEl.textContent = `최고 ${s.best}콤보`;
      setTimeout(() => {
        if (s.mode !== 'over') return;
        playBgm('home');
        jumpBtn.hidden = true;
        result.hidden = false;
        const newBest = s.combo > 0 && s.combo >= s.best;
        result.replaceChildren(
          el('div', { class: 'jr-score' }, `${s.combo} 콤보`),
          el('p', {}, newBest ? '최고 기록이에요! 둘이 호흡이 척척!' : s.combo >= 5 ? '와, 호흡이 잘 맞아요!' : '다시 한번 해 볼까요?'),
          el('div', { class: 'modal-buttons' },
            el('button', { class: 'btn primary', type: 'button', onclick: start }, '다시 하기'),
            el('button', { class: 'btn secondary', type: 'button', onclick: () => close() }, '끝내기')));
        if (newBest) sfx.levelUp();
      }, 900);
    };

    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      saveBest(s.best);
      window.removeEventListener('keydown', onKey);
      playBgm('home');
      wrap.remove();
      resolve({ best: s.best, session: Math.max(s.sessionBest ?? 0, s.combo) });
    };

    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', onKey);
    stage.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });

    const update = (dt) => {
      s.t += dt;
      s.jumpT = s.jumpT.map((j) => j + dt);
      for (const p of s.pops) p.age += dt;
      s.pops = s.pops.filter((p) => p.age < 0.8);
      if (s.mode === 'count') {
        const before = Math.ceil(s.count);
        s.count -= dt;
        if (Math.ceil(s.count) !== before && s.count > 0) { msgEl.textContent = String(Math.ceil(s.count)); sfx.tap(); }
        if (s.count <= 0) { s.mode = 'play'; msgEl.textContent = ''; sfx.notify(); }
        return;
      }
      if (s.mode === 'over') { s.fail += dt; return; }
      if (s.mode !== 'play') { s.phase = (s.phase + dt / 3) % 1; return; }
      const prev = s.phase;
      s.phase = (s.phase + dt / s.period) % 1;
      // 판정 시간이 지났는데 안 뛰었으면 걸려 넘어져요
      if (!s.judged && judgeTime() < -s.window && s.phase < 0.9) miss();
      // 한 바퀴 돌아 위로 올라가면 다음 판정 준비
      if (prev > s.phase) s.judged = false;
      if (msgEl.textContent && s.mode === 'play' && judgeTime() < 0) msgEl.textContent = '';
    };

    const dogY = (i) => {
      const j = s.jumpT[i];
      if (j >= JUMP_TIME) return 0;
      return -Math.round(Math.sin((j / JUMP_TIME) * Math.PI) * 20);
    };

    const draw = () => {
      ctx.drawImage(field, 0, 0);
      const front = s.phase <= 0.5;
      if (!front) drawRope(ctx, s.phase, false);
      // 판정선 (발밑 점선) - 밧줄이 가까워지면 반짝
      const near = s.mode === 'play' && Math.abs(judgeTime()) <= s.window;
      for (let x = 50; x < 142; x += 6) rect(ctx, x, FEET + 3, 3, 1, near ? '#ffe066' : 'rgba(255,255,255,0.7)');
      [me, friend].forEach((dog, i) => {
        const y = dogY(i);
        const inAir = y < 0;
        const over = s.mode === 'over';
        let pose = inAir ? 'walk1' : 'stand';
        let opts = { eyes: 'happy', mouth: inAir ? 'open' : 'tongue', tail: Math.floor(s.t * 6) % 2 };
        if (over) { pose = 'sit'; opts = { eyes: 'sad', mouth: 'closed', tail: 0 }; }
        else if (s.mode === 'play' && !inAir && Math.floor(s.t * 3) % 4 === 0) pose = 'front';
        const spr = dogSprite(dog.breed, dog.stage, pose, { ...opts, equip: dog.equip });
        ellipse(ctx, DOGS_X[i], FEET + 1, 10 + y / 4, 2, 'rgba(74,51,48,0.25)');
        ctx.save();
        ctx.translate(DOGS_X[i], FEET + y);
        if (i === 1 && pose !== 'front') ctx.scale(-1, 1);
        ctx.drawImage(spr.canvas, pose === 'front' ? -DOG_W / 2 : -DOG_W / 2 + 2, -41);
        ctx.restore();
        if (over) {
          const sw = iconCanvas('sweat');
          ctx.drawImage(sw, DOGS_X[i] + 8, FEET - 44 - Math.round(Math.sin(s.fail * 8) * 2));
        }
      });
      if (front) drawRope(ctx, s.phase, true);
      // 남은 하트
      if (s.mode === 'play' || s.mode === 'count') {
        const hi = iconCanvas('heart');
        for (let i = 0; i < EASY.lives; i++) {
          ctx.globalAlpha = i < s.lives ? 1 : 0.25;
          ctx.drawImage(hi, 6 + i * 12, 6);
        }
        ctx.globalAlpha = 1;
      }
      ctx.font = 'bold 12px Galmuri11';
      ctx.textAlign = 'center';
      for (const p of s.pops) {
        const y = 46 - p.age * 20;
        ctx.globalAlpha = 1 - p.age / 0.8;
        ctx.fillStyle = '#fff';
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(p.text, W / 2 + ox, y + oy);
        ctx.fillStyle = '#e8708f'; ctx.fillText(p.text, W / 2, y);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'start';
      jumpBtn.classList.toggle('glow', near && !s.judged);
    };

    let last = performance.now();
    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { if (v > loadBest()) localStorage.setItem(BEST_KEY, String(v)); } catch { /* 무시 */ }
}

// 실시간 2인 줄넘기(coop-jumprope.js)에서도 같은 그림을 써요
export { drawField, drawRope, W as ROPE_W, H as ROPE_H, FEET as ROPE_FEET, DOGS_X as ROPE_DOGS_X };
