// 🐾 카페 손님 도트 그림 (16x16). 왼쪽 절반만 그리고 좌우를 뒤집어 붙여요.
// o 외곽선 · e 눈 · w 흰색 · p 볼/코(분홍) · 나머지는 동물마다 색
const O = '#4a3330';
const mirror = (half) => half.map((r) => r + [...r].reverse().join(''));

const CRITTERS = {
  cat: {
    colors: { o: O, f: '#f2a65a', d: '#d9803a', l: '#fff1dc', p: '#ff9fb2', e: '#2b2b2b', w: '#ffffff' },
    half: ['........', '.o......', '.oo.....', '.odo....', '.opdoooo', '.offffff', 'offfffff', 'offdffff', 'offeffff',
      'ofpwffff', 'offfffll', '.offffll', '..ooooop', '..ofllll', '.offllll', '.ofoooll', '..o...oo'],
  },
  bunny: {
    colors: { o: O, f: '#f4f1ee', d: '#d9d2cc', l: '#ffffff', p: '#ffb3c6', e: '#2b2b2b', w: '#ffffff' },
    half: ['...oo...', '..opfo..', '..opfo..', '..opfo..', '..opfo..', '..ofoooo', '.offffff', 'offfffff', 'offeffff',
      'ofpeffff', 'offfffll', '.offfflp', '..oooooo', '..ofllll', '.offllll', '.ofoooll', '..o...oo'],
  },
  hamster: {
    colors: { o: O, f: '#e9a55b', d: '#c9803a', l: '#fff6e6', p: '#ff9fb2', e: '#2b2b2b', w: '#ffffff' },
    half: ['........', '........', '........', '.oo.....', 'opdooooo', 'odffffff', 'offfffff', 'offeffll', 'offeflll',
      'ofplllll', 'ofllllll', '.ollllll', '..oooopp', '..olllll', '.offllll', '.ofoooll', '..o...oo'],
  },
  duck: {
    colors: { o: O, f: '#ffe066', d: '#f2c230', l: '#fff6b0', p: '#ff9f43', e: '#2b2b2b', w: '#ffffff' },
    half: ['........', '....oooo', '...offff', '..offfff', '..offfff', '.offeffl', '.offeffo', '.ofpfoop', '.offfopp',
      '..offoop', '..ooffff', '.offffff', 'offdffff', 'offdffff', '.offfffl', '..oooooo', '....o.oo'],
  },
  penguin: {
    colors: { o: O, f: '#3b4a6b', d: '#2a3552', l: '#ffffff', p: '#ffb347', e: '#2b2b2b', w: '#ffffff' },
    half: ['........', '....oooo', '...offff', '..offfff', '..offlll', '.offllll', '.oflelll', '.oflelll', '.offlloo',
      '..offlop', '..offloo', '.offflll', 'ofdfllll', 'ofdfllll', '.offllll', '..oooooo', '...op.op'],
  },
  panda: {
    colors: { o: O, f: '#ffffff', d: '#e6e6e6', l: '#ffffff', b: '#2f2f35', p: '#ffb3c6', e: '#ffffff', w: '#ffffff' },
    half: ['........', '........', '.oo.....', 'obbo....', 'obbooooo', '.offffff', 'offfffff', 'ofbbffff', 'obebffff',
      'obbpffff', 'offfffff', '.offfffb', '..oooooo', '..obbfff', '.obbbfff', '.obooofl', '..o...oo'],
  },
  fox: {
    colors: { o: O, f: '#f07a2e', d: '#c95a18', l: '#ffffff', p: '#2b2b2b', e: '#2b2b2b', w: '#ffffff' },
    half: ['o.......', 'oo......', 'odo.....', 'oddo....', 'olffoooo', 'offfffff', 'offfffff', 'offeffff', 'offeffff',
      '.olfffff', '..ollfff', '...ollll', '....ooop', '..offlll', '.offflll', '.ofoooll', '..o...oo'],
  },
  owl: {
    colors: { o: O, f: '#a9744a', d: '#7a5234', l: '#f3dcb8', p: '#ffb347', e: '#2b2b2b', w: '#ffffff' },
    half: ['........', '.o......', '.oo.....', '.ofoooo.', '.offffff', 'ofwwwwff', 'owwwwwwf', 'owweewwf', 'owweewwf',
      'ofwwwwfo', 'offfffop', '.ofdlflo', '.ofldlfl', '.ofdlfll', '.offllll', '..oooooo', '....op.o'],
  },
  unicorn: {
    colors: { o: O, f: '#ffffff', d: '#e8e0f5', l: '#ffffff', m: '#ff9fd6', n: '#9fd8ff', y: '#ffd23f', p: '#ffb3c6', e: '#2b2b2b', w: '#ffffff' },
    half: ['.......o', '......oy', '.o....oy', '.omo..oy', '.omnnooo', '.onffffm', 'omffffff', 'onfeffff', 'offeffff',
      'ofpfffff', 'offfffff', '.offffff', '..oooooo', '..offfff', '.offffff', '.ofooopf', '..o...oo'],
  },
};

const cache = new Map();

export function critterCanvas(id, scale = 4) {
  const key = `${id}:${scale}`;
  if (cache.has(key)) return cache.get(key);
  const cr = CRITTERS[id];
  if (!cr) return null;
  const map = mirror(cr.half);
  const c = document.createElement('canvas');
  c.width = 16 * scale; c.height = map.length * scale;
  const ctx = c.getContext('2d');
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = cr.colors[ch] ?? ch;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  cache.set(key, c);
  return c;
}

export function critterURL(id, scale = 4) {
  return critterCanvas(id, scale)?.toDataURL() ?? '';
}

// <img> 한 장 (없으면 물음표)
export function critterImg(id, { cls = '', alt = '' } = {}) {
  const img = document.createElement('img');
  img.className = `pixel critter ${cls}`.trim();
  img.alt = alt;
  img.src = critterURL(id);
  return img;
}
