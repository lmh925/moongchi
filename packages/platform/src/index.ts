// 🧰 게임 공통 기반 (멍뭉고치와 앞으로 나올 게임들이 함께 써요)
// 게임 코드는 이 파일에서만 가져다 쓰고, 기기별 구현은 앱 시작할 때 installDevice로 끼워요.
export { store, setStorageAdapter } from './storage';
export type { StorageAdapter } from './storage';
export { unlockAudio, registerBgm, preloadBgm, playBgm, stopBgm, getVolume, setVolume, sfx } from './audio';
export type { BgmTrack } from './audio';
export { device, installDevice } from './device';
export type { DeviceAdapters, HapticKind } from './device';
export { envAt, kstClock, weatherToday, season, mixColor } from './clock';
export type { Env, Weather, Season } from './clock';
