// 훈련 수업 미니게임: 어질리티(튼튼) · 노즈워크(호기심) · 워킹&포즈(멋짐) · 교감(다정)
// 모두 같은 틀(선생님 한마디 · 성공 수 · 그만두기)을 써요. 결과: { correct, quit }
import { TRAIN_COURSES, TRAIN_LEVEL, CERTS } from '../shared/data.js';
import { dogSprite, dogPortrait, DOG_W } from './sprites.js';
import { el } from './ui.js';
import { sfx, playBgm } from './audio.js';

const OUT = '#4a3330';
const rand = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 두 번 눌러야 그만두는 버튼 (실수로 누르지 않게)
export function quitButton(onQuit) {
  let armed = null;
  const btn = el('button', { class: 'btn small secondary train-quit', type: 'button' }, '그만두기');
  btn.addEventListener('click', () => {
    if (armed) { clearTimeout(armed); onQuit(); return; }
    btn.textContent = '정말 그만둘까요? (한 번 더)';
    btn.classList.add('armed');
    armed = setTimeout(() => { armed = null; btn.textContent = '그만두기'; btn.classList.remove('armed'); }, 2500);
  });
  return btn;
}

// 공통 틀
export function trainShell(course, info, { hint }) {
  const C = TRAIN_COURSES[course];
  const need = Math.ceil(C.rounds * TRAIN_LEVEL.pass);
  const say = el('div', { class: 'teacher-say' }, '준비됐어요?');
  const scoreEl = el('b', {}, '0');
  const comboEl = el('span', { class: 'combo' });
  const stage = el('div', { class: `train-play train-${course}` });
  const controls = el('div', { class: 'train-controls' });
  const shell = { done: false, correct: 0, combo: 0, onQuit: null };
  const quit = quitButton(() => shell.onQuit?.());
  const wrap = el('div', { class: 'modal-wrap' },
    el('div', { class: 'modal-card train-card' },
      el('h2', { class: 'modal-title' }, `${C.emoji} ${C.name}`, info.exam ? el('span', { class: 'chip exam-chip' }, `${CERTS[info.exam].emoji} ${CERTS[info.exam].name} 시험`) : null),
      el('div', { class: 'teacher-row' },
        el('img', { class: 'pixel', src: dogPortrait(C.teacher.breed, 2, { equip: C.teacher.equip, eyes: 'happy' }), alt: '' }),
        el('div', {}, el('small', {}, C.teacher.name), say)),
      info.exam ? el('p', { class: 'train-target' }, `${C.rounds}번 중 ${need}번 이상 성공하면 합격!`) : null,
      stage,
      el('div', { class: 'game-hud' }, el('span', {}, '성공 ', scoreEl, ` / ${C.rounds}`), comboEl),
      controls,
      el('div', { class: 'train-foot' }, el('p', { class: 'hint' }, hint), quit)));
  document.getElementById('modal-root').append(wrap);
  playBgm('play');
  Object.assign(shell, {
    wrap, stage, controls, rounds: C.rounds,
    say: (t) => { say.textContent = t; say.classList.remove('pop'); void say.offsetWidth; say.classList.add('pop'); },
    hit(text = '잘했어요!') {
      shell.correct += 1; shell.combo += 1;
      scoreEl.textContent = shell.correct;
      comboEl.textContent = shell.combo >= 2 ? `${shell.combo} 콤보!` : '';
      sfx.love(); shell.say(text);
    },
    miss(text = '아깝다!') { shell.combo = 0; comboEl.textContent = ''; sfx.error(); shell.say(text); },
    close() { wrap.remove(); playBgm('home'); },
  });
  return shell;
}

// ---------- 🏃 어질리티 코스: 장애물에 맞는 버튼 ----------
const OBST = {
  hurdle: { label: '점프', icon: '🦘' },
  tunnel: { label: '엎드려', icon: '🐾' },
  poles: { label: '지그재그', icon: '〰️' },
};
function drawObstacle(ctx, kind, x, g) {
  const r = (xx, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(xx), y, w, h); };
  if (kind === 'hurdle') {
    r(x - 1, g - 24, 4, 24, OUT); r(x + 21, g - 24, 4, 24, OUT);
    r(x, g - 23, 2, 23, '#ffffff'); r(x + 22, g - 23, 2, 23, '#ffffff');
    r(x - 2, g - 22, 28, 6, OUT);
    for (let i = 0; i < 26; i += 6) r(x - 1 + i, g - 21, 3, 4, i % 12 ? '#e84a5f' : '#ffffff');
  } else if (kind === 'tunnel') {
    for (let yy = 0; yy < 22; yy++) {
      const half = Math.round(Math.sqrt(Math.max(0, 1 - ((22 - yy) / 22) ** 2)) * 18);
      r(x + 13 - half - 1, g - 22 + yy, half * 2 + 2, 1, OUT);
      r(x + 13 - half, g - 22 + yy, half * 2, 1, yy % 6 < 3 ? '#5b8cff' : '#8fb0ff');
    }
    for (let yy = 8; yy < 22; yy++) { const half = Math.round(Math.sqrt(Math.max(0, 1 - ((22 - yy) / 14) ** 2)) * 8); r(x + 13 - half, g - 22 + yy, half * 2, 1, '#2a2440'); }
  } else {
    for (let i = 0; i < 4; i++) { r(x + i * 8 - 1, g - 30, 4, 30, OUT); r(x + i * 8, g - 29, 2, 29, i % 2 ? '#ffd23f' : '#3fb58a'); }
  }
}

export function playAgility(dog, info) {
  return new Promise((resolve) => {
    const sh = trainShell('agility', info, { hint: '장애물이 노란 칸에 오면 맞는 버튼을 눌러요!' });
    const W = 240; const H = 110; const G = 96; const DX = 58;
    const canvas = el('canvas', { class: 'pixel agility-canvas', width: W, height: H });
    sh.stage.append(canvas);
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const speed = 62 + info.level * 7 + (info.exam ? 14 : 0);
    let ob = null; let spawned = 0; let t = 0; let act = null; let actT = 0; let raf = 0; let last = performance.now();
    const spawn = () => {
      if (spawned >= sh.rounds) return finish();
      const kinds = Object.keys(OBST);
      ob = { kind: kinds[Math.floor(Math.random() * kinds.length)], x: W + 10, judged: false };
      spawned += 1;
    };
    const inZone = () => ob && !ob.judged && ob.x < DX + 20 && ob.x > DX - 30;
    const press = (kind) => {
      if (sh.done || !ob || ob.judged) return;
      if (ob.x > DX + 60) return; // 아직 멀었어요
      ob.judged = true;
      if (kind === ob.kind && inZone()) {
        act = kind; actT = 0; sh.hit(['좋아!', '완벽해요!', '멋진 몸놀림!'][Math.floor(Math.random() * 3)]);
        if (kind === 'hurdle') sfx.jump(); else sfx.whoosh();
      } else { act = 'bump'; actT = 0; sh.miss(kind === ob.kind ? '조금 더 가까이 왔을 때!' : `${OBST[ob.kind].label}였어요!`); }
    };
    sh.controls.replaceChildren(...Object.entries(OBST).map(([k, o]) => el('button', { class: 'train-opt agility-btn', type: 'button', onpointerdown: (e) => { e.preventDefault(); press(k); } }, el('span', { class: 'big' }, o.icon), el('span', {}, o.label))));
    const frame = (now) => {
      if (sh.done) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; actT += dt;
      if (ob) {
        ob.x -= speed * dt;
        if (!ob.judged && ob.x < DX - 30) { ob.judged = true; act = 'bump'; actT = 0; sh.miss(`${OBST[ob.kind].label}! 늦었어요~`); }
        if (ob.x < -40) { ob = null; setTimeout(spawn, rand(250, 700)); }
      }
      // 그리기
      ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#9fd67f'; ctx.fillRect(0, G, W, H - G);
      ctx.fillStyle = '#6cc070'; for (let x = -((t * speed) % 16); x < W; x += 16) ctx.fillRect(x, G, 8, 2);
      ctx.fillStyle = 'rgba(255,210,63,.45)'; ctx.fillRect(DX - 30, G - 44, 50, 44); // 노란 칸
      ctx.strokeStyle = '#e0a800'; ctx.lineWidth = 1; ctx.strokeRect(DX - 30 + 0.5, G - 44 + 0.5, 49, 43);
      if (ob) {
        drawObstacle(ctx, ob.kind, ob.x, G);
        ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(OBST[ob.kind].icon, ob.x + 12, G - 36);
      }
      let pose = Math.floor(t * 8) % 2 ? 'walk1' : 'walk2'; let y = 0; let opts = { mouth: 'tongue', eyes: 'happy' };
      if (act === 'hurdle' && actT < 0.7) { y = -Math.sin((actT / 0.7) * Math.PI) * 30; pose = 'walk1'; }
      if (act === 'tunnel' && actT < 0.8) { pose = 'lie'; }
      if (act === 'poles' && actT < 0.8) { y = Math.round(Math.sin(actT * 30) * 2); }
      if (act === 'bump' && actT < 0.6) { opts = { eyes: 'sad' }; pose = 'sit'; }
      const spr = dogSprite(dog.breed, dog.stage, pose, { ...opts, equip: dog.equip });
      ctx.drawImage(spr.canvas, DX - DOG_W / 2, G - 41 + Math.round(y));
      raf = requestAnimationFrame(frame);
    };
    const finish = () => {
      if (sh.done) return;
      sh.done = true; cancelAnimationFrame(raf);
      sh.say('코스 완주! 수고했어요!'); sfx.bell();
      setTimeout(() => { sh.close(); resolve({ correct: sh.correct }); }, 1200);
    };
    sh.onQuit = () => { sh.done = true; cancelAnimationFrame(raf); sh.close(); resolve({ correct: sh.correct, quit: true }); };
    sh.say('장애물이 와요! 준비~');
    setTimeout(() => { if (!sh.done) spawn(); }, 1000);
    raf = requestAnimationFrame(frame);
  });
}

// ---------- 👃 노즈워크: 컵 섞기 ----------
export function playNose(dog, info) {
  return new Promise((resolve) => {
    const sh = trainShell('nose', info, { hint: '간식이 들어간 컵을 잘 보고 따라가요. 섞이고 나면 컵을 눌러요!' });
    const n = info.exam === 'master' || info.level >= 5 ? 5 : info.level >= 3 || info.exam ? 4 : 3;
    const swaps = 3 + info.level + (info.exam ? 2 : 0);
    const swapMs = Math.max(260, 620 - info.level * 55 - (info.exam ? 60 : 0));
    const table = el('div', { class: 'nose-table' });
    const sniff = el('img', { class: 'pixel nose-dog', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy', mouth: 'tongue' }), alt: '' });
    sh.stage.append(table, sniff);
    const slots = Array.from({ length: n }, (_, i) => i); // slot → cup
    const cups = slots.map((i) => {
      const c = el('button', { class: 'nose-cup', type: 'button', disabled: true }, el('span', { class: 'cup' }), el('span', { class: 'treat' }, '🦴'));
      c.style.left = `${((i + 0.5) / n) * 100}%`;
      c.addEventListener('click', () => pick(i));
      table.append(c);
      return c;
    });
    let treat = 0; let round = 0; let waiting = null;
    const place = () => slots.forEach((cup, slot) => { cups[cup].style.left = `${((slot + 0.5) / n) * 100}%`; });
    const setAll = (dis) => cups.forEach((c) => { c.disabled = dis; });
    const pick = (cup) => {
      if (!waiting) return;
      const ok = cup === treat;
      setAll(true);
      cups[cup].classList.add('lift');
      if (!ok) cups[treat].classList.add('lift', 'show');
      if (ok) sh.hit('킁킁! 찾았다!'); else sh.miss('여기 있었어요~');
      const w = waiting; waiting = null;
      setTimeout(w, 1300);
    };
    const play = async () => {
      table.style.setProperty('--swap', `${swapMs}ms`);
      while (round < sh.rounds && !sh.done) {
        round += 1;
        cups.forEach((c) => c.classList.remove('lift', 'show', 'has'));
        treat = Math.floor(Math.random() * n);
        cups[treat].classList.add('has');
        sh.say(`${round}번째! 간식이 어디 있게요?`);
        await wait(500);
        cups[treat].classList.add('lift', 'show');
        await wait(1100);
        cups[treat].classList.remove('lift');
        await wait(450);
        cups[treat].classList.remove('show');
        sh.say('섞는다~ 잘 봐요!');
        for (let s = 0; s < swaps && !sh.done; s++) {
          const a = Math.floor(Math.random() * n); let b = Math.floor(Math.random() * (n - 1)); if (b >= a) b += 1;
          [slots[a], slots[b]] = [slots[b], slots[a]];
          place(); sfx.tap();
          await wait(swapMs + 60);
        }
        if (sh.done) return;
        sh.say('어느 컵일까? 킁킁…');
        setAll(false);
        await new Promise((r) => { waiting = r; });
      }
      if (sh.done) return;
      sh.done = true; sh.say('코가 정말 좋아요!'); sfx.bell();
      setTimeout(() => { sh.close(); resolve({ correct: sh.correct }); }, 1200);
    };
    sh.onQuit = () => { sh.done = true; waiting = null; sh.close(); resolve({ correct: sh.correct, quit: true }); };
    play();
  });
}

// ---------- 💃 워킹 & 포즈: 박자 맞추기 ----------
export function playWalk(dog, info) {
  return new Promise((resolve) => {
    const sh = trainShell('walk', info, { hint: '발자국이 동그라미에 닿을 때 "톡!"을 눌러요. 박자에 맞춰요!' });
    const bpm = 92 + info.level * 8 + (info.exam ? 10 : 0);
    const beat = 60000 / bpm;
    const track = el('div', { class: 'walk-track' }, el('div', { class: 'walk-hit' }));
    const runway = el('div', { class: 'walk-runway' });
    const dogImg = el('img', { class: 'pixel walk-dog', alt: '' });
    const judgeEl = el('div', { class: 'walk-judge' });
    runway.append(dogImg, judgeEl);
    sh.stage.append(runway, track);
    const tapBtn = el('button', { class: 'btn primary walk-tap', type: 'button' }, '톡!');
    sh.controls.replaceChildren(tapBtn);
    const poses = [['walk1', {}], ['walk2', {}], ['front', { eyes: 'happy', mouth: 'open' }], ['beg', { eyes: 'happy' }]];
    const setPose = (i) => { const [p, o] = poses[i]; dogImg.src = dogPortrait(dog.breed, dog.stage, { equip: dog.equip, mouth: 'tongue', ...o }, p); };
    setPose(0);
    const travel = 2200; // 오른쪽 끝에서 동그라미까지
    const start = performance.now() + 1400;
    // 박자: 가끔 반 박자 (높은 레벨)
    const notes = [];
    let tt = start + travel;
    for (let i = 0; i < sh.rounds; i++) {
      notes.push({ at: tt, judged: false, node: el('span', { class: 'walk-note' }, '🐾') });
      tt += beat * (info.level >= 3 && Math.random() < 0.25 ? 0.5 : 1) * (i % 4 === 3 ? 2 : 1);
    }
    notes.forEach((n) => track.append(n.node));
    let raf = 0; let lastBeat = -1; let step = 0;
    const judge = (text, cls) => { judgeEl.textContent = text; judgeEl.className = `walk-judge ${cls}`; void judgeEl.offsetWidth; judgeEl.classList.add('show'); };
    const tap = () => {
      if (sh.done) return;
      const now = performance.now();
      const n = notes.find((x) => !x.judged && Math.abs(x.at - now) < 320);
      if (!n) return;
      const d = Math.abs(n.at - now);
      n.judged = true; n.node.classList.add('gone');
      if (d <= 220) {
        sh.hit(d <= 110 ? '퍼펙트 워킹!' : '좋아요!');
        judge(d <= 110 ? '퍼펙트!' : '굿!', d <= 110 ? 'perfect' : 'good');
        step = (step + 1) % 2; setPose(step);
      } else { sh.miss('박자를 들어 봐요~'); judge('미스', 'miss'); }
    };
    tapBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    track.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
    const frame = (now) => {
      if (sh.done) return;
      const b = Math.floor((now - start) / beat);
      if (b !== lastBeat && now >= start) { lastBeat = b; sfx.click(); }
      for (const n of notes) {
        const p = (n.at - now) / travel; // 1 → 0 (동그라미)
        n.node.style.left = `${12 + p * 84}%`;
        n.node.style.opacity = p > 1.05 ? '0' : '1';
        if (!n.judged && now - n.at > 220) { n.judged = true; n.node.classList.add('gone'); sh.miss('앗, 놓쳤어요!'); judge('미스', 'miss'); }
      }
      if (notes.every((n) => n.judged)) return finish();
      raf = requestAnimationFrame(frame);
    };
    const finish = () => {
      sh.done = true; cancelAnimationFrame(raf);
      setPose(3); sh.say('마지막은… 포즈! ✨'); sfx.star();
      setTimeout(() => { sh.close(); resolve({ correct: sh.correct }); }, 1500);
    };
    sh.onQuit = () => { sh.done = true; cancelAnimationFrame(raf); sh.close(); resolve({ correct: sh.correct, quit: true }); };
    sh.say('음악 시작! 박자에 맞춰 걸어요~');
    raf = requestAnimationFrame(frame);
  });
}

// ---------- 💗 교감 수업: 좋아하는 곳 찾기 + 기다려… 먹어! ----------
export function playBond(dog, info) {
  return new Promise((resolve) => {
    const sh = trainShell('bond', info, { hint: '하트가 진할수록 가까워요. "먹어!"라고 하기 전에는 꾹 참아요!' });
    const grid = el('div', { class: 'bond-grid' });
    const img = el('img', { class: 'pixel bond-dog', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'open' }), alt: '' });
    const nose = el('div', { class: 'bond-treat', hidden: true }, '🦴');
    const box = el('div', { class: 'bond-box' }, img, grid, nose);
    sh.stage.append(box);
    const cells = Array.from({ length: 9 }, (_, i) => {
      const c = el('button', { class: 'bond-cell', type: 'button', disabled: true });
      c.addEventListener('click', () => touch(i));
      grid.append(c);
      return c;
    });
    const eatBtn = el('button', { class: 'btn primary bond-eat', type: 'button', disabled: true }, '먹어!');
    sh.controls.replaceChildren(eatBtn);
    const tries = info.level >= 4 || info.exam ? 3 : 4;
    const winMs = Math.max(700, 1300 - info.level * 100 - (info.exam ? 150 : 0));
    let spot = 0; let left = 0; let finishRound = null; let waitState = null;
    const face = (o) => { img.src = dogPortrait(dog.breed, dog.stage, { equip: dog.equip, ...o }); };
    const touch = (i) => {
      if (!finishRound) return;
      const dist = Math.max(Math.abs((i % 3) - (spot % 3)), Math.abs(Math.floor(i / 3) - Math.floor(spot / 3)));
      if (dist === 0) {
        cells[i].textContent = '💖'; face({ eyes: 'happy', mouth: 'tongue' }); sh.hit('헤헤~ 거기 좋아요!');
        cells.forEach((c) => { c.disabled = true; });
        const f = finishRound; finishRound = null; setTimeout(f, 1100); return;
      }
      cells[i].textContent = dist === 1 ? '💗' : '🤍'; cells[i].disabled = true; sfx.pet();
      sh.say(dist === 1 ? '거의 다 왔어요!' : '음… 여기는 그냥 그래요');
      left -= 1;
      if (left <= 0) {
        cells[spot].textContent = '💖'; sh.miss('여기를 제일 좋아했어요!');
        cells.forEach((c) => { c.disabled = true; });
        const f = finishRound; finishRound = null; setTimeout(f, 1300);
      }
    };
    eatBtn.addEventListener('click', () => {
      if (!waitState) return;
      const w = waitState; waitState = null; eatBtn.disabled = true;
      nose.hidden = true;
      if (w.go && performance.now() - w.go <= winMs) { face({ eyes: 'happy', mouth: 'open' }); sfx.eat(); sh.hit('냠! 잘 참았어요!'); } else if (!w.go) { face({ eyes: 'sad' }); sh.miss('앗, 기다려야 했어요!'); } else { sh.miss('조금 늦었어요~'); }
      clearTimeout(w.timer); clearTimeout(w.late);
      setTimeout(w.done, 1100);
    });
    const findRound = () => new Promise((r) => {
      spot = Math.floor(Math.random() * 9); left = tries;
      cells.forEach((c) => { c.textContent = ''; c.disabled = false; });
      face({ eyes: 'open' });
      sh.say(`${dog.name}(이)가 좋아하는 곳을 찾아 쓰다듬어요! (${tries}번 안에)`);
      finishRound = r;
    });
    const waitRound = () => new Promise((r) => {
      cells.forEach((c) => { c.textContent = ''; c.disabled = true; });
      face({ eyes: 'open' }); nose.hidden = false; eatBtn.disabled = false;
      sh.say('기다려…'); sfx.notify();
      const w = { go: 0, done: r };
      w.timer = setTimeout(() => { if (waitState !== w) return; w.go = performance.now(); sh.say('먹어!'); sfx.bell(); w.late = setTimeout(() => { if (waitState !== w) return; waitState = null; eatBtn.disabled = true; nose.hidden = true; sh.miss('조금 늦었어요~'); setTimeout(r, 1000); }, winMs + 150); }, rand(1400, 3400));
      waitState = w;
    });
    const play = async () => {
      await wait(700);
      for (let i = 0; i < sh.rounds && !sh.done; i++) {
        await (i % 2 === 0 ? findRound() : waitRound());
      }
      if (sh.done) return;
      sh.done = true; sh.say('마음이 통했어요! 💗'); sfx.bell();
      setTimeout(() => { sh.close(); resolve({ correct: sh.correct }); }, 1200);
    };
    sh.onQuit = () => { sh.done = true; finishRound = null; if (waitState) { clearTimeout(waitState.timer); clearTimeout(waitState.late); } waitState = null; sh.close(); resolve({ correct: sh.correct, quit: true }); };
    play();
  });
}
