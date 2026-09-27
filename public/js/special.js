// 스페셜 캐릭터 이스터에그: "어? 이 이름은…!" 변신 연출
import { SPECIALS, SPECIAL_TRICKS, BREEDS, SPECIAL_PERKS, ITEMS } from '../shared/data.js';
import { dogSprite, accessoryURL, DOG_W, DOG_H } from './sprites.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

const RAINBOW = ['#ff6f91', '#ffb84d', '#ffe066', '#6cc070', '#5b8cff', '#b07cff'];

// dog: 변신한 강아지, ev: { key, from(원래 견종) }
export function playSpecialReveal(dog, ev) {
  const sp = SPECIALS[ev.key];
  if (!sp) return Promise.resolve();
  return new Promise((resolve) => {
    const W = 160; const H = 110;
    const canvas = el('canvas', { width: W, height: H, class: 'pixel levelup-canvas' });
    const line = el('p', { class: 'center special-line' }, '…어? 이 이름, 어디서 들어 본 것 같은데?');
    const info = el('div', { class: 'special-info', hidden: true },
      el('div', { class: 'special-label' }, `✨ ${sp.label}`),
      el('h3', {}, sp.name),
      el('p', { class: 'help' }, BREEDS[sp.breed].desc),
      specialPerkList(ev.key),
      el('p', {}, '전용 개인기: ', el('b', {}, SPECIAL_TRICKS[sp.trick].name), ` - ${SPECIAL_TRICKS[sp.trick].desc}`),
      el('p', { class: 'hint' }, `칭호 "${sp.title}"도 받았어요! 강아지 카드에서 달 수 있어요.`));
    const btn = el('button', { class: 'btn primary', hidden: true, onclick: () => { stop = true; wrap.remove(); resolve(); } }, '와아! 반가워!');
    const wrap = el('div', { class: 'modal-wrap' },
      el('div', { class: 'modal-card levelup-card special-card' },
        el('h2', { class: 'modal-title' }, '어라라?'),
        canvas, line, info, el('div', { class: 'modal-buttons' }, btn)));
    document.getElementById('modal-root').append(wrap);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const fromBreed = BREEDS[ev.from] ? ev.from : 'bichon';
    const puffs = [];
    const bits = [];
    let t = 0; let last = performance.now(); let stop = false; let phase = 0;
    sfx.notify();
    const frame = (now) => {
      if (stop) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // 배경: 처음엔 평범한 하늘 → 변신 후 무지개 빛
      if (phase < 2) { ctx.fillStyle = '#d8f1ff'; ctx.fillRect(0, 0, W, H); } else {
        RAINBOW.forEach((c, i) => { ctx.fillStyle = c; ctx.globalAlpha = 0.35; ctx.fillRect(0, i * (H / RAINBOW.length), W, H / RAINBOW.length + 1); });
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(0, 0, W, H);
      }
      ctx.fillStyle = '#9fd67f'; ctx.fillRect(0, H - 18, W, 18);
      if (phase === 0 && t > 1.3) { phase = 1; sfx.whoosh(); for (let i = 0; i < 14; i++) puffs.push({ x: W / 2 + (Math.random() - 0.5) * 30, y: H - 40 + (Math.random() - 0.5) * 24, r: 3, v: 18 + Math.random() * 20 }); }
      if (phase === 1 && t > 2.1) {
        phase = 2;
        sfx.levelUp();
        for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2; const v = 30 + Math.random() * 60; bits.push({ x: W / 2, y: H - 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, c: RAINBOW[i % RAINBOW.length], life: 1.6 }); }
        line.textContent = '✨ 스페셜 친구를 찾았어요! ✨';
        info.hidden = false; btn.hidden = false;
        wrap.querySelector('.modal-title').textContent = '전설의 친구 등장!';
      }
      const shake = phase === 0 && t > 0.7 ? Math.round(Math.sin(t * 50)) : 0;
      const hop = phase === 2 ? Math.abs(Math.sin(t * 5)) * 10 * Math.max(0.3, 1 - (t - 2.1) / 4) : 0;
      if (phase < 2) {
        const spr = dogSprite(fromBreed, dog.stage, 'front', { eyes: t > 0.7 ? 'open' : 'happy', mouth: 'closed' });
        if (phase === 0 || t < 1.6) ctx.drawImage(spr.canvas, Math.round(W / 2 - DOG_W / 2) + shake, H - 20 - DOG_H + 3);
        if (phase === 0 && t > 0.6) { ctx.fillStyle = '#4a3330'; ctx.font = '12px Galmuri11, sans-serif'; ctx.fillText('?!', W / 2 + 14, H - 58); }
      } else {
        const spr = dogSprite(sp.breed ? dog.breed : fromBreed, dog.stage, 'front', { eyes: 'happy', mouth: 'tongue', tail: Math.floor(t * 8) % 2, equip: dog.equip });
        ctx.fillStyle = 'rgba(74,51,48,.22)'; ctx.fillRect(W / 2 - 12, H - 20, 24, 3);
        ctx.drawImage(spr.canvas, Math.round(W / 2 - DOG_W / 2), Math.round(H - 20 - DOG_H + 3 - hop));
      }
      for (const p of puffs) {
        p.r += p.v * dt * 0.6; p.y -= p.v * dt * 0.3;
        if (p.r < 22) { ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - p.r / 22)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
      }
      for (const b of bits) {
        b.life -= dt; b.vy += 80 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.life > 0) { ctx.fillStyle = b.c; ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 3); }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

// 이름표에 붙이는 스페셜/원조 표시
export function specialMark(dog) {
  if (!dog?.special) return null;
  return el('span', { class: `special-chip ${dog.original ? 'original' : ''}` }, dog.original ? '👑 원조' : '✨ 스페셜');
}

// 스페셜 친구 혜택 목록 (변신 연출·선물 상자·강아지 카드에서 같이 써요)
export function specialPerkList(key) {
  const sp = SPECIALS[key];
  if (!sp) return null;
  return el('ul', { class: 'special-perks' },
    el('li', {}, `⭐ 모든 경험치 +${Math.round((SPECIAL_PERKS.expBoost - 1) * 100)}%`),
    el('li', {}, `💫 ${sp.perk}`),
    ...(sp.games ?? []).map((g) => el('li', {}, `🎮 ${g}`)),
    el('li', {}, `🎀 전용 소품: ${ITEMS[sp.item]?.name ?? ''}`),
    el('li', {}, `🎵 전용 개인기: ${SPECIAL_TRICKS[sp.trick].name}`));
}

// 시작 선물 상자 내용
export function specialGiftBody(ev) {
  const sp = SPECIALS[ev.key];
  return el('div', { class: 'center special-gift' },
    el('p', {}, `${ev.dogName}(이)는 전설의 ${sp.name}! 스페셜 친구 선물이 도착했어요.`),
    el('div', { class: 'gift-row' },
      el('span', { class: 'chip' }, `경험치 +${ev.exp}`),
      el('span', { class: 'chip' }, `뼈다귀 코인 +${ev.coins}`)),
    ev.item ? el('div', { class: 'gift-item' }, el('img', { class: 'pixel', src: accessoryURL(ev.item, 5), alt: '' }), el('b', {}, ITEMS[ev.item].name), el('small', {}, '꾸미기에서 입혀 보세요!')) : null,
    el('div', { class: 'section-title' }, '스페셜 친구 혜택'),
    specialPerkList(ev.key));
}
