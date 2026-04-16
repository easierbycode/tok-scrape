// tok-scrape service worker.
// Precaches the PWA shell and serves it cache-first; network-first for
// everything else (falls back to cache when offline).

var CACHE_VERSION = 'tok-scrape-v1';
var SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // addAll is atomic: if any request 404s the install fails, so keep the
      // list tight and relative to the SW scope.
      return cache.addAll(SHELL);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_VERSION) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Only handle same-origin requests; let cross-origin (Google Sheets POST,
  // Graylog, TikTok) fall through to the network untouched.
  if (url.origin !== self.location.origin) return;

  // Cache-first for the shell; stale-while-revalidate for everything else
  // under our scope (e.g. linked ../apps-script/Code.gs in docs).
  var shellMatch = SHELL.some(function (s) {
    return new URL(s, self.location.href).pathname === url.pathname;
  });

  if (shellMatch) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_VERSION).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(function (cache) {
      return fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () {
        return cache.match(req);
      });
    })
  );
});
