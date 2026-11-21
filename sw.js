// Recordly service worker: offline app shell + offline reminder notifications.
const CACHE = 'recordly-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});

// ---- reminder notifications (work with no internet: the app saves a snapshot on the phone) ----
function idbOpen() {
  return new Promise((res, rej) => { const q = indexedDB.open('recordly-rem', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function kvGet(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => { db.close(); res(r.result); }; r.onerror = () => rej(r.error); });
}
async function kvSet(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => { db.close(); res(); }; t.onerror = () => rej(t.error); });
}
async function checkDue() {
  let snap; try { snap = await kvGet('snap'); } catch (e) { return; }
  if (!snap || !snap.on || !Array.isArray(snap.items)) return;
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;
  let shown = {}; try { shown = (await kvGet('shown')) || {}; } catch (e) {}
  const now = Date.now(); let changed = false;
  for (const it of snap.items) {
    if (it.when <= now && now - it.when < 36 * 3600e3 && !shown[it.tag]) {
      try {
        await self.registration.showNotification(it.title, { body: it.body, tag: it.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: it.url || '#/notifications' } });
        shown[it.tag] = now; changed = true;
      } catch (e) {}
    }
  }
  for (const k of Object.keys(shown)) if (now - shown[k] > 20 * 864e5) { delete shown[k]; changed = true; }
  if (changed) { try { await kvSet('shown', shown); } catch (e) {} }
}
self.addEventListener('periodicsync', e => { if (e.tag === 'recordly-reminders') e.waitUntil(checkDue()); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'check') e.waitUntil(checkDue()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#/notifications';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.postMessage({ type: 'goto', hash }); return c.focus(); } }
    return self.clients.openWindow(new URL('./' + hash, self.registration.scope).href);
  }));
});
