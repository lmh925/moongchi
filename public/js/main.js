// 멍뭉고치 메인 앱
import {
  BREEDS, PERSONALITIES, QUIZ, STAGES, TRICKS, ITEMS, DOG_SLOTS, ROOM_SLOTS, SCHOOL_COURSES,
  STICKERS, PHRASES, EMOTES, FASHION, SHOW_WARDROBE, RUNNER, CERTS, FOOD, TREATS, POOP, BABY, SCHOOL_BOOSTS, BOOST_RULES, SPECIALS, SPECIAL_TRICKS, RENAME_PRICE, REPORT_SUBJECTS, RULES, BOND_LEVELS, RARITY, GACHA, TRAINING, PLAZA, PLAZA_SPOTS, COOP_GAMES, TAG, TREASURE, SOCCER,
} from '../shared/data.js';
import { applyDecay, quizResult, breedOf, runnerLevel, runnerMaps } from '../shared/rules.js';
import { api, post, getToken, setToken } from './api.js';
import { $, el, toast, modal, closeAllModals, pinPad, fmtDuration } from './ui.js';
import { dogSprite, dogPortrait, iconURL, accessoryURL, DOG_W, DOG_H } from './sprites.js';
import { Scene, renderRoom } from './scene.js';
import { playMinigame } from './minigame.js';
import { playRunner, enterLandscape, exitLandscape, runnerMapPreview } from './runner.js';
import { playGacha } from './gacha.js';
import { playTraining } from './training.js';
import { trainingSection, openTrainingBook, trainResultBody, certBody } from './train-ui.js';
import { playPhotobooth, loadAlbum, removeFromAlbum, downloadPhoto } from './photobooth.js';
import { playJumpRope } from './jumprope.js';
import { openLeaderboard, lbToast } from './leaderboard.js';
import { openDogCardMaker } from './dogcard.js';
import { PlazaView } from './plaza.js';
import { CoopClient } from './coop.js';
import { levelBar, titleChip, openDogCard, playLevelUp, talentUpBody } from './level.js';
import { playSpecialReveal, specialMark, specialGiftBody, specialPerkList } from './special.js';
import { tradeSection, openComposer, openReview, openHistory } from './trade.js';
import {
  questCard, stampBody, badgeBody, badgeIcon, badgeBoard, dexPanel, openMailbox, qrModal,
} from './progress.js';
import { sfx, unlock, playBgm, setMuted, isMuted } from './audio.js';

const state = {
  me: null,
  speed: 1,
  offset: 0,
  socket: null,
  scene: null,
  room: null,
  roomOwnerId: null,
  tab: 'home',
  chatAllowed: false,
  busy: false,
  schoolTimer: null,
  closetTab: 'dog',
  bonds: {},
  party: null,
  plaza: null, // 놀이터에 있을 때: { view, channel, count, tag, waiting, friends }
  coopWaiting: null,
};

// 강아지 크기와 견종에 따라 짖는 소리 높낮이가 달라요
const barkPitch = (dog) => (dog ? 1.35 - dog.stage * 0.15 - (dog.breed === 'corgi' || dog.breed === 'shiba' ? 0.1 : 0) : 1);

const myId = () => state.me?.user.id;
// 자동 테스트용 (주소에 ?debug 가 있을 때만)
if (new URLSearchParams(location.search).has('debug')) window.__mm = state;
const serverNow = () => Date.now() + state.offset;
// 방에 아직 들어가기 전(소켓 연결 중)에는 우리 집으로 봐요
const atHome = () => !state.roomOwnerId || state.roomOwnerId === myId();

// ---------- 화면 전환 ----------
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${id}`));
  window.scrollTo(0, 0);
}

function publicDog(d) {
  if (!d) return null;
  return {
    name: d.name, breed: d.breed, personality: d.personality, stage: d.stage, equip: d.equip,
    fluff: d.fluff, tricks: d.tricks, mood: d.mood, atSchool: !!d.school,
    titleName: d.titleName, frame: d.frame, special: d.special ?? null, original: !!d.original,
  };
}

// ---------- 타이틀 ----------
function drawTitle() {
  const c = $('#title-canvas');
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const dogs = [['bichon', 1, 34], ['corgi', 2, 96], ['poodle', 0, 158]];
  let t = 0;
  const frame = () => {
    if (!$('#screen-title').classList.contains('active')) return;
    ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, 192, 96);
    ctx.fillStyle = '#d8f1ff'; ctx.fillRect(0, 30, 192, 20);
    ctx.fillStyle = '#ffffff';
    for (const [x, y] of [[30, 14], [120, 10], [170, 24]]) { ctx.fillRect((x + t) % 212 - 20, y, 16, 4); ctx.fillRect((x + t) % 212 - 16, y - 3, 8, 3); }
    ctx.fillStyle = '#3f8f3a'; ctx.fillRect(0, 62, 192, 34);
    ctx.fillStyle = '#57a84b';
    for (let x = 0; x < 192; x += 5) ctx.fillRect(x, 62 - (x % 2), 2, 2);
    ctx.fillStyle = '#2f6f2c'; ctx.fillRect(0, 90, 192, 6);
    dogs.forEach(([breed, stage, x], i) => {
      const hop = Math.floor(t / 8 + i) % 3 === 0;
      const spr = dogSprite(breed, stage, hop ? 'sit' : 'stand', { eyes: 'happy', mouth: 'tongue', tail: Math.floor(t / 4) % 2 });
      ctx.drawImage(spr.canvas, x - DOG_W / 2, 92 - 41 - (hop ? 2 : 0));
    });
    t += 1;
    setTimeout(() => requestAnimationFrame(frame), 120);
  };
  frame();
}

// ---------- 가입/로그인 ----------
let authMode = 'signup';
let authPin = '';
const pad = pinPad((p) => {
  authPin = p;
  updateAuthButton();
  // 로그인은 숫자 4개를 다 누르면 바로 들어가요
  if (authMode === 'login' && p.length === 4 && !$('#auth-submit').disabled) $('#auth-submit').click();
});
$('#auth-pin').append(pad.node);

function updateAuthButton() {
  const consentOK = authMode !== 'signup' || $('#auth-consent-box').checked;
  $('#auth-submit').disabled = $('#auth-nick').value.trim().length < 2 || authPin.length !== 4 || !consentOK;
}
$('#auth-consent-box').addEventListener('change', updateAuthButton);

// ---------- 빠른 로그인 (이 기기에 저장한 닉네임) ----------
// 비밀번호는 저장하지 않아요. 닉네임과 강아지 모습만 기억해요.
const ACCOUNTS_KEY = 'meongmung.accounts';
function savedAccounts() {
  try {
    const list = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((a) => a && typeof a.nickname === 'string') : [];
  } catch { return []; }
}
function writeAccounts(list) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 4))); } catch { /* 저장소를 못 써도 괜찮아요 */ }
}
function rememberAccount(me) {
  if (!me?.user?.nickname) return;
  const entry = { nickname: me.user.nickname, breed: me.dog?.breed ?? null, stage: me.dog?.stage ?? 0, equip: me.dog?.equip ?? null, dogName: me.dog?.name ?? null };
  writeAccounts([entry, ...savedAccounts().filter((a) => a.nickname !== entry.nickname)]);
}
function forgetAccount(nickname) {
  writeAccounts(savedAccounts().filter((a) => a.nickname !== nickname));
  renderQuickLogin();
}
function renderQuickLogin() {
  const list = savedAccounts();
  for (const box of document.querySelectorAll('.quick-login')) {
    box.hidden = !list.length;
    box.replaceChildren(
      el('p', { class: 'label' }, '빠른 로그인'),
      el('div', { class: 'quick-list' }, list.map((a) => el('div', { class: 'quick-account' },
        el('button', { type: 'button', class: 'quick-pick', onclick: () => openAuth('login', a.nickname) },
          a.breed && breedOf(a.breed) ? el('img', { class: 'pixel', src: dogPortrait(a.breed, a.stage ?? 0, { equip: a.equip ?? undefined }), alt: '' }) : el('span', { class: 'quick-noimg' }),
          el('span', { class: 'quick-nick' }, a.nickname)),
        el('button', {
          type: 'button', class: 'quick-remove', 'aria-label': `${a.nickname} 지우기`,
          onclick: () => modal({
            title: '이 기기에서 지울까요?',
            body: el('p', { class: 'center' }, `빠른 로그인 목록에서 "${a.nickname}"을(를) 지워요. 강아지는 그대로 있어요!`),
            buttons: [{ label: '그대로 둘래요', kind: 'secondary' }, { label: '지우기', onClick: () => forgetAccount(a.nickname) }],
          }),
        }, '✕')))));
  }
}

function openAuth(mode, nickname = '') {
  authMode = mode;
  $('#auth-title').textContent = mode === 'signup' ? '처음 오셨군요! 반가워요' : '다시 와 줘서 고마워요!';
  $('#auth-help').textContent = mode === 'signup'
    ? '친구들이 부를 닉네임과, 나만 아는 숫자 4개를 정해 주세요. 이름·전화번호 같은 진짜 정보는 쓰지 마세요!'
    : '닉네임과 비밀번호 숫자 4개를 넣어 주세요.';
  $('#auth-submit').textContent = mode === 'signup' ? '시작하기' : '들어가기';
  $('#auth-error').textContent = '';
  $('#auth-nick').value = nickname;
  $('#auth-consent').hidden = mode !== 'signup';
  $('#auth-consent-box').checked = false;
  pad.reset();
  renderQuickLogin();
  show('auth');
  $('#screen-auth .quick-login').hidden = mode !== 'login' || !!nickname || !savedAccounts().length;
  // 닉네임이 채워져 있으면 바로 숫자 누르기부터
  if (!nickname) $('#auth-nick').focus(); else $('#auth-nick').blur();
}

$('#auth-nick').addEventListener('input', updateAuthButton);
$('#auth-submit').addEventListener('click', async () => {
  const btn = $('#auth-submit');
  btn.disabled = true;
  try {
    const res = await post(authMode === 'signup' ? '/signup' : '/login', { nickname: $('#auth-nick').value.trim(), pin: authPin, consent: $('#auth-consent-box').checked });
    setToken(res.token);
    if (authMode === 'signup') {
      modal({
        title: '비밀번호를 꼭 기억해요!',
        body: el('div', { class: 'center' }, el('p', {}, '다음에 올 때 필요해요.'), el('p', { class: 'code' }, authPin), el('p', { class: 'help' }, '보호자에게 알려 두면 잊어버려도 걱정 없어요.')),
        buttons: [{ label: '기억했어요!' }],
      });
    }
    await afterLogin();
  } catch (err) {
    $('#auth-error').textContent = err.message;
    pad.reset();
  } finally {
    updateAuthButton();
  }
});

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  const go = b.dataset.go;
  if (go === 'title') showTitle(); else openAuth(go);
}));

function showTitle() {
  renderQuickLogin();
  renderInstallBtn();
  show('title');
  drawTitle();
}

async function afterLogin() {
  const me = await api('/me');
  applyMe(me);
  if (!me.dog) startQuiz();
  else enterGame(me);
}

// ---------- 심리테스트 ----------
let answers = [];
function startQuiz() {
  answers = [];
  document.querySelectorAll('.adopt-cancel').forEach((b) => { b.hidden = !state.adopting; });
  show('quiz');
  showQuestion(0);
}

// ---------- 둘째 입양 ----------
function startAdopt() {
  const { slots } = state.me;
  if (slots.used >= slots.max) return toast(slots.nextLevel ? `강아지가 Lv ${slots.nextLevel}이 되면 입양할 수 있어요!` : '더 이상 입양할 수 없어요.');
  modal({
    title: '새 가족을 맞이할까요?',
    body: el('div', { class: 'center' },
      el('p', {}, '심리테스트를 다시 해서 운명의 강아지를 만나요.'),
      el('p', { class: 'help' }, '지금 강아지들은 집에서 함께 지내요. 코인·아이템·배지·도감은 다 같이 써요!')),
    buttons: [
      { label: '다음에', kind: 'secondary' },
      { label: '입양하러 가기!', onClick: () => { state.adopting = true; startQuiz(); } },
    ],
  });
}

function cancelAdopt() {
  state.adopting = false;
  show('game');
  renderPanel();
}
document.querySelectorAll('.adopt-cancel').forEach((b) => b.addEventListener('click', cancelAdopt));

async function switchDog(d) {
  try {
    const res = await post('/dog/switch', { dogId: d.id });
    applyMe(res);
    await enterRoom(myId(), { quiet: true });
    sfx.bark(barkPitch(res.dog), 2);
    toast(`오늘의 대표는 ${res.dog.name}!`, 'good');
    await handleEvents(res.events);
    renderPanel();
  } catch (err) { toast(err.message, 'bad'); }
}

// 우리 강아지들: 대표를 고르거나 새 가족을 입양해요
function dogsRow() {
  const { dogs = [], slots } = state.me;
  if (!slots) return null;
  const cells = dogs.map((d) => el('button', {
    type: 'button', class: `dog-slot ${d.active ? 'active' : ''}`,
    onclick: () => (d.active ? openMyCard() : modal({
      title: `${d.name}(으)로 바꿀까요?`,
      body: el('p', { class: 'center' }, `${d.name}(이)가 오늘의 대표가 돼서 돌봄·학교·놀이터에 함께 가요.`),
      buttons: [{ label: '아니요', kind: 'secondary' }, { label: '바꿀래요!', onClick: () => switchDog(d) }],
    })),
  },
  el('img', { class: 'pixel', src: dogPortrait(d.breed, d.stage, { equip: d.equip }), alt: '' }),
  el('b', {}, d.name),
  el('small', {}, d.active ? '대표' : d.atSchool ? '학교' : `Lv ${d.level}`)));
  if (slots.used < slots.max) cells.push(el('button', { type: 'button', class: 'dog-slot add', onclick: startAdopt }, el('span', { class: 'plus' }, '+'), el('b', {}, '입양하기')));
  else if (slots.nextLevel) cells.push(el('div', { class: 'dog-slot locked' }, el('span', { class: 'plus' }, '🔒'), el('small', {}, `Lv ${slots.nextLevel}에 열려요`)));
  return el('div', { class: 'dogs-row' }, el('div', { class: 'section-title' }, '우리 강아지들'), el('div', { class: 'dog-slots' }, cells));
}

function showQuestion(i) {
  const q = QUIZ[i];
  $('#quiz-progress').replaceChildren(...QUIZ.map((_, j) => el('img', { src: iconURL('paw'), class: `pixel ${j < i ? 'done' : ''}`, alt: '' })));
  $('#quiz-q').textContent = `Q${i + 1}. ${q.q}`;
  $('#quiz-options').replaceChildren(...q.options.map((o, j) => el('button', {
    class: 'option',
    onclick: () => {
      answers[i] = j;
      if (i + 1 < QUIZ.length) showQuestion(i + 1);
      else showResult();
    },
  }, o.text)));
}

let chosen = null;
function showResult() {
  chosen = quizResult(answers);
  const b = BREEDS[chosen.breed];
  const p = PERSONALITIES[chosen.personality];
  $('#result-img').src = dogPortrait(chosen.breed, 0);
  $('#result-breed').textContent = b.name;
  $('#result-personality').textContent = `${p.emoji} ${p.name}`;
  $('#result-desc').textContent = `${b.desc} ${p.desc}`;
  $('#result-error').textContent = '';
  show('result');
}

$('#result-submit').addEventListener('click', async () => {
  const name = $('#result-name').value.trim();
  if (!name) { $('#result-error').textContent = '이름을 지어 주세요!'; return; }
  try {
    const me = await post('/dog', { name, ...chosen });
    applyMe(me);
    if (state.adopting) {
      state.adopting = false;
      const sp = me.events.find((e) => e.type === 'special');
      if (sp) await playSpecialReveal(me.dog, sp);
      show('game');
      await enterRoom(myId(), { quiet: true });
      setTab('home');
      sfx.levelUp();
      await waitModal({ title: `${name}(이)가 새 가족이 되었어요!`, body: el('p', { class: 'center' }, '오늘의 대표로 함께해요. 우리 강아지들 칸에서 언제든 대표를 바꿀 수 있어요.'), buttons: [{ label: '환영해!' }] });
      await handleEvents(me.events.filter((e) => e.type !== 'special')); // 스페셜 선물 등
      return;
    }
    // 이스터에그: 스페셜 이름이면 여기서 변신 연출부터!
    const sp = me.events.find((e) => e.type === 'special');
    if (sp) {
      me.events = me.events.filter((e) => e !== sp);
      await playSpecialReveal(me.dog, sp);
    }
    enterGame(me);
    modal({
      title: `${name}(이)가 가족이 되었어요!`,
      body: el('div', {},
        el('p', {}, '🍖 밥 주기, 🫧 빗질하기, 💕 쓰다듬기로 돌봐 주세요.'),
        el('p', {}, '방바닥을 누르면 강아지가 그곳으로 걸어가요. 강아지를 누르면 쓰다듬을 수 있어요!'),
        el('p', {}, '멍뭉 학교에 보내면 알림장과 새로운 개인기를 받아 와요.')),
      buttons: [{ label: '잘 부탁해!' }],
    });
  } catch (err) {
    $('#result-error').textContent = err.message;
  }
});

// ---------- 게임 ----------
function applyMe(me) {
  const prev = state.me;
  state.me = me;
  if (prev?.dog && me.dog && prev.dog.id === me.dog.id) setTimeout(() => popDiffs(prev, me), 0);
  state.speed = me.speed ?? 1;
  state.offset = (me.serverNow ?? Date.now()) - Date.now();
  rememberAccount(me);
  if (!me.dog) return;
  $('#top-name').textContent = me.dog.name;
  $('#top-stage').textContent = STAGES[me.dog.stage].name;
  $('#top-level').textContent = `Lv ${me.dog.level}`;
  $('#top-level').className = `chip lv-badge frame-${me.dog.frame ?? 0}`;
  $('#top-coins').textContent = me.user.coins;
  $('#top-hearts').textContent = me.asks?.hearts ?? 0;
  $('#badge-notebook').hidden = !me.unreadReports;
  $('#badge-friends').hidden = !me.pendingFriends && !me.pendingTrades;
  $('#badge-mail').hidden = !me.progress?.unreadMail;
  if (me.progress?.unreadMail) $('#badge-mail').textContent = me.progress.unreadMail;
  // 내 강아지 모습 갱신
  if (state.scene && state.room) {
    const e = state.scene.entities.get(myId());
    if (e) e.dog = publicDog(me.dog);
    if (atHome()) updateAway();
  }
  syncPoops(me.dog);
  scheduleSchool();
  updateAskBubble();
}

// ---------- ✨ 숫자 팝업: 무엇이 얼마나 올랐는지 톡톡 ----------
function popDiffs(prev, me) {
  if (!state.scene || state.plaza || !atHome()) return;
  const d = (a, b) => Math.round((b ?? 0) - (a ?? 0));
  const items = [];
  const add = (n, text, cls) => { if (n >= 1) items.push({ text: `+${n} ${text}`, cls }); };
  add(d(prev.dog.fullness, me.dog.fullness), '포만', 'full');
  add(d(prev.dog.cleanliness, me.dog.cleanliness), '청결', 'clean');
  add(d(prev.dog.affection, me.dog.affection), '애정', 'love');
  add(d(prev.dog.exp, me.dog.exp), '⭐', 'exp');
  const coins = d(prev.user.coins, me.user.coins);
  add(coins, '🦴', 'coin');
  add(d(prev.asks?.hearts, me.asks?.hearts), '💗', 'heart');
  state.scene.popNumbers(myId(), items.slice(0, 5));
  if (coins > 0) flyCoin();
}

// 코인이 화면 위 코인 칸으로 날아가요
function flyCoin() {
  const e = state.scene?.entities.get(myId());
  const target = $('#top-coins');
  if (!e || !target) return;
  const r = state.scene.canvas.getBoundingClientRect();
  const sx = r.width / 192;
  const t = target.getBoundingClientRect();
  const node = el('img', { class: 'pixel coin-fly', src: iconURL('coin', 2), alt: '' });
  document.body.append(node);
  const x0 = r.left + e.x * sx; const y0 = r.top + (e.y - 30) * sx;
  node.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1 },
    { transform: `translate(${(x0 + t.left) / 2}px, ${Math.min(y0, t.top) - 40}px) scale(1.3)`, opacity: 1, offset: 0.4 },
    { transform: `translate(${t.left}px, ${t.top}px) scale(.6)`, opacity: 0.2 },
  ], { duration: 800, easing: 'ease-in' }).onfinish = () => { node.remove(); target.parentElement.classList.remove('bump'); void target.offsetWidth; target.parentElement.classList.add('bump'); };
}

// ---------- 💭 말풍선 소원 ----------
function updateAskBubble() {
  if (!state.scene) return;
  const cur = state.me?.asks?.cur;
  state.scene.setAsk(myId(), cur && atHome() && !state.plaza && !state.me.dog.school ? cur : null, openAsk);
}

function openAsk() {
  const cur = state.me?.asks?.cur;
  if (!cur) return;
  sfx.notify();
  const dog = state.me.dog;
  const go = () => {
    if (cur.go === 'treat') { openFoodBowl(); return; }
    if (cur.go === 'school') state.schoolTab = 'train';
    setTab(cur.go === 'home' ? 'home' : cur.go);
  };
  modal({
    title: cur.rainbow ? '🌈 무지개 소원!' : `${dog.name}의 소원`,
    className: `ask-modal ${cur.color}`,
    body: el('div', { class: 'center' },
      el('img', { class: 'pixel ask-dog', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy', mouth: 'open' }), alt: '' }),
      el('div', { class: 'ask-say' }, `${cur.emoji} ${cur.text}`),
      el('p', { class: 'help' }, `이렇게 해 줘요: ${cur.how}`),
      el('p', { class: 'hint' }, cur.rainbow ? '들어주면 💗와 함께 선물 3개 중 하나를 골라요!' : '들어주면 💗 행복 포인트를 받아요. 💗를 모으면 새로운 곳이 열려요!')),
    buttons: [{ label: '나중에', kind: 'secondary' }, { label: '해 줄게!', onClick: go }],
  });
}

async function chooseAskGift(options) {
  if (!options?.length) return;
  const label = (g) => (g.kind === 'item' ? ITEMS[g.item]?.name : g.kind === 'coins' ? `뼈다귀 코인 ${g.coins}개` : SCHOOL_BOOSTS[g.boost]?.name);
  const icon = (g) => (g.kind === 'item' ? (accessoryURL(g.item, 4) ?? iconURL('sparkle', 3)) : g.kind === 'coins' ? iconURL('coin', 4) : iconURL(SCHOOL_BOOSTS[g.boost]?.icon ?? 'hourglass', 4));
  await new Promise((resolve) => {
    const { close } = modal({
      title: '🌈 선물을 하나 골라요!',
      className: 'celebrate',
      dismissable: false,
      body: el('div', { class: 'gift-pick' }, options.map((g, i) => el('button', {
        class: 'gift-card', type: 'button',
        onclick: async () => {
          try {
            const res = await post('/ask/gift', { index: i });
            applyMe(res); sfx.levelUp();
            toast(`${label(res.chosen)}을(를) 받았어요!`, 'good');
            close(); resolve();
          } catch (err) { toast(err.message, 'bad'); }
        },
      }, el('img', { class: 'pixel', src: icon(g), alt: '' }), el('b', {}, label(g))))),
      buttons: [],
    });
  });
}

// 방에 있는 똥 (우리 집에 있을 때만 보여요). 새로 생기면 "끙차!"
function syncPoops(dog) {
  if (!state.scene) return;
  const list = atHome() && !dog.school ? dog.poop?.list ?? [] : [];
  const before = state.poopIds ?? new Set();
  if (list.some((p) => !before.has(p.id)) && state.poopIds) {
    state.scene.bubble(myId(), 'text', '끙차!');
    sfx.pop();
  }
  state.poopIds = new Set(list.map((p) => p.id));
  state.scene.setPoops(list);
  clearTimeout(state.poopTimer);
  const pending = dog.poop?.pending;
  if (pending) state.poopTimer = setTimeout(refreshMe, Math.min(2 ** 31 - 1, Math.max(500, pending - serverNow() + 500)));
}

async function cleanPoop(id) {
  try {
    const res = await post('/dog/clean', { id });
    sfx.brush();
    setTimeout(sfx.coin, 250);
    toast(`깨끗하게 치웠어요! 청결도 UP · 코인 +${res.result.coins}`, 'good');
    applyMe(res);
    await handleEvents(res.events);
    if (state.tab === 'home') renderPanel();
  } catch (err) { toast(err.message, 'bad'); refreshMe(); }
}

// 밥 그릇: 사료 + 가지고 있는 간식 + 간식 가게
function openFoodBowl() {
  const render = () => {
    const { food, user, dog } = state.me;
    const next = food?.nextAt ? fmtDuration(food.nextAt - serverNow()) : null;
    const owned = Object.entries(TREATS).filter(([id]) => (user.treats?.[id] ?? 0) > 0);
    const likes = (t) => t.fav.includes(dog.personality);
    return el('div', { class: 'food-bowl' },
      el('div', { class: 'kibble-row' },
        el('div', { class: 'kibble-dots' }, Array.from({ length: FOOD.kibbleMax }, (_, i) => el('span', { class: `kibble ${i < (food?.n ?? 0) ? 'on' : ''}` }))),
        el('div', { class: 'meta' }, food?.n ? `사료 ${food.n}번 남았어요` : '사료가 다 떨어졌어요!', next ? ` · 다음 사료까지 ${next}` : ''),
        el('button', { class: 'btn primary', disabled: !food?.n || !!dog.school, onclick: () => { closeAllModals(); doCare('feed'); } }, '사료 주기')),
      el('div', { class: 'section-title' }, '가지고 있는 간식'),
      owned.length ? el('div', { class: 'treat-grid' }, owned.map(([id, t]) => el('button', {
        class: `treat ${likes(t) ? 'fav' : ''}`, disabled: !!dog.school, onclick: () => giveTreat(id),
      }, treatIcon(t), el('b', {}, t.name), el('small', {}, `${user.treats[id]}개${likes(t) ? ' · 좋아해요!' : ''}`))))
        : el('p', { class: 'help' }, '아직 간식이 없어요. 아래 간식 가게에서 사 보세요!'),
      el('div', { class: 'section-title' }, `간식 가게 (코인 ${user.coins})`),
      el('div', { class: 'treat-grid' }, Object.entries(TREATS).map(([id, t]) => el('button', { class: `treat shop ${likes(t) ? 'fav' : ''}`, onclick: () => buyTreat(id) },
        treatIcon(t), el('b', {}, t.name),
        el('small', {}, `포만감 +${t.fullness} · 애정 +${t.affection}`),
        el('span', { class: 'price' }, el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '코인' }), t.price)))),
      el('p', { class: 'hint' }, `${dog.name}(이)가 좋아하는 간식에는 하트가 붙어요. 좋아하는 간식을 주면 애정도가 더 올라요!`));
  };
  const box = modal({ title: '밥 그릇', className: 'trade-modal', body: render(), buttons: [{ label: '닫기', kind: 'secondary' }] });
  state.foodBox = { box, render };
}

function treatIcon(t) {
  return el('span', { class: 'treat-icon', style: { background: t.color } }, el('img', { class: 'pixel', src: iconURL('food', 2), alt: '' }));
}

function refreshFoodBox() {
  const fb = state.foodBox;
  if (fb && document.body.contains(fb.box.card)) fb.box.card.querySelector('.modal-body').replaceChildren(fb.render());
}

async function buyTreat(id) {
  try {
    applyMe(await post('/shop/treat', { id }));
    sfx.coin();
    refreshFoodBox();
  } catch (err) { sfx.error(); toast(err.message, 'bad'); }
}

async function giveTreat(id) {
  try {
    const res = await post('/dog/treat', { id });
    closeAllModals();
    applyMe(res);
    const scene = state.scene;
    scene.care(myId(), 'feed');
    sfx.eat();
    if (res.result.fav) { setTimeout(sfx.love, 300); scene.burst(scene.entities.get(myId()), 'heart', 4); }
    scene.bubble(myId(), 'text', res.result.fav ? `${TREATS[id].name} 최고야!` : '냠냠 맛있다!');
    await handleEvents(res.events);
    if (state.tab === 'home') renderPanel();
  } catch (err) { toast(err.message, 'bad'); }
}

function scheduleSchool() {
  clearTimeout(state.schoolTimer);
  const s = state.me?.dog?.school;
  if (!s) return;
  const wait = Math.max(500, s.endsAt - serverNow() + 800);
  state.schoolTimer = setTimeout(refreshMe, Math.min(wait, 2 ** 31 - 1));
}

async function refreshMe() {
  try {
    const me = await api('/me');
    applyMe(me);
    await handleEvents(me.events);
    renderPanel();
  } catch (err) { toast(err.message, 'bad'); }
}

let entered = false;
function enterGame(me) {
  show('game');
  const icons = { home: 'paw', school: 'star', closet: 'sparkle', friends: 'heart', play: 'coin', notebook: 'note' };
  document.querySelectorAll('.tab').forEach((t) => {
    t.querySelector('.ti').style.backgroundImage = `url(${iconURL(icons[t.dataset.tab], 3)})`;
  });
  $('#coin-icon').src = iconURL('coin', 2);
  $('#mail-icon').src = iconURL('mail', 2);
  if (!entered) {
    entered = true;
    state.scene = new Scene($('#stage-canvas'), $('#stage-overlay'), {
      onFloorTap: (n) => {
        const e = state.scene.entities.get(myId());
        if (!e || e.dog?.atSchool) return toast(atHome() ? '강아지가 학교에 가 있어요!' : '강아지가 학교에 가 있어요.');
        sfx.tap();
        state.scene.moveTo(myId(), n.x, n.y);
        state.socket?.emit('room:move', n);
      },
      onMove: (n) => state.socket?.emit('room:move', n),
      onPoopTap: (id) => { if (atHome()) cleanPoop(id); },
      onTreatNear: (t, pos) => state.socket?.emit('party:grab', { treatId: t.id, x: pos.x, y: pos.y }),
      onDogTap: (e, combo) => {
        sfx.bark(barkPitch(e.dog), combo === 'spin' ? 2 : 1);
        if (String(e.id).startsWith('dog:')) { state.scene.burst(e, 'heart', 2); return; } // 집에서 쉬는 강아지
        if (combo === 'spin') { sfx.whoosh(); state.socket?.emit('room:trick', { trick: 'spin' }); }
        if (e.mine) doCare('pet', { quiet: true });
        else state.socket?.emit('room:pet', { userId: e.id });
      },
    });
    connectSocket();
    setInterval(tick, 1000);
    setInterval(autoPlay, 15_000);
    $('#sound-btn').addEventListener('click', toggleSound);
    renderSoundBtn();
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
    $('.topbar .who').addEventListener('click', openSettings);
    $('#mail-btn').addEventListener('click', openMail);
  }
  setTab('home');
  playBgm('home');
  if (me.dailyCoins) toast(`출석 보상! 뼈다귀 코인 ${me.dailyCoins}개를 받았어요`, 'good');
  handleEvents(me.events).then(() => { if (state.me.asks?.gift) chooseAskGift(state.me.asks.gift); });
  handlePendingCode();
}

function setTab(tab) {
  if (state.plaza && tab !== 'play') leavePlaza();
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  renderPanel();
}

// ---------- 소켓 ----------
function emitAck(event, payload) {
  return new Promise((resolve) => {
    if (!state.socket?.connected) return resolve({ ok: false, reason: '연결 중이에요. 잠시만 기다려 주세요.' });
    state.socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { ok: false, reason: '연결이 느려요. 다시 해 주세요.' } : res));
  });
}

function connectSocket() {
  // eslint-disable-next-line no-undef
  const socket = io({ auth: { token: getToken() } });
  state.socket = socket;
  socket.on('connect', () => {
    if (state.plaza) rejoinPlaza();
    else enterRoom(state.roomOwnerId ?? myId(), { quiet: true });
  });
  bindPlazaSocket(socket);
  socket.on('growth', ({ events }) => queueGrowth(events ?? []));
  state.coop = new CoopClient(socket, {
    onStart: () => { state.coopWaiting = null; renderSpotBox(); },
    onEnd: () => refreshMe(),
    onRetry: (game) => queueCoop(game),
  });
  socket.on('connect_error', (err) => {
    if (err.message === 'unauthorized') logout();
  });
  socket.on('room:enter', (m) => {
    const scene = state.scene;
    if (m.userId === state.roomOwnerId) {
      const e = scene.entities.get(m.userId);
      if (e) { e.auto = false; scene.moveTo(m.userId, m.x, m.y); }
    } else {
      scene.upsert(m.userId, { dog: m.dog, nickname: m.nickname, x: m.x, y: m.y });
    }
    state.room.members.push(m);
    scene.showNames = true;
    if (atHome()) { sfx.notify(); toast(`${m.nickname}(이)가 놀러 왔어요!`, 'good'); }
    if (state.tab === 'home') renderPanel();
    updateChatDock();
  });
  socket.on('room:exit', ({ userId }) => {
    if (!state.room) return;
    const m = state.room.members.find((x) => x.userId === userId);
    state.room.members = state.room.members.filter((x) => x.userId !== userId);
    if (userId === state.roomOwnerId) {
      const e = state.scene.entities.get(userId);
      if (e) e.auto = true;
    } else state.scene.remove(userId);
    if (m && atHome()) toast(`${m.nickname}(이)가 집으로 돌아갔어요.`);
    if (state.tab === 'home') renderPanel();
    updateChatDock();
  });
  socket.on('room:move', ({ userId, x, y }) => state.scene.moveTo(userId, x, y));
  socket.on('room:bubble', ({ userId, kind, value }) => {
    sfx.pop();
    state.scene.bubble(userId, kind, value);
    logChat(userId, kind, value);
    if (kind === 'sticker' && (value === 'heart' || value === 'sparkle' || value === 'note')) state.scene.effectAt(userId, value, 2);
  });
  socket.on('room:pet', ({ from, to }) => {
    state.scene.care(to, 'love');
    if (from !== myId()) sfx.love();
    if (to === myId() && from !== myId()) {
      const m = state.room?.members.find((x) => x.userId === from);
      toast(`${m?.nickname ?? '친구'}(이)가 ${state.me.dog.name}(을)를 쓰다듬어 줬어요!`, 'good');
    }
  });
  socket.on('room:trick', ({ userId, trick }) => {
    state.scene.trick(userId, trick);
    sfx.bark(barkPitch(state.scene.entities.get(userId)?.dog));
  });
  socket.on('room:play', ({ from, to }) => {
    state.scene.playTogether(from, to);
    const e = state.scene.entities.get(from);
    sfx.bark(barkPitch(e?.dog), 2);
  });
  socket.on('trio', ({ names, all }) => {
    sfx.levelUp();
    toast(all ? `🎉 요크 삼형제 ${names.join('·')}가 모두 모였다!` : `요크 삼형제 ${names.join('·')}가 만났어요!`, 'good');
    for (const e of state.scene?.entities.values() ?? []) if (e.dog?.special && SPECIALS[e.dog.special]?.trio) state.scene.burst(e, 'heart', 4);
  });
  socket.on('bond', ({ a, b, bond, up }) => {
    const other = a === myId() ? b : b === myId() ? a : null;
    if (other !== null) state.bonds[other] = bond;
    if (up) {
      state.scene.effectAt(a, 'heart', 4);
      state.scene.effectAt(b, 'heart', 4);
      if (other !== null) {
        const dog = state.scene.entities.get(other)?.dog;
        sfx.levelUp();
        toast(`${state.me.dog.name}(와)과 ${dog?.name ?? '친구 강아지'}(이)가 '${bond.name}'(이)가 되었어요!`, 'good');
      }
    }
    if (state.tab === 'home') renderPanel();
  });
  socket.on('room:dog', ({ userId, dog }) => {
    const e = state.scene.entities.get(userId);
    if (e && userId !== myId()) e.dog = dog;
    if (userId === state.roomOwnerId && state.room) { state.room.homeDog = dog; updateAway(); }
  });
  socket.on('room:extras', ({ ownerId, extras }) => {
    if (ownerId !== state.roomOwnerId) return;
    if (state.room) state.room.extras = extras;
    addExtras(extras);
  });
  socket.on('room:decor', ({ decor }) => { state.scene.setDecor(decor); if (state.room) state.room.decor = decor; });
  socket.on('room:chat-allowed', ({ allowed }) => {
    state.chatAllowed = allowed;
    updateChatDock();
  });
  socket.on('room:kicked', ({ reason }) => toast(reason, 'bad'));
  socket.on('party:start', ({ endsAt, players }) => startPartyView({ endsAt, scores: Object.fromEntries(players.map((p) => [p, 0])), treats: [] }));
  socket.on('party:treat', (t) => state.scene.addTreat(t));
  socket.on('party:grabbed', ({ treatId, userId, value, scores }) => {
    state.scene.removeTreat(treatId);
    if (!state.party) return;
    state.party.scores = scores;
    state.scene.effectAt(userId, value > 1 ? 'star' : 'heart', 1);
    if (userId === myId()) { if (value > 1) sfx.star(); else sfx.catch(); }
    renderPartyHud();
  });
  socket.on('party:end', ({ results }) => endPartyView(results));
  socket.on('invite', ({ fromId, nickname }) => {
    sfx.notify();
    modal({
      title: '초대장이 왔어요!',
      body: el('p', { class: 'center' }, `${nickname}(이)가 놀러 오래요! 같이 놀러 갈까요?`),
      buttons: [
        { label: '다음에', kind: 'secondary' },
        { label: '놀러 가기!', onClick: () => enterRoom(fromId) },
      ],
    });
  });
  socket.on('presence', () => { if (state.tab === 'friends') renderPanel(); });
  socket.on('baby:wish', ({ from }) => {
    sfx.notify();
    toast(`🎁 ${from}(이)가 아기 강아지 소원을 빌었어요! 친구 탭에서 확인해요.`, 'good');
    $('#badge-friends').hidden = false;
    refreshMe().then(() => { if (state.tab === 'friends') renderPanel(); });
  });
  socket.on('baby:answer', ({ accepted, by }) => {
    toast(accepted ? `${by}(이)가 소원에 좋다고 했어요! 이틀 뒤 선물 상자가 와요.` : `${by}(이)는 다음에 빌기로 했어요.`, accepted ? 'good' : 'info');
    refreshMe().then(() => { if (state.tab === 'friends') renderPanel(); });
  });
  socket.on('trade:new', ({ from }) => {
    sfx.notify();
    toast(`🎁 ${from}(이)가 멍뭉거래를 제안했어요! 친구 탭에서 확인해요.`, 'good');
    $('#badge-friends').hidden = false;
    if (state.tab === 'friends') renderPanel();
  });
  socket.on('trade:answer', ({ accepted, by }) => {
    if (accepted) { sfx.levelUp(); toast(`${by}(이)가 거래를 수락했어요! 꾸미기에서 확인해요.`, 'good'); refreshMe(); } else toast(`${by}(이)가 이번 거래는 거절했어요.`);
    if (state.tab === 'friends') renderPanel();
  });
  socket.on('trade:cancelled', () => { if (state.tab === 'friends') renderPanel(); });
  socket.on('friends:changed', async () => {
    if (state.tab === 'friends') renderPanel();
    try {
      const f = await api('/friends');
      $('#badge-friends').hidden = !f.incoming.length;
      if (f.incoming.length && state.tab !== 'friends') { sfx.notify(); toast('새 친구 신청이 왔어요!', 'good'); }
    } catch { /* 무시 */ }
  });
}

async function enterRoom(ownerId, { quiet = false } = {}) {
  const res = await emitAck('room:join', { ownerId });
  if (!res.ok) {
    if (!quiet) toast(res.reason, 'bad');
    if (ownerId !== myId()) return enterRoom(myId(), { quiet: true });
    return false;
  }
  const room = res.room;
  state.room = room;
  updateChatDock();
  state.bonds = res.bonds ?? {};
  stopPartyView();
  state.roomOwnerId = ownerId;
  const scene = state.scene;
  scene.clear();
  scene.setDecor(room.decor);
  const me = myId();
  const ownerMember = room.members.find((m) => m.userId === ownerId);
  scene.upsert(ownerId, {
    dog: ownerId === me ? publicDog(state.me.dog) : room.homeDog,
    nickname: room.owner.nickname,
    x: ownerMember?.x, y: ownerMember?.y,
    mine: ownerId === me, home: true, auto: ownerId === me || !ownerMember,
  });
  addExtras(room.extras);
  syncPoops(state.me.dog);
  for (const m of room.members) {
    if (m.userId === ownerId) continue;
    scene.upsert(m.userId, {
      dog: m.userId === me ? publicDog(state.me.dog) : m.dog, nickname: m.nickname, x: m.x, y: m.y,
      mine: m.userId === me, auto: m.userId === me,
    });
  }
  scene.showNames = ownerId !== me || room.members.length > 1 || (room.extras?.length ?? 0) > 0;
  $('#room-label').textContent = ownerId === me ? `${room.owner.nickname}네 집` : `${room.owner.nickname}네 집에 놀러 왔어요`;
  updateAway();
  if (!quiet && ownerId !== me) toast(`${room.owner.nickname}네 집에 도착했어요!`, 'good');
  if (res.party) {
    startPartyView(res.party, true);
    for (const t of res.party.treats) state.scene.addTreat(t);
  }
  if (state.tab === 'home' || ownerId !== me) setTab('home');
  return true;
}

// 집에서 함께 지내는 대표가 아닌 강아지들 (알아서 돌아다녀요)
function addExtras(extras = []) {
  const scene = state.scene;
  for (const id of [...scene.entities.keys()]) if (String(id).startsWith('dog:')) scene.remove(id);
  for (const x of extras) scene.upsert(`dog:${x.id}`, { dog: x.dog, nickname: x.dog.name, auto: true });
}

function updateAway() {
  const sign = $('#away-sign');
  const dog = state.roomOwnerId === myId() ? state.me.dog : null;
  const homeDog = state.room?.homeDog;
  if (dog?.school) {
    sign.hidden = false;
    sign.textContent = `${dog.name}(은)는 멍뭉 학교에 갔어요!`;
  } else if (!dog && homeDog?.atSchool) {
    sign.hidden = false;
    sign.textContent = `${homeDog.name}(은)는 학교에 갔어요`;
  } else sign.hidden = true;
}

// ---------- 1초마다: 수치 표시, 학교 남은 시간 ----------
function tick() {
  const dog = state.me?.dog;
  if (!dog) return;
  if (state.pendingGrowth?.length) flushGrowth();
  const shown = applyDecay(dog, serverNow(), state.speed);
  for (const k of ['fullness', 'cleanliness', 'affection']) {
    const bar = document.getElementById(`bar-${k}`);
    if (bar) {
      bar.style.width = `${shown[k]}%`;
      document.getElementById(`num-${k}`).textContent = Math.round(shown[k]);
    }
  }
  const left = $('#school-left');
  if (left && dog.school) left.textContent = fmtDuration(dog.school.endsAt - serverNow());
}

// ---------- 돌봄 ----------
const CARE_MSG = {
  feed: ['냠냠! 맛있어요!', '와구와구~', '밥이 최고야!'],
  brush: ['털이 뽕긋뽕긋!', '보송보송해졌어요!', '반짝반짝~'],
  pet: ['헤헤, 좋아요!', '더 쓰다듬어 줘!', '꼬리가 살랑살랑~'],
};

async function doCare(action, { quiet = false } = {}) {
  const dog = state.me?.dog;
  if (!dog || state.busy) return;
  if (dog.school) return toast(`${dog.name}(은)는 학교에 가 있어요!`);
  if (!quiet) sfx.bark(barkPitch(dog));
  state.busy = true;
  try {
    const res = await post('/dog/action', { action });
    applyMe(res);
    const r = res.result;
    const scene = state.scene;
    if (r.reaction === 'full') {
      scene.bubble(myId(), 'text', '배불러요~');
      sfx.error();
    } else {
      ({ feed: sfx.eat, brush: sfx.brush, pet: r.reaction === 'love' ? sfx.love : sfx.pet })[action]();
      if (r.coins) setTimeout(sfx.coin, 350);
      scene.care(myId(), r.reaction === 'love' ? 'love' : action);
      // 피츄는 쓰다듬으면 하트가 두 배로 퐁퐁
      if (action === 'pet' && state.me.dog.special === 'pichu') scene.burst(scene.entities.get(myId()), 'heart', 4);
      const msgs = CARE_MSG[action];
      scene.bubble(myId(), 'text', msgs[Math.floor(Math.random() * msgs.length)]);
      if (r.coins) toast(`뼈다귀 코인 +${r.coins}${r.exp ? ` · 경험치 +${r.exp}` : ''}`, 'good');
    }
    tick();
    await handleEvents(res.events);
    if (state.tab === 'home') renderPanel();
  } catch (err) {
    toast(err.message, 'bad');
  } finally {
    setTimeout(() => { state.busy = false; }, 900);
  }
}

function openTricks() {
  const dog = state.me.dog;
  if (dog.school) return toast(`${dog.name}(은)는 학교에 가 있어요!`);
  const known = dog.tricks;
  modal({
    title: `${dog.name}의 개인기`,
    body: el('div', {},
      el('div', { class: 'trick-list' }, Object.entries(TRICKS).map(([id, t]) => {
        const has = known.includes(id);
        return el('button', {
          class: `btn ${has ? 'secondary' : ''}`, disabled: !has,
          title: has ? t.desc : '멍뭉 학교에서 배울 수 있어요',
          onclick: () => {
            closeAllModals();
            state.scene.trick(myId(), id);
            state.scene.bubble(myId(), 'text', `${t.name}!`);
            sfx.bark(barkPitch(dog), 2);
            if (['spin', 'jump', 'roll', 'dance'].includes(id)) sfx.whoosh();
            state.socket?.emit('room:trick', { trick: id });
          },
        }, has ? t.name : '???');
      })),
      dog.special ? el('div', { class: 'special-trick' },
        el('button', {
          class: 'btn special-btn',
          onclick: () => {
            const id = SPECIALS[dog.special].trick;
            closeAllModals();
            state.scene.trick(myId(), id);
            state.scene.bubble(myId(), 'text', `${SPECIAL_TRICKS[id].name}!`);
            sfx.bark(barkPitch(dog), 2); sfx.star();
            state.socket?.emit('room:trick', { trick: id });
          },
        }, `✨ ${SPECIAL_TRICKS[SPECIALS[dog.special].trick].name}`)) : null,
      el('p', { class: 'hint' }, `배운 개인기 ${known.length} / ${Object.keys(TRICKS).length} · 더 자라면 새로운 개인기를 배울 수 있어요.`)),
    buttons: [{ label: '닫기', kind: 'secondary' }],
  });
}

// ---------- 이벤트 (성장, 하교) ----------
// 한 번에 여러 레벨이 오르면 창 하나로 모아서 보여 줘요
function mergeLevelUps(events) {
  const out = [];
  for (const ev of events) {
    const prev = out[out.length - 1];
    if (ev.type === 'levelUp' && prev?.type === 'levelUp') {
      const r = prev.rewards; const n = ev.rewards;
      out[out.length - 1] = {
        ...ev,
        rewards: { coins: r.coins + n.coins, tickets: r.tickets + n.tickets, emotes: [...r.emotes, ...n.emotes], titles: [...r.titles, ...n.titles], frame: Math.max(r.frame, n.frame), hourglass: (r.hourglass ?? 0) + (n.hourglass ?? 0) },
      };
    } else out.push(ev);
  }
  return out;
}

async function handleEvents(events = []) {
  for (const ev of mergeLevelUps(events)) {
    if (ev.type === 'levelUp') await playLevelUp(state.me.dog, ev);
    if (ev.type === 'talentUp') await showTalentUp(ev);
    if (ev.type === 'questDone') { sfx.coin(); toast(`약속 완료! "${ev.text}" · 코인 +${ev.coins}`, 'good'); }
    if (ev.type === 'stamp') { sfx.levelUp(); await waitModal({ title: ev.full ? '도장판 완성!' : '도장 쾅!', className: 'celebrate', body: stampBody(ev) }); }
    if (ev.type === 'badge') { sfx.star(); await waitModal({ title: '새 배지를 얻었어요!', className: 'celebrate', body: badgeBody(ev) }); }
    if (ev.type === 'mail') { sfx.notify(); toast(`💌 ${ev.from}(이)가 편지를 남겼어요! 우편함을 열어 보세요.`, 'good'); }
    if (ev.type === 'dex') toast(`견종 도감에 ${ev.name} 등록!`, 'good');
    if (ev.type === 'special') await playSpecialReveal(state.me.dog, ev);
    if (ev.type === 'specialGift') { sfx.levelUp(); await waitModal({ title: '🎁 스페셜 친구 선물!', className: 'celebrate', body: specialGiftBody(ev) }); }
    if (ev.type === 'specialLost') toast(`${SPECIALS[ev.key]?.name ?? '스페셜'} 모습에서 원래 모습으로 돌아왔어요.`);
    if (ev.type === 'grew') await showGrew(ev);
    if (ev.type === 'schoolDone') await showReport(ev.report, true);
    if (ev.type === 'askDone') {
      sfx.love();
      state.scene?.effectAt?.(myId(), 'heart', 4);
      toast(`💗 소원을 들어줬어요! "${ev.text}" · 💗+${ev.hearts} · 코인 +${ev.coins}`, 'good');
      if (ev.gift) await chooseAskGift(ev.gift);
    }
    if (ev.type === 'lucky') {
      sfx.star();
      state.scene?.popNumbers(myId(), [{ text: '🎉 대성공! ×2', cls: 'lucky' }]);
      state.scene?.effectAt?.(myId(), 'star', 4);
    }
    if (ev.type === 'runLevel') { sfx.star(); toast(`🏃 멍뭉런 레벨 UP! 런 Lv ${ev.level}`, 'good'); }
    if (ev.type === 'runMap') await showRunMap(ev);
    if (ev.type === 'courseLevel') {
      sfx.star();
      if (ev.exam) await waitModal({ title: `${ev.name} Lv ${ev.level}!`, className: 'celebrate', body: el('p', { class: 'center' }, `${CERTS[ev.exam].emoji} ${CERTS[ev.exam].name} 시험을 볼 수 있어요! 학교 탭에서 도전해 봐요.`), buttons: [{ label: '도전할래!' }] });
      else toast(`📚 ${ev.name} 과목 Lv ${ev.level}!`, 'good');
    }
    if (ev.type === 'cert') { sfx.levelUp(); await waitModal({ title: '🎉 자격증을 땄어요!', className: 'celebrate', body: certBody(ev, state.me.dog, state.me.user.nickname), buttons: [{ label: '최고야!' }] }); }
  }
}

function showTalentUp(ev) {
  if (!ev.perks.length && !ev.titleNames.length) {
    sfx.star();
    toast(`${ev.name} 재능이 ${ev.stage}단계가 되었어요!`, 'good');
    return null;
  }
  sfx.levelUp();
  return waitModal({ title: `${ev.name} 재능 ${ev.stage}단계!`, className: 'celebrate', body: talentUpBody(ev) });
}

// 아기 강아지 선물 상자: 열어 보고 이름을 지어 주면 새 가족!
function openBabyBox(m) {
  const b = m.baby;
  if (m.claimed) { toast('이미 우리 가족이 되었어요!'); return; }
  const input = el('input', { class: 'chat-input', maxlength: 8, placeholder: '아기 이름 (2~8글자)', 'aria-label': '아기 이름' });
  const reveal = el('div', { class: 'baby-reveal', hidden: true },
    el('img', { class: 'pixel baby-img', src: dogPortrait(b.breed, 0), alt: '' }),
    el('h3', {}, breedOf(b.breed)?.name ?? '아기 강아지'),
    el('p', { class: 'help' }, `${PERSONALITIES[b.personality]?.emoji ?? ''} ${PERSONALITIES[b.personality]?.name ?? ''} · 👪 ${b.parents.map((p) => `${p.name}(${p.owner})`).join(' & ')}의 아기`),
    input);
  const giftBox = el('button', { class: 'baby-box', type: 'button' }, el('img', { class: 'pixel', src: iconURL('heart', 6), alt: '' }), el('span', {}, '톡 눌러서 열어 보기!'));
  const { close } = modal({
    title: '아기 강아지 선물 상자',
    className: 'celebrate baby-modal',
    body: el('div', { class: 'center' }, el('p', {}, m.body), giftBox, reveal),
    buttons: [
      { label: '나중에', kind: 'secondary' },
      {
        label: '우리 가족이 되어 줘!',
        onClick: async () => {
          if (reveal.hidden) { giftBox.click(); return false; }
          try {
            const res = await post('/baby/adopt', { mailId: m.id, name: input.value.trim() });
            close();
            applyMe(res);
            const sp = res.events.find((e) => e.type === 'special');
            if (sp) await playSpecialReveal(res.dog, sp);
            await enterRoom(myId(), { quiet: true });
            setTab('home');
            sfx.levelUp();
            toast(`${res.dog.name}(이)가 우리 집 막내가 되었어요!`, 'good');
          } catch (err) { toast(err.message, 'bad'); }
          return false;
        },
      },
    ],
  });
  giftBox.addEventListener('click', () => {
    giftBox.classList.add('opening');
    sfx.pop();
    setTimeout(() => { giftBox.hidden = true; reveal.hidden = false; sfx.levelUp(); input.focus(); }, 700);
  });
}

async function openMail() {
  try {
    await openMailbox({
      api, post,
      itemName: (id) => ITEMS[id]?.name ?? '선물',
      onBaby: openBabyBox,
      onOpened: (res) => { applyMe(res); if (state.tab === 'home') renderPanel(); },
      playCapsule: async (result) => {
        await playGacha(result, itemThumb);
        await handleEvents(result.events ?? []);
        renderPanel();
      },
    });
  } catch (err) { toast(err.message, 'bad'); }
}

// 여럿이 하는 놀이 중에 레벨업하면 놀이가 끝나고 창이 다 닫힌 뒤에 보여 줘요
function queueGrowth(events) {
  state.pendingGrowth = [...(state.pendingGrowth ?? []), ...events];
  flushGrowth();
}
async function flushGrowth() {
  if (!state.pendingGrowth?.length || state.flushingGrowth) return;
  if ($('#modal-root').children.length || state.coop?.session || document.querySelector('.runner-screen')) return;
  state.flushingGrowth = true;
  try {
    const me = await api('/me');
    applyMe(me);
    const events = state.pendingGrowth;
    state.pendingGrowth = [];
    await handleEvents([...events, ...me.events]);
    renderPanel();
  } catch { /* 다음에 다시 */ } finally { state.flushingGrowth = false; }
}

function openRename() {
  const input = el('input', { class: 'chat-input', maxlength: 8, placeholder: '새 이름 (2~8글자)', value: state.me.dog.name, 'aria-label': '새 이름' });
  modal({
    title: '이름표 바꾸기',
    body: el('div', { class: 'center' },
      el('p', {}, `뼈다귀 코인 ${RENAME_PRICE}개로 강아지 이름을 바꿀 수 있어요.`),
      input,
      el('p', { class: 'hint' }, '어떤 이름은… 특별한 일이 생긴대요! 🤫')),
    buttons: [
      { label: '그만두기', kind: 'secondary' },
      {
        label: '바꾸기',
        onClick: async () => {
          try {
            const res = await post('/dog/rename', { name: input.value.trim() });
            closeAllModals();
            applyMe(res);
            toast(`이제 이름은 ${res.dog.name}!`, 'good');
            await handleEvents(res.events);
            renderPanel();
          } catch (err) { toast(err.message, 'bad'); return false; }
          return true;
        },
      },
    ],
  });
}

function showcaseIcons(ids = []) {
  return ids.map((id) => badgeIcon(id, { size: 2 })).filter(Boolean);
}

// 자랑 카드: 지금 화면(우리 집 장면)에서 내 강아지 주변을 카드 그림으로 써요
function openBragCard() {
  unlock(); sfx.shutter();
  const e = state.scene?.entities.get(myId());
  const scene = e && state.scene?.canvas ? { canvas: state.scene.canvas, x: e.x, y: e.y } : null;
  openDogCardMaker(state.me.dog, state.me.user, state.me.progress, { scene });
}

function openMyCard() {
  openDogCard(state.me.dog, {
    mine: true,
    badges: showcaseIcons(state.me.progress?.showcase),
    onRename: openRename,
    onPhotoCard: openBragCard,
    onTitle: async (title) => {
      try {
        const me = await post('/dog/title', { title });
        applyMe(me);
        if (state.tab === 'home') renderPanel();
        toast(title ? '칭호를 달았어요!' : '칭호를 뗐어요.', 'good');
        return true;
      } catch (err) { toast(err.message, 'bad'); return false; }
    },
  });
}

function waitModal(opts) {
  return new Promise((resolve) => {
    const buttons = (opts.buttons ?? [{ label: '좋아요!' }]).map((b) => ({ ...b, onClick: async () => { const r = b.onClick ? await b.onClick() : undefined; if (r !== false) resolve(); return r; } }));
    modal({ ...opts, buttons, dismissable: false });
  });
}

function showGrew(ev) {
  const dog = state.me.dog;
  sfx.levelUp();
  return waitModal({
    title: `${dog.name}(이)가 ${ev.stageName}(으)로 자랐어요!`,
    className: 'celebrate',
    body: el('div', { class: 'center' },
      el('img', { class: 'pixel', src: dogPortrait(dog.breed, ev.stage, { equip: dog.equip }), alt: '' }),
      el('p', {}, '몸도 커지고 털도 더 풍성해졌어요!'),
      ev.trick ? el('p', {}, '성장 선물로 ', el('span', { class: 'learned' }, TRICKS[ev.trick].name), ' 개인기를 배웠어요!') : null,
      el('p', { class: 'help' }, '새로운 꾸미기 아이템도 살 수 있어요.')),
    buttons: [{ label: '축하해!' }],
  });
}

function reportNode(r) {
  const stars = (n) => el('span', { class: 's' }, [1, 2, 3].map((i) => el('img', { class: 'pixel', src: iconURL('star', 2), style: { opacity: i <= n ? 1 : 0.2 }, alt: i <= n ? '★' : '☆' })));
  const date = new Date(r.date);
  return el('div', { class: 'notebook' },
    el('span', { class: 'stamp-good' }, r.early ? '다음엔\n끝까지!' : '참\n잘했어요'),
    el('div', { class: 'date' }, `${date.getMonth() + 1}월 ${date.getDate()}일 · ${r.courseName}`),
    el('div', {}, el('strong', {}, `${r.dogName}의 알림장`)),
    el('div', { class: 'stamps' }, REPORT_SUBJECTS.map((s) => [el('span', {}, s), stars(r.stamps[s] ?? 1)]).flat()),
    el('div', { class: 'teacher' }, `선생님 한마디: ${r.comment}`),
    r.trick ? el('div', {}, '새 개인기: ', el('span', { class: 'learned' }, r.trickName)) : el('div', {}, '오늘은 배운 개인기를 복습했어요.'),
    el('div', {}, `받은 선물: 뼈다귀 코인 ${r.coins}개 · 경험치 ${r.exp}`));
}

function showReport(r, fresh = false) {
  if (fresh) sfx.bell();
  if (r.id && !r.read) post(`/reports/${r.id}/read`).catch(() => {});
  const p = waitModal({
    title: fresh ? `${r.dogName}(이)가 학교에서 돌아왔어요!` : '알림장',
    body: reportNode(r),
    buttons: [{ label: '확인했어요' }],
  });
  if (fresh) api('/me').then(applyMe).catch(() => {});
  return p;
}

// ---------- 패널 ----------
function renderPanel() {
  updateChatDock();
  updateAskBubble();
  const panel = $('#panel');
  const render = {
    home: () => (atHome() ? homePanel() : visitPanel()),
    school: schoolPanel,
    closet: closetPanel,
    friends: friendsPanel,
    play: playPanel,
    notebook: notebookPanel,
  }[state.tab];
  const out = render();
  if (out instanceof Promise) {
    out.then((node) => { if (node) panel.replaceChildren(node); }).catch((err) => toast(err.message, 'bad'));
  } else panel.replaceChildren(out);
  tick();
}

function statRow(key, label, icon, color) {
  return el('div', { class: 'stat' },
    el('img', { class: 'pixel', src: iconURL(icon, 2), alt: '' }),
    el('span', {}, label),
    el('div', { class: 'bar' }, el('i', { id: `bar-${key}`, style: { background: color, width: '0%' } })),
    el('span', { class: 'num', id: `num-${key}` }, ''));
}

function homePanel() {
  const dog = state.me.dog;
  const p = PERSONALITIES[dog.personality];
  const g = dog.growth;
  const away = !!dog.school;
  return el('div', {},
    el('h3', {}, `${dog.name}`, el('span', { class: 'chip' }, `${breedOf(dog.breed)?.name ?? ''}`), el('span', { class: 'chip' }, `${p.emoji} ${p.name}`)),
    el('div', { class: 'stats' },
      statRow('fullness', '포만감', 'food', 'var(--stat-full)'),
      statRow('cleanliness', '청결도', 'sparkle', 'var(--stat-clean)'),
      statRow('affection', '애정도', 'heart', 'var(--stat-love)')),
    el('div', { class: 'level-row' },
      levelBar(dog),
      el('button', { class: 'btn small secondary card-btn', onclick: openMyCard }, '강아지 카드'),
      el('button', { class: 'btn small primary card-btn', onclick: openBragCard }, '📸 자랑 카드')),
    el('div', { class: 'growth' },
      titleChip(dog),
      dog.special ? el('button', { class: 'chip special-chip', onclick: () => modal({ title: `✨ ${SPECIALS[dog.special].name}의 스페셜 능력`, body: specialPerkList(dog.special), buttons: [{ label: '멋져!' }] }) }, '✨ 스페셜 능력') : null,
      g ? `다음 성장: ${g.next} (${[g.level < g.needLevel ? `Lv ${g.needLevel}까지` : null, g.days < g.needDays ? `함께한 날 ${g.days}/${g.needDays}일` : null].filter(Boolean).join(' · ') || '곧 자라요!'})`
        : '늠름한 강아지로 다 자랐어요! 레벨은 앞으로도 계속 올라요.'),
    away ? el('div', { class: 'school-board' }, `${dog.name}(은)는 학교에서 공부 중이에요`, el('div', { class: 'big', id: 'school-left' }, ''), '돌아오면 알림장을 받을 수 있어요!',
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onclick: leaveSchool }, '조퇴하고 데려오기'),
        el('button', { class: 'btn small primary', onclick: () => setTab('school') }, '빨리 오게 하기'))) : null,
    el('div', { class: 'actions' },
      actionBtn(`밥주기${state.me.food ? ` ${state.me.food.n}/${FOOD.kibbleMax}` : ''}`, 'food', openFoodBowl, away),
      actionBtn('빗질하기', 'brush', () => doCare('brush'), away),
      actionBtn('쓰다듬기', 'heart', () => doCare('pet'), away),
      actionBtn('개인기', 'star', openTricks, away)),
    questCard(state.me.progress),
    dogsRow(),
    partyButton(),
    bondList());
}

// ---------- 마이룸 미니게임: 네컷 포토부스 & 합동 줄넘기 ----------
// 같은 방에 친구 강아지가 있으면 그 강아지와, 없으면 이웃집 초코와 함께 해요.
const NEIGHBOR = { name: '초코', breed: 'shiba', personality: 'hyper', stage: 1, equip: {}, fluff: 0, tricks: [], mood: 'happy' };

function partner() {
  const e = [...(state.scene?.entities.values() ?? [])].find((x) => x.id !== myId() && x.dog && !x.dog.atSchool);
  return e ? { dog: e.dog, name: e.dog.name } : { dog: NEIGHBOR, name: '이웃집 초코' };
}

async function startPhotobooth() {
  unlock();
  const p = partner();
  const mine = publicDog(state.me.dog);
  let again = 'again';
  while (again === 'again') {
    again = await playPhotobooth([mine, p.dog], [mine.name, p.dog.name], { charm: state.me.dog.talentStages?.charm ?? 1 });
  }
  if (state.tab === 'play') renderPanel();
}

async function startJumpRope() {
  unlock();
  const p = partner();
  const mine = publicDog(state.me.dog);
  // 랭킹용: 시작 시각을 서버에 먼저 알려 두고, 끝나면 이번 판 최고 콤보를 보내요 (실패해도 놀이는 그대로)
  const rope = await post('/rope/start', {}).catch(() => null);
  const result = await playJumpRope(mine, p.dog, [mine.name, p.dog.name]);
  if (rope && result?.session > 0) {
    try { lbToast((await post('/rope/finish', { ropeId: rope.ropeId, combo: result.session })).lb); } catch { /* 랭킹만 빠져요 */ }
  }
  if (state.tab === 'play') renderPanel();
}

function openAlbum() {
  const list = loadAlbum();
  const { close } = modal({
    title: '멍뭉네컷 앨범',
    body: list.length
      ? el('div', { class: 'album-grid' }, list.map((ph) => el('button', {
        class: 'album-item', type: 'button',
        onclick: () => {
          close();
          modal({
            title: `${new Date(ph.date).getMonth() + 1}월 ${new Date(ph.date).getDate()}일`,
            body: el('div', { class: 'polaroid' }, el('img', { src: ph.url, alt: '멍뭉네컷 사진' })),
            buttons: [
              { label: '지우기', kind: 'secondary', onClick: () => { removeFromAlbum(ph.id); toast('사진을 지웠어요.'); } },
              { label: '사진 파일로 받기', onClick: () => { downloadPhoto(ph.url); return false; } },
            ],
          });
        },
      }, el('img', { src: ph.url, alt: '' }), el('span', {}, ph.names?.join(' & ') ?? ''))))
      : el('p', { class: 'help center' }, '아직 사진이 없어요. 네컷 포토부스에서 찍어 보세요!'),
    buttons: [{ label: '닫기' }],
  });
}

// ---------- 간식 파티 (친구와 실시간 대결) ----------
function partyButton() {
  const others = (state.room?.members ?? []).filter((m) => m.userId !== myId()).length;
  if (!others) return null;
  return el('div', { class: 'party-card' },
    el('div', {},
      el('div', { class: 'title' }, '간식 파티'),
      el('div', { class: 'meta' }, '30초 동안 떨어지는 간식을 누가 더 많이 먹을까? 바닥을 눌러 달려가요!')),
    el('button', {
      class: 'btn primary', disabled: !!state.party || !!state.me.dog.school,
      onclick: async () => {
        unlock();
        const res = await emitAck('party:start', {});
        if (!res.ok) toast(res.reason, 'bad');
      },
    }, state.party ? '파티 중!' : '시작!'));
}

function startPartyView(party, quiet = false) {
  state.party = { endsAt: party.endsAt - state.offset, scores: party.scores };
  state.scene.partyMode = true;
  state.scene.clearTreats();
  const me = state.scene.entities.get(myId());
  if (me && me.state === 'sleep') { me.state = 'idle'; me.stateT = 0; }
  let hud = $('#party-hud');
  if (!hud) { hud = el('div', { id: 'party-hud', class: 'party-hud' }); $('.stage').append(hud); }
  if (!quiet) { sfx.bell(); toast('간식 파티 시작! 바닥을 눌러서 간식으로 달려가요!', 'good'); }
  playBgm('play');
  clearInterval(state.partyTimer);
  state.partyTimer = setInterval(renderPartyHud, 250);
  renderPartyHud();
  if (state.tab === 'home') renderPanel();
}

function renderPartyHud() {
  const hud = $('#party-hud');
  if (!hud || !state.party) return;
  const left = Math.max(0, Math.ceil((state.party.endsAt - Date.now()) / 1000));
  const rows = Object.entries(state.party.scores)
    .map(([id, score]) => ({ id: Number(id), score, name: state.scene.entities.get(Number(id))?.nickname ?? '친구' }))
    .sort((a, b) => b.score - a.score);
  hud.replaceChildren(
    el('div', { class: 'party-time' }, `${left}초`),
    ...rows.map((r) => el('div', { class: `party-row ${r.id === myId() ? 'me' : ''}` }, el('span', {}, r.name), el('b', {}, r.score))));
}

function stopPartyView() {
  state.party = null;
  clearInterval(state.partyTimer);
  $('#party-hud')?.remove();
  if (state.scene) { state.scene.partyMode = false; state.scene.clearTreats(); }
}

async function endPartyView(results) {
  stopPartyView();
  playBgm('home');
  const mine = results.find((r) => r.userId === myId());
  if (mine?.winner) sfx.levelUp(); else sfx.bell();
  if (state.tab === 'home') renderPanel();
  modal({
    title: '간식 파티 결과!',
    body: el('div', { class: 'party-results' }, results.map((r, i) => {
      const dog = state.scene.entities.get(r.userId)?.dog;
      return el('div', { class: `party-result ${r.userId === myId() ? 'me' : ''}` },
        el('span', { class: 'rank' }, r.winner ? '👑' : `${i + 1}`),
        dog ? el('img', { class: 'pixel', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip }), alt: '' }) : el('span'),
        el('div', {}, el('b', {}, r.nickname ?? '친구'), el('div', { class: 'meta' }, `간식 ${r.score}개 · 코인 +${r.coins}`)));
    }), el('p', { class: 'hint' }, '같이 놀아서 강아지들이 더 친해졌어요!')),
    buttons: [{ label: '또 하자!' }],
  });
  refreshMe();
}

// 같은 방에 있는 강아지들과의 친밀도
function bondList() {
  const others = [...state.scene.entities.values()].filter((e) => e.id !== myId() && e.dog && !e.dog.atSchool);
  if (!others.length) return null;
  const mine = state.me.dog;
  return el('div', { class: 'bonds' },
    el('div', { class: 'section-title' }, '강아지 친구들'),
    others.map((e) => {
      const b = state.bonds[e.id] ?? { points: 0, level: 0, name: BOND_LEVELS[0].name, next: BOND_LEVELS[1].min };
      const from = BOND_LEVELS[b.level].min;
      const ratio = b.next ? (b.points - from) / (b.next - from) : 1;
      return el('div', { class: 'bond' },
        el('img', { class: 'pixel', src: dogPortrait(e.dog.breed, e.dog.stage, { equip: e.dog.equip }), alt: '' }),
        el('div', {},
          el('div', { class: 'title' }, e.dog.name, el('span', { class: 'hearts' }, '♥'.repeat(b.level + 1) + '♡'.repeat(BOND_LEVELS.length - 1 - b.level))),
          el('div', { class: 'meta' }, b.name),
          el('div', { class: 'bar' }, el('i', { style: { width: `${Math.round(ratio * 100)}%` } }))),
        el('button', {
          class: 'btn small green', disabled: !!mine.school,
          onclick: () => state.socket?.emit('room:play', { userId: e.id }),
        }, '같이 놀기'));
    }),
    el('p', { class: 'hint' }, '같은 방에서 함께 있거나, 쓰다듬고, 같이 놀면 친밀도가 올라요.'));
}

// 친한 강아지가 같은 방에 있으면 가끔 먼저 달려가서 놀아요
function autoPlay() {
  const dog = state.me?.dog;
  if (!dog || dog.school || !state.room || document.hidden) return;
  const me = state.scene.entities.get(myId());
  if (!me || me.state !== 'idle') return;
  const friends = [...state.scene.entities.values()].filter((e) => e.id !== myId() && e.dog && !e.dog.atSchool && (state.bonds[e.id]?.level ?? 0) >= 1);
  if (!friends.length || Math.random() > 0.4) return;
  state.socket?.emit('room:play', { userId: friends[Math.floor(Math.random() * friends.length)].id });
}

function leaveSchool() {
  const dog = state.me.dog;
  modal({
    title: '조퇴할까요?',
    body: el('p', { class: 'center' }, `지금 ${dog.name}(을)를 데려오면 학교에 있었던 시간만큼만 선물을 받아요. 절반 넘게 있어야 개인기를 배울 수 있어요.`),
    buttons: [
      { label: '더 있을래', kind: 'secondary' },
      {
        label: '데려올래요',
        onClick: async () => {
          try {
            const res = await post('/school/leave');
            applyMe(res);
            const e = state.scene.entities.get(myId());
            if (e) e.dog = publicDog(res.dog);
            updateAway();
            await handleEvents(res.events);
            renderPanel();
          } catch (err) { toast(err.message, 'bad'); }
        },
      },
    ],
  });
}

function actionBtn(label, icon, onclick, disabled) {
  return el('button', { class: 'btn action', onclick, disabled }, el('img', { class: 'pixel', src: iconURL(icon, 3), alt: '' }), label);
}

function visitPanel() {
  const room = state.room;
  if (!room) return homePanel();
  const dog = room.homeDog;
  const mine = state.me.dog;
  return el('div', {},
    el('h3', {}, `${room.owner.nickname}네 집`),
    dog ? el('p', { class: 'sub' }, `${dog.name} · ${breedOf(dog.breed)?.name ?? ''} · ${PERSONALITIES[dog.personality].name} · ${STAGES[dog.stage].name}`) : null,
    dog?.level ? el('div', { class: 'growth' },
      el('span', { class: `lv-badge frame-${dog.frame ?? 0}` }, `Lv ${dog.level}`), titleChip(dog),
      el('button', { class: 'btn small secondary card-btn', onclick: () => openDogCard(dog, { ownerName: room.owner.nickname, badges: showcaseIcons(dog.showcase) }) }, '강아지 카드')) : null,
    el('div', { class: 'actions' },
      actionBtn(dog ? `${dog.name} 쓰다듬기` : '쓰다듬기', 'heart', () => state.socket.emit('room:pet', { userId: room.owner.id }), !dog || dog.atSchool),
      actionBtn('개인기', 'star', openTricks, !!mine.school),
      actionBtn(`${mine.name} 쓰다듬기`, 'paw', () => doCare('pet'), !!mine.school),
      actionBtn('집으로', 'paw', () => enterRoom(myId()), false)),
    partyButton(),
    bondList());
}

// ---------- 채팅 창: 장면 바로 아래에 붙어 있어서 말풍선을 보면서 쓸 수 있어요 ----------
// 친구가 우리 집(또는 친구 집)에 같이 있을 때와 놀이터에서만 보여요. 지나간 말은 위쪽 기록에 남아요.
const chatDock = { mode: null, node: null };
function initChatDock() {
  if (chatDock.node) return;
  const log = el('div', { class: 'chat-log', 'aria-live': 'polite' });
  const input = el('input', { class: 'chat-input', maxlength: 20, placeholder: '친구에게 한마디 (20자)', 'aria-label': '채팅', enterkeyhint: 'send' });
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    const res = await emitAck('room:chat', { text });
    if (res.ok) input.value = '';
    else toast(res.reason, 'bad');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  // 글자를 쓸 때 장면(말풍선)과 채팅 창이 같이 보이게 올려 줘요
  input.addEventListener('focus', () => setTimeout(() => document.querySelector('.stage-wrap')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250));
  const sendBtn = el('button', { class: 'btn small primary', onclick: send }, '보내기');
  const note = el('span', { class: 'chat-note' });
  const tray = el('div', { class: 'chat-tray', hidden: true },
    el('div', { class: 'stickers' }, Object.entries(STICKERS).map(([id, name]) => el('button', {
      class: 'sticker', title: name, 'aria-label': name, onclick: () => state.socket?.emit(`${chatDock.mode}:sticker`, { id }),
    }, el('img', { class: 'pixel', src: iconURL(id, 3), alt: '' })))),
    el('div', { class: 'phrases' }, PHRASES.map((text, index) => el('button', {
      class: 'phrase', onclick: () => state.socket?.emit(`${chatDock.mode}:phrase`, { index }),
    }, text))));
  const trayBtn = el('button', { class: 'btn small tray-btn', type: 'button', 'aria-label': '스티커와 말', onclick: () => { tray.hidden = !tray.hidden; trayBtn.classList.toggle('on', !tray.hidden); } }, '😊');
  const node = el('div', { class: 'chat-dock', hidden: true },
    log,
    el('div', { class: 'chat-dock-row' }, trayBtn, input, note, sendBtn),
    tray);
  document.querySelector('.stage-wrap').after(node);
  Object.assign(chatDock, { node, log, input, sendBtn, note, tray, trayBtn });
}

function updateChatDock() {
  initChatDock();
  const mode = state.plaza ? 'plaza' : (state.room?.members.length ?? 0) > 1 ? 'room' : null;
  const d = chatDock;
  if (mode !== d.mode) { d.log.replaceChildren(); d.tray.hidden = mode !== 'plaza'; d.trayBtn.classList.toggle('on', mode === 'plaza'); }
  d.mode = mode;
  d.node.hidden = !mode;
  const canType = mode === 'room' && state.chatAllowed;
  d.input.hidden = !canType; d.sendBtn.hidden = !canType; d.note.hidden = canType;
  d.note.textContent = mode === 'plaza' ? '놀이터는 스티커와 말로만 이야기해요' : '모두와 친구가 되면 글자도 쓸 수 있어요';
  d.log.hidden = !d.log.children.length;
}

function logChat(userId, kind, value) {
  if (!chatDock.node || !chatDock.mode) return;
  const mine = userId === myId();
  const name = mine ? '나' : state.plaza
    ? state.plaza.view.entities.get(userId)?.nickname
    : state.room?.members.find((m) => m.userId === userId)?.nickname;
  const line = el('div', { class: `chat-line ${mine ? 'mine' : ''}` },
    el('b', {}, name ?? '친구'),
    kind === 'sticker' ? el('img', { class: 'pixel', src: iconURL(value, 2), alt: STICKERS[value] ?? '' }) : el('span', {}, value));
  chatDock.log.append(line);
  while (chatDock.log.children.length > 30) chatDock.log.firstChild.remove();
  chatDock.log.hidden = false;
  chatDock.log.scrollTop = chatDock.log.scrollHeight;
}

function schoolPanel() {
  const dog = state.me.dog;
  if (dog.school) {
    const c = SCHOOL_COURSES[dog.school.course];
    return el('div', {},
      el('h3', {}, '멍뭉 학교'),
      el('div', { class: 'school-board' }, `${c.name} 중이에요!`, el('div', { class: 'big', id: 'school-left' }, ''), `${dog.name}(이)가 열심히 배우고 있어요. 학교에 있는 동안은 선생님이 돌봐 주셔서 배고프지 않아요.`),
      boostCard(true),
      el('button', { class: 'btn secondary', style: { width: '100%' }, onclick: leaveSchool }, '조퇴하고 데려오기'),
      el('p', { class: 'hint' }, '조퇴하면 다닌 시간만큼만 선물을 받아요. 아이템으로 빨리 끝내면 선물을 다 받아요!'));
  }
  const real = (m) => fmtDuration((m * 60_000) / state.speed);
  const tab = state.schoolTab ?? 'train';
  const left = state.me.trainingLeft ?? TRAINING.dailyLimit;
  const pickTab = (k) => { state.schoolTab = k; sfx.tap(); renderPanel(); };
  // 맨 위에서 두 가지를 바로 고를 수 있게: 같이 훈련 / 혼자 학교 보내기
  const switcher = el('div', { class: 'school-switch', role: 'tablist' },
    el('button', { class: `school-tab ${tab === 'train' ? 'on' : ''}`, role: 'tab', 'aria-selected': String(tab === 'train'), onclick: () => pickTab('train') },
      el('span', { class: 'icon' }, '🎓'),
      el('b', {}, '같이 훈련'),
      el('small', {}, `오늘 ${left}번 남음`)),
    el('button', { class: `school-tab ${tab === 'school' ? 'on' : ''}`, role: 'tab', 'aria-selected': String(tab === 'school'), onclick: () => pickTab('school') },
      el('span', { class: 'icon' }, '🚌'),
      el('b', {}, '학교 보내기'),
      el('small', {}, '혼자 다녀와요')));
  if (tab === 'train') {
    return el('div', {},
      el('h3', {}, '멍뭉 학교'),
      switcher,
      trainingSection(dog, {
        now: serverNow(), left,
        onStart: (course, exam) => startTraining(course, exam),
        onBook: () => openTrainingBook(dog, state.me.user.owned),
      }));
  }
  return el('div', {},
    el('h3', {}, '멍뭉 학교'),
    switcher,
    el('p', { class: 'sub school-sub' }, `수업을 고르면 ${dog.name}(이)가 혼자 학교에 가요. 다녀오는 동안은 돌봐 줄 수 없고, 돌아오면 알림장과 선물을 받아요!`),
    el('div', { class: 'school-list' }, Object.entries(SCHOOL_COURSES).map(([id, c]) => el('div', { class: 'school-item' },
      el('div', { class: 'school-time' }, el('b', {}, real(c.minutes)), el('small', {}, '다녀와요')),
      el('div', { class: 'school-info' },
        el('b', {}, c.name),
        el('small', {}, c.desc),
        el('div', { class: 'school-gifts' },
          el('span', {}, `🦴 ${c.coins}`), el('span', {}, `⭐ ${c.exp}`), el('span', {}, `🎵 개인기 ${Math.round(c.trickChance * 100)}%`))),
      el('button', {
        class: 'btn small green',
        onclick: () => modal({
          title: `${c.name}에 보낼까요?`,
          body: el('p', { class: 'center' }, `${real(c.minutes)} 뒤에 돌아와요. 다녀오는 동안 쓰다듬거나 밥을 줄 수 없어요.`),
          buttons: [
            { label: '다음에', kind: 'secondary' },
            { label: '다녀와!', onClick: () => goSchool(id) },
          ],
        }),
      }, '보내기')))),
    boostCard(false));
}

// 학교 시간 아이템: 셔틀버스표(코인으로 사요) · 반짝 모래시계(선물로만)
function boostCard(atSchool) {
  const { user } = state.me;
  const today = new Date(serverNow() + 9 * 3600_000).toISOString().slice(0, 10);
  const used = user.boostDay?.date === today ? user.boostDay.n : 0;
  const left = Math.max(0, BOOST_RULES.dailyUses - used);
  return el('div', { class: 'boost-card' },
    el('div', { class: 'boost-head' },
      el('b', {}, atSchool ? '시간 빨리 가게 하기' : '학교 시간 아이템'),
      el('span', { class: 'meta' }, `오늘 ${left}번 더 쓸 수 있어요`)),
    Object.entries(SCHOOL_BOOSTS).map(([id, b]) => {
      const have = user.boosts?.[id] ?? 0;
      return el('div', { class: 'boost-row' },
        el('img', { class: 'pixel', src: iconURL(b.icon, 3), alt: '' }),
        el('div', { class: 'boost-info' },
          el('b', {}, b.name, el('span', { class: 'chip' }, `${have}개`)),
          el('small', {}, b.desc),
          b.price ? null : el('small', { class: 'gift-only' }, '선물로 받아요: 환영 편지 · 도장판 완성 · 5레벨마다')),
        el('div', { class: 'boost-btns' },
          atSchool ? el('button', { class: 'btn small primary', disabled: !have || !left, onclick: () => useBoost(id) }, '쓰기') : null,
          b.price ? el('button', { class: 'btn small', onclick: () => buyBoost(id) },
            el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '코인' }), b.price) : null));
    }));
}

async function buyBoost(id) {
  try {
    const res = await post('/shop/boost', { id });
    applyMe(res);
    sfx.coin();
    toast(`${SCHOOL_BOOSTS[id].name}을(를) 샀어요!`, 'good');
    renderPanel();
  } catch (err) { sfx.error(); toast(err.message, 'bad'); }
}

async function useBoost(id) {
  try {
    const res = await post('/school/boost', { id });
    applyMe(res);
    if (id === 'bus') { sfx.whoosh(); toast('슝슝! 셔틀버스가 빨리 달려요. 남은 시간이 절반이 됐어요!', 'good'); } else sfx.star();
    await handleEvents(res.events);
    renderPanel();
  } catch (err) { sfx.error(); toast(err.message, 'bad'); }
}

async function startTraining(course = 'command', exam = false) {
  const dog = state.me.dog;
  try {
    unlock();
    const info = await post('/training/start', { course, exam });
    const score = await playTraining(publicDog(dog), info);
    const res = await post('/training/finish', { trainingId: info.trainingId, target: info.target, ...score });
    applyMe(res);
    const r = res.result;
    if (r.refunded) {
      toast('수업을 그만뒀어요. 오늘 훈련 횟수는 그대로 남아 있어요!');
    } else if (r.learned) {
      sfx.levelUp();
      await waitModal({
        title: '새 개인기를 배웠어요!',
        className: 'celebrate',
        body: el('div', { class: 'center' },
          el('img', { class: 'pixel', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip }), alt: '' }),
          el('p', {}, el('span', { class: 'learned' }, r.learnedName), ` 개인기를 할 수 있게 됐어요!`),
          el('p', { class: 'help' }, '우리집에서 개인기 버튼으로 보여 줄 수 있어요.')),
        buttons: [{ label: '최고야!' }],
      });
    } else {
      if (r.perfect || r.exam?.passed) sfx.levelUp(); else if (r.coins) sfx.coin();
      await waitModal({ title: r.exam ? '시험 결과' : '수업 끝!', className: r.perfect || r.exam?.passed ? 'celebrate' : '', body: trainResultBody(r, dog), buttons: [{ label: '좋아요!' }] });
    }
    await handleEvents(res.events);
    renderPanel();
  } catch (err) { toast(err.message, 'bad'); renderPanel(); }
}

async function goSchool(course) {
  try {
    const res = await post('/school', { course });
    applyMe(res);
    sfx.bell();
    const e = state.scene.entities.get(myId());
    if (e) e.dog = publicDog(res.dog);
    updateAway();
    toast(`${res.dog.name}(이)가 학교에 갔어요! 잘 다녀와~`, 'good');
    renderPanel();
  } catch (err) { toast(err.message, 'bad'); }
}

function roomThumb(id) {
  const item = ITEMS[id];
  const c = renderRoom({ wallpaper: item.slot === 'wallpaper' ? id : 'wall_wood', [item.slot]: id });
  const crop = { wallpaper: [0, 0, 64, 48], rug: [52, 104, 96, 32], bed: [8, 70, 56, 40], toy: [136, 110, 28, 24] }[item.slot];
  const out = document.createElement('canvas');
  out.width = crop[2] * 2; out.height = crop[3] * 2;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, crop[0], crop[1], crop[2], crop[3], 0, 0, out.width, out.height);
  return out.toDataURL();
}

function closetPanel() {
  const { user, dog } = state.me;
  const dogTab = state.closetTab === 'dog';
  const slots = dogTab ? DOG_SLOTS : ROOM_SLOTS;
  const current = (slot) => (dogTab ? dog.equip[slot] : user.room[slot]);
  const preview = dogTab ? el('img', { class: 'pixel', style: { width: `${DOG_W * 2}px`, height: `${DOG_H * 2}px`, display: 'block', margin: '0 auto' }, src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip }), alt: '' }) : null;
  const itemNode = (id) => {
    const item = ITEMS[id];
    const owned = user.owned.includes(id);
    const on = current(item.slot) === id;
    const locked = dogTab && dog.stage < item.stage;
    const thumb = dogTab ? accessoryURL(id, 5) : roomThumb(id);
    const gachaOnly = item.shop === false && !owned;
    return el('button', {
      class: `item r-${item.rarity} ${on ? 'equipped' : ''} ${locked ? 'locked' : ''} ${gachaOnly ? 'mystery' : ''}`,
      onclick: () => itemClick(id, { owned, on, locked }),
    },
    on ? el('span', { class: 'tag' }, '사용 중') : item.rarity !== 'common' ? el('span', { class: `tag rarity-tag ${item.rarity}` }, RARITY[item.rarity].name) : null,
    el('div', { class: 'thumb' }, el('img', { class: 'pixel', src: thumb, alt: '' })),
    el('span', {}, item.name),
    owned ? el('span', { class: 'meta' }, locked ? (item.stage === 1 ? '꼬마부터' : '다 크면') : on ? '벗기' : '갖고 있어요')
      : gachaOnly ? el('span', { class: 'meta' }, '뽑기에서 나와요')
        : locked ? el('span', { class: 'meta' }, item.stage === 1 ? '꼬마부터' : '다 크면')
          : el('span', { class: 'price' }, el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '코인' }), item.price));
  };
  const today = new Date(serverNow() + 9 * 3600_000).toISOString().slice(0, 10);
  const free = user.gachaDate !== today;
  const ownedCount = user.owned.filter((id) => ITEMS[id]?.gacha !== false).length;
  const totalCount = Object.values(ITEMS).filter((i) => i.gacha !== false).length;
  return el('div', {},
    el('div', { class: 'gacha-box' },
      el('div', {},
        el('div', { class: 'title' }, '캡슐 뽑기'),
        el('div', { class: 'meta' }, `모은 아이템 ${ownedCount} / ${totalCount}`),
        el('button', { class: 'link', onclick: showOdds }, '확률 보기')),
      el('button', { class: 'btn primary', onclick: doGacha },
        free ? '오늘 무료 뽑기!'
          : user.gachaTickets > 0 ? `뽑기권 쓰기 (${user.gachaTickets}장)`
            : el('span', { class: 'price' }, '뽑기 ', el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '코인' }), GACHA.price))),
    el('div', { class: 'segmented' },
      el('button', { class: dogTab ? 'on' : '', onclick: () => { state.closetTab = 'dog'; renderPanel(); } }, '강아지 꾸미기'),
      el('button', { class: !dogTab ? 'on' : '', onclick: () => { state.closetTab = 'room'; renderPanel(); } }, '방 꾸미기')),
    preview,
    ...slots.map((slot) => {
      const ids = Object.keys(ITEMS).filter((k) => ITEMS[k].slot === slot);
      const label = { head: '머리', neck: '목', face: '얼굴', wallpaper: '벽지', rug: '러그', bed: '침대', toy: '장난감' }[slot];
      return el('div', {}, el('div', { class: 'section-title' }, label), el('div', { class: 'items' }, ids.map(itemNode)));
    }));
}

function itemThumb(id) {
  return ['head', 'neck', 'face'].includes(ITEMS[id].slot) ? accessoryURL(id, 5) : roomThumb(id);
}

function showOdds() {
  const total = Object.values(RARITY).reduce((a, r) => a + r.weight, 0);
  modal({
    title: '뽑기 확률',
    body: el('div', {},
      el('div', { class: 'cards' }, Object.entries(RARITY).map(([k, r]) => {
        const list = Object.entries(ITEMS).filter(([, i]) => i.gacha !== false && i.rarity === k);
        return el('div', { class: 'card' },
          el('div', { class: 'title' }, el('span', { class: `rarity-tag ${k}` }, r.name), `${Math.round((r.weight / total) * 100)}%`),
          el('div', { class: 'meta' }, list.map(([, i]) => i.name).join(', ')),
          el('div', { class: 'meta' }, `이미 가진 아이템이 나오면 코인 ${r.refund}개로 바꿔 줘요.`));
      })),
      el('p', { class: 'hint' }, `같은 등급 안에서는 모두 같은 확률이에요. 하루 ${GACHA.freePerDay}번은 무료! 뽑기는 게임 코인으로만 할 수 있어요.`)),
    buttons: [{ label: '알겠어요' }],
  });
}

async function doGacha() {
  try {
    const res = await post('/gacha');
    applyMe(res);
    const again = await playGacha(res.result, itemThumb);
    await handleEvents(res.events);
    renderPanel();
    if (again) doGacha();
  } catch (err) { sfx.error(); toast(err.message, 'bad'); }
}

async function itemClick(id, { owned, on, locked }) {
  const item = ITEMS[id];
  try {
    if (!owned && item.shop === false) return toast('캡슐 뽑기에서만 나오는 아이템이에요!');
    if (locked) return toast(`${STAGES[item.stage].name}(으)로 자라면 쓸 수 있어요!`);
    let res;
    if (!owned) {
      const ok = await new Promise((resolve) => modal({
        title: `${item.name}`,
        body: el('p', { class: 'center' }, `뼈다귀 코인 ${item.price}개로 살까요? (지금 ${state.me.user.coins}개)`),
        buttons: [{ label: '아니요', kind: 'secondary', onClick: () => resolve(false) }, { label: '살래요!', onClick: () => resolve(true) }],
        dismissable: false,
      }));
      if (!ok) return;
      res = await post('/shop/buy', { itemId: id });
      applyMe(res);
      toast(`${item.name}(을)를 샀어요!`, 'good');
    }
    const required = item.slot === 'wallpaper' || item.slot === 'bed';
    if (on && required) return toast('이건 꼭 하나 있어야 해요. 다른 걸 골라 주세요!');
    res = await post('/equip', { slot: item.slot, itemId: on ? null : id });
    applyMe(res);
    if (atHome()) state.scene.setDecor(res.user.room);
    renderPanel();
    await handleEvents(res.events);
  } catch (err) { toast(err.message, 'bad'); }
}

async function friendsPanel() {
  const [data, trades] = await Promise.all([api('/friends'), api('/trades')]);
  if (state.tab !== 'friends') return null;
  $('#badge-friends').hidden = !data.incoming.length && !trades.incoming.length;
  const tradeWith = (f) => openComposer(f, { api, post, thumb: itemThumb, onSent: renderPanel });
  const code = state.me.user.friendCode;
  const link = `${location.origin}/?code=${code}`;
  const codeInput = el('input', { class: 'chat-input', maxlength: 6, placeholder: '친구 코드 6글자', style: { textTransform: 'uppercase' }, 'aria-label': '친구 코드' });
  const request = async () => {
    try {
      const res = await post('/friends/request', { code: codeInput.value.trim().toUpperCase() });
      toast(res.status === 'friends' ? `${res.nickname}(이)랑 친구가 되었어요!` : `${res.nickname}에게 친구 신청을 보냈어요!`, 'good');
      renderPanel();
    } catch (err) { toast(err.message, 'bad'); }
  };
  return el('div', {},
    el('div', { class: 'code-box' },
      el('div', { class: 'meta' }, '나의 친구 코드'),
      el('div', { class: 'code' }, code),
      el('div', { class: 'row' },
        el('button', { class: 'btn small secondary', onclick: () => shareLink(link) }, '초대 링크 보내기'),
        el('button', { class: 'btn small', onclick: () => qrModal(code, link, { onShare: shareLink }) }, 'QR 보여 주기'))),
    el('div', { class: 'chat-row' }, codeInput, el('button', { class: 'btn small primary', onclick: request }, '친구 신청')),
    el('p', { class: 'hint' }, '실제로 아는 친구하고만 코드를 주고받아요. 친구가 수락해야 친구가 돼요.'),
    data.incoming.length ? el('div', {},
      el('div', { class: 'section-title' }, '나에게 온 친구 신청'),
      el('div', { class: 'cards' }, data.incoming.map((r) => el('div', { class: 'card' },
        el('div', { class: 'title' }, r.nickname,
          el('span', { class: 'btns' },
            el('button', { class: 'btn small', onclick: () => respond(r.id, false) }, '거절'),
            el('button', { class: 'btn small green', onclick: () => respond(r.id, true) }, '수락'))))))) : null,
    wishSection(),
    tradeSection(trades, {
      thumb: itemThumb,
      onCompose: () => (data.friends.length ? modal({
        title: '누구와 거래할까요?',
        body: el('div', { class: 'cards' }, data.friends.map((f) => el('button', { class: 'card', onclick: () => { closeAllModals(); tradeWith(f); } },
          el('div', { class: 'title' }, f.nickname)))),
        buttons: [{ label: '닫기', kind: 'secondary' }],
      }) : toast('친구가 생기면 거래할 수 있어요!')),
      onReview: (t) => openReview(t, { post, thumb: itemThumb, onDone: async (res) => { if (res?.dog) { applyMe(res); await handleEvents(res.events); } renderPanel(); } }),
      onCancel: async (t) => { try { await post(`/trades/${t.id}/cancel`); toast('제안을 취소했어요.'); renderPanel(); } catch (err) { toast(err.message, 'bad'); } },
      onHistory: () => openHistory(trades.history, itemThumb),
    }),
    el('div', { class: 'section-title' }, `내 친구 (${data.friends.length})`),
    data.friends.length ? el('div', { class: 'cards' }, data.friends.map((f) => el('div', { class: 'card friend' },
      f.dog ? el('img', { class: 'pixel', src: dogPortrait(f.dog.breed, f.dog.stage, { equip: f.dog.equip }), alt: '' }) : el('span'),
      el('div', {},
        el('div', { class: 'title' }, el('span', {}, el('i', { class: `online ${f.online ? 'on' : ''}` }), f.nickname)),
        el('div', { class: 'meta' }, f.dog ? `${f.dog.name} · ${breedOf(f.dog.breed)?.name ?? ''}${f.dog.atSchool ? ' · 학교 가는 중' : ''}` : ''),
        f.bond ? el('div', { class: 'meta' }, el('span', { class: 'hearts' }, '♥'.repeat(f.bond.level + 1)), ` ${f.bond.name}`) : null),
      el('div', { class: 'btns' },
        el('button', { class: 'btn small green', onclick: () => enterRoom(f.id) }, '놀러 가기'),
        el('button', { class: 'btn small', onclick: () => tradeWith(f) }, '거래'),
        canWish(f) ? el('button', { class: 'btn small primary', onclick: () => askWish(f) }, '🎁 아기 소원') : null,
        f.online && atHome() ? el('button', { class: 'btn small secondary', onclick: () => invite(f) }, '초대') : null,
        el('button', { class: 'btn small', title: '친구 끊기', 'aria-label': '친구 끊기', onclick: () => unfriend(f) }, '…'))))) : el('p', { class: 'help' }, '아직 친구가 없어요. 친구 코드를 주고받아 보세요!'),
    data.outgoing.length ? el('p', { class: 'hint' }, `수락을 기다리는 신청: ${data.outgoing.map((o) => o.nickname).join(', ')}`) : null);
}

// ---------- 아기 강아지 소원 ----------
function canWish(f) {
  return (f.bond?.level ?? 0) >= BABY.bondLevel && f.dog?.stage === 2 && state.me.dog.stage === 2;
}

function askWish(f) {
  modal({
    title: '아기 강아지 소원 빌기',
    body: el('div', { class: 'center' },
      el('p', {}, `${state.me.dog.name}와(과) ${f.dog.name}(은)는 ${BOND_LEVELS[BABY.bondLevel].name}이에요!`),
      el('p', {}, `두 친구가 함께 소원을 빌면, 이틀 뒤 두 집 우편함에 두 강아지를 반씩 닮은 아기 강아지 선물 상자가 와요.`),
      el('p', { class: 'help' }, `${f.nickname}도 좋다고 해야 소원이 이루어져요. 보호자와 함께 이야기해 봐요!`)),
    buttons: [{ label: '다음에', kind: 'secondary' }, {
      label: '소원 빌기!',
      onClick: async () => {
        try { await post('/baby/wish', { to: f.id }); sfx.star(); toast(`${f.nickname}에게 소원을 보냈어요!`, 'good'); refreshMe(); } catch (err) { toast(err.message, 'bad'); }
      },
    }],
  });
}

function wishSection() {
  const list = state.me.wishes ?? [];
  if (!list.length) return null;
  return el('div', { class: 'wish-box' },
    el('b', {}, '🎁 소원 쿠션'),
    el('div', { class: 'cards' }, list.map((w) => el('div', { class: 'card' },
      el('div', { class: 'title' }, `${w.with.nickname}와(과)의 소원`,
        w.status === 'pending' && w.incoming ? el('span', { class: 'btns' },
          el('button', { class: 'btn small', onclick: () => answerWish(w, false) }, '다음에'),
          el('button', { class: 'btn small primary', onclick: () => answerWish(w, true) }, '좋아요!')) : null,
        w.status === 'pending' && !w.incoming ? el('button', { class: 'btn small', onclick: () => cancelWish(w) }, '취소') : null),
      el('div', { class: 'meta' }, w.status === 'pending'
        ? (w.incoming ? `${w.fromDog?.name ?? '친구 강아지'}와(과) 우리 강아지의 아기 강아지 소원이에요. 좋다고 하면 이틀 뒤 두 집에 선물 상자가 와요!` : '친구가 좋다고 하기를 기다려요.')
        : `선물 상자가 오고 있어요! ${fmtDuration(w.arrivesAt - serverNow())} 뒤 도착`)))));
}

async function answerWish(w, accept) {
  try {
    const res = await post(`/baby/${w.id}/respond`, { accept });
    applyMe(res);
    if (accept) { sfx.levelUp(); toast('소원이 이루어지고 있어요! 선물 상자를 기다려요.', 'good'); } else toast('다음에 빌기로 했어요.');
    renderPanel();
  } catch (err) { toast(err.message, 'bad'); }
}

async function cancelWish(w) {
  try { await post(`/baby/${w.id}/cancel`); await refreshMe(); renderPanel(); } catch (err) { toast(err.message, 'bad'); }
}

async function respond(requestId, accept) {
  try {
    await post('/friends/respond', { requestId, accept });
    toast(accept ? '새 친구가 생겼어요!' : '신청을 거절했어요.', accept ? 'good' : 'info');
    renderPanel();
  } catch (err) { toast(err.message, 'bad'); }
}

async function invite(f) {
  const res = await emitAck('invite', { friendId: f.id });
  toast(res.ok ? `${f.nickname}에게 초대장을 보냈어요!` : res.reason, res.ok ? 'good' : 'bad');
}

function unfriend(f) {
  modal({
    title: '친구 끊기',
    body: el('p', { class: 'center' }, `${f.nickname}(이)랑 친구를 그만할까요? 서로의 집에 놀러 갈 수 없게 돼요.`),
    buttons: [
      { label: '아니요', kind: 'secondary' },
      {
        label: '그만할래요',
        onClick: async () => {
          try {
            await api(`/friends/${f.id}`, { method: 'DELETE' });
            if (state.roomOwnerId === f.id) enterRoom(myId());
            renderPanel();
          } catch (err) { toast(err.message, 'bad'); }
        },
      },
    ],
  });
}

async function shareLink(link) {
  const text = `멍뭉고치에서 같이 놀자! 내 친구 코드는 ${state.me.user.friendCode} 이야.`;
  try {
    if (navigator.share) { await navigator.share({ title: '멍뭉고치 초대장', text, url: link }); return; }
    await navigator.clipboard.writeText(`${text} ${link}`);
    toast('초대 링크를 복사했어요! 친구에게 보내 주세요.', 'good');
  } catch {
    modal({ title: '초대 링크', body: el('p', { class: 'center', style: { wordBreak: 'break-all' } }, link) });
  }
}

// ---------- 멍뭉 놀이터 (공개 광장) ----------
function bindPlazaSocket(socket) {
  socket.on('plaza:enter', (m) => {
    if (!state.plaza) return;
    state.plaza.view.upsert({ ...m, friend: state.plaza.friends.has(m.userId) });
    state.plaza.count += 1;
    renderPlazaHeader();
  });
  socket.on('plaza:exit', ({ userId }) => {
    if (!state.plaza) return;
    state.plaza.view.remove(userId);
    state.plaza.count = Math.max(1, state.plaza.count - 1);
    renderPlazaHeader();
  });
  // 0.1초마다 오는 위치 묶음: [userId, x, y, dir, moving]
  socket.on('plaza:snap', (list) => {
    if (!state.plaza) return;
    for (const [userId, x, y, dir, moving] of list) state.plaza.view.move(userId, x, y, dir, !!moving);
  });
  socket.on('plaza:bubble', ({ userId, kind, value }) => {
    if (!state.plaza) return;
    state.plaza.view.bubble(userId, kind, value);
    logChat(userId, kind, value);
    sfx.pop();
  });
  socket.on('plaza:dog', ({ userId, dog }) => { state.plaza?.view.setDog(userId, dog); });
  socket.on('plaza:emote', ({ userId, kind }) => {
    if (!state.plaza) return;
    state.plaza.view.emote(userId, kind);
    const dog = state.plaza.view.entities.get(userId)?.dog;
    if (kind === 'bark') sfx.bark(barkPitch(dog));
    if (kind === 'jump') sfx.jump();
    if (kind === 'wave') sfx.love();
    if (kind === 'spin') sfx.whoosh();
  });
  socket.on('plaza:kicked', ({ reason }) => {
    if (!state.plaza) return;
    toast(reason, 'bad');
    leavePlaza(false);
  });
  // ---------- 멍뭉 패션쇼 ----------
  socket.on('show:state', (s) => {
    if (!state.plaza) return;
    const before = state.plaza.show;
    state.plaza.show = s;
    state.plaza.view.setShow(s);
    const joined = s?.players.some((p) => p.userId === myId());
    if (joined && s.status === 'dress' && before?.status !== 'dress') { sfx.bell(); toast(`패션쇼 주제: ${s.theme}! 의상실에서 옷을 골라요.`, 'good'); }
    if (s?.status !== 'dress' && state.wardrobeClose) { state.wardrobeClose(); state.wardrobeClose = null; }
    if (!s || !joined) state.plaza.costume = null;
    if (s?.status === 'walk' && s.walker === myId() && before?.walker !== myId()) {
      sfx.levelUp(); toast(s.bonus ? `내 차례! 주제에 딱 맞는 의상이라 응원 +${s.bonus}!` : '내 차례! 무대 위에서 반짝반짝~', 'good');
    }
    renderSpotBox();
  });
  socket.on('show:reaction', ({ kind, to, cheers }) => {
    if (!state.plaza) return;
    state.plaza.view.cheer(kind);
    if (state.plaza.show) state.plaza.show.cheers = cheers;
    if (to === myId()) sfx.love();
    const n = $('#show-cheers');
    if (n) n.textContent = `응원 ${cheers}`;
  });
  socket.on('show:end', ({ theme, results }) => {
    if (!state.plaza) return;
    sfx.levelUp();
    modal({
      title: '패션쇼 결과!',
      className: 'celebrate',
      body: el('div', {}, el('p', { class: 'center' }, `주제: ${theme}`),
        el('div', { class: 'party-results' }, results.map((r, i) => el('div', { class: `party-result ${r.userId === myId() ? 'me' : ''}` },
          el('span', { class: 'rank' }, r.star ? '👑' : `${i + 1}`),
          el('span'),
          el('div', {}, el('b', {}, r.nickname, r.star ? ' · 오늘의 스타!' : ''), el('div', { class: 'meta' }, `응원 ${r.cheers} · 코인 +${r.coins}`)))))),
      buttons: [{ label: '또 하자!' }],
    });
    refreshMe();
  });
  socket.on('tag:state', (t) => {
    if (!state.plaza) return;
    const before = state.plaza.tag;
    state.plaza.tag = t;
    state.plaza.view.tag = t;
    if (t?.status === 'play' && before?.status !== 'play') { sfx.bell(); toast('술래잡기 시작! 빨간 깃발이 술래예요.', 'good'); }
    renderTagHud();
    renderSpotBox();
  });
  socket.on('tag:tagged', ({ from, to }) => {
    if (!state.plaza) return;
    state.plaza.view.bubble(to, 'text', '잡혔다!');
    state.plaza.view.emote(to, 'jump');
    sfx.hurt();
    if (to === myId()) toast('내가 술래예요! 친구를 잡으러 가요!', 'bad');
  });
  socket.on('tag:end', ({ results }) => {
    if (!state.plaza) return;
    state.plaza.tag = null;
    state.plaza.view.tag = null;
    renderTagHud();
    renderSpotBox();
    sfx.levelUp();
    modal({
      title: '술래잡기 끝!',
      body: el('div', { class: 'party-results' }, results.map((r, i) => el('div', { class: `party-result ${r.userId === myId() ? 'me' : ''}` },
        el('span', { class: 'rank' }, `${i + 1}`),
        el('span'),
        el('div', {}, el('b', {}, r.nickname), el('div', { class: 'meta' }, `잡은 횟수 ${r.tags} · 코인 +${r.coins}`))))),
      buttons: [{ label: '또 하자!' }],
    });
    refreshMe();
  });
  socket.on('soccer:state', (g) => {
    if (!state.plaza) return;
    const before = state.plaza.soccer;
    state.plaza.soccer = g;
    state.plaza.view.soccer = g;
    if (g) state.plaza.view.setBall(g.ball.x, g.ball.y, g.ball.vx, g.ball.vy); else state.plaza.view.ball = null;
    if (g?.status === 'play' && before?.status !== 'play') { sfx.bell(); if (g.teams[myId()]) toast(`축구 시작! 나는 ${SOCCER.teams[g.teams[myId()]]}! ${g.teams[myId()] === 'pink' ? '오른쪽' : '왼쪽'} 골대에 넣어요.`, 'good'); }
    renderTagHud();
    renderSpotBox();
  });
  socket.on('soccer:ball', ([x, y, vx, vy]) => state.plaza?.view.setBall(x, y, vx, vy));
  socket.on('soccer:kick', ({ userId }) => { if (state.plaza) { sfx.jump(); state.plaza.view.emote(userId, 'jump'); } });
  socket.on('soccer:goal', ({ team, byName, score }) => {
    if (!state.plaza) return;
    if (state.plaza.soccer) state.plaza.soccer.score = score;
    const f = PLAZA_SPOTS.soccer;
    state.plaza.view.treasurePop(team === 'pink' ? f.x + f.w / 2 - 6 : f.x - f.w / 2 + 6, f.y, 'star');
    sfx.levelUp();
    toast(`골~인! ${SOCCER.teams[team]} 득점${byName ? ` (${byName})` : ''} · 핑크 ${score.pink} : ${score.blue} 파랑`, 'good');
    renderTagHud();
  });
  socket.on('soccer:end', ({ score, winner, results }) => {
    if (!state.plaza) return;
    const mine = results.find((r) => r.userId === myId());
    if (!mine) return;
    sfx.levelUp();
    modal({
      title: winner ? `${SOCCER.teams[winner]} 승리!` : '무승부! 모두 잘했어요',
      body: el('div', {},
        el('p', { class: 'jr-score center' }, `핑크 ${score.pink} : ${score.blue} 파랑`),
        el('div', { class: 'party-results' }, results.map((r) => el('div', { class: `party-result ${r.userId === myId() ? 'me' : ''}` },
          el('span', { class: 'rank' }, r.team === 'pink' ? '🩷' : '💙'),
          el('span'),
          el('div', {}, el('b', {}, r.nickname), el('div', { class: 'meta' }, `골 ${r.goals} · 코인 +${r.coins}`)))))),
      buttons: [{ label: '또 하자!' }],
    });
    refreshMe();
  });
  socket.on('treasure:dig', ({ userId }) => state.plaza?.view.dig(userId));
  socket.on('treasure:count', ({ n }) => { if (state.plaza) { state.plaza.treasures = n; renderSpotBox(); } });
  socket.on('treasure:found', ({ userId, nickname, kind, x, y, helpers, n }) => {
    if (!state.plaza) return;
    state.plaza.treasures = n;
    state.plaza.view.treasurePop(x, y, kind === 'bone' ? 'star' : kind === 'capsule' ? 'sparkle' : 'coin');
    if (userId !== myId()) {
      state.plaza.view.bubble(userId, 'text', '찾았다!');
      if (helpers.includes(myId())) { sfx.coin(); toast(`${nickname}(이)가 보물을 찾았어요! 같이 파서 코인 +1`, 'good'); }
    }
    renderSpotBox();
  });
  socket.on('coop:queue', ({ game, waiting }) => {
    if (!state.plaza) return;
    state.plaza.waiting[game] = waiting;
    renderSpotBox();
    renderTagHud();
  });
}

async function enterPlaza(channel) {
  const dog = state.me.dog;
  if (dog.school) return toast(`${dog.name}(은)는 학교에 가 있어요!`);
  unlock();
  state.socket?.emit('room:leave');
  const res = await emitAck('plaza:join', channel ? { channel } : {});
  if (!res.ok) {
    toast(res.reason, 'bad');
    enterRoom(myId(), { quiet: true });
    return;
  }
  mountPlaza(res);
  sfx.notify();
  toast(`${res.channel}번 놀이터에 왔어요! 조이스틱이나 바닥을 눌러 움직여요.`, 'good');
}

function mountPlaza(res) {
  state.plaza?.view.destroy();
  state.scene.paused = true;
  document.querySelector('.stage').classList.add('plaza-mode');
  const me = res.members.find((m) => m.userId === myId());
  const friends = new Set(res.friends);
  const view = new PlazaView(document.querySelector('.stage'), {
    userId: myId(), nickname: state.me.user.nickname, dog: publicDog(state.me.dog), x: me?.x, y: me?.y,
  }, {
    onPos: (p) => state.socket?.emit('plaza:pos', p),
    onTapDog: openPlazaDog,
    onSpot: () => renderSpotBox(),
    onFloor: () => sfx.tap(),
  });
  for (const m of res.members) if (m.userId !== myId()) view.upsert({ ...m, friend: friends.has(m.userId) });
  state.plaza = { view, channel: res.channel, count: res.members.length, tag: res.tag, waiting: {}, friends, treasures: res.treasures ?? 0, hint: null, soccer: res.soccer, show: res.show };
  updateChatDock();
  view.setShow(res.show);
  view.soccer = res.soccer;
  if (res.soccer) view.setBall(res.soccer.ball.x, res.soccer.ball.y, res.soccer.ball.vx, res.soccer.ball.vy);
  view.tag = res.tag;
  $('#room-label').textContent = `멍뭉 놀이터 ${res.channel}번`;
  $('#away-sign').hidden = true;
  playBgm('play');
  if (state.tab !== 'play') { state.tab = 'play'; document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'play')); }
  renderPanel();
  renderTagHud();
}

async function rejoinPlaza() {
  const res = await emitAck('plaza:join', { channel: state.plaza?.channel });
  if (res.ok) mountPlaza(res); else leavePlaza(false);
}

function leavePlaza(backHome = true) {
  if (!state.plaza) return;
  state.socket?.emit('plaza:leave');
  state.socket?.emit('coop:cancel');
  state.plaza.view.destroy();
  state.plaza = null;
  updateChatDock();
  state.coopWaiting = null;
  document.querySelector('.stage').classList.remove('plaza-mode');
  state.scene.paused = false;
  playBgm('home');
  if (backHome) enterRoom(myId(), { quiet: true });
  else enterRoom(myId(), { quiet: true });
  if (state.tab === 'play') renderPanel();
}

function renderPlazaHeader() {
  const h = $('#plaza-count');
  if (h && state.plaza) h.textContent = `${state.plaza.channel}번 놀이터 · ${state.plaza.count}/${PLAZA.cap}`;
}

function renderTagHud() {
  const p = state.plaza;
  if (!p) return;
  const hud = p.view.hud;
  const t = p.tag;
  const lines = [];
  if (t) {
    const name = (id) => (id === myId() ? '나' : p.view.entities.get(id)?.nickname ?? '친구');
    if (t.status === 'waiting') lines.push(`술래잡기 모집 중 (${t.players.length}명)${t.startsAt ? ' · 곧 시작!' : ''}`);
    else lines.push(`술래잡기 ${Math.max(0, Math.ceil((t.endsAt - serverNow()) / 1000))}초 · 술래: ${name(t.it)}`);
  }
  const g = p.soccer;
  if (g) {
    const n = Object.keys(g.teams).length;
    if (g.status === 'waiting') lines.push(`멍멍 축구 모집 중 (${n}명)${g.startsAt ? ' · 곧 시작!' : ' · 양 팀에 1명씩 필요해요'}`);
    else lines.push(`축구 핑크 ${g.score.pink} : ${g.score.blue} 파랑 · ${Math.max(0, Math.ceil((g.endsAt - serverNow()) / 1000))}초`);
  }
  for (const [game, w] of Object.entries(p.waiting)) {
    const spot = Object.values(PLAZA_SPOTS).find((sp) => sp.game === game);
    if (w && w.userId !== myId()) lines.push(`${spot?.name ?? '놀이 장소'}에서 ${w.nickname}(이)가 친구를 기다려요!`);
  }
  hud.replaceChildren(...lines.map((l) => el('div', {}, l)));
  hud.hidden = !lines.length;
  clearTimeout(state.tagHudTimer);
  if (t?.status === 'play' || t?.startsAt || g?.status === 'play' || g?.startsAt) state.tagHudTimer = setTimeout(renderTagHud, 500);
}

async function digHere() {
  const p = state.plaza;
  if (!p) return;
  sfx.tap();
  const me = p.view.me;
  const res = await emitAck('treasure:dig', { x: me.x, y: me.y });
  if (!res.ok) { toast(res.reason); return; }
  if (res.found) {
    const kind = TREASURE.kinds[res.kind];
    p.hint = null;
    sfx.levelUp();
    p.view.bubble(myId(), 'text', '찾았다!');
    toast(`${kind.name}를 찾았어요! 코인 +${res.coins}${res.item ? ` · ${ITEMS[res.item].name}도 나왔어요!` : ''}`, 'good');
    refreshMe();
  } else {
    p.hint = res.hint;
    if (res.hint === 'hot') sfx.star(); else sfx.pop();
    p.view.bubble(myId(), 'text', { hot: '뜨거워!', warm: '따뜻해~', cold: '차가워…', none: '텅~' }[res.hint]);
  }
  renderSpotBox();
}

async function queueCoop(game) {
  if (!state.plaza) return toast('놀이터에서 할 수 있어요!');
  const res = await emitAck('coop:queue', { game });
  if (!res.ok) return toast(res.reason, 'bad');
  if (res.waiting) {
    state.coopWaiting = game;
    toast('친구를 기다리는 중이에요. 누가 오면 바로 시작해요!');
  }
  renderSpotBox();
}

function renderSpotBox() {
  const box = $('#spot-box');
  const p = state.plaza;
  if (!box || !p) return;
  const spot = p.view.spot;
  const info = spot && PLAZA_SPOTS[spot];
  let content;
  if (!info) {
    content = [el('b', {}, '놀이터를 돌아다녀 보세요!'), el('div', { class: 'meta' }, '선물 상자·줄넘기 터·장난감 방(왼쪽), 쿠션 탑·간식 공장·축구장(오른쪽 아래), 술래잡기 마당·패션쇼 무대(위쪽), 보물 모래밭(연못 아래)에 가면 같이 놀 수 있어요.')];
  } else if (spot === 'soccer') {
    const g = p.soccer;
    const team = g?.teams[myId()];
    content = [el('b', {}, info.name),
      el('div', { class: 'meta' }, `공에 닿으면 톡 밀려요! 핑크팀은 오른쪽, 파랑팀은 왼쪽 골대에 넣어요. ${SOCCER.seconds}초 경기.`),
      team
        ? el('div', { class: `team-badge ${team}` }, `나는 ${SOCCER.teams[team]}!`)
        : el('button', { class: 'btn primary', onclick: async () => { const r = await emitAck('soccer:join', {}); if (!r.ok) toast(r.reason, 'bad'); else sfx.pop(); } }, '경기 참가하기'),
      team ? el('div', { class: 'btns' },
        el('button', { class: 'btn primary', disabled: g?.status !== 'play', onclick: () => state.socket.emit('soccer:kick') }, '뻥! 강하게 차기'),
        el('button', { class: 'btn small', onclick: () => { state.socket.emit('soccer:leave'); } }, '그만하기')) : null];
  } else if (spot === 'sand') {
    const hints = {
      hot: '뜨거워요! 바로 근처예요!', warm: '따뜻해요~ 가까워지고 있어요.', cold: '차가워요. 다른 곳을 파 봐요.',
      none: '지금은 보물이 없어요. 곧 새로 숨겨져요!',
    };
    content = [el('b', {}, info.name),
      el('div', { class: 'meta' }, p.treasures ? `보물이 ${p.treasures}개 숨어 있어요! 여기저기 파 보세요. 친구랑 같이 파면 친구가 찾아도 선물을 받아요.` : '보물이 곧 숨겨져요. 조금만 기다려요!'),
      p.hint ? el('div', { class: `dig-hint ${p.hint}` }, hints[p.hint]) : null,
      el('button', { class: 'btn primary', onclick: digHere }, '여기 파기!')];
  } else if (info.soon) {
    content = [el('b', {}, info.name), el('div', { class: 'meta' }, '곧 열려요! 조금만 기다려 주세요.')];
  } else if (spot === 'stage') {
    content = showSpotBox(info);
  } else if (spot === 'tag') {
    const t = p.tag;
    const joined = t?.players.includes(myId());
    content = [el('b', {}, info.name),
      el('div', { class: 'meta' }, `술래(빨간 깃발)에게 잡히면 내가 술래! ${TAG.seconds}초 동안 도망가요.`),
      t?.status === 'play' ? el('div', { class: 'meta' }, joined ? '지금 하는 중!' : '한 판 하는 중이에요. 끝나면 같이 해요!')
        : el('button', { class: 'btn primary', disabled: joined, onclick: async () => { const r = await emitAck('tag:join', {}); if (!r.ok) toast(r.reason, 'bad'); } }, joined ? '참가했어요! 친구를 기다려요' : '참가하기')];
  } else if (info.game) {
    const g = COOP_GAMES[info.game];
    const w = p.waiting[info.game];
    const mine = state.coopWaiting === info.game;
    content = [el('b', {}, g.name), el('div', { class: 'meta' }, g.desc),
      g.roles && g.roles.p1 !== g.roles.p2 ? el('div', { class: 'meta' }, `먼저 기다린 친구는 ${g.roles.p1}, 나중에 온 친구는 ${g.roles.p2}!`) : null,
      w && !mine ? el('div', { class: 'meta' }, `${w.nickname}(이)가 기다리고 있어요!`) : null,
      mine
        ? el('button', { class: 'btn secondary', onclick: () => { state.socket.emit('coop:cancel'); state.coopWaiting = null; renderSpotBox(); } }, '기다리는 중… (취소)')
        : el('button', { class: 'btn primary', onclick: () => queueCoop(info.game) }, w ? '같이 하기!' : '같이 할 친구 기다리기')];
  }
  box.replaceChildren(...content.filter(Boolean));
}

// 패션쇼 무대 안내 + 참가/옷장/응원 버튼
function showSpotBox(info) {
  const s = state.plaza.show;
  const joined = s?.players.some((p) => p.userId === myId());
  const left = (t) => Math.max(0, Math.ceil((t - serverNow()) / 1000));
  if (!s || s.status === 'waiting') {
    return [el('b', {}, info.name),
      el('div', { class: 'meta' }, `주제에 맞게 꾸미고 무대에 올라요! 보는 친구들이 하트·별·반짝으로 응원해요. ${FASHION.minPlayers}~${FASHION.maxPlayers}명.`),
      s?.players.length ? el('div', { class: 'meta' }, `참가: ${s.players.map((p) => p.nickname).join(', ')}${s.startsAt ? ` · 곧 시작해요!` : ' · 친구를 기다려요'}`) : null,
      joined
        ? el('div', { class: 'btns' }, el('button', { class: 'btn primary', disabled: true }, '참가했어요!'), el('button', { class: 'btn small', onclick: () => state.socket.emit('show:leave') }, '그만하기'))
        : el('button', { class: 'btn primary', onclick: async () => { const r = await emitAck('show:join', {}); if (!r.ok) toast(r.reason, 'bad'); else sfx.pop(); } }, '패션쇼 참가하기')];
  }
  if (s.status === 'dress') {
    return [el('b', {}, `오늘의 주제: ${s.theme}`),
      el('div', { class: 'meta' }, joined ? `${left(s.phaseEnds)}초 안에 주제에 맞게 갈아입어요!` : '참가한 친구들이 옷을 갈아입는 중이에요. 곧 무대가 시작돼요!'),
      joined ? el('div', { class: 'btns' },
        el('button', { class: 'btn primary', onclick: openShowWardrobe }, '✨ 패션쇼 의상실'),
        el('button', { class: 'btn small', onclick: openQuickCloset }, '내 옷장')) : null];
  }
  const walker = s.players.find((p) => p.userId === s.walker);
  const mine = s.walker === myId();
  return [el('b', {}, `무대 위: ${walker?.nickname ?? '친구'} ✨`),
    el('div', { class: 'meta' }, `주제: ${s.theme} · `, el('span', { id: 'show-cheers' }, `응원 ${s.cheers ?? 0}`), s.bonus ? ` · ✨ 주제에 딱 맞는 의상!` : ''),
    mine ? el('div', { class: 'meta' }, '내 차례예요! 몸짓 버튼으로 포즈를 해 보세요.')
      : el('div', { class: 'btns cheer-btns' }, Object.entries(FASHION.reactions).map(([k, label]) => el('button', {
        class: 'btn small', onclick: () => { state.socket.emit('show:react', { kind: k }); sfx.tap(); },
      }, el('img', { class: 'pixel', src: iconURL(k, 2), alt: '' }), label)))];
}

// 패션쇼 의상실: 무대에서만 빌려 입는 옷·소품 (쇼가 끝나면 원래 옷으로 돌아와요)
function openShowWardrobe() {
  const themeKey = state.plaza?.show?.themeKey;
  const costume = () => state.plaza?.costume ?? {};
  const render = () => {
    const { dog } = state.me;
    const equip = { ...dog.equip, ...costume() };
    const picks = Object.keys(SHOW_WARDROBE).sort((a, b) => (SHOW_WARDROBE[b].theme === themeKey) - (SHOW_WARDROBE[a].theme === themeKey));
    return el('div', { class: 'quick-closet wardrobe' },
      el('img', { class: 'pixel wardrobe-preview', src: dogPortrait(dog.breed, dog.stage, { equip }), alt: '' }),
      el('p', { class: 'hint center' }, '무대에서만 빌려 입는 옷이에요. ✨ 주제에 맞는 옷을 입으면 응원을 하나 더 받고 시작해요! (최대 2개)'),
      DOG_SLOTS.map((slot) => el('div', {},
        el('div', { class: 'section-title' }, { head: '머리', neck: '목', face: '얼굴' }[slot]),
        el('div', { class: 'items' }, picks.filter((id) => SHOW_WARDROBE[id].slot === slot).map((id) => {
          const on = costume()[slot] === id;
          const match = SHOW_WARDROBE[id].theme === themeKey;
          return el('button', {
            class: `item ${on ? 'equipped' : ''} ${match ? 'theme-match' : ''}`,
            onclick: async () => {
              const r = await emitAck('show:dress', { slot, itemId: on ? null : id });
              if (!r.ok) { toast(r.reason, 'bad'); return; }
              if (state.plaza) state.plaza.costume = r.costume;
              sfx.pop();
              box.card.querySelector('.modal-body').replaceChildren(render());
            },
          }, match ? el('span', { class: 'chip theme-chip' }, '주제!') : null,
          el('img', { class: 'pixel', src: accessoryURL(id, 4), alt: '' }), el('span', { class: 'name' }, SHOW_WARDROBE[id].name));
        })))));
  };
  const box = modal({ title: '✨ 패션쇼 의상실', className: 'trade-modal', body: render(), buttons: [{ label: '다 입었어요!' }] });
  state.wardrobeClose = box.close;
}

// 놀이터를 떠나지 않고 바로 갈아입는 작은 옷장
function openQuickCloset() {
  const render = () => {
    const { user, dog } = state.me;
    return el('div', { class: 'quick-closet' }, DOG_SLOTS.map((slot) => {
      const ids = user.owned.filter((id) => ITEMS[id]?.slot === slot && (ITEMS[id].stage ?? 0) <= dog.stage);
      return el('div', {},
        el('div', { class: 'section-title' }, { head: '머리', neck: '목', face: '얼굴' }[slot]),
        ids.length ? el('div', { class: 'items' }, ids.map((id) => {
          const on = dog.equip[slot] === id;
          return el('button', {
            class: `item ${on ? 'equipped' : ''}`,
            onclick: async () => {
              try {
                const res = await post('/equip', { slot, itemId: on ? null : id });
                applyMe(res); sfx.pop();
                box.card.querySelector('.modal-body').replaceChildren(render());
              } catch (err) { toast(err.message, 'bad'); }
            },
          }, el('img', { class: 'pixel', src: accessoryURL(id, 4), alt: '' }), el('span', { class: 'name' }, ITEMS[id].name));
        })) : el('p', { class: 'help' }, '아직 없어요.'));
    }));
  };
  const box = modal({ title: '패션쇼 옷장', className: 'trade-modal', body: render(), buttons: [{ label: '다 입었어요!' }] });
}

function plazaPanel() {
  const p = state.plaza;
  const myEmotes = state.me.dog.emotes ?? ['bark', 'jump', 'wave', 'spin'];
  return el('div', {},
    el('div', { class: 'plaza-top' },
      el('b', { id: 'plaza-count' }, `${p.channel}번 놀이터 · ${p.count}/${PLAZA.cap}`),
      el('span', { class: 'btns' },
        el('button', { class: 'btn small', onclick: openChannels }, '놀이터 바꾸기'),
        el('button', { class: 'btn small secondary', onclick: () => leavePlaza() }, '집으로'))),
    el('div', { id: 'spot-box', class: 'spot-box' }),
    el('div', { class: 'emotes' }, Object.entries(EMOTES).map(([k, em]) => {
      const has = myEmotes.includes(k);
      return el('button', {
        class: `btn small ${has ? '' : 'locked'}`, disabled: !has, title: has ? '' : `Lv ${em.level}에 배워요`,
        onclick: () => state.socket.emit('plaza:emote', { kind: k }),
      }, has ? em.name : `Lv ${em.level}`);
    })),
    el('p', { class: 'hint' }, '놀이터는 누구나 오는 곳이라 글자 채팅은 없어요. 모르는 친구에게 이름·학교·전화번호를 알려 주지 마세요. 불편한 친구는 강아지를 눌러 차단하거나 신고할 수 있어요.'));
}

async function openChannels() {
  const list = await emitAck('plaza:channels', {});
  modal({
    title: '놀이터 고르기',
    body: el('div', { class: 'cards' },
      (Array.isArray(list) ? list : []).map((c) => el('button', {
        class: 'card', style: { textAlign: 'left', cursor: 'pointer' }, disabled: c.full || c.id === state.plaza?.channel,
        onclick: () => { closeAllModals(); enterPlaza(c.id); },
      }, el('div', { class: 'title' }, `${c.id}번 놀이터`, el('span', { class: 'chip' }, `${c.count}/${PLAZA.cap}`)),
      el('div', { class: 'meta' }, c.id === state.plaza?.channel ? '지금 여기 있어요' : c.friends ? `친구 ${c.friends}명이 있어요!` : c.full ? '꽉 찼어요' : '들어갈 수 있어요')))),
    buttons: [{ label: '닫기', kind: 'secondary' }],
  });
}

function openPlazaDog(e) {
  const reasons = { mean: '나쁜 말이나 행동을 해요', follow: '자꾸 따라다녀요', spam: '스티커를 너무 많이 보내요', other: '기타' };
  const report = () => {
    closeAllModals();
    modal({
      title: `${e.nickname} 신고하기`,
      body: el('div', { class: 'cards' },
        el('p', { class: 'help' }, '어떤 점이 불편했나요? 신고하면 서로 안 보이게 되고, 여러 명이 신고하면 그 친구는 잠시 놀이터에 못 와요.'),
        Object.entries(reasons).map(([k, label]) => el('button', {
          class: 'btn', onclick: async () => {
            closeAllModals();
            const r = await emitAck('plaza:report', { userId: e.userId, reason: k });
            toast(r.ok ? '신고했어요. 알려 줘서 고마워요!' : r.reason, r.ok ? 'good' : 'bad');
            if (r.ok) state.plaza?.view.remove(e.userId);
          },
        }, label))),
      buttons: [{ label: '취소', kind: 'secondary' }],
    });
  };
  const block = async () => {
    const r = await emitAck('plaza:block', { userId: e.userId });
    toast(r.ok ? `${e.nickname}(을)를 차단했어요. 이제 서로 보이지 않아요.` : r.reason, r.ok ? 'good' : 'bad');
    if (r.ok) state.plaza?.view.remove(e.userId);
  };
  modal({
    title: e.nickname,
    body: el('div', { class: 'center' },
      el('img', { class: 'pixel', style: { width: '96px', height: '88px' }, src: dogPortrait(e.dog.breed, e.dog.stage, { equip: e.dog.equip }), alt: '' }),
      el('p', {}, `${e.dog.name} · ${breedOf(e.dog.breed)?.name ?? ''} · ${STAGES[e.dog.stage].name}`),
      e.friend ? el('p', { class: 'chip' }, '내 친구예요') : el('p', { class: 'hint' }, '친구가 되려면 친구 코드를 직접 주고받아야 해요.')),
    buttons: [
      { label: '반갑게 인사', onClick: () => { state.socket.emit('plaza:emote', { kind: 'wave' }); state.socket.emit('plaza:sticker', { id: 'heart' }); } },
      { label: '차단', kind: 'secondary', onClick: block },
      { label: '신고', kind: 'secondary', onClick: report },
    ],
  });
}

function playPanel() {
  if (state.plaza) {
    const node = plazaPanel();
    setTimeout(renderSpotBox, 0);
    return node;
  }
  const dog = state.me.dog;
  const { user } = state.me;
  const today = new Date(serverNow() + 9 * 3600_000).toISOString().slice(0, 10);
  const used = user.minigameDate === today ? user.minigamePlays : 0;
  const left = RULES.minigame.dailyPlays - used;
  const card = (type, title, desc) => el('div', { class: 'card' },
    el('div', { class: 'title' }, title, el('button', {
      class: 'btn small green', disabled: left <= 0 || !!dog.school,
      onclick: () => startGame(type),
    }, '놀기!')),
    el('div', { class: 'meta' }, desc));
  return el('div', {},
    el('div', { class: 'together-card plaza-card' },
      el('div', { class: 'title' }, '멍뭉 놀이터', el('span', { class: 'chip' }, '다 같이!')),
      el('p', {}, '여러 친구 강아지들이 모이는 큰 공원! 조이스틱으로 뛰어다니고, 술래잡기와 대왕 리본 풀기를 같이 해요.'),
      el('button', { class: 'btn primary', disabled: !!dog.school, onclick: () => enterPlaza() }, '놀이터 가기!')),
    el('button', { class: 'lb-open', onclick: () => { unlock(); sfx.tap(); openLeaderboard({ api, now: serverNow }); } },
      el('span', { class: 'lb-cup' }, '🏆'),
      el('span', {}, el('b', {}, '이번 주 랭킹'), el('small', {}, '멍뭉런 · 간식 받기 · 합동 줄넘기 — 친구랑 겨뤄요!')),
      el('span', { class: 'lb-go' }, '보기 ›')),
    el('h3', {}, '둘이 놀기'),
    el('p', { class: 'sub' }, `${partner().name}(이)랑 함께해요. 친구가 우리 집에 놀러 와 있으면 그 친구와 놀아요!`),
    el('div', { class: 'cards' },
      el('div', { class: 'card' },
        el('div', { class: 'title' }, '네컷 포토부스', el('span', { class: 'btns' },
          el('button', { class: 'btn small', onclick: openAlbum }, '앨범'),
          el('button', { class: 'btn small green', disabled: !!dog.school, onclick: startPhotobooth }, '찍기!'))),
        el('div', { class: 'meta' }, '나란히 서서 소품을 씌우고 네 컷 사진을 찍어요.')),
      el('div', { class: 'card' },
        el('div', { class: 'title' }, '합동 줄넘기', el('button', { class: 'btn small green', disabled: !!dog.school, onclick: startJumpRope }, '놀기!')),
        el('div', { class: 'meta' }, '밧줄이 발밑 선에 닿을 때 톡! 둘이 같이 깡총 뛰어요. 몇 콤보까지 갈 수 있을까?'))),
    el('h3', {}, '혼자 놀기'),
    el('p', { class: 'sub' }, dog.school ? '강아지가 학교에서 돌아오면 놀 수 있어요.' : `오늘 남은 횟수: ${left}번 · 한 판에 코인 최대 ${RULES.minigame.maxCoins}개 · 애정도 UP`),
    el('div', { class: 'cards' },
      runnerCard(dog, left),
      card('catch', '간식 받아먹기', `하늘에서 떨어지는 간식을 ${dog.name}(이)가 받아먹어요! 화면을 누르거나 끌어서 움직여요.`)));
}

// ---------- 멍뭉런 레벨 · 맵 ----------
function runnerInfo() {
  const r = state.me.user.runner ?? { xp: 0, best: 0 };
  return { ...runnerLevel(r.xp), best: r.best ?? 0, maps: runnerMaps(r) };
}
const mapNeed = (m) => `런 Lv ${m.level} 또는 최고 기록 ${m.best}개`;

function runnerCard(dog, left) {
  const info = runnerInfo();
  const next = Object.entries(RUNNER.maps).find(([id]) => !info.maps.includes(id));
  return el('div', { class: 'card runner-card' },
    el('div', { class: 'title' }, '멍뭉 런', el('span', { class: 'chip' }, `런 Lv ${info.level}`), el('button', {
      class: 'btn small green', disabled: left <= 0 || !!dog.school,
      onclick: () => (info.maps.length >= 2 ? openRunnerMaps() : startGame('run', { map: 'meadow' })),
    }, '놀기!')),
    el('div', { class: 'meta' }, `${dog.name}(이)가 신나게 달려요! 점프(두 번까지)와 슬라이드로 장애물을 피하고 간식을 모아요.`),
    el('div', { class: 'run-xp' }, el('i', { style: { width: `${Math.round((info.into / info.need) * 100)}%` } })),
    el('div', { class: 'meta' }, `최고 기록 ${info.best}개 · 맵 ${info.maps.length}/${Object.keys(RUNNER.maps).length}`,
      next ? ` · 다음 맵 "${next[1].name}": ${mapNeed(next[1])}` : ' · 모든 맵을 열었어요! 🎉'));
}

function openRunnerMaps() {
  const info = runnerInfo();
  let last = 'meadow';
  try { last = localStorage.getItem('mm.runMap') || 'meadow'; } catch { /* 괜찮아요 */ }
  const { close } = modal({
    title: '어디서 달릴까요?',
    className: 'runner-maps',
    body: el('div', { class: 'map-grid' }, Object.entries(RUNNER.maps).map(([id, m]) => {
      const open = info.maps.includes(id);
      return el('button', {
        type: 'button', class: `map-card ${open ? '' : 'locked'} ${open && id === last ? 'last' : ''}`, disabled: !open,
        onclick: () => {
          try { localStorage.setItem('mm.runMap', id); } catch { /* 괜찮아요 */ }
          close();
          startGame('run', { map: id });
        },
      },
      el('img', { class: 'pixel', src: runnerMapPreview(id), alt: '' }),
      el('b', {}, open ? m.name : `🔒 ${m.name}`),
      el('small', {}, open ? m.desc : mapNeed(m)));
    })),
    buttons: [{ label: '다음에', kind: 'secondary' }],
  });
}

function showRunMap(ev) {
  sfx.levelUp();
  const m = RUNNER.maps[ev.map];
  return waitModal({
    title: '새 맵이 열렸어요!',
    className: 'celebrate runner-maps',
    body: el('div', { class: 'center' },
      el('img', { class: 'pixel map-reveal', src: runnerMapPreview(ev.map), alt: '' }),
      el('h3', {}, m.name), el('p', {}, m.desc), el('p', { class: 'help' }, '멍뭉런 "놀기!"를 누르면 맵을 고를 수 있어요.')),
  });
}

async function startGame(type, { map = 'meadow' } = {}) {
  // 멍뭉 런은 가로 전체 화면으로 (버튼을 누른 바로 그 순간에 요청해야 브라우저가 허락해요)
  if (type === 'run') enterLandscape();
  try {
    unlock();
    const { gameId } = await post('/minigame/start', { type });
    const score = type === 'run' ? await playRunner(state.me.dog, { map }) : await playMinigame(state.me.dog);
    const res = await post('/minigame/finish', { gameId, score });
    applyMe(res);
    if (res.result.coins) sfx.coin();
    toast(`간식 ${score}개! 뼈다귀 코인 +${res.result.coins}${res.result.exp ? ` · 경험치 +${res.result.exp}` : ''}`, 'good');
    lbToast(res.result.lb);
    renderPanel();
    await handleEvents(res.events);
  } catch (err) { exitLandscape(); toast(err.message, 'bad'); renderPanel(); }
}

async function notebookPanel() {
  const sub = state.notebookTab ?? 'reports';
  const tabs = el('div', { class: 'segmented' },
    [['reports', '알림장'], ['badges', '배지'], ['dex', '도감']].map(([k, label]) => el('button', {
      class: sub === k ? 'on' : '', onclick: () => { state.notebookTab = k; renderPanel(); },
    }, label)));
  if (sub === 'badges' || sub === 'dex') {
    const me = await api('/me');
    if (state.tab !== 'notebook') return null;
    applyMe(me);
    return el('div', {}, tabs, sub === 'badges'
      ? badgeBoard(me.progress, {
        onShowcase: async (ids) => {
          try { applyMe(await post('/badges/showcase', { ids })); return true; } catch (err) { toast(err.message, 'bad'); return false; }
        },
      })
      : dexPanel(me.user, me.progress, itemThumb));
  }
  const { reports } = await api('/reports');
  if (state.tab !== 'notebook') return null;
  $('#badge-notebook').hidden = true;
  return el('div', {}, tabs,
    el('h3', {}, '알림장 모음'),
    reports.length ? el('div', { class: 'cards' }, reports.map((r) => {
      const d = new Date(r.date);
      return el('button', { class: 'card', style: { textAlign: 'left', cursor: 'pointer' }, onclick: () => showReport(r) },
        el('div', { class: 'title' }, `${d.getMonth() + 1}월 ${d.getDate()}일 ${r.courseName}`, !r.read ? el('span', { class: 'chip' }, 'NEW') : null),
        el('div', { class: 'meta' }, r.trick ? `새 개인기: ${r.trickName}` : '복습 완료!'));
    })) : el('p', { class: 'help' }, '아직 알림장이 없어요. 멍뭉 학교에 보내 보세요!'));
}

// ---------- 소리 ----------
function renderSoundBtn() {
  const btn = $('#sound-btn');
  btn.replaceChildren(el('img', { class: 'pixel', src: iconURL(isMuted() ? 'mute' : 'sound', 2), alt: '' }));
  btn.setAttribute('aria-label', isMuted() ? '소리 켜기' : '소리 끄기');
}

function toggleSound() {
  unlock();
  setMuted(!isMuted());
  if (!isMuted()) { playBgm('home'); sfx.pop(); }
  renderSoundBtn();
}

document.addEventListener('pointerdown', () => unlock(), { capture: true });
// 아이폰은 손을 뗄 때(touchend)만 소리를 다시 켜 주는 경우가 있어요
document.addEventListener('touchend', () => unlock(), { capture: true, passive: true });
document.addEventListener('keydown', () => unlock(), { capture: true });
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .tab, .option, .pin-key, .phrase, .item, .card[onclick], .segmented button')) sfx.click();
}, { capture: true });

// ---------- 설정 ----------
function openSettings() {
  const { user } = state.me;
  modal({
    title: '내 정보',
    body: el('div', { class: 'center' },
      el('p', {}, `닉네임: ${user.nickname}`),
      el('p', {}, `친구 코드: ${user.friendCode}`),
      el('p', { class: 'help' }, '강아지는 방치해도 아프거나 떠나지 않아요. 대신 조금 시무룩해지니까 자주 놀러 와 주세요!'),
      canInstall() ? el('button', { class: 'btn small primary', onclick: () => installApp() }, '📲 앱으로 설치하기') : null,
      state.me.dog?.special && !state.me.dog.original ? el('button', { class: 'link', onclick: openOriginal }, '원조 코드가 있어요') : null,
      el('p', { class: 'legal-link' }, el('a', { href: '/privacy', target: '_blank', rel: 'noopener' }, '개인정보처리방침'), ' · ',
        el('button', { class: 'link danger', onclick: openDeleteAccount }, '계정 지우기'))),
    buttons: [
      { label: '로그아웃', kind: 'secondary', onClick: logout },
      { label: '닫기' },
    ],
  });
}

// 계정 지우기: 비밀번호를 한 번 더 넣어야 해요. 되돌릴 수 없어요.
function openDeleteAccount() {
  closeAllModals();
  let pin = '';
  const delPad = pinPad((p) => { pin = p; btn.disabled = p.length !== 4; });
  const btn = el('button', { class: 'btn danger-btn', disabled: true }, '정말 지우기');
  const { close } = modal({
    title: '계정을 지울까요?',
    body: el('div', { class: 'center' },
      el('p', {}, `${state.me.user.nickname}의 강아지·아이템·친구·편지가 `, el('b', {}, '모두 사라지고 되돌릴 수 없어요.')),
      el('p', { class: 'help' }, '꼭 보호자와 함께 결정해 주세요. 계속하려면 비밀번호 숫자 4개를 넣어 주세요.'),
      delPad.node,
      el('div', { class: 'modal-buttons' }, el('button', { class: 'btn secondary', onclick: () => close() }, '그만두기'), btn)),
    buttons: [],
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await post('/account/delete', { pin });
      forgetAccount(state.me.user.nickname);
      setToken(null);
      close();
      modal({ title: '계정을 지웠어요', body: el('p', { class: 'center' }, '그동안 함께해 줘서 고마웠어요. 🐾'), buttons: [{ label: '처음으로', onClick: () => { location.href = '/'; } }], dismissable: false });
    } catch (err) { toast(err.message, 'bad'); delPad.reset(); }
  });
}

function openOriginal() {
  const input = el('input', { class: 'chat-input', maxlength: 32, placeholder: '원조 코드', autocomplete: 'off', 'aria-label': '원조 코드' });
  modal({
    title: '👑 원조 코드',
    body: el('div', { class: 'center' }, el('p', { class: 'help' }, '스페셜 친구마다 딱 한 명만 원조가 될 수 있어요.'), input),
    buttons: [
      { label: '그만두기', kind: 'secondary' },
      {
        label: '확인',
        onClick: async () => {
          try {
            const res = await post('/dog/original', { code: input.value });
            closeAllModals();
            applyMe(res);
            sfx.levelUp();
            toast(`👑 ${res.dog.name}의 원조가 되었어요!`, 'good');
            renderPanel();
          } catch (err) { toast(err.message, 'bad'); return false; }
          return true;
        },
      },
    ],
  });
}

async function logout() {
  try { await post('/logout'); } catch { /* 이미 만료 */ }
  setToken(null);
  location.href = '/';
}

// ---------- 초대 링크(?code=) ----------
const CODE_KEY = 'meongmung.code';
function stashCode() {
  const code = new URLSearchParams(location.search).get('code');
  if (!code) return;
  try { sessionStorage.setItem(CODE_KEY, code.toUpperCase()); } catch { /* 무시 */ }
  history.replaceState(null, '', '/');
}

async function handlePendingCode() {
  let code = null;
  try { code = sessionStorage.getItem(CODE_KEY); sessionStorage.removeItem(CODE_KEY); } catch { /* 무시 */ }
  if (!code) return;
  try {
    const t = await api(`/friends/lookup/${encodeURIComponent(code)}`);
    if (t.isMe) return;
    if (t.isFriend) {
      modal({ title: `${t.nickname}네 집`, body: el('p', { class: 'center' }, '놀러 갈까요?'), buttons: [{ label: '다음에', kind: 'secondary' }, { label: '놀러 가기!', onClick: () => enterRoom(t.id) }] });
    } else {
      modal({
        title: '초대장을 받았어요!',
        body: el('p', { class: 'center' }, `${t.nickname}에게 친구 신청을 보낼까요? 친구가 수락하면 서로의 집에 놀러 갈 수 있어요.`),
        buttons: [
          { label: '다음에', kind: 'secondary' },
          {
            label: '친구 신청!',
            onClick: async () => {
              try {
                const res = await post('/friends/request', { code });
                toast(res.status === 'friends' ? `${res.nickname}(이)랑 친구가 되었어요!` : '친구 신청을 보냈어요!', 'good');
              } catch (err) { toast(err.message, 'bad'); }
            },
          },
        ],
      });
    }
  } catch (err) { toast(err.message, 'bad'); }
}

// ---------- 새 버전 확인 ----------
// 캐시 때문에 옛 화면이 남아 있어도, 서버 버전이 바뀌면 놀이 중이 아닐 때 알아서 새로고침해요.
const MY_BUILD = document.querySelector('meta[name="build"]')?.content ?? null;
async function checkVersion() {
  if (!MY_BUILD) return;
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    const { build } = await res.json();
    if (!build || build === MY_BUILD) return;
    const busy = $('#modal-root').children.length || document.querySelector('.runner-screen') || state.plaza;
    if (busy) { state.updateReady = build; return; }
    location.replace(`/?v=${build}`);
  } catch { /* 인터넷이 잠깐 끊겨도 괜찮아요 */ }
}
setInterval(checkVersion, 3 * 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkVersion(); wakeRefresh(); } });

// 앱을 켜 둔 채로 두었다가 돌아오거나 자정이 지나면 강아지 정보(함께한 날, 출석 등)를 새로 받아요
let lastMe = Date.now();
let lastDay = null;
function wakeRefresh(force = false) {
  if (!state.me?.dog || state.plaza || document.querySelector('.runner-screen')) return;
  if (!force && Date.now() - lastMe < 60_000) return;
  lastMe = Date.now();
  refreshMe();
}
setInterval(() => {
  if (!state.me) return;
  const day = new Date(serverNow() + 9 * 3600_000).toISOString().slice(0, 10);
  if (lastDay && day !== lastDay) wakeRefresh(true);
  lastDay = day;
}, 30_000);

// ---------- 앱으로 설치 (PWA) ----------
// 안드로이드(크롬·삼성 인터넷)는 설치 창을 바로 띄우고, 아이폰은 "홈 화면에 추가" 방법을 알려 줘요.
let installPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canInstall = () => !isStandalone() && (!!installPrompt || isIOS());

function renderInstallBtn() {
  const btn = $('#install-btn');
  if (btn) btn.hidden = !canInstall();
}

async function installApp() {
  if (installPrompt) {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice.catch(() => ({}));
    if (outcome === 'accepted') installPrompt = null;
    renderInstallBtn();
    return;
  }
  modal({
    title: '홈 화면에 추가하기',
    className: 'install-guide',
    body: el('div', {},
      el('ol', { class: 'install-steps' },
        el('li', {}, '사파리 아래쪽(또는 위쪽)의 ', el('b', {}, '공유 버튼 ⬆️'), '을 눌러요.'),
        el('li', {}, '목록을 내려서 ', el('b', {}, '"홈 화면에 추가"'), '를 눌러요.'),
        el('li', {}, '오른쪽 위 ', el('b', {}, '"추가"'), '를 누르면 홈 화면에 멍뭉고치 아이콘이 생겨요!')),
      el('p', { class: 'help' }, '카카오톡이나 다른 앱 안에서 열었다면, 먼저 사파리로 열어 주세요.')),
    buttons: [{ label: '알겠어요!' }],
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  renderInstallBtn();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  renderInstallBtn();
  toast('앱으로 설치했어요! 이제 홈 화면에서 바로 열 수 있어요.', 'good');
});
$('#install-btn')?.addEventListener('click', installApp);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// ---------- 시작 ----------
async function boot() {
  stashCode();
  if (new URLSearchParams(location.search).has('v')) history.replaceState(null, '', '/');
  checkVersion();
  await document.fonts?.load('16px Galmuri11').catch(() => {});
  if (getToken()) {
    try { await afterLogin(); return; } catch (err) {
      if (err.status === 401) setToken(null);
      else toast(err.message, 'bad');
    }
  }
  showTitle();
}

boot();
