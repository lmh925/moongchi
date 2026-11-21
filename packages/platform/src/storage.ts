// 💾 기기 저장소 (지금은 localStorage, 앱에서는 Capacitor Preferences로 바꿔 끼울 수 있어요)
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let adapter: StorageAdapter | null = (() => {
  try { return window.localStorage; } catch { return null; }
})();
const memory = new Map<string, string>();

export function setStorageAdapter(a: StorageAdapter): void { adapter = a; }

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = adapter?.getItem(key) ?? memory.get(key) ?? null;
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch { return fallback; }
  },
  set(key: string, value: unknown): void {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try { adapter?.setItem(key, raw); } catch { /* 저장 공간이 없어도 이번 실행 동안은 기억해요 */ }
  },
  remove(key: string): void {
    memory.delete(key);
    try { adapter?.removeItem(key); } catch { /* 무시 */ }
  },
};
