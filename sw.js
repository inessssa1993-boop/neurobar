// Service worker: работа офлайн после первой загрузки.
// Стратегия «сеть сначала, кэш как запасной»: если сеть есть, всегда берём свежие файлы (правки видны сразу),
// если сети нет или она медленнее 2,5 с — отдаём из кэша.
const V = 'neurobar-v45';
const FILES = ['./', 'index.html', 'manifest.json', 'assets/style.css', 'assets/fonts/Coil-Regular.otf', 'assets/fonts/Coil-Medium.otf',
  'assets/fonts/CormorantGaramond-cyr.woff2', 'assets/fonts/CormorantGaramond-lat.woff2',
  'assets/app.js', 'assets/engine.js', 'assets/cocktails.js', 'assets/idle.jpg', 'assets/touch.mp4', 'assets/bg.jpg', 'assets/icon.png',
  'assets/cocktails/strawberry.webp', 'assets/cocktails/lavender.webp', 'assets/cocktails/dew.webp', 'assets/cocktails/sour.webp'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(V);
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(req, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
      if (r.ok) cache.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
