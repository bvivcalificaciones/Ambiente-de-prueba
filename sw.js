// Service worker: muestra las notificaciones y permite instalar la app.
// Los datos siempre se piden en vivo; solo se guarda la "cáscara" para abrir rápido.
const CACHE = 'bviv-v17';
const SHELL = ['./', 'index.html', 'app.js', 'docs.js', 'sirena.js', 'grados.js', 'alertas.js', 'help.js', 'calif.js', 'legajo.js', 'sci.js', 'epp.js', 'vendor/pdf-lib.min.js', 'config.js', 'manifest.webmanifest', 'icons/escudo-128.png', 'icons/escudo-400.png', 'icons/icon-192.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para tener siempre la última versión); si no hay conexión, lo guardado.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});

// Las alertas (amarilla/roja) quedan fijas en pantalla, vibran largo y avisan a la app abierta para que suene el tono.
const VIB = { alerta_amarilla: [600, 200, 600, 200, 600, 600, 600, 200, 600, 200, 600], alerta_roja: [1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000] };
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { titulo: 'Bomberos Isla Verde', cuerpo: e.data && e.data.text() }; }
  const alerta = !!VIB[d.clase];
  const opts = { body: d.cuerpo || '', icon: 'icons/icon-192.png', badge: 'icons/favicon.png', lang: 'es-AR', tag: alerta ? 'alerta' : d.titulo, renotify: true, data: { tab: alerta ? 'alertas' : null } };
  if (alerta) Object.assign(opts, { requireInteraction: true, vibrate: VIB[d.clase], silent: false });
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.titulo || 'Bomberos Isla Verde', opts),
    alerta ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => ws.forEach(w => w.postMessage({ tipo: 'alerta', clase: d.clase }))) : null
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = e.notification.data && e.notification.data.tab;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if ('focus' in w) { if (tab) w.postMessage({ tipo: 'abrir', tab }); return w.focus(); }
    return self.clients.openWindow(tab ? './?tab=' + tab : './');
  }));
});
