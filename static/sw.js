// Offline support: network-first for pages, stale-while-revalidate for assets.
// Third-party requests (ads, analytics) are never cached.
const CACHE = 'calc-__VERSION__';
const BASE = '__BASE__';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([BASE, `${BASE}assets/style.css`, `${BASE}icon.svg`])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(url.pathname, copy));
      return res;
    }).catch(() => caches.match(url.pathname).then((r) => r || caches.match(BASE))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const cached = await c.match(req);
    const net = fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || net;
  }));
});
