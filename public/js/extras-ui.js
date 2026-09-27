// ♨️ 온천 · 🏕️ 꿈 엿보기(꿈 앨범) · 📰 멍뭉 뉴스 화면
import { DREAMS, SPA } from '../shared/data.js';
import { dogPortrait } from './sprites.js';
import { el, modal, toast } from './ui.js';
import { sfx } from './audio.js';

export function openSpa(ctx) {
  const { me, post, applyMe, handleEvents } = ctx;
  const dog = me().dog;
  const done = () => me().spaToday;
  const img = el('img', { class: 'pixel spa-dog', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'closed', mouth: 'closed' }), alt: '' });
  const msg = el('p', { class: 'center' }, done() ? '오늘은 벌써 온천에 다녀왔어요. 내일 또 와요!' : '따끈따끈한 온천에 들어가 볼까요?');
  const btn = el('button', { class: 'btn primary spa-btn', disabled: done() }, '♨️ 풍덩! 온천하기');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await post('/spa/bathe');
      applyMe(res);
      sfx.whoosh(); setTimeout(sfx.love, 400);
      img.src = dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy', mouth: 'tongue', fluff: SPA.fluff });
      img.classList.add('bath');
      msg.textContent = `아~ 개운해! 청결 가득 · 애정 +${SPA.affection} · 뽀송뽀송 ✨`;
      await handleEvents(res.events);
    } catch (err) { toast(err.message, 'bad'); }
  });
  modal({
    title: '♨️ 멍뭉 온천',
    className: 'spa-modal',
    body: el('div', {},
      el('div', { class: 'spa-pool' }, el('span', { class: 'steam s1' }, '♨️'), el('span', { class: 'steam s2' }, '💨'), el('span', { class: 'steam s3' }, '♨️'), img, el('div', { class: 'water' })),
      msg, btn,
      el('p', { class: 'hint' }, '하루 한 번 들어갈 수 있어요. 온천을 하면 한동안 털이 뽀송뽀송해요.')),
    buttons: [{ label: '나가기', kind: 'secondary' }],
  });
}

const dreamTitle = (id, dogName) => DREAMS[id].title.replaceAll('{name}', dogName).replaceAll('{fdog}', '친구');

export function openCamp(ctx) {
  const { me, post, applyMe, handleEvents } = ctx;
  const dog = me().dog;
  const reveal = el('div', { class: 'dream-reveal' });
  const album = el('div', {});
  const renderAlbum = () => {
    const seen = me().dreams?.seen ?? [];
    album.replaceChildren(
      el('div', { class: 'section-title' }, `🌙 꿈 앨범 (${seen.length}/${Object.keys(DREAMS).length})`),
      el('div', { class: 'dream-album' }, Object.entries(DREAMS).map(([id, D]) => el('div', { class: `dream-cell ${seen.includes(id) ? 'seen' : ''}` },
        el('span', { class: 'scene' }, seen.includes(id) ? D.scene : '💤'),
        el('small', {}, seen.includes(id) ? dreamTitle(id, dog.name) : '???')))));
  };
  const btn = el('button', { class: 'btn primary', disabled: !!me().dreams?.today }, me().dreams?.today ? '오늘 꿈은 봤어요. 내일 밤에 또!' : '💭 살짝 꿈 엿보기');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const res = await post('/camp/dream');
      applyMe(res);
      const d = res.dream;
      sfx.star();
      reveal.replaceChildren(el('div', { class: 'dream-card' },
        d.first ? el('span', { class: 'new' }, 'NEW') : null,
        el('div', { class: 'scene' }, d.scene),
        d.friendDog ? el('img', { class: 'pixel', src: dogPortrait(d.friendDog.breed, d.friendDog.stage, { equip: d.friendDog.equip, eyes: 'happy' }), alt: '' }) : null,
        el('b', {}, d.title),
        el('p', {}, d.text),
        d.coins || d.hearts ? el('small', {}, `꿈에서 받은 선물: ${d.coins ? `🦴 ${d.coins} ` : ''}${d.hearts ? `💗 ${d.hearts}` : ''}`) : null));
      btn.textContent = '오늘 꿈은 봤어요. 내일 밤에 또!';
      renderAlbum();
      await handleEvents(res.events);
    } catch (err) { toast(err.message, 'bad'); btn.disabled = false; }
  });
  renderAlbum();
  modal({
    title: '🏕️ 캠핑장',
    className: 'camp-modal',
    body: el('div', {},
      el('div', { class: 'camp-night' },
        el('span', { class: 'tent' }, '⛺'), el('span', { class: 'fire' }, '🔥'),
        el('img', { class: 'pixel camp-dog', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'closed' }, 'lie'), alt: '' }),
        el('span', { class: 'zzz' }, 'Zzz')),
      btn, reveal, album),
    buttons: [{ label: '나가기', kind: 'secondary' }],
  });
}

// 📰 우리집 화면의 뉴스 한 줄 (몇 초마다 바뀌어요)
export function newsTicker(news) {
  const items = [...(news?.friends ?? []).map((n) => n.text), news?.fun].filter(Boolean);
  if (!items.length) return null;
  let i = 0;
  const line = el('span', { class: 'news-line' }, items[0]);
  const node = el('button', {
    class: 'news-ticker', type: 'button',
    onclick: () => modal({
      title: '📰 멍뭉 뉴스',
      body: el('div', { class: 'news-list' }, items.map((t) => el('p', {}, t)), el('p', { class: 'hint' }, '친구들의 자랑 소식이 여기에 나와요. (친구만 볼 수 있어요)')),
      buttons: [{ label: '닫기' }],
    }),
  }, el('b', {}, '📰 뉴스'), line);
  if (items.length > 1) {
    const t = setInterval(() => {
      if (!document.body.contains(node)) { clearInterval(t); return; }
      i = (i + 1) % items.length;
      line.classList.remove('slide'); void line.offsetWidth; line.classList.add('slide');
      line.textContent = items[i];
    }, 5000);
  }
  return node;
}
