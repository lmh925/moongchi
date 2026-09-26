// 16비트 스타일 픽셀 아트를 코드로 그리는 스프라이트 엔진
// 강아지는 오른쪽을 바라보는 옆모습(2등신)으로 그리고, 왼쪽을 볼 때는 좌우 반전해요.
import { BREEDS } from '/shared/data.js';

export const DOG_W = 48;
export const DOG_H = 44;
const GROUND = 41;

const BASE_PALETTE = {
  out: '#4a3330', eye: '#2a1c1a', white: '#ffffff', nose: '#2a1c1a', pink: '#ff9fb2',
  tongue: '#ff6f8a', tear: '#8fd3ff', earIn: '#f7b2b7',
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- 마스크 & 픽셀 그리드 ----------
class Mask {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.d[y * this.w + x] === 1; }
  set(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 1; }
  clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = 0; }
  ellipse(cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y);
      }
    }
    return this;
  }
  rect(x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(Math.round(x) + i, Math.round(y) + j);
    return this;
  }
  tri(ax, ay, bx, by, cx, cy) {
    const minX = Math.floor(Math.min(ax, bx, cx)); const maxX = Math.ceil(Math.max(ax, bx, cx));
    const minY = Math.floor(Math.min(ay, by, cy)); const maxY = Math.ceil(Math.max(ay, by, cy));
    const sign = (px, py, x1, y1, x2, y2) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5; const py = y + 0.5;
        const d1 = sign(px, py, ax, ay, bx, by); const d2 = sign(px, py, bx, by, cx, cy); const d3 = sign(px, py, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0; const pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.set(x, y);
      }
    }
    return this;
  }
  // 타원 둘레에 동글동글한 털 뭉치를 붙여요 (곱슬/뽕긋 효과)
  bumps(cx, cy, rx, ry, count, r, from = 0, to = Math.PI * 2) {
    for (let i = 0; i < count; i++) {
      const a = from + ((to - from) * (i + 0.5)) / count;
      this.ellipse(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r, r);
    }
    return this;
  }
  union(m) { for (let i = 0; i < this.d.length; i++) this.d[i] |= m.d[i]; return this; }
}

class Grid {
  constructor(w, h, palette) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); this.pal = palette; }
  get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; }
  set(x, y, key) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = key;
  }
  mask() { return new Mask(this.w, this.h); }

  // 외곽선 + 채우기 + 명암 (앞에 그린 도형 위에 겹쳐서 내부 외곽선이 생겨요)
  paint(mask, base, { outline = true, texture = null, flat = false } = {}) {
    const { w, h } = this;
    if (outline) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask.has(x, y)) continue;
          if (mask.has(x - 1, y) || mask.has(x + 1, y) || mask.has(x, y - 1) || mask.has(x, y + 1)) this.set(x, y, 'out');
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask.has(x, y)) continue;
        let key = base;
        if (!flat) {
          if (!mask.has(x, y + 1) || !mask.has(x, y + 2)) key = `${base}S`;
          else if (!mask.has(x, y - 1) || (!mask.has(x - 1, y) && !mask.has(x, y - 2))) key = `${base}L`;
          else if (texture === 'curly') {
            const t = (x * 3 + y * 5) % 7;
            if (t === 0) key = `${base}L`; else if (t === 4) key = `${base}S`;
          } else if (texture === 'silky') {
            if ((x + (y >> 2)) % 5 === 0) key = `${base}L`;
          }
        }
        this.set(x, y, key);
      }
    }
  }

  draw(ctx, ox = 0, oy = 0) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const k = this.px[y * this.w + x];
        if (!k) continue;
        ctx.fillStyle = this.pal[k] ?? k;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
}

// ---------- 문자 픽셀맵 (액세서리/스티커/아이콘) ----------
function stamp(grid, map, colors, ox, oy) {
  map.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      if (ch === '.' || ch === ' ') return;
      grid.set(ox + i, oy + j, colors[ch] ?? ch);
    });
  });
}

const ACCESSORIES = {
  ribbon: { anchor: 'head', dx: -4, dy: -3, colors: { o: '#4a3330', p: '#ff7fa8', l: '#ffc2d6', d: '#e0507f' },
    map: ['oo...oo', 'opo.opo', 'olpopdo', 'opo.opo', 'oo...oo'] },
  strawberry: { anchor: 'head', dx: -5, dy: -6, colors: { o: '#4a3330', r: '#ff4d6d', l: '#ff8fa3', g: '#5cb85c', y: '#ffe066' },
    map: ['...ogo...', '..ogggo..', '.orrrrro.', 'orlryrrro', 'orrrrryro', 'oryrrrrro', 'ooooooooo'] },
  straw_hat: { anchor: 'head', dx: -8, dy: -5, colors: { o: '#4a3330', y: '#f5d27a', d: '#d9ae4f', r: '#e85d75' },
    map: ['....ooooooo....', '...oyyyyyyyo...', '...orrrrrrro...', 'oooyyyyyyyyyooo', 'oyyyydyydyyyyyo', 'ooooooooooooooo'] },
  flower: { anchor: 'head', dx: -7, dy: -3, colors: { o: '#4a3330', p: '#ff9fc4', y: '#ffe066', w: '#ffffff', g: '#6cc070', b: '#9fc7ff' },
    map: ['.o...o...o...', 'opo.owo.obo..', 'oyo.oyo.oyo..', 'gpggwgggbggg.', '.ggggggggggg.'] },
  wizard: { anchor: 'head', dx: -6, dy: -12, colors: { o: '#4a3330', v: '#8a6fd1', d: '#6a4fb1', y: '#ffe066' },
    map: ['........oo..', '.......ovo..', '......ovvo..', '.....ovyvo..', '....ovvvvo..', '...ovvvyvvo.', '...ovvvvvvo.', '..ovyvvvvvvo', '..ovvvvvyvvo', 'oddddddddddddo', 'oooooooooooooo'] },
  crown: { anchor: 'head', dx: -5, dy: -6, colors: { o: '#4a3330', y: '#ffd23f', d: '#e0a800', r: '#ff4d6d', b: '#5bc0ff' },
    map: ['o...o...o', 'oyooyooyo', 'oyyyyyyyo', 'oyryybyro', 'oddddddd o', 'ooooooooo'] },
  bib: { anchor: 'neck', dx: -3, dy: -1, colors: { o: '#4a3330', w: '#ffffff', p: '#ffc2d6', l: '#e8e8f0' },
    map: ['owwwwo', 'owpwpwo', 'owwwwwo', '.owpwo.', '..ooo..'] },
  bandana: { anchor: 'neck', dx: -3, dy: -1, colors: { o: '#4a3330', r: '#e84a5f', w: '#ffffff' },
    map: ['orrrrro', 'orwrwro', '.orrro.', '..oro..', '...o...'] },
  bowtie: { anchor: 'neck', dx: -3, dy: 0, colors: { o: '#4a3330', b: '#4a7dff', l: '#8fb0ff' },
    map: ['oo...oo', 'oloobbo', 'obbbbbo', 'obboolo', 'oo...oo'] },
  star_glasses: { anchor: 'eye', dx: -3, dy: -3, colors: { o: '#4a3330', y: '#ffd23f', c: '#bfe8ff' },
    map: ['...y...', '..yyy..', 'yyycyyy', '.ycccy.', '.yy.yy.', 'y.....y'] },
  sunglasses: { anchor: 'eye', dx: -3, dy: -2, colors: { o: '#1e1e28', g: '#3a3a4a', w: '#9aa0b8' },
    map: ['oooooooooo', 'ogwgggo...', 'oggggo....', '.oooo.....'] },
};

// 정면 모습일 때 모양이 달라지는 액세서리 (안경은 두 눈에 씌워요)
const FRONT_ACC = {
  star_glasses: { dx: -6, dy: -3, map: ['..y.......y..', '.yyy.....yyy.', 'yycyyoooyycyy', '.ycy.....ycy.', 'y...y...y...y'] },
  sunglasses: { dx: -6, dy: -2, map: ['ooooooooooooo', 'oggwgoooggwgo', 'ogggo...ogggo', '.ooo.....ooo.'] },
};

// ---------- 강아지 그리기 ----------
const STAGE_GEO = [
  { headR: 7.5, bodyRx: 7.5, bodyRy: 5, leg: 3 },
  { headR: 8, bodyRx: 9.5, bodyRy: 6, leg: 4 },
  { headR: 8.5, bodyRx: 11.5, bodyRy: 7, leg: 6 },
];
const SNOUT = { tiny: 2, short: 3, normal: 4, long: 5 };

function dogPalette(b) {
  const acc = b.accent ?? b.fur;
  return {
    ...BASE_PALETTE,
    fur: b.fur, furS: b.furShade, furL: b.furLight,
    far: b.furShade, farS: shade(b.furShade, -22), farL: b.furShade,
    ear: b.furShade, earS: shade(b.furShade, -20), earL: b.fur,
    acc, accS: shade(acc, -26), accL: shade(acc, 14),
  };
}

// pose: stand | walk1 | walk2 | sit | lie | bow | paw | beg | front(정면)
// opts: { eyes: open|happy|closed|sad, mouth: closed|open|tongue, tail: 0|1, fluff: 0|1|2, equip }
export function buildDog(breedId, stage, pose = 'stand', opts = {}) {
  const b = BREEDS[breedId] ?? BREEDS.bichon;
  if (pose === 'front') return buildDogFront(b, stage, opts);
  const g = { ...STAGE_GEO[stage] };
  if (b.legs === 'short') g.leg = Math.max(2, g.leg - 3);
  if (b.legs === 'long') g.leg += 1;
  if (b.legs === 'short') g.bodyRx += 1.5;
  const fluff = opts.fluff ?? 0;
  const eyes = opts.eyes ?? 'open';
  const mouth = opts.mouth ?? 'closed';
  const grid = new Grid(DOG_W, DOG_H, dogPalette(b));
  const fuzzy = b.coat === 'curly' || b.coat === 'fluffy' || fluff > 0;
  const bumpR = b.coat === 'curly' ? 1.8 : 1.4;
  const extra = fluff * 0.6;

  const lying = pose === 'lie';
  const sitting = pose === 'sit' || pose === 'paw' || pose === 'beg';
  const bowing = pose === 'bow';

  // 몸통 위치
  let bcx = 19;
  let bcy = GROUND - g.leg - g.bodyRy + 2;
  let { bodyRx, bodyRy } = g;
  if (lying) bcy = GROUND - bodyRy + 1;
  if (sitting) { bodyRx -= 2; bodyRy += 1; bcy = GROUND - bodyRy - 1; bcx -= 1; }
  if (bowing) bcy -= 1;

  // 머리 위치
  let hcx = bcx + bodyRx - 1;
  let hcy = bcy - bodyRy - g.headR * 0.5 + 2;
  if (sitting) { hcx = bcx + bodyRx - 2; hcy -= 3; }
  if (pose === 'beg') { hcy -= 2; }
  if (lying) { hcx = bcx + bodyRx + 1; hcy = GROUND - g.headR + 1; }
  if (bowing) { hcx += 2; hcy += 5; }
  hcx += opts.headDx ?? 0;
  hcy += opts.headDy ?? 0;
  const headR = g.headR + (b.headFluff ? b.headFluff * 0.5 : 0);

  const legW = 3;
  const legTop = bcy + bodyRy - 3;
  const frontX = Math.round(bcx + bodyRx - 5);
  const backX = Math.round(bcx - bodyRx + 2);
  const phase = pose === 'walk1' ? 1 : pose === 'walk2' ? 2 : 0;
  const legColorBottom = b.accent && b.legs === 'short' ? 'acc' : null;

  const leg = (x, lift, far, len = null) => {
    const m = grid.mask();
    const bottom = GROUND - lift;
    const top = len ? bottom - len : legTop;
    m.rect(x, top, legW, bottom - top + 1);
    grid.paint(m, far ? 'far' : 'fur', { flat: false });
    if (legColorBottom && !far) {
      const s = grid.mask().rect(x, bottom - 1, legW, 2);
      grid.paint(s, 'acc', { outline: false, flat: true });
    }
  };

  // 1) 뒤쪽 다리
  if (!lying && !sitting) {
    leg(frontX + 2, phase === 2 ? 1 : 0, true);
    leg(backX + 2, phase === 1 ? 1 : 0, true);
  }

  // 2) 꼬리
  const tailUp = opts.tail ? -1 : 0;
  const tx = bcx - bodyRx + 1;
  const ty = bcy - bodyRy + 2 + tailUp;
  {
    const m = grid.mask();
    if (b.tail === 'plume') {
      m.ellipse(tx - 2, ty - 2, 2.5 + extra, 3.5 + extra).ellipse(tx - 1, ty + 1, 2, 2);
      if (fuzzy) m.bumps(tx - 2, ty - 2, 2.5, 3.5, 5, 1.2);
    } else if (b.tail === 'curl') {
      m.ellipse(tx + 1, ty - 2, 3.5 + extra, 3 + extra);
    } else if (b.tail === 'pompom') {
      m.rect(tx - 2, ty - 1, 2, 3).ellipse(tx - 3, ty - 3, 2.5 + extra, 2.5 + extra);
    } else {
      m.ellipse(tx - 1, ty + 1, 2, 1.8);
    }
    if (!lying || b.tail !== 'curl') grid.paint(m, 'fur', { texture: b.coat === 'curly' ? 'curly' : null });
  }

  // 3) 몸통 (+포메 갈기)
  {
    const m = grid.mask().ellipse(bcx, bcy, bodyRx + extra * 0.5, bodyRy + extra * 0.5);
    if (sitting) m.ellipse(bcx - 3, GROUND - 3, 5, 3.5);
    if (b.coat === 'fluffy') {
      m.ellipse(hcx - 2, hcy + g.headR * 0.6, g.headR + 1 + extra, g.headR * 0.85 + extra);
      m.bumps(hcx - 2, hcy + g.headR * 0.6, g.headR + 1, g.headR * 0.85, 10, 1.6 + extra * 0.5, Math.PI * 0.2, Math.PI * 1.3);
    }
    if (fuzzy) m.bumps(bcx, bcy, bodyRx + extra * 0.5, bodyRy + extra * 0.5, 12 + fluff * 4, bumpR + extra * 0.5, Math.PI, Math.PI * 2.05);
    if (b.coat === 'silky' && !lying) {
      // 말티즈의 길게 늘어진 털
      const skirtTop = Math.round(bcy);
      for (let x = Math.round(bcx - bodyRx + 1); x <= Math.round(bcx + bodyRx - 1); x++) {
        const jag = (x % 3 === 0 ? 1 : 0) + (phase && x % 2 ? 1 : 0);
        m.rect(x, skirtTop, 1, GROUND - 1 - skirtTop - jag - (sitting ? 0 : 1));
      }
    }
    grid.paint(m, 'fur', { texture: b.coat === 'curly' ? 'curly' : b.coat === 'silky' ? 'silky' : null });
    if (b.accent && !lying) {
      const chest = grid.mask();
      chest.ellipse(bcx + bodyRx - 4, bcy + 2, 4, bodyRy - 2);
      for (let i = 0; i < chest.d.length; i++) {
        if (chest.d[i] && !m.d[i]) chest.d[i] = 0;
      }
      grid.paint(chest, 'acc', { outline: false });
    }
  }

  // 4) 앞쪽 다리
  if (lying) {
    const m = grid.mask().rect(hcx - 2, GROUND - 2, 7, 3);
    grid.paint(m, 'fur');
  } else if (sitting) {
    const raise = pose === 'paw' ? 4 : pose === 'beg' ? 6 : 0;
    leg(frontX + 1, 0, true, GROUND - (bcy + 1));
    if (raise) {
      const m = grid.mask().rect(frontX + 4, bcy - raise + 1, 5, 3);
      grid.paint(m, 'fur');
    } else {
      leg(frontX + 3, 0, false, GROUND - (bcy + 1));
    }
  } else {
    const frontLen = bowing ? GROUND - legTop - 3 : null;
    leg(frontX, phase === 1 ? 1 : 0, false, frontLen ? frontLen + 1 : null);
    leg(backX, phase === 2 ? 1 : 0, false);
  }

  // 5) 뒤쪽 귀 (뾰족귀는 머리 뒤에 하나 더)
  const earBig = b.ear === 'pointyBig' ? 1.4 : b.ear === 'pointySmall' ? 0.7 : 1;
  const pointy = b.ear.startsWith('pointy');
  if (pointy) {
    const m = grid.mask();
    const ex = hcx - 3; const ey = hcy - headR + 3;
    m.tri(ex - 4, ey + 1, ex + 1, ey, ex - 2, ey - 6 * earBig);
    grid.paint(m, 'ear', { flat: true });
  }

  // 6) 머리 + 주둥이
  const snoutLen = SNOUT[b.snout];
  const sx = hcx + headR - 2 + snoutLen / 2;
  const sy = hcy + 2.5;
  {
    const m = grid.mask().ellipse(hcx, hcy, headR + extra * 0.4, headR * 0.92 + extra * 0.4);
    m.ellipse(sx, sy, snoutLen / 2 + 1.5, 2.6);
    if (b.headFluff || fuzzy) {
      m.bumps(hcx - 0.5, hcy - 0.5, headR + extra * 0.4, headR * 0.9 + extra * 0.4, 9 + fluff * 3 + (b.headFluff ?? 0) * 3,
        bumpR + (b.headFluff ? 0.4 : 0) + extra * 0.4, Math.PI * 0.6, Math.PI * 2.1);
    }
    grid.paint(m, 'fur', { texture: b.coat === 'curly' ? 'curly' : null });
    if (b.accent) {
      // 주둥이와 볼의 밝은 털 (시바, 코기, 포메)
      const acc = grid.mask().ellipse(sx, sy + 0.5, snoutLen / 2 + 1, 2.2).ellipse(hcx + 2, hcy + headR * 0.55, headR * 0.6, headR * 0.35);
      for (let i = 0; i < acc.d.length; i++) if (acc.d[i] && !m.d[i]) acc.d[i] = 0;
      grid.paint(acc, 'acc', { outline: false });
    }
  }

  // 7) 앞쪽 귀
  if (pointy) {
    const m = grid.mask();
    const ex = hcx; const ey = hcy - headR + 3;
    m.tri(ex - 4, ey + 1, ex + 2, ey + 1, ex - 1, ey - 6 * earBig);
    grid.paint(m, 'fur', { flat: true });
    grid.set(ex - 1, ey - 1, 'earIn');
    if (earBig > 0.9) { grid.set(ex - 1, ey - 2, 'earIn'); grid.set(ex - 2, ey, 'earIn'); grid.set(ex - 1, ey, 'earIn'); }
  } else if (b.ear !== 'hidden') {
    const m = grid.mask();
    const long = b.ear === 'longSilky' ? 7 : 5;
    m.ellipse(hcx - 3, hcy + 1, 3 + extra * 0.3, long);
    if (b.ear === 'longCurly') m.bumps(hcx - 3, hcy + 1, 3, long, 6, 1.4, 0, Math.PI * 2);
    grid.paint(m, 'ear', { texture: b.ear === 'longCurly' ? 'curly' : b.ear === 'longSilky' ? 'silky' : null });
  }

  // 8) 얼굴
  const ex = Math.round(hcx + headR * 0.35 + 0.5);
  const ey = Math.round(hcy - 1);
  if (eyes === 'happy') {
    grid.set(ex - 1, ey + 1, 'eye'); grid.set(ex, ey, 'eye'); grid.set(ex + 1, ey + 1, 'eye');
  } else if (eyes === 'closed') {
    grid.set(ex - 1, ey + 1, 'eye'); grid.set(ex, ey + 1, 'eye'); grid.set(ex + 1, ey + 1, 'eye');
  } else {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) grid.set(ex + i - 1, ey + j - 1, 'eye');
    grid.set(ex - 1, ey - 1, 'white');
    if (eyes === 'sad') {
      grid.set(ex - 2, ey - 3, 'out'); grid.set(ex - 1, ey - 3, 'out'); grid.set(ex, ey - 2, 'out');
      grid.set(ex + 1, ey + 2, 'tear');
    }
  }
  const noseX = Math.round(sx + snoutLen / 2);
  const noseY = Math.round(sy - 2);
  grid.set(noseX, noseY, 'nose'); grid.set(noseX + 1, noseY, 'nose'); grid.set(noseX, noseY + 1, 'nose'); grid.set(noseX + 1, noseY + 1, 'nose');
  grid.set(ex + 1, ey + 3, 'pink'); grid.set(ex + 2, ey + 3, 'pink');
  if (mouth === 'open' || mouth === 'tongue') {
    grid.set(noseX - 1, noseY + 3, 'out'); grid.set(noseX, noseY + 3, 'out'); grid.set(noseX - 2, noseY + 2, 'out');
    grid.set(noseX - 1, noseY + 4, 'tongue'); grid.set(noseX, noseY + 4, 'tongue');
    if (mouth === 'tongue') grid.set(noseX, noseY + 5, 'tongue');
  } else {
    grid.set(noseX - 1, noseY + 3, 'out');
  }

  // 9) 액세서리
  const anchors = {
    head: { x: Math.round(hcx), y: Math.round(hcy - headR - (b.headFluff ? 1 : 0)) },
    neck: { x: Math.round(hcx - 2), y: Math.round(hcy + headR * 0.8) },
    eye: { x: ex, y: ey },
  };
  if (b.ear.startsWith('pointy')) anchors.head.y += 1;
  for (const slot of ['neck', 'face', 'head']) {
    const id = opts.equip?.[slot];
    const acc = id && ACCESSORIES[id];
    if (!acc) continue;
    const a = anchors[acc.anchor];
    stamp(grid, acc.map, acc.colors, a.x + acc.dx, a.y + acc.dy);
  }

  // 10) 빗질 후 반짝이
  if (fluff >= 2) {
    grid.set(bcx - 4, bcy - bodyRy - 2, '#fff7a8');
    grid.set(hcx + 4, hcy - headR - 2, '#fff7a8');
    grid.set(bcx + 3, bcy - bodyRy - 3, '#ffffff');
  }

  return { grid, anchors, head: { x: hcx, y: hcy, r: headR }, body: { x: bcx, y: bcy } };
}


// 정면 모습: 화면을 바라보는 2등신 강아지 (좌우 대칭, 중심선 x = 24.5)
function buildDogFront(b, stage, opts) {
  const g = { ...STAGE_GEO[stage] };
  if (b.legs === 'short') g.leg = Math.max(2, g.leg - 3);
  if (b.legs === 'long') g.leg += 1;
  const fluff = opts.fluff ?? 0;
  const eyes = opts.eyes ?? 'open';
  const mouth = opts.mouth ?? 'closed';
  const grid = new Grid(DOG_W, DOG_H, dogPalette(b));
  const fuzzy = b.coat === 'curly' || b.coat === 'fluffy' || fluff > 0;
  const bumpR = b.coat === 'curly' ? 1.8 : 1.4;
  const extra = fluff * 0.6;
  const texture = b.coat === 'curly' ? 'curly' : b.coat === 'silky' ? 'silky' : null;
  const hcx = 24; // 왼쪽 눈 20~21, 오른쪽 눈 27~28
  const C = hcx + 0.5;
  const mirror = (x) => 2 * C - x;

  const bodyRx = g.bodyRy + 2.5 + (b.legs === 'short' ? 1 : 0) + extra * 0.5;
  const bodyRy = g.bodyRy + 1 + extra * 0.3;
  const bcy = GROUND - g.leg - bodyRy + 3;
  const headR = g.headR + (b.headFluff ? b.headFluff * 0.5 : 0);
  const hcy = Math.round(bcy - bodyRy - headR * 0.45 + 3 + (opts.headDy ?? 0));

  // 꼬리 (몸 뒤로 살짝 보여요, 살랑살랑)
  {
    const wag = opts.tail ? 2 : 0;
    const tx = C + bodyRx - 2 + wag;
    const ty = bcy - bodyRy + 1;
    const m = grid.mask();
    if (b.tail === 'plume') m.ellipse(tx + 1, ty - 2, 2.5 + extra, 3.5 + extra);
    else if (b.tail === 'curl') m.ellipse(tx, ty - 1, 3 + extra, 3 + extra);
    else if (b.tail === 'pompom') m.rect(tx - 1, ty - 1, 2, 3).ellipse(tx + 1, ty - 3, 2.5 + extra, 2.5 + extra);
    else m.ellipse(tx, ty + 1, 2, 2);
    grid.paint(m, 'fur', { texture: b.coat === 'curly' ? 'curly' : null });
  }

  // 뒷다리 (양옆)
  const legTop = Math.round(bcy + bodyRy - 4);
  for (const x of [Math.round(C - bodyRx + 1), Math.round(mirror(C - bodyRx + 1) - 3)]) {
    const m = grid.mask().rect(x, legTop, 3, GROUND - legTop + 1);
    grid.paint(m, 'far');
  }

  // 몸통 (+포메 갈기)
  let bodyMask;
  {
    const m = grid.mask().ellipse(C, bcy, bodyRx, bodyRy);
    if (fuzzy) m.bumps(C, bcy, bodyRx, bodyRy, 10 + fluff * 4, bumpR + extra * 0.5, 0, Math.PI);
    if (b.coat === 'fluffy') {
      m.ellipse(C, hcy + headR * 0.75, headR + 1.5 + extra, headR * 0.75 + extra);
      m.bumps(C, hcy + headR * 0.75, headR + 1.5 + extra, headR * 0.75 + extra, 12, 1.6 + extra * 0.5, 0, Math.PI);
    }
    grid.paint(m, 'fur', { texture });
    bodyMask = m;
    if (b.accent) {
      const chest = grid.mask().ellipse(C, bcy, bodyRx * 0.5, bodyRy * 0.85);
      for (let i = 0; i < chest.d.length; i++) if (chest.d[i] && !m.d[i]) chest.d[i] = 0;
      grid.paint(chest, 'acc', { outline: false });
    }
  }

  // 앞다리
  const bottomAcc = b.accent && b.legs === 'short';
  for (const x of [hcx - 4, hcx + 2]) {
    const m = grid.mask().rect(x, legTop, 3, GROUND - legTop + 1);
    grid.paint(m, 'fur');
    if (bottomAcc) grid.paint(grid.mask().rect(x, GROUND - 1, 3, 2), 'acc', { outline: false, flat: true });
  }

  // 말티즈의 길게 늘어진 털
  if (b.coat === 'silky') {
    const m = grid.mask();
    const top = Math.round(bcy);
    for (let x = Math.round(C - bodyRx + 1); x <= Math.round(C + bodyRx - 1); x++) {
      m.rect(x, top, 1, GROUND - 1 - top - (x % 3 === 0 ? 1 : 0));
    }
    grid.paint(m, 'fur', { texture: 'silky' });
  }

  // 뾰족귀 (머리 뒤에서 솟아요)
  const earBig = b.ear === 'pointyBig' ? 1.4 : b.ear === 'pointySmall' ? 0.7 : 1;
  const pointy = b.ear.startsWith('pointy');
  const earTip = [];
  if (pointy) {
    const ax = C - headR + 1.5; const ay = hcy - headR + 5;
    const bx = C - 2.5; const by = hcy - headR + 1.5;
    const px = C - headR + 1; const py = hcy - headR - 5 * earBig + 1;
    const m = grid.mask().tri(ax, ay, bx, by, px, py).tri(mirror(ax), ay, mirror(bx), by, mirror(px), py);
    grid.paint(m, 'fur', { flat: true });
    earTip.push([Math.round(px + 1.5), Math.round(py + 3)]);
  }

  // 머리
  {
    const m = grid.mask().ellipse(C, hcy, headR + 0.5 + extra * 0.4, headR * 0.9 + extra * 0.4);
    if (b.headFluff || fuzzy) {
      m.bumps(C, hcy - 0.5, headR + 0.5 + extra * 0.4, headR * 0.9 + extra * 0.4, 9 + fluff * 3 + (b.headFluff ?? 0) * 3,
        bumpR + (b.headFluff ? 0.4 : 0) + extra * 0.4, Math.PI * 0.95, Math.PI * 2.05);
    }
    grid.paint(m, 'fur', { texture: b.coat === 'curly' ? 'curly' : null });
    // 얼굴 가운데는 매끈하게 (표정이 잘 보이도록)
    if (b.coat === 'curly') {
      const face = grid.mask().ellipse(C, hcy + 1, headR - 2.5, headR * 0.7 - 0.5);
      grid.paint(face, 'fur', { outline: false, flat: true });
    }
    // 주둥이
    const long = b.snout === 'long' ? 1 : 0;
    const muzzle = grid.mask().ellipse(C, hcy + 3, 3.5 + long, 2.6);
    grid.paint(muzzle, b.accent ? 'acc' : 'furL', { outline: false, flat: !b.accent });
    if (!b.accent) for (let x = hcx - 2; x <= hcx + 3; x++) grid.set(x, hcy + 5, 'furS');
    if (b.accent) {
      const cheeks = grid.mask().ellipse(C - 4.5, hcy + 3, 2.5, 2).ellipse(C + 4.5, hcy + 3, 2.5, 2);
      for (let i = 0; i < cheeks.d.length; i++) if (cheeks.d[i] && !m.d[i]) cheeks.d[i] = 0;
      grid.paint(cheeks, 'acc', { outline: false });
    }
  }
  for (const [x, y] of earTip) {
    for (const [ex, ey] of [[x, y], [x, y + 1]]) {
      grid.set(ex, ey, 'earIn');
      grid.set(Math.round(mirror(ex + 0.5) - 0.5), ey, 'earIn');
    }
  }

  // 늘어진 귀 (양옆)
  if (!pointy && b.ear !== 'hidden') {
    const long = b.ear === 'longSilky' ? 7 : 5;
    const ex = C - headR - 0.5;
    const m = grid.mask().ellipse(ex, hcy + 3, 2.5 + extra * 0.3, long).ellipse(mirror(ex), hcy + 3, 2.5 + extra * 0.3, long);
    if (b.ear === 'longCurly') m.bumps(ex, hcy + 3, 2.5, long, 6, 1.2).bumps(mirror(ex), hcy + 3, 2.5, long, 6, 1.2);
    grid.paint(m, 'ear', { texture: b.ear === 'longCurly' ? 'curly' : b.ear === 'longSilky' ? 'silky' : null });
  }

  // 눈, 코, 입, 볼터치
  const ey = hcy - 1;
  const eyeXs = [hcx - 4, hcx + 3];
  for (const x of eyeXs) {
    if (eyes === 'happy') {
      grid.set(x - 1, ey + 1, 'eye'); grid.set(x, ey, 'eye'); grid.set(x + 1, ey, 'eye'); grid.set(x + 2, ey + 1, 'eye');
    } else if (eyes === 'closed') {
      for (let i = -1; i <= 2; i++) grid.set(x + i, ey + 1, 'eye');
    } else {
      for (let j = -1; j <= 1; j++) for (let i = 0; i < 2; i++) grid.set(x + i, ey + j, 'eye');
      grid.set(x, ey - 1, 'white');
    }
  }
  if (eyes === 'sad') {
    const [lx, rx] = eyeXs;
    grid.set(lx - 1, ey - 2, 'out'); grid.set(lx, ey - 3, 'out'); grid.set(lx + 1, ey - 3, 'out');
    grid.set(rx, ey - 3, 'out'); grid.set(rx + 1, ey - 3, 'out'); grid.set(rx + 2, ey - 2, 'out');
    grid.set(lx, ey + 2, 'tear');
  }
  const ny = hcy + 1;
  grid.set(hcx, ny, 'nose'); grid.set(hcx + 1, ny, 'nose'); grid.set(hcx, ny + 1, 'nose'); grid.set(hcx + 1, ny + 1, 'nose');
  grid.set(hcx - 1, ny, 'nose'); grid.set(hcx + 2, ny, 'nose');
  grid.set(hcx - 2, ny + 2, 'out'); grid.set(hcx - 1, ny + 3, 'out'); grid.set(hcx, ny + 2, 'out');
  grid.set(hcx + 1, ny + 2, 'out'); grid.set(hcx + 2, ny + 3, 'out'); grid.set(hcx + 3, ny + 2, 'out');
  if (mouth === 'open' || mouth === 'tongue') {
    grid.set(hcx, ny + 3, 'tongue'); grid.set(hcx + 1, ny + 3, 'tongue');
    if (mouth === 'tongue') { grid.set(hcx, ny + 4, 'tongue'); grid.set(hcx + 1, ny + 4, 'tongue'); }
  }
  grid.set(eyeXs[0] - 2, ey + 3, 'pink'); grid.set(eyeXs[0] - 1, ey + 3, 'pink');
  grid.set(eyeXs[1] + 2, ey + 3, 'pink'); grid.set(eyeXs[1] + 3, ey + 3, 'pink');

  // 액세서리
  const anchors = {
    head: { x: hcx + 1, y: Math.round(hcy - headR - (b.headFluff ? 1 : 0)) + (pointy ? 1 : 0) },
    neck: { x: hcx + 1, y: Math.round(hcy + headR * 0.85) },
    eye: { x: hcx, y: ey },
  };
  for (const slot of ['neck', 'face', 'head']) {
    const id = opts.equip?.[slot];
    const acc = id && ACCESSORIES[id];
    if (!acc) continue;
    const variant = FRONT_ACC[id] ?? acc;
    const a = anchors[acc.anchor];
    stamp(grid, variant.map, acc.colors, a.x + variant.dx, a.y + variant.dy);
  }
  if (fluff >= 2) {
    grid.set(Math.round(C - bodyRx) - 1, bcy - 3, '#fff7a8');
    grid.set(Math.round(C + headR) + 2, hcy - headR, '#fff7a8');
    grid.set(hcx - 7, hcy - headR - 1, '#ffffff');
  }
  return { grid, anchors, head: { x: hcx, y: hcy, r: headR }, body: { x: C, y: bcy } };
}

const cache = new Map();

// 캔버스로 만든 강아지 스프라이트 (캐시)
export function dogSprite(breed, stage, pose, opts = {}) {
  const key = [breed, stage, pose, opts.eyes, opts.mouth, opts.tail, opts.fluff, opts.headDy, JSON.stringify(opts.equip ?? {})].join('|');
  let spr = cache.get(key);
  if (!spr) {
    const built = buildDog(breed, stage, pose, opts);
    const c = document.createElement('canvas');
    c.width = DOG_W; c.height = DOG_H;
    built.grid.draw(c.getContext('2d'));
    spr = { canvas: c, anchors: built.anchors, head: built.head };
    cache.set(key, spr);
    if (cache.size > 600) cache.delete(cache.keys().next().value);
  }
  return spr;
}

// 정적인 초상화 (심리테스트 결과, 친구 목록 등) → dataURL
export function dogPortrait(breed, stage, opts = {}, pose = 'front') {
  const spr = dogSprite(breed, stage, pose, { eyes: 'happy', mouth: 'tongue', ...opts });
  return spr.canvas.toDataURL();
}

// ---------- 스티커 & 아이콘 (12x12) ----------
export const ICONS = {
  heart: { colors: { o: '#4a3330', r: '#ff5d7a', l: '#ffb3c1', w: '#ffffff' },
    map: ['.oo...oo..', 'orro.orro.', 'owlrorrrro', 'olrrrrrrro', 'orrrrrrrro', '.orrrrrro.', '..orrrro..', '...orro...', '....oo....'] },
  laugh: { colors: { o: '#4a3330', y: '#ffd54f', d: '#f0b429', r: '#ff6f8a', p: '#ff9fb2' },
    map: ['...oooo...', '..oyyyyo..', '.oyyyyyyo.', 'oyo.yyo.yo', 'oyyyyyyyyo', 'opyooooypo', 'oyyorroyyo', '.oyyooyyo.', '..oyyyyo..', '...oooo...'] },
  sweat: { colors: { o: '#2f6f9f', b: '#7cc7ff', w: '#ffffff', l: '#bfe6ff' },
    map: ['....o.....', '...obo....', '...obo....', '..obbbo...', '.obwbbbo..', '.owlbbbo..', 'obllbbbbo.', 'obbbbbbbo.', '.obbbbbo..', '..ooooo...'] },
  sparkle: { colors: { o: '#b8860b', y: '#ffe066', w: '#ffffff' },
    map: ['....o.....', '...oyo....', '...oyo....', '.ooywyoo..', 'oyywwwyyo.', '.ooywyoo..', '...oyo..o.', '...oyo.oyo', '....o...o.'] },
  surprise: { colors: { o: '#4a3330', y: '#ffd54f', d: '#4a3330', w: '#ffffff' },
    map: ['...oooo...', '..oyyyyo..', '.oyyyyyyo.', 'oywoyywoyo', 'oyooyyooyo', 'oyyyyyyyyo', 'oyyyooyyyo', '.oyyooyyo.', '..oyyyyo..', '...oooo...'] },
  sleepy: { colors: { o: '#3d4a8a', b: '#8fa8ff', w: '#dfe6ff' },
    map: ['.....ooooo', '.....obbbo', '.......obo', '......obo.', '.oooooobbo', '.obbbbooooo', '....obo...', '...obo....', '..obbbbo..', '..oooooo..'] },
  tear: { colors: { o: '#4a3330', y: '#ffd54f', b: '#7cc7ff', w: '#ffffff' },
    map: ['...oooo...', '..oyyyyo..', '.oyyyyyyo.', 'oyooyyooyo', 'oybyyyybyo', 'oybyyyybyo', 'oyyyooyyyo', '.oyoyyoyo.', '..oyyyyo..', '...oooo...'] },
  note: { colors: { o: '#4a3330', p: '#b07cff', l: '#d8bfff' },
    map: ['....oooooo', '....oppppo', '....oooopo', '....o...po', '....o...po', '..ooo.oopo', '.oppo.oppo', '.oppo.oppo', '..oo...oo.'] },
  coin: { colors: { o: '#8a5a2b', w: '#fff8e7', l: '#ffffff', d: '#e8d5b0' },
    map: ['.oo......oo.', 'owlo....owwo', 'owwwoooowwwo', '.owwwwwwwwo.', 'owwwoooowddo', 'owdo....odwo', '.oo......oo.'] },
  food: { colors: { o: '#4a3330', r: '#e85d75', l: '#ff8fa3', b: '#b5651d', y: '#f2c078' },
    map: ['..........', '...ybyby..', '..ybybyby.', 'oooooooooo', 'orrlrrrrro', '.orrrrrro.', '..oooooo..'] },
  brush: { colors: { o: '#4a3330', w: '#c68642', l: '#e0a96d', g: '#dddddd', p: '#ff9fb2' },
    map: ['.oooooo...', 'ogogogo...', 'ogogogo...', 'oppppppo..', 'oppppppo..', '.oooowwo..', '....owwo..', '....owlo..', '....owwo..', '.....oo...'] },
  paw: { colors: { o: '#4a3330', p: '#ff9fb2', b: '#8b5e3c' },
    map: ['.oo...oo..', 'obbo.obbo.', 'obbo.obbo.', '.oo...oo..', '...ooo....', '..obbbo...', '.obbbbbo..', '.obbbbbo..', '..ooooo...'] },
  sound: { colors: { o: '#4a3330', w: '#fff6e6', b: '#5bc0ff' },
    map: ['...o......', '..oo..b...', 'oooo...b..', 'owwo.b..b.', 'owwo..b.b.', 'owwo.b..b.', 'oooo...b..', '..oo..b...', '...o......'] },
  mute: { colors: { o: '#4a3330', w: '#fff6e6', r: '#e84a5f' },
    map: ['...o......', '..oo......', 'oooo.r...r', 'owwo..r.r.', 'owwo...r..', 'owwo..r.r.', 'oooo.r...r', '..oo......', '...o......'] },
  star: { colors: { o: '#b8860b', y: '#ffd23f', l: '#fff3a0' },
    map: ['....o.....', '...oyo....', 'oooylyooo.', 'oyyyyyyyo.', '.oyyyyyo..', '..oyyyo...', '.oyyoyyo..', '.oyo.oyo..', '.oo...oo..'] },
};

const iconCache = new Map();
export function iconCanvas(id, scale = 1) {
  const key = `${id}:${scale}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const icon = ICONS[id];
  const w = Math.max(...icon.map.map((r) => r.length));
  const h = icon.map.length;
  const grid = new Grid(w, h, {});
  stamp(grid, icon.map, icon.colors, 0, 0);
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  grid.draw(ctx);
  iconCache.set(key, c);
  return c;
}

export function iconURL(id, scale = 4) {
  return iconCanvas(id, scale).toDataURL();
}

// 액세서리 단독 미리보기 (상점)
export function accessoryURL(id, scale = 4) {
  const acc = ACCESSORIES[id];
  if (!acc) return null;
  const w = Math.max(...acc.map.map((r) => r.length));
  const grid = new Grid(w, acc.map.length, {});
  stamp(grid, acc.map, acc.colors, 0, 0);
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = acc.map.length * scale;
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  grid.draw(ctx);
  return c.toDataURL();
}
