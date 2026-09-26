// 공개 놀이터 안전장치: 차단, 신고, 신고가 쌓이면 잠시 놀이터 입장 제한
import { PLAZA } from '../shared/data.js';
import { GameError } from './game.js';

export const REPORT_REASONS = {
  mean: '나쁜 말이나 행동을 해요',
  follow: '자꾸 따라다녀요',
  spam: '스티커를 너무 많이 보내요',
  other: '기타',
};

export class Safety {
  constructor(db, { now = () => Date.now() } = {}) {
    this.db = db;
    this.now = now;
  }

  block(userId, targetId) {
    if (userId === targetId) throw new GameError('나 자신은 차단할 수 없어요.');
    this.db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)').run(userId, targetId, this.now());
    // 차단하면 친구 관계와 신청도 정리돼요
    this.db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, targetId, targetId, userId);
    this.db.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(userId, targetId, targetId, userId);
  }

  unblock(userId, targetId) {
    this.db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').run(userId, targetId);
  }

  blockedBy(userId) {
    return this.db.prepare('SELECT blocked_id FROM blocks WHERE user_id = ?').all(userId).map((r) => r.blocked_id);
  }

  // 둘 중 한 명이라도 차단했으면 서로 보이지 않아요
  isBlocked(a, b) {
    return !!this.db.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)').get(a, b, b, a);
  }

  // 신고: 같은 사람을 하루에 한 번만. 서로 다른 신고자가 기준 이상이면 놀이터 입장 제한
  report(reporterId, targetId, reason, place = 'plaza') {
    if (reporterId === targetId) throw new GameError('나 자신은 신고할 수 없어요.');
    if (!REPORT_REASONS[reason]) throw new GameError('신고 이유를 골라 주세요.');
    const now = this.now();
    const dayAgo = now - 24 * 3600_000;
    const dup = this.db.prepare('SELECT 1 FROM abuse_reports WHERE reporter_id = ? AND target_id = ? AND created_at > ?').get(reporterId, targetId, dayAgo);
    if (!dup) {
      this.db.prepare('INSERT INTO abuse_reports (reporter_id, target_id, reason, place, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(reporterId, targetId, reason, place, now);
    }
    this.block(reporterId, targetId);
    const distinct = this.db.prepare('SELECT COUNT(DISTINCT reporter_id) AS n FROM abuse_reports WHERE target_id = ? AND created_at > ?').get(targetId, dayAgo).n;
    let banned = false;
    if (distinct >= PLAZA.reportBanThreshold) {
      const until = now + PLAZA.banHours * 3600_000;
      this.db.prepare('INSERT INTO plaza_bans (user_id, until) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET until = excluded.until').run(targetId, until);
      banned = true;
    }
    return { banned };
  }

  bannedUntil(userId) {
    const row = this.db.prepare('SELECT until FROM plaza_bans WHERE user_id = ?').get(userId);
    return row && row.until > this.now() ? row.until : 0;
  }
}
