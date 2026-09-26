// 강아지끼리 친밀도: 같은 방에서 함께 놀수록 올라가요 (하루 최대치가 있어요)
import { BOND_LEVELS, BOND_RULES } from '../shared/data.js';
import { bondLevel, kstDate } from '../shared/rules.js';

const pair = (x, y) => (x < y ? [x, y] : [y, x]);

export class Bonds {
  constructor(db, { now = () => Date.now() } = {}) {
    this.db = db;
    this.now = now;
    this.gaps = new Map(); // `${kind}:${a}:${b}` -> 마지막 시각
  }

  get(x, y) {
    const [a, b] = pair(x, y);
    const points = this.db.prepare('SELECT points FROM bonds WHERE a = ? AND b = ?').get(a, b)?.points ?? 0;
    const level = bondLevel(points);
    return { points, level, name: BOND_LEVELS[level].name, next: BOND_LEVELS[level + 1]?.min ?? null };
  }

  // 여러 명과의 친밀도를 한 번에 (userId -> bond)
  many(userId, others) {
    return Object.fromEntries(others.filter((o) => o !== userId).map((o) => [o, this.get(userId, o)]));
  }

  // 점수 추가. 쿨다운 중이거나 하루 최대치면 null, 아니면 { before, after }
  add(x, y, kind, { bonus = 0 } = {}) {
    if (x === y) return null;
    const [a, b] = pair(x, y);
    const now = this.now();
    const gap = kind === 'pet' ? BOND_RULES.petGapMs : kind === 'play' ? BOND_RULES.playGapMs : 0;
    const key = `${kind}:${a}:${b}`;
    if (gap && now - (this.gaps.get(key) ?? 0) < gap) return null;
    this.gaps.set(key, now);
    if (this.gaps.size > 5000) this.gaps.clear();

    const today = kstDate(now);
    const row = this.db.prepare('SELECT * FROM bonds WHERE a = ? AND b = ?').get(a, b);
    const dayPoints = row?.day === today ? row.day_points : 0;
    const amount = Math.min((BOND_RULES[kind] ?? 1) + bonus, BOND_RULES.dailyCap - dayPoints);
    if (amount <= 0) return null;
    const beforePoints = row?.points ?? 0;
    this.db.prepare(`INSERT INTO bonds (a, b, points, day, day_points) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(a, b) DO UPDATE SET points = excluded.points, day = excluded.day, day_points = excluded.day_points`)
      .run(a, b, beforePoints + amount, today, dayPoints + amount);
    return { before: bondLevel(beforePoints), after: this.get(a, b) };
  }
}
