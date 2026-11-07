const CACHE = 'natasha-v2';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest', '/offline.html', '/icon-192.png', '/icon-512.png'];
// Cloudflare Pages redirects /index.html -> / and /offline.html -> /offline. A redirected response can't be
// served to a navigation request, so store a clean copy.
const clean = async r => r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(async u => {
    const r = await fetch(u, { cache: 'reload' });
    if (r.ok) await c.put(u, await clean(r));
  }))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  // Network first so edits made on GitHub show up right after a deploy; cache is the offline fallback.
  e.respondWith(fetch(req).then(async r => {
    if (r.ok) { const copy = await clean(r.clone()); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => caches.match(req)));
});
