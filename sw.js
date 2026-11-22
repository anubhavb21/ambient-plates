// Offline cache: after the first visit the monitor's browser keeps the whole app and opens it from its own storage.
// Same-site files: served from the cache at once, refreshed from the network in the background (stale-while-revalidate).
// Other sites (live weather, live photos): network only; the app already falls back when they are unreachable.
// Bump VERSION whenever the file list changes so old copies are cleared.
const VERSION = 'ambient-plates-v2';
const CORE = [
  './', 'index.html', 'style.css', 'engine.js', 'app.js', 'painted.js', 'sources.js',
  'photos/data.js', 'fonts/fonts.css',
  'themes/anime.js', 'themes/comic.js', 'themes/cyber.js', 'themes/cosmic.js', 'themes/weather.js', 'themes/gallery.js',
  'fonts/Fraunces-italic.woff2', 'fonts/Fraunces-normal.woff2', 'fonts/IBMPlexMono-normal.woff2', 'fonts/InstrumentSans-normal.woff2',
  'fonts/Anime-Quicksand.woff2', 'fonts/Comic-Bangers.woff2', 'fonts/Cyber-Orbitron.woff2', 'fonts/Cosmic-Exo2.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);   // about 1 MB; photos are cached the first time each one is shown
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // weather, live photos: network as usual
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const update = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(update); return hit; }
    const res = await update;
    return res || new Response('', { status: 504 });
  })());
});
