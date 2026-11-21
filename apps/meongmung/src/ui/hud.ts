// 🧭 화면 위 메뉴 (HTML): 상단 프로필·재화, 왼쪽 빠른 아이콘, 게이지, 돌봄 버튼, 하단 메뉴, 올라오는 창
import { sfx, device, playBgm, getVolume, setVolume, unlockAudio, envAt } from '@platform';
import { bus } from '../bus';
import { getPet, care, tick, expForNext, QUESTS, type Care, type Stat } from '../state';
import { SHOP, CLOSET, GAMES, PLACES, DIARY } from './content';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | false)[]) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') n.className = String(v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(c));
  return n;
};
const $ = (s: string) => document.querySelector(s) as HTMLElement;

export const homeTrack = () => (envAt().night ? 'home_night' : 'home_day');

const STATS: [Stat, string, string][] = [['fullness', '🍖', '포만감'], ['cleanliness', '🫧', '청결도'], ['affection', '💗', '애정도']];
let prev: Record<string, number> = {};
let toastTimer = 0;

export function toast(msg: string) {
  const t = $('.toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 2200);
}

export function buildHud(root: HTMLElement) {
  const ring = `<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="#f3e3cf" stroke-width="5"/><circle id="lv-ring" cx="22" cy="22" r="19" fill="none" stroke="#f2a65a" stroke-width="5" stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="119.4"/></svg>`;
  const avatar = h('span', { class: 'avatar' });
  avatar.innerHTML = ring;
  avatar.append(h('img', { src: 'assets/art/corgi_adult_placeholder.png', alt: '' }));
  root.append(
    h('header', { class: 'top' },
      h('button', { class: 'profile puff', 'aria-label': '강아지 카드', onclick: () => openSheet('dog') }, avatar,
        h('span', { class: 'who' }, h('b', { id: 'pet-name' }), h('small', { id: 'pet-lv' }))),
      h('div', { class: 'right' },
        h('span', { class: 'pill puff', title: '뼈다귀 코인' }, h('span', { class: 'ic' }, '🦴'), h('span', { id: 'coins' })),
        h('span', { class: 'pill puff', title: '하트' }, h('span', { class: 'ic' }, '💗'), h('span', { id: 'hearts' })),
        h('button', { class: 'round puff', 'aria-label': '우편함', onclick: () => openSheet('mail') }, '✉️', h('i', { class: 'badge' }, '1')),
        h('button', { class: 'round puff', 'aria-label': '설정', onclick: () => openSheet('settings') }, '⚙️'))),
    h('aside', { class: 'quick' },
      h('button', { class: 'puff', onclick: () => openSheet('quests') }, '📋', h('span', {}, '할 일'), h('i', { class: 'badge', id: 'quest-badge' })),
      h('button', { class: 'puff', onclick: () => openSheet('event') }, '🎁', h('span', {}, '이벤트')),
      h('button', { class: 'puff', onclick: () => openSheet('shop') }, '🛒', h('span', {}, '상점'))),
    h('section', { class: 'dock' },
      h('div', { class: 'gauges' }, ...STATS.map(([k, ic, label]) => h('div', { class: `gauge puff ${k}`, 'aria-label': label },
        h('span', { class: 'ic' }, ic), h('div', { class: 'bar' }, h('i', { id: `bar-${k}` }))))),
      h('div', { class: 'care' },
        careBtn('feed', '🍖', '밥'), careBtn('brush', '🫧', '빗질'), careBtn('pet', '💕', '쓰담'),
        h('button', { class: 'puff play', onclick: () => openSheet('play') }, '⭐', h('small', {}, '놀기'))),
      h('nav', { class: 'tabs', 'aria-label': '메뉴' },
        tab('home', '🏠', '집'), tab('village', '🗺️', '마을'), tab('closet', '👗', '꾸미기'), tab('play', '🎮', '놀이'), tab('diary', '📔', '다이어리'))),
    h('div', { class: 'veil', hidden: true, onclick: closeSheet }),
    h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'grab' }),
      h('header', {}, h('h2', { id: 'sheet-title' }), h('button', { class: 'round puff', 'aria-label': '닫기', onclick: closeSheet }, '✕')),
      h('div', { class: 'body', id: 'sheet-body' })),
    h('div', { class: 'toast puff' }),
  );
  refresh();
  setInterval(refresh, 1000);
  bus.on('dog:tap', () => { /* 나중에: 강아지 카드 열기 등 */ });
}

function careBtn(kind: Care, icon: string, label: string) {
  return h('button', {
    class: `puff ${kind}`, 'aria-label': label,
    onclick: () => {
      unlockAudio();
      const result = care(kind);
      bus.emit('care', { kind, result });
      if (result.levelUp) setTimeout(() => { sfx.cheer(); device.haptic('big'); toast(`🎉 레벨 업! Lv ${getPet().level}`); }, 900);
      else if (result.quest) setTimeout(() => { sfx.cheer(); toast(`📋 할 일 완료! 코인 +5`); }, 900);
      refresh();
    },
  }, icon, h('small', {}, label));
}

function tab(id: string, icon: string, label: string) {
  return h('button', {
    'data-tab': id, class: id === 'home' ? 'on' : '',
    onclick: () => { unlockAudio(); sfx.tab(); device.haptic('tap'); if (id === 'home') closeSheet(); else openSheet(id); },
  }, icon, h('span', {}, label));
}

export function refresh() {
  const p = tick();
  $('#pet-name').textContent = p.name;
  $('#pet-lv').textContent = `Lv ${p.level}`;
  $('#coins').textContent = String(p.coins);
  $('#hearts').textContent = String(p.hearts);
  const ring = document.getElementById('lv-ring');
  ring?.setAttribute('stroke-dashoffset', String(119.4 * (1 - p.exp / expForNext(p.level))));
  for (const [k] of STATS) {
    const v = Math.round(p[k]);
    const bar = document.getElementById(`bar-${k}`)!;
    bar.style.width = `${v}%`;
    const g = bar.closest('.gauge')!;
    g.classList.toggle('low', v < 38);
    if (prev[k] !== undefined && v - prev[k] >= 3) { g.classList.remove('up'); void (g as HTMLElement).offsetWidth; g.classList.add('up'); }
    prev[k] = v;
  }
  const left = QUESTS.filter((q) => !p.quests[q.id]).length;
  const qb = $('#quest-badge');
  qb.textContent = String(left);
  qb.hidden = left === 0;
  bus.emit('needs', { fullness: p.fullness, cleanliness: p.cleanliness, affection: p.affection });
}

// ---------- 올라오는 창 ----------
const MUSIC: Record<string, string> = { village: 'village', play: 'minigame', closet: 'home_day', shop: 'home_day' };

function openSheet(id: string) {
  unlockAudio();
  const content = SHEETS[id]?.();
  if (!content) return;
  sfx.open();
  $('#sheet-title').textContent = content.title;
  $('#sheet-body').replaceChildren(content.body);
  const veil = $('.veil'); veil.hidden = false; requestAnimationFrame(() => veil.classList.add('open'));
  $('.sheet').classList.add('open');
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === (['village', 'closet', 'play', 'diary'].includes(id) ? id : 'home')));
  if (MUSIC[id]) void playBgm(MUSIC[id]);
}

function closeSheet() {
  if (!$('.sheet').classList.contains('open')) return;
  sfx.close();
  $('.sheet').classList.remove('open');
  const veil = $('.veil'); veil.classList.remove('open'); setTimeout(() => { veil.hidden = true; }, 200);
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === 'home'));
  void playBgm(homeTrack());
}

const card = (em: string, title: string, sub: string, right?: Node | string | null, onclick?: () => void, lock = false) =>
  h('button', { class: `card puff ${lock ? 'lock' : ''}`, onclick: () => { sfx.tap(); if (lock) toast('🔒 아직 잠겨 있어요'); else onclick?.(); } },
    h('span', { class: 'em' }, em), h('span', { class: 'tx' }, h('b', {}, title), h('small', {}, sub)), right ?? null);

const SHEETS: Record<string, () => { title: string; body: HTMLElement } | null> = {
  village: () => ({
    title: '🗺️ 멍뭉 마을',
    body: h('div', {}, h('p', { class: 'note' }, '다음 단계에서 강아지와 직접 걸어 다니는 마을로 바뀌어요. 이웃 주민의 부탁도 들어주고, 산책하며 조개·꽃을 주워 박물관에 기증해요.'),
      ...PLACES.map((p) => card(p.em, p.name, p.desc, p.lock ? h('span', { class: 'tag' }, `💗 ${p.hearts}`) : h('span', { class: 'tag' }, '가기'), () => toast(`${p.name}(으)로 가요! (곧 만나요)`), p.lock))),
  }),
  closet: () => {
    let tabId = 'wear';
    const body = h('div', {});
    const render = () => body.replaceChildren(
      h('div', { class: 'seg' },
        h('button', { class: `puff ${tabId === 'wear' ? 'on' : ''}`, onclick: () => { sfx.tab(); tabId = 'wear'; render(); } }, '👕 강아지'),
        h('button', { class: `puff ${tabId === 'room' ? 'on' : ''}`, onclick: () => { sfx.tab(); tabId = 'room'; render(); } }, '🛋️ 방')),
      h('p', { class: 'note' }, '그림이 도착하면 진짜 옷과 가구로 바뀌어요. 지금은 자리만 잡아 두었어요.'),
      h('div', { class: 'grid' }, ...CLOSET[tabId as 'wear' | 'room'].map((it) => h('button', { class: `cell puff ${it.owned ? 'owned' : ''}`, onclick: () => { sfx.tap(); toast(it.owned ? `${it.name} 입혀 보기 (곧!)` : `🦴 ${it.price}로 살 수 있어요`); } },
        it.em, h('b', {}, it.name), h('small', {}, it.owned ? '갖고 있어요' : `🦴 ${it.price}`)))));
    render();
    return { title: '👗 꾸미기', body };
  },
  play: () => ({
    title: '🎮 놀이',
    body: h('div', {}, ...GAMES.map((g) => card(g.em, g.name, g.desc, h('span', { class: 'tag' }, g.tag), () => { if (g.music) void playBgm(g.music); toast(`${g.name}: ${g.music ? '배경음 미리 듣기 중 🎵' : '곧 만나요!'}`); }))),
  }),
  diary: () => ({
    title: '📔 추억 다이어리',
    body: h('div', {}, h('p', { class: 'note' }, '알림장 · 일기 · 달력 · 배지 · 도감 · 앨범을 한 곳에 모았어요.'), ...DIARY.map((d) => card(d.em, d.name, d.desc))),
  }),
  quests: () => {
    const p = getPet();
    return {
      title: '📋 오늘의 할 일',
      body: h('div', {}, ...QUESTS.map((q) => h('div', { class: `check puff ${p.quests[q.id] ? 'done' : ''}` }, h('span', { class: 'box' }, p.quests[q.id] ? '✓' : ''), `${q.emoji} ${q.text}`, h('small', {}, '코인 +5'))),
        h('p', { class: 'note' }, '셋 다 하면 도장 1개! 하루 빠져도 도장은 그대로예요. 7개 모으면 특별 선물 상자.')),
    };
  },
  shop: () => ({
    title: '🛒 상점',
    body: h('div', {}, h('p', { class: 'note' }, '🔒 결제 전에는 보호자 확인을 거쳐요. 무엇을 받는지 미리 보여 주고, 뽑기는 팔지 않아요.'),
      ...SHOP.map((s) => card(s.em, s.name, s.desc, h('span', { class: 'price puff' }, s.price), () => toast('보호자 확인 → Google Play 결제 (출시 버전에서 연결돼요)')))),
  }),
  event: () => ({
    title: '🎁 이벤트',
    body: h('div', {}, card('⛄', '눈 축제 (12월)', '눈사람 의상과 겨울 가구가 나와요. 창밖에 눈이 오면 특별 보상!'),
      card('📺', '광고 보고 코인 받기', '원할 때만 봐요. 하루 5번까지 🦴 +20', h('span', { class: 'tag' }, '보기'), async () => {
        toast('광고 재생 중… (웹 미리보기는 가짜 광고예요)');
        if (await device.showRewardedAd('coins')) { sfx.coin(); toast('🦴 +20 받았어요!'); }
      })),
  }),
  mail: () => ({ title: '✉️ 우편함', body: h('div', {}, card('💌', `${getPet().name}의 편지`, '"오늘도 놀아 줘서 고마워! 내일 또 와 줄 거지?" 🎁 코인 10')) }),
  dog: () => {
    const p = getPet();
    return {
      title: `🐶 ${p.name}`,
      body: h('div', {}, h('p', { class: 'note' }, `웰시코기 · 늠름한 강아지 · Lv ${p.level} (다음 레벨까지 ${expForNext(p.level) - p.exp})`),
        ...STATS.map(([k, ic, label]) => h('div', { class: 'row' }, `${ic} ${label}`, h('b', {}, String(Math.round(p[k])))))),
    };
  },
  settings: () => {
    const v = getVolume();
    const slider = (k: 'bgm' | 'sfx', label: string) => h('label', { class: 'row' }, label,
      h('input', { type: 'range', min: 0, max: 100, value: Math.round(v[k] * 100), oninput: (e: Event) => setVolume({ [k]: +(e.target as HTMLInputElement).value / 100 }), onchange: () => sfx.coin() }));
    return {
      title: '⚙️ 설정',
      body: h('div', {}, slider('bgm', '🎵 배경음'), slider('sfx', '🔔 효과음'),
        h('label', { class: 'row' }, '📳 진동', h('input', { type: 'checkbox', checked: device.hapticOn, onchange: (e: Event) => { device.setHaptic((e.target as HTMLInputElement).checked); device.haptic('good'); } })),
        h('p', { class: 'note' }, '시간 · 날씨 미리 보기: 주소 끝에 ?hour=22&weather=snow')),
    };
  },
};
