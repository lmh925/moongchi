// 📔 멍뭉 일기장: 하루 한 편, 나만 보기 / 친구 공개. 친구는 반응 스티커만 남길 수 있어요 (댓글 없음)
import { JOURNAL } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';
import { GameError } from './game.js';
import { checkText } from './filter.js';

const DAY = 86_400_000;

export class Journal {
  constructor(db, { game, friends, safety, asks, memories, notify = () => {} }) {
    Object.assign(this, { db, game, friends, safety, asks, memories, notify });
    db.exec(`CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day TEXT NOT NULL,
      weather TEXT NOT NULL,
      mood TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      public INTEGER NOT NULL DEFAULT 0,
      dog TEXT NOT NULL DEFAULT '{}',
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id, day)
    );
    CREATE INDEX IF NOT EXISTS journal_feed ON journal(public, created_at);
    CREATE TABLE IF NOT EXISTS journal_reacts (
      journal_id INTEGER NOT NULL REFERENCES journal(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (journal_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS journal_reports (
      journal_id INTEGER NOT NULL REFERENCES journal(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (journal_id, user_id)
    );`);
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    if (!cols.includes('journal_seen')) db.exec('ALTER TABLE users ADD COLUMN journal_seen INTEGER NOT NULL DEFAULT 0');
  }

  now() { return this.game.now(); }

  // 글 검사: 줄마다 고운 말·비밀 정보 검사
  clean(raw, max, lines = 1) {
    const rows = String(raw ?? '').replace(/\r/g, '').split('\n').map((l) => l.trim());
    while (rows.length && !rows[rows.length - 1]) rows.pop();
    const kept = rows.slice(0, lines);
    const text = kept.join('\n').trim();
    if (!text) throw new GameError('내용을 적어 주세요.');
    if (text.length > max) throw new GameError(`${max}글자까지만 쓸 수 있어요.`);
    for (const l of kept) {
      if (!l) continue;
      const c = checkText(l, { maxLen: max });
      if (!c.ok) throw new GameError(c.reason);
    }
    return kept.map((l) => l.replace(/\s+/g, ' ')).join('\n');
  }

  write(userId, { weather, mood, title, body, isPublic }) {
    const w = JOURNAL.weathers.includes(weather) ? weather : JOURNAL.weathers[0];
    const m = JOURNAL.moods.some(([e]) => e === mood) ? mood : JOURNAL.moods[0][0];
    const t = this.clean(title, JOURNAL.titleMax, 1);
    const b = this.clean(body, JOURNAL.bodyMax, JOURNAL.lines);
    const day = kstDate(this.now());
    const d = this.game.loadDog(userId);
    const dogSnap = d ? JSON.stringify({ name: d.name, breed: d.breed, stage: d.stage, equip: d.equip }) : '{}';
    const had = this.db.prepare('SELECT id FROM journal WHERE user_id = ? AND day = ?').get(userId, day);
    const events = [];
    let reward = null;
    if (had) {
      this.db.prepare('UPDATE journal SET weather = ?, mood = ?, title = ?, body = ?, public = ?, dog = ?, updated_at = ? WHERE id = ?')
        .run(w, m, t, b, isPublic ? 1 : 0, dogSnap, this.now(), had.id);
    } else {
      this.db.prepare('INSERT INTO journal (user_id, day, weather, mood, title, body, public, dog, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(userId, day, w, m, t, b, isPublic ? 1 : 0, dogSnap, this.now(), this.now());
      this.game.addCoins(userId, JOURNAL.coins);
      this.asks?.addHearts(userId, JOURNAL.hearts);
      reward = { coins: JOURNAL.coins, hearts: JOURNAL.hearts };
      this.memories?.record(userId, d?.id ?? 0, 'journal', day, '📔', '일기를 쓴 날');
      events.push(...this.game.track(userId, 'journal'));
      if (isPublic) for (const fid of this.friends.friendIds(userId)) this.notify(fid, 'journal:new', { owner: this.game.getUser(userId).nickname });
    }
    return { reward, streak: this.streak(userId), events };
  }

  // 며칠째 계속 쓰고 있는지 (오늘 또는 어제까지 이어지면)
  streak(userId) {
    const days = new Set(this.db.prepare('SELECT day FROM journal WHERE user_id = ? ORDER BY day DESC LIMIT 400').all(userId).map((r) => r.day));
    let t = this.now();
    if (!days.has(kstDate(t))) t -= DAY;
    let n = 0;
    while (days.has(kstDate(t))) { n += 1; t -= DAY; }
    return n;
  }

  view(row, userId, extra = {}) {
    const reacts = this.db.prepare('SELECT emoji, user_id FROM journal_reacts WHERE journal_id = ?').all(row.id);
    const counts = Object.fromEntries(JOURNAL.reactions.map((e) => [e, 0]));
    for (const r of reacts) if (counts[r.emoji] !== undefined) counts[r.emoji] += 1;
    return {
      id: row.id, day: row.day, weather: row.weather, mood: row.mood, title: row.title, body: row.body,
      public: !!row.public, dog: JSON.parse(row.dog || '{}'), hidden: !!row.hidden,
      reactions: counts, myReaction: reacts.find((r) => r.user_id === userId)?.emoji ?? null, ...extra,
    };
  }

  mine(userId) {
    const rows = this.db.prepare('SELECT * FROM journal WHERE user_id = ? ORDER BY day DESC LIMIT 60').all(userId);
    const today = kstDate(this.now());
    return { today, written: rows[0]?.day === today, streak: this.streak(userId), entries: rows.map((r) => this.view(r, userId)) };
  }

  // 친구들의 공개 일기 (최근 2주). 차단한 친구·숨겨진 일기는 빼요
  feed(userId) {
    const fids = this.friends.friendIds(userId).filter((id) => !this.safety?.isBlocked?.(userId, id));
    this.db.prepare('UPDATE users SET journal_seen = ? WHERE id = ?').run(this.now(), userId);
    if (!fids.length) return { entries: [] };
    const rows = this.db.prepare(`SELECT j.*, u.nickname FROM journal j JOIN users u ON u.id = j.user_id
      WHERE j.user_id IN (${fids.map(() => '?').join(',')}) AND j.public = 1 AND j.hidden = 0 AND j.created_at >= ?
      ORDER BY j.day DESC, j.updated_at DESC LIMIT 40`).all(...fids, this.now() - JOURNAL.feedDays * DAY);
    const reported = new Set(this.db.prepare('SELECT journal_id FROM journal_reports WHERE user_id = ?').all(userId).map((r) => r.journal_id));
    return { entries: rows.filter((r) => !reported.has(r.id)).map((r) => this.view(r, userId, { owner: r.nickname, ownerId: r.user_id })) };
  }

  unread(userId) {
    const fids = this.friends.friendIds(userId);
    if (!fids.length) return 0;
    const seen = this.db.prepare('SELECT journal_seen FROM users WHERE id = ?').get(userId)?.journal_seen ?? 0;
    return this.db.prepare(`SELECT COUNT(*) AS n FROM journal WHERE user_id IN (${fids.map(() => '?').join(',')}) AND public = 1 AND hidden = 0 AND updated_at > ?`)
      .get(...fids, Math.max(seen, this.now() - JOURNAL.feedDays * DAY)).n;
  }

  summary(userId) {
    const today = kstDate(this.now());
    return { written: !!this.db.prepare('SELECT 1 FROM journal WHERE user_id = ? AND day = ?').get(userId, today), unread: this.unread(userId) };
  }

  friendEntry(userId, id) {
    const row = this.db.prepare('SELECT * FROM journal WHERE id = ?').get(Number(id));
    if (!row || !row.public || row.hidden || row.user_id === userId || !this.friends.friendIds(userId).includes(row.user_id)) throw new GameError('볼 수 없는 일기예요.');
    return row;
  }

  // 반응 스티커 (한 사람이 하나, 바꿀 수 있어요. 같은 걸 다시 누르면 빼요)
  react(userId, id, emoji) {
    if (!JOURNAL.reactions.includes(emoji)) throw new GameError('그런 스티커는 없어요.');
    const row = this.friendEntry(userId, id);
    const cur = this.db.prepare('SELECT emoji FROM journal_reacts WHERE journal_id = ? AND user_id = ?').get(row.id, userId);
    if (cur?.emoji === emoji) {
      this.db.prepare('DELETE FROM journal_reacts WHERE journal_id = ? AND user_id = ?').run(row.id, userId);
    } else {
      this.db.prepare('INSERT INTO journal_reacts (journal_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(journal_id, user_id) DO UPDATE SET emoji = excluded.emoji')
        .run(row.id, userId, emoji, this.now());
      if (!cur) this.notify(row.user_id, 'journal:react', { from: this.game.getUser(userId).nickname, emoji, title: row.title });
    }
    return this.view(row, userId);
  }

  report(userId, id, reason) {
    const row = this.friendEntry(userId, id);
    this.db.prepare('INSERT OR IGNORE INTO journal_reports (journal_id, user_id, created_at) VALUES (?, ?, ?)').run(row.id, userId, this.now());
    this.safety?.report(userId, row.user_id, reason, 'diary');
    const n = this.db.prepare('SELECT COUNT(*) AS n FROM journal_reports WHERE journal_id = ?').get(row.id).n;
    if (n >= JOURNAL.hideAt) this.db.prepare('UPDATE journal SET hidden = 1 WHERE id = ?').run(row.id);
    return { ok: true };
  }

  remove(userId, id) {
    const r = this.db.prepare('DELETE FROM journal WHERE id = ? AND user_id = ?').run(Number(id), userId);
    if (!r.changes) throw new GameError('지울 수 있는 일기가 없어요.');
    return { ok: true };
  }
}
