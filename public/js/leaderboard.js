// 이번 주 랭킹 화면: 놀이별 친구/전체 순위
import { LEADERBOARD } from '../shared/data.js';
import { el, modal, toast } from './ui.js';
import { dogPortrait } from './sprites.js';
import { breedOf } from '../shared/rules.js';
import { sfx } from './audio.js';

const MEDAL = ['🥇', '🥈', '🥉'];
const view = { game: 'run', scope: 'friends' };

function left(endsAt, now) {
  const h = Math.max(0, Math.ceil((endsAt - now) / 3600_000));
  return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간` : `${h}시간`;
}

function entryRow(e, unit) {
  const d = e.dog && breedOf(e.dog.breed) ? e.dog : null;
  return el('li', { class: `lb-row ${e.me ? 'me' : ''} ${e.rank <= 3 ? `top top${e.rank}` : ''}` },
    el('span', { class: 'lb-rank' }, MEDAL[e.rank - 1] ?? String(e.rank)),
    d ? el('img', { class: 'pixel', src: dogPortrait(d.breed, d.stage ?? 0, { equip: d.equip ?? undefined }), alt: '' }) : el('span', { class: 'lb-noimg' }),
    el('span', { class: 'lb-name' }, el('b', {}, e.nickname), d ? el('small', {}, d.name) : null),
    el('span', { class: 'lb-score' }, `${e.score}${unit}`));
}

export async function openLeaderboard({ api, now }) {
  const body = el('div', { class: 'lb' });
  const render = async () => {
    let b;
    try { b = await api(`/leaderboard?game=${view.game}&scope=${view.scope}`); } catch (err) { toast(err.message, 'bad'); return; }
    const g = LEADERBOARD.games[view.game];
    body.replaceChildren(
      el('div', { class: 'segmented' }, Object.entries(LEADERBOARD.games).map(([k, v]) => el('button', {
        class: view.game === k ? 'on' : '', onclick: () => { view.game = k; sfx.tap(); render(); },
      }, v.name))),
      el('div', { class: 'segmented small' }, [['friends', '친구 랭킹'], ['all', '전체 랭킹']].map(([k, label]) => el('button', {
        class: view.scope === k ? 'on' : '', onclick: () => { view.scope = k; sfx.tap(); render(); },
      }, label))),
      el('p', { class: 'hint center' }, g.desc),
      b.entries.length
        ? el('ol', { class: 'lb-list' }, b.entries.map((e) => entryRow(e, g.unit)))
        : el('p', { class: 'help center' }, view.scope === 'friends' ? '이번 주에는 아직 기록이 없어요. 제일 먼저 기록을 세워 봐요!' : '아직 아무도 기록이 없어요. 1등 기회!'),
      el('div', { class: 'lb-mine' }, b.mine
        ? `내 기록 ${b.mine.score}${g.unit} · 전체 ${b.mine.rank}등`
        : '이번 주 내 기록이 아직 없어요.'),
      el('p', { class: 'hint center' }, `월요일에 새로 시작해요 (${left(b.endsAt, now())} 남음) · 전체 1~3등은 뼈다귀 코인 ${LEADERBOARD.rewards.join('/')}개 선물!`));
  };
  modal({ title: '🏆 이번 주 랭킹', className: 'lb-modal', body, buttons: [{ label: '닫기' }] });
  await render();
}

// 놀이가 끝난 뒤 기록 알림
export function lbToast(lb) {
  if (!lb?.newBest) return;
  const name = LEADERBOARD.games[lb.game]?.name ?? '';
  toast(lb.rank && lb.rank <= 3
    ? `🏆 ${name} 이번 주 최고 기록! 전체 ${lb.rank}등이에요!`
    : `✨ ${name} 이번 주 최고 기록 ${lb.best}${LEADERBOARD.games[lb.game]?.unit ?? ''}!${lb.rank ? ` (전체 ${lb.rank}등)` : ''}`, 'good');
}
