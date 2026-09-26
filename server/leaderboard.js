// 이번 주 랭킹: 놀이마다 이번 주 최고 기록을 모아요. 매주 월요일(한국 시간)에 새로 시작해요.
import crypto from 'node:crypto';
import { LEADERBOARD } from '../shared/data.js';
import { kstDate, HOUR } from '../shared/rules.js';
import { GameError } from './game.js';

// 한국 시간 기준 그 주 월요일 날짜 (YYYY-MM-DD)
export function weekKey(now) {
  const k = new Date(now + 9 * HOUR);
  const day = (k.getUTCDay() + 6) % 7; // 월=0
  return kstDate(now - day * 24 * HOUR);
}

export class Leaderboard {
  constructor(db, { game, friends, safety, progress }) {
    this.db = db;
    this.game = game;
    this.friends = friends;
    this.safety = safety;
    this.progress = progress;
  }

  now() { return this.game.now(); }

  submit(userId, game, score) {
    if (!LEADERBOARD.games[game]) return null;
    score = Math.max(0, Math.floor(Number(score) || 0));
    if (!score) return null;
    const week = weekKey(this.now());
    const prev = this.db.prepare('SELECT best FROM scores WHERE user_id = ? AND game = ? AND week = ?').get(userId, game, week)?.best ?? 0;
    if (score > prev) {
      const d = this.game.loadDog(userId);
      const dog = d ? { name: d.name, breed: d.breed, stage: d.stage, equip: d.equip } : null;
      this.db.prepare(`INSERT INTO scores (user_id, game, week, best, dog, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, game, week) DO UPDATE SET best = excluded.best, dog = excluded.dog, updated_at = excluded.updated_at`)
        .run(userId, game, week, score, JSON.stringify(dog), this.now());
    }
    const best = Math.max(prev, score);
    return { best, newBest: score > prev, rank: this.rankOf(userId, game, week), game };
  }

  rankOf(userId, game, week) {
    const mine = this.db.prepare('SELECT best, updated_at FROM scores WHERE user_id = ? AND game = ? AND week = ?').get(userId, game, week);
    if (!mine) return null;
    // 같은 점수면 먼저 세운 기록이 앞이에요
    return 1 + this.db.prepare('SELECT COUNT(*) AS n FROM scores WHERE game = ? AND week = ? AND (best > ? OR (best = ? AND updated_at < ?))')
      .get(game, week, mine.best, mine.best, mine.updated_at).n;
  }

  row(r, rank, viewerId) {
    return { rank, userId: r.user_id, nickname: r.nickname, score: r.best, dog: r.dog ? JSON.parse(r.dog) : null, me: r.user_id === viewerId };
  }

  board(userId, game, scope = 'friends') {
    if (!LEADERBOARD.games[game]) throw new GameError('그런 놀이는 없어요.');
    const week = weekKey(this.now());
    const hidden = new Set(this.safety ? this.safety.blockedBy(userId) : []);
    let list;
    if (scope === 'all') {
      list = this.db.prepare(`SELECT s.*, u.nickname FROM scores s JOIN users u ON u.id = s.user_id WHERE s.game = ? AND s.week = ?
        ORDER BY s.best DESC, s.updated_at ASC LIMIT ?`).all(game, week, LEADERBOARD.top + hidden.size)
        .filter((r) => !hidden.has(r.user_id)).slice(0, LEADERBOARD.top);
    } else {
      const ids = [userId, ...this.friends.friendIds(userId)];
      list = this.db.prepare(`SELECT s.*, u.nickname FROM scores s JOIN users u ON u.id = s.user_id WHERE s.game = ? AND s.week = ?
        AND s.user_id IN (${ids.map(() => '?').join(',')}) ORDER BY s.best DESC, s.updated_at ASC`).all(game, week, ...ids);
    }
    const mine = this.db.prepare('SELECT best FROM scores WHERE user_id = ? AND game = ? AND week = ?').get(userId, game, week);
    return {
      week, game, scope,
      entries: list.map((r, i) => this.row(r, i + 1, userId)),
      mine: mine ? { score: mine.best, rank: this.rankOf(userId, game, week) } : null,
      endsAt: Date.parse(`${week}T00:00:00+09:00`) + 7 * 24 * HOUR,
    };
  }

  // 지난주 1~3등 선물 (/me 때마다 확인, 한 번만)
  rewardLastWeek(userId) {
    const last = weekKey(this.now() - 7 * 24 * HOUR);
    const events = [];
    for (const game of Object.keys(LEADERBOARD.games)) {
      const rank = this.rankOf(userId, game, last);
      if (!rank || rank > LEADERBOARD.rewards.length) continue;
      const done = this.db.prepare('INSERT OR IGNORE INTO lb_rewards (user_id, game, week) VALUES (?, ?, ?)').run(userId, game, last).changes;
      if (!done) continue;
      const coins = LEADERBOARD.rewards[rank - 1];
      this.progress.sendMail(userId, 'letter', {
        from: '멍뭉 운동회', title: `지난주 ${LEADERBOARD.games[game].name} ${rank}등!`,
        body: `축하해요! 지난주 ${LEADERBOARD.games[game].name} 전체 랭킹 ${rank}등이에요. 이번 주에도 즐겁게 놀아요!`, coins,
      });
      events.push({ type: 'mail', from: '멍뭉 운동회' }, ...this.progress.track(userId, 'champion'));
    }
    return events;
  }

  // 합동 줄넘기는 브라우저에서만 도는 놀이라, 시작 시각을 받아 두고 콤보가 말이 되는지 확인해요
  ropeStart(userId) {
    const id = crypto.randomBytes(10).toString('hex');
    this.db.prepare("INSERT INTO minigames (id, user_id, started_at, type) VALUES (?, ?, ?, 'rope')").run(id, userId, this.now());
    return { ropeId: id };
  }

  ropeFinish(userId, ropeId, combo) {
    const row = this.db.prepare("SELECT * FROM minigames WHERE id = ? AND user_id = ? AND type = 'rope'").get(String(ropeId), userId);
    if (!row || row.finished) throw new GameError('이미 끝난 놀이예요.');
    this.db.prepare('UPDATE minigames SET finished = 1 WHERE id = ?').run(row.id);
    const seconds = (this.now() - row.started_at) / 1000;
    const possible = Math.floor(seconds / LEADERBOARD.ropeSecondsPerCombo);
    const safe = Math.min(LEADERBOARD.ropeMaxCombo, possible, Math.max(0, Math.floor(Number(combo) || 0)));
    return this.submit(userId, 'rope', safe);
  }
}
