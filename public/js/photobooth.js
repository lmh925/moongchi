// 멍뭉 네컷 포토부스 (인생네컷처럼!)
// 1) 같이 찍을 친구 고르기(최대 4마리) → 2) 촬영: 포즈·방향·표정·위치 바꾸고 소품 씌우고, 3·2·1 찰칵!
// 3) 꾸미기: 세로 네컷/2×2, 프레임, 필터, 펜·스탬프 → 4) 앨범에 저장
import { dogSprite, propCanvas, propFit, iconCanvas, iconURL, DOG_W } from './sprites.js';
import { el, toast } from './ui.js';
import { sfx, playBgm } from './audio.js';

const W = 160;
const H = 112;
const FLOOR = 84; // 배경 바닥선
const FEET_MIN = 88; const FEET_MAX = 108;
const SHOTS = 4;
const TIME_LIMIT = 180;
const ALBUM_KEY = 'meongmung.album';
const ALBUM_MAX = 12;

// 소품: 입는 소품(강아지에 가져다 대면 딱 입혀져요) + 스티커(아무 데나 붙여요)
const PROPS = [
  'kinder_hat', 'ribbon', 'round_glasses', 'heart_glasses', 'sunglasses', 'star_glasses', 'crown', 'flower',
  'bunny_ears', 'cat_ears', 'santa', 'wizard', 'bowtie', 'bandana', 'medal', 'heart', 'sparkle', 'star', 'note',
];
const CHARM_PROPS = [{ stage: 3, ids: ['halo', 'pearl', 'sprout'] }, { stage: 6, ids: ['pirate', 'bear_hat', 'scarf'] }];

export const POSES = [
  { id: 'front', name: '정면' }, { id: 'sit', name: '앉아' }, { id: 'paw', name: '손!' }, { id: 'beg', name: '애교' },
  { id: 'stand', name: '옆모습' }, { id: 'bow', name: '인사' }, { id: 'lie', name: '엎드려' }, { id: 'jump', name: '점프!' },
];
const FACES = [
  { eyes: 'happy', mouth: 'tongue', name: '헤헤' },
  { eyes: 'open', mouth: 'closed', name: '새침' },
  { eyes: 'happy', mouth: 'open', name: '신나' },
  { eyes: 'closed', mouth: 'tongue', name: '메롱' },
  { eyes: 'open', mouth: 'tongue', name: '방긋' },
  { eyes: 'sad', mouth: 'closed', name: '글썽' },
];

const BACKDROPS = {
  studio: { name: '하얀 스튜디오', draw: (ctx) => {
    fill(ctx, 0, 0, W, H, '#f4f1ee');
    for (let y = 0; y < FLOOR; y += 2) fill(ctx, 0, y, W, 1, y % 4 ? '#f4f1ee' : '#efebe7');
    fill(ctx, 0, FLOOR, W, H - FLOOR, '#e6e0da'); fill(ctx, 0, FLOOR, W, 1, '#ffffff');
  } },
  pink: { name: '딸기 하트', draw: (ctx) => {
    fill(ctx, 0, 0, W, H, '#ffd9e3');
    for (let y = 4; y < FLOOR; y += 12) for (let x = (y / 12) % 2 ? 2 : 8; x < W; x += 12) heart(ctx, x, y, '#ffeef3');
    floor(ctx, '#ffc2d3', '#ffb0c4');
  } },
  mint: { name: '민트 별', draw: (ctx) => {
    fill(ctx, 0, 0, W, H, '#d6f3e6');
    for (let y = 5; y < FLOOR; y += 13) for (let x = (y / 13) % 2 ? 4 : 10; x < W; x += 14) star(ctx, x, y, '#ffffff');
    floor(ctx, '#aee6cf', '#9adbc0');
  } },
  sky: { name: '구름 하늘', draw: (ctx) => {
    ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff', '#e4f6ff'].forEach((c, i) => fill(ctx, 0, i * 18, W, 18, c));
    for (const [x, y] of [[16, 12], [70, 8], [128, 26], [44, 38], [110, 50]]) { blob(ctx, x, y, 10, 3, '#fff'); blob(ctx, x + 4, y - 3, 6, 3, '#fff'); }
    floor(ctx, '#8fd18a', '#6cc070');
  } },
  night: { name: '별밤', draw: (ctx) => {
    ['#1f2350', '#272c63', '#303675', '#3a4188'].forEach((c, i) => fill(ctx, 0, i * 21, W, 21, c));
    for (let i = 0; i < 40; i++) fill(ctx, (i * 37) % W, (i * 23) % (FLOOR - 4), 1, 1, i % 5 ? '#ffffff' : '#ffe066');
    blob(ctx, 130, 18, 8, 8, '#fff3b0'); blob(ctx, 134, 15, 6, 6, '#272c63');
    floor(ctx, '#4b3f6b', '#433862');
  } },
  party: { name: '파티', draw: (ctx) => {
    fill(ctx, 0, 0, W, H, '#fff4d6');
    const cs = ['#ff6f91', '#ffd23f', '#6cc070', '#5b8cff', '#b07cff'];
    for (let x = 0; x < W; x += 12) { tri(ctx, x, 2, cs[(x / 12) % 5]); }
    for (let i = 0; i < 50; i++) fill(ctx, (i * 29 + 7) % W, 14 + ((i * 17) % (FLOOR - 18)), 2, 1, cs[i % 5]);
    floor(ctx, '#f7c8a0', '#f0b98a');
  } },
  flower: { name: '꽃 벽', draw: (ctx) => {
    fill(ctx, 0, 0, W, H, '#e9f7e4');
    const cs = ['#ff9fc4', '#ffe066', '#ffffff', '#c7a8ff'];
    for (let y = 6; y < FLOOR - 4; y += 11) for (let x = (y / 11) % 2 ? 4 : 10; x < W; x += 12) flowerDot(ctx, x, y, cs[(x + y) % 4]);
    floor(ctx, '#bfe3b4', '#b0dba4');
  } },
  beach: { name: '바닷가', draw: (ctx) => {
    ['#8fd3ff', '#a9dcff', '#c4e8ff'].forEach((c, i) => fill(ctx, 0, i * 16, W, 16, c));
    fill(ctx, 0, 48, W, FLOOR - 48, '#4fb3e8');
    for (let x = 0; x < W; x += 10) fill(ctx, x, 52 + (x % 20 ? 0 : 6), 5, 1, '#bfe8ff');
    blob(ctx, 24, 16, 8, 8, '#ffe066');
    floor(ctx, '#f7dc9b', '#f0cf85');
  } },
};

function fill(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function heart(ctx, x, y, c) { fill(ctx, x, y, 1, 1, c); fill(ctx, x + 2, y, 1, 1, c); fill(ctx, x, y + 1, 3, 1, c); fill(ctx, x + 1, y + 2, 1, 1, c); }
function star(ctx, x, y, c) { fill(ctx, x + 1, y, 1, 3, c); fill(ctx, x, y + 1, 3, 1, c); }
function flowerDot(ctx, x, y, c) { fill(ctx, x + 1, y, 1, 1, c); fill(ctx, x, y + 1, 3, 1, c); fill(ctx, x + 1, y + 2, 1, 1, c); fill(ctx, x + 1, y + 1, 1, 1, '#ffb000'); }
function tri(ctx, x, y, c) { for (let i = 0; i < 6; i++) fill(ctx, x + i, y + i, 12 - i * 2, 1, c); }
function blob(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) { const h = rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2); ctx.fillRect(Math.round(cx - h), cy + y, Math.round(h * 2), 1); }
}
function floor(ctx, a, b) { fill(ctx, 0, FLOOR, W, H - FLOOR, a); for (let x = 0; x < W; x += 8) fill(ctx, x, FLOOR, 4, H - FLOOR, b); fill(ctx, 0, FLOOR, W, 1, '#ffffff'); }

// ---------- 앨범 (이 기기에 보관) ----------
export function loadAlbum() {
  try { return JSON.parse(localStorage.getItem(ALBUM_KEY) ?? '[]'); } catch { return []; }
}

function saveAlbum(list) {
  while (list.length) {
    try { localStorage.setItem(ALBUM_KEY, JSON.stringify(list)); return true; } catch { list.pop(); }
  }
  return false;
}

export function addToAlbum(entry) {
  const list = loadAlbum();
  list.unshift(entry);
  return saveAlbum(list.slice(0, ALBUM_MAX));
}

export function removeFromAlbum(id) {
  saveAlbum(loadAlbum().filter((p) => p.id !== id));
}

export function downloadPhoto(url, name = 'meongmung-4cut.png') {
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
}


// ---------- 촬영 ----------
const SLOT_OF = { head: 'head', neck: 'neck', eye: 'face' };
const SLOTS_X = { 1: [80], 2: [56, 104], 3: [38, 80, 122], 4: [24, 61, 99, 136] };

// cast: [{ dog, name }] (첫 번째가 내 강아지, 최대 4마리)
export function playPhotobooth(cast, { charm = 1 } = {}) {
  return new Promise((resolve) => {
    const names = cast.map((c) => c.name);
    const actors = cast.slice(0, 4).map((c, i, arr) => ({
      name: c.name, dog: c.dog, x: SLOTS_X[arr.length][i], y: 100 + (i % 2 ? 2 : 0),
      pose: 'front', flip: i >= arr.length / 2, face: 0,
      equip: { ...(c.dog.equip ?? {}) }, orig: { ...(c.dog.equip ?? {}) },
    }));
    let sel = 0;

    const stageCanvas = el('canvas', { width: W, height: H, class: 'pixel pb-canvas' });
    const propLayer = el('div', { class: 'pb-props' });
    const flash = el('div', { class: 'pb-flash' });
    const countEl = el('div', { class: 'pb-count', hidden: true });
    const stage = el('div', { class: 'pb-stage wide' }, stageCanvas, propLayer, flash, countEl);
    const cutSlots = el('div', { class: 'pb-cuts' }, Array.from({ length: SHOTS }, (_, i) => el('div', { class: 'pb-cut' }, `${i + 1}`)));
    const timerEl = el('span', { class: 'pb-timer' }, `${TIME_LIMIT}초`);
    const tray = el('div', { class: 'pb-tray', 'aria-label': '소품 상자' });
    const shootBtn = el('button', { class: 'btn primary big pb-shoot', type: 'button' }, el('img', { class: 'pixel', src: iconURL('camera', 3), alt: '' }), '찰칵!');
    const selBar = el('div', { class: 'pb-selbar' });
    const bgBtn = el('button', { class: 'btn small', type: 'button' });
    const randomBtn = el('button', { class: 'btn small secondary', type: 'button' }, '🎲 다 같이 랜덤 포즈');
    const clearBtn = el('button', { class: 'btn small', type: 'button' }, '스티커 빼기');
    const root = el('div', { class: 'modal-wrap pb-wrap' },
      el('div', { class: 'modal-card pb-card' },
        el('div', { class: 'pb-head' }, el('h2', { class: 'modal-title' }, '📸 멍뭉 네컷'), timerEl),
        cutSlots,
        stage,
        selBar,
        el('div', { class: 'pb-tools' }, randomBtn, bgBtn, clearBtn),
        el('p', { class: 'hint center' }, '강아지를 끌어서 자리를 옮기고, 한 번 더 톡 누르면 포즈가 바뀌어요. 소품을 강아지에게 끌어다 대면 입혀 줘요!'),
        tray,
        el('div', { class: 'modal-buttons' },
          el('button', { class: 'btn ghost', type: 'button', onclick: () => finish(null) }, '그만하기'),
          shootBtn)));
    document.getElementById('modal-root').append(root);
    playBgm('home');

    const ctx = stageCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const bgKeys = Object.keys(BACKDROPS);
    let bg = 'studio';
    let stickers = [];
    let uid = 0;
    const cuts = [];
    let left = TIME_LIMIT;
    let done = false;
    let counting = false;
    let t = 0;

    const lift = (a, tt) => (a.pose === 'jump' ? 9 + Math.round(Math.abs(Math.sin(tt / 3)) * 2) : 0);
    const spriteFor = (a, tail) => {
      const f = FACES[a.face];
      return dogSprite(a.dog.breed, a.dog.stage, a.pose === 'jump' ? 'beg' : a.pose, { eyes: f.eyes, mouth: f.mouth, tail, fluff: 1, equip: a.equip });
    };
    const drawActor = (target, a, tt) => {
      const spr = spriteFor(a, Math.floor(tt / 6) % 2);
      const up = lift(a, tt);
      target.fillStyle = 'rgba(74,51,48,0.2)';
      target.fillRect(Math.round(a.x - 12 + up / 3), Math.round(a.y), Math.round(24 - up / 1.5), 2);
      const dx = Math.round(a.x - DOG_W / 2); const dy = Math.round(a.y - 41 - up);
      if (a.flip && a.pose !== 'front') {
        target.save(); target.translate(dx + DOG_W, dy); target.scale(-1, 1); target.drawImage(spr.canvas, 0, 0); target.restore();
      } else target.drawImage(spr.canvas, dx, dy);
    };

    // ---------- 무대 그리기 ----------
    const drawStage = (target, photo = false) => {
      target.imageSmoothingEnabled = false;
      BACKDROPS[bg].draw(target);
      const tt = photo ? 3 : t;
      for (const a of [...actors].sort((p, q) => p.y - q.y)) drawActor(target, a, tt);
      if (photo) {
        for (const p of stickers) {
          const c = propCanvas(p.id);
          target.drawImage(c, Math.round(p.x), Math.round(p.y), Math.round(c.width * p.scale), Math.round(c.height * p.scale));
        }
      } else if (actors[sel]) {
        // 고른 강아지 머리 위 화살표 (사진에는 안 나와요)
        const a = actors[sel];
        const y = Math.round(a.y - 46 - lift(a, t) + (Math.floor(t / 5) % 2));
        target.fillStyle = '#e8708f';
        for (let i = 0; i < 4; i++) target.fillRect(Math.round(a.x) - 3 + i, y + i, 7 - i * 2, 1);
      }
    };
    const loop = () => {
      if (done) return;
      t += 1;
      drawStage(ctx);
      setTimeout(() => requestAnimationFrame(loop), 70);
    };
    loop();

    // ---------- 고른 강아지 도구 ----------
    const renderSel = () => {
      const a = actors[sel];
      const pi = POSES.findIndex((p) => p.id === a.pose);
      const setPose = (d) => { a.pose = POSES[(pi + d + POSES.length) % POSES.length].id; sfx.tap(); renderSel(); };
      selBar.replaceChildren(
        el('b', { class: 'pb-selname' }, `🐾 ${a.name}`),
        el('span', { class: 'pb-pose' },
          el('button', { class: 'btn small', type: 'button', 'aria-label': '이전 포즈', onclick: () => setPose(-1) }, '◀'),
          el('span', {}, POSES[pi].name),
          el('button', { class: 'btn small', type: 'button', 'aria-label': '다음 포즈', onclick: () => setPose(1) }, '▶')),
        el('button', { class: 'btn small', type: 'button', disabled: a.pose === 'front', onclick: () => { a.flip = !a.flip; sfx.whoosh(); } }, '↔ 방향'),
        el('button', { class: 'btn small', type: 'button', onclick: () => { a.face = (a.face + 1) % FACES.length; sfx.bark(1.2); renderSel(); } }, `표정: ${FACES[a.face].name}`),
        el('button', { class: 'btn small', type: 'button', onclick: () => { a.equip = {}; sfx.whoosh(); } }, '옷 벗기'),
        el('button', { class: 'btn small', type: 'button', onclick: () => { a.equip = { ...a.orig }; sfx.pop(); } }, '원래 옷'));
    };
    const renderBg = () => { bgBtn.textContent = `배경: ${BACKDROPS[bg].name} ▶`; };
    renderSel(); renderBg();

    const toStage = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H, inside: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom };
    };
    const actorAt = (x, y) => {
      let best = null;
      for (const [i, a] of actors.entries()) {
        const up = lift(a, t);
        if (Math.abs(x - a.x) < 15 && y > a.y - 36 - up && y < a.y + 3 - up && (!best || a.y > actors[best].y)) best = i;
      }
      return best;
    };

    // 강아지 끌어서 자리 옮기기 · 톡 누르면 포즈 바꾸기
    stageCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const start = toStage(e.clientX, e.clientY);
      const i = actorAt(start.x, start.y);
      if (i === null) return;
      const wasSel = sel === i;
      sel = i; renderSel();
      const a = actors[i];
      const ox = start.x - a.x; const oy = start.y - a.y;
      let moved = false;
      stageCanvas.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const pos = toStage(ev.clientX, ev.clientY);
        if (Math.abs(pos.x - start.x) + Math.abs(pos.y - start.y) > 2) moved = true;
        a.x = Math.min(W - 12, Math.max(12, pos.x - ox));
        a.y = Math.min(FEET_MAX, Math.max(FEET_MIN, pos.y - oy));
      };
      const up = () => {
        stageCanvas.removeEventListener('pointermove', move);
        stageCanvas.removeEventListener('pointerup', up);
        stageCanvas.removeEventListener('pointercancel', up);
        if (!moved && wasSel) {
          a.pose = POSES[(POSES.findIndex((p) => p.id === a.pose) + 1) % POSES.length].id;
          sfx.bark(1.1); renderSel();
        } else if (!moved) sfx.tap();
      };
      stageCanvas.addEventListener('pointermove', move);
      stageCanvas.addEventListener('pointerup', up);
      stageCanvas.addEventListener('pointercancel', up);
    });

    // ---------- 소품 ----------
    const place = (p) => {
      const c = propCanvas(p.id);
      Object.assign(p.el.style, {
        left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`,
        width: `${((c.width * p.scale) / W) * 100}%`, height: `${((c.height * p.scale) / H) * 100}%`,
      });
    };
    const removeSticker = (p) => {
      stickers = stickers.filter((x) => x !== p);
      p.el.classList.add('poof');
      setTimeout(() => p.el.remove(), 200);
    };
    // 입는 소품: 가장 가까운 강아지에게 딱 입혀 줘요 (포즈를 바꿔도 따라가요)
    const wear = (id, x, y) => {
      const fit = propFit(id);
      let best = null; let bestD = 30;
      for (const [i, a] of actors.entries()) {
        const d = Math.hypot(x - a.x, (y - (a.y - 26 - lift(a, t))) * 0.8);
        if (d < bestD) { best = i; bestD = d; }
      }
      if (best === null) { toast('강아지에게 가져다 대면 입혀 줘요!'); return; }
      actors[best].equip = { ...actors[best].equip, [SLOT_OF[fit.anchor]]: id };
      sel = best; renderSel();
      sfx.pop();
    };
    const addSticker = (id, clientX, clientY) => {
      const c = propCanvas(id);
      const pos = toStage(clientX, clientY);
      const p = { uid: uid++, id, scale: 1.5, x: 0, y: 0 };
      p.x = pos.x - (c.width * p.scale) / 2; p.y = pos.y - (c.height * p.scale) / 2;
      p.el = el('img', { class: 'pixel pb-prop', src: propCanvas(id, 4).toDataURL(), alt: '', draggable: 'false' });
      stickers.push(p);
      propLayer.append(p.el);
      place(p);
      bindSticker(p);
      sfx.pop();
    };
    const drop = (id, clientX, clientY) => {
      const pos = toStage(clientX, clientY);
      if (!pos.inside) return;
      if (propFit(id).anchor) wear(id, pos.x, pos.y);
      else addSticker(id, clientX, clientY);
    };
    // 스티커: 끌어서 옮기기, 톡 누르면 크기 바꾸기, 밖으로 끌어내면 빼기
    const bindSticker = (p) => {
      p.el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        p.el.setPointerCapture(e.pointerId);
        const start = toStage(e.clientX, e.clientY);
        const ox = start.x - p.x; const oy = start.y - p.y;
        let moved = false;
        p.el.classList.add('dragging');
        const move = (ev) => {
          const pos = toStage(ev.clientX, ev.clientY);
          if (Math.abs(pos.x - start.x) + Math.abs(pos.y - start.y) > 2) moved = true;
          p.x = pos.x - ox; p.y = pos.y - oy;
          place(p);
        };
        const up = (ev) => {
          p.el.removeEventListener('pointermove', move);
          p.el.removeEventListener('pointerup', up);
          p.el.removeEventListener('pointercancel', up);
          p.el.classList.remove('dragging');
          if (!toStage(ev.clientX, ev.clientY).inside) { removeSticker(p); sfx.whoosh(); return; }
          if (!moved) { p.scale = p.scale >= 2.5 ? 1 : p.scale + 0.5; sfx.tap(); }
          place(p);
        };
        p.el.addEventListener('pointermove', move);
        p.el.addEventListener('pointerup', up);
        p.el.addEventListener('pointercancel', up);
      });
    };

    // 소품 상자: 가로로 밀면 스크롤, 위로 끌면 집어요. 그냥 톡 누르면 고른 강아지에게 입혀요
    for (const group of CHARM_PROPS) {
      if (charm >= group.stage) continue;
      tray.append(el('div', { class: 'pb-item pb-locked', title: `멋짐 ${group.stage}단계가 되면 생겨요` },
        el('img', { class: 'pixel', src: propCanvas(group.ids[0], 4).toDataURL(), alt: '' }), el('small', {}, `멋짐 ${group.stage}`)));
    }
    for (const id of [...PROPS, ...CHARM_PROPS.filter((g) => charm >= g.stage).flatMap((g) => g.ids)]) {
      if (!propCanvas(id)) continue;
      const item = el('button', { class: 'pb-item', type: 'button', 'aria-label': id },
        el('img', { class: 'pixel', src: propCanvas(id, 4).toDataURL(), alt: '', draggable: 'false' }));
      tray.append(item);
      item.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') e.preventDefault();
        const sx = e.clientX; const sy = e.clientY;
        let ghost = null;
        const move = (ev) => {
          const dx = ev.clientX - sx; const dy = ev.clientY - sy;
          if (!ghost) {
            if (e.pointerType === 'mouse' ? Math.hypot(dx, dy) < 4 : !(dy < -8 && Math.abs(dy) > Math.abs(dx))) return;
            item.setPointerCapture(ev.pointerId);
            ghost = el('img', { class: 'pixel pb-ghost', src: propCanvas(id, 4).toDataURL(), alt: '' });
            document.body.append(ghost);
            sfx.tap();
          }
          ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%)`;
        };
        const up = (ev) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          if (ghost) { ghost.remove(); drop(id, ev.clientX, ev.clientY); return; }
          if (ev.type !== 'pointerup' || Math.hypot(ev.clientX - sx, ev.clientY - sy) >= 6) return;
          if (propFit(id).anchor) { // 톡 → 고른 강아지에게 입혀요
            const a = actors[sel];
            a.equip = { ...a.equip, [SLOT_OF[propFit(id).anchor]]: id };
            sfx.pop();
          } else {
            const r = stage.getBoundingClientRect();
            addSticker(id, r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.15 + Math.random() * 0.25));
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    }

    randomBtn.addEventListener('click', () => {
      for (const a of actors) {
        a.pose = POSES[Math.floor(Math.random() * POSES.length)].id;
        a.face = Math.floor(Math.random() * FACES.length);
        a.flip = Math.random() < 0.5;
      }
      sfx.whoosh(); renderSel();
    });
    bgBtn.addEventListener('click', () => { bg = bgKeys[(bgKeys.indexOf(bg) + 1) % bgKeys.length]; renderBg(); sfx.pop(); });
    clearBtn.addEventListener('click', () => { [...stickers].forEach(removeSticker); });

    // ---------- 3, 2, 1 찰칵! ----------
    const capture = () => {
      const c = el('canvas', { width: W, height: H });
      drawStage(c.getContext('2d'), true);
      cuts.push(c);
      sfx.shutter();
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      const slot = cutSlots.children[cuts.length - 1];
      slot.replaceChildren(el('img', { class: 'pixel', src: c.toDataURL(), alt: `${cuts.length}번째 사진` }));
      slot.classList.add('taken');
      shootBtn.lastChild.textContent = cuts.length >= SHOTS ? '완성!' : `찰칵! (${cuts.length}/${SHOTS})`;
      if (cuts.length >= SHOTS) setTimeout(() => finish(cuts), 700);
    };
    const shoot = () => {
      if (done || counting || cuts.length >= SHOTS) return;
      counting = true;
      let n = 3;
      countEl.hidden = false; countEl.textContent = String(n);
      sfx.tap();
      const step = setInterval(() => {
        n -= 1;
        if (n > 0) { countEl.textContent = String(n); sfx.tap(); return; }
        clearInterval(step);
        countEl.hidden = true;
        counting = false;
        if (!done) capture();
      }, 650);
    };
    shootBtn.addEventListener('click', shoot);

    const timer = setInterval(() => {
      left -= 1;
      timerEl.textContent = `${left}초`;
      timerEl.classList.toggle('hurry', left <= 15);
      if (left <= 0) {
        clearInterval(timer);
        toast('시간이 다 됐어요! 남은 컷을 찍을게요.');
        while (cuts.length < SHOTS) capture();
      }
    }, 1000);

    const finish = async (result) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      root.remove();
      if (!result) { resolve(null); return; }
      resolve(await decorate(result, names));
    };
  });
}

// ---------- 꾸미기: 레이아웃 · 프레임 · 필터 · 펜 · 스탬프 ----------
const FRAMES = {
  white: { name: '화이트', bg: '#ffffff', edge: '#4a3330', text: '#4a3330', sub: '#8a6a60' },
  black: { name: '블랙', bg: '#232025', edge: '#000000', text: '#ffffff', sub: '#c9c3cc' },
  pink: { name: '딸기', bg: '#ffd9e3', edge: '#e8708f', text: '#e8708f', sub: '#b35a72', pattern: 'heart', pc: '#ffeef3' },
  mint: { name: '민트', bg: '#d6f3e6', edge: '#4fa384', text: '#3f8f6f', sub: '#4f7f6a', pattern: 'star', pc: '#ffffff' },
  sky: { name: '하늘', bg: '#dff1ff', edge: '#5b8cff', text: '#3f6fd8', sub: '#5b7bb0', pattern: 'cloud', pc: '#ffffff' },
  rainbow: { name: '무지개', bg: 'rainbow', edge: '#4a3330', text: '#ffffff', sub: '#ffffff' },
};
const FILTERS = {
  none: { name: '원본' },
  bright: { name: '뽀샤시', fn: (r, g, b) => [r * 0.8 + 60, g * 0.8 + 52, b * 0.8 + 56] },
  mono: { name: '흑백', fn: (r, g, b) => { const v = r * 0.3 + g * 0.59 + b * 0.11; return [v, v, v]; } },
  retro: { name: '옛날 사진', fn: (r, g, b) => [r * 0.39 + g * 0.77 + b * 0.19, r * 0.35 + g * 0.69 + b * 0.17, r * 0.27 + g * 0.53 + b * 0.13] },
  cool: { name: '시원', fn: (r, g, b) => [r * 0.9, g * 0.98 + 6, b * 1.08 + 14] },
};
const PENS = ['#ffffff', '#4a3330', '#ff5d7a', '#ffd23f', '#5bc0ff', '#b07cff', '#6cc070'];
const STAMPS = ['heart', 'star', 'sparkle', 'note', 'laugh', 'surprise', 'clover', 'paw'];

function filtered(cut, key) {
  const f = FILTERS[key]?.fn;
  if (!f) return cut;
  const c = document.createElement('canvas'); c.width = cut.width; c.height = cut.height;
  const x = c.getContext('2d');
  x.drawImage(cut, 0, 0);
  const img = x.getImageData(0, 0, c.width, c.height); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = f(d[i], d[i + 1], d[i + 2]);
    d[i] = Math.min(255, r); d[i + 1] = Math.min(255, g); d[i + 2] = Math.min(255, b);
  }
  x.putImageData(img, 0, 0);
  return c;
}

function composeBase(cuts, names, { layout, frame, filter }) {
  const S = 2; const gap = 8; const pad = 16; const caption = 70;
  const cw = W * S; const ch = H * S;
  const cols = layout === 'grid' ? 2 : 1; const rows = SHOTS / cols;
  const c = document.createElement('canvas');
  c.width = pad * 2 + cw * cols + gap * (cols - 1);
  c.height = pad + ch * rows + gap * (rows - 1) + caption;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const F = FRAMES[frame];
  if (F.bg === 'rainbow') {
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    ['#ff8fab', '#ffc46b', '#ffe66b', '#8ee08a', '#6bc6ff', '#a98bff'].forEach((col, i, arr) => g.addColorStop(i / (arr.length - 1), col));
    ctx.fillStyle = g;
  } else ctx.fillStyle = F.bg;
  ctx.fillRect(0, 0, c.width, c.height);
  if (F.pattern) {
    ctx.fillStyle = F.pc;
    for (let y = 6; y < c.height; y += 14) {
      for (let x = (y / 14) % 2 ? 4 : 11; x < c.width; x += 14) {
        if (F.pattern === 'heart') { ctx.fillRect(x, y, 2, 2); ctx.fillRect(x + 4, y, 2, 2); ctx.fillRect(x, y + 2, 6, 2); ctx.fillRect(x + 2, y + 4, 2, 2); }
        else if (F.pattern === 'star') { ctx.fillRect(x + 2, y, 2, 6); ctx.fillRect(x, y + 2, 6, 2); }
        else { ctx.fillRect(x, y + 2, 8, 3); ctx.fillRect(x + 2, y, 4, 2); }
      }
    }
  }
  cuts.forEach((cut, i) => {
    const x = pad + (i % cols) * (cw + gap); const y = pad + Math.floor(i / cols) * (ch + gap);
    ctx.fillStyle = F.edge; ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4);
    ctx.drawImage(filtered(cut, filter), x, y, cw, ch);
  });
  const cy = pad + ch * rows + gap * (rows - 1);
  const d = new Date();
  ctx.textAlign = 'center';
  ctx.fillStyle = F.text;
  ctx.font = 'bold 26px Galmuri11, sans-serif';
  ctx.fillText('멍뭉네컷', c.width / 2, cy + 32);
  ctx.fillStyle = F.sub;
  ctx.font = `${layout === 'grid' ? 15 : 13}px Galmuri11, sans-serif`;
  const who = names.join(' & ');
  ctx.fillText(`${who.length > 22 ? `${who.slice(0, 21)}…` : who} · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, c.width / 2, cy + 56);
  return c;
}

function decorate(cuts, names) {
  return new Promise((resolve) => {
    const opt = { layout: 'strip', frame: 'white', filter: 'none' };
    let tool = 'pen'; let color = PENS[2]; let size = 6; let stamp = 'heart';
    let ops = []; let cur = null;
    const baseC = el('canvas', { class: 'pb-deco-base' });
    const drawC = el('canvas', { class: 'pb-deco-draw' });
    const box = el('div', { class: 'pb-deco-box' }, baseC, drawC);
    const panel = el('div', { class: 'pb-deco-panel' });
    let tab = 'frame';
    const tabs = el('div', { class: 'segmented' });
    const main = el('div', { class: 'pb-deco-main' }, box, el('div', { class: 'pb-deco-side' }, tabs, panel));

    const renderBase = () => {
      const c = composeBase(cuts, names, opt);
      const sizeChanged = baseC.width !== c.width || baseC.height !== c.height;
      baseC.width = c.width; baseC.height = c.height;
      baseC.getContext('2d').drawImage(c, 0, 0);
      if (sizeChanged) { drawC.width = c.width; drawC.height = c.height; }
      box.classList.toggle('grid', opt.layout === 'grid');
      main.classList.toggle('grid', opt.layout === 'grid');
      renderDraw();
    };
    const renderDraw = () => {
      const x = drawC.getContext('2d');
      x.clearRect(0, 0, drawC.width, drawC.height);
      x.imageSmoothingEnabled = false;
      for (const o of ops) {
        if (o.type === 'stamp') {
          const ic = iconCanvas(o.id, 1);
          x.drawImage(ic, Math.round(o.x - (ic.width * o.s) / 2), Math.round(o.y - (ic.height * o.s) / 2), ic.width * o.s, ic.height * o.s);
          continue;
        }
        x.globalAlpha = o.type === 'marker' ? 0.45 : 1;
        x.strokeStyle = o.color; x.lineWidth = o.size; x.lineCap = 'round'; x.lineJoin = 'round';
        x.beginPath();
        o.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
        if (o.pts.length === 1) x.lineTo(o.pts[0][0] + 0.1, o.pts[0][1]);
        x.stroke();
        x.globalAlpha = 1;
      }
    };
    const toCanvas = (e) => {
      const r = drawC.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * drawC.width, ((e.clientY - r.top) / r.height) * drawC.height];
    };
    drawC.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = toCanvas(e);
      if (tool === 'stamp') { ops.push({ type: 'stamp', id: stamp, x: p[0], y: p[1], s: 4 }); sfx.pop(); renderDraw(); return; }
      drawC.setPointerCapture(e.pointerId);
      cur = { type: tool, color, size: tool === 'marker' ? size * 3 : size, pts: [p] };
      ops.push(cur);
      renderDraw();
    });
    drawC.addEventListener('pointermove', (e) => { if (!cur) return; cur.pts.push(toCanvas(e)); renderDraw(); });
    const endStroke = () => { cur = null; };
    drawC.addEventListener('pointerup', endStroke);
    drawC.addEventListener('pointercancel', endStroke);

    const pick = (items, get, set, label = (k, v) => v.name) => el('div', { class: 'pb-opts' }, Object.entries(items).map(([k, v]) => el('button', {
      type: 'button', class: `btn small ${get() === k ? 'primary' : ''}`, onclick: () => { set(k); sfx.tap(); renderPanel(); },
    }, label(k, v))));
    const renderPanel = () => {
      tabs.replaceChildren(...[['frame', '🖼️ 프레임'], ['pen', '✏️ 펜·스탬프']].map(([k, l]) => el('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; renderPanel(); } }, l)));
      if (tab === 'frame') {
        panel.replaceChildren(
          el('div', { class: 'section-title' }, '모양'),
          pick({ strip: { name: '세로 네컷' }, grid: { name: '2×2' } }, () => opt.layout, (k) => {
            if (opt.layout !== k && ops.length) { ops = []; toast('모양을 바꿔서 그림이 지워졌어요.'); }
            opt.layout = k; renderBase();
          }),
          el('div', { class: 'section-title' }, '프레임'),
          el('div', { class: 'pb-swatches' }, Object.entries(FRAMES).map(([k, f]) => el('button', {
            type: 'button', class: `pb-swatch ${opt.frame === k ? 'on' : ''}`, 'aria-label': f.name, title: f.name,
            style: { background: f.bg === 'rainbow' ? 'linear-gradient(135deg,#ff8fab,#ffe66b,#8ee08a,#6bc6ff,#a98bff)' : f.bg },
            onclick: () => { opt.frame = k; sfx.tap(); renderBase(); renderPanel(); },
          }, el('small', {}, f.name)))),
          el('div', { class: 'section-title' }, '필터'),
          pick(FILTERS, () => opt.filter, (k) => { opt.filter = k; renderBase(); }));
      } else {
        panel.replaceChildren(
          pick({ pen: { name: '✏️ 펜' }, marker: { name: '🖍️ 형광펜' }, stamp: { name: '💖 스탬프' } }, () => tool, (k) => { tool = k; }),
          tool === 'stamp'
            ? el('div', { class: 'pb-stamps' }, STAMPS.map((id) => el('button', {
              type: 'button', class: `pb-item ${stamp === id ? 'on' : ''}`, 'aria-label': id, onclick: () => { stamp = id; sfx.tap(); renderPanel(); },
            }, el('img', { class: 'pixel', src: iconURL(id, 3), alt: '' }))))
            : el('div', {},
              el('div', { class: 'pb-swatches pens' }, PENS.map((c) => el('button', {
                type: 'button', class: `pb-pen ${color === c ? 'on' : ''}`, style: { background: c }, 'aria-label': c, onclick: () => { color = c; sfx.tap(); renderPanel(); },
              }))),
              pick({ 3: { name: '가늘게' }, 6: { name: '보통' }, 11: { name: '굵게' } }, () => String(size), (k) => { size = Number(k); })),
          el('p', { class: 'hint' }, tool === 'stamp' ? '사진 위를 톡 누르면 스탬프가 콩!' : '사진 위에 손가락으로 그려요.'),
          el('div', { class: 'pb-tools' },
            el('button', { class: 'btn small', type: 'button', disabled: !ops.length, onclick: () => { ops.pop(); renderDraw(); renderPanel(); } }, '↩ 되돌리기'),
            el('button', { class: 'btn small', type: 'button', disabled: !ops.length, onclick: () => { ops = []; renderDraw(); renderPanel(); } }, '다 지우기')));
      }
    };
    drawC.addEventListener('pointerup', () => { if (tab === 'pen') renderPanel(); });

    const wrap = el('div', { class: 'modal-wrap pb-wrap' },
      el('div', { class: 'modal-card pb-card pb-deco' },
        el('h2', { class: 'modal-title' }, '✨ 사진 꾸미기'),
        main,
        el('div', { class: 'modal-buttons' },
          el('button', { class: 'btn ghost', type: 'button', onclick: () => close('again') }, '다시 찍기'),
          el('button', { class: 'btn primary', type: 'button', onclick: () => finish() }, '완성!'))));
    document.getElementById('modal-root').append(wrap);
    renderBase(); renderPanel();

    const close = (v) => { wrap.remove(); resolve(v); };
    const finish = async () => {
      const out = document.createElement('canvas'); out.width = baseC.width; out.height = baseC.height;
      const x = out.getContext('2d'); x.drawImage(baseC, 0, 0); x.drawImage(drawC, 0, 0);
      wrap.remove();
      resolve(await showPolaroid(out.toDataURL('image/png'), names));
    };
  });
}

// ---------- 완성 사진 ----------
function showPolaroid(url, names) {
  return new Promise((resolve) => {
    sfx.levelUp();
    let saved = false;
    const saveBtn = el('button', { class: 'btn primary', type: 'button' }, '앨범에 저장');
    const wrap = el('div', { class: 'modal-wrap' },
      el('div', { class: 'modal-card polaroid-card' },
        el('h2', { class: 'modal-title' }, '사진이 나왔어요!'),
        el('div', { class: 'polaroid' }, el('img', { src: url, alt: '멍뭉네컷 사진' })),
        el('div', { class: 'modal-buttons' },
          saveBtn,
          el('button', { class: 'btn secondary', type: 'button', onclick: () => downloadPhoto(url) }, '사진 파일로 받기')),
        el('div', { class: 'modal-buttons' },
          el('button', { class: 'btn', type: 'button', onclick: () => close('again') }, '다시 찍기'),
          el('button', { class: 'btn', type: 'button', onclick: () => close('done') }, '닫기'))));
    saveBtn.addEventListener('click', () => {
      if (saved) return;
      saved = addToAlbum({ id: Date.now().toString(36), date: Date.now(), names, url });
      if (saved) { saveBtn.textContent = '저장했어요!'; saveBtn.disabled = true; sfx.coin(); toast('앨범에 저장했어요! 놀이 탭 앨범에서 볼 수 있어요.', 'good'); }
      else toast('저장 공간이 부족해요. 앨범에서 옛날 사진을 지워 주세요.', 'bad');
    });
    const close = (v) => { wrap.remove(); resolve(v); };
    document.getElementById('modal-root').append(wrap);
  });
}
