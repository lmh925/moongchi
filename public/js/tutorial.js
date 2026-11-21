// 👉 처음 온 날 따라하기 (코치 마크)
// 화면을 어둡게 하고 버튼 하나만 밝혀서 손가락이 콕콕 가리켜요.
// 따라 누르면 다음 단계로, 언제든 "건너뛰기".
import { el } from './ui.js';
import { sfx } from './audio.js';

let active = null;

export function tutorialRunning() { return !!active; }

// steps: [{ text, target: () => Element, wait: 'click' | 'pointerdown' | 'next', after?: ms, onEnter?() }]
export function runTutorial(steps, { onDone } = {}) {
  if (active) return;
  const hole = el('div', { class: 'coach-hole' });
  const finger = el('div', { class: 'coach-finger', 'aria-hidden': 'true' }, '👆');
  const veil = el('div', { class: 'coach-veil' }, hole);
  const card = el('div', { class: 'coach-card', role: 'dialog', 'aria-live': 'polite' });
  document.body.append(veil, finger, card);

  let i = -1;
  let target = null;
  let unlisten = null;
  let timer = null;

  const place = () => {
    if (!target || !target.isConnected) {
      hole.style.cssText = 'left:50%;top:40%;width:0;height:0';
      finger.hidden = true;
      card.style.top = '38%'; card.style.bottom = '';
      return;
    }
    const r = target.getBoundingClientRect();
    const pad = 6;
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    finger.hidden = false;
    finger.style.left = `${r.left + r.width / 2}px`;
    finger.style.top = `${r.bottom - 4}px`;
    // 버튼이 위쪽에 있으면 설명은 아래에, 아래쪽에 있으면 위에
    const vh = window.innerHeight;
    if (r.top + r.height / 2 < vh * 0.5) { card.style.top = `${Math.min(vh - 170, r.bottom + 48)}px`; card.style.bottom = ''; }
    else { card.style.bottom = `${Math.max(12, vh - r.top + 18)}px`; card.style.top = ''; }
  };

  // 따라하기 중에는 가리킨 것과 설명 카드만 누를 수 있어요
  const guard = (e) => {
    if (card.contains(e.target)) return;
    if (target && target.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener('pointerdown', guard, true);
  document.addEventListener('click', guard, true);

  const finish = (skipped) => {
    clearInterval(timer);
    unlisten?.();
    document.removeEventListener('pointerdown', guard, true);
    document.removeEventListener('click', guard, true);
    window.removeEventListener('resize', place);
    veil.remove(); finger.remove(); card.remove();
    active = null;
    onDone?.(skipped);
  };

  const next = () => {
    unlisten?.(); unlisten = null;
    i++;
    if (i >= steps.length) { finish(false); return; }
    const step = steps[i];
    step.onEnter?.();
    target = step.target?.() ?? null;
    if (target) target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    card.replaceChildren(
      el('div', { class: 'step' }, `따라하기 ${i + 1} / ${steps.length}`),
      el('p', {}, step.text),
      el('div', { class: 'row' },
        el('div', { class: 'dots' }, steps.map((_, k) => el('i', { class: k <= i ? 'on' : '' }))),
        el('div', {},
          step.wait === 'next' || !target ? el('button', { class: 'btn small primary', type: 'button', onclick: () => { sfx.tap(); next(); } }, i === steps.length - 1 ? '시작!' : '좋아요!') : null,
          ' ',
          i < steps.length - 1 ? el('button', { class: 'btn small ghost', type: 'button', onclick: () => finish(true) }, '건너뛰기') : null)));
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    sfx.guide();
    place();
    setTimeout(place, 350); // 부드럽게 스크롤한 뒤 다시 맞춰요
    if (target && step.wait !== 'next') {
      const ev = step.wait === 'pointerdown' ? 'pointerdown' : 'click';
      const go = () => { unlisten?.(); unlisten = null; target = null; place(); setTimeout(next, step.after ?? 1300); };
      target.addEventListener(ev, go, { once: true });
      unlisten = () => target?.removeEventListener(ev, go);
    }
  };

  window.addEventListener('resize', place);
  timer = setInterval(place, 250);
  active = { finish };
  next();
}

export function stopTutorial() { active?.finish(true); }
