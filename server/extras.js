// ♨️ 온천 · 🏕️ 꿈 엿보기 · 📰 멍뭉 뉴스
import { SPA, DREAMS, FUN_NEWS, RULES } from '../shared/data.js';
import { kstDate } from '../shared/rules.js';
import { GameError } from './game.js';

const fill = (s, v) => s.replaceAll('{name}', v.name).replaceAll('{friend}', v.friend ?? '').replaceAll('{fdog}', v.fdog ?? '');

export class Extras {
  constructor(db, { game, friends, asks, village }) {
    Object.assign(this, { db, game, friends, asks, village });
  }

  now() { return this.game.now(); }

  rowJson(userId, col) { return JSON.parse(this.db.prepare(`SELECT ${col} AS v FROM users WHERE id = ?`).get(userId)?.v ?? '{}'); }

  // ♨️ 온천: 하루 한 번 청결 가득 + 애정 + 뽀송
  bathe(userId) {
    if (!this.village.has(userId, 'spa')) throw new GameError('아직 온천이 열리지 않았어요.');
    const today = kstDate(this.now());
    const s = this.rowJson(userId, 'spa');
    if (s.day === today) throw new GameError('오늘은 벌써 온천에 다녀왔어요! 내일 또 와요.');
    const { dog } = this.game.refreshDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    if (dog.school) throw new GameError(`${dog.name}(이)가 학교에 가 있어요!`);
    dog.cleanliness = SPA.cleanliness;
    dog.affection = Math.min(RULES.statMax, dog.affection + SPA.affection);
    dog.fluff = Math.max(dog.fluff ?? 0, SPA.fluff);
    dog.exp += SPA.exp;
    const events = this.game.checkGrowth(dog, this.now());
    this.game.saveDog(dog);
    this.db.prepare('UPDATE users SET spa = ? WHERE id = ?').run(JSON.stringify({ day: today }), userId);
    events.push(...this.game.track(userId, 'spa'));
    return { events };
  }

  // 🏕️ 꿈 엿보기: 하루 한 번, 아직 못 본 꿈이 먼저 나와요
  dream(userId) {
    if (!this.village.has(userId, 'camp')) throw new GameError('아직 캠핑장이 열리지 않았어요.');
    const today = kstDate(this.now());
    const d = { seen: [], ...this.rowJson(userId, 'dreams') };
    if (d.day === today) throw new GameError('오늘 꿈은 벌써 엿봤어요. 내일 밤에 또 봐요!');
    const dog = this.game.loadDog(userId);
    if (!dog) throw new GameError('강아지가 없어요.', 404);
    const rng = this.game.rng;
    const fids = this.friends.friendIds(userId);
    let friend = null;
    if (fids.length) {
      const fid = fids[Math.floor(rng() * fids.length)];
      const fd = this.game.loadDog(fid);
      if (fd) friend = { friend: this.game.getUser(fid).nickname, fdog: fd.name, breed: fd.breed, stage: fd.stage, equip: fd.equip };
    }
    const ids = Object.keys(DREAMS).filter((id) => friend || !DREAMS[id].friend);
    const unseen = ids.filter((id) => !d.seen.includes(id));
    const pool = unseen.length ? unseen : ids;
    const id = pool[Math.floor(rng() * pool.length)];
    const D = DREAMS[id];
    const first = !d.seen.includes(id);
    if (first) d.seen.push(id);
    d.day = today;
    this.db.prepare('UPDATE users SET dreams = ? WHERE id = ?').run(JSON.stringify(d), userId);
    const v = { name: dog.name, friend: friend?.friend, fdog: friend?.fdog };
    if (D.coins) this.game.addCoins(userId, D.coins);
    if (D.hearts) this.asks.addHearts(userId, D.hearts);
    return {
      dream: { id, title: fill(D.title, v), text: fill(D.text, v), scene: D.scene, first, coins: D.coins ?? 0, hearts: D.hearts ?? 0, friendDog: D.friend ? friend : null },
      events: this.game.track(userId, 'dream'),
    };
  }

  dreamView(userId) {
    const d = { seen: [], ...this.rowJson(userId, 'dreams') };
    return { seen: d.seen, today: d.day === kstDate(this.now()) };
  }

  spaToday(userId) { return this.rowJson(userId, 'spa').day === kstDate(this.now()); }

  // ---------- 📰 뉴스 ----------
  // 자랑할 만한 일이 생기면 친구들에게 보여 줄 소식으로 적어 둬요
  noteEvents(userId, events = []) {
    const texts = [];
    const user = this.game.getUser(userId);
    const dog = this.game.loadDog(userId);
    if (!user || !dog) return;
    const who = `${user.nickname}네 ${dog.name}`;
    for (const e of events) {
      if (e.type === 'levelUp' && e.level % 5 === 0) texts.push(`${who}(이)가 Lv ${e.level}이 됐어요! 🎉`);
      if (e.type === 'cert' && e.kind === 'master') texts.push(`속보! ${who}(이)가 ${e.name} 마스터 자격증을 땄어요! 🏆`);
      if (e.type === 'runMap') texts.push(`${who}(이)가 멍뭉런 새 맵 "${e.name}"을(를) 열었어요! 🗺️`);
      if (e.type === 'placeOpen') texts.push(`${user.nickname}네 마을에 ${e.emoji} ${e.name}이(가) 생겼어요!`);
      if (e.type === 'cafeLevel') texts.push(`${user.nickname}네 멍뭉 카페가 Lv ${e.level}이 됐어요! ☕`);
      if (e.type === 'setDone') texts.push(`${user.nickname}네 집이 "${e.name}"(으)로 꾸며졌어요! 🛋️`);
      if (e.type === 'grew') texts.push(`${who}(이)가 쑥 자랐어요! 🌱`);
      if (e.type === 'special') texts.push(`${user.nickname}네에 전설의 친구가 나타났어요! ✨`);
    }
    const put = this.db.prepare('INSERT INTO news (user_id, text, created_at) VALUES (?, ?, ?)');
    for (const t of texts.slice(0, 3)) put.run(userId, t, this.now());
  }

  // 친구들 소식 (최근 3일) + 오늘의 재미 뉴스
  news(userId) {
    const fids = this.friends.friendIds(userId);
    const since = this.now() - 3 * 24 * 3600_000;
    const rows = fids.length ? this.db.prepare(`SELECT text, created_at FROM news WHERE user_id IN (${fids.map(() => '?').join(',')}) AND created_at >= ? ORDER BY created_at DESC LIMIT 8`).all(...fids, since) : [];
    const today = kstDate(this.now());
    let h = 0; for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) % 997;
    return { friends: rows.map((r) => ({ text: r.text, at: r.created_at })), fun: FUN_NEWS[h % FUN_NEWS.length] };
  }
}
