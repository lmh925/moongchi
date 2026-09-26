// 미니게임: 간식 받아먹기 (30초, 벌칙 없이 받은 만큼 점수)
import { RULES } from '../shared/data.js';
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el, modal } from './ui.js';
import { sfx, playBgm } from './audio.js';

const W = 192;
const H = 144;
const GROUND = 132;

function drawLawn(ctx, t) {
  ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, W, 60);
  ctx.fillStyle = '#d8f1ff'; ctx.fillRect(0, 40, W, 20);
  ctx.fillStyle = '#ffffff';
  for (const [x, y] of [[20, 12], [90, 20], [150, 8]]) {
    const cx = ((x + t * 4) % (W + 30)) - 20;
    ctx.fillRect(cx, y, 18, 4); ctx.fillRect(cx + 4, y - 3, 9, 3);
  }
  ctx.fillStyle = '#3f8f3a'; ctx.fillRect(0, 60, W, H - 60);
  ctx.fillStyle = '#57a84b';
  for (let i = 0; i < 70; i++) ctx.fillRect((i * 53) % W, 64 + ((i * 29) % 70), 2, 2);
  ctx.fillStyle = '#2f6f2c'; ctx.fillRect(0, GROUND + 2, W, H - GROUND - 2);
  // 울타리
  ctx.fillStyle = '#e8c9a0';
  for (let x = 2; x < W; x += 14) { ctx.fillRect(x, 48, 5, 14); ctx.fillRect(x + 1, 46, 3, 2); }
  ctx.fillRect(0, 52, W, 3);
}

export function playMinigame(dog) {
  return new Promise((resolve) => {
    const canvas = el('canvas', { width: W, height: H, class: 'pixel' });
    const scoreEl = el('span', {}, '0개');
    const timeEl = el('span', {}, `${RULES.minigame.seconds}초`);
    const { close } = modal({
      title: '간식 받아먹기!',
      className: 'game-card',
      body: el('div', {}, el('div', { class: 'game-hud' }, scoreEl, timeEl), canvas, el('p', { class: 'hint' }, '화면을 누르거나 끌어서 강아지를 움직여요. 별은 3개로 쳐 줘요!')),
      buttons: [],
      dismissable: false,
    });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    playBgm('play');
    const player = { x: W / 2, tx: W / 2, facing: 1 };
    const treats = [];
    const pops = [];
    let score = 0;
    let t = 0;
    let spawn = 0;
    let last = performance.now();
    let done = false;
    const pointer = (e) => {
      const r = canvas.getBoundingClientRect();
      player.tx = Math.max(14, Math.min(W - 14, ((e.clientX - r.left) / r.width) * W));
    };
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointer(e); });
    canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') pointer(e); });

    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const left = RULES.minigame.seconds - t;
      // 간식 생성: 시간이 지날수록 조금씩 빨라져요
      spawn -= dt;
      if (spawn <= 0) {
        const star = Math.random() < 0.12;
        treats.push({ x: 12 + Math.random() * (W - 24), y: -10, vy: 28 + Math.random() * 20 + t * 1.2, icon: star ? 'star' : Math.random() < 0.5 ? 'food' : 'coin', value: star ? 3 : 1 });
        spawn = Math.max(0.35, 0.9 - t * 0.02);
      }
      const dx = player.tx - player.x;
      if (Math.abs(dx) > 1) { player.x += Math.sign(dx) * Math.min(Math.abs(dx), 110 * dt); player.facing = dx > 0 ? 1 : -1; }
      for (const tr of treats) tr.y += tr.vy * dt;
      for (let i = treats.length - 1; i >= 0; i--) {
        const tr = treats[i];
        if (tr.y > GROUND - 30 && tr.y < GROUND - 8 && Math.abs(tr.x - player.x) < 16) {
          score += tr.value;
          if (tr.value > 1) sfx.star(); else sfx.catch();
          pops.push({ x: tr.x, y: tr.y, age: 0, text: `+${tr.value}` });
          treats.splice(i, 1);
        } else if (tr.y > H) treats.splice(i, 1);
      }
      for (const p of pops) { p.age += dt; p.y -= 20 * dt; }
      while (pops.length && pops[0].age > 0.8) pops.shift();

      drawLawn(ctx, t);
      const moving = Math.abs(dx) > 1;
      const pose = moving ? (Math.floor(t * 8) % 2 ? 'walk1' : 'walk2') : 'stand';
      const spr = dogSprite(dog.breed, dog.stage, pose, { eyes: 'happy', mouth: 'open', tail: Math.floor(t * 6) % 2, equip: dog.equip });
      ctx.save();
      ctx.translate(Math.round(player.x), GROUND);
      if (player.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(spr.canvas, -DOG_W / 2 + 2, -41);
      ctx.restore();
      for (const tr of treats) ctx.drawImage(iconCanvas(tr.icon), Math.round(tr.x - 5), Math.round(tr.y));
      ctx.font = '8px Galmuri11';
      ctx.fillStyle = '#4a3330';
      for (const p of pops) ctx.fillText(p.text, Math.round(p.x - 4), Math.round(p.y));
      scoreEl.textContent = `간식 ${score}개`;
      timeEl.textContent = `${Math.max(0, Math.ceil(left))}초`;
      if (left <= 0) {
        done = true;
        playBgm('home');
        close();
        resolve(score);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
