// 📔 멍뭉 일기장: 오늘의 일기 쓰기 · 내 일기 · 친구 일기(공개한 것만, 반응 스티커)
import { JOURNAL } from '../shared/data.js';
import { dogPortrait } from './sprites.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';

const REPORTS = [['diary_bad', '나쁜 말이 있어요'], ['diary_private', '비밀 정보가 적혀 있어요']];
const fmtDay = (day) => { const [, m, d] = day.split('-').map(Number); return `${m}월 ${d}일`; };
const moodName = (m) => JOURNAL.moods.find(([e]) => e === m)?.[1] ?? '';

// 일기 쓰기 / 고치기
export function openJournalEditor({ post, dog, entry = null, onSaved }) {
  let weather = entry?.weather ?? JOURNAL.weathers[0];
  let mood = entry?.mood ?? JOURNAL.moods[0][0];
  let isPublic = entry?.public ?? false;
  const prompt = JOURNAL.prompts[Math.floor(Math.random() * JOURNAL.prompts.length)].replaceAll('{dog}', dog?.name ?? '강아지');
  const title = el('input', { class: 'chat-input', maxlength: JOURNAL.titleMax, placeholder: '제목 (예: 공원 산책)', value: entry?.title ?? '', 'aria-label': '제목' });
  const body = el('textarea', { class: 'journal-text', maxlength: JOURNAL.bodyMax, rows: 6, placeholder: prompt, 'aria-label': '일기 내용' });
  body.value = entry?.body ?? '';
  const count = el('small', { class: 'journal-count' });
  const upd = () => { count.textContent = `${body.value.length} / ${JOURNAL.bodyMax}`; };
  body.addEventListener('input', upd); upd();
  const pickRow = el('div', {});
  const render = () => pickRow.replaceChildren(
    el('div', { class: 'journal-pick' }, el('span', {}, '날씨'), ...JOURNAL.weathers.map((w) => el('button', { type: 'button', class: `emo ${weather === w ? 'on' : ''}`, 'aria-label': w, onclick: () => { weather = w; sfx.tap(); render(); } }, w))),
    el('div', { class: 'journal-pick' }, el('span', {}, '기분'), ...JOURNAL.moods.map(([m, n]) => el('button', { type: 'button', class: `emo ${mood === m ? 'on' : ''}`, title: n, 'aria-label': n, onclick: () => { mood = m; sfx.tap(); render(); } }, m))),
    el('div', { class: 'segmented small journal-vis' },
      el('button', { type: 'button', class: isPublic ? '' : 'on', onclick: () => { isPublic = false; sfx.tap(); render(); } }, '🔒 나만 보기'),
      el('button', { type: 'button', class: isPublic ? 'on' : '', onclick: () => { isPublic = true; sfx.tap(); render(); } }, '👫 친구에게 공개')),
    el('p', { class: 'hint' }, isPublic ? '내 친구들만 볼 수 있어요. 친구들이 반응 스티커를 남겨 줄 거예요!' : '나만 볼 수 있는 비밀 일기예요.'));
  render();
  modal({
    title: entry ? '📔 일기 고치기' : '📔 오늘의 일기',
    className: 'journal-modal',
    dismissable: false,
    body: el('div', {},
      dog ? el('div', { class: 'journal-dog' }, el('img', { class: 'pixel', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy' }), alt: '' }), el('span', {}, `💭 ${prompt}`)) : null,
      pickRow, title, body, count,
      el('p', { class: 'hint' }, '전화번호·주소 같은 비밀 정보와 나쁜 말은 쓸 수 없어요.')),
    buttons: [
      { label: '취소', kind: 'secondary' },
      {
        label: entry ? '고치기' : '다 썼어요!',
        onClick: async () => {
          try {
            const res = await post('/journal', { weather, mood, title: title.value, body: body.value, isPublic });
            sfx.levelUp();
            const r = res.result;
            toast(r.reward ? `📔 오늘의 일기 완성! 코인 +${r.reward.coins} · 💗+${r.reward.hearts} · 🔥 ${r.streak}일째` : '📔 일기를 고쳤어요!', 'good');
            await onSaved?.(res);
            return true;
          } catch (err) { sfx.error(); toast(err.message, 'bad'); return false; }
        },
      },
    ],
  });
}

function entryCard(e, { mine, post, rerender, onEdit }) {
  const reactBar = el('div', { class: 'journal-reacts' }, JOURNAL.reactions.map((emo) => el('button', {
    type: 'button', class: `react ${e.myReaction === emo ? 'on' : ''}`, disabled: mine, 'aria-label': `${emo} 반응`,
    onclick: async () => {
      try { const v = await post(`/journal/${e.id}/react`, { emoji: emo }); Object.assign(e, v); sfx.pop(); card.replaceWith(entryCard(e, { mine, post, rerender, onEdit })); } catch (err) { toast(err.message, 'bad'); }
    },
  }, emo, e.reactions[emo] ? el('small', {}, String(e.reactions[emo])) : null)));
  const card = el('div', { class: `journal-card ${e.hidden ? 'hidden-entry' : ''}` },
    el('div', { class: 'journal-head' },
      e.dog?.breed ? el('img', { class: 'pixel', src: dogPortrait(e.dog.breed, e.dog.stage ?? 0, { equip: e.dog.equip ?? {}, eyes: 'happy' }), alt: '' }) : null,
      el('div', { class: 'jh-who' },
        el('b', {}, e.title),
        el('small', {}, `${mine ? '' : `${e.owner}네 ${e.dog?.name ?? ''} · `}${fmtDay(e.day)} ${e.weather} ${e.mood} ${moodName(e.mood)}`)),
      mine ? el('span', { class: 'chip' }, e.public ? '👫 공개' : '🔒 나만') : null),
    el('p', { class: 'journal-body' }, e.body),
    e.hidden && mine ? el('p', { class: 'hint' }, '친구들의 신고로 지금은 친구에게 보이지 않아요.') : null,
    reactBar,
    el('div', { class: 'journal-actions' },
      mine && onEdit ? el('button', { class: 'link', type: 'button', onclick: onEdit }, '고치기') : null,
      mine ? el('button', {
        class: 'link', type: 'button',
        onclick: () => modal({
          title: '일기를 지울까요?', body: el('p', { class: 'center' }, '지운 일기는 다시 볼 수 없어요.'),
          buttons: [{ label: '아니요', kind: 'secondary' }, { label: '지울래요', onClick: async () => { try { await post(`/journal/${e.id}/delete`); rerender(); } catch (err) { toast(err.message, 'bad'); } } }],
        }),
      }, '지우기') : el('button', {
        class: 'link', type: 'button',
        onclick: () => modal({
          title: '이 일기를 신고할까요?',
          body: el('p', { class: 'center' }, '신고하면 이 일기는 나에게 더 이상 보이지 않아요. 선생님(운영자)이 확인해요.'),
          buttons: [{ label: '취소', kind: 'secondary' }, ...REPORTS.map(([k, label]) => ({ label, onClick: async () => { try { await post(`/journal/${e.id}/report`, { reason: k }); toast('신고했어요. 알려 줘서 고마워요!'); rerender(); } catch (err) { toast(err.message, 'bad'); } } }))],
        }),
      }, '신고')));
  return card;
}

export async function journalPanel({ api, post, state, rerender, onSaved }) {
  const sub = state.journalTab ?? 'mine';
  const unread = state.me?.journal?.unread ?? 0;
  const tabs = el('div', { class: 'segmented small' },
    el('button', { class: sub === 'mine' ? 'on' : '', onclick: () => { state.journalTab = 'mine'; rerender(); } }, '📔 내 일기'),
    el('button', { class: sub === 'feed' ? 'on' : '', onclick: () => { state.journalTab = 'feed'; rerender(); } }, `👫 친구 일기${unread ? ` (${unread})` : ''}`));
  if (sub === 'feed') {
    const { entries } = await api('/journal/feed');
    if (state.me?.journal) state.me.journal.unread = 0;
    return el('div', { class: 'journal' }, tabs,
      entries.length ? el('div', { class: 'journal-list' }, entries.map((e) => entryCard(e, { mine: false, post, rerender })))
        : el('p', { class: 'help center' }, '아직 친구들이 공개한 일기가 없어요. 친구에게 일기를 써 보라고 해 봐요!'));
  }
  const data = await api('/journal');
  const dog = state.me?.dog;
  const todayEntry = data.written ? data.entries[0] : null;
  const edit = (entry) => openJournalEditor({ post, dog, entry, onSaved });
  return el('div', { class: 'journal' }, tabs,
    el('div', { class: `journal-today ${todayEntry ? 'done' : ''}` },
      el('div', {}, el('b', {}, todayEntry ? '✅ 오늘의 일기를 썼어요!' : '✏️ 오늘의 일기를 써 볼까요?'),
        el('small', {}, todayEntry ? `🔥 ${data.streak}일째 쓰는 중` : `처음 쓰면 코인 +${JOURNAL.coins} · 💗+${JOURNAL.hearts}${data.streak ? ` · 🔥 ${data.streak}일째 이어 쓰기` : ''}`)),
      el('button', { class: 'btn small primary', onclick: () => edit(todayEntry) }, todayEntry ? '고치기' : '쓰기')),
    data.entries.length ? el('div', { class: 'journal-list' }, data.entries.map((e) => entryCard(e, { mine: true, post, rerender, onEdit: e.day === data.today ? () => edit(e) : null })))
      : el('p', { class: 'help center' }, '아직 쓴 일기가 없어요. 오늘 있었던 일을 적어 봐요!'));
}
