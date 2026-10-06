// Service worker: muestra las notificaciones, permite instalar la app y la guarda en cada dispositivo.
// La app (la "cáscara": HTML, JS, íconos) se sirve desde lo guardado: abrirla no gasta tráfico de Netlify.
// Los datos siempre se piden en vivo a Supabase.
// IMPORTANTE: en cada actualización hay que cambiar CACHE (v22 → v23…). Así los dispositivos detectan la versión
// nueva, la descargan una sola vez y se recargan solos cuando nadie está usando la app.
const CACHE = 'bviv-v22';
const SHELL = ['./', 'index.html', 'app.js', 'docs.js', 'sirena.js', 'grados.js', 'alertas.js', 'help.js', 'calif.js', 'legajo.js', 'tareas.js', 'sci.js', 'epp.js', 'vendor/pdf-lib.min.js', 'config.js', 'manifest.webmanifest', 'icons/escudo-128.png', 'icons/escudo-400.png', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero lo guardado; si no está (algo nuevo), la red, y se guarda.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.match('./', { cacheName: CACHE }).then(r => r || fetch(e.request)).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { cacheName: CACHE, ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return res;
  })));
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
