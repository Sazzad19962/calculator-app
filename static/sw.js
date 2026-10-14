// Offline support: network-first for pages (falls back to the cached copy, then an offline page),
// cache-first for versioned assets, network-first for the rest. Third-party requests (ads, analytics) are never cached.
const CACHE = 'calc-__VERSION__';
const BASE = '__BASE__';
const OFFLINE = `${BASE}offline.html`;
const PRECACHE = [BASE, OFFLINE, `${BASE}icon.svg`, `${BASE}icon-192.png`, `${BASE}manifest.webmanifest`];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('calc-') && k !== CACHE).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = (await e.preloadResponse) || (await fetch(req));
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(url.pathname, copy)));
        }
        return res;
      } catch {
        const c = await caches.open(CACHE);
        const page = await c.match(url.pathname);
        if (page) return page;
        const off = await c.match(OFFLINE);
        // The offline page is shown at any URL, so give it absolute links to the site root.
        return off ? new Response((await off.text()).replace(/%BASE%/g, BASE), { headers: { 'Content-Type': 'text/html; charset=utf-8' } }) : Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    // Versioned files (?v=build) never change: cache-first. Everything else (e.g. ES modules imported
    // without a version) is network-first so a deploy can never mix old and new modules.
    const immutable = url.searchParams.has('v');
    const cached = immutable ? await c.match(req) : null;
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') e.waitUntil(c.put(req, res.clone()));
      return res;
    } catch {
      return (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) || Response.error();
    }
  })());
});
