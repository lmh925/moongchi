// 학교 탭의 훈련 수업: 과목 고르기 · 훈련 수첩(모으기) · 결과/자격증 화면
import { TRAIN_COURSES, TRAIN_LEVEL, CERTS, TALENTS, TITLES, ITEMS, TRICKS } from '../shared/data.js';
import { trainLevel, recommendedCourse, examFor } from '../shared/rules.js';
import { dogPortrait, accessoryURL } from './sprites.js';
import { el, modal } from './ui.js';

const kstToday = (now) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

function levelBar(xp) {
  const lv = trainLevel(xp);
  return el('div', { class: 'course-lv' },
    el('b', {}, `과목 Lv ${lv.level}`),
    el('span', { class: 'bar' }, el('i', { style: { width: lv.max ? '100%' : `${Math.round((lv.into / lv.need) * 100)}%` } })),
    el('small', {}, lv.max ? 'MAX' : `${lv.into}/${lv.need}`));
}

const certIcons = (cert) => el('span', { class: 'cert-icons' },
  el('span', { class: cert ? 'on' : '', title: CERTS.basic.name }, CERTS.basic.emoji),
  el('span', { class: cert === 'master' ? 'on' : '', title: CERTS.master.name }, CERTS.master.emoji));

// 학교 탭 카드 목록
export function trainingSection(dog, { now, left, onStart, onBook }) {
  const train = dog.train ?? { xp: {}, certs: {}, perfect: {} };
  const rec = recommendedCourse(kstToday(now));
  const learnable = Object.entries(TRICKS).filter(([id, t]) => t.stage <= dog.stage && !(dog.tricks ?? []).includes(id));
  return el('div', { class: 'train-box' },
    el('div', { class: 'train-head' },
      el('span', { class: 'sub' }, `${dog.name}(이)랑 바로 수업해요. 과목마다 자라는 재능이 달라요!`),
      el('button', { class: 'btn small', onclick: onBook }, '📒 훈련 수첩')),
    el('div', { class: 'course-grid' }, Object.entries(TRAIN_COURSES)
      // 추천 과목과 시험 볼 수 있는 과목이 먼저 보여요
      .sort(([a], [b]) => ((b === rec) * 2 + !!examFor(train, b)) - ((a === rec) * 2 + !!examFor(train, a)))
      .map(([id, C]) => {
      const T = TALENTS[C.talent];
      const exam = examFor(train, id);
      const off = left <= 0 || !!dog.school;
      return el('div', { class: `course-card ${id === rec ? 'rec' : ''}` },
        id === rec ? el('span', { class: 'rec-ribbon' }, `⭐ 오늘의 추천 ×${TRAIN_LEVEL.recommendBoost}`) : null,
        el('div', { class: 'course-top' },
          el('img', { class: 'pixel', src: dogPortrait(C.teacher.breed, 2, { equip: C.teacher.equip, eyes: 'happy' }), alt: '' }),
          el('div', {},
            el('b', {}, `${C.emoji} ${C.name}`),
            el('div', { class: 'meta' }, el('span', { class: 'talent-dot', style: { background: T.color } }), `${T.name} 재능 · ${C.teacher.name}`)),
          certIcons(train.certs?.[id])),
        el('div', { class: 'meta course-desc' }, C.desc),
        id === 'command' && learnable[0] ? el('div', { class: 'meta' }, '배우는 중: ', el('b', {}, learnable[0][1].name)) : null,
        levelBar(train.xp?.[id] ?? 0),
        el('div', { class: 'course-btns' },
          el('button', { class: 'btn small green', disabled: off, onclick: () => onStart(id, false) }, '수업 시작'),
          exam ? el('button', { class: 'btn small primary exam-btn', disabled: off, onclick: () => onStart(id, true) }, `${CERTS[exam].emoji} ${CERTS[exam].name} 시험!`) : null));
    })),
    left <= 0 ? el('p', { class: 'hint' }, '오늘 훈련은 다 했어요! 내일 또 만나요.') : null);
}

// 📒 훈련 수첩: 모은 자격증·만점 도장·마스터 선물
export function openTrainingBook(dog, owned = []) {
  const train = dog.train ?? { xp: {}, certs: {}, perfect: {} };
  const keys = Object.keys(TRAIN_COURSES);
  const certCount = keys.reduce((n, k) => n + (train.certs?.[k] === 'master' ? 2 : train.certs?.[k] ? 1 : 0), 0);
  const allMaster = keys.every((k) => train.certs?.[k] === 'master');
  const rewardTile = (item, title, got) => el('div', { class: `book-reward ${got ? 'got' : ''}` },
    el('img', { class: 'pixel', src: accessoryURL(item, 3), alt: '' }),
    el('small', {}, got ? ITEMS[item].name : '???'),
    title ? el('small', { class: 'title' }, got ? `칭호 "${TITLES[title].name}"` : '마스터 칭호') : null);
  modal({
    title: `📒 ${dog.name}의 훈련 수첩`,
    className: 'train-book',
    body: el('div', {},
      el('div', { class: 'book-summary' }, `자격증 ${certCount}/${keys.length * 2} 모음`, el('span', { class: 'bar' }, el('i', { style: { width: `${(certCount / (keys.length * 2)) * 100}%` } }))),
      keys.map((id) => {
        const C = TRAIN_COURSES[id];
        const cert = train.certs?.[id];
        return el('div', { class: 'book-row' },
          el('img', { class: 'pixel book-teacher', src: dogPortrait(C.teacher.breed, 2, { equip: C.teacher.equip, eyes: 'happy' }), alt: '' }),
          el('div', { class: 'book-mid' },
            el('b', {}, `${C.emoji} ${C.name}`),
            levelBar(train.xp?.[id] ?? 0),
            el('div', { class: 'book-stamps' },
              el('span', { class: `bstamp ${cert ? 'on' : ''}` }, `${CERTS.basic.emoji} 초급`),
              el('span', { class: `bstamp ${cert === 'master' ? 'on' : ''}` }, `${CERTS.master.emoji} 마스터`),
              el('span', { class: 'bstamp on perfect' }, `💯 만점 ${train.perfect?.[id] ?? 0}번`))),
          rewardTile(C.master.item, C.master.title, cert === 'master' && owned.includes(C.master.item)));
      }),
      el('div', { class: 'book-row final' },
        el('div', { class: 'book-mid' }, el('b', {}, '🌈 다섯 과목 모두 마스터하면…'), el('small', {}, '세상에 하나뿐인 전설의 메달!')),
        rewardTile(TRAIN_LEVEL.allMasterItem, null, allMaster && owned.includes(TRAIN_LEVEL.allMasterItem)))),
    buttons: [{ label: '닫기' }],
  });
}

// 수업 결과 화면
export function trainResultBody(r, dog) {
  const C = TRAIN_COURSES[r.course];
  const T = TALENTS[r.talent];
  return el('div', { class: 'center train-result' },
    r.exam ? el('div', { class: `exam-stamp ${r.exam.passed ? 'pass' : 'fail'}` }, r.exam.passed ? '합격!' : '아쉬워요') : null,
    el('img', { class: 'pixel', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy', mouth: 'tongue' }), alt: '' }),
    el('p', { class: 'big' }, `성공 ${r.ok} / ${r.rounds}`, r.perfect ? el('span', { class: 'perfect' }, ' 💯 만점!') : null),
    r.exam && !r.exam.passed ? el('p', { class: 'help' }, `${r.exam.need}번 이상이면 합격이에요. 연습하고 다시 도전해요!`) : null,
    el('div', { class: 'reward-chips' },
      el('span', { class: 'chip' }, `🦴 코인 +${r.coins}`),
      el('span', { class: 'chip' }, `⭐ 경험치 +${r.exp}`),
      r.talentGain ? el('span', { class: 'chip', style: { background: T.color, color: '#fff' } }, `${T.name} +${r.talentGain}`) : null),
    r.boosted ? el('p', { class: 'hint' }, `오늘의 추천 과목이라 ×${TRAIN_LEVEL.recommendBoost}!`) : null,
    r.quit ? el('p', { class: 'hint' }, '중간에 그만뒀지만 한 만큼 선물을 받았어요.') : null,
    el('p', { class: 'hint' }, `${C.name} 과목 Lv ${r.level}`));
}

// 자격증 축하 (상장 모양)
export function certBody(ev, dog, nickname) {
  const C = TRAIN_COURSES[ev.course];
  return el('div', { class: 'center' },
    el('div', { class: `certificate ${ev.kind}` },
      el('div', { class: 'cert-emoji' }, CERTS[ev.kind].emoji),
      el('h3', {}, `${C.name} ${CERTS[ev.kind].name}`),
      el('img', { class: 'pixel', src: dogPortrait(dog.breed, dog.stage, { equip: dog.equip, eyes: 'happy', mouth: 'tongue' }), alt: '' }),
      el('p', {}, `${dog.name}(은)는 ${C.teacher.name}의 시험을 멋지게 통과했어요.`),
      el('small', {}, `트레이너 ${nickname} · 멍뭉 학교`)),
    ev.item ? el('div', { class: 'gift-item' }, el('img', { class: 'pixel', src: accessoryURL(ev.item, 5), alt: '' }), el('b', {}, `선물: ${ITEMS[ev.item].name}`)) : null,
    ev.title ? el('p', {}, `새 칭호 "${ev.title}"를 달 수 있어요!`) : null,
    ev.allItem ? el('div', { class: 'gift-item rainbow' }, el('img', { class: 'pixel', src: accessoryURL(ev.allItem, 5), alt: '' }), el('b', {}, `🌈 다섯 과목 모두 마스터! ${ITEMS[ev.allItem].name}`)) : null);
}

