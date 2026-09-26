import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { levelFromExp } from '../shared/rules.js';
import { TALENTS, TALENT_PERSONALITY } from '../shared/data.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  friend_code TEXT NOT NULL UNIQUE,
  coins INTEGER NOT NULL DEFAULT 0,
  owned TEXT NOT NULL DEFAULT '[]',
  room TEXT NOT NULL DEFAULT '{}',
  last_daily TEXT,
  minigame_date TEXT,
  minigame_plays INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  breed TEXT NOT NULL,
  personality TEXT NOT NULL,
  fullness REAL NOT NULL,
  cleanliness REAL NOT NULL,
  affection REAL NOT NULL,
  fluff REAL NOT NULL DEFAULT 0,
  exp INTEGER NOT NULL DEFAULT 0,
  stage INTEGER NOT NULL DEFAULT 0,
  tricks TEXT NOT NULL DEFAULT '[]',
  equip TEXT NOT NULL DEFAULT '{}',
  school TEXT,
  born_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_user ON reports(user_id, created_at);
CREATE TABLE IF NOT EXISTS friendships (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);
CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  UNIQUE (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS minigames (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  finished INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'catch'
);
CREATE TABLE IF NOT EXISTS blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);
CREATE TABLE IF NOT EXISTS abuse_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  place TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS plaza_bans (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  until INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bonds (
  a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  day TEXT,
  day_points INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (a, b)
);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // 이전 버전 DB 업그레이드 (없는 칸만 추가해요)
  const ensure = (table, col, def) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  };
  ensure('minigames', 'type', "TEXT NOT NULL DEFAULT 'catch'");
  ensure('users', 'gacha_date', 'TEXT');
  ensure('users', 'train_progress', "TEXT NOT NULL DEFAULT '{}'");
  ensure('users', 'gacha_tickets', 'INTEGER NOT NULL DEFAULT 0');
  ensure('dogs', 'level', 'INTEGER NOT NULL DEFAULT 0'); // 보상을 받은 마지막 레벨 (0 = 아직 옮기기 전)
  ensure('dogs', 'talents', "TEXT NOT NULL DEFAULT '{}'");
  ensure('dogs', 'talent_day', "TEXT NOT NULL DEFAULT '{}'");
  ensure('dogs', 'title', 'TEXT');
  ensure('users', 'quest', "TEXT NOT NULL DEFAULT '{}'");
  ensure('users', 'stamps', 'INTEGER NOT NULL DEFAULT 0');
  ensure('users', 'stats', "TEXT NOT NULL DEFAULT '{}'");
  ensure('users', 'badges', "TEXT NOT NULL DEFAULT '[]'");
  ensure('users', 'showcase', "TEXT NOT NULL DEFAULT '[]'");
  ensure('users', 'seen_breeds', "TEXT NOT NULL DEFAULT '[]'");
  ensure('users', 'last_seen', 'INTEGER');
  ensure('users', 'letter_at', 'INTEGER');
  ensure('users', 'boosts', "TEXT NOT NULL DEFAULT '{}'");
  ensure('dogs', 'special', 'TEXT');
  ensure('dogs', 'base_breed', 'TEXT');
  ensure('dogs', 'original', 'INTEGER NOT NULL DEFAULT 0');
  ensure('users', 'boost_day', "TEXT NOT NULL DEFAULT '{}'");
  db.exec(`CREATE TABLE IF NOT EXISTS mail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    opened INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mail_user ON mail(user_id, created_at);`);
  migrateLevels(db);
  return db;
}

// 레벨이 생기기 전부터 함께한 강아지: 지금 경험치만큼 레벨을 매기고(보상은 이미 받은 셈),
// 그동안 함께한 만큼 재능도 조금 채워 줘요.
export function migrateLevels(db) {
  const rows = db.prepare('SELECT id, exp, personality FROM dogs WHERE level = 0').all();
  const upd = db.prepare('UPDATE dogs SET level = ?, talents = ? WHERE id = ?');
  for (const r of rows) {
    const level = levelFromExp(r.exp);
    const fav = TALENT_PERSONALITY[r.personality];
    const talents = Object.fromEntries(Object.keys(TALENTS).map((k) => [k, Math.min(80, Math.floor((level - 1) * (k === fav ? 2.5 : 1.5)))]));
    upd.run(level, JSON.stringify(talents), r.id);
  }
}

// BEGIN/COMMIT 헬퍼
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
