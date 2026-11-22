/* Service worker: game bisa dibuka offline setelah pertama kali dimuat.
   File game memakai "jaringan dulu" (selalu versi terbaru saat online), cache hanya cadangan offline.
   Kalau mengubah ikon/manifest dan tidak muncul, naikkan VERSI. */
const VERSI = 'wpl-v3-7';
const INTI = ['./', 'index.html', 'style.css', 'config.js', 'game.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png'];
const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSI);
    await Promise.all(INTI.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    try { await c.add(new Request(THREE_CDN, { mode: 'no-cors' })); } catch (_) {}   // simpan three.js agar jalan offline
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSI) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const sama = u.origin === location.origin;
  if (!sama && u.href !== THREE_CDN) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSI);
    if (!sama) {                                           // three.js: cache dulu
      const hit = await c.match(r);
      if (hit) return hit;
      const res = await fetch(r);
      if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
      return res;
    }
    try {                                                  // file sendiri (termasuk kota.json): jaringan dulu
      const res = await fetch(r, { cache: 'no-cache' });
      if (res && res.ok) c.put(r, res.clone());
      return res;
    } catch (_) {
      const hit = await c.match(r, { ignoreSearch: true });
      return hit || (r.mode === 'navigate' ? c.match('index.html') : Response.error());
    }
  })());
});
