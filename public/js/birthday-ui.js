// 🎂 강아지 생일 (정하기 · 촛불 끄기 파티 · 별자리) · 📅 멍뭉달력
import { BIRTHDAY, ITEMS } from '../shared/data.js';
import { zodiacOf, birthFlower, validMMDD } from '../shared/rules.js';
import { dogPortrait, accessoryURL, iconURL } from './sprites.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';

const pad = (n) => String(n).padStart(2, '0');
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const mmddText = (mmdd) => (validMMDD(mmdd) ? `${Number(mmdd.slice(0, 2))}월 ${Number(mmdd.slice(3))}일` : '');
export const kstToday = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

// "🎂 9월 29일 · ⚖️ 천칭자리 · 🌸 코스모스"
export function birthdayLine(mmdd) {
  const z = zodiacOf(mmdd);
  if (!z) return null;
  return `🎂 ${mmddText(mmdd)} · ${z.emoji} ${z.name} · 🌸 ${birthFlower(mmdd)}`;
}

// 월/일 고르기 (+ 고른 날의 별자리 미리보기)
export function datePicker(initial, onChange) {
  let [m, d] = (validMMDD(initial) ? initial : kstToday().slice(5)).split('-').map(Number);
  const month = el('select', { class: 'bday-select', 'aria-label': '월' });
  const day = el('select', { class: 'bday-select', 'aria-label': '일' });
  const preview = el('div', { class: 'bday-preview' });
  const fillDays = () => {
    day.replaceChildren(...Array.from({ length: MONTH_DAYS[m - 1] }, (_, i) => el('option', { value: String(i + 1) }, `${i + 1}일`)));
    if (d > MONTH_DAYS[m - 1]) d = MONTH_DAYS[m - 1];
    day.value = String(d);
  };
  const update = () => {
    const mmdd = `${pad(m)}-${pad(d)}`;
    const z = zodiacOf(mmdd);
    preview.replaceChildren(el('span', { class: 'z' }, `${z.emoji} ${z.name}`), el('small', {}, `${z.trait} · 탄생화 🌸 ${birthFlower(mmdd)}`));
    onChange?.(mmdd);
  };
  month.replaceChildren(...Array.from({ length: 12 }, (_, i) => el('option', { value: String(i + 1) }, `${i + 1}월`)));
  month.value = String(m);
  month.addEventListener('change', () => { m = Number(month.value); fillDays(); update(); });
  day.addEventListener('change', () => { d = Number(day.value); update(); });
  fillDays();
  const node = el('div', { class: 'bday-picker' }, el('div', { class: 'bday-row' }, month, day), preview);
  update();
  return { node, value: () => `${pad(m)}-${pad(d)}` };
}

// 생일 정하기 창 (기존 강아지 · 생일 바꾸기)
export function askBirthday(dog, { post, onDone, later = true }) {
  const adopt = dog.bornAt ? kstToday(dog.bornAt).slice(5) : kstToday().slice(5);
  const picker = datePicker(dog.birthday ?? adopt);
  const save = async (date) => {
    try {
      const res = await post('/dog/birthday', { dogId: dog.id, date });
      sfx.levelUp();
      toast(`🎂 ${dog.name}의 생일은 ${mmddText(res.birthday.date)}! ${res.birthday.zodiac.emoji} ${res.birthday.zodiac.name}이에요.`, 'good');
      await onDone?.(res);
    } catch (err) { sfx.error(); toast(err.message, 'bad'); return false; }
    return true;
  };
  modal({
    title: `🎂 ${dog.name}의 생일은 언제일까요?`,
    className: 'bday-modal',
    dismissable: false,
    body: el('div', { class: 'center' },
      el('img', { class: 'pixel bday-dog', src: dogPortrait(dog.breed, dog.stage, { equip: { ...(dog.equip ?? {}), head: 'bd_party_hat' }, eyes: 'happy' }), alt: '' }),
      el('p', {}, '생일이 되면 친구들이 축하하러 오고, 선물도 받아요! 🎁'),
      picker.node,
      el('button', { class: 'btn secondary small bday-adopt', type: 'button', onclick: async (e) => { e.target.disabled = true; if (await save('adopt')) e.target.closest('.modal-wrap')?.remove(); else e.target.disabled = false; } },
        `처음 만난 날(${mmddText(adopt)})로 할래요`),
      el('p', { class: 'hint' }, `생일은 한 번 정하면 ${BIRTHDAY.changeDays}일 동안 바꿀 수 없어요.`)),
    buttons: [
      ...(later ? [{ label: '나중에', kind: 'secondary' }] : []),
      { label: '이 날로 할래요!', onClick: () => save(picker.value()) },
    ],
  });
}

// 🎂 생일 파티: 촛불 끄기 → 소원 빌기 → 선물
export function birthdayParty(ev, dog, { post }) {
  return new Promise((resolve) => {
    const candles = Math.min(5, Math.max(1, ev.count));
    let lit = candles;
    const cake = el('div', { class: 'bday-cake' },
      el('div', { class: 'candles' }, Array.from({ length: candles }, () => {
        const c = el('button', { type: 'button', class: 'candle', 'aria-label': '촛불' }, el('span', { class: 'flame' }));
        c.addEventListener('click', () => {
          if (c.classList.contains('out')) return;
          c.classList.add('out'); sfx.whoosh();
          lit -= 1;
          if (lit === 0) setTimeout(showWish, 500);
        });
        return c;
      })),
      el('div', { class: 'cake-top' }), el('div', { class: 'cake-body' }, `${ev.count}`));
    const stage = el('div', { class: 'bday-stage' });
    const z = ev.zodiac;
    const intro = () => stage.replaceChildren(
      el('img', { class: 'pixel bday-dog', src: dogPortrait(dog.breed, dog.stage, { equip: { ...(dog.equip ?? {}), head: 'bd_party_hat' }, eyes: 'happy', mouth: 'open' }), alt: '' }),
      el('p', { class: 'big' }, `오늘은 ${ev.dogName}의 ${ev.count}번째 생일!`),
      cake,
      el('p', { class: 'hint' }, '촛불을 톡톡 눌러서 꺼 주세요! 🕯️'));
    const showWish = () => {
      sfx.levelUp();
      const picks = [...BIRTHDAY.wishes].sort(() => Math.random() - 0.5).slice(0, 3);
      stage.replaceChildren(
        el('p', { class: 'big' }, '🌠 소원을 빌어요!'),
        el('div', { class: 'bday-wishes' }, picks.map((w) => el('button', {
          type: 'button', class: 'btn secondary',
          onclick: async () => {
            sfx.star();
            post('/diary/note', { day: kstToday(), emoji: '🌠', text: `${ev.dogName}의 생일 소원: ${w}` }).catch(() => {});
            showGifts(w);
          },
        }, w))));
    };
    const showGifts = (wish) => {
      sfx.coin();
      stage.replaceChildren(
        el('p', { class: 'big' }, '🎁 생일 선물이 도착했어요!'),
        el('p', { class: 'hint' }, `"${wish}" 꼭 이루어질 거예요!`),
        el('div', { class: 'reward-chips bday-gifts' },
          el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '' }), `코인 ${ev.coins}`),
          el('span', { class: 'reward-chip' }, `💗 ${ev.hearts}`),
          el('span', { class: 'reward-chip' }, `🍰 ${ev.treatName ?? '케이크'}`),
          ev.item ? el('span', { class: 'reward-chip' }, el('img', { class: 'pixel', src: accessoryURL(ev.item, 2), alt: '' }), ITEMS[ev.item]?.name) : null),
        z ? el('div', { class: 'bday-zodiac' }, el('b', {}, `${z.emoji} ${z.name}`), el('small', {}, `${z.trait} · 탄생화 🌸 ${ev.flower}`)) : null,
        el('p', { class: 'hint' }, ev.friends ? `친구 ${ev.friends}명에게 생일 초대장을 보냈어요. 친구들이 축하하러 올 거예요! 🎈` : '친구를 사귀면 친구들도 생일을 축하해 줘요!'));
    };
    intro();
    modal({ title: '🎉 해피 버스데이!', className: 'celebrate bday-modal', body: stage, dismissable: false, buttons: [{ label: '고마워!', onClick: () => resolve() }] });
  });
}

// ---------- 📅 멍뭉달력 ----------
const NOTE_EMOJIS = ['📝', '😊', '🥰', '😢', '🌈', '⭐', '🐾', '🍰', '🎈', '🌙'];

export async function calendarPanel({ api, post, state, rerender }) {
  const month = state.calMonth ?? kstToday().slice(0, 7);
  const data = await api(`/diary?month=${month}`);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = new Map();
  const add = (day, x) => { if (!byDay.has(day)) byDay.set(day, []); byDay.get(day).push(x); };
  for (const e of data.entries) add(e.day, e);
  for (const b of data.birthdays) add(b.day, { bday: true, emoji: b.mine ? '🎂' : '🎁', title: b.mine ? `${b.name}의 생일` : `${b.owner}네 ${b.name} 생일` });
  const shift = (d) => { const t = new Date(Date.UTC(y, m - 1 + d, 1)); state.calMonth = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`; sfx.tap(); rerender(); };
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(el('div', { class: 'cal-cell empty' }));
  for (let d = 1; d <= days; d++) {
    const key = `${month}-${pad(d)}`;
    const list = byDay.get(key) ?? [];
    const icons = [...list.filter((x) => x.bday), ...list.filter((x) => !x.bday)].slice(0, 2).map((x) => x.emoji).join('');
    cells.push(el('button', {
      type: 'button', class: `cal-cell ${key === data.today ? 'today' : ''} ${list.length ? 'has' : ''} ${key > data.today ? 'future' : ''}`,
      onclick: () => openDay(key, list, { post, today: data.today, rerender }),
    }, el('span', { class: 'n' }, String(d)), el('span', { class: 'ic' }, icons), list.length > 2 ? el('small', {}, `+${list.length - 2}`) : null));
  }
  const recent = [...data.entries].reverse().slice(0, 12);
  return el('div', { class: 'calendar' },
    el('div', { class: 'cal-head' },
      el('button', { class: 'btn small', type: 'button', 'aria-label': '지난달', onclick: () => shift(-1) }, '◀'),
      el('b', {}, `${y}년 ${m}월`),
      el('button', { class: 'btn small', type: 'button', 'aria-label': '다음 달', onclick: () => shift(1) }, '▶')),
    el('div', { class: 'cal-grid week' }, ['일', '월', '화', '수', '목', '금', '토'].map((w) => el('div', { class: 'cal-w' }, w))),
    el('div', { class: 'cal-grid' }, cells),
    el('p', { class: 'hint' }, '처음 만난 날, 친구가 된 날, 처음 해 본 일들이 저절로 적혀요. 날짜를 눌러 한마디를 남겨 보세요!'),
    el('div', { class: 'section-title' }, `이번 달 추억 ${data.entries.length}개`),
    recent.length ? el('div', { class: 'cal-list' }, recent.map((e) => el('button', { type: 'button', class: 'cal-item', onclick: () => openDay(e.day, byDay.get(e.day) ?? [e], { post, today: data.today, rerender }) },
      el('span', { class: 'emo' }, e.emoji), el('span', { class: 'txt' }, el('b', {}, e.title), e.comment ? el('small', {}, `💬 ${e.comment}`) : null), el('small', { class: 'd' }, `${Number(e.day.slice(8))}일`))))
      : el('p', { class: 'help center' }, '이번 달은 아직 기록이 없어요.'));
}

function openDay(day, list, { post, today, rerender }) {
  const [, m, d] = day.split('-').map(Number);
  let emoji = NOTE_EMOJIS[0];
  const input = el('input', { class: 'chat-input', maxlength: 60, placeholder: '오늘의 한마디 (60자)', 'aria-label': '한마디' });
  const emojiRow = el('div', { class: 'cal-emojis' });
  const renderEmojis = () => emojiRow.replaceChildren(...NOTE_EMOJIS.map((e) => el('button', { type: 'button', class: `emo ${emoji === e ? 'on' : ''}`, onclick: () => { emoji = e; renderEmojis(); } }, e)));
  renderEmojis();
  const entryNode = (e) => {
    if (e.bday) return el('div', { class: 'cal-entry bday' }, el('span', { class: 'emo' }, e.emoji), el('b', {}, e.title));
    const c = el('input', { class: 'chat-input small', maxlength: 60, placeholder: '💬 한마디 남기기', value: e.comment ?? '', 'aria-label': '한마디' });
    return el('div', { class: 'cal-entry' },
      el('div', { class: 'row' }, el('span', { class: 'emo' }, e.emoji), el('b', {}, e.title),
        e.note ? el('button', { class: 'link', type: 'button', onclick: async () => { try { await post('/diary/delete', { id: e.id }); box.close(); rerender(); } catch (err) { toast(err.message, 'bad'); } } }, '지우기') : null),
      e.note ? null : el('div', { class: 'row' }, c, el('button', {
        class: 'btn small', type: 'button',
        onclick: async () => { try { await post('/diary/comment', { id: e.id, text: c.value }); e.comment = c.value; sfx.pop(); toast('한마디를 남겼어요!', 'good'); rerender(); } catch (err) { toast(err.message, 'bad'); } },
      }, '저장')));
  };
  const canWrite = day <= today;
  const box = modal({
    title: `📅 ${m}월 ${d}일`,
    className: 'cal-day',
    body: el('div', {},
      list.length ? el('div', { class: 'cal-entries' }, list.map(entryNode)) : el('p', { class: 'help center' }, '이날은 아직 기록이 없어요.'),
      canWrite ? el('div', { class: 'cal-add' }, el('div', { class: 'section-title' }, '✏️ 내 메모 남기기'), emojiRow, input) : el('p', { class: 'hint center' }, '아직 오지 않은 날이에요.')),
    buttons: canWrite ? [
      { label: '닫기', kind: 'secondary' },
      {
        label: '메모 남기기',
        onClick: async () => {
          if (!input.value.trim()) { toast('한마디를 적어 주세요.'); return false; }
          try { await post('/diary/note', { day, emoji, text: input.value }); sfx.pop(); rerender(); } catch (err) { toast(err.message, 'bad'); return false; }
          return true;
        },
      },
    ] : [{ label: '닫기' }],
  });
}
