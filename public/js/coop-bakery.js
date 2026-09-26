// 우당탕탕 수제 간식 공장 — 화면 (규칙은 shared/coop/bakery.js, 판정은 서버)
// 위: 주문서와 타이머 / 가운데: 오븐(방장) → 벨트 → 토핑 작업대(손님)
import { BAKERY as B, ovenStatus, stars } from '../shared/coop/bakery.js';
import { iconURL } from './sprites.js';
import { el } from './ui.js';
import { sfx } from './audio.js';

const OUT = '#4a3330';
const BREAD = { plain: ['#f2c078', '#f7d9a0'], choco: ['#7a4b2a', '#9c6b3f'] };
const FRUIT = { strawberry: ['#ff4d6d', '#ff8fa3'], banana: ['#ffe066', '#fff3a0'], blueberry: ['#4a5aa8', '#7c8ce0'] };

// 컵케이크 픽셀 그림 (빵 종류, 생크림, 과일)
function cupcakeURL(bread, cream, fruit, scale = 4) {
  const c = document.createElement('canvas');
  c.width = 16 * scale; c.height = 16 * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  // 컵
  r(3, 10, 10, 6, OUT); r(4, 10, 8, 5, '#ff9fb8');
  for (let x = 5; x < 12; x += 2) r(x, 10, 1, 5, '#e8708f');
  if (bread) {
    const [b, l] = BREAD[bread];
    r(2, 6, 12, 5, OUT); r(3, 6, 10, 4, b); r(4, 6, 6, 1, l);
  }
  if (cream) { r(3, 3, 10, 4, OUT); r(4, 3, 8, 3, '#ffffff'); r(4, 5, 8, 1, '#e6dfee'); r(6, 1, 4, 3, OUT); r(7, 1, 2, 2, '#ffffff'); }
  if (fruit) {
    const [f, l] = FRUIT[fruit];
    const y = cream ? 0 : 3;
    r(6, y, 4, 3, OUT); r(7, y, 2, 2, f); r(7, y, 1, 1, l);
  }
  return c.toDataURL();
}

function piping(scale = 4) {
  const c = document.createElement('canvas');
  c.width = 12 * scale; c.height = 16 * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const r = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  r(1, 0, 10, 10, OUT); r(2, 1, 8, 8, '#ffffff'); r(3, 10, 6, 3, OUT); r(4, 10, 4, 2, '#dfe6f0'); r(5, 13, 2, 3, OUT);
  r(3, 2, 2, 5, '#fff6fa');
  return c.toDataURL();
}

export class BakeryRenderer {
  constructor(host, { role, state, send, now }) {
    Object.assign(this, { role, state, send, now });
    this.dough = 'plain';
    this.timer = el('div', { class: 'bar coop-time' }, el('i', {}));
    this.ordersEl = el('div', { class: 'bk-orders' });
    this.scoreEl = el('div', { class: 'bk-score' });
    this.msg = el('div', { class: 'bk-msg' });
    // 방장: 오븐
    this.doughBtns = Object.entries(B.breads).map(([id, name]) => el('button', {
      class: 'btn small bk-dough', type: 'button', onclick: () => { this.dough = id; sfx.tap(); this.render(); },
    }, el('img', { class: 'pixel', src: cupcakeURL(id, false, null, 2), alt: '' }), `${name} 반죽`));
    this.ovenEls = [0, 1].map((slot) => el('button', { class: 'bk-oven', type: 'button', onclick: () => this.tapOven(slot) }));
    this.kitchen = el('div', { class: `bk-panel ${role === 'p1' ? 'mine' : 'theirs'}` },
      el('div', { class: 'bk-title' }, role === 'p1' ? '내 오븐 (빵 굽기)' : '친구 오븐'),
      el('div', { class: 'bk-doughs' }, this.doughBtns),
      el('div', { class: 'bk-ovens' }, this.ovenEls));
    // 벨트
    this.beltEl = el('div', { class: 'bk-belt' });
    // 손님: 토핑 작업대
    this.plate = el('div', { class: 'bk-plate' });
    const tool = (kind, src, label) => {
      const node = el('div', { class: 'bk-tool', 'data-kind': kind, role: 'button', tabindex: 0 }, el('img', { class: 'pixel', src, alt: '' }), label);
      this.bindDrag(node, kind);
      return node;
    };
    this.tools = el('div', { class: 'bk-tools' },
      tool('cream', piping(3), '생크림'),
      ...Object.entries(B.fruits).map(([id, name]) => tool(id, cupcakeURL(null, false, id, 3), name)));
    this.packBtn = el('button', { class: 'btn primary', type: 'button', onclick: () => this.send({ type: 'pack' }) }, '포장 완성!');
    this.trashBtn = el('button', { class: 'btn small', type: 'button', onclick: () => this.send({ type: 'trash' }) }, '버리기');
    this.topping = el('div', { class: `bk-panel ${role === 'p2' ? 'mine' : 'theirs'}` },
      el('div', { class: 'bk-title' }, role === 'p2' ? '내 작업대 (토핑 얹기)' : '친구 작업대'),
      el('div', { class: 'bk-work' }, this.plate, this.tools),
      el('div', { class: 'bk-actions' }, this.trashBtn, this.packBtn));
    host.append(this.timer, el('div', { class: 'bk-top' }, this.ordersEl, this.scoreEl), this.msg, this.kitchen, this.beltEl, this.topping);
    this.render();
    this.ticker = setInterval(() => this.render(), 200);
  }

  destroy() { clearInterval(this.ticker); }

  say(text, kind = '') {
    this.msg.textContent = text;
    this.msg.className = `bk-msg show ${kind}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { this.msg.className = 'bk-msg'; }, 1400);
  }

  tapOven(slot) {
    if (this.role !== 'p1') return;
    const st = ovenStatus(this.state.ovens[slot], this.now());
    if (st === 'empty') this.send({ type: 'bake', slot, dough: this.dough });
    else this.send({ type: 'take', slot });
  }

  // 생크림/과일을 끌어서 접시에 놓아요 (그냥 톡 눌러도 돼요)
  bindDrag(node, kind) {
    const apply = () => this.send(kind === 'cream' ? { type: 'cream' } : { type: 'fruit', fruit: kind });
    node.addEventListener('pointerdown', (e) => {
      if (this.role !== 'p2') return;
      e.preventDefault();
      const sx = e.clientX; const sy = e.clientY;
      const ghost = el('img', { class: 'pixel pb-ghost', src: node.querySelector('img').src, alt: '' });
      let dragging = false;
      const move = (ev) => {
        if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { dragging = true; document.body.append(ghost); }
        if (dragging) ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%)`;
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        ghost.remove();
        if (!dragging) { apply(); return; }
        const r = this.plate.getBoundingClientRect();
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) apply();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  onState(state, events) {
    this.state = state;
    for (const ev of events) {
      if (ev.type === 'bake') sfx.tap();
      if (ev.type === 'ready') { sfx.bell(); this.say('빵이 다 구워졌어요! 꺼내 주세요', 'good'); }
      if (ev.type === 'burnt') { sfx.error(); this.say('앗, 빵이 탔어요! 버리고 다시 구워요', 'bad'); }
      if (ev.type === 'send') { sfx.whoosh(); }
      if (ev.type === 'pick' || ev.type === 'cream' || ev.type === 'fruit') sfx.pop();
      if (ev.type === 'deliver') { sfx.coin(); sfx.love(); this.say(`납품 완료! ${ev.done}개째`, 'good'); }
      if (ev.type === 'mismatch' && ev.role === this.role) { sfx.error(); this.say('주문서랑 달라요! 빵이나 과일을 확인해요', 'bad'); }
      if (ev.type === 'unfinished' && ev.role === this.role) this.say('생크림과 과일을 둘 다 올려요');
      if (ev.type === 'beltfull' && ev.role === this.role) this.say('벨트가 꽉 찼어요! 친구가 가져가길 기다려요');
      if (ev.type === 'notyet' && ev.role === this.role) this.say('아직 굽는 중이에요');
    }
    this.render();
  }

  render() {
    const s = this.state;
    const now = this.now();
    this.timer.firstChild.style.width = `${Math.max(0, (s.endsAt - now) / (s.endsAt - s.startedAt)) * 100}%`;
    this.ordersEl.replaceChildren(el('span', { class: 'bk-label' }, '주문'), ...s.orders.map((o, i) => el('div', { class: `bk-order ${i === 0 ? 'first' : ''}` },
      el('img', { class: 'pixel', src: cupcakeURL(o.bread, true, o.fruit, 2), alt: '' }),
      el('span', {}, `${B.breads[o.bread]}+${B.fruits[o.fruit]}`))));
    const st = stars(s.done);
    this.scoreEl.textContent = `완성 ${s.done}개 ${'★'.repeat(st)}${'☆'.repeat(3 - st)}`;
    this.doughBtns.forEach((b, i) => b.classList.toggle('on', Object.keys(B.breads)[i] === this.dough));
    s.ovens.forEach((o, slot) => {
      const status = ovenStatus(o, now);
      const node = this.ovenEls[slot];
      node.className = `bk-oven ${status}`;
      const pct = status === 'baking' ? Math.min(100, ((now - o.at) / B.BAKE_MS) * 100) : 100;
      node.replaceChildren(...[
        el('div', { class: 'bk-oven-window' },
          o.dough ? el('img', { class: 'pixel', src: cupcakeURL(o.dough, false, null, 3), alt: '' }) : null,
          status === 'burnt' ? el('span', { class: 'smoke' }, '💨') : null),
        status === 'baking' ? el('div', { class: 'bar' }, el('i', { style: { width: `${pct}%` } })) : null,
        el('span', {}, { empty: this.role === 'p1' ? '반죽 넣기' : '비었어요', baking: '굽는 중…', ready: this.role === 'p1' ? '꺼내기!' : '다 됐어요', burnt: this.role === 'p1' ? '탔어요! 버리기' : '탔어요!' }[status]),
      ].filter(Boolean));
    });
    this.beltEl.replaceChildren(el('span', { class: 'bk-label' }, '벨트'),
      ...(s.belt.length ? s.belt.map((b) => el('button', {
        class: 'bk-bread', type: 'button', disabled: this.role !== 'p2' || !!s.station,
        onclick: () => this.send({ type: 'pick', id: b.id }),
      }, el('img', { class: 'pixel', src: cupcakeURL(b.type, false, null, 3), alt: B.breads[b.type] }))) : [el('span', { class: 'meta' }, '구운 빵이 여기로 와요')]));
    this.plate.replaceChildren(s.station
      ? el('img', { class: 'pixel', src: cupcakeURL(s.station.type, s.station.cream, s.station.fruit, 5), alt: '' })
      : el('span', { class: 'meta' }, this.role === 'p2' ? '벨트에서 빵을 가져와요' : '비어 있어요'));
    this.packBtn.disabled = this.role !== 'p2' || !s.station;
    this.trashBtn.disabled = this.role !== 'p2' || !s.station;
  }
}
