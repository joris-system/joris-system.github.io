/* JOR Shows — opens with no signal. The page's own files are kept on the phone (the list is
   written by build.js, with each file's stamp, so a new build is fetched once and kept).
   Nothing from the server is kept here: the page keeps its data itself. */
const V = '566600275a';
const FILES = ["./","index.html","style.css?v=56cf0238","shows.css?v=1081642c","config.js?v=977a8498","brand.js?v=805730c9","rules.js?v=90fd0df8","dates.js?v=9f278441","qrcode.js?v=accc1969","world.js?v=b7d6d352","ui.js?v=d469f3cb","api.js?v=ead4dae0","app.js?v=f9ae3f28","icon-192.png","icon-512.png","manifest.webmanifest"];
self.addEventListener('install', e => { e.waitUntil(caches.open('jor-shows-' + V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== 'jor-shows-' + V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  /* The page itself: the network first (a new build shows at once), the kept copy with no signal. */
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open('jor-shows-' + V).then(x => x.put('./', c)); return r; }).catch(() => caches.match('./'))); return; }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
