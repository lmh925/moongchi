// 멍뭉 카드: 포켓몬 카드처럼 생긴 자랑 카드 (600×840)
// 속성(가장 높은 재능) · HP(레벨) · 기술 2개(배운 개인기) · 희귀도(레벨/스페셜) · 반짝이(홀로)
// 그림 칸에는 "지금 화면"(우리 집 장면)이나 속성 배경 위의 강아지를 그려요.
import { BREEDS, TALENTS, TRICKS, SPECIALS, SPECIAL_TRICKS, PERSONALITIES, STAGES, TALENT_PERSONALITY } from '../shared/data.js';
import { breedOf, ageDays } from '../shared/rules.js';
import { dogSprite, DOG_W, DOG_H } from './sprites.js';
import { el, modal } from './ui.js';
import { sfx } from './audio.js';
import { makePhotoCard, savePhotoCard } from './progress.js';

const W = 600; const H = 840;
const OUT = '#3a2a28';
const TYPE_ICON = { strong: '🔥', smart: '💧', kind: '💗', charm: '✨', curious: '🍀' };
const TYPE_BG = {
  strong: ['#ffd0b8', '#ff9b73'], smart: ['#cfe0ff', '#8fb0ff'], kind: ['#ffd6e2', '#ff9fbd'],
  charm: ['#eadcff', '#c3a4ff'], curious: ['#d3f3e4', '#8fd9b6'],
};
const RAINBOW = ['#ff6f91', '#ffb84d', '#ffe066', '#6cc070', '#5b8cff', '#b07cff'];
const CARE = { feed: '밥 먹기', brush: '빗질', pet: '쓰다듬기' };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function box(ctx, x, y, w, h, r, fill, stroke, lw = 4) {
  rr(ctx, x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// 가장 높은 재능 = 속성 (같으면 성격이 좋아하는 재능)
export function dogType(dog) {
  const st = dog.talentStages ?? {};
  const pref = TALENT_PERSONALITY[dog.personality];
  return Object.keys(TALENTS).sort((a, b) => (st[b] ?? 0) - (st[a] ?? 0) || (b === pref) - (a === pref))[0];
}

export function cardRarity(dog) {
  if (dog.special) return { mark: '★★', name: dog.original ? '원조 스페셜' : '스페셜', holo: 'rainbow' };
  if (dog.level >= 20) return { mark: '★', name: '에픽', holo: 'gold' };
  if (dog.level >= 10) return { mark: '◆', name: '레어', holo: 'silver' };
  return { mark: '●', name: '일반', holo: null };
}

// 기술 2개: 스페셜 개인기 → 어려운 개인기 순. 위력은 레벨과 재능으로
function cardMoves(dog, type) {
  const st = dog.talentStages ?? {};
  const known = [...(dog.tricks ?? [])].filter((t) => TRICKS[t]).sort((a, b) => TRICKS[b].stage - TRICKS[a].stage);
  const list = [];
  if (dog.special) list.push({ name: SPECIAL_TRICKS[SPECIALS[dog.special].trick].name, desc: SPECIAL_TRICKS[SPECIALS[dog.special].trick].desc, big: true });
  for (const t of known) if (list.length < 2) list.push({ name: TRICKS[t].name, desc: TRICKS[t].desc });
  if (list.length < 2) list.push({ name: '꼬리 살랑살랑', desc: '보는 사람 마음이 사르르 녹아요.' });
  const base = 10 + Math.floor(dog.level / 2) * 5;
  return list.slice(0, 2).map((m, i) => ({
    ...m,
    cost: i === 0 && !m.big ? 1 : 2,
    power: Math.min(250, (i === 1 || m.big ? base * 2 : base) + (st[type] ?? 0) * 5 + (m.big ? 30 : 0)),
  }));
}

function holoStripes(ctx, x, y, w, h, kind, alpha = 0.22) {
  ctx.save();
  rr(ctx, x, y, w, h, 10); ctx.clip();
  ctx.globalAlpha = alpha;
  const cols = kind === 'rainbow' ? RAINBOW : kind === 'gold' ? ['#fff3a0', '#ffd23f', '#ffffff'] : ['#ffffff', '#dfe8ff', '#ffffff'];
  for (let i = -h; i < w + h; i += 28) {
    ctx.fillStyle = cols[Math.abs(Math.floor(i / 28)) % cols.length];
    ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i + 14, y); ctx.lineTo(x + i + 14 - h, y + h); ctx.lineTo(x + i - h, y + h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// scene: { canvas, x, y } 지금 화면에서 내 강아지 주변을 잘라 그려요 (없으면 속성 배경)
export async function makeDogCard(dog, user, { scene = null } = {}) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  await document.fonts?.load('20px Galmuri11').catch(() => {});
  const font = (px, bold = false) => `${bold ? '700 ' : ''}${px}px Galmuri11, sans-serif`;
  const type = dogType(dog);
  const T = TALENTS[type];
  const rare = cardRarity(dog);
  const [light, deep] = TYPE_BG[type];

  // 바깥 노란 테두리 (스페셜은 무지개)
  box(ctx, 0, 0, W, H, 32, null, null);
  if (rare.holo === 'rainbow') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    RAINBOW.forEach((col, i) => g.addColorStop(i / (RAINBOW.length - 1), col));
    box(ctx, 0, 0, W, H, 32, g, OUT, 6);
  } else box(ctx, 0, 0, W, H, 32, '#ffd23f', OUT, 6);
  // 안쪽 속성 배경
  const bg = ctx.createLinearGradient(0, 24, 0, H - 24);
  bg.addColorStop(0, light); bg.addColorStop(1, deep);
  box(ctx, 22, 22, W - 44, H - 44, 18, bg, OUT, 3);

  // 윗줄: 단계 · 이름 · HP · 속성
  ctx.textBaseline = 'middle';
  const stageName = STAGES[dog.stage]?.name ?? '';
  ctx.font = font(15, true);
  const sw = ctx.measureText(stageName).width + 20;
  box(ctx, 40, 38, sw, 26, 13, '#fffaf0', OUT, 2);
  ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.fillText(stageName, 40 + sw / 2, 52);
  ctx.textAlign = 'left'; ctx.font = font(34, true); ctx.fillStyle = OUT;
  ctx.fillText(dog.name, 48 + sw, 54);
  const hp = Math.min(300, 50 + dog.level * 10);
  ctx.textAlign = 'right';
  ctx.font = font(34, true); ctx.fillStyle = '#e8264a';
  ctx.fillText(String(hp), W - 88, 54);
  const hpw = ctx.measureText(String(hp)).width;
  ctx.font = font(14, true); ctx.fillStyle = OUT;
  ctx.fillText('HP', W - 92 - hpw, 58);
  box(ctx, W - 80, 32, 42, 42, 21, T.color, OUT, 3);
  ctx.textAlign = 'center'; ctx.font = font(22); ctx.fillText(TYPE_ICON[type], W - 59, 54);

  // 그림 칸 (금테)
  const ax = 44; const ay = 82; const aw = W - 88; const ah = 330;
  box(ctx, ax - 6, ay - 6, aw + 12, ah + 12, 12, rare.holo === 'gold' ? '#ffd23f' : '#d9c7a8', OUT, 3);
  ctx.save();
  rr(ctx, ax, ay, aw, ah, 8); ctx.clip();
  if (scene?.canvas) {
    // 지금 화면: 내 강아지 주변을 4배로 잘라요
    const s = 4; const cw = aw / s; const ch = ah / s;
    const sx = Math.max(0, Math.min(scene.canvas.width - cw, scene.x - cw / 2));
    const sy = Math.max(0, Math.min(scene.canvas.height - ch, scene.y - 28 - ch / 2));
    ctx.drawImage(scene.canvas, sx, sy, cw, ch, ax, ay, aw, ah);
  } else {
    const g = ctx.createRadialGradient(W / 2, ay + ah * 0.55, 20, W / 2, ay + ah * 0.55, aw * 0.7);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, T.color);
    ctx.fillStyle = g; ctx.fillRect(ax, ay, aw, ah);
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) { const r = 6 + (i * 7) % 18; ctx.beginPath(); ctx.arc(ax + (i * 97) % aw, ay + (i * 53) % ah, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(58,42,40,.18)'; ctx.fillRect(W / 2 - 90, ay + ah - 44, 180, 14);
    const spr = dogSprite(dog.breed, dog.stage, 'front', { eyes: 'happy', mouth: 'tongue', equip: dog.equip, fluff: 1 });
    const sc = 6;
    ctx.drawImage(spr.canvas, Math.round(W / 2 - (DOG_W * sc) / 2), ay + ah - 30 - DOG_H * sc + 10, DOG_W * sc, DOG_H * sc);
  }
  ctx.restore();
  if (rare.holo) holoStripes(ctx, ax, ay, aw, ah, rare.holo, rare.holo === 'gold' ? 0.18 : 0.13);

  // 정보 띠: No. · 견종 · 성격 · 레벨
  const b = breedOf(dog.breed);
  const no = Math.max(1, Object.keys(BREEDS).indexOf(dog.baseBreed ?? dog.breed) + 1);
  const p = PERSONALITIES[dog.personality];
  box(ctx, 70, ay + ah + 12, W - 140, 28, 6, '#fff3c4', OUT, 2);
  ctx.font = font(14, true); ctx.fillStyle = OUT; ctx.textAlign = 'center';
  ctx.fillText(`No.${String(no).padStart(3, '0')}  ${dog.special ? SPECIALS[dog.special].label : b?.name ?? ''}  ·  ${p?.emoji ?? ''} ${p?.name ?? ''}  ·  Lv ${dog.level}`, W / 2, ay + ah + 27);

  // 기술 2개
  let y = ay + ah + 62;
  for (const m of cardMoves(dog, type)) {
    for (let i = 0; i < m.cost; i++) { box(ctx, 44 + i * 30, y + 4, 26, 26, 13, T.color, OUT, 2); ctx.font = font(13); ctx.fillStyle = OUT; ctx.textAlign = 'center'; ctx.fillText(TYPE_ICON[type], 57 + i * 30, y + 18); }
    ctx.textAlign = 'left'; ctx.font = font(24, true); ctx.fillStyle = OUT;
    ctx.fillText(m.name, 120, y + 17);
    ctx.textAlign = 'right'; ctx.font = font(28, true);
    ctx.fillText(String(m.power), W - 48, y + 17);
    ctx.textAlign = 'left'; ctx.font = font(15); ctx.fillStyle = '#5a4540';
    ctx.fillText(m.desc, 120, y + 44);
    y += 74;
    ctx.fillStyle = 'rgba(58,42,40,.25)'; ctx.fillRect(44, y - 12, W - 88, 2);
  }

  // 약점·저항·후퇴 대신: 좋아해요 · 칭호 · 함께한 날
  const days = Math.floor(ageDays({ bornAt: dog.bornAt ?? Date.now() }, Date.now()));
  const cells = [
    ['좋아해요', CARE[p?.favorite] ?? '놀기'],
    ['칭호', dog.titleName ?? '-'],
    ['함께한 날', `${days + 1}일째`],
  ];
  const cw = (W - 88) / 3;
  cells.forEach(([k, v], i) => {
    const cx = 44 + cw * i + cw / 2;
    ctx.textAlign = 'center'; ctx.font = font(13, true); ctx.fillStyle = '#5a4540'; ctx.fillText(k, cx, y + 4);
    ctx.font = font(16, true); ctx.fillStyle = OUT;
    let text = v;
    while (ctx.measureText(text).width > cw - 10 && text.length > 2) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, cx, y + 26);
  });
  y += 48;

  // 설명 글 (견종 소개)
  box(ctx, 44, y, W - 88, 70, 8, 'rgba(255,250,240,.85)', '#c9a36a', 2);
  ctx.textAlign = 'left'; ctx.font = font(15); ctx.fillStyle = '#5a4540';
  const desc = b?.desc ?? '';
  const words = [...desc]; let line = ''; let ly = y + 22;
  for (const ch of words) {
    if (ctx.measureText(line + ch).width > W - 120) { ctx.fillText(line, 58, ly); line = ''; ly += 22; }
    line += ch;
  }
  ctx.fillText(line, 58, ly);

  // 맨 아래: 트레이너 · 희귀도 · 카드 번호
  ctx.font = font(14, true); ctx.fillStyle = OUT; ctx.textAlign = 'left';
  ctx.fillText(`트레이너 ${user.nickname}${dog.original ? ' · 👑 원조' : ''}`, 44, H - 44);
  ctx.textAlign = 'right';
  ctx.fillText(`${rare.mark} ${rare.name}  #${String(dog.id ?? 0).padStart(4, '0')}  멍뭉고치`, W - 44, H - 44);

  // 전체 반짝이 (스페셜)
  if (rare.holo === 'rainbow') holoStripes(ctx, 22, 22, W - 44, H - 44, 'rainbow', 0.08);
  return c;
}

// 카드 보기: 기울이면 반짝이가 움직여요. 멍뭉 카드 / QR 포토카드 두 가지
export async function openDogCardMaker(dog, user, progress, { scene = null } = {}) {
  let style = 'tcg';
  let bgMode = scene ? 'scene' : 'type';
  const holder = el('div', { class: 'tcg-holder' });
  const shine = el('div', { class: 'tcg-shine' });
  let canvas = null;
  const render = async () => {
    canvas = style === 'tcg'
      ? await makeDogCard(dog, user, { scene: bgMode === 'scene' ? scene : null })
      : await makePhotoCard(dog, user, progress);
    canvas.className = style === 'tcg' ? 'tcg-card' : 'photocard';
    const r = cardRarity(dog);
    holder.className = `tcg-holder ${style === 'tcg' && r.holo ? `holo-${r.holo}` : ''}`;
    holder.replaceChildren(canvas, shine);
    tabs.replaceChildren(...[['tcg', '멍뭉 카드'], ['photo', '포토카드 (QR)']].map(([k, label]) => el('button', { class: style === k ? 'on' : '', onclick: () => { style = k; render(); } }, label)));
    bgTabs.hidden = style !== 'tcg' || !scene;
    bgTabs.replaceChildren(...[['scene', '📸 지금 화면'], ['type', '✨ 반짝 배경']].map(([k, label]) => el('button', { class: bgMode === k ? 'on' : '', onclick: () => { bgMode = k; render(); } }, label)));
    hint.textContent = style === 'tcg' ? '카드를 기울이면 반짝여요! 사진으로 저장해서 친구에게 자랑해요.' : 'QR에는 친구 코드가 들어 있어요. 실제로 아는 친구에게만 보여 주세요!';
  };
  const tabs = el('div', { class: 'segmented' });
  const bgTabs = el('div', { class: 'segmented small' });
  const hint = el('p', { class: 'hint center' });
  // 기울이기 (손가락/마우스)
  const tilt = (e) => {
    const r = holder.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    holder.style.setProperty('--rx', `${(0.5 - py) * 16}deg`);
    holder.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
    holder.style.setProperty('--px', `${px * 100}%`);
    holder.style.setProperty('--py', `${py * 100}%`);
  };
  holder.addEventListener('pointermove', tilt);
  holder.addEventListener('pointerleave', () => { holder.style.setProperty('--rx', '0deg'); holder.style.setProperty('--ry', '0deg'); });
  modal({
    title: '자랑 카드 만들기',
    className: 'photocard-modal tcg-modal',
    body: el('div', { class: 'center' }, tabs, bgTabs, holder, hint),
    buttons: [
      { label: '닫기', kind: 'secondary' },
      { label: '사진으로 저장', onClick: async () => { await savePhotoCard(canvas, dog.name); sfx.shutter(); return false; } },
    ],
  });
  await render();
}

