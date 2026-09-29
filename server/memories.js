// 🎂 강아지 생일 · 📅 멍뭉달력 (처음 한 날들 + 내 메모)
import { BIRTHDAY, FIRSTS, TREATS } from '../shared/data.js';
import { kstDate, kstMMDD, validMMDD, zodiacOf, birthFlower, daysUntilBirthday } from '../shared/rules.js';
import { GameError } from './game.js';
import { tx } from './db.js';
import { checkText } from './filter.js';

const DAY = 86_400_000;
const NOTE_MAX = 60;
const NOTES_PER_DAY = 3;

export class Memories {
  constructor(db, { game, friends, progress, asks, notify = () => {} }) {
    Object.assign(this, { db, game, friends, progress, asks, notify });
    db.exec(`CREATE TABLE IF NOT EXISTS diary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dog_id INTEGER,
      day TEXT NOT NULL,
      kind TEXT NOT NULL,
      key TEXT NOT NULL,
      emoji TEXT NOT NULL,
      title TEXT NOT NULL,
      comment TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, dog_id, kind, key)
    );
    CREATE INDEX IF NOT EXISTS diary_user_day ON diary(user_id, day);
    CREATE TABLE IF NOT EXISTS bday_cheers (
      from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dog_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (from_id, dog_id, year)
    );`);
  }

  now() { return this.game.now(); }
  year() { return Number(kstDate(this.now()).slice(0, 4)); }

  // ---------- 🎂 생일 ----------
  info(mmdd, now = this.now()) {
    if (!validMMDD(mmdd)) return null;
    return { date: mmdd, zodiac: zodiacOf(mmdd), flower: birthFlower(mmdd), daysLeft: daysUntilBirthday(mmdd, now) };
  }

  bdayRow(dogId) {
    return this.db.prepare('SELECT id, user_id, name, born_at, birthday, bday_year, bday_count, bday_changed FROM dogs WHERE id = ?').get(dogId);
  }

  // mmdd: 'MM-DD' 또는 'adopt'(데려온 날)
  setBirthday(userId, dogId, mmdd) {
    const row = this.bdayRow(Number(dogId));
    if (!row || row.user_id !== userId) throw new GameError('우리 집 강아지가 아니에요.');
    const date = mmdd === 'adopt' ? kstMMDD(row.born_at) : String(mmdd ?? '');
    if (!validMMDD(date)) throw new GameError('날짜를 다시 골라 주세요.');
    if (row.birthday && row.bday_changed && this.now() - row.bday_changed < BIRTHDAY.changeDays * DAY) {
      const left = Math.ceil((row.bday_changed + BIRTHDAY.changeDays * DAY - this.now()) / DAY);
      throw new GameError(`생일은 ${left}일 뒤에 다시 바꿀 수 있어요.`);
    }
    this.db.prepare('UPDATE dogs SET birthday = ?, bday_changed = ? WHERE id = ?').run(date, this.now(), row.id);
    this.record(userId, row.id, 'bdaySet', 'set', '🎂', `${row.name}의 생일을 ${Number(date.slice(0, 2))}월 ${Number(date.slice(3))}일로 정한 날`);
    return { birthday: this.info(date), events: this.checkBirthdays(userId) };
  }

  // 오늘이 생일인 우리 집 강아지가 있으면 축하해요 (한 해에 한 번)
  checkBirthdays(userId) {
    const today = kstMMDD(this.now());
    const leapFix = today === '02-28' && daysUntilBirthday('02-29', this.now()) !== 0 ? '02-29' : null;
    const rows = this.db.prepare('SELECT id, name, birthday, born_at, bday_year, bday_count FROM dogs WHERE user_id = ? AND (birthday = ? OR birthday = ?)')
      .all(userId, today, leapFix ?? today);
    const year = this.year();
    const events = [];
    for (const d of rows) {
      if (d.bday_year >= year) continue;
      if (this.now() - d.born_at < 2 * DAY) continue; // 오늘 막 만났으면 첫 생일은 내년에!
      events.push(this.celebrate(userId, d, year));
    }
    return events;
  }

  celebrate(userId, d, year) {
    return tx(this.db, () => {
      const count = (d.bday_count ?? 0) + 1;
      this.db.prepare('UPDATE dogs SET bday_year = ?, bday_count = ? WHERE id = ?').run(year, count, d.id);
      this.game.addCoins(userId, BIRTHDAY.coins);
      this.asks?.addHearts(userId, BIRTHDAY.hearts);
      const user = this.game.getUser(userId);
      let item = null;
      if (!user.owned.includes(BIRTHDAY.item)) {
        user.owned.push(BIRTHDAY.item);
        this.db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify(user.owned), userId);
        item = BIRTHDAY.item;
      }
      const treats = { ...user.treats, [BIRTHDAY.treat]: (user.treats?.[BIRTHDAY.treat] ?? 0) + 1 };
      this.db.prepare('UPDATE users SET treats = ? WHERE id = ?').run(JSON.stringify(treats), userId);
      this.record(userId, d.id, 'birthday', String(year), '🎂', `${d.name}의 ${count}번째 생일`);
      // 친구들에게 알려요: 소식 + 우편 + (접속 중이면) 바로 알림
      const fids = this.friends.friendIds(userId);
      const text = `오늘은 ${user.nickname}네 ${d.name}의 생일이에요! 🎂 축하해 주러 가요!`;
      this.db.prepare('INSERT INTO news (user_id, text, created_at) VALUES (?, ?, ?)').run(userId, text, this.now());
      for (const fid of fids) {
        this.progress?.sendMail(fid, 'bdayNotice', { from: d.name, owner: user.nickname, ownerId: userId, title: `${d.name}의 생일 초대장`, body: `오늘은 ${user.nickname}네 ${d.name}의 생일이에요! 친구 탭에서 "축하하기"를 눌러 주면 ${d.name}(이)가 정말 기뻐할 거예요. 🎈` });
        this.notify(fid, 'friend:birthday', { owner: user.nickname, dogName: d.name });
      }
      return {
        type: 'birthday', dogId: d.id, dogName: d.name, count, date: d.birthday, zodiac: zodiacOf(d.birthday), flower: birthFlower(d.birthday),
        coins: BIRTHDAY.coins, hearts: BIRTHDAY.hearts, item, treat: BIRTHDAY.treat, treatName: TREATS[BIRTHDAY.treat]?.name, friends: fids.length,
      };
    });
  }

  // 친구 생일 축하하기 (그 강아지 생일 당일, 한 번만)
  cheer(fromId, toId) {
    toId = Number(toId);
    if (!this.friends.friendIds(fromId).includes(toId)) throw new GameError('친구에게만 축하할 수 있어요.');
    const today = kstMMDD(this.now());
    const dogs = this.db.prepare('SELECT id, name, birthday, born_at FROM dogs WHERE user_id = ? AND birthday IS NOT NULL').all(toId)
      .filter((d) => (d.birthday === today || daysUntilBirthday(d.birthday, this.now()) === 0) && this.now() - d.born_at >= 2 * DAY);
    if (!dogs.length) throw new GameError('오늘은 생일이 아니에요.');
    const year = this.year();
    const from = this.game.getUser(fromId);
    const fromDog = this.game.loadDog(fromId);
    const cheered = [];
    for (const d of dogs) {
      const ok = this.db.prepare('INSERT OR IGNORE INTO bday_cheers (from_id, to_id, dog_id, year, created_at) VALUES (?, ?, ?, ?, ?)').run(fromId, toId, d.id, year, this.now()).changes;
      if (!ok) continue;
      cheered.push(d.name);
      const got = this.db.prepare('SELECT COUNT(*) AS n FROM bday_cheers WHERE dog_id = ? AND year = ?').get(d.id, year).n;
      const hearts = got <= BIRTHDAY.maxCheerHearts ? BIRTHDAY.cheerHearts : 0;
      this.progress?.sendMail(toId, 'bdayCheer', {
        from: fromDog?.name ?? from.nickname, owner: from.nickname, breed: fromDog?.breed, stage: fromDog?.stage, equip: fromDog?.equip,
        title: `${from.nickname}네 ${fromDog?.name ?? ''}의 생일 축하 카드`, body: `${d.name}아, 생일 축하해! 🎂 오늘 하루 제일 행복한 멍뭉이가 되길! 💕`, hearts,
      });
      this.notify(toId, 'birthday:cheer', { from: from.nickname, dogName: d.name });
    }
    if (!cheered.length) throw new GameError('벌써 축하해 줬어요! 🎉');
    this.game.addCoins(fromId, BIRTHDAY.cheerCoins);
    this.record(fromId, fromDog?.id ?? null, 'cheer', `${toId}:${year}`, '🎉', `${this.game.getUser(toId).nickname}네 ${cheered.join('·')} 생일을 축하해 준 날`);
    return { names: cheered, coins: BIRTHDAY.cheerCoins };
  }

  cheeredToday(fromId) {
    return this.db.prepare('SELECT to_id FROM bday_cheers WHERE from_id = ? AND year = ? AND created_at >= ?')
      .all(fromId, this.year(), this.now() - DAY).map((r) => r.to_id);
  }

  // ---------- 📅 멍뭉달력 ----------
  record(userId, dogId, kind, key, emoji, title, at = this.now()) {
    this.db.prepare('INSERT OR IGNORE INTO diary (user_id, dog_id, day, kind, key, emoji, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(userId, dogId ?? 0, kstDate(at), kind, String(key), emoji, title, at);
  }

  // game.track에서 불러요: 처음 해 본 일은 달력에 적어요 (지금 대표 강아지 이름으로)
  onTrack(userId, kind) {
    const f = FIRSTS[kind];
    if (!f) return;
    const dog = this.game.loadDog(userId);
    if (!dog) return;
    this.record(userId, dog.id, 'first', kind, f[0], `${dog.name}(이)가 ${f[1]}`);
  }

  // me()에서 불러요: 자라기 · 레벨 · 자격증 같은 특별한 일
  noteEvents(userId, events) {
    if (!events?.length) return;
    const dog = this.game.loadDog(userId);
    if (!dog) return;
    for (const e of events) {
      if (e.type === 'grew') this.record(userId, dog.id, 'stage', String(e.stage ?? dog.stage), e.stage === 1 || dog.stage === 1 ? '🌱' : '🐕', `${dog.name}(이)가 ${(e.stage ?? dog.stage) === 1 ? '꼬마가 된 날' : '다 자란 날'}`);
      if (e.type === 'levelUp' && e.level % 10 === 0) this.record(userId, dog.id, 'level', String(e.level), '⭐', `${dog.name}(이)가 Lv ${e.level}이 된 날`);
      if (e.type === 'cert' && e.kind === 'master') this.record(userId, dog.id, 'cert', e.course ?? e.name, '🏅', `${dog.name}(이)가 ${e.name ?? ''} 마스터가 된 날`);
      if (e.type === 'special') this.record(userId, dog.id, 'special', e.key ?? 'special', '✨', `${dog.name}(이)가 전설의 친구가 된 날`);
      if (e.type === 'placeOpen') this.record(userId, null, 'place', e.id ?? e.name, e.emoji ?? '🗺️', `마을에 ${e.name}이(가) 생긴 날`);
      if (e.type === 'setDone') this.record(userId, null, 'set', e.id ?? e.name, '🛋️', `"${e.name}" 가구 세트를 완성한 날`);
      if (e.type === 'runMap') this.record(userId, dog.id, 'runMap', e.map ?? e.name, '🗺️', `멍뭉런 "${e.name}" 맵을 연 날`);
    }
  }

  // 원래 있던 기록(처음 만난 날, 친구가 된 날)을 한 번 채워 넣어요
  backfill(userId) {
    for (const d of this.db.prepare('SELECT id, name, born_at FROM dogs WHERE user_id = ?').all(userId)) {
      this.record(userId, d.id, 'adopt', 'adopt', '🐶', `${d.name}(와)과 처음 만난 날`, d.born_at);
    }
    for (const f of this.db.prepare('SELECT f.friend_id, f.created_at, u.nickname FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?').all(userId)) {
      this.record(userId, null, 'friend', String(f.friend_id), '🤝', `${f.nickname}(와)과 친구가 된 날`, f.created_at);
    }
  }

  // month: 'YYYY-MM'
  month(userId, month) {
    const ym = /^\d{4}-\d{2}$/.test(String(month)) ? month : kstDate(this.now()).slice(0, 7);
    this.backfill(userId);
    const rows = this.db.prepare("SELECT d.*, g.name AS dog_name FROM diary d LEFT JOIN dogs g ON g.id = d.dog_id WHERE d.user_id = ? AND d.day LIKE ? ORDER BY d.day, d.created_at")
      .all(userId, `${ym}-%`);
    const entries = rows.map((r) => ({ id: r.id, day: r.day, kind: r.kind, emoji: r.emoji, title: r.title, comment: r.comment ?? '', note: r.kind === 'note', dogName: r.dog_name }));
    // 이 달의 생일 (우리 집 강아지 + 친구들 강아지)
    const mm = ym.slice(5);
    const bdays = [];
    for (const d of this.db.prepare('SELECT name, birthday FROM dogs WHERE user_id = ? AND birthday LIKE ?').all(userId, `${mm}-%`)) {
      bdays.push({ day: `${ym}-${d.birthday.slice(3)}`, name: d.name, mine: true, zodiac: zodiacOf(d.birthday) });
    }
    const fids = this.friends.friendIds(userId);
    if (fids.length) {
      const q = this.db.prepare(`SELECT g.name, g.birthday, u.nickname FROM dogs g JOIN users u ON u.id = g.user_id WHERE g.user_id IN (${fids.map(() => '?').join(',')}) AND g.birthday LIKE ?`);
      for (const d of q.all(...fids, `${mm}-%`)) bdays.push({ day: `${ym}-${d.birthday.slice(3)}`, name: d.name, owner: d.nickname, mine: false });
    }
    return { month: ym, today: kstDate(this.now()), entries, birthdays: bdays };
  }

  comment(userId, id, text) {
    const row = this.db.prepare('SELECT id FROM diary WHERE id = ? AND user_id = ?').get(Number(id), userId);
    if (!row) throw new GameError('그런 기록은 없어요.');
    const t = String(text ?? '').trim();
    if (t) {
      const c = checkText(t, { maxLen: NOTE_MAX });
      if (!c.ok) throw new GameError(c.reason);
    }
    this.db.prepare('UPDATE diary SET comment = ? WHERE id = ?').run(t ? t.slice(0, NOTE_MAX) : null, row.id);
    return { ok: true };
  }

  // 내가 직접 쓰는 메모 (하루 3개까지)
  addNote(userId, day, emoji, text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day)) || String(day) > kstDate(this.now())) throw new GameError('오늘까지의 날짜만 적을 수 있어요.');
    const t = String(text ?? '').trim();
    if (!t) throw new GameError('한마디를 적어 주세요.');
    const c = checkText(t, { maxLen: NOTE_MAX });
    if (!c.ok) throw new GameError(c.reason);
    const n = this.db.prepare("SELECT COUNT(*) AS n FROM diary WHERE user_id = ? AND day = ? AND kind = 'note'").get(userId, day).n;
    if (n >= NOTES_PER_DAY) throw new GameError(`하루에 ${NOTES_PER_DAY}개까지 적을 수 있어요.`);
    const e = [...String(emoji ?? '📝')].slice(0, 2).join('') || '📝';
    this.db.prepare('INSERT INTO diary (user_id, dog_id, day, kind, key, emoji, title, created_at) VALUES (?, 0, ?, ?, ?, ?, ?, ?)')
      .run(userId, day, 'note', `${this.now()}:${Math.random().toString(36).slice(2, 6)}`, e, t.slice(0, NOTE_MAX), this.now());
    return { ok: true };
  }

  deleteNote(userId, id) {
    const r = this.db.prepare("DELETE FROM diary WHERE id = ? AND user_id = ? AND kind = 'note'").run(Number(id), userId);
    if (!r.changes) throw new GameError('지울 수 있는 메모가 없어요.');
    return { ok: true };
  }
}

