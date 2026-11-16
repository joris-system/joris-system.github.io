/* JORIS guide file — keeps the guide's app on the phone, so it opens with no signal.
   The documents are kept separately, in IndexedDB, by the page.
   · the page itself: network first, so a new version reaches everyone; the
     saved copy only when there is no signal;
   · everything else (styles, scripts, the PDF reader): the saved copy, with
     a fresh one fetched behind it for next time;
   · the server: never touched here. */
const CACHE = 'jor-office-guide-v1';
const SHELL = ['./', './index.html', './guide.js', './gf.js', './style.css', '../core/brand.js', '../core/config.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && /^jor-office-guide-/.test(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  const page = req.mode === 'navigate' || /\/$|\.html$|\/config\.js$/.test(url.pathname);
  if (page) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.origin + url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(url.origin + url.pathname).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (url.origin !== location.origin && url.hostname !== 'cdn.jsdelivr.net') return;
  e.respondWith(caches.match(req).then(hit => {
    const fresh = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    if (hit) { fresh.catch(() => {}); return hit; }
    return fresh;
  }));
});
