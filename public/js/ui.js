// 작은 DOM 도우미들
export const $ = (sel, root = document) => root.querySelector(sel);

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer;
export function toast(message, kind = 'info') {
  const t = $('#toast');
  t.textContent = message;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

// 모달: buttons = [{ label, kind, onClick }]  (onClick이 false를 돌려주면 닫지 않아요)
export function modal({ title, body, buttons = [{ label: '좋아요!' }], className = '', dismissable = true }) {
  const root = $('#modal-root');
  const close = () => {
    card.classList.add('closing');
    setTimeout(() => wrap.remove(), 150);
  };
  const card = el('div', { class: `modal-card ${className}`, role: 'dialog', 'aria-modal': 'true' },
    title ? el('h2', { class: 'modal-title' }, title) : null,
    el('div', { class: 'modal-body' }, body),
    buttons.length ? el('div', { class: 'modal-buttons' }, buttons.map((b) => el('button', {
      class: `btn ${b.kind ?? 'primary'}`,
      onclick: async () => {
        const keep = b.onClick ? await b.onClick() : undefined;
        if (keep !== false) close();
      },
    }, b.label))) : null);
  const wrap = el('div', { class: 'modal-wrap', onclick: (e) => { if (dismissable && e.target === wrap) close(); } }, card);
  root.append(wrap);
  return { close, card };
}

export function closeAllModals() {
  $('#modal-root').replaceChildren();
}

// 숫자 4자리 비밀번호 키패드
export function pinPad(onChange) {
  let pin = '';
  const dots = el('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => el('span', { class: 'pin-dot' })));
  const render = () => {
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i < pin.length));
    onChange(pin);
  };
  const press = (k) => {
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'clr') pin = '';
    else if (pin.length < 4) pin += k;
    render();
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'del'];
  const pad = el('div', { class: 'pin-pad' }, keys.map((k) => el('button', {
    type: 'button', class: `pin-key ${k.length > 1 ? 'fn' : ''}`, onclick: () => press(k),
    'aria-label': k === 'del' ? '지우기' : k === 'clr' ? '모두 지우기' : k,
  }, k === 'del' ? '⌫' : k === 'clr' ? '처음부터' : k)));
  return { node: el('div', { class: 'pin' }, dots, pad), reset: () => { pin = ''; render(); } };
}

export function fmtDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}시간 ${m}분`;
  if (m) return `${m}분 ${sec}초`;
  return `${sec}초`;
}
