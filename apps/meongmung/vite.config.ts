import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // 앱(Capacitor) 안에서는 파일로 열리니까 상대 경로로 빌드해요
  base: './',
  resolve: {
    alias: {
      '@platform': r('../../packages/platform/src/index.ts'),
    },
  },
  server: { fs: { allow: [r('../..')] } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500, // Phaser가 커서 경고 기준을 올려요
  },
});
