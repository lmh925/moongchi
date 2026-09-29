// 매일 오고 싶은 이유 + 자랑거리 화면: 오늘의 약속·도장판, 우편함(강아지 편지), 배지 보드, 도감, 포토카드, 친구 코드 QR
import { BADGES, BREEDS, ITEMS, RARITY, SHOWCASE_MAX, SCHOOL_BOOSTS, SPECIALS } from '../shared/data.js';
import { breedOf } from '../shared/rules.js';
import { dogSprite, dogPortrait, iconURL, DOG_W, DOG_H } from './sprites.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';
import { radarCanvas } from './level.js';

// ---------- 오늘의 약속 + 도장판 ----------
export function questCard(progress) {
  const q = progress?.quest;
  if (!q) return null;
  const doneCount = q.list.filter((x) => x.done).length;
  return el('div', { class: `quest-card ${q.allDone ? 'all' : ''}` },
    el('div', { class: 'quest-head' },
      el('b', {}, '오늘의 약속'),
      el('span', { class: 'meta' }, q.allDone ? '다 지켰어요! 도장 쾅!' : `${doneCount}/3`)),
    el('ul', { class: 'quest-list' }, q.list.map((x) => el('li', { class: x.done ? 'done' : '' },
      el('span', { class: 'check' }, x.done ? '✔' : ''),
      el('span', { class: 'text' }, x.text),
      x.n > 1 && !x.done ? el('span', { class: 'meta' }, `${x.progress}/${x.n}`) : null))),
    stampRow(q.stamps, q.card, q.allDone));
}

function stampRow(stamps, card, todayDone) {
  return el('div', { class: 'stamp-row', title: `${card}칸을 채우면 특별 캡슐!` },
    Array.from({ length: card }, (_, i) => el('span', { class: `stamp ${i < stamps ? 'on' : ''} ${todayDone && i === stamps - 1 ? 'today' : ''} ${i === card - 1 ? 'goal' : ''}` },
      i < stamps ? el('img', { class: 'pixel', src: iconURL('paw', 2), alt: '도장' }) : i === card - 1 ? '🎁' : '')),
    el('span', { class: 'meta' }, '하루 빠져도 도장은 그대로!'));
}

export function stampBody(ev) {
  return el('div', { class: 'center' },
    el('div', { class: 'stamp-big' }, el('img', { class: 'pixel', src: iconURL('paw', 6), alt: '' })),
    stampRow(ev.stamps, ev.card, true),
    el('p', {}, ev.full ? `도장판을 다 채웠어요! 우편함에 특별 캡슐이 도착했어요.` : `오늘의 약속을 다 지켰어요! 도장 ${ev.stamps}/${ev.card}`));
}

// ---------- 배지 ----------
export function badgeIcon(id, { locked = false, size = 2 } = {}) {
  const b = BADGES[id];
  if (!b) return null;
  return el('span', { class: `badge-medal ${locked ? 'locked' : ''}`, style: { '--medal': b.color }, title: b.name },
    el('img', { class: 'pixel', src: iconURL(b.icon, size), alt: '' }));
}

export function badgeBody(ev) {
  return el('div', { class: 'center' },
    el('div', { class: 'badge-big' }, badgeIcon(ev.id, { size: 4 })),
    el('h3', {}, ev.name),
    el('p', { class: 'help' }, ev.desc),
    el('p', {}, `뼈다귀 코인 +${ev.coins}! 강아지 카드에 대표 배지로 달 수 있어요.`));
}

// 배지 보드: 대표 배지(최대 3개)를 눌러서 골라요
export function badgeBoard(progress, { onShowcase }) {
  let showcase = [...(progress.showcase ?? [])];
  const wrap = el('div', {});
  const render = () => {
    const got = progress.badges.length;
    wrap.replaceChildren(
      el('div', { class: 'section-title' }, `대표 배지 (${showcase.length}/${SHOWCASE_MAX})`),
      el('div', { class: 'showcase-row' }, Array.from({ length: SHOWCASE_MAX }, (_, i) => showcase[i]
        ? el('span', { class: 'showcase-slot' }, badgeIcon(showcase[i], { size: 3 }), el('small', {}, BADGES[showcase[i]].name))
        : el('span', { class: 'showcase-slot empty' }, '?'))),
      el('p', { class: 'hint' }, '얻은 배지를 누르면 대표 배지로 달거나 뗄 수 있어요. 친구가 강아지 카드에서 볼 수 있어요.'),
      el('div', { class: 'section-title' }, `배지 모음 ${got} / ${Object.keys(BADGES).length}`),
      el('div', { class: 'badge-grid' }, Object.entries(BADGES).map(([id, b]) => {
        const has = progress.badges.includes(id);
        const pr = progress.badgeProgress?.[id] ?? { have: 0, n: 1 };
        const on = showcase.includes(id);
        return el('button', {
          type: 'button', class: `badge-cell ${has ? '' : 'locked'} ${on ? 'on' : ''}`,
          onclick: async () => {
            if (!has) return toast(`${b.desc} (${pr.have}/${pr.n})`);
            const next = on ? showcase.filter((x) => x !== id) : [...showcase, id];
            if (next.length > SHOWCASE_MAX) return toast(`대표 배지는 ${SHOWCASE_MAX}개까지예요. 먼저 하나를 떼 주세요.`);
            const ok = await onShowcase(next);
            if (ok) { showcase = next; sfx.tap(); render(); }
          },
        },
        badgeIcon(id, { locked: !has }),
        el('b', {}, has ? b.name : '???'),
        el('small', {}, has ? b.desc : `${pr.have}/${pr.n}`),
        has ? null : el('span', { class: 'mini-bar' }, el('i', { style: { width: `${Math.round((pr.have / pr.n) * 100)}%` } })));
      })));
  };
  render();
  return wrap;
}

// ---------- 도감 ----------
export function dexPanel(user, progress, itemThumb) {
  const seen = new Set(progress.seenBreeds ?? []);
  const items = Object.entries(ITEMS).filter(([, i]) => i.gacha !== false || i.reward);
  const ownedN = items.filter(([id]) => user.owned.includes(id)).length;
  const normal = Object.entries(BREEDS).filter(([, b]) => !b.special);
  const specials = Object.entries(SPECIALS);
  return el('div', {},
    el('div', { class: 'section-title' }, `견종 도감 ${normal.filter(([id]) => seen.has(id)).length} / ${normal.length}`),
    el('p', { class: 'hint' }, '놀이터나 친구 집에서 만난 강아지의 견종이 올라가요.'),
    el('div', { class: 'dex-grid' }, normal.map(([id, b]) => el('div', { class: `dex-cell ${seen.has(id) ? '' : 'unknown'}` },
      el('img', { class: 'pixel', src: dogPortrait(id, 1), alt: '' }),
      el('b', {}, seen.has(id) ? b.name : '???')))),
    el('div', { class: 'section-title' }, `✨ 스페셜 도감 ${specials.filter(([, sp]) => seen.has(sp.breed)).length} / ${specials.length}`),
    el('p', { class: 'hint' }, '전설의 스페셜 강아지를 만나면 올라가요. 소문으로는 이름이… (초성 힌트)'),
    el('div', { class: 'dex-grid' }, specials.map(([, sp]) => el('div', { class: `dex-cell special ${seen.has(sp.breed) ? '' : 'unknown'}` },
      el('img', { class: 'pixel', src: dogPortrait(sp.breed, 1), alt: '' }),
      el('b', {}, seen.has(sp.breed) ? sp.name : sp.hint),
      el('small', {}, seen.has(sp.breed) ? sp.label : '???')))),
    el('div', { class: 'section-title' }, `아이템 도감 ${ownedN} / ${items.length}`),
    el('div', { class: 'dex-grid items' }, items.map(([id, it]) => {
      const has = user.owned.includes(id);
      return el('div', { class: `dex-cell r-${it.rarity} ${has ? '' : 'unknown'}` },
        el('img', { class: 'pixel', src: itemThumb(id), alt: '' }),
        el('b', {}, has ? it.name : '???'),
        el('small', { style: { color: RARITY[it.rarity]?.color } }, RARITY[it.rarity]?.name ?? ''));
    })));
}

// ---------- 우편함 ----------
const fmtDate = (t) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

export async function openMailbox({ api, post, onOpened, playCapsule, itemName, onBaby }) {
  const { mail } = await api('/mail');
  const list = el('div', { class: 'mail-list' });
  const renderList = () => list.replaceChildren(...(mail.length ? mail.map((m) => el('button', {
    type: 'button', class: `mail-item ${m.opened ? '' : 'new'} ${m.kind}`,
    onclick: () => openOne(m),
  },
  m.kind === 'bdayNotice' || m.kind === 'bdayCheer' ? el('span', { class: 'mail-emoji' }, m.kind === 'bdayNotice' ? '🎂' : '🎉')
    : el('img', { class: 'pixel', src: iconURL(m.kind === 'capsule' ? 'star' : m.kind === 'baby' ? 'heart' : 'mail', 3), alt: '' }),
  el('span', { class: 'mail-meta' }, el('b', {}, m.title), el('small', {}, `${m.from} · ${fmtDate(m.createdAt)}`)),
  !m.opened ? el('span', { class: 'chip' }, 'NEW') : (m.coins || m.item || m.hearts) ? el('span', { class: 'meta' }, '받음') : null))
    : [el('p', { class: 'help center' }, '아직 편지가 없어요. 강아지가 곧 편지를 쓸 거예요!')]));
  renderList();
  const box = modal({ title: '우편함', className: 'mailbox', body: list, buttons: [{ label: '닫기', kind: 'secondary' }] });

  async function openOne(m) {
    let res;
    try { res = await post(`/mail/${m.id}/open`); } catch (err) { toast(err.message, 'bad'); return; }
    m.opened = true;
    renderList();
    onOpened?.(res);
    if (m.kind === 'baby') { box.close(); onBaby?.(m); return; }
    if (m.kind === 'capsule' && res.result.capsule) {
      box.close();
      sfx.levelUp();
      await playCapsule(res.result.capsule);
      return;
    }
    sfx.pop();
    const gifts = [
      m.coins ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '' }), `코인 ${m.coins}`) : null,
      m.item ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('sparkle', 2), alt: '' }), itemName(m.item)) : null,
      m.boost && SCHOOL_BOOSTS[m.boost] ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL(SCHOOL_BOOSTS[m.boost].icon, 2), alt: '' }), SCHOOL_BOOSTS[m.boost].name) : null,
      m.hearts ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('heart', 2), alt: '' }), `💗 ${m.hearts}`) : null,
    ].filter(Boolean);
    if (res.result.first && gifts.length) setTimeout(() => sfx.coin(), 400);
    modal({
      title: m.title,
      className: 'letter-modal',
      body: el('div', { class: 'letter' },
        m.breed ? el('img', { class: 'pixel letter-dog', src: dogPortrait(m.breed, m.stage ?? 0, { equip: m.equip ?? {} }), alt: '' }) : m.kind === 'bdayNotice' ? el('div', { class: 'letter-emoji' }, '🎂🎈') : null,
        el('p', { class: 'letter-body' }, m.body),
        el('p', { class: 'letter-sign' }, `- ${m.from} 🐾 (${fmtDate(m.createdAt)})`),
        gifts.length ? el('div', { class: 'letter-gifts' }, el('small', {}, res.result.first ? '편지에 선물이 들어 있었어요!' : '받은 선물'), ...gifts) : null),
      buttons: [{ label: '고마워!' }],
    });
  }
}

// ---------- 친구 코드 QR ----------
export function qrModal(code, link, { onShare }) {
  modal({
    title: 'QR로 친구 초대',
    body: el('div', { class: 'center' },
      el('img', { class: 'qr-img', src: `/api/qr/${code}`, alt: `친구 코드 ${code} QR` }),
      el('p', { class: 'code' }, code),
      el('p', { class: 'help' }, '친구가 휴대폰 카메라로 찍으면 멍뭉고치가 열리고 바로 친구 신청을 할 수 있어요. 실제로 아는 친구에게만 보여 주세요!')),
    buttons: [{ label: '초대 링크 보내기', kind: 'secondary', onClick: () => { onShare(link); return false; } }, { label: '닫기' }],
  });
}

// ---------- 포토카드 ----------
const loadImg = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

function roundRect(ctx, x, y, w, h, r, fill, stroke, lw = 4) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

const FRAME_COLORS = ['#4a3330', '#3fb58a', '#5b8cff', '#b07cff', '#e0507f', '#d9a400'];

// 강아지 포토카드 (540×800). 학교에서 보여 주거나, QR로 친구를 초대할 수 있어요.
export async function makePhotoCard(dog, user, progress) {
  const W = 540; const H = 800;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  await document.fonts?.load('20px Galmuri11').catch(() => {});
  const font = (px, bold = false) => `${bold ? '700 ' : ''}${px}px Galmuri11, sans-serif`;
  const frame = FRAME_COLORS[dog.frame ?? 0];
  // 배경: 분홍 체크 + 테두리
  ctx.fillStyle = '#ffe9f0'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd9e5';
  for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40);
  roundRect(ctx, 18, 18, W - 36, H - 36, 26, '#fffaf0', frame, 8);
  // 강아지 사진 칸
  roundRect(ctx, 50, 50, W - 100, 330, 18, '#bfe6ff', '#4a3330', 5);
  ctx.save();
  ctx.beginPath(); ctx.rect(53, 53, W - 106, 324); ctx.clip();
  ctx.fillStyle = '#d8f1ff'; ctx.fillRect(53, 150, W - 106, 60);
  ctx.fillStyle = '#6cc070'; ctx.fillRect(53, 300, W - 106, 80);
  ctx.fillStyle = '#57a84b'; for (let x = 53; x < W - 53; x += 14) ctx.fillRect(x, 298, 6, 6);
  const spr = dogSprite(dog.breed, dog.stage, 'front', { eyes: 'happy', mouth: 'tongue', equip: dog.equip, fluff: 1 });
  const scale = 6;
  ctx.fillStyle = 'rgba(74,51,48,.2)'; ctx.fillRect(W / 2 - 80, 318, 160, 12);
  ctx.drawImage(spr.canvas, Math.round(W / 2 - (DOG_W * scale) / 2), 330 - DOG_H * scale + 12, DOG_W * scale, DOG_H * scale);
  ctx.restore();
  // Lv 뱃지
  roundRect(ctx, 66, 66, 118, 46, 12, '#ffffff', frame, 5);
  ctx.fillStyle = '#4a3330'; ctx.font = font(26, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`Lv ${dog.level}`, 125, 90);
  // 이름 + 칭호
  ctx.fillStyle = '#4a3330'; ctx.font = font(40, true);
  ctx.fillText(dog.name, W / 2, 420);
  if (dog.titleName) {
    ctx.font = font(20, true);
    const tw = ctx.measureText(dog.titleName).width + 32;
    roundRect(ctx, W / 2 - tw / 2, 448, tw, 34, 17, '#ffd9e3', '#4a3330', 3);
    ctx.fillStyle = '#4a3330'; ctx.fillText(dog.titleName, W / 2, 466);
  }
  ctx.font = font(18); ctx.fillStyle = '#7a5a50';
  const kind = dog.special ? `${dog.original ? '👑 원조 · ' : '✨ '}${SPECIALS[dog.special].label}` : breedOf(dog.breed)?.name ?? '';
  if (dog.special) ctx.fillStyle = '#e0507f';
  ctx.fillText(`${kind} · ${user.nickname}의 강아지`, W / 2, 506);
  // 재능 오각형 + 대표 배지
  const radar = radarCanvas(dog.talentStages ?? {}, 104);
  await new Promise((r) => setTimeout(r, 60)); // 오각형 아이콘이 그려질 시간
  ctx.drawImage(radar, 44, 528, 208, 208);
  ctx.textAlign = 'left'; ctx.font = font(18, true); ctx.fillStyle = '#4a3330';
  ctx.fillText('대표 배지', 270, 548);
  const show = (progress?.showcase ?? []).slice(0, SHOWCASE_MAX);
  for (let i = 0; i < SHOWCASE_MAX; i++) {
    const bx = 270; const by = 566 + i * 50;
    const id = show[i];
    roundRect(ctx, bx, by, 40, 40, 20, id ? BADGES[id].color : '#f0dcc0', '#4a3330', 3);
    if (id) {
      const icon = await loadImg(iconURL(BADGES[id].icon, 2));
      if (icon) ctx.drawImage(icon, bx + 10, by + 10, 20, 20);
      ctx.fillStyle = '#4a3330'; ctx.font = font(16, true); ctx.textBaseline = 'middle';
      ctx.fillText(BADGES[id].name, bx + 50, by + 21);
    }
  }
  // 친구 코드 QR
  const qr = await loadImg(`/api/qr/${user.friendCode}`);
  if (qr) {
    roundRect(ctx, W - 150, 668, 104, 104, 10, '#ffffff', '#4a3330', 3);
    ctx.drawImage(qr, W - 144, 674, 92, 92);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#4a3330'; ctx.font = font(18, true); ctx.textBaseline = 'alphabetic';
  ctx.fillText('멍뭉고치에서 같이 놀자!', 50, 740);
  ctx.font = font(16); ctx.fillStyle = '#7a5a50';
  ctx.fillText(`친구 코드 ${user.friendCode}`, 50, 764);
  return c;
}

// 저장: 휴대폰은 공유 창(사진 저장·보내기), 컴퓨터는 파일로 받기
export async function savePhotoCard(canvas, name) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], `${name}-멍뭉고치.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '멍뭉고치 포토카드' }); return 'shared'; } catch { /* 취소하면 파일로 받기 */ }
  }
  const a = el('a', { href: URL.createObjectURL(blob), download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}

export async function openPhotoCard(dog, user, progress) {
  const canvas = await makePhotoCard(dog, user, progress);
  canvas.className = 'photocard';
  modal({
    title: '우리 강아지 포토카드',
    className: 'photocard-modal',
    body: el('div', { class: 'center' }, canvas,
      el('p', { class: 'hint' }, 'QR에는 친구 코드가 들어 있어요. 실제로 아는 친구에게만 보여 주세요!')),
    buttons: [
      { label: '닫기', kind: 'secondary' },
      { label: '사진으로 저장', onClick: async () => { await savePhotoCard(canvas, dog.name); sfx.shutter(); return false; } },
    ],
  });
}
