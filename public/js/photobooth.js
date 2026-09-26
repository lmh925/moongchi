// 미니게임: 멍뭉 네컷 포토부스
// 내 강아지와 친구 강아지를 나란히 세우고, 소품을 끌어다 씌운 뒤 '찰칵'! 네 컷을 찍으면 폴라로이드 사진이 완성돼요.
import { dogSprite, propCanvas, propFit, iconURL, DOG_W } from './sprites.js';
import { el, toast } from './ui.js';
import { sfx, playBgm } from './audio.js';

const W = 112;
const H = 84;
const FEET = 76;
const FLOOR = 70;
const DOG_X = [35, 77];
const SHOTS = 4;
const TIME_LIMIT = 90;
const ALBUM_KEY = 'meongmung.album';
const ALBUM_MAX = 12;

// 소품 목록: 액세서리 그림 + 스티커 아이콘
const PROPS = [
  'kinder_hat', 'ribbon', 'round_glasses', 'heart_glasses', 'sunglasses', 'star_glasses', 'crown', 'flower',
  'bunny_ears', 'cat_ears', 'santa', 'wizard', 'bowtie', 'bandana', 'medal', 'heart', 'sparkle', 'star', 'note',
];

const FACES = [
  { eyes: 'happy', mouth: 'tongue' },
  { eyes: 'open', mouth: 'closed' },
  { eyes: 'happy', mouth: 'open' },
  { eyes: 'closed', mouth: 'tongue' },
  { eyes: 'open', mouth: 'tongue' },
];

const BACKDROPS = {
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
    ['#a9dcff', '#b8e3ff', '#c8eaff', '#d8f1ff'].forEach((c, i) => fill(ctx, 0, i * 20, W, 20, c));
    for (const [x, y] of [[16, 12], [70, 8], [98, 26], [40, 36]]) { blob(ctx, x, y, 10, 3, '#fff'); blob(ctx, x + 4, y - 3, 6, 3, '#fff'); }
    floor(ctx, '#8fd18a', '#6cc070');
  } },
};

function fill(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function heart(ctx, x, y, c) { fill(ctx, x, y, 1, 1, c); fill(ctx, x + 2, y, 1, 1, c); fill(ctx, x, y + 1, 3, 1, c); fill(ctx, x + 1, y + 2, 1, 1, c); }
function star(ctx, x, y, c) { fill(ctx, x + 1, y, 1, 3, c); fill(ctx, x, y + 1, 3, 1, c); }
function blob(ctx, cx, cy, rx, ry, c) {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++) { const h = rx * Math.sqrt(1 - (y / (ry + 0.5)) ** 2); ctx.fillRect(Math.round(cx - h), cy + y, Math.round(h * 2), 1); }
}
function floor(ctx, a, b) { fill(ctx, 0, FLOOR, W, H - FLOOR, a); for (let x = 0; x < W; x += 8) fill(ctx, x, FLOOR, 4, H - FLOOR, b); fill(ctx, 0, FLOOR, W, 1, '#ffffff'); }

function spriteOf(dog, face, tail) {
  return dogSprite(dog.breed, dog.stage, 'front', { ...face, tail, fluff: 1 });
}

// 강아지 i의 소품 자리(head/neck/eye)의 무대 좌표
function anchorPos(dog, i, face, anchor) {
  const spr = spriteOf(dog, face, 0);
  const a = spr.anchors[anchor];
  return { x: DOG_X[i] - DOG_W / 2 + a.x, y: FEET - 41 + a.y };
}

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

// ---------- 게임 ----------
// dogs: [내 강아지, 친구 강아지] (publicDog 형태), names: [이름, 이름]
export function playPhotobooth(dogs, names) {
  return new Promise((resolve) => {
    const stageCanvas = el('canvas', { width: W, height: H, class: 'pixel pb-canvas' });
    const propLayer = el('div', { class: 'pb-props' });
    const flash = el('div', { class: 'pb-flash' });
    const stage = el('div', { class: 'pb-stage' }, stageCanvas, propLayer, flash);
    const cutSlots = el('div', { class: 'pb-cuts' }, Array.from({ length: SHOTS }, (_, i) => el('div', { class: 'pb-cut' }, `${i + 1}`)));
    const timerEl = el('span', { class: 'pb-timer' }, `${TIME_LIMIT}초`);
    const tray = el('div', { class: 'pb-tray', 'aria-label': '소품 상자' });
    const shootBtn = el('button', { class: 'btn primary big pb-shoot', type: 'button' }, el('img', { class: 'pixel', src: iconURL('camera', 3), alt: '' }), '찰칵!');
    const faceBtn = el('button', { class: 'btn small secondary', type: 'button' }, '표정 바꾸기');
    const bgBtn = el('button', { class: 'btn small', type: 'button' }, '배경 바꾸기');
    const clearBtn = el('button', { class: 'btn small', type: 'button' }, '소품 모두 빼기');
    const root = el('div', { class: 'modal-wrap pb-wrap' },
      el('div', { class: 'modal-card pb-card' },
        el('div', { class: 'pb-head' }, el('h2', { class: 'modal-title' }, '멍뭉 네컷 포토부스'), timerEl),
        cutSlots,
        stage,
        el('div', { class: 'pb-tools' }, faceBtn, bgBtn, clearBtn),
        el('p', { class: 'hint center' }, '소품을 위로 끌어다 강아지에게 올려 주세요! 밖으로 끌어내면 빠져요.'),
        tray,
        el('div', { class: 'modal-buttons' },
          el('button', { class: 'btn ghost', type: 'button', onclick: () => finish(null) }, '그만하기'),
          shootBtn)));
    document.getElementById('modal-root').append(root);
    playBgm('home');

    const ctx = stageCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const bgKeys = Object.keys(BACKDROPS);
    let bg = 'pink';
    let faces = [0, 0];
    let props = [];
    let uid = 0;
    const cuts = [];
    let left = TIME_LIMIT;
    let done = false;
    let t = 0;

    // ---------- 무대 그리기 ----------
    const drawStage = (target, withProps = false) => {
      target.imageSmoothingEnabled = false;
      BACKDROPS[bg].draw(target);
      dogs.forEach((dog, i) => {
        const spr = spriteOf(dog, FACES[faces[i]], Math.floor(t / 6) % 2);
        target.fillStyle = 'rgba(74,51,48,0.2)';
        target.fillRect(DOG_X[i] - 12, FEET, 24, 2);
        target.drawImage(spr.canvas, DOG_X[i] - DOG_W / 2, FEET - 41);
      });
      if (withProps) {
        for (const p of props) {
          const c = propCanvas(p.id);
          target.drawImage(c, Math.round(p.x), Math.round(p.y), Math.round(c.width * p.scale), Math.round(c.height * p.scale));
        }
      }
    };
    const loop = () => {
      if (done) return;
      t += 1;
      drawStage(ctx);
      setTimeout(() => requestAnimationFrame(loop), 70);
    };
    loop();

    // ---------- 소품 DOM ----------
    const place = (p) => {
      const c = propCanvas(p.id);
      Object.assign(p.el.style, {
        left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`,
        width: `${((c.width * p.scale) / W) * 100}%`, height: `${((c.height * p.scale) / H) * 100}%`,
      });
      p.el.classList.toggle('snapped', !!p.attach);
    };

    const removeProp = (p) => {
      props = props.filter((x) => x !== p);
      p.el.classList.add('poof');
      setTimeout(() => p.el.remove(), 200);
    };

    // 강아지 머리/눈/목 근처에 떨어뜨리면 딱 맞게 씌워 줘요
    const trySnap = (p) => {
      const fit = propFit(p.id);
      p.attach = null;
      if (!fit.anchor) return;
      const c = propCanvas(p.id);
      const cx = p.x + (c.width * p.scale) / 2; const cy = p.y + (c.height * p.scale) / 2;
      let best = null;
      dogs.forEach((dog, i) => {
        const a = anchorPos(dog, i, FACES[faces[i]], fit.anchor);
        const tx = a.x + fit.dx; const ty = a.y + fit.dy;
        const d = Math.hypot(cx - (tx + c.width / 2), cy - (ty + c.height / 2));
        if (d < 20 && (!best || d < best.d)) best = { d, i, tx, ty };
      });
      if (!best) return;
      for (const other of props.filter((o) => o !== p && o.attach && o.attach.dog === best.i && o.attach.anchor === fit.anchor)) removeProp(other);
      p.x = best.tx; p.y = best.ty; p.scale = 1;
      p.attach = { dog: best.i, anchor: fit.anchor };
      sfx.pop();
    };

    // 표정을 바꾸면 씌운 소품도 따라가요
    const refit = () => {
      for (const p of props) {
        if (!p.attach) continue;
        const fit = propFit(p.id);
        const a = anchorPos(dogs[p.attach.dog], p.attach.dog, FACES[faces[p.attach.dog]], p.attach.anchor);
        p.x = a.x + fit.dx; p.y = a.y + fit.dy;
        place(p);
      }
    };

    const toStage = (clientX, clientY) => {
      const r = stage.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H, inside: clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom };
    };

    const addProp = (id, clientX, clientY) => {
      const c = propCanvas(id);
      const pos = toStage(clientX, clientY);
      const p = { uid: uid++, id, scale: 1.5, x: 0, y: 0, attach: null };
      p.x = pos.x - (c.width * p.scale) / 2; p.y = pos.y - (c.height * p.scale) / 2;
      p.el = el('img', { class: 'pixel pb-prop', src: propCanvas(id, 4).toDataURL(), alt: '', draggable: 'false' });
      props.push(p);
      trySnap(p);
      propLayer.append(p.el);
      place(p);
      bindPlaced(p);
    };

    // 무대 위 소품: 끌어서 옮기기, 톡 누르면 크기 바꾸기, 밖으로 끌어내면 빼기
    const bindPlaced = (p) => {
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
          p.attach = null;
          place(p);
        };
        const up = (ev) => {
          p.el.releasePointerCapture?.(ev.pointerId);
          p.el.removeEventListener('pointermove', move);
          p.el.removeEventListener('pointerup', up);
          p.el.removeEventListener('pointercancel', up);
          p.el.classList.remove('dragging');
          const pos = toStage(ev.clientX, ev.clientY);
          if (!pos.inside) { removeProp(p); sfx.whoosh(); return; }
          if (!moved && !p.attach) {
            p.scale = p.scale >= 2 ? 1 : p.scale + 0.5;
            sfx.tap();
          } else trySnap(p);
          place(p);
        };
        p.el.addEventListener('pointermove', move);
        p.el.addEventListener('pointerup', up);
        p.el.addEventListener('pointercancel', up);
      });
    };

    // 소품 상자: 가로로 밀면 스크롤, 위로 끌면 소품을 집어요
    for (const id of PROPS) {
      const item = el('button', { class: 'pb-item', type: 'button', 'aria-label': id },
        el('img', { class: 'pixel', src: propCanvas(id, 4).toDataURL(), alt: '', draggable: 'false' }));
      tray.append(item);
      item.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') e.preventDefault(); // 마우스로 끌 때 글자가 선택되지 않게
        const sx = e.clientX; const sy = e.clientY;
        let ghost = null;
        const move = (ev) => {
          const dx = ev.clientX - sx; const dy = ev.clientY - sy;
          if (!ghost) {
            // 마우스는 바로, 손가락은 위로 끌 때만 집어요 (옆으로 밀면 스크롤)
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
          if (ghost) {
            ghost.remove();
            if (toStage(ev.clientX, ev.clientY).inside) addProp(id, ev.clientX, ev.clientY);
          } else if (ev.type === 'pointerup' && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) {
            // 그냥 톡 누르면 무대 가운데 위쪽에 놓아 줘요
            const r = stage.getBoundingClientRect();
            addProp(id, r.left + r.width * (0.3 + Math.random() * 0.4), r.top + r.height * 0.3);
          }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    }

    faceBtn.addEventListener('click', () => { faces = faces.map((f) => (f + 1) % FACES.length); refit(); sfx.bark(1.2); });
    bgBtn.addEventListener('click', () => { bg = bgKeys[(bgKeys.indexOf(bg) + 1) % bgKeys.length]; sfx.pop(); });
    clearBtn.addEventListener('click', () => { [...props].forEach(removeProp); });

    // ---------- 찰칵 ----------
    const shoot = () => {
      if (done || cuts.length >= SHOTS) return;
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
    shootBtn.addEventListener('click', shoot);

    const timer = setInterval(() => {
      left -= 1;
      timerEl.textContent = `${left}초`;
      timerEl.classList.toggle('hurry', left <= 10);
      if (left <= 0) {
        clearInterval(timer);
        toast('시간이 다 됐어요! 남은 컷을 찍을게요.');
        while (cuts.length < SHOTS) shoot();
      }
    }, 1000);

    const finish = (result) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      root.remove();
      if (!result) { resolve(null); return; }
      resolve(showPolaroid(result, names));
    };
  });
}

// ---------- 폴라로이드 결과 ----------
function composePolaroid(cuts, names) {
  const S = 2; const gap = 8; const pad = 16; const caption = 70;
  const cw = W * S; const ch = H * S;
  const c = el('canvas', { width: pad * 2 + cw * 2 + gap, height: pad + ch * 2 + gap + caption });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fffaf5'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ffe3ec';
  for (let y = 4; y < c.height; y += 12) for (let x = (y / 12) % 2 ? 4 : 10; x < c.width; x += 12) ctx.fillRect(x, y, 2, 2);
  cuts.forEach((cut, i) => {
    const x = pad + (i % 2) * (cw + gap); const y = pad + Math.floor(i / 2) * (ch + gap);
    ctx.fillStyle = '#4a3330'; ctx.fillRect(x - 2, y - 2, cw + 4, ch + 4);
    ctx.drawImage(cut, x, y, cw, ch);
  });
  const cy = pad + ch * 2 + gap;
  const d = new Date();
  ctx.fillStyle = '#e8708f';
  ctx.font = 'bold 26px Galmuri11, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('멍뭉네컷', c.width / 2, cy + 32);
  ctx.fillStyle = '#7a5a50';
  ctx.font = '15px Galmuri11, sans-serif';
  ctx.fillText(`${names.join(' & ')} · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, c.width / 2, cy + 56);
  return c.toDataURL('image/png');
}

function showPolaroid(cuts, names) {
  return new Promise((resolve) => {
    const url = composePolaroid(cuts, names);
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
