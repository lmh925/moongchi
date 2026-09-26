// 함께 등교: 교실에서 선생님 명령에 맞춰 강아지를 훈련해요.
// 선생님이 "앉아!" 하면 맞는 그림 버튼을 빨리 눌러요. "기다려!"일 때는 아무것도 누르지 않아야 해요.
import { TRICKS, TRAINING } from '/shared/data.js';
import { Scene, SCENE_W, SCENE_H } from './scene.js';
import { dogPortrait } from './sprites.js';
import { el } from './ui.js';
import { sfx, playBgm } from './audio.js';

const OUT = '#4a3330';
const TEACHER = {
  name: '푸들 선생님', breed: 'poodle', personality: 'smart', stage: 2,
  equip: { face: 'round_glasses', neck: 'bowtie' }, fluff: 0, mood: 'happy', tricks: [],
};

// 트릭을 보여주는 그림 (버튼용)
const TRICK_POSE = {
  sit: ['sit', {}], paw: ['paw', {}], spin: ['front', { mouth: 'tongue' }], jump: ['walk1', { mouth: 'open' }],
  bow: ['bow', { eyes: 'closed' }], roll: ['lie', {}], dance: ['beg', { mouth: 'open' }],
  bang: ['lie', { eyes: 'closed', mouth: 'tongue' }], sing: ['front', { mouth: 'open', eyes: 'closed' }],
};

function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function classroom() {
  const c = document.createElement('canvas');
  c.width = SCENE_W; c.height = SCENE_H;
  const ctx = c.getContext('2d');
  // 벽
  rect(ctx, 0, 0, SCENE_W, 72, '#fff1c9');
  for (let y = 6; y < 66; y += 10) rect(ctx, 0, y, SCENE_W, 1, '#f5e2b0');
  // 알록달록 가랜드
  for (let x = 0; x < SCENE_W; x += 12) {
    const colors = ['#ff9fb8', '#7cc7ff', '#ffe066', '#9fe0c8'];
    for (let i = 0; i < 5; i++) rect(ctx, x + 1 + i * 0.5, 3 + i, 9 - i, 1, colors[(x / 12) % 4]);
  }
  rect(ctx, 0, 2, SCENE_W, 1, OUT);
  // 칠판
  rect(ctx, 46, 10, 100, 44, OUT);
  rect(ctx, 48, 12, 96, 40, '#9c6b3f');
  rect(ctx, 50, 14, 92, 36, '#2f6b3a');
  rect(ctx, 50, 14, 92, 2, '#3c7f47');
  rect(ctx, 60, 50, 72, 3, '#9c6b3f');
  rect(ctx, 66, 49, 6, 2, '#ffffff'); rect(ctx, 76, 49, 5, 2, '#ffe066'); rect(ctx, 86, 49, 5, 2, '#ff9fb8');
  // 창문과 시계
  rect(ctx, 8, 14, 30, 30, OUT); rect(ctx, 10, 16, 26, 26, '#bfe6ff'); rect(ctx, 10, 34, 26, 8, '#3f8f3a');
  rect(ctx, 22, 16, 2, 26, '#9c6b3f'); rect(ctx, 10, 28, 26, 2, '#9c6b3f');
  for (let a = 0; a < 20; a++) {
    const ang = (a / 20) * Math.PI * 2;
    rect(ctx, Math.round(170 + Math.cos(ang) * 9), Math.round(26 + Math.sin(ang) * 9), 2, 2, OUT);
  }
  rect(ctx, 163, 19, 14, 14, '#ffffff'); rect(ctx, 169, 20, 2, 7, OUT); rect(ctx, 169, 26, 6, 2, OUT);
  // 바닥
  rect(ctx, 0, 66, SCENE_W, 6, '#8a5429');
  rect(ctx, 0, 72, SCENE_W, SCENE_H - 72, '#e3b27a');
  for (let y = 72, r = 0; y < SCENE_H; y += 9, r++) {
    rect(ctx, 0, y, SCENE_W, 1, '#c68c52');
    for (let x = (r % 2) * 16; x < SCENE_W; x += 32) rect(ctx, x, y, 1, 9, '#c68c52');
  }
  // 작은 책상들
  for (const x of [12, 160]) {
    rect(ctx, x - 1, 84, 24, 14, OUT); rect(ctx, x, 85, 22, 4, '#b97f47'); rect(ctx, x + 2, 89, 3, 9, '#8a5429'); rect(ctx, x + 17, 89, 3, 9, '#8a5429');
    rect(ctx, x + 4, 82, 8, 3, '#ff9fb8'); rect(ctx, x + 13, 81, 3, 4, '#7cc7ff');
  }
  return c;
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// info: { trainingId, target, progress, need }
export function playTraining(dog, info) {
  return new Promise((resolve) => {
    const canvas = el('canvas', { class: 'pixel' });
    const overlay = el('div', { class: 'overlay' });
    const board = el('div', { class: 'board-text' }, '준비!');
    const timeBar = el('i', {});
    const scoreEl = el('span', {}, '0');
    const comboEl = el('span', { class: 'combo' }, '');
    const options = el('div', { class: 'train-options' });
    const targetInfo = info.target
      ? el('div', { class: 'train-target' }, '오늘 배울 개인기: ', el('b', {}, TRICKS[info.target].name), ` (${info.progress}/${info.need})`)
      : el('div', { class: 'train-target' }, '모든 개인기를 배웠어요! 오늘은 복습 훈련이에요.');
    const wrap = el('div', { class: 'modal-wrap' },
      el('div', { class: 'modal-card train-card' },
        el('h2', { class: 'modal-title' }, '멍뭉 학교 훈련 수업'),
        targetInfo,
        el('div', { class: 'stage train-stage' }, canvas, overlay, board),
        el('div', { class: 'game-hud' }, el('span', {}, '성공 ', scoreEl, `/${TRAINING.rounds}`), comboEl),
        el('div', { class: 'bar time-bar' }, timeBar),
        options,
        el('p', { class: 'hint' }, '선생님 말에 맞는 그림을 빨리 눌러요! "기다려!"일 때는 꾹 참아요.')));
    document.getElementById('modal-root').append(wrap);

    const scene = new Scene(canvas, overlay, {});
    scene.bg = classroom();
    scene.showBowl = false;
    scene.upsert('teacher', { dog: TEACHER, nickname: '선생님', x: 0.1, y: 0.15, auto: false });
    scene.upsert('me', { dog, nickname: dog.name, x: 0.62, y: 0.55, auto: false, mine: true });
    playBgm('play');

    // 이번 수업의 명령 순서 만들기
    const known = [...new Set([...dog.tricks, ...(info.target ? [info.target] : [])])];
    const rounds = [];
    for (let i = 0; i < (info.target ? TRAINING.targetRounds : 0); i++) rounds.push(info.target);
    rounds.push('wait');
    if (TRAINING.rounds >= 9) rounds.push('wait');
    while (rounds.length < TRAINING.rounds) rounds.push(known[Math.floor(Math.random() * known.length)]);
    shuffle(rounds);
    if (rounds[0] === 'wait') rounds.push(rounds.shift());

    const optionPool = Object.keys(TRICKS).filter((t) => TRICKS[t].stage <= dog.stage);
    let round = -1; let correct = 0; let targetHits = 0; let combo = 0; let bestCombo = 0;
    let deadline = 0; let limit = 0; let answered = true; let timer = null;

    const say = (text) => { scene.bubble('teacher', 'text', text); board.textContent = text; };

    const next = () => {
      round += 1;
      if (round >= rounds.length) return end();
      const cmd = rounds[round];
      answered = false;
      limit = Math.max(1600, 3800 - round * 220);
      deadline = performance.now() + limit;
      sfx.notify();
      if (cmd === 'wait') say('기다려!');
      else say(TRICKS[cmd].name.endsWith('!') ? TRICKS[cmd].name : `${TRICKS[cmd].name}!`);
      // 보기 버튼 (정답 + 오답 2개). 기다려 판에서는 아무거나 3개
      const pick = new Set(cmd === 'wait' ? [] : [cmd]);
      const pool = shuffle(optionPool.filter((t) => t !== cmd));
      while (pick.size < 3 && pool.length) pick.add(pool.pop());
      options.replaceChildren(...shuffle([...pick]).map((t) => {
        const [pose, opts] = TRICK_POSE[t];
        return el('button', { class: 'train-opt', type: 'button', onclick: () => answer(t) },
          el('img', { class: 'pixel', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy', ...opts }, pose), alt: '' }),
          el('span', {}, TRICKS[t].name));
      }));
    };

    const answer = (t) => {
      if (answered) return;
      const cmd = rounds[round];
      answered = true;
      options.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      if (cmd === 'wait') return result(false, '앗, 기다려야 했어요!');
      if (t === cmd) {
        const fast = deadline - performance.now() > limit * 0.5;
        result(true, fast ? '완벽해요!' : '잘했어요!');
        scene.trick('me', t);
        if (t === info.target) targetHits += 1;
      } else result(false, '음? 그게 아니에요~');
    };

    const result = (ok, text) => {
      if (ok) {
        correct += 1; combo += 1; bestCombo = Math.max(bestCombo, combo);
        sfx.bark(1.2); sfx.love();
        scene.effectAt('me', combo >= 3 ? 'star' : 'heart', combo >= 3 ? 3 : 2);
        scene.bubble('teacher', 'text', text);
      } else {
        combo = 0;
        sfx.error();
        scene.bubble('me', 'text', '?');
        scene.bubble('teacher', 'text', text);
      }
      scoreEl.textContent = correct;
      comboEl.textContent = combo >= 2 ? `${combo} 콤보!` : '';
      setTimeout(next, 1700);
    };

    const tick = () => {
      if (!answered) {
        const left = deadline - performance.now();
        timeBar.style.width = `${Math.max(0, (left / limit) * 100)}%`;
        if (left <= 0) {
          answered = true;
          options.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          if (rounds[round] === 'wait') {
            scene.trick('me', 'sit');
            result(true, '잘 참았어요!');
          } else result(false, '시간이 끝났어요~');
        }
      }
      timer = requestAnimationFrame(tick);
    };

    const end = () => {
      cancelAnimationFrame(timer);
      options.replaceChildren();
      say('수업 끝!');
      sfx.bell();
      setTimeout(() => {
        scene.destroy();
        wrap.remove();
        playBgm('home');
        resolve({ correct, targetHits, bestCombo });
      }, 1400);
    };

    setTimeout(() => { say('시작해요!'); setTimeout(next, 900); }, 700);
    tick();
  });
}
