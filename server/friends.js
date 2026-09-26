// 친구 관계: 친구 코드로 신청 → 상대가 수락해야 친구가 돼요.
import { GameError } from './game.js';
import { tx } from './db.js';

const MAX_FRIENDS = 50;
const MAX_PENDING = 20;

export class Friends {
  constructor(db, game) {
    this.db = db;
    this.game = game;
  }

  areFriends(a, b) {
    if (a === b) return true;
    return !!this.db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(a, b);
  }

  friendIds(userId) {
    return this.db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(userId).map((r) => r.friend_id);
  }

  list(userId) {
    const friends = this.db.prepare(`SELECT u.id, u.nickname, u.friend_code FROM friendships f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = ? ORDER BY u.nickname`).all(userId)
      .map((r) => ({ id: r.id, nickname: r.nickname, friendCode: r.friend_code, dog: this.game.publicDog(this.game.loadDog(r.id)) }));
    const incoming = this.db.prepare(`SELECT r.id, u.id AS user_id, u.nickname FROM friend_requests r JOIN users u ON u.id = r.from_id
      WHERE r.to_id = ? ORDER BY r.created_at DESC`).all(userId)
      .map((r) => ({ id: r.id, userId: r.user_id, nickname: r.nickname }));
    const outgoing = this.db.prepare(`SELECT r.id, u.nickname FROM friend_requests r JOIN users u ON u.id = r.to_id
      WHERE r.from_id = ? ORDER BY r.created_at DESC`).all(userId)
      .map((r) => ({ id: r.id, nickname: r.nickname }));
    return { friends, incoming, outgoing };
  }

  count(userId) {
    return this.db.prepare('SELECT COUNT(*) AS n FROM friendships WHERE user_id = ?').get(userId).n;
  }

  // 신청 결과: { status: 'sent' | 'friends', target }
  request(userId, code) {
    const target = this.game.getUserByCode(String(code ?? '').trim());
    if (!target) throw new GameError('그런 친구 코드는 없어요. 다시 확인해 주세요!');
    if (target.id === userId) throw new GameError('내 친구 코드예요! 친구의 코드를 넣어 주세요.');
    if (this.areFriends(userId, target.id)) throw new GameError(`${target.nickname}(이)랑은 벌써 친구예요!`);
    return tx(this.db, () => {
      const reverse = this.db.prepare('SELECT id FROM friend_requests WHERE from_id = ? AND to_id = ?').get(target.id, userId);
      if (reverse) {
        this.makeFriends(userId, target.id);
        return { status: 'friends', target };
      }
      if (this.count(userId) >= MAX_FRIENDS) throw new GameError('친구가 너무 많아요!');
      const pending = this.db.prepare('SELECT COUNT(*) AS n FROM friend_requests WHERE from_id = ?').get(userId).n;
      if (pending >= MAX_PENDING) throw new GameError('보낸 신청이 너무 많아요. 친구가 받아줄 때까지 기다려 주세요.');
      this.db.prepare('INSERT OR IGNORE INTO friend_requests (from_id, to_id, created_at) VALUES (?, ?, ?)')
        .run(userId, target.id, this.game.now());
      return { status: 'sent', target };
    });
  }

  respond(userId, requestId, accept) {
    const req = this.db.prepare('SELECT * FROM friend_requests WHERE id = ? AND to_id = ?').get(requestId, userId);
    if (!req) throw new GameError('신청을 찾을 수 없어요.');
    return tx(this.db, () => {
      if (accept) {
        if (this.count(userId) >= MAX_FRIENDS) throw new GameError('친구가 너무 많아요!');
        this.makeFriends(userId, req.from_id);
      } else {
        this.db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
      }
      return { fromId: req.from_id };
    });
  }

  makeFriends(a, b) {
    const now = this.game.now();
    const ins = this.db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)');
    ins.run(a, b, now);
    ins.run(b, a, now);
    this.db.prepare('DELETE FROM friend_requests WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)').run(a, b, b, a);
  }

  remove(userId, friendId) {
    this.db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
      .run(userId, friendId, friendId, userId);
  }
}
