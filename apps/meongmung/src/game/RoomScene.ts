// 🏠 우리집 장면: 방 + 창밖 시간/날씨 + 강아지 + 효과
import Phaser from 'phaser';
import { envAt, sfx, device, type Env } from '@platform';
import { bus } from '../bus';
import { Dog } from './Dog';
import { layout, drawRoom, drawSky, drawBowl, type RoomLayout } from './room';
import type { Care, CareResult } from '../state';

export const UI = { top: 64, bottom: 236 }; // 화면 위아래를 HTML 메뉴가 덮는 높이 (CSS px)

export class RoomScene extends Phaser.Scene {
  L!: RoomLayout;
  dpr = 1;
  dog!: Dog;
  env!: Env;
  sky!: Phaser.GameObjects.Graphics;
  bowl!: Phaser.GameObjects.Graphics;
  light!: Phaser.GameObjects.Rectangle;
  glow!: Phaser.GameObjects.Image;
  stars: Phaser.GameObjects.Arc[] = [];
  weather: { o: Phaser.GameObjects.Shape; vx: number; vy: number; ph: number }[] = [];
  nextWander = 3;
  bowlFullUntil = 0;
  off: (() => void)[] = [];

  constructor() { super('room'); }

  preload() {
    for (const s of ['baby', 'kid', 'adult']) this.load.image(`corgi_${s}`, `assets/art/corgi_${s}_placeholder.png`);
  }

  create() {
    this.dpr = this.game.registry.get('dpr') ?? 1;
    const W = this.scale.width / this.dpr; const H = this.scale.height / this.dpr;
    this.cameras.main.setOrigin(0, 0).setZoom(this.dpr).setBackgroundColor('#fff4e6');
    this.L = layout(W, H, UI.top, UI.bottom);
    this.env = envAt();

    drawRoom(this.add.graphics().setDepth(-100), this.L);
    this.sky = this.add.graphics().setDepth(-90);
    drawSky(this.sky, this.L, this.env);
    this.bowl = this.add.graphics();
    this.bowl.setDepth(this.L.bowl.y);
    drawBowl(this.bowl, this.L, false);

    const h = Phaser.Math.Clamp(H * 0.2, 130, 210);
    const { walk } = this.L;
    this.dog = new Dog(this, W * 0.55, (walk.y0 + walk.y1) / 2, 'corgi_adult', h);

    // 밤 조명: 곱하기로 방 전체를 어둑하게, 가운데만 은은하게 (HTML 메뉴는 그대로 밝아요)
    this.light = this.add.rectangle(0, 0, W, H, 0xffffff).setOrigin(0).setDepth(1e6).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.glow = this.add.image(W / 2, (walk.y0 + walk.y1) / 2, this.glowTexture()).setDepth(1e6 + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.glow.setDisplaySize(W * 1.4, H * 0.9);
    this.makeStars();
    this.applyEnv();
    this.time.addEvent({ delay: 30_000, loop: true, callback: () => { this.env = envAt(); drawSky(this.sky, this.L, this.env); this.applyEnv(); } });

    // 누르기: 강아지 → 폴짝 / 바닥 → 그리로 걸어가요
    this.dog.img.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.tapDog();
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const x = p.worldX; const y = p.worldY;
      if (y < this.L.floorY + 20 || y > this.L.H - UI.bottom + 30) return;
      const tx = Phaser.Math.Clamp(x, walk.x0, walk.x1); const ty = Phaser.Math.Clamp(y, walk.y0, walk.y1);
      this.pawMark(tx, ty);
      sfx.tap();
      this.dog.walkTo(tx, ty);
      this.nextWander = 6;
    });

    this.off.push(bus.on('care', (d) => this.doCare(d as { kind: Care; result: CareResult })));
    this.off.push(bus.on('needs', (n) => this.dog.setNeeds(n as never)));
    this.events.once('shutdown', () => this.off.forEach((f) => f()));
    bus.emit('scene:ready');
  }

  // 은은한 등불 빛 (원형 그라디언트 텍스처)
  glowTexture(): string {
    const key = 'glow';
    if (this.textures.exists(key)) return key;
    const tex = this.textures.createCanvas(key, 256, 256)!;
    const c = tex.getContext();
    const g = c.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,190,120,0.55)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    tex.refresh();
    return key;
  }

  makeStars() {
    const { win } = this.L;
    const pts = [[0.1, 0.12], [0.22, 0.32], [0.4, 0.08], [0.55, 0.3], [0.9, 0.1], [0.32, 0.5], [0.62, 0.12], [0.86, 0.45], [0.14, 0.42]];
    for (const [i, [fx, fy]] of pts.entries()) {
      const s = this.add.circle(win.x + win.w * fx, win.y + win.h * fy, i % 3 ? 1.6 : 2.4, 0xfff7d6).setDepth(1e6 + 2);
      this.tweens.add({ targets: s, alpha: { from: 0.3, to: 1 }, duration: 800 + i * 170, yoyo: true, repeat: -1 });
      this.stars.push(s);
    }
  }

  applyEnv() {
    const e = this.env;
    this.light.setFillStyle(e.light);
    this.light.setVisible(e.light !== 0xffffff);
    this.glow.setAlpha(e.dark > 0.3 ? 0.35 * e.dark : 0);
    for (const s of this.stars) s.setVisible(e.dark > 0.55 && e.weather !== 'rain');
    // 창밖 날씨 입자 (창 안에서만 움직여요)
    for (const w of this.weather) w.o.destroy();
    this.weather = [];
    const { win } = this.L;
    const n = { snow: 18, rain: 26, petals: 9, leaves: 8, clear: 0 }[e.weather];
    for (let i = 0; i < n; i++) {
      const x = win.x + 6 + Math.random() * (win.w - 12); const y = win.y + 6 + Math.random() * (win.h - 12);
      let o: Phaser.GameObjects.Shape;
      if (e.weather === 'rain') o = this.add.rectangle(x, y, 1.6, 9, 0xdbe8ff, 0.8);
      else if (e.weather === 'snow') o = this.add.circle(x, y, 1.5 + Math.random() * 1.6, 0xffffff);
      else if (e.weather === 'petals') o = this.add.ellipse(x, y, 6, 4, 0xffc2d6);
      else o = this.add.ellipse(x, y, 6, 5, [0xe07b2e, 0xf2a541, 0xb8572a][i % 3]);
      o.setDepth(1e6 + 2);
      const speed = { rain: 260, snow: 22, petals: 26, leaves: 30, clear: 0 }[e.weather];
      this.weather.push({ o, vx: e.weather === 'rain' ? -40 : 0, vy: speed * (0.7 + Math.random() * 0.6), ph: Math.random() * 6 });
    }
  }

  tapDog() {
    sfx.bark(1.05);
    device.haptic('tap');
    this.dog.hop();
    this.burst('💗', 2);
    bus.emit('dog:tap');
  }

  doCare({ kind, result }: { kind: Care; result: CareResult }) {
    const d = this.dog;
    const after = () => {
      if (!result.ok) { sfx.error(); this.say(result.reason ?? ''); return; }
      if (result.gain) this.float(`+${result.gain}`, { feed: '#ff9a3c', brush: '#3aa8f0', pet: '#ff5d86' }[kind]);
      if (result.coins) setTimeout(() => { sfx.coin(); this.float(`🦴+${result.coins}`, '#c78a3a', 18); }, 450);
    };
    if (kind === 'feed') {
      drawBowl(this.bowl, this.L, true);
      this.bowlFullUntil = this.time.now + 4000;
      d.walkTo(this.L.bowl.x - 70, this.L.bowl.y + 6, () => {
        d.facing = 1;
        if (result.ok) { d.act('eat', 2200); sfx.eat(); this.say('냠냠!'); }
        after();
        this.time.delayedCall(2300, () => drawBowl(this.bowl, this.L, false));
      });
    } else if (kind === 'brush') {
      if (result.ok) { d.act('brush', 1800); sfx.brush(); this.burst('✨', 6); this.say('보송보송~'); }
      after();
    } else {
      if (result.ok) { d.act('pet', 1500); d.hop(); sfx.pet(); this.burst('💗', 5); this.say('헤헤, 좋아요!'); }
      after();
    }
    device.haptic(result.ok ? 'good' : 'light');
    this.nextWander = 5;
  }

  say(text: string) {
    if (!text) return;
    const t = this.text(this.dog.x, this.dog.y + this.dog.headY - 34, text, 20, '#5a3a28', '#ffffff', 6).setDepth(2e6);
    this.tweens.add({ targets: t, y: t.y - 16, alpha: { from: 1, to: 0 }, delay: 900, duration: 600, onComplete: () => t.destroy() });
  }

  float(text: string, color: string, size = 26) {
    const t = this.text(this.dog.x + (Math.random() - 0.5) * 30, this.dog.y + this.dog.headY, text, size, color, '#ffffff', 6).setDepth(2e6);
    this.tweens.add({ targets: t, y: t.y - 60, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  burst(emoji: string, n: number) {
    for (let i = 0; i < n; i++) {
      const t = this.add.text(this.dog.x + (Math.random() - 0.5) * 80, this.dog.y + this.dog.headY * 0.6, emoji, { fontSize: '24px', resolution: this.dpr }).setOrigin(0.5).setDepth(2e6);
      this.tweens.add({
        targets: t, y: t.y - 70 - Math.random() * 40, x: t.x + (Math.random() - 0.5) * 50, alpha: { from: 1, to: 0 },
        scale: { from: 0.6, to: 1.1 }, delay: i * 90, duration: 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy(),
      });
    }
  }

  pawMark(x: number, y: number) {
    const r = this.add.ellipse(x, y, 16, 8).setStrokeStyle(3, 0xffffff, 0.9).setDepth(y - 1);
    this.tweens.add({ targets: r, scaleX: 3, scaleY: 3, alpha: 0, duration: 500, onComplete: () => r.destroy() });
  }

  text(x: number, y: number, s: string, size: number, color: string, stroke: string, sw: number) {
    return this.add.text(x, y, s, { fontFamily: 'Jua', fontSize: `${size}px`, color, stroke, strokeThickness: sw, resolution: this.dpr }).setOrigin(0.5);
  }

  update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    const d = this.dog;
    d.update(dt, this.env.sleepy);
    // 혼자 놀기: 가끔 돌아다니고, 밤에는 침대에서 자요
    if (d.mood === 'idle') {
      this.nextWander -= dt;
      if (this.nextWander <= 0) {
        const { walk, bed } = this.L;
        if (this.env.sleepy) {
          d.walkTo(bed.x + 10, bed.y + 6, () => { d.facing = 1; d.mood = 'sleep'; });
          this.nextWander = 40;
        } else {
          d.walkTo(walk.x0 + Math.random() * (walk.x1 - walk.x0), walk.y0 + Math.random() * (walk.y1 - walk.y0));
          this.nextWander = 4 + Math.random() * 5;
        }
      }
    }
    const { win } = this.L;
    for (const w of this.weather) {
      w.ph += dt * 2;
      w.o.y += w.vy * dt;
      w.o.x += w.vx * dt + Math.sin(w.ph) * (this.env.weather === 'rain' ? 0 : 10) * dt;
      if (w.o.y > win.y + win.h - 6) { w.o.y = win.y + 6; w.o.x = win.x + 6 + Math.random() * (win.w - 12); }
      if (w.o.x < win.x + 4) w.o.x = win.x + win.w - 6;
    }
  }
}
