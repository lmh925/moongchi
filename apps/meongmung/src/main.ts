// 🐶 멍뭉고치 2.0 시작점
import Phaser from 'phaser';
import '@fontsource/jua';
import './styles.css';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { registerBgm, playBgm, unlockAudio, installDevice } from '@platform';
import bgm from './bgm.json';
import { RoomScene } from './game/RoomScene';
import { buildHud, homeTrack } from './ui/hud';
import { bus } from './bus';

// 앱(안드로이드)에서는 진짜 진동 모터를 써요. 웹에서는 기본(navigator.vibrate)
if (Capacitor.isNativePlatform()) {
  installDevice({
    haptic: (k) => {
      if (k === 'good') void Haptics.notification({ type: NotificationType.Success });
      else if (k === 'big') void Haptics.notification({ type: NotificationType.Success }).then(() => Haptics.impact({ style: ImpactStyle.Heavy }));
      else void Haptics.impact({ style: k === 'tap' ? ImpactStyle.Light : ImpactStyle.Medium });
    },
  });
}

registerBgm(Object.fromEntries(Object.entries(bgm).map(([k, v]) => [k, v as { src: string; loop: number }])));

async function boot() {
  await document.fonts.load('20px Jua').catch(() => {});
  const ui = document.getElementById('ui')!;
  buildHud(ui);

  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const size = () => ({ w: Math.round(window.innerWidth * dpr), h: Math.round(window.innerHeight * dpr) });
  const s = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#fff4e6',
    scale: { mode: Phaser.Scale.NONE, width: s.w, height: s.h, zoom: 1 / dpr },
    render: { antialias: true },
    scene: [],
    callbacks: { preBoot: (g) => g.registry.set('dpr', dpr) },
  });
  game.scene.add('room', RoomScene, true);

  // 화면 크기가 바뀌면 (회전 등) 방을 다시 그려요
  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const n = size();
      game.scale.resize(n.w, n.h);
      game.scale.setZoom(1 / dpr);
      game.scene.getScene('room')?.scene.restart();
    }, 150);
  });

  // 첫 터치에 소리 켜기 (브라우저 규칙)
  const start = () => { unlockAudio(); void playBgm(homeTrack()); };
  window.addEventListener('pointerdown', start, { once: true, capture: true });
  setInterval(() => { if (!document.querySelector('.sheet.open')) void playBgm(homeTrack()); }, 60_000);
  bus.on('scene:ready', () => document.body.classList.add('ready'));
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void boot();
