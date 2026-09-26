// DB 자동 백업: 하루 한 번 DB를 통째로 복사해 두고, 오래된 건 지워요.
// 볼륨 안(기본: DB 파일 옆 backups 폴더)에 쌓여요. NAS 스냅샷/다른 디스크 복사와 함께 쓰면 더 안전해요.
import fs from 'node:fs';
import path from 'node:path';
import { kstDate } from '../shared/rules.js';

export function startBackups(db, dbFile, { dir = process.env.BACKUP_DIR, keep = Number(process.env.BACKUP_KEEP) || 14, now = () => Date.now(), log = console.log } = {}) {
  if (!dbFile || dbFile === ':memory:' || process.env.BACKUP_DISABLED) return null;
  const folder = dir || path.join(path.dirname(dbFile), 'backups');
  const run = () => {
    try {
      fs.mkdirSync(folder, { recursive: true });
      const file = path.join(folder, `meongmung-${kstDate(now())}.db`);
      if (fs.existsSync(file)) return null;
      db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`); // 쓰는 중에도 안전한 한 파일짜리 복사본
      const old = fs.readdirSync(folder).filter((f) => /^meongmung-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
      for (const f of old.slice(0, Math.max(0, old.length - keep))) fs.rmSync(path.join(folder, f));
      log(`💾 DB 백업: ${file}`);
      return file;
    } catch (err) {
      log(`💾 DB 백업 실패: ${err.message}`);
      return null;
    }
  };
  run();
  const timer = setInterval(run, 60 * 60_000); // 한 시간마다 "오늘 백업 했나?" 확인
  timer.unref?.();
  return { run, stop: () => clearInterval(timer), folder };
}
