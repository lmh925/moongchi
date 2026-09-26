import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../server/db.js';
import { startBackups } from '../server/backup.js';

test('DB 백업: 하루 한 번, 오래된 건 지우고, 백업 파일은 그대로 열려요', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-'));
  const file = path.join(dir, 'game.db');
  const db = openDb(file);
  db.exec("INSERT INTO users (nickname, pin_hash, pin_salt, friend_code, coins, owned, room, created_at) VALUES ('백업이', 'x', 'y', 'BACKUP', 7, '[]', '{}', 1)");
  let now = Date.UTC(2026, 8, 1, 3);
  const b = startBackups(db, file, { keep: 3, now: () => now, log: () => {} });
  assert.equal(b.run(), null, '같은 날은 한 번만');
  for (let i = 0; i < 5; i++) { now += 24 * 3600_000; b.run(); }
  b.stop();
  const files = fs.readdirSync(b.folder).sort();
  assert.equal(files.length, 3);
  assert.equal(files.at(-1), 'meongmung-2026-09-06.db');
  const copy = openDb(path.join(b.folder, files.at(-1)));
  assert.equal(copy.prepare("SELECT coins FROM users WHERE nickname = '백업이'").get().coins, 7);
  copy.close(); db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
