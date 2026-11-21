// 🐶 강아지 상태 (목업: 기기에 저장. 다음 단계에서 기존 서버와 연결해요)
import { store } from '@platform';

export type Stat = 'fullness' | 'cleanliness' | 'affection';
export type Care = 'feed' | 'brush' | 'pet';

export interface Pet {
  name: string;
  breed: string;
  stage: 0 | 1 | 2; // 아기 · 꼬마 · 어른
  level: number;
  exp: number;
  coins: number;
  hearts: number;
  fullness: number;
  cleanliness: number;
  affection: number;
  at: number; // 마지막으로 수치를 계산한 시각
  quests: Record<string, boolean>;
}

const KEY = 'meongmung.pet';
const FLOOR = 20; // 아무리 오래 놀아 주지 않아도 이 아래로는 안 떨어져요 (아프거나 떠나지 않아요)
const DECAY: Record<Stat, number> = { fullness: 5, cleanliness: 3, affection: 4 }; // 시간당
const CARE: Record<Care, { stat: Stat; gain: number; exp: number; coins: number; quest: string }> = {
  feed: { stat: 'fullness', gain: 30, exp: 10, coins: 2, quest: 'feed' },
  brush: { stat: 'cleanliness', gain: 25, exp: 8, coins: 2, quest: 'brush' },
  pet: { stat: 'affection', gain: 10, exp: 3, coins: 1, quest: 'pet' },
};
export const QUESTS = [
  { id: 'feed', text: '밥 한 번 주기', emoji: '🍖' },
  { id: 'brush', text: '털 빗겨 주기', emoji: '🫧' },
  { id: 'pet', text: '쓰다듬어 주기', emoji: '💕' },
];
export const expForNext = (lv: number) => 30 + Math.round(2.5 * lv);

const fresh = (): Pet => ({
  name: '초코', breed: 'corgi', stage: 2, level: 3, exp: 12, coins: 120, hearts: 5,
  fullness: 42, cleanliness: 70, affection: 58, at: Date.now(), quests: {},
});

let pet: Pet = new URLSearchParams(location.search).has('fresh') ? fresh() : store.get<Pet>(KEY, fresh());

export function getPet(): Pet { return tick(); }

// 지난 시간만큼 수치를 줄여요
export function tick(now = Date.now()): Pet {
  const hours = Math.max(0, (now - pet.at) / 3600_000);
  if (hours > 0.0005) {
    for (const k of Object.keys(DECAY) as Stat[]) pet[k] = Math.max(FLOOR, pet[k] - DECAY[k] * hours);
    pet.at = now;
    store.set(KEY, pet);
  }
  return pet;
}

export interface CareResult { ok: boolean; reason?: string; gain: number; coins: number; exp: number; levelUp: boolean; quest?: string }

export function care(kind: Care): CareResult {
  tick();
  const c = CARE[kind];
  const before = pet[c.stat];
  if (before >= 95) return { ok: false, reason: kind === 'feed' ? '배불러요~' : kind === 'brush' ? '이미 보송보송해요!' : '헤헤, 충분해요!', gain: 0, coins: 0, exp: 0, levelUp: false };
  pet[c.stat] = Math.min(100, before + c.gain);
  // 필요할 때 돌봐 주면 보상 (연타로 코인 모으기 방지)
  const needed = before < 80;
  const coins = needed ? c.coins : 0;
  const exp = needed ? c.exp : 0;
  pet.coins += coins;
  pet.exp += exp;
  let levelUp = false;
  while (pet.exp >= expForNext(pet.level)) { pet.exp -= expForNext(pet.level); pet.level++; levelUp = true; pet.coins += 10 + pet.level; }
  let quest: string | undefined;
  if (!pet.quests[c.quest]) { pet.quests[c.quest] = true; pet.coins += 5; quest = c.quest; }
  store.set(KEY, pet);
  return { ok: true, gain: Math.round(pet[c.stat] - before), coins, exp, levelUp, quest };
}

export function rename(name: string): void { pet.name = name; store.set(KEY, pet); }
