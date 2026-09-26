// 미니게임: 멍뭉 런 (쿠키런 스타일 가로 달리기)
// 강아지가 자동으로 달려요. 점프(2단 점프)와 슬라이드로 장애물을 피하고 간식을 모아요.
// 체력은 시간이 지나면 조금씩 줄어들고, 하트를 먹으면 다시 차요.
import { dogSprite, iconCanvas, DOG_W } from './sprites.js';
import { el, modal } from './ui.js';
import { sfx, playBgm } from './audio.js';

const W = 240;
const H = 144;
const GROUND = 122;
const DOG_X = 52;
const GRAVITY = 760;
const JUMP_V = -270;
const DOUBLE_V = -235;
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

const LAYERS = {
  hills: () => layer(W, 60, (ctx) => {
    for (const [x, r, c] of [[20, 34, '#4f9e44'], [90, 44, '#3f8f3a'], [160, 30, '#4f9e44'], [220, 40, '#3f8f3a']]) {
      ellipse(ctx, x, 60, r, r * 0.9, OUT); ellipse(ctx, x, 61, r - 1, r * 0.9 - 1, c);
      ellipse(ctx, x - r * 0.3, 60 - r * 0.6, r * 0.25, r * 0.12, '#6cc070');
    }
  }),
  trees: () => layer(W, 60, (ctx) => {
    for (const x of [30, 110, 190]) {
      rect(ctx, x - 2, 34, 5, 26, '#7a4b2a'); rect(ctx, x - 2, 34, 1, 26, '#94603a');
      ellipse(ctx, x, 28, 14, 12, OUT); ellipse(ctx, x, 28, 13, 11, '#2f7a33'); ellipse(ctx, x - 4, 23, 6, 4, '#4f9e44');
    }
    for (const x of [70, 150, 230]) {
      ellipse(ctx, x, 54, 12, 7, OUT); ellipse(ctx, x, 54, 11, 6, '#3f8f3a'); ellipse(ctx, x - 3, 51, 4, 2, '#6cc070');
      rect(ctx, x + 3, 50, 2, 2, '#ff9fb8'); rect(ctx, x - 6, 53, 2, 2, '#ffe066');
    }
  }),
  fence: () => layer(W, 24, (ctx) => {
    rect(ctx, 0, 8, W, 3, '#b98c5a'); rect(ctx, 0, 15, W, 3, '#b98c5a');
    for (let x = 4; x < W; x += 16) {
      rect(ctx, x - 1, 1, 7, 23, OUT); rect(ctx, x, 2, 5, 22, '#f0d6b0'); rect(ctx, x, 2, 1, 22, '#fff0d8');
      rect(ctx, x + 1, 0, 3, 2, OUT);
    }
  }),
  ground: () => layer(W, H - GROUND, (ctx) => {
    rect(ctx, 0, 0, W, 5, '#57a84b');
    for (let x = 0; x < W; x += 4) rect(ctx, x, 0, 2, 2 + ((x / 4) % 2), '#6cc070');
    rect(ctx, 0, 5, W, H - GROUND - 5, '#c98a4b');
    rect(ctx, 0, 5, W, 1, '#8a5429');
    for (let i = 0; i < 40; i++) rect(ctx, (i * 37) % W, 9 + ((i * 11) % (H - GROUND - 11)), 3, 2, i % 2 ? '#b0743c' : '#dca36a');
  }),
};

// ---------- 장애물 그리기 ----------
function drawHydrant(ctx, x, y) {
  rect(ctx, x - 1, y - 1, 16, 19, OUT);
  rect(ctx, x + 1, y + 2, 12, 15, '#e84a5f'); rect(ctx, x + 2, y + 2, 2, 15, '#ff7f8f');
  rect(ctx, x + 3, y, 8, 3, '#e84a5f'); rect(ctx, x - 1, y + 7, 16, 4, OUT); rect(ctx, x, y + 8, 14, 2, '#c2334a');
  rect(ctx, x + 6, y + 11, 2, 2, '#ffe066');
}
function drawBox(ctx, x, y, h) {
  for (let yy = y; yy < y + h; yy += 17) {
    rect(ctx, x - 1, yy - 1, 18, 18, OUT);
    rect(ctx, x, yy, 16, 16, '#d9a066'); rect(ctx, x, yy, 16, 2, '#e9b983');
    rect(ctx, x + 6, yy, 4, 7, '#f5e0b8'); rect(ctx, x + 2, yy + 11, 6, 2, '#b97f47');
  }
}
function drawLaundry(ctx, x, y) {
  rect(ctx, x - 6, y - 2, 40, 1, OUT);
  rect(ctx, x - 6, y - 1, 40, 1, '#fff6e6');
  // 양말, 셔츠, 수건
  rect(ctx, x - 1, y, 8, 12, OUT); rect(ctx, x, y + 1, 6, 10, '#7cc7ff'); rect(ctx, x, y + 10, 9, 5, OUT); rect(ctx, x + 1, y + 10, 7, 4, '#7cc7ff');
  rect(ctx, x + 11, y, 14, 20, OUT); rect(ctx, x + 12, y + 1, 12, 18, '#ffe066'); rect(ctx, x + 9, y + 1, 4, 6, OUT); rect(ctx, x + 23, y + 1, 4, 6, OUT);
  rect(ctx, x + 16, y + 6, 4, 4, '#ff9fb8');
  rect(ctx, x + 28, y, 6, 16, OUT); rect(ctx, x + 29, y + 1, 4, 14, '#ff9fb8'); rect(ctx, x + 29, y + 11, 4, 1, '#fff');
}

const OBSTACLES = {
  hydrant: { w: 14, h: 17, draw: (ctx, o) => drawHydrant(ctx, o.x, GROUND - 17), box: (o) => ({ x: o.x + 1, y: GROUND - 16, w: 12, h: 16 }) },
  box: { w: 16, h: 16, draw: (ctx, o) => drawBox(ctx, o.x, GROUND - 16, 16), box: (o) => ({ x: o.x + 1, y: GROUND - 15, w: 14, h: 15 }) },
  tower: { w: 16, h: 33, draw: (ctx, o) => drawBox(ctx, o.x, GROUND - 33, 33), box: (o) => ({ x: o.x + 1, y: GROUND - 32, w: 14, h: 32 }) },
  laundry: { w: 34, h: 20, draw: (ctx, o) => drawLaundry(ctx, o.x, GROUND - 38), box: (o) => ({ x: o.x, y: GROUND - 40, w: 34, h: 25 }) },
};

// ---------- 패턴 ----------
function makeChunk(x, t, rnd) {
  const items = [];
  const obs = [];
  const bone = (bx, by, kind = 'bone') => items.push({ x: bx, y: by, kind });
  const pick = rnd();
  const hard = Math.min(1, t / 40);
  let len;
  if (pick < 0.22) {
    for (let i = 0; i < 7; i++) bone(x + i * 14, GROUND - 12);
    len = 7 * 14;
  } else if (pick < 0.45) {
    obs.push({ type: 'hydrant', x: x + 42 });
    for (let i = 0; i < 7; i++) bone(x + 12 + i * 12, GROUND - 14 - Math.sin((i / 6) * Math.PI) * 38);
    len = 110;
  } else if (pick < 0.62) {
    obs.push({ type: 'laundry', x: x + 30 });
    for (let i = 0; i < 6; i++) bone(x + 20 + i * 11, GROUND - 7);
    len = 110;
  } else if (pick < 0.62 + 0.18 * (0.4 + hard)) {
    obs.push({ type: 'tower', x: x + 50 });
    for (let i = 0; i < 8; i++) bone(x + 14 + i * 12, GROUND - 16 - Math.sin((i / 7) * Math.PI) * 62);
    len = 130;
  } else {
    obs.push({ type: 'box', x: x + 20 });
    obs.push({ type: 'box', x: x + 20 + 70 - hard * 16 });
    for (let i = 0; i < 4; i++) bone(x + 8 + i * 10, GROUND - 26 - i * 4);
    for (let i = 0; i < 4; i++) bone(x + 58 + i * 10, GROUND - 12);
    len = 120;
  }
  if (rnd() < 0.25) items.push({ x: x + len / 2, y: GROUND - 70, kind: 'star' });
  return { items, obs, len };
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function playRunner(dog) {
  return new Promise((resolve) => {
    const canvas = el('canvas', { width: W, height: H, class: 'pixel runner-canvas' });
    const hud = { score: el('span', {}, '0'), hp: el('i', {}) };
    const jumpBtn = el('button', { class: 'btn primary big run-btn', type: 'button' }, '점프');
    const slideBtn = el('button', { class: 'btn secondary big run-btn', type: 'button' }, '슬라이드');
    const { close } = modal({
      title: '멍뭉 런!',
      className: 'game-card runner',
      body: el('div', {},
        el('div', { class: 'game-hud' },
          el('span', { class: 'hp' }, '체력 ', el('span', { class: 'bar hp-bar' }, hud.hp)),
          el('span', {}, '간식 ', hud.score)),
        canvas,
        el('div', { class: 'run-controls' }, jumpBtn, slideBtn),
        el('p', { class: 'hint' }, '점프는 두 번까지! 빨래는 슬라이드로 피해요. 하트를 먹으면 체력이 차요.')),
      buttons: [],
      dismissable: false,
    });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const layers = Object.fromEntries(Object.entries(LAYERS).map(([k, f]) => [k, f()]));
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed & 0xffff) / 0x10000; };

    const s = {
      t: 0, dist: 0, speed: 95, hp: 100, score: 0, y: 0, vy: 0, jumps: 0, sliding: false, slideHeld: false,
      hurtT: 0, items: [], obs: [], nextChunk: 0, nextHeart: 14, countdown: 3, over: false, overT: 0, pops: [], dust: [],
    };
    s.nextChunk = 30;

    const jump = () => {
      if (s.over || s.countdown > 0) return;
      if (s.jumps < 2) {
        s.vy = s.jumps === 0 ? JUMP_V : DOUBLE_V;
        s.jumps += 1;
        s.sliding = false;
        sfx.jump();
      }
    };
    const slide = (on) => {
      s.slideHeld = on;
      if (on && s.jumps === 0 && !s.over && s.countdown <= 0) { if (!s.sliding) sfx.slide(); s.sliding = true; }
      if (!on) s.sliding = false;
    };
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
    slideBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); slideBtn.setPointerCapture(e.pointerId); slide(true); });
    slideBtn.addEventListener('pointerup', () => slide(false));
    slideBtn.addEventListener('pointercancel', () => slide(false));
    canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); if (s.over && s.overT > 1) finish(); else jump(); });
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
      close();
      resolve(s.score);
    };
    playBgm('play');

    const dogBox = () => {
      const h = s.sliding ? 12 : 24;
      return { x: DOG_X - 10, y: GROUND - h + s.y, w: 20, h };
    };

    const update = (dt) => {
      s.t += dt;
      if (s.countdown > 0) { s.countdown -= dt; return; }
      if (s.over) { s.overT += dt; s.speed = Math.max(0, s.speed - 200 * dt); }
      else {
        s.speed = Math.min(175, 95 + s.t * 1.8);
        s.hp -= 3 * dt;
        if (s.hp <= 0) { s.hp = 0; s.over = true; sfx.gameOver(); }
      }
      const dx = s.speed * dt;
      s.dist += dx;
      // 물리
      s.vy += GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.y >= 0) {
        if (s.jumps > 0) { sfx.land(); for (let i = 0; i < 3; i++) s.dust.push({ x: DOG_X - 6 + i * 4, y: GROUND - 2, age: 0 }); }
        s.y = 0; s.vy = 0; s.jumps = 0;
        if (s.slideHeld && !s.sliding) s.sliding = true;
      }
      // 새 구간 만들기
      s.nextChunk -= dx;
      if (s.nextChunk <= 0 && !s.over) {
        const c = makeChunk(W + 10, s.t, rnd);
        s.items.push(...c.items);
        s.obs.push(...c.obs);
        s.nextChunk = c.len + 50 + rnd() * 50;
      }
      s.nextHeart -= dt;
      if (s.nextHeart <= 0 && !s.over) { s.items.push({ x: W + 20, y: GROUND - 44, kind: 'heart' }); s.nextHeart = 12 + rnd() * 6; }
      for (const it of s.items) it.x -= dx;
      for (const o of s.obs) o.x -= dx;
      s.items = s.items.filter((it) => it.x > -20 && !it.taken);
      s.obs = s.obs.filter((o) => o.x > -50);
      if (s.hurtT > 0) s.hurtT -= dt;
      if (!s.over) {
        const box = dogBox();
        for (const it of s.items) {
          const ib = { x: it.x - 5, y: it.y - 5, w: 10, h: 10 };
          if (!hit(box, ib)) continue;
          it.taken = true;
          if (it.kind === 'bone') { s.score += 1; sfx.catch(); }
          if (it.kind === 'star') { s.score += 10; sfx.star(); s.pops.push({ x: it.x, y: it.y, text: '+10', age: 0 }); }
          if (it.kind === 'heart') { s.hp = Math.min(100, s.hp + 25); sfx.love(); s.pops.push({ x: it.x, y: it.y, text: '체력 UP', age: 0 }); }
        }
        if (s.hurtT <= 0) {
          for (const o of s.obs) {
            if (!o.hit && hit(box, OBSTACLES[o.type].box(o))) {
              o.hit = true;
              s.hp -= 20;
              s.hurtT = 1.2;
              sfx.hurt();
              s.pops.push({ x: DOG_X, y: GROUND - 34, text: '아야!', age: 0 });
              if (s.hp <= 0) { s.hp = 0; s.over = true; sfx.gameOver(); }
              break;
            }
          }
        }
      }
      if (!s.over && s.jumps === 0 && Math.floor(s.t * 8) !== Math.floor((s.t - dt) * 8)) s.dust.push({ x: DOG_X - 10, y: GROUND - 2, age: 0 });
      for (const p of s.pops) { p.age += dt; p.y -= 18 * dt; }
      s.pops = s.pops.filter((p) => p.age < 0.9);
      for (const d of s.dust) { d.age += dt; d.x -= dx * 0.6; d.y -= 6 * dt; }
      s.dust = s.dust.filter((d) => d.age < 0.4);
    };

    const tile = (img, offset, y) => {
      const x = -Math.floor(offset % img.width);
      ctx.drawImage(img, x, y);
      ctx.drawImage(img, x + img.width, y);
    };

    const draw = () => {
      // 하늘
      const sky = ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'];
      sky.forEach((c, i) => rect(ctx, 0, i * 16, W, 16, c));
      rect(ctx, 0, 64, W, 40, '#d8f1ff');
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of [[30, 16], [120, 26], [200, 12]]) {
        const cx = ((x - s.dist * 0.05) % (W + 40) + W + 40) % (W + 40) - 20;
        ellipse(ctx, cx, y, 10, 3, '#fff'); ellipse(ctx, cx + 5, y - 3, 6, 3, '#fff');
      }
      ellipse(ctx, 214, 22, 8, 8, '#fff3b0'); ellipse(ctx, 214, 22, 6, 6, '#ffe066');
      tile(layers.hills, s.dist * 0.15, 46);
      tile(layers.trees, s.dist * 0.35, 58);
      tile(layers.fence, s.dist * 0.7, GROUND - 22);
      tile(layers.ground, s.dist, GROUND);
      // 장애물, 간식
      for (const o of s.obs) OBSTACLES[o.type].draw(ctx, o);
      for (const it of s.items) {
        const bob = Math.round(Math.sin(s.t * 6 + it.x * 0.1));
        const icon = it.kind === 'bone' ? 'coin' : it.kind;
        const ic = iconCanvas(icon);
        ctx.drawImage(ic, Math.round(it.x - ic.width / 2), Math.round(it.y - ic.height / 2) + bob);
      }
      for (const d of s.dust) {
        ctx.globalAlpha = 1 - d.age / 0.4;
        rect(ctx, d.x, d.y, 3, 2, '#f0dcc0');
        ctx.globalAlpha = 1;
      }
      // 강아지
      const blink = s.hurtT > 0 && Math.floor(s.t * 12) % 2 === 0;
      if (!blink) {
        let pose; let opts;
        if (s.over) { pose = 'lie'; opts = { eyes: 'closed' }; }
        else if (s.sliding) { pose = 'lie'; opts = { eyes: 'happy', mouth: 'tongue' }; }
        else if (s.jumps > 0) { pose = 'walk1'; opts = { eyes: 'happy', mouth: 'open', tail: 1 }; }
        else { pose = Math.floor(s.t * 10) % 2 ? 'walk1' : 'walk2'; opts = { eyes: s.hurtT > 0 ? 'sad' : 'open', mouth: 'tongue', tail: Math.floor(s.t * 8) % 2 }; }
        const spr = dogSprite(dog.breed, dog.stage, pose, { ...opts, equip: dog.equip });
        const bounce = s.jumps === 0 && !s.sliding && !s.over ? -(Math.floor(s.t * 10) % 2) : 0;
        ctx.drawImage(spr.canvas, DOG_X - DOG_W / 2 + 2, Math.round(GROUND - 41 + s.y) + bounce);
      }
      ctx.font = 'bold 11px Galmuri11';
      ctx.textAlign = 'center';
      for (const p of s.pops) {
        ctx.fillStyle = '#fff';
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(p.text, p.x + ox, p.y + oy);
        ctx.fillStyle = OUT; ctx.fillText(p.text, p.x, p.y);
      }
      if (s.countdown > 0) {
        ctx.font = 'bold 24px Galmuri11';
        ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(s.countdown)), W / 2 + 2, 62);
        ctx.fillStyle = '#e8708f'; ctx.fillText(String(Math.ceil(s.countdown)), W / 2, 60);
      }
      if (s.over) {
        ctx.fillStyle = 'rgba(255, 250, 240, 0.9)';
        ctx.fillRect(W / 2 - 70, 28, 140, 58);
        ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 70, 28, 140, 58);
        ctx.fillStyle = OUT;
        ctx.font = 'bold 11px Galmuri11'; ctx.fillText('헥헥… 다 뛰었어요!', W / 2, 45);
        ctx.font = '9px Galmuri11';
        ctx.fillText(`간식 ${s.score}개 · ${Math.floor(s.dist / 10)}m`, W / 2, 61);
        if (s.overT > 1) ctx.fillText('화면을 누르면 끝나요', W / 2, 77);
      }
      ctx.textAlign = 'start';
      hud.score.textContent = `${s.score}개`;
      hud.hp.style.width = `${Math.max(0, s.hp)}%`;
      hud.hp.style.background = s.hp > 50 ? 'var(--grass-l)' : s.hp > 25 ? 'var(--butter)' : 'var(--red)';
    };

    let last = performance.now();
    const frame = (now) => {
      if (done) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      if (s.over && s.overT > 4) { finish(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
