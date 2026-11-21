// 🐶 강아지: 지금은 시안 그림 한 장을 코드로 움직여요 (숨쉬기 · 걷기 · 폴짝 · 냠냠 · 꼬질꼬질)
// 부품 그림(머리·귀·다리·꼬리)이 오면 이 클래스 안쪽만 바꾸면 돼요. 바깥에서 부르는 방법은 그대로예요.
import Phaser from 'phaser';
import { INK } from './room';

export type DogMood = 'idle' | 'walk' | 'eat' | 'brush' | 'pet' | 'hop' | 'sleep';
export interface Needs { fullness: number; cleanliness: number; affection: number }

const NEED_AT = 38;

export class Dog extends Phaser.GameObjects.Container {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  bubble: Phaser.GameObjects.Container;
  bubbleIcon: Phaser.GameObjects.Text;
  zzz: Phaser.GameObjects.Text;
  stink: Phaser.GameObjects.Graphics;
  mood: DogMood = 'idle';
  facing = 1;
  target: { x: number; y: number } | null = null;
  onArrive: (() => void) | null = null;
  moodUntil = 0;
  baseScale = 1;
  t = 0;
  needs: Needs = { fullness: 100, cleanliness: 100, affection: 100 };
  speed = 120;

  constructor(scene: Phaser.Scene, x: number, y: number, key: string, height: number) {
    super(scene, x, y);
    this.img = scene.add.image(0, 0, key).setOrigin(0.5, 0.97);
    this.baseScale = height / this.img.height;
    this.img.setScale(this.baseScale);
    this.shadow = scene.add.ellipse(0, 0, this.img.displayWidth * 0.78, 22, 0x5a3a28, 0.18);
    this.stink = scene.add.graphics();
    // 생각 풍선 (배고파요 🍖 / 심심해요 💗)
    const r = 24;
    const bg = scene.add.graphics();
    bg.fillStyle(0xffffff).fillCircle(0, 0, r).lineStyle(3, INK).strokeCircle(0, 0, r);
    bg.fillStyle(0xffffff).fillCircle(-20, 26, 7).lineStyle(3, INK).strokeCircle(-20, 26, 7);
    bg.fillStyle(0xffffff).fillCircle(-30, 38, 4).lineStyle(2, INK).strokeCircle(-30, 38, 4);
    const res = scene.game.registry.get('dpr') ?? 1;
    this.bubbleIcon = scene.add.text(0, 1, '🍖', { fontSize: '26px', resolution: res }).setOrigin(0.5);
    this.bubble = scene.add.container(0, 0, [bg, this.bubbleIcon]).setVisible(false);
    this.zzz = scene.add.text(0, 0, 'z z z', { fontFamily: 'Jua', fontSize: '22px', color: '#5a6ab0', stroke: '#ffffff', strokeThickness: 5, resolution: res }).setOrigin(0, 1).setVisible(false);
    this.add([this.shadow, this.stink, this.img, this.bubble, this.zzz]);
    scene.add.existing(this);
    this.img.setInteractive({ pixelPerfect: true, alphaTolerance: 40 });
  }

  get headY() { return -this.img.displayHeight * 0.82; }

  walkTo(x: number, y: number, then?: () => void) {
    if (this.mood === 'sleep') this.mood = 'idle';
    this.target = { x, y };
    this.onArrive = then ?? null;
    this.mood = 'walk';
    if (Math.abs(x - this.x) > 4) this.facing = x > this.x ? 1 : -1;
  }

  act(m: DogMood, ms: number) {
    this.mood = m;
    this.moodUntil = this.t + ms / 1000;
    this.target = null;
  }

  /** 폴짝! (누르면 말랑 찌그러졌다가 튀어 올라요) */
  hop(big = false) {
    const s = this.baseScale;
    this.scene.tweens.killTweensOf(this.img);
    this.img.setScale(s * this.facing, s);
    this.scene.tweens.chain({
      targets: this.img,
      tweens: [
        { scaleX: s * 1.12 * this.facing, scaleY: s * 0.86, duration: 90, ease: 'Quad.easeOut' },
        { y: big ? -60 : -34, scaleX: s * 0.94 * this.facing, scaleY: s * 1.08, duration: 200, ease: 'Quad.easeOut' },
        { y: 0, scaleX: s * this.facing, scaleY: s, duration: 220, ease: 'Bounce.easeOut' },
      ],
    });
  }

  setNeeds(n: Needs) { this.needs = n; }

  update(dt: number, sleepy: boolean) {
    this.t += dt;
    const t = this.t;
    let bob = 0; let tilt = 0; let breathe = 1 + Math.sin(t * 2.6) * 0.014;
    if (this.mood === 'walk' && this.target) {
      const dx = this.target.x - this.x; const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) {
        this.mood = 'idle';
        const cb = this.onArrive; this.onArrive = null; this.target = null;
        cb?.();
      } else {
        const step = Math.min(d, this.speed * dt);
        this.x += (dx / d) * step; this.y += (dy / d) * step;
        if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
        bob = -Math.abs(Math.sin(t * 11)) * 7;
        tilt = Math.sin(t * 11) * 0.045;
        breathe = 1;
      }
    } else if (this.mood !== 'idle' && this.mood !== 'walk' && this.mood !== 'sleep' && t > this.moodUntil) {
      this.mood = 'idle';
    }
    switch (this.mood) {
      case 'eat': tilt = 0.1 + Math.abs(Math.sin(t * 9)) * 0.08; bob = Math.abs(Math.sin(t * 9)) * 3; break;
      case 'brush': tilt = Math.sin(t * 18) * 0.06; break;
      case 'pet': tilt = Math.sin(t * 7) * 0.05; breathe = 1 + Math.abs(Math.sin(t * 7)) * 0.03; break;
      case 'sleep': breathe = 1 + Math.sin(t * 1.4) * 0.025; break;
      default: break;
    }
    if (!this.scene.tweens.isTweening(this.img)) {
      this.img.y = bob;
      this.img.setScale(this.baseScale * this.facing * (2 - breathe), this.baseScale * breathe);
    } else {
      this.img.scaleX = Math.abs(this.img.scaleX) * this.facing;
    }
    this.img.rotation = tilt * this.facing;
    this.shadow.setScale(1 + bob / 60, 1);
    // 밤엔 침대에서 쿨쿨
    this.zzz.setVisible(this.mood === 'sleep');
    if (this.mood === 'sleep') {
      this.zzz.setPosition(this.facing * 30, this.headY + 10 - Math.sin(t * 1.4) * 4);
      this.zzz.setAlpha(0.6 + Math.sin(t * 2) * 0.4);
    }
    this.drawNeeds(t);
    this.setDepth(this.y);
    void sleepy;
  }

  private drawNeeds(t: number) {
    const n = this.needs;
    this.stink.clear();
    if (n.cleanliness < NEED_AT && this.mood !== 'sleep') {
      // 꼬질꼬질: 냄새 물결 + 파리 한 마리
      const hy = this.headY + 20;
      this.stink.lineStyle(3, 0x8fae5a, 0.85);
      for (const dx of [-22, 0, 22]) {
        const w = Math.sin(t * 4 + dx) * 4;
        this.stink.beginPath();
        this.stink.moveTo(dx + w, hy);
        this.stink.lineTo(dx - w, hy - 10);
        this.stink.lineTo(dx + w, hy - 20);
        this.stink.strokePath();
      }
      const fx = Math.cos(t * 3.2) * 46; const fy = hy + 10 + Math.sin(t * 6.4) * 12;
      this.stink.fillStyle(0x3a2f36).fillCircle(fx, fy, 3.5);
      this.stink.fillStyle(0xdfeeff, 0.9).fillEllipse(fx - 2, fy - 4, 6, 4).fillEllipse(fx + 2, fy - 4, 6, 4);
    }
    const icon = n.fullness < NEED_AT ? '🍖' : n.affection < NEED_AT ? '💗' : null;
    const show = !!icon && this.mood !== 'sleep' && this.mood !== 'eat' && Math.floor((t + 1) / 4) % 2 === 0;
    this.bubble.setVisible(show);
    if (show) {
      this.bubbleIcon.setText(icon!);
      this.bubble.setPosition(this.facing * 64, this.headY - 20 + Math.sin(t * 3) * 3);
    }
  }
}
