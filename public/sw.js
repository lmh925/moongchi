// 멍뭉고치 서비스 워커: 앱처럼 설치되고, 인터넷이 끊기면 안내 화면을 보여 줘요.
// 게임 데이터는 서버가 판정하므로 오프라인 플레이는 없어요. 화면 파일만 빠르게 불러요.
const CACHE = 'meongmung-v1';
const SHELL = ['/offline.html', '/icons/icon-192.png', '/fonts/Galmuri11.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  // 페이지: 늘 새로 받고(업데이트 바로 반영), 안 되면 오프라인 안내
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // 버전 주소(/v/<빌드>/...)는 내용이 절대 안 바뀌어요 → 한 번 받으면 캐시에서
  if (url.pathname.startsWith('/v/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
  }
});
