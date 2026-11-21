import type { CapacitorConfig } from '@capacitor/cli';

// ⚠️ appId(패키지 이름)는 플레이스토어에 처음 올린 뒤에는 절대 바꿀 수 없어요. 첫 업로드 전에 확정해 주세요.
const config: CapacitorConfig = {
  appId: 'biz.thel.meongmung',
  appName: '멍뭉고치',
  webDir: 'dist',
  android: {
    backgroundColor: '#fff4e6',
  },
};

export default config;
