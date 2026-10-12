/* global self, fetch, Response, URL */
/*
 * Impulsa Talentos service worker: always-current pages.
 *
 * Hostinger sends "Cache-Control: max-age=31536000" on every file, HTML
 * included, and its CDN keeps each page until someone flushes it. This
 * worker only handles page loads (navigations):
 *   1. it asks /version.json (a unique URL each time, so never cached) which
 *      build is live, remembering the answer for 30 seconds;
 *   2. it fetches the page as /path?_b=<build>: a new build means a new URL,
 *      so neither the browser's saved copy nor the CDN's old copy can answer,
 *      with no cache flush needed after a deploy;
 *   3. offline, it falls back to whatever the browser has saved.
 * The address bar keeps the original URL. Scripts, styles, images and API
 * calls are untouched (content-hashed /assets are meant to be cached).
 */
const VERSION_TTL_MS = 30_000
let live = { build: '', at: 0 }

async function liveBuild() {
  if (live.build && Date.now() - live.at < VERSION_TTL_MS) return live.build
  try {
    const res = await fetch(`/version.json?b=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const v = await res.json()
      if (typeof v.build === 'string' && /^[0-9a-f]{6,40}$/.test(v.build)) live = { build: v.build, at: Date.now() }
    }
  } catch { /* offline: keep the last answer */ }
  return live.build
}

const stripBuild = (href) => {
  const u = new URL(href)
  u.searchParams.delete('_b')
  return u.toString()
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  event.respondWith((async () => {
    try {
      const build = await liveBuild()
      if (build) url.searchParams.set('_b', build)
      // A navigate-mode Request can't be re-issued with new options; fetch by URL.
      const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'same-origin' })
      // Navigations must not receive a followed redirect; hand the browser the hop.
      return res.redirected ? Response.redirect(stripBuild(res.url), 302) : res
    } catch {
      return fetch(req) // offline: whatever the browser has saved
    }
  })())
})
