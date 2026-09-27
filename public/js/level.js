// 레벨 · 재능 능력치 화면: 레벨 바, 강아지 카드(오각형 그래프), 레벨업 연출
import { TALENTS, TALENT_STEPS, TALENT_PERKS, TITLES, EMOTES, BREEDS, PERSONALITIES, STAGES, SPECIALS } from '../shared/data.js';
import { levelRewards, breedOf } from '../shared/rules.js';
import { dogSprite, dogPortrait, iconURL, DOG_W, DOG_H } from './sprites.js';
import { el, modal } from './ui.js';
import { sfx } from './audio.js';

const OUT = '#4a3330';
const TALENT_KEYS = Object.keys(TALENTS);

// 우리집 패널의 레벨 바
export function levelBar(dog) {
  const pct = Math.round((dog.levelInto / Math.max(1, dog.levelNeed)) * 100);
  return el('div', { class: 'level-bar' },
    el('span', { class: `lv-badge frame-${dog.frame ?? 0}` }, `Lv ${dog.level}`),
    el('div', { class: 'bar' }, el('i', { style: { width: `${pct}%` } })),
    el('span', { class: 'num' }, `${dog.levelInto}/${dog.levelNeed}`));
}

// 이름 옆에 다는 칭호
export function titleChip(dog) {
  return dog?.titleName ? el('span', { class: `title-chip frame-${dog.frame ?? 0}` }, dog.titleName) : null;
}

// 픽셀 오각형 그래프 (재능 단계 1~10)
export function radarCanvas(stages, size = 104) {
  const c = el('canvas', { width: size, height: size, class: 'pixel radar' });
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const cx = size / 2; const cy = size / 2 + 4; const R = size / 2 - 16;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / TALENT_KEYS.length) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (r, fill, stroke) => {
    ctx.beginPath();
    TALENT_KEYS.forEach((k, i) => { const [x, y] = pt(i, typeof r === 'function' ? r(k) : r); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };
  poly(R, '#fff8ec', OUT);
  for (const f of [0.25, 0.5, 0.75]) poly(R * f, null, 'rgba(74,51,48,.18)');
  TALENT_KEYS.forEach((k, i) => {
    const [x, y] = pt(i, R);
    ctx.strokeStyle = 'rgba(74,51,48,.18)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
  });
  poly((k) => R * (0.12 + 0.88 * ((stages[k] ?? 1) - 1) / 9), 'rgba(255,111,145,.55)', '#e0507f');
  TALENT_KEYS.forEach((k, i) => {
    const [x, y] = pt(i, R * (0.12 + 0.88 * ((stages[k] ?? 1) - 1) / 9));
    ctx.fillStyle = TALENTS[k].color;
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
  });
  // 축 끝에 아이콘
  TALENT_KEYS.forEach((k, i) => {
    const [x, y] = pt(i, R + 9);
    const img = new Image();
    img.onload = () => ctx.drawImage(img, Math.round(x - 5), Math.round(y - 5), 10, 10);
    img.src = iconURL(TALENTS[k].icon, 1);
  });
  return c;
}

function talentRow(k, points, stage) {
  const t = TALENTS[k];
  const cur = TALENT_STEPS[stage - 1];
  const next = TALENT_STEPS[stage];
  const pct = next === undefined ? 100 : Math.round(((points - cur) / (next - cur)) * 100);
  const perks = TALENT_PERKS[k].map((p) => el('li', { class: stage >= p.stage ? 'on' : '' }, `${p.stage}단계 · ${p.text}`));
  return el('div', { class: 'talent-row' },
    el('div', { class: 'talent-head' },
      el('img', { class: 'pixel', src: iconURL(t.icon, 2), alt: '' }),
      el('strong', {}, t.name),
      el('span', { class: 'talent-stage', style: { background: t.color } }, `${stage}단계`),
      el('div', { class: 'bar' }, el('i', { style: { width: `${pct}%`, background: t.color } }))),
    el('p', { class: 'help' }, t.desc),
    perks.length ? el('ul', { class: 'perks' }, perks) : null);
}

// 강아지 카드. mine이면 칭호를 고를 수 있어요. onTitle(titleId) → Promise
export function openDogCard(dog, { mine = false, ownerName = null, onTitle = null, badges = null, onPhotoCard = null, onRename = null } = {}) {
  const stages = dog.talentStages ?? {};
  const p = PERSONALITIES[dog.personality];
  const body = el('div', { class: 'dog-card' },
    el('div', { class: 'dog-card-top' },
      el('img', { class: 'pixel dog-card-img', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip }), alt: '' }),
      el('div', {},
        el('div', { class: 'dog-card-name' }, dog.name, el('span', { class: `lv-badge frame-${dog.frame ?? 0}` }, `Lv ${dog.level}`)),
        titleChip(dog),
        dog.special ? el('span', { class: `special-chip ${dog.original ? 'original' : ''}` }, dog.original ? `👑 원조 ${SPECIALS[dog.special].name}` : `✨ ${SPECIALS[dog.special].label}`) : null,
        el('p', { class: 'help' }, `${breedOf(dog.breed)?.name ?? ''} · ${p ? `${p.emoji} ${p.name}` : ''} · ${STAGES[dog.stage].name}`),
        ownerName ? el('p', { class: 'help' }, `${ownerName}의 강아지`) : null,
        dog.parents ? el('p', { class: 'help family' }, `👪 ${dog.parents.map((p) => `${p.name}(${p.owner})`).join(' & ')}의 아기`) : null),
      radarCanvas(stages)),
    badges?.length ? el('div', { class: 'card-badges' }, badges) : null,
    onPhotoCard || onRename ? el('div', { class: 'card-actions' },
      onPhotoCard ? el('button', { class: 'btn small primary', onclick: onPhotoCard }, '📸 자랑 카드 만들기') : null,
      onRename ? el('button', { class: 'btn small secondary', onclick: onRename }, '이름표 바꾸기') : null) : null,
    el('div', { class: 'talent-list' }, TALENT_KEYS.map((k) => talentRow(k, dog.talents?.[k] ?? 0, stages[k] ?? 1))));
  if (mine) {
    body.append(el('div', { class: 'section-title' }, '다음 레벨 선물'), nextRewards(dog.level));
    if (onTitle) body.append(el('div', { class: 'section-title' }, '칭호 달기'), titlePicker(dog, onTitle));
    body.append(el('p', { class: 'help center' }, '재능은 절대 줄어들지 않아요. 재능 하나마다 하루에 오를 수 있는 양이 정해져 있어요.'));
  }
  return modal({ title: mine ? '우리 강아지 카드' : `${dog.name}의 강아지 카드`, className: 'dog-card-modal', body, buttons: [{ label: '닫기', kind: 'secondary' }] });
}

function nextRewards(level) {
  const r = levelRewards(level + 1);
  return el('div', { class: 'reward-preview' },
    el('span', { class: 'chip' }, `Lv ${level + 1}`),
    ...rewardChips(r));
}

function rewardChips(r) {
  return [
    el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '' }), `코인 ${r.coins}`),
    r.tickets ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('star', 2), alt: '' }), `캡슐 뽑기권${r.tickets > 1 ? ` ${r.tickets}장` : ''}`) : null,
    ...r.emotes.map((e) => el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('paw', 2), alt: '' }), `몸짓 "${EMOTES[e].name}"`)),
    ...r.titles.map((t) => el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('sparkle', 2), alt: '' }), `칭호 "${TITLES[t].name}"`)),
    r.frame ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('heart', 2), alt: '' }), '새 이름표 테두리') : null,
    r.hourglass ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('hourglass', 2), alt: '' }), `반짝 모래시계${r.hourglass > 1 ? ` ${r.hourglass}개` : ''}`) : null,
  ].filter(Boolean);
}

function titlePicker(dog, onTitle) {
  const wrap = el('div', { class: 'title-picker' });
  const render = () => {
    wrap.replaceChildren(...Object.entries(TITLES).filter(([id, t]) => !t.special || dog.titles?.includes(id)).map(([id, t]) => {
      const has = dog.titles?.includes(id);
      const on = dog.titleName === t.name;
      const need = t.talent ? `${TALENTS[t.talent].name} ${t.stage}단계` : `Lv ${t.level}`;
      return el('button', {
        type: 'button', class: `title-opt ${on ? 'on' : ''}`, disabled: !has,
        onclick: async () => {
          const res = await onTitle(on ? null : id);
          if (res === false) return;
          dog.titleName = on ? null : t.name;
          sfx.tap();
          render();
        },
      }, has ? t.name : '???', el('small', {}, has ? (on ? '다는 중' : '') : need));
    }));
  };
  render();
  return wrap;
}

// ---------- 레벨업 연출 ----------
// 강아지가 정면을 보고 폴짝! 폭죽이 터지고 "Lv N!" 도장이 찍힌 다음, 선물 카드를 한 장씩 뒤집어요.
export function playLevelUp(dog, ev) {
  return new Promise((resolve) => {
    const W = 160; const H = 110;
    const canvas = el('canvas', { width: W, height: H, class: 'pixel levelup-canvas' });
    const stamp = el('div', { class: 'lv-stamp' }, `Lv ${ev.level}!`);
    const cards = el('div', { class: 'reward-cards' }, rewardChips(ev.rewards).map((chip, i) => el('div', { class: 'reward-card', style: { animationDelay: `${1.3 + i * 0.35}s` } }, chip)));
    const done = el('button', { class: 'btn primary', onclick: () => { stop = true; wrap.remove(); resolve(); } }, '좋아요!');
    const wrap = el('div', { class: 'modal-wrap' },
      el('div', { class: 'modal-card levelup-card' },
        el('h2', { class: 'modal-title' }, '레벨 업!'),
        el('div', { class: 'levelup-stage' }, canvas, stamp),
        el('p', { class: 'center' }, `${dog.name}(이)가 한 뼘 더 멋져졌어요!`),
        cards,
        el('div', { class: 'modal-buttons' }, done)));
    document.getElementById('modal-root').append(wrap);
    sfx.levelUp();
    setTimeout(() => sfx.star(), 900);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const colors = ['#ff6f91', '#ffd23f', '#5b8cff', '#3fb58a', '#b07cff'];
    const bits = [];
    let t = 0; let last = performance.now(); let stop = false; let burst = 0;
    const pop = () => {
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2; const v = 30 + Math.random() * 60;
        bits.push({ x: W / 2 + (Math.random() - 0.5) * 60, y: 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, c: colors[i % colors.length], life: 1.4 });
      }
    };
    const frame = (now) => {
      if (stop) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      if (burst < 3 && t > burst * 0.6) { pop(); burst += 1; }
      ctx.fillStyle = '#fff4d6'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffe6a8'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + t * 0.6; ctx.beginPath(); ctx.moveTo(W / 2, H - 20); ctx.lineTo(W / 2 + Math.cos(a) * 140, H - 20 + Math.sin(a) * 140); ctx.lineTo(W / 2 + Math.cos(a + 0.2) * 140, H - 20 + Math.sin(a + 0.2) * 140); ctx.fill(); }
      ctx.fillStyle = '#9fd67f'; ctx.fillRect(0, H - 18, W, 18);
      const hop = Math.abs(Math.sin(t * 5)) * 14 * Math.max(0.3, 1 - t / 4);
      const spr = dogSprite(dog.breed, dog.stage, 'front', { eyes: 'happy', mouth: 'tongue', tail: Math.floor(t * 8) % 2, equip: dog.equip });
      ctx.fillStyle = 'rgba(74,51,48,.25)'; ctx.fillRect(W / 2 - 12, H - 20, 24, 3);
      ctx.drawImage(spr.canvas, Math.round(W / 2 - DOG_W / 2), Math.round(H - 20 - DOG_H + 3 - hop));
      for (const b of bits) {
        b.life -= dt; b.vy += 90 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.life > 0) { ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 2); }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// 재능 단계가 올랐을 때 (새 효과나 칭호가 생겼으면 알려 줘요)
export function talentUpBody(ev) {
  const t = TALENTS[ev.talent];
  return el('div', { class: 'center' },
    el('div', { class: 'talent-up' },
      el('img', { class: 'pixel', src: iconURL(t.icon, 4), alt: '' }),
      el('span', { class: 'talent-stage big', style: { background: t.color } }, `${t.name} ${ev.stage}단계`)),
    ...ev.perks.map((p) => el('p', {}, `새 능력: ${p}`)),
    ...ev.titleNames.map((n) => el('p', {}, `새 칭호 "${n}"을(를) 얻었어요! 강아지 카드에서 달 수 있어요.`)));
}
