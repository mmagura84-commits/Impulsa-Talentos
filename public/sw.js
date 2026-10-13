/* global self, caches */
/*
 * Impulsa Talentos service worker — retired, and this file is what retires it.
 *
 * It used to handle every page load: ask /version.json which build was live,
 * then fetch the page as /path?_b=<build> with `no-store`. That was the only
 * way to get past a host which sent "Cache-Control: max-age=31536000" on HTML
 * and ignored .htaccess. Pages now carry their own headers (an index.php beside
 * each one, written by scripts/finalize-static-build.mjs), so the host keeps
 * them fresh by itself and the worker only cost time: measured on the live
 * site, a page took 1087 ms to first byte through the worker and 152 ms
 * without it, because the worker sat in front of the navigation doing two
 * round trips of its own — and its `no-store` fetch also stopped the browser
 * from ever reusing a page it already had.
 *
 * A worker cannot simply be deleted: a browser that installed one keeps using
 * it until something unregisters it. So this file stays at /sw.js and does
 * exactly that. It claims control, throws away the caches the old worker kept,
 * and unregisters itself. It has no fetch handler, so from this moment on
 * navigations go straight to the network — nothing sits in front of them.
 *
 * Pages also unregister any worker they find (see FRESH_SCRIPT in
 * scripts/finalize-static-build.mjs), which is the faster of the two paths;
 * this file catches anyone whose browser checks for a worker update first.
 */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim()
      for (const key of await caches.keys()) {
        if (key.startsWith('it-')) await caches.delete(key)
      }
    } catch { /* nothing here is worth failing over */ }
    // Last, so the clean-up above still runs with a live registration.
    try { await self.registration.unregister() } catch { /* already gone */ }
  })())
})
