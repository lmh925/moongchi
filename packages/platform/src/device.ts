// 📳 진동 · 🔔 알림 · 📺 광고 · 💳 결제 — 웹/앱에서 구현이 달라지는 기능들
// 게임 코드는 여기 함수만 부르고, 실제 구현(어댑터)은 앱이 시작할 때 끼워 넣어요.
// 웹에서는 기본 구현(진동 = navigator.vibrate, 광고·결제 = 테스트용 가짜)이 돌아요.
import { store } from './storage';

export type HapticKind = 'tap' | 'light' | 'good' | 'big';

export interface DeviceAdapters {
  haptic?: (kind: HapticKind) => void;
  /** 보상형 광고: 끝까지 보면 true */
  showRewardedAd?: (placement: string) => Promise<boolean>;
  showInterstitialAd?: (placement: string) => Promise<void>;
  /** 결제: 성공하면 영수증 토큰 (서버가 검증해요) */
  purchase?: (productId: string) => Promise<{ ok: boolean; token?: string }>;
  restorePurchases?: () => Promise<string[]>;
  /** 로컬 알림 예약 (서버·개인정보 없이 기기 안에서) */
  scheduleNotification?: (id: number, title: string, body: string, at: Date) => Promise<void>;
  cancelNotification?: (id: number) => Promise<void>;
}

const HAPTIC_KEY = 'platform.haptic';
let hapticOn = store.get<boolean>(HAPTIC_KEY, true);
const PATTERN: Record<HapticKind, number | number[]> = { tap: 8, light: 12, good: [14, 40, 14], big: [20, 50, 20, 50, 40] };

const adapters: Required<DeviceAdapters> = {
  haptic: (k) => { try { navigator.vibrate?.(PATTERN[k]); } catch { /* 지원 안 함 */ } },
  // 웹 미리보기용 가짜 광고: 1.5초 뒤 "봤어요"
  showRewardedAd: () => new Promise((r) => setTimeout(() => r(true), 1500)),
  showInterstitialAd: () => Promise.resolve(),
  purchase: () => Promise.resolve({ ok: false }),
  restorePurchases: () => Promise.resolve([]),
  scheduleNotification: () => Promise.resolve(),
  cancelNotification: () => Promise.resolve(),
};

export function installDevice(a: DeviceAdapters): void { Object.assign(adapters, a); }

export const device = {
  haptic(kind: HapticKind = 'light') { if (hapticOn) adapters.haptic(kind); },
  get hapticOn() { return hapticOn; },
  setHaptic(on: boolean) { hapticOn = on; store.set(HAPTIC_KEY, on); },
  showRewardedAd: (p: string) => adapters.showRewardedAd(p),
  showInterstitialAd: (p: string) => adapters.showInterstitialAd(p),
  purchase: (id: string) => adapters.purchase(id),
  restorePurchases: () => adapters.restorePurchases(),
  scheduleNotification: (id: number, title: string, body: string, at: Date) => adapters.scheduleNotification(id, title, body, at),
  cancelNotification: (id: number) => adapters.cancelNotification(id),
};
