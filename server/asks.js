// 💭 말풍선 소원: 강아지가 가끔 작은 부탁을 해요. 들어주면 💗 행복 포인트를 받아요.
// 부탁이 이루어졌는지는 game.track(종류, extra)으로 알아채요 (간식·꾸미기·훈련·놀이터…).
import { ASKS, ASK_RULES, TREATS, ITEMS, DOG_SLOTS, TRAIN_COURSES } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

export class Asks {
  constructor(db, { game, friends }) {
    this.db = db;
    this.game = game;
    this.friends = friends;
  }

  now() { return this.game.now(); }

  state(userId) {
    const row = this.db.prepare('SELECT ask, hearts, hearts_total FROM users WHERE id = ?').get(userId);
    return { s: { cur: null, nextAt: 0, day: null, n: 0, gift: null, ...JSON.parse(row?.ask ?? '{}') }, hearts: row?.hearts ?? 0, total: row?.hearts_total ?? 0 };
  }

  save(userId, s) {
    this.db.prepare('UPDATE users SET ask = ? WHERE id = ?').run(JSON.stringify(s), userId);
  }

  addHearts(userId, n) {
    this.db.prepare('UPDATE users SET hearts = hearts + ?, hearts_total = hearts_total + ? WHERE id = ?').run(n, n, userId);
  }

  // 지금 강아지 상황에 맞는 부탁 하나 만들기
  make(userId, dog) {
    const rng = this.game.rng;
    const user = this.game.getUser(userId);
    const options = [];
    options.push({ kind: 'treat', target: pick(Object.keys(TREATS), rng) });
    if (dog.fullness < 75) options.push({ kind: 'feed' });
    if (dog.cleanliness < 85) options.push({ kind: 'brush' });
    const wearable = user.owned.filter((id) => DOG_SLOTS.includes(ITEMS[id]?.slot) && (ITEMS[id].stage ?? 0) <= dog.stage && !Object.values(dog.equip ?? {}).includes(id));
    if (wearable.length) options.push({ kind: 'wear', target: pick(wearable, rng) });
    if (this.friends.friendIds(userId).length) options.push({ kind: 'friend' });
    options.push({ kind: 'plaza' }, { kind: 'run' }, { kind: 'train', target: pick(Object.keys(TRAIN_COURSES), rng) });
    if ((dog.tricks ?? []).length) options.push({ kind: 'trick' });
    const o = pick(options, rng);
    return { ...o, id: Math.floor(rng() * 1e9), dogId: dog.id, rainbow: rng() < ASK_RULES.rainbowChance, at: this.now(), until: this.now() + ASK_RULES.lifeMs / (this.game.speed ?? 1) };
  }

  // /me 때마다: 소원이 없고 때가 되었으면 새 소원 (하루 최대 dailyMax)
  check(userId, dog) {
    if (!dog || dog.school) return;
    const { s } = this.state(userId);
    const now = this.now();
    const today = kstDate(now);
    if (s.day !== today) { s.day = today; s.n = 0; }
    if (s.cur && now > s.cur.until) s.cur = null;
    if (!s.cur && !s.gift && s.n < ASK_RULES.dailyMax && now >= (s.nextAt ?? 0)) {
      s.cur = this.make(userId, dog);
      s.n += 1;
    }
    this.save(userId, s);
  }

  matches(cur, kind, extra) {
    if (!cur) return false;
    if (cur.kind === 'treat') return kind === 'treat' && extra.treat === cur.target;
    if (cur.kind === 'wear') return kind === 'equip' && extra.item === cur.target;
    if (cur.kind === 'train') return kind === 'train' && extra.course === cur.target;
    if (cur.kind === 'friend') return kind === 'visit';
    return kind === cur.kind;
  }

  // game.track에서 불러요
  onTrack(userId, kind, extra = {}) {
    const { s } = this.state(userId);
    if (!this.matches(s.cur, kind, extra) || this.now() > s.cur.until) return [];
    const cur = s.cur;
    s.cur = null;
    s.nextAt = this.now() + ASK_RULES.gapMs / (this.game.speed ?? 1);
    const hearts = cur.rainbow ? ASK_RULES.rainbowHearts : ASK_RULES.hearts;
    this.addHearts(userId, hearts);
    this.game.addCoins(userId, ASK_RULES.coins);
    if (cur.rainbow) s.gift = this.giftOptions(userId);
    this.save(userId, s);
    return [{ type: 'askDone', kind: cur.kind, text: askText(cur), hearts, coins: ASK_RULES.coins, rainbow: cur.rainbow, gift: s.gift }];
  }

  giftOptions(userId) {
    const rng = this.game.rng;
    const owned = new Set(this.game.getUser(userId).owned);
    const pool = Object.keys(ITEMS).filter((id) => ITEMS[id].gacha !== false && !ITEMS[id].reward && ITEMS[id].rarity !== 'common' && !owned.has(id));
    const item = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
    return [
      item ? { kind: 'item', item } : { kind: 'coins', coins: 40 },
      { kind: 'coins', coins: 30 },
      { kind: 'boost', boost: 'hourglass' },
    ];
  }

  chooseGift(userId, index) {
    const { s } = this.state(userId);
    const g = s.gift?.[Number(index)];
    if (!g) return null;
    s.gift = null;
    this.save(userId, s);
    if (g.kind === 'coins') this.game.addCoins(userId, g.coins);
    if (g.kind === 'boost') this.game.addBoost(userId, g.boost, 1);
    if (g.kind === 'item') {
      const user = this.game.getUser(userId);
      if (!user.owned.includes(g.item)) this.db.prepare('UPDATE users SET owned = ? WHERE id = ?').run(JSON.stringify([...user.owned, g.item]), userId);
    }
    return g;
  }

  view(userId) {
    const { s, hearts, total } = this.state(userId);
    const cur = s.cur && this.now() <= s.cur.until ? { ...s.cur, text: askText(s.cur), color: s.cur.rainbow ? 'rainbow' : ASKS[s.cur.kind].color, emoji: ASKS[s.cur.kind].emoji, how: ASKS[s.cur.kind].how, go: ASKS[s.cur.kind].go } : null;
    return { cur, gift: s.gift, hearts, heartsTotal: total };
  }
}

export function askText(cur) {
  const A = ASKS[cur.kind];
  if (cur.kind === 'treat') return `${TREATS[cur.target]?.name ?? '간식'} 먹고 싶어!`;
  if (cur.kind === 'wear') return `${ITEMS[cur.target]?.name ?? '예쁜 옷'} 써 보고 싶어!`;
  if (cur.kind === 'train') return `${TRAIN_COURSES[cur.target]?.name ?? '훈련'} 하고 싶어!`;
  return A.text;
}
