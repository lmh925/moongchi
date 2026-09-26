// 멍뭉고치 메인 앱
import {
  BREEDS, PERSONALITIES, QUIZ, STAGES, TRICKS, ITEMS, DOG_SLOTS, ROOM_SLOTS, SCHOOL_COURSES,
  STICKERS, PHRASES, REPORT_SUBJECTS, RULES, BOND_LEVELS, RARITY, GACHA, TRAINING,
} from '/shared/data.js';
import { applyDecay, quizResult } from '/shared/rules.js';
import { api, post, getToken, setToken } from './api.js';
import { $, el, toast, modal, closeAllModals, pinPad, fmtDuration } from './ui.js';
import { dogSprite, dogPortrait, iconURL, accessoryURL, DOG_W, DOG_H } from './sprites.js';
import { Scene, renderRoom } from './scene.js';
import { playMinigame } from './minigame.js';
import { playRunner, enterLandscape, exitLandscape } from './runner.js';
import { playGacha } from './gacha.js';
import { playTraining } from './training.js';
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
};

// 강아지 크기와 견종에 따라 짖는 소리 높낮이가 달라요
const barkPitch = (dog) => (dog ? 1.35 - dog.stage * 0.15 - (dog.breed === 'corgi' || dog.breed === 'shiba' ? 0.1 : 0) : 1);

const myId = () => state.me?.user.id;
const serverNow = () => Date.now() + state.offset;
const atHome = () => state.roomOwnerId === myId();

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
const pad = pinPad((p) => { authPin = p; updateAuthButton(); });
$('#auth-pin').append(pad.node);

function updateAuthButton() {
  $('#auth-submit').disabled = $('#auth-nick').value.trim().length < 2 || authPin.length !== 4;
}

function openAuth(mode) {
  authMode = mode;
  $('#auth-title').textContent = mode === 'signup' ? '처음 오셨군요! 반가워요' : '다시 와 줘서 고마워요!';
  $('#auth-help').textContent = mode === 'signup'
    ? '친구들이 부를 닉네임과, 나만 아는 숫자 4개를 정해 주세요. 이름·전화번호 같은 진짜 정보는 쓰지 마세요!'
    : '닉네임과 비밀번호 숫자 4개를 넣어 주세요.';
  $('#auth-submit').textContent = mode === 'signup' ? '시작하기' : '들어가기';
  $('#auth-error').textContent = '';
  $('#auth-nick').value = '';
  pad.reset();
  show('auth');
  $('#auth-nick').focus();
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
  if (go === 'title') { show('title'); drawTitle(); } else openAuth(go);
}));

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
  if (!me.dog) return;
  $('#top-name').textContent = me.dog.name;
  $('#top-stage').textContent = STAGES[me.dog.stage].name;
  $('#top-coins').textContent = me.user.coins;
  $('#badge-notebook').hidden = !me.unreadReports;
  $('#badge-friends').hidden = !me.pendingFriends;
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
  }
  setTab('home');
  playBgm('home');
  if (me.dailyCoins) toast(`출석 보상! 뼈다귀 코인 ${me.dailyCoins}개를 받았어요`, 'good');
  handleEvents(me.events);
  handlePendingCode();
}

function setTab(tab) {
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
  socket.on('connect', () => enterRoom(state.roomOwnerId ?? myId(), { quiet: true }));
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
      el('p', { class: 'hint' }, `배운 개인기 ${known.length} / ${Object.keys(TRICKS).length} · 더 자라면 새로운 개인기를 배울 수 있어요.`)),
    buttons: [{ label: '닫기', kind: 'secondary' }],
  });
}

// ---------- 이벤트 (성장, 하교) ----------
async function handleEvents(events = []) {
  for (const ev of events) {
    if (ev.type === 'grew') await showGrew(ev);
    if (ev.type === 'schoolDone') await showReport(ev.report, true);
  }
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
    g ? el('div', { class: 'growth' },
      `다음 성장: ${g.next} (경험치 ${g.exp}/${g.needExp} · 함께한 날 ${g.days}/${g.needDays}일)`,
      el('div', { class: 'bar' }, el('i', { style: { width: `${Math.round(g.ratio * 100)}%` } })))
      : el('div', { class: 'growth' }, '늠름한 강아지로 다 자랐어요! 앞으로도 사랑 듬뿍 주세요.'),
    away ? el('div', { class: 'school-board' }, `${dog.name}(은)는 학교에서 공부 중이에요`, el('div', { class: 'big', id: 'school-left' }, ''), '돌아오면 알림장을 받을 수 있어요!',
      el('div', {}, el('button', { class: 'btn small', onclick: leaveSchool }, '조퇴하고 데려오기'))) : null,
    el('div', { class: 'actions' },
      actionBtn('밥주기', 'food', () => doCare('feed'), away),
      actionBtn('빗질하기', 'brush', () => doCare('brush'), away),
      actionBtn('쓰다듬기', 'heart', () => doCare('pet'), away),
      actionBtn('개인기', 'star', openTricks, away)),
    bondList(),
    chatBar());
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
  const dog = room.homeDog;
  const mine = state.me.dog;
  return el('div', {},
    el('h3', {}, `${room.owner.nickname}네 집`),
    dog ? el('p', { class: 'sub' }, `${dog.name} · ${BREEDS[dog.breed].name} · ${PERSONALITIES[dog.personality].name} · ${STAGES[dog.stage].name}`) : null,
    el('div', { class: 'actions' },
      actionBtn(dog ? `${dog.name} 쓰다듬기` : '쓰다듬기', 'heart', () => state.socket.emit('room:pet', { userId: room.owner.id }), !dog || dog.atSchool),
      actionBtn('개인기', 'star', openTricks, !!mine.school),
      actionBtn(`${mine.name} 쓰다듬기`, 'paw', () => doCare('pet'), !!mine.school),
      actionBtn('집으로', 'paw', () => enterRoom(myId()), false)),
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
      el('button', { class: 'btn secondary', style: { width: '100%' }, onclick: leaveSchool }, '조퇴하고 데려오기'));
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
        ? el('div', { class: 'meta' }, '배우는 중: ', el('b', {}, target[1].name), ` (${progress}/${TRAINING.learnHits})`)
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
      el('div', { class: 'meta' }, `⏰ ${real(c.minutes)} · 코인 ${c.coins} · 경험치 ${c.exp} · 개인기 배울 확률 ${Math.round(c.trickChance * 100)}%`)))));
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
      toast(`훈련 끝! 성공 ${score.correct}번 · 코인 +${r.coins} · 경험치 +${r.exp}${info.target ? ` · ${TRICKS[info.target].name} ${r.progress}/${TRAINING.learnHits}` : ''}`, 'good');
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
        free ? '오늘 무료 뽑기!' : el('span', { class: 'price' }, '뽑기 ', el('img', { class: 'pixel', src: iconURL('coin', 2), alt: '코인' }), GACHA.price))),
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
        el('button', { class: 'btn small secondary', onclick: () => shareLink(link) }, '초대 링크 보내기'))),
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

function playPanel() {
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
    el('h3', {}, '놀이터'),
    el('p', { class: 'sub' }, dog.school ? '강아지가 학교에서 돌아오면 놀 수 있어요.' : `오늘 남은 횟수: ${left}번 · 한 판에 코인 최대 ${RULES.minigame.maxCoins}개 · 애정도 UP`),
    el('div', { class: 'cards' },
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
    toast(`간식 ${score}개! 뼈다귀 코인 +${res.result.coins}`, 'good');
    renderPanel();
  } catch (err) { exitLandscape(); toast(err.message, 'bad'); renderPanel(); }
}

async function notebookPanel() {
  const { reports } = await api('/reports');
  if (state.tab !== 'notebook') return null;
  $('#badge-notebook').hidden = true;
  return el('div', {},
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
      el('p', { class: 'help' }, '강아지는 방치해도 아프거나 떠나지 않아요. 대신 조금 시무룩해지니까 자주 놀러 와 주세요!')),
    buttons: [
      { label: '로그아웃', kind: 'secondary', onClick: logout },
      { label: '닫기' },
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

// ---------- 시작 ----------
async function boot() {
  stashCode();
  await document.fonts?.load('16px Galmuri11').catch(() => {});
  if (getToken()) {
    try { await afterLogin(); return; } catch (err) {
      if (err.status === 401) setToken(null);
      else toast(err.message, 'bad');
    }
  }
  show('title');
  drawTitle();
}

boot();
