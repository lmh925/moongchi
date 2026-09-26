// 매일 들어오고 싶은 이유 + 자랑거리: 오늘의 약속 · 도장판 · 배지 · 견종 도감 · 우편함(강아지 편지)
// game.js의 트랜잭션 안에서도 불려서, 여기서는 tx()를 쓰지 않아요.
import {
  QUESTS, STAMP, BADGES, BADGE_COINS, SHOWCASE_MAX, LETTER, LETTERS, BREEDS, TRICKS, ITEMS, SCHOOL_BOOSTS, BOOST_RULES,
} from '../shared/data.js';
import { kstDate, levelFromExp, talentStage } from '../shared/rules.js';

// 날짜+아이디로 늘 같은 순서가 나오는 작은 난수 (오늘의 약속은 새로고침해도 안 바뀌어요)
function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

const parse = (v, fallback) => { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } };

export class Progress {
  constructor(db, { game, friends, rng = Math.random }) {
    this.db = db;
    this.game = game;
    this.friends = friends;
    this.rng = rng;
  }

  now() { return this.game.now(); }

  row(userId) {
    const r = this.db.prepare('SELECT quest, stamps, stats, badges, showcase, seen_breeds, last_seen, letter_at, owned, nickname FROM users WHERE id = ?').get(userId);
    if (!r) return null;
    return {
      quest: parse(r.quest, {}), stamps: r.stamps ?? 0, stats: parse(r.stats, {}), badges: parse(r.badges, []),
      showcase: parse(r.showcase, []), seen: parse(r.seen_breeds, []), lastSeen: r.last_seen, letterAt: r.letter_at,
      owned: parse(r.owned, []), nickname: r.nickname,
    };
  }

  save(userId, p) {
    this.db.prepare('UPDATE users SET quest = ?, stamps = ?, stats = ?, badges = ?, showcase = ?, seen_breeds = ? WHERE id = ?')
      .run(JSON.stringify(p.quest), p.stamps, JSON.stringify(p.stats), JSON.stringify(p.badges), JSON.stringify(p.showcase), JSON.stringify(p.seen), userId);
  }

  // ---------- 오늘의 약속 ----------
  ensureQuest(userId, p) {
    const today = kstDate(this.now());
    if (p.quest.date === today) return false;
    const rnd = seeded(`${userId}:${today}`);
    const hasFriend = this.friends ? this.friends.list(userId).friends.length > 0 : false;
    const ids = ['care', 'play', 'out'].map((g) => {
      const pool = Object.keys(QUESTS).filter((k) => QUESTS[k].group === g && (!QUESTS[k].needFriend || hasFriend));
      return pool[Math.floor(rnd() * pool.length)];
    });
    p.quest = { date: today, ids, progress: {}, done: [], stamped: false };
    return true;
  }

  questView(p) {
    const q = p.quest;
    return {
      date: q.date,
      list: (q.ids ?? []).map((id) => ({ id, text: QUESTS[id].text, n: QUESTS[id].n, progress: Math.min(QUESTS[id].n, q.progress?.[id] ?? 0), done: q.done.includes(id) })),
      allDone: !!q.stamped,
      stamps: p.stamps,
      card: STAMP.card,
    };
  }

  // 무언가를 했을 때: 횟수 기록 → 약속 확인 → 도장 → 배지. 이벤트 목록을 돌려줘요.
  track(userId, kind, n = 1, extra = {}) {
    const p = this.row(userId);
    if (!p) return [];
    const events = [];
    this.ensureQuest(userId, p);
    p.stats[kind] = (p.stats[kind] ?? 0) + n;
    if (kind === 'coop' && extra.game) p.stats.coopKinds = [...new Set([...(p.stats.coopKinds ?? []), extra.game])];
    const q = p.quest;
    if (q.ids.includes(kind) && !q.done.includes(kind)) {
      q.progress[kind] = (q.progress[kind] ?? 0) + n;
      if (q.progress[kind] >= QUESTS[kind].n) {
        q.done.push(kind);
        this.game.addCoins(userId, STAMP.questCoins);
        events.push({ type: 'questDone', id: kind, text: QUESTS[kind].text, coins: STAMP.questCoins });
      }
    }
    if (!q.stamped && q.ids.every((id) => q.done.includes(id))) {
      q.stamped = true;
      p.stamps += 1;
      let full = false;
      if (p.stamps >= STAMP.card) {
        full = true;
        p.stamps = 0;
        p.stats.stampCard = (p.stats.stampCard ?? 0) + 1;
        this.sendMail(userId, 'capsule', {
          from: '멍뭉 우체부', title: '도장판 완성 선물!',
          body: `도장 ${STAMP.card}개를 다 모았어요! 희귀 아이템 이상만 나오는 특별 캡슐과 반짝 모래시계를 보내요. 열어 보세요!`,
          boost: 'hourglass',
        });
      }
      events.push({ type: 'stamp', stamps: full ? STAMP.card : p.stamps, card: STAMP.card, full });
    }
    this.save(userId, p);
    return [...events, ...this.checkBadges(userId)];
  }

  // 놀이터·친구 집에서 만난 견종 (견종 도감)
  seeBreeds(userId, breeds) {
    const p = this.row(userId);
    if (!p) return [];
    const fresh = [...new Set(breeds)].filter((b) => BREEDS[b] && !p.seen.includes(b));
    if (!fresh.length) return [];
    p.seen = [...p.seen, ...fresh];
    this.save(userId, p);
    return [...fresh.map((b) => ({ type: 'dex', breed: b, name: BREEDS[b].name })), ...this.checkBadges(userId)];
  }

  // ---------- 배지 ----------
  badgeProgress(p, dog) {
    const itemsTotal = Object.values(ITEMS).filter((i) => i.gacha !== false || i.reward).length;
    const itemsOwned = p.owned.filter((id) => ITEMS[id] && (ITEMS[id].gacha !== false || ITEMS[id].reward)).length;
    const level = dog ? levelFromExp(dog.exp) : 1;
    const bestTalent = dog ? Math.max(1, ...Object.values(dog.talents ?? {}).map((v) => talentStage(v))) : 1;
    const seen = new Set([...p.seen, ...(dog ? [dog.breed] : [])]);
    return Object.fromEntries(Object.entries(BADGES).map(([id, b]) => {
      let have = 0; let n = b.n ?? 1;
      if (b.stat) have = b.stat.reduce((a, k) => a + (p.stats[k] ?? 0), 0);
      else if (b.special === 'coopAll') have = (p.stats.coopKinds ?? []).length;
      else if (b.special === 'tricks') { n = Object.keys(TRICKS).length; have = dog?.tricks.length ?? 0; }
      else if (b.special === 'items') { n = Math.ceil(itemsTotal / 2); have = itemsOwned; }
      else if (b.special === 'breeds') { n = Object.keys(BREEDS).length; have = seen.size; }
      else if (b.special === 'level') have = level;
      else if (b.special === 'talent') have = bestTalent;
      return [id, { have: Math.min(have, n), n }];
    }));
  }

  checkBadges(userId) {
    const p = this.row(userId);
    if (!p) return [];
    const dog = this.game.loadDog(userId);
    const prog = this.badgeProgress(p, dog);
    const fresh = Object.keys(BADGES).filter((id) => !p.badges.includes(id) && prog[id].have >= prog[id].n);
    if (!fresh.length) return [];
    p.badges.push(...fresh);
    // 처음 얻은 배지 3개까지는 자동으로 대표 배지에 달아 줘요
    for (const id of fresh) if (p.showcase.length < SHOWCASE_MAX) p.showcase.push(id);
    this.save(userId, p);
    this.game.addCoins(userId, BADGE_COINS * fresh.length);
    return fresh.map((id) => ({ type: 'badge', id, name: BADGES[id].name, desc: BADGES[id].desc, coins: BADGE_COINS }));
  }

  setShowcase(userId, ids) {
    const p = this.row(userId);
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => p.badges.includes(id)).slice(0, SHOWCASE_MAX);
    p.showcase = list;
    this.save(userId, p);
    return list;
  }

  showcase(userId) {
    return this.row(userId)?.showcase ?? [];
  }

  // ---------- 우편함 ----------
  sendMail(userId, kind, data) {
    this.db.prepare('INSERT INTO mail (user_id, kind, data, created_at) VALUES (?, ?, ?, ?)').run(userId, kind, JSON.stringify(data), this.now());
  }

  listMail(userId) {
    return this.db.prepare('SELECT * FROM mail WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30').all(userId)
      .map((m) => ({ id: m.id, kind: m.kind, opened: !!m.opened, createdAt: m.created_at, ...JSON.parse(m.data) }));
  }

  unreadMail(userId) {
    return this.db.prepare('SELECT COUNT(*) AS n FROM mail WHERE user_id = ? AND opened = 0').get(userId).n;
  }

  // 편지를 열면 들어 있는 선물을 받아요. 특별 캡슐은 그 자리에서 뽑아요.
  openMail(userId, mailId) {
    const m = this.db.prepare('SELECT * FROM mail WHERE id = ? AND user_id = ?').get(Number(mailId), userId);
    if (!m) return null;
    const data = JSON.parse(m.data);
    const result = { mail: { id: m.id, kind: m.kind, createdAt: m.created_at, ...data }, events: [], first: !m.opened };
    if (m.opened) return result;
    this.db.prepare('UPDATE mail SET opened = 1 WHERE id = ?').run(m.id);
    if (data.coins) this.game.addCoins(userId, data.coins);
    if (data.item && ITEMS[data.item]) {
      const user = this.game.getUser(userId);
      if (!user.owned.includes(data.item)) {
        user.owned.push(data.item);
        this.db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify(user.owned), userId);
      } else { this.game.addCoins(userId, 10); result.duplicate = true; }
    }
    if (data.boost && SCHOOL_BOOSTS[data.boost]) result.boostAdded = this.game.addBoost(userId, data.boost, 1);
    if (m.kind === 'capsule') result.capsule = this.game.gacha(userId, { special: true });
    if (m.kind === 'letter') result.events.push(...this.track(userId, 'letter'));
    return result;
  }

  // /me 때마다: 오랜만에 왔으면 강아지 편지를 써 둬요
  onMe(userId, dog) {
    const p = this.row(userId);
    if (!p || !dog) return [];
    const now = this.now();
    const speed = this.game.speed ?? 1;
    const events = [];
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM mail WHERE user_id = ?').get(userId).n;
    if (!count) {
      this.writeLetter(userId, dog, p, 'welcome', false);
      events.push({ type: 'mail', from: dog.name });
    } else if (p.lastSeen && now - p.lastSeen >= LETTER.awayMs / speed && now - (p.letterAt ?? 0) >= LETTER.gapMs / speed && !dog.school) {
      const unread = this.db.prepare("SELECT COUNT(*) AS n FROM mail WHERE user_id = ? AND opened = 0 AND kind = 'letter'").get(userId).n;
      if (unread < LETTER.maxUnread) {
        this.writeLetter(userId, dog, p, null, true);
        events.push({ type: 'mail', from: dog.name });
      }
    }
    this.db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, userId);
    return events;
  }

  writeLetter(userId, dog, p, pool, gift) {
    const own = LETTERS[dog.personality] ?? [];
    const list = pool ? LETTERS[pool] : [...LETTERS.any, ...own, ...own]; // 성격 편지가 조금 더 자주 와요
    const text = list[Math.floor(this.rng() * list.length)].replaceAll('{owner}', p.nickname).replaceAll('{name}', dog.name);
    const data = { from: dog.name, breed: dog.breed, stage: dog.stage, title: `${dog.name}의 편지`, body: text };
    if (gift && this.rng() < LETTER.giftChance) {
      if (this.rng() < LETTER.itemChance) {
        const pool2 = Object.keys(ITEMS).filter((id) => ITEMS[id].gacha !== false && ITEMS[id].rarity === 'common' && !p.owned.includes(id));
        if (pool2.length) data.item = pool2[Math.floor(this.rng() * pool2.length)];
      }
      if (!data.item) data.coins = 5 + Math.floor(this.rng() * 11);
      if (this.rng() < BOOST_RULES.letterBusChance) data.boost = 'bus';
    }
    if (pool === 'welcome') { data.coins = 10; data.boost = 'hourglass'; }
    this.sendMail(userId, 'letter', data);
    this.db.prepare('UPDATE users SET letter_at = ? WHERE id = ?').run(this.now(), userId);
  }

  // 화면용 요약
  view(userId) {
    const p = this.row(userId);
    if (!p) return null;
    if (this.ensureQuest(userId, p)) this.save(userId, p);
    const dog = this.game.loadDog(userId);
    return {
      quest: this.questView(p),
      badges: p.badges,
      showcase: p.showcase,
      badgeProgress: this.badgeProgress(p, dog),
      seenBreeds: [...new Set([...p.seen, ...(dog ? [dog.breed] : [])])],
      unreadMail: this.unreadMail(userId),
    };
  }
}
