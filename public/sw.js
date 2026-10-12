/* global self, fetch, Response, URL */
/*
 * Impulsa Talentos service worker: always-fresh pages.
 *
 * Hostinger sends "Cache-Control: max-age=31536000" on every file, HTML
 * included, and the plan ignores .htaccess headers, so browsers keep a page
 * for a year and show old content after a deploy. This worker only handles
 * page loads (navigations): it fetches the page from the network, skipping
 * the browser's saved copy, and falls back to the saved copy when offline.
 * Scripts, styles, images and API calls are untouched (content-hashed /assets
 * are meant to be cached).
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    try {
      // A navigate-mode Request can't be re-issued with new options; fetch by URL.
      const res = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' })
      // Navigations must not receive a followed redirect; hand the browser the hop.
      return res.redirected ? Response.redirect(res.url, 302) : res
    } catch {
      return fetch(req) // offline: whatever the browser has saved
    }
  })())
})
