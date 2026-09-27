// 🗺️ 멍뭉 마을 · 🌳 마당 땅 파기 · 🔍 취향 수첩 화면
import { PLACES, YARD, TREATS, TASTES, ROOM_SETS, ITEMS } from '../shared/data.js';
import { Scene, SCENE_W, SCENE_H } from './scene.js';
import { accessoryURL, iconURL } from './sprites.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';

const OUT = '#4a3330';

// 다음에 열 수 있는 곳 (💗 합계 기준)
export function nextPlace(v) {
  return Object.entries(PLACES).find(([id]) => !v.places.includes(id)) ?? null;
}

// 우리집 화면의 마을 카드: 다음 장소까지 진행 바 + 열린 곳 바로 가기
export function villageCard(me, { onMap, onPlace }) {
  const v = me.village ?? { places: [] };
  const total = me.asks?.heartsTotal ?? 0;
  const next = nextPlace(v);
  const ready = next && total >= next[1].hearts;
  return el('div', { class: `village-card ${ready ? 'ready' : ''}` },
    el('div', { class: 'village-head' },
      el('b', {}, '🗺️ 멍뭉 마을'),
      el('button', { class: 'btn small', onclick: onMap }, '지도 보기')),
    next
      ? el('div', { class: 'village-next' },
        el('span', {}, ready ? `${next[1].emoji} ${next[1].name}을(를) 열 수 있어요!` : `다음 장소: ${next[1].emoji} ${next[1].name}`),
        el('span', { class: 'bar' }, el('i', { style: { width: `${Math.min(100, (total / next[1].hearts) * 100)}%` } })),
        el('small', {}, ready ? '' : `💗 ${total} / ${next[1].hearts}`))
      : el('div', { class: 'village-next' }, '🎉 마을의 모든 곳을 열었어요!'),
    v.places.length ? el('div', { class: 'village-places' }, v.places.map((id) => {
      const busy = id === 'cafe' && me.cafe?.open;
      const ready = busy && Date.now() >= me.cafe.open.endsAt;
      return el('button', {
        class: `btn small place-btn ${ready ? 'primary' : ''}`, onclick: () => onPlace(id),
      }, `${PLACES[id].emoji} ${PLACES[id].name}${ready ? ' · 정산!' : busy ? ' · 영업 중' : ''}`);
    })) : el('p', { class: 'hint' }, '💭 강아지의 소원을 들어주면 💗가 모여요. 💗가 모이면 새로운 곳이 열려요!'));
}

// 마을 지도
export function openVillageMap(me, { onOpen, onPlace }) {
  const v = me.village ?? { places: [] };
  const total = me.asks?.heartsTotal ?? 0;
  const { close } = modal({
    title: '🗺️ 멍뭉 마을 지도',
    className: 'village-map',
    body: el('div', {},
      el('p', { class: 'sub center' }, `지금까지 모은 💗 ${total}개`),
      el('div', { class: 'place-list' }, Object.entries(PLACES).map(([id, P]) => {
        const open = v.places.includes(id);
        const can = !open && total >= P.hearts;
        return el('div', { class: `place-card ${open ? 'open' : can ? 'can' : 'locked'}` },
          el('span', { class: 'place-emoji' }, open || can ? P.emoji : '🔒'),
          el('div', { class: 'place-info' }, el('b', {}, P.name), el('small', {}, P.desc),
            open ? null : el('small', { class: 'cost' }, `💗 ${Math.min(total, P.hearts)} / ${P.hearts}`)),
          open ? el('button', { class: 'btn small green', onclick: () => { close(); onPlace(id); } }, '가기')
            : el('button', { class: 'btn small primary', disabled: !can, onclick: () => { close(); onOpen(id); } }, '열기!'));
      }))),
    buttons: [{ label: '닫기' }],
  });
}

// 새 장소가 열렸을 때
export function placeOpenBody(ev) {
  const P = PLACES[ev.id];
  return el('div', { class: 'center' },
    el('div', { class: 'place-big' }, P.emoji),
    el('h3', {}, `${P.name}이(가) 열렸어요!`),
    el('p', {}, P.desc));
}

// ---------- 🌳 마당 ----------
function yardBg() {
  const c = document.createElement('canvas');
  c.width = SCENE_W; c.height = SCENE_H;
  const ctx = c.getContext('2d');
  const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  ['#9fd8ff', '#b0e0ff', '#c2e8ff', '#d4f0ff'].forEach((col, i) => r(0, i * 12, SCENE_W, 12, col));
  r(0, 48, SCENE_W, 8, '#d4f0ff');
  // 구름·해
  r(150, 8, 14, 14, '#ffe066'); r(152, 6, 10, 18, '#ffe066'); r(148, 10, 18, 10, '#ffe066');
  for (const [x, y] of [[20, 14], [70, 8]]) { r(x, y, 22, 5, '#fff'); r(x + 5, y - 3, 12, 4, '#fff'); }
  // 먼 나무
  for (const x of [8, 40, 150, 176]) { r(x - 1, 34, 3, 18, '#7a4b2a'); r(x - 8, 22, 17, 14, '#3f8f3a'); r(x - 6, 20, 13, 3, '#4f9e44'); }
  // 울타리
  for (let x = 2; x < SCENE_W; x += 12) { r(x, 46, 6, 16, '#fff6e6'); r(x, 46, 6, 1, OUT); r(x + 1, 44, 4, 2, '#fff6e6'); }
  r(0, 50, SCENE_W, 2, '#e8d8c0'); r(0, 57, SCENE_W, 2, '#e8d8c0');
  // 잔디
  r(0, 62, SCENE_W, SCENE_H - 62, '#7cc86a');
  for (let i = 0; i < 90; i++) r((i * 37) % SCENE_W, 64 + ((i * 23) % (SCENE_H - 66)), 2, 2, i % 3 ? '#6ab85a' : '#9ad884');
  // 꽃
  for (let i = 0; i < 14; i++) { const x = (i * 53) % SCENE_W; const y = 68 + ((i * 31) % 60); r(x, y, 3, 3, ['#ff9fb8', '#ffe066', '#ffffff'][i % 3]); r(x + 1, y + 1, 1, 1, '#ff6f91'); }
  // 강아지 집
  r(8, 60, 30, 26, OUT); r(10, 64, 26, 22, '#e85d75'); r(6, 58, 34, 6, OUT); r(8, 56, 30, 4, '#b8283c');
  r(17, 72, 12, 14, '#4a2a28'); r(12, 66, 22, 2, '#ff8f9f');
  return c;
}

export function openYard(dog, { digsLeft, dig }) {
  const canvas = el('canvas', { class: 'pixel' });
  const overlay = el('div', { class: 'overlay' });
  const spotsBox = el('div', { class: 'yard-spots' });
  const info = el('p', { class: 'center yard-info' }, `오늘 ${digsLeft}번 더 팔 수 있어요. 흙더미를 눌러 봐요!`);
  const found = el('div', { class: 'yard-found' });
  const stage = el('div', { class: 'stage yard-stage' }, canvas, overlay, spotsBox);
  const { close } = modal({ title: '🌳 마당', className: 'yard-modal', dismissable: false, body: el('div', {}, stage, info, found), buttons: [{ label: '집으로', onClick: () => { scene.destroy(); } }] });
  const scene = new Scene(canvas, overlay, {});
  scene.bg = yardBg();
  scene.showBowl = false;
  scene.upsert('me', { dog, nickname: dog.name, x: 0.5, y: 0.45, auto: true, mine: true });
  let left = digsLeft; let busy = false;
  const spots = [[22, 72, 0.25, 0.62], [52, 86, 0.52, 0.9], [80, 70, 0.8, 0.58]];
  spots.forEach(([px, py, nx, ny], i) => {
    const b = el('button', { class: 'yard-spot', type: 'button', 'aria-label': `흙더미 ${i + 1}` });
    b.style.left = `${px}%`; b.style.top = `${py}%`;
    b.addEventListener('click', async () => {
      if (busy) return;
      if (left <= 0) { toast('오늘은 충분히 팠어요! 내일 또 파 봐요.'); return; }
      busy = true;
      const e = scene.entities.get('me'); if (e) e.auto = false;
      scene.moveTo('me', nx, ny);
      sfx.tap();
      setTimeout(async () => {
        scene.care('me', 'brush');
        scene.effectAt('me', 'sparkle', 3);
        sfx.whoosh();
        const res = await dig();
        busy = false;
        if (!res) return;
        left = res.found.left;
        b.classList.add('dug');
        info.textContent = left > 0 ? `오늘 ${left}번 더 팔 수 있어요.` : '오늘은 다 팠어요! 내일 또 와요.';
        const f = res.found;
        const img = f.item ? accessoryURL(f.item, 4) : f.kind === 'coins' ? iconURL('coin', 4) : f.kind === 'hearts' ? iconURL('heart', 4) : iconURL('food', 4);
        const label = f.item ? ITEMS[f.item].name : f.treat ? TREATS[f.treat].name : f.kind === 'coins' ? `뼈다귀 코인 ${f.coins}개` : `💗 ${f.hearts}`;
        found.replaceChildren(el('div', { class: 'found-card' }, el('img', { class: 'pixel', src: img, alt: '' }), el('b', {}, `${f.text}!`), el('span', {}, label)));
        scene.bubble('me', 'text', '찾았다!');
        sfx.star();
        if (e) setTimeout(() => { e.auto = true; }, 1500);
      }, 900);
    });
    spotsBox.append(b);
  });
  return close;
}

// ---------- 🔍 취향 수첩 ----------
export function openTasteBook(dog, v, room, owned = []) {
  const tastes = dog.tastes ?? {};
  const found = Object.keys(tastes).length;
  modal({
    title: `🔍 ${dog.name}의 취향 수첩`,
    className: 'taste-book',
    body: el('div', {},
      el('div', { class: 'section-title' }, `간식 반응 (${found}/${Object.keys(TREATS).length} 알아냄)`),
      el('div', { class: 'taste-grid' }, Object.entries(TREATS).map(([id, t]) => {
        const r = tastes[id];
        return el('div', { class: `taste-cell ${r === 3 ? 'love' : ''}` },
          el('span', { class: 'face' }, r === undefined ? '❔' : TASTES.faces[r]),
          el('b', {}, t.name),
          el('small', {}, r === undefined ? '아직 몰라요' : TASTES.names[r]));
      })),
      el('p', { class: 'hint' }, '간식을 줘 봐야 알 수 있어요. 😍 최애 간식을 찾으면 애정이 더 오르고, 하루 2번 💗도 받아요!'),
      el('div', { class: 'section-title' }, `가구 세트 (${v.sets?.length ?? 0}/${Object.keys(ROOM_SETS).length} 완성)`),
      el('div', { class: 'set-list' }, Object.entries(ROOM_SETS).map(([id, S]) => {
        const done = v.sets?.includes(id);
        return el('div', { class: `set-row ${done ? 'done' : ''}` },
          el('b', {}, done ? `✅ ${S.name}` : '❔ ??? 세트'),
          el('div', { class: 'set-items' }, S.items.map((it) => el('span', { class: `set-item ${owned.includes(it) ? 'have' : ''} ${Object.values(room ?? {}).includes(it) ? 'placed' : ''}` }, done || owned.includes(it) ? ITEMS[it].name : '???'))));
      })),
      el('p', { class: 'hint' }, '벽지·러그·침대·장난감을 한 테마로 맞추면 세트 완성! 가지고 있는 가구는 이름이 보여요.')),
    buttons: [{ label: '닫기' }],
  });
}

// 간식 반응 알림
export function tasteToast(ev) {
  const face = TASTES.faces[ev.rating];
  if (ev.rating === 3 && ev.first) return `💖 최애 간식 발견! ${ev.dogName}(은)는 ${TREATS[ev.treat].name}를 제일 좋아해요!`;
  if (ev.first) return `🔍 새로 알았어요! ${TREATS[ev.treat].name} → ${face} ${TASTES.names[ev.rating]}`;
  return null;
}

export function setDoneBody(ev) {
  return el('div', { class: 'center' },
    el('div', { class: 'place-big' }, '🛋️'),
    el('h3', {}, `${ev.name} 완성!`),
    el('p', {}, `가구를 한 테마로 맞췄어요! 💗+${ev.hearts} · 코인 +${ev.coins}`));
}

