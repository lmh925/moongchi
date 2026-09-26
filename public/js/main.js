// 멍뭉고치 메인 앱
import {
  BREEDS, PERSONALITIES, QUIZ, STAGES, TRICKS, ITEMS, DOG_SLOTS, ROOM_SLOTS, SCHOOL_COURSES,
  STICKERS, PHRASES, EMOTES, SCHOOL_BOOSTS, BOOST_RULES, SPECIALS, SPECIAL_TRICKS, RENAME_PRICE, REPORT_SUBJECTS, RULES, BOND_LEVELS, RARITY, GACHA, TRAINING, PLAZA, PLAZA_SPOTS, COOP_GAMES, TAG, TREASURE, SOCCER,
} from '../shared/data.js';
import { applyDecay, quizResult } from '../shared/rules.js';
import { api, post, getToken, setToken } from './api.js';
import { $, el, toast, modal, closeAllModals, pinPad, fmtDuration } from './ui.js';
import { dogSprite, dogPortrait, iconURL, accessoryURL, DOG_W, DOG_H } from './sprites.js';
import { Scene, renderRoom } from './scene.js';
import { playMinigame } from './minigame.js';
import { playRunner, enterLandscape, exitLandscape } from './runner.js';
import { playGacha } from './gacha.js';
import { playTraining } from './training.js';
import { playPhotobooth, loadAlbum, removeFromAlbum, downloadPhoto } from './photobooth.js';
import { playJumpRope } from './jumprope.js';
import { PlazaView } from './plaza.js';
import { CoopClient } from './coop.js';
import { levelBar, titleChip, openDogCard, playLevelUp, talentUpBody } from './level.js';
import { playSpecialReveal, specialMark } from './special.js';
import {
  questCard, stampBody, badgeBody, badgeIcon, badgeBoard, dexPanel, openMailbox, qrModal, openPhotoCard,
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
  $('#auth-submit').disabled = $('#auth-nick').value.trim().length < 2 || authPin.length !== 4;
}

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
          a.breed && BREEDS[a.breed] ? el('img', { class: 'pixel', src: dogPortrait(a.breed, a.stage ?? 0, { equip: a.equip ?? undefined }), alt: '' }) : el('span', { class: 'quick-noimg' }),
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
    const res = await post(authMode === 'signup' ? '/signup' : '/login', { nickname: $('#auth-nick').value.trim(), pin: authPin });
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
  show('quiz');
  showQuestion(0);
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
  state.me = me;
  state.speed = me.speed ?? 1;
  state.offset = (me.serverNow ?? Date.now()) - Date.now();
  rememberAccount(me);
  if (!me.dog) return;
  $('#top-name').textContent = me.dog.name;
  $('#top-stage').textContent = STAGES[me.dog.stage].name;
  $('#top-level').textContent = `Lv ${me.dog.level}`;
  $('#top-level').className = `chip lv-badge frame-${me.dog.frame ?? 0}`;
  $('#top-coins').textContent = me.user.coins;
  $('#badge-notebook').hidden = !me.unreadReports;
  $('#badge-friends').hidden = !me.pendingFriends;
  $('#badge-mail').hidden = !me.progress?.unreadMail;
  if (me.progress?.unreadMail) $('#badge-mail').textContent = me.progress.unreadMail;
  // 내 강아지 모습 갱신
  if (state.scene && state.room) {
    const e = state.scene.entities.get(myId());
    if (e) e.dog = publicDog(me.dog);
    if (atHome()) updateAway();
  }
  scheduleSchool();
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
      onTreatNear: (t, pos) => state.socket?.emit('party:grab', { treatId: t.id, x: pos.x, y: pos.y }),
      onDogTap: (e, combo) => {
        sfx.bark(barkPitch(e.dog), combo === 'spin' ? 2 : 1);
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
  handleEvents(me.events);
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
  });
  socket.on('room:move', ({ userId, x, y }) => state.scene.moveTo(userId, x, y));
  socket.on('room:bubble', ({ userId, kind, value }) => {
    sfx.pop();
    state.scene.bubble(userId, kind, value);
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
  socket.on('room:decor', ({ decor }) => { state.scene.setDecor(decor); if (state.room) state.room.decor = decor; });
  socket.on('room:chat-allowed', ({ allowed }) => {
    state.chatAllowed = allowed;
    const row = $('#chat-row');
    if (row) row.hidden = !allowed;
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
  for (const m of room.members) {
    if (m.userId === ownerId) continue;
    scene.upsert(m.userId, {
      dog: m.userId === me ? publicDog(state.me.dog) : m.dog, nickname: m.nickname, x: m.x, y: m.y,
      mine: m.userId === me, auto: m.userId === me,
    });
  }
  scene.showNames = ownerId !== me || room.members.length > 1;
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
    if (ev.type === 'specialLost') toast(`${SPECIALS[ev.key]?.name ?? '스페셜'} 모습에서 원래 모습으로 돌아왔어요.`);
    if (ev.type === 'grew') await showGrew(ev);
    if (ev.type === 'schoolDone') await showReport(ev.report, true);
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

async function openMail() {
  try {
    await openMailbox({
      api, post,
      itemName: (id) => ITEMS[id]?.name ?? '선물',
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

function openMyCard() {
  openDogCard(state.me.dog, {
    mine: true,
    badges: showcaseIcons(state.me.progress?.showcase),
    onRename: openRename,
    onPhotoCard: () => openPhotoCard(state.me.dog, state.me.user, state.me.progress),
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
    el('h3', {}, `${dog.name}`, el('span', { class: 'chip' }, `${BREEDS[dog.breed].name}`), el('span', { class: 'chip' }, `${p.emoji} ${p.name}`)),
    el('div', { class: 'stats' },
      statRow('fullness', '포만감', 'food', 'var(--stat-full)'),
      statRow('cleanliness', '청결도', 'sparkle', 'var(--stat-clean)'),
      statRow('affection', '애정도', 'heart', 'var(--stat-love)')),
    el('div', { class: 'level-row' },
      levelBar(dog),
      el('button', { class: 'btn small secondary card-btn', onclick: openMyCard }, '강아지 카드')),
    el('div', { class: 'growth' },
      titleChip(dog),
      g ? `다음 성장: ${g.next} (${[g.level < g.needLevel ? `Lv ${g.needLevel}까지` : null, g.days < g.needDays ? `함께한 날 ${g.days}/${g.needDays}일` : null].filter(Boolean).join(' · ') || '곧 자라요!'})`
        : '늠름한 강아지로 다 자랐어요! 레벨은 앞으로도 계속 올라요.'),
    away ? el('div', { class: 'school-board' }, `${dog.name}(은)는 학교에서 공부 중이에요`, el('div', { class: 'big', id: 'school-left' }, ''), '돌아오면 알림장을 받을 수 있어요!',
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onclick: leaveSchool }, '조퇴하고 데려오기'),
        el('button', { class: 'btn small primary', onclick: () => setTab('school') }, '빨리 오게 하기'))) : null,
    el('div', { class: 'actions' },
      actionBtn('밥주기', 'food', () => doCare('feed'), away),
      actionBtn('빗질하기', 'brush', () => doCare('brush'), away),
      actionBtn('쓰다듬기', 'heart', () => doCare('pet'), away),
      actionBtn('개인기', 'star', openTricks, away)),
    questCard(state.me.progress),
    roomGames(),
    partyButton(),
    bondList(),
    chatBar());
}

// ---------- 마이룸 미니게임: 네컷 포토부스 & 합동 줄넘기 ----------
// 같은 방에 친구 강아지가 있으면 그 강아지와, 없으면 이웃집 초코와 함께 해요.
const NEIGHBOR = { name: '초코', breed: 'shiba', personality: 'hyper', stage: 1, equip: {}, fluff: 0, tricks: [], mood: 'happy' };

function partner() {
  const e = [...(state.scene?.entities.values() ?? [])].find((x) => x.id !== myId() && x.dog && !x.dog.atSchool);
  return e ? { dog: e.dog, name: e.dog.name } : { dog: NEIGHBOR, name: '이웃집 초코' };
}

function roomGames() {
  const mine = state.me.dog;
  const p = partner();
  return el('div', { class: 'room-games' },
    el('div', { class: 'section-title' }, `${p.name}(이)랑 같이 놀기`),
    el('div', { class: 'room-games-row' },
      el('button', { class: 'btn game-btn', disabled: !!mine.school, onclick: startPhotobooth },
        el('img', { class: 'pixel', src: iconURL('camera', 3), alt: '' }), '네컷 포토부스'),
      el('button', { class: 'btn game-btn', disabled: !!mine.school, onclick: startJumpRope },
        el('img', { class: 'pixel', src: iconURL('rope', 3), alt: '' }), '합동 줄넘기')));
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
  await playJumpRope(mine, p.dog, [mine.name, p.dog.name]);
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
    dog ? el('p', { class: 'sub' }, `${dog.name} · ${BREEDS[dog.breed].name} · ${PERSONALITIES[dog.personality].name} · ${STAGES[dog.stage].name}`) : null,
    dog?.level ? el('div', { class: 'growth' },
      el('span', { class: `lv-badge frame-${dog.frame ?? 0}` }, `Lv ${dog.level}`), titleChip(dog),
      el('button', { class: 'btn small secondary card-btn', onclick: () => openDogCard(dog, { ownerName: room.owner.nickname, badges: showcaseIcons(dog.showcase) }) }, '강아지 카드')) : null,
    el('div', { class: 'actions' },
      actionBtn(dog ? `${dog.name} 쓰다듬기` : '쓰다듬기', 'heart', () => state.socket.emit('room:pet', { userId: room.owner.id }), !dog || dog.atSchool),
      actionBtn('개인기', 'star', openTricks, !!mine.school),
      actionBtn(`${mine.name} 쓰다듬기`, 'paw', () => doCare('pet'), !!mine.school),
      actionBtn('집으로', 'paw', () => enterRoom(myId()), false)),
    roomGames(),
    partyButton(),
    bondList(),
    chatBar());
}

function chatBar() {
  const input = el('input', { class: 'chat-input', maxlength: 20, placeholder: '친구에게 한마디 (20자)', 'aria-label': '채팅' });
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    const res = await emitAck('room:chat', { text });
    if (res.ok) input.value = '';
    else toast(res.reason, 'bad');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  const alone = (state.room?.members.length ?? 0) <= 1;
  return el('div', { class: 'chatbar' },
    el('div', { class: 'stickers' }, Object.entries(STICKERS).map(([id, name]) => el('button', {
      class: 'sticker', title: name, 'aria-label': name, onclick: () => state.socket?.emit('room:sticker', { id }),
    }, el('img', { class: 'pixel', src: iconURL(id, 3), alt: '' })))),
    el('div', { class: 'phrases' }, PHRASES.map((text, index) => el('button', {
      class: 'phrase', onclick: () => state.socket?.emit('room:phrase', { index }),
    }, text))),
    el('div', { class: 'chat-row', id: 'chat-row', hidden: !state.chatAllowed || alone }, input, el('button', { class: 'btn small primary', onclick: send }, '보내기')),
    el('p', { class: 'hint' }, alone
      ? '친구가 놀러 오면 스티커와 말풍선으로 이야기할 수 있어요.'
      : state.chatAllowed ? '고운 말만 써요! 전화번호·주소 같은 비밀 정보는 보낼 수 없어요.' : '방 안의 모두와 친구가 되면 글자도 쓸 수 있어요.'));
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
  const learnable = Object.entries(TRICKS).filter(([id, t]) => t.stage <= dog.stage && !dog.tricks.includes(id));
  const target = learnable[0];
  const progress = target ? (state.me.user.trainProgress?.[target[0]] ?? 0) : 0;
  return el('div', {},
    el('h3', {}, '멍뭉 학교'),
    el('div', { class: 'together-card' },
      el('div', { class: 'title' }, '함께 등교하기', el('span', { class: 'chip' }, '바로 시작!')),
      el('p', {}, `${dog.name}(이)랑 같이 교실에 가서 선생님 말씀대로 훈련해요. 잘하면 그 자리에서 새 개인기를 배워요!`),
      target
        ? el('div', { class: 'meta' }, '배우는 중: ', el('b', {}, target[1].name), ` (${progress}/${dog.effects?.learnHits ?? TRAINING.learnHits})`)
        : el('div', { class: 'meta' }, '지금 배울 수 있는 개인기를 다 배웠어요! 자라면 새 개인기가 열려요.'),
      el('button', { class: 'btn primary', onclick: startTraining }, '교실로 가기!')),
    el('div', { class: 'section-title' }, '혼자 보내기'),
    el('p', { class: 'sub' }, '수업을 고르면 강아지가 혼자 학교에 가요. 돌아오면 알림장과 선물을 받아요!'),
    el('div', { class: 'cards' }, Object.entries(SCHOOL_COURSES).map(([id, c]) => el('div', { class: 'card' },
      el('div', { class: 'title' }, c.name, el('button', {
        class: 'btn small green',
        onclick: () => modal({
          title: `${c.name}에 보낼까요?`,
          body: el('p', { class: 'center' }, `${real(c.minutes)} 뒤에 돌아와요. 다녀오는 동안 쓰다듬거나 밥을 줄 수 없어요.`),
          buttons: [
            { label: '다음에', kind: 'secondary' },
            { label: '다녀와!', onClick: () => goSchool(id) },
          ],
        }),
      }, '보내기')),
      el('div', { class: 'meta' }, c.desc),
      el('div', { class: 'meta' }, `⏰ ${real(c.minutes)} · 코인 ${c.coins} · 경험치 ${c.exp} · 개인기 배울 확률 ${Math.round(c.trickChance * 100)}%`)))),
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

async function startTraining() {
  const dog = state.me.dog;
  try {
    unlock();
    const info = await post('/training/start');
    const score = await playTraining(publicDog(dog), info);
    const res = await post('/training/finish', { trainingId: info.trainingId, target: info.target, ...score });
    applyMe(res);
    const r = res.result;
    if (r.learned) {
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
      if (r.coins) sfx.coin();
      toast(`훈련 끝! 성공 ${score.correct}번 · 코인 +${r.coins} · 경험치 +${r.exp}${info.target ? ` · ${TRICKS[info.target].name} ${r.progress}/${r.need ?? TRAINING.learnHits}` : ''}`, 'good');
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
  const data = await api('/friends');
  if (state.tab !== 'friends') return null;
  $('#badge-friends').hidden = !data.incoming.length;
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
    el('div', { class: 'section-title' }, `내 친구 (${data.friends.length})`),
    data.friends.length ? el('div', { class: 'cards' }, data.friends.map((f) => el('div', { class: 'card friend' },
      f.dog ? el('img', { class: 'pixel', src: dogPortrait(f.dog.breed, f.dog.stage, { equip: f.dog.equip }), alt: '' }) : el('span'),
      el('div', {},
        el('div', { class: 'title' }, el('span', {}, el('i', { class: `online ${f.online ? 'on' : ''}` }), f.nickname)),
        el('div', { class: 'meta' }, f.dog ? `${f.dog.name} · ${BREEDS[f.dog.breed].name}${f.dog.atSchool ? ' · 학교 가는 중' : ''}` : ''),
        f.bond ? el('div', { class: 'meta' }, el('span', { class: 'hearts' }, '♥'.repeat(f.bond.level + 1)), ` ${f.bond.name}`) : null),
      el('div', { class: 'btns' },
        el('button', { class: 'btn small green', onclick: () => enterRoom(f.id) }, '놀러 가기'),
        f.online && atHome() ? el('button', { class: 'btn small secondary', onclick: () => invite(f) }, '초대') : null,
        el('button', { class: 'btn small', title: '친구 끊기', 'aria-label': '친구 끊기', onclick: () => unfriend(f) }, '…'))))) : el('p', { class: 'help' }, '아직 친구가 없어요. 친구 코드를 주고받아 보세요!'),
    data.outgoing.length ? el('p', { class: 'hint' }, `수락을 기다리는 신청: ${data.outgoing.map((o) => o.nickname).join(', ')}`) : null);
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
  state.plaza = { view, channel: res.channel, count: res.members.length, tag: res.tag, waiting: {}, friends, treasures: res.treasures ?? 0, hint: null, soccer: res.soccer };
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
    content = [el('b', {}, '놀이터를 돌아다녀 보세요!'), el('div', { class: 'meta' }, '선물 상자·줄넘기 터·장난감 방(왼쪽), 쿠션 탑·간식 공장·축구장(오른쪽 아래), 술래잡기 마당(오른쪽 위), 보물 모래밭(연못 아래)에 가면 같이 놀 수 있어요.')];
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
    el('div', { class: 'chatbar' },
      el('div', { class: 'stickers' }, Object.entries(STICKERS).map(([id, name]) => el('button', {
        class: 'sticker', title: name, 'aria-label': name, onclick: () => state.socket.emit('plaza:sticker', { id }),
      }, el('img', { class: 'pixel', src: iconURL(id, 3), alt: '' })))),
      el('div', { class: 'phrases' }, PHRASES.map((text, index) => el('button', {
        class: 'phrase', onclick: () => state.socket.emit('plaza:phrase', { index }),
      }, text)))),
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
      el('p', {}, `${e.dog.name} · ${BREEDS[e.dog.breed].name} · ${STAGES[e.dog.stage].name}`),
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
    el('h3', {}, '혼자 하는 놀이'),
    el('p', { class: 'sub' }, dog.school ? '강아지가 학교에서 돌아오면 놀 수 있어요.' : `오늘 남은 횟수: ${left}번 · 한 판에 코인 최대 ${RULES.minigame.maxCoins}개 · 애정도 UP`),
    el('div', { class: 'cards' },
      el('div', { class: 'card' },
        el('div', { class: 'title' }, '네컷 포토부스', el('span', { class: 'btns' },
          el('button', { class: 'btn small', onclick: openAlbum }, '앨범'),
          el('button', { class: 'btn small green', disabled: !!dog.school, onclick: startPhotobooth }, '찍기!'))),
        el('div', { class: 'meta' }, `${partner().name}(이)랑 나란히 서서 소품을 씌우고 네 컷 사진을 찍어요.`)),
      el('div', { class: 'card' },
        el('div', { class: 'title' }, '합동 줄넘기', el('button', { class: 'btn small green', disabled: !!dog.school, onclick: startJumpRope }, '놀기!')),
        el('div', { class: 'meta' }, '밧줄이 발밑 선에 닿을 때 톡! 둘이 같이 깡총 뛰어요. 몇 콤보까지 갈 수 있을까?')),
      card('run', '멍뭉 런', `${dog.name}(이)가 들판을 신나게 달려요! 점프(두 번까지)와 슬라이드로 장애물을 피하고 간식을 모아요.`),
      card('catch', '간식 받아먹기', `하늘에서 떨어지는 간식을 ${dog.name}(이)가 받아먹어요! 화면을 누르거나 끌어서 움직여요.`)));
}

async function startGame(type) {
  // 멍뭉 런은 가로 전체 화면으로 (버튼을 누른 바로 그 순간에 요청해야 브라우저가 허락해요)
  if (type === 'run') enterLandscape();
  try {
    unlock();
    const { gameId } = await post('/minigame/start', { type });
    const score = type === 'run' ? await playRunner(state.me.dog) : await playMinigame(state.me.dog);
    const res = await post('/minigame/finish', { gameId, score });
    applyMe(res);
    if (res.result.coins) sfx.coin();
    toast(`간식 ${score}개! 뼈다귀 코인 +${res.result.coins}${res.result.exp ? ` · 경험치 +${res.result.exp}` : ''}`, 'good');
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
      state.me.dog?.special && !state.me.dog.original ? el('button', { class: 'link', onclick: openOriginal }, '원조 코드가 있어요') : null),
    buttons: [
      { label: '로그아웃', kind: 'secondary', onClick: logout },
      { label: '닫기' },
    ],
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
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

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
