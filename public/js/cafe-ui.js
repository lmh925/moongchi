// ☕ 멍뭉 카페 화면: 영업(메뉴·직원·시간) · 손님 도감 · 단짝 소개 · 영업 보고서
import { CAFE, CAFE_MENU, CAFE_GUESTS } from '../shared/data.js';
import { dogPortrait } from './sprites.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';

const fmtLeft = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : m ? `${m}분 ${s % 60}초` : `${s}초`;
};

// 손님이 최애 메뉴를 알려 주는 건 두 번 온 뒤부터 (궁합 발견!)
const favKnown = (c, id) => (c.dex?.[id] ?? 0) >= 2;

export function openCafe(ctx) {
  const { post, applyMe, handleEvents, serverNow } = ctx;
  let tab = 'shop';
  let pick = new Set();
  let duration = 'mid';
  let pairSel = [];
  let timer = null;
  const body = el('div', { class: 'cafe' });

  const act = async (path, payload) => {
    try {
      const res = await post(path, payload);
      applyMe(res);
      return res;
    } catch (err) { sfx.error(); toast(err.message, 'bad'); return null; }
  };

  const render = () => {
    clearInterval(timer);
    const me = ctx.me();
    const c = me.cafe;
    const tabs = el('div', { class: 'segmented' }, [['shop', '☕ 영업'], ['dex', '📖 도감'], ['pair', '🤝 소개']].map(([k, label]) => el('button', {
      class: tab === k ? 'on' : '', onclick: () => { tab = k; sfx.tap(); render(); },
    }, label)));
    const head = el('div', { class: 'cafe-head' },
      el('img', { class: 'pixel', src: dogPortrait(me.dog.breed, me.dog.stage, { equip: me.dog.equip, eyes: 'happy' }), alt: '' }),
      el('div', {},
        el('b', {}, `☕ 멍뭉 카페 Lv ${c.level}`),
        el('small', {}, `점장 ${me.dog.name} · 다녀간 손님 ${c.served ?? 0}명`),
        el('span', { class: 'bar' }, el('i', { style: { width: c.need ? `${Math.round((c.into / c.need) * 100)}%` : '100%' } }))));
    const pane = tab === 'shop' ? (c.open ? openPane(me, c) : shopPane(me, c)) : tab === 'dex' ? dexPane(c) : pairPane(c);
    body.replaceChildren(head, tabs, pane);
  };

  // 문 열기 전: 메뉴 · 직원 · 영업 시간
  const shopPane = (me, c) => {
    for (const m of [...pick]) if (!CAFE_MENU[m] || CAFE_MENU[m].level > c.level) pick.delete(m);
    const likers = (menuId) => Object.entries(CAFE_GUESTS).filter(([gid, g]) => g.fav === menuId && favKnown(c, gid)).map(([, g]) => g.emoji).join('');
    return el('div', {},
      el('div', { class: 'section-title' }, `메뉴 고르기 (${pick.size}/${c.slots})`),
      el('div', { class: 'menu-grid' }, Object.entries(CAFE_MENU).map(([id, m]) => {
        const locked = m.level > c.level;
        return el('button', {
          type: 'button', class: `menu-item ${pick.has(id) ? 'on' : ''} ${locked ? 'locked' : ''}`, disabled: locked,
          onclick: () => {
            if (pick.has(id)) pick.delete(id);
            else if (pick.size >= c.slots) { toast(`메뉴는 ${c.slots}개까지 걸 수 있어요.`); return; } else pick.add(id);
            sfx.tap(); render();
          },
        }, el('span', { class: 'big' }, locked ? '🔒' : m.emoji), el('b', {}, m.name),
        el('small', {}, locked ? `카페 Lv ${m.level}` : likers(id) ? `${likers(id)} 최애!` : '누가 좋아할까?'));
      })),
      el('p', { class: 'hint' }, '손님이 두 번 오면 최애 메뉴를 알려 줘요. 최애 메뉴를 걸어 두면 팁 ×2, ⭐5!'),
      el('div', { class: 'section-title' }, '직원 (우리 강아지들)'),
      el('div', { class: 'staff-list' }, Object.entries(CAFE.roles).map(([role, R]) => el('label', { class: 'staff-row' },
        el('span', {}, `${R.emoji} ${R.name}`, el('small', {}, ` ${R.desc}`)),
        el('select', {
          onchange: async (e) => { if (await act('/cafe/staff', { role, dogId: e.target.value ? Number(e.target.value) : null })) render(); },
        }, el('option', { value: '' }, '비어 있음'), me.dogs.map((d) => {
          const o = el('option', { value: String(d.id) }, `${d.name}${d.active ? ' (점장)' : ''}`);
          if (c.staff?.[role] === d.id) o.selected = true;
          return o;
        }))))),
      me.dogs.length < 2 ? el('p', { class: 'hint' }, '둘째를 입양하면 더 든든한 직원이 돼요! 재능이 높을수록 잘해요.') : null,
      el('div', { class: 'section-title' }, '영업 시간'),
      el('div', { class: 'segmented small' }, Object.entries(CAFE.durations).map(([k, D]) => el('button', {
        class: duration === k ? 'on' : '', onclick: () => { duration = k; sfx.tap(); render(); },
      }, D.name))),
      el('button', {
        class: 'btn primary cafe-open', disabled: !pick.size,
        onclick: async () => { if (await act('/cafe/open', { menu: [...pick], duration })) { sfx.bell(); render(); } },
      }, '☕ 문 열기!'));
  };

  // 영업 중: 손님들이 오가는 모습 + 남은 시간
  const openPane = (me, c) => {
    const left = el('b', {});
    const done = () => serverNow() >= c.open.endsAt;
    const btn = el('button', { class: 'btn primary cafe-open' });
    const tick = () => {
      if (armed && !done()) return;
      left.textContent = done() ? '영업 끝! 정산해요' : `남은 시간 ${fmtLeft(c.open.endsAt - serverNow())}`;
      btn.textContent = done() ? '💰 정산하기' : '일찍 닫기';
      btn.className = `btn ${done() ? 'primary' : 'secondary'} cafe-open`;
    };
    let armed = false;
    btn.addEventListener('click', async () => {
      // 일찍 닫기는 두 번 눌러야 해요 (실수 방지)
      if (!done() && !armed) { armed = true; left.textContent = '지금 닫으면 영업한 만큼만 손님이 와요. 한 번 더 누르면 닫아요.'; return; }
      const res = await act('/cafe/collect');
      if (!res) return;
      pick = new Set(c.open.menu);
      showReport(res.report);
      await handleEvents(res.events);
      render();
    });
    tick();
    timer = setInterval(tick, 1000);
    const pool = Object.entries(CAFE_GUESTS).filter(([, g]) => g.level <= c.level && !g.rare);
    return el('div', { class: 'cafe-live' },
      el('div', { class: 'cafe-room' },
        el('div', { class: 'cafe-sign' }, 'OPEN'),
        pool.slice(0, 5).map(([, g], i) => el('span', { class: 'walker', style: { animationDelay: `${i * 1.3}s` } }, g.emoji)),
        el('img', { class: 'pixel cafe-dog', src: dogPortrait(me.dog.breed, me.dog.stage, { equip: me.dog.equip, eyes: 'happy', mouth: 'open' }), alt: '' })),
      el('p', { class: 'center' }, left),
      el('p', { class: 'center meta' }, '메뉴: ', c.open.menu.map((m) => `${CAFE_MENU[m].emoji} ${CAFE_MENU[m].name}`).join(' · ')),
      btn,
      el('p', { class: 'hint' }, '창을 닫아도 영업은 계속돼요. 시간이 지나면 와서 정산해요!'));
  };

  const dexPane = (c) => el('div', {},
    el('div', { class: 'dex-grid cafe-dex' }, Object.entries(CAFE_GUESTS).map(([id, g]) => {
      const n = c.dex?.[id] ?? 0;
      return el('div', { class: `dex-cell ${n ? 'got' : ''}` },
        el('span', { class: 'big' }, n ? g.emoji : '❔'),
        el('b', {}, n ? g.name : '???'),
        el('small', {}, n ? `${n}번 왔어요` : `카페 Lv ${g.level}부터`),
        n ? el('small', {}, favKnown(c, id) ? `최애 ${CAFE_MENU[g.fav].emoji}` : '최애: ❔') : null);
    })),
    el('p', { class: 'hint' }, `손님 ${Object.keys(c.dex ?? {}).length}/${Object.keys(CAFE_GUESTS).length} 만남 · 아주 가끔 전설의 손님도 온대요!`));

  const pairPane = (c) => {
    const regulars = Object.entries(CAFE_GUESTS).filter(([id]) => (c.dex?.[id] ?? 0) >= CAFE.pairMin);
    return el('div', {},
      el('p', { class: 'sub' }, `${CAFE.pairMin}번 이상 온 단골 손님 둘을 골라 소개해 줘요. 단짝이 되면 같이 와서 손님이 늘어요! (💗+${CAFE.pairHearts})`),
      regulars.length >= 2 ? el('div', { class: 'dex-grid' }, regulars.map(([id, g]) => el('button', {
        type: 'button', class: `dex-cell got ${pairSel.includes(id) ? 'on' : ''}`,
        onclick: () => { pairSel = pairSel.includes(id) ? pairSel.filter((x) => x !== id) : [...pairSel, id].slice(-2); sfx.tap(); render(); },
      }, el('span', { class: 'big' }, g.emoji), el('b', {}, g.name)))) : el('p', { class: 'help center' }, '아직 단골 손님이 부족해요. 카페를 더 열어 봐요!'),
      el('button', {
        class: 'btn primary', disabled: pairSel.length < 2,
        onclick: async () => {
          const res = await act('/cafe/introduce', { a: pairSel[0], b: pairSel[1] });
          if (!res) return;
          pairSel = [];
          await handleEvents(res.events);
          render();
        },
      }, '🤝 소개하기'),
      el('div', { class: 'section-title' }, `단짝 손님 (${c.pairs?.length ?? 0})`),
      c.pairs?.length ? el('div', { class: 'pair-list' }, c.pairs.map((k) => el('span', { class: 'chip' }, k.split('+').map((id) => CAFE_GUESTS[id]?.emoji ?? '').join(' 💕 ')))) : el('p', { class: 'hint' }, '아직 단짝이 없어요.'));
  };

  const { close } = modal({ title: '☕ 멍뭉 카페', className: 'cafe-modal', body, buttons: [{ label: '나가기', onClick: () => clearInterval(timer) }] });
  render();
  return close;
}

// 영업 보고서
export function showReport(r) {
  sfx.levelUp();
  modal({
    title: r.early ? '영업 보고서 (일찍 닫음)' : '📋 영업 보고서',
    className: 'celebrate cafe-report',
    body: el('div', {},
      el('div', { class: 'report-sum' },
        el('span', {}, `손님 ${r.guests.length}명`), el('span', {}, `⭐ ${r.stars}`), el('span', {}, `🦴 +${r.coins}`), r.hearts ? el('span', {}, `💗 +${r.hearts}`) : null),
      r.levelUp ? el('p', { class: 'center level-up' }, `🎉 카페 Lv ${r.levelUp}! 새 메뉴와 손님이 생겼어요!`) : null,
      el('div', { class: 'report-guests' }, r.guests.map((g) => el('div', { class: `report-guest ${g.fav ? 'fav' : ''}` },
        g.friend
          ? el('img', { class: 'pixel', src: dogPortrait(g.dog.breed, g.dog.stage, { equip: g.dog.equip, eyes: 'happy' }), alt: '' })
          : el('span', { class: 'big' }, CAFE_GUESTS[g.id]?.emoji ?? '❔'),
        el('small', {}, g.friend ? `${g.nickname}네 ${g.dog.name}` : CAFE_GUESTS[g.id]?.name),
        el('small', { class: 'stars' }, '⭐'.repeat(g.stars)),
        g.isNew ? el('span', { class: 'new' }, 'NEW') : null)))),
    buttons: [{ label: '좋아요!' }],
  });
}
