// 멍뭉거래: 친구끼리 소품·옷 바꾸기 화면
import { ITEMS, RARITY, TRADE } from '../shared/data.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';

const WHY = {
  basic: '기본 아이템', reward: '특별 보상', equipped: '착용 중', locked: '받은 지 하루 안 됨', theyHave: '친구도 있음',
};

function itemTile(id, thumb, { selected = false, disabled = false, why = null, onClick = null } = {}) {
  const it = ITEMS[id];
  return el('button', {
    type: 'button', class: `trade-item r-${it.rarity} ${selected ? 'on' : ''} ${disabled ? 'off' : ''}`,
    disabled: disabled && !onClick, onclick: onClick,
  },
  el('img', { class: 'pixel', src: thumb(id), alt: '' }),
  el('b', {}, it.name),
  el('small', { style: { color: RARITY[it.rarity]?.color } }, why ? WHY[why] : RARITY[it.rarity]?.name ?? ''),
  selected ? el('span', { class: 'check' }, '✔') : null);
}

function itemsRow(ids, thumb) {
  return ids.length
    ? el('div', { class: 'trade-row' }, ids.map((id) => itemTile(id, thumb)))
    : el('p', { class: 'help center' }, '없어요 (선물이에요!)');
}

// 거래 목록 카드 (친구 탭)
export function tradeSection(data, { thumb, onCompose, onReview, onCancel, onHistory }) {
  return el('div', { class: 'trade-box' },
    el('div', { class: 'trade-head' },
      el('b', {}, '멍뭉거래'),
      el('span', { class: 'meta' }, `오늘 ${data.doneToday}/${TRADE.dailyTrades}번`),
      el('button', { class: 'link', onclick: onHistory }, '기록')),
    el('p', { class: 'hint' }, '친구 목록의 "거래" 버튼으로 소품·옷을 바꿔요. 둘 다 확인해야 바뀌어요!'),
    data.incoming.length ? el('div', {},
      el('div', { class: 'section-title' }, `받은 제안 (${data.incoming.length})`),
      el('div', { class: 'cards' }, data.incoming.map((t) => el('button', { class: 'card trade-card new', onclick: () => onReview(t) },
        el('div', { class: 'title' }, `${t.with.nickname}의 제안`, el('span', { class: 'chip' }, 'NEW')),
        el('div', { class: 'trade-mini' }, t.iGet.map((id) => el('img', { class: 'pixel', src: thumb(id), alt: ITEMS[id].name })), el('span', {}, '⇄'),
          t.iGive.length ? t.iGive.map((id) => el('img', { class: 'pixel', src: thumb(id), alt: ITEMS[id].name })) : el('small', {}, '선물')))))) : null,
    data.outgoing.length ? el('div', {},
      el('div', { class: 'section-title' }, `보낸 제안 (${data.outgoing.length})`),
      el('div', { class: 'cards' }, data.outgoing.map((t) => el('div', { class: 'card trade-card' },
        el('div', { class: 'title' }, `${t.with.nickname}에게`, el('button', { class: 'btn small', onclick: () => onCancel(t) }, '취소')),
        el('div', { class: 'trade-mini' }, t.iGive.map((id) => el('img', { class: 'pixel', src: thumb(id), alt: ITEMS[id].name })), el('span', {}, '⇄'),
          t.iGet.length ? t.iGet.map((id) => el('img', { class: 'pixel', src: thumb(id), alt: ITEMS[id].name })) : el('small', {}, '선물')),
        el('div', { class: 'meta' }, '친구가 확인하기를 기다리는 중…'))))) : null,
    el('button', { class: 'btn small primary trade-new', onclick: onCompose }, '거래 제안하기'));
}

// 거래 만들기: 내가 줄 것 / 받고 싶은 것 고르기
export async function openComposer(friend, { api, post, thumb, onSent }) {
  let opts;
  try { opts = await api(`/trades/options/${friend.id}`); } catch (err) { toast(err.message, 'bad'); return; }
  const give = new Set(); const ask = new Set();
  const body = el('div', { class: 'trade-compose' });
  const summary = el('div', { class: 'trade-summary' });
  const render = () => {
    const mineOK = opts.mine.filter((s) => !s.why);
    const mineNo = opts.mine.filter((s) => s.why && s.why !== 'basic');
    const pick = (set, id) => () => {
      if (set.has(id)) set.delete(id);
      else if (set.size >= TRADE.maxItems) return toast(`한 번에 ${TRADE.maxItems}개까지 골라요.`);
      else set.add(id);
      sfx.tap(); render();
    };
    body.replaceChildren(
      el('div', { class: 'section-title' }, `내가 줄 것 (${give.size}/${TRADE.maxItems})`),
      mineOK.length || mineNo.length ? el('div', { class: 'trade-grid' },
        mineOK.map((s) => itemTile(s.id, thumb, { selected: give.has(s.id), onClick: pick(give, s.id) })),
        mineNo.map((s) => itemTile(s.id, thumb, { disabled: true, why: s.why })))
        : el('p', { class: 'help' }, '줄 수 있는 아이템이 없어요. 캡슐 뽑기나 상점에서 모아 보세요!'),
      el('div', { class: 'section-title' }, `${friend.nickname}에게 받고 싶은 것 (${ask.size}/${TRADE.maxItems})`),
      opts.theirs.length ? el('div', { class: 'trade-grid' }, opts.theirs.map((id) => itemTile(id, thumb, { selected: ask.has(id), onClick: pick(ask, id) })))
        : el('p', { class: 'help' }, `${friend.nickname}에게 내가 없는 아이템이 없어요. 선물만 보낼 수 있어요!`));
    summary.replaceChildren(give.size || ask.size
      ? el('p', {}, `내가 ${give.size}개 주고, ${ask.size ? `${ask.size}개 받아요` : '선물로 보내요'}`)
      : el('p', { class: 'help' }, '줄 아이템을 골라 주세요.'));
  };
  render();
  const { close } = modal({
    title: `${friend.nickname}와(과) 멍뭉거래`,
    className: 'trade-modal',
    body: el('div', {}, body, summary, el('p', { class: 'hint' }, '받은 아이템은 하루 동안 다시 거래할 수 없어요. 코인은 거래할 수 없어요.')),
    buttons: [
      { label: '그만두기', kind: 'secondary' },
      {
        label: '제안 보내기',
        onClick: async () => {
          if (!give.size) { toast('줄 아이템을 하나 이상 골라 주세요.'); return false; }
          const send = async () => {
            try {
              await post('/trades', { to: friend.id, give: [...give], ask: [...ask] });
              sfx.pop();
              toast(`${friend.nickname}에게 거래 제안을 보냈어요!`, 'good');
              close();
              onSent?.();
            } catch (err) { toast(err.message, 'bad'); }
          };
          if (unfairLocal([...give], [...ask])) {
            modal({
              title: '정말 괜찮아요?',
              body: el('p', { class: 'center' }, '받는 것보다 주는 게 훨씬 많아요. 그래도 보낼까요?'),
              buttons: [{ label: '다시 고를래요', kind: 'secondary' }, { label: '괜찮아요, 보낼래요', onClick: send }],
            });
          } else await send();
          return false;
        },
      },
    ],
  });
}

function unfairLocal(give, ask) {
  const v = (ids) => ids.reduce((a, id) => a + (TRADE.value[ITEMS[id]?.rarity] ?? 1), 0);
  return v(give) >= Math.max(1, v(ask)) * TRADE.unfairRatio;
}

// 받은 제안 확인: 3초 뒤에 수락 버튼이 켜져요 (실수로 누르지 않게)
export function openReview(t, { post, thumb, onDone }) {
  const acceptBtn = el('button', { class: 'btn primary', disabled: true }, '3');
  let left = 3;
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) { clearInterval(timer); acceptBtn.disabled = false; acceptBtn.textContent = '바꿀래요!'; } else acceptBtn.textContent = String(left);
  }, 1000);
  const answer = async (accept) => {
    clearInterval(timer);
    try {
      const res = await post(`/trades/${t.id}/respond`, { accept });
      close();
      if (accept) { sfx.levelUp(); toast(`${t.with.nickname}와(과) 거래 완료! 꾸미기에서 써 보세요.`, 'good'); } else toast('거래를 거절했어요.');
      onDone?.(res);
    } catch (err) { toast(err.message, 'bad'); }
  };
  acceptBtn.addEventListener('click', () => answer(true));
  const { close } = modal({
    title: `${t.with.nickname}의 거래 제안`,
    className: 'trade-modal',
    dismissable: false,
    body: el('div', {},
      el('div', { class: 'section-title' }, '내가 받는 것'), itemsRow(t.iGet, thumb),
      el('div', { class: 'section-title' }, '내가 주는 것'), itemsRow(t.iGive, thumb),
      t.unfair ? el('p', { class: 'trade-warn' }, t.giveMore ? '⚠️ 받는 것보다 주는 게 훨씬 많아요. 정말 괜찮은지 생각해 봐요!' : '🎁 받는 게 훨씬 많아요! 친구에게 고맙다고 말해요.') : null,
      el('p', { class: 'hint' }, '바꾸면 되돌릴 수 없어요. 받은 아이템은 하루 동안 다시 거래할 수 없어요.'),
      el('div', { class: 'modal-buttons' },
        el('button', { class: 'btn secondary', onclick: () => answer(false) }, '거절'),
        el('button', { class: 'btn ghost', onclick: () => { clearInterval(timer); close(); } }, '나중에'),
        acceptBtn)),
    buttons: [],
  });
}

export function openHistory(list, thumb) {
  const label = { accepted: '거래 완료', declined: '거절됨', cancelled: '취소됨', expired: '시간 지남' };
  modal({
    title: '멍뭉거래 기록 (7일)',
    body: list.length ? el('div', { class: 'cards' }, list.map((t) => el('div', { class: 'card trade-card' },
      el('div', { class: 'title' }, `${t.with.nickname}와(과)`, el('span', { class: `chip st-${t.status}` }, label[t.status] ?? t.status)),
      el('div', { class: 'trade-mini' },
        el('small', {}, '준 것'), t.iGive.map((id) => el('img', { class: 'pixel', src: thumb(id), alt: ITEMS[id]?.name ?? '' })),
        el('small', {}, '받은 것'), t.iGet.map((id) => el('img', { class: 'pixel', src: thumb(id), alt: ITEMS[id]?.name ?? '' }))))))
      : el('p', { class: 'help center' }, '아직 거래 기록이 없어요.'),
    buttons: [{ label: '닫기' }],
  });
}
