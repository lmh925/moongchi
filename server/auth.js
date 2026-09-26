// 닉네임 + 숫자 4자리 비밀번호 계정 (실명/이메일 등 개인정보는 받지 않아요)
import crypto from 'node:crypto';
import { RULES, DEFAULT_OWNED, DEFAULT_ROOM } from '../shared/data.js';
import { GameError } from './game.js';
import { checkNickname } from './filter.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60_000;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString('hex');
}

function checkPin(pin) {
  if (!/^\d{4}$/.test(String(pin ?? ''))) throw new GameError('비밀번호는 숫자 4자리예요.');
}

export class Auth {
  constructor(db, { now = () => Date.now() } = {}) {
    this.db = db;
    this.now = now;
  }

  newFriendCode() {
    for (;;) {
      const code = Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      if (!this.db.prepare('SELECT 1 FROM users WHERE friend_code = ?').get(code)) return code;
    }
  }

  issueToken(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(sha256(token), userId, this.now());
    return token;
  }

  signup(nickname, pin) {
    const nick = checkNickname(nickname);
    if (!nick.ok) throw new GameError(nick.reason);
    checkPin(pin);
    if (this.db.prepare('SELECT 1 FROM users WHERE nickname = ?').get(nick.nickname)) {
      throw new GameError('이미 누가 쓰고 있는 닉네임이에요. 다른 닉네임을 골라 주세요!');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const res = this.db.prepare(`INSERT INTO users (nickname, pin_hash, pin_salt, friend_code, coins, owned, room, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(nick.nickname, hashPin(pin, salt), salt, this.newFriendCode(), RULES.startingCoins,
        JSON.stringify(DEFAULT_OWNED), JSON.stringify(DEFAULT_ROOM), this.now());
    const userId = Number(res.lastInsertRowid);
    return { userId, token: this.issueToken(userId) };
  }

  login(nickname, pin) {
    checkPin(pin);
    const row = this.db.prepare('SELECT * FROM users WHERE nickname = ?').get(String(nickname ?? '').trim());
    if (!row) throw new GameError('그런 닉네임을 찾을 수 없어요.');
    this.checkRowPin(row, pin);
    return { userId: row.id, token: this.issueToken(row.id) };
  }

  // 비밀번호 확인 (틀리면 횟수를 세고, 여러 번 틀리면 잠가요)
  checkRowPin(row, pin) {
    const now = this.now();
    if (row.locked_until > now) {
      const min = Math.ceil((row.locked_until - now) / 60_000);
      throw new GameError(`비밀번호를 여러 번 틀려서 잠겼어요. ${min}분 뒤에 다시 해 주세요.`, 429);
    }
    const ok = crypto.timingSafeEqual(Buffer.from(hashPin(pin, row.pin_salt), 'hex'), Buffer.from(row.pin_hash, 'hex'));
    if (!ok) {
      const fails = row.fail_count + 1;
      const lock = fails >= MAX_FAILS ? now + LOCK_MS : 0;
      this.db.prepare('UPDATE users SET fail_count = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : fails, lock, row.id);
      throw new GameError(lock ? '비밀번호를 여러 번 틀려서 10분 동안 잠겼어요.' : `비밀번호가 달라요. (${fails}/${MAX_FAILS})`, 401);
    }
    this.db.prepare('UPDATE users SET fail_count = 0, locked_until = 0 WHERE id = ?').run(row.id);
  }

  // 계정 삭제: 비밀번호를 한 번 더 확인하고, 강아지·친구·편지·거래 기록까지 모두 지워요 (되돌릴 수 없어요)
  verifyPin(userId, pin) {
    checkPin(pin);
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!row) throw new GameError('계정을 찾을 수 없어요.', 404);
    this.checkRowPin(row, pin);
  }

  deleteAccount(userId, pin) {
    this.verifyPin(userId, pin);
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  }

  userIdForToken(token) {
    if (!token || typeof token !== 'string') return null;
    return this.db.prepare('SELECT user_id FROM sessions WHERE token_hash = ?').get(sha256(token))?.user_id ?? null;
  }

  logout(token) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(String(token)));
  }
}
