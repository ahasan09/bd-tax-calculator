// Service worker: lets the calculator open and work with no connection.
// Built by pwa/offline-plugin.ts — the two placeholders below are filled in
// with the build's file list and a hash of their contents, so every deploy
// gets a fresh cache and the previous one is deleted.
//
// Only the app's own files are cached. Nothing the user types is ever stored.

const VERSION = '__VERSION__';
const CACHE = 'bdtax-' + VERSION;
const FILES = __FILES__;            // paths relative to the worker's scope
const PAGE = new URL('index.html', self.registration.scope).href;
const NETWORK_TIMEOUT_MS = 4000;
// Ignore Vary: hosts differ (Vite's preview sends "Vary: Origin", and the
// page's module script is requested with an Origin header), and these are
// static, content-hashed files, so the header adds nothing but misses.
const MATCH = { ignoreVary: true };

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      // One bundle, no lazy chunks: the new version can take over at once.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith('bdtax-') && key !== CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  } else {
    // Built assets have content-hashed names, so a cached copy is never stale.
    event.respondWith(caches.match(request, MATCH).then(hit => hit || fetch(request)));
  }
});

// The page: newest from the network when online; the cached copy when offline
// or when the network is too slow. The cached page is never replaced here —
// it must stay paired with the cached scripts of the same version.
async function pageNetworkFirst(request) {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS))
    ]);
    if (response.ok) return response;
    throw new Error('HTTP ' + response.status);
  } catch (error) {
    const cached = await caches.match(PAGE, MATCH);
    if (cached) return cached;
    throw error;
  }
}
