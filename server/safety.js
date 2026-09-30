// 공개 놀이터 안전장치: 차단, 신고, 신고가 쌓이면 잠시 놀이터 입장 제한
import { PLAZA } from '../shared/data.js';
import { GameError } from './game.js';

export const REPORT_REASONS = {
  mean: '나쁜 말이나 행동을 해요',
  follow: '자꾸 따라다녀요',
  spam: '스티커를 너무 많이 보내요',
  diary_bad: '일기에 나쁜 말이 있어요',
  diary_private: '일기에 비밀 정보가 적혀 있어요',
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

  // ---------- 운영자 화면 ----------
  // 신고받은 친구별로 묶어서: 아직 확인 안 한 신고가 있는 친구가 먼저
  adminReports({ includeResolved = false } = {}) {
    const rows = this.db.prepare(`SELECT r.*, a.nickname AS reporter, b.nickname AS target FROM abuse_reports r
      JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.target_id
      ${includeResolved ? '' : 'WHERE r.resolved = 0'} ORDER BY r.created_at DESC LIMIT 500`).all();
    const byTarget = new Map();
    for (const r of rows) {
      if (!byTarget.has(r.target_id)) byTarget.set(r.target_id, { targetId: r.target_id, target: r.target, reports: [] });
      byTarget.get(r.target_id).reports.push({ id: r.id, reporter: r.reporter, reporterId: r.reporter_id, reason: REPORT_REASONS[r.reason] ?? r.reason, place: r.place, at: r.created_at, resolved: !!r.resolved });
    }
    const dayAgo = this.now() - 24 * 3600_000;
    return [...byTarget.values()].map((t) => ({
      ...t,
      reporters: new Set(t.reports.map((r) => r.reporterId)).size,
      recent: t.reports.filter((r) => r.at > dayAgo).length,
      latest: t.reports[0]?.at ?? 0,
      bannedUntil: this.bannedUntil(t.targetId),
    })).sort((x, y) => y.reporters - x.reporters || y.latest - x.latest);
  }

  ban(targetId, hours) {
    const until = this.now() + Math.max(1, Math.min(24 * 30, Number(hours) || 24)) * 3600_000;
    this.db.prepare('INSERT INTO plaza_bans (user_id, until) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET until = excluded.until').run(targetId, until);
    return until;
  }

  unban(targetId) {
    this.db.prepare('DELETE FROM plaza_bans WHERE user_id = ?').run(targetId);
  }

  resolve(targetId) {
    return this.db.prepare('UPDATE abuse_reports SET resolved = 1 WHERE target_id = ? AND resolved = 0').run(targetId).changes;
  }

  bannedUntil(userId) {
    const row = this.db.prepare('SELECT until FROM plaza_bans WHERE user_id = ?').get(userId);
    return row && row.until > this.now() ? row.until : 0;
  }
}
