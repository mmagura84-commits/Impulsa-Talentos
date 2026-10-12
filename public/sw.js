/* global self, fetch, Response, URL, caches */
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
 *      with no cache flush needed after a deploy. Both requests go out at the
 *      same time (using the build seen last time), so a visit costs one round
 *      trip, not two; only right after a deploy is the page fetched again;
 *   3. offline, it falls back to whatever the browser has saved.
 * The address bar keeps the original URL. Scripts, styles, images and API
 * calls are untouched (content-hashed /assets are meant to be cached).
 */
const VERSION_TTL_MS = 30_000
const META_CACHE = 'it-meta'
const META_KEY = '/__live-build'
let live = { build: '', at: 0 }

/* The worker is stopped between visits, so the last build seen is also kept in
   Cache Storage: the next visit can start loading the page right away. */
async function rememberedBuild() {
  if (live.build) return live.build
  try {
    const res = await (await caches.open(META_CACHE)).match(META_KEY)
    const b = res ? (await res.text()).trim() : ''
    return /^[0-9a-f]{6,40}$/.test(b) ? b : ''
  } catch { return '' }
}

async function liveBuild() {
  if (live.build && Date.now() - live.at < VERSION_TTL_MS) return live.build
  try {
    const res = await fetch(`/version.json?b=${Date.now()}`, { cache: 'no-store' })
    if (res.ok) {
      const v = await res.json()
      if (typeof v.build === 'string' && /^[0-9a-f]{6,40}$/.test(v.build)) {
        if (v.build !== live.build) caches.open(META_CACHE).then((c) => c.put(META_KEY, new Response(v.build))).catch(() => {})
        live = { build: v.build, at: Date.now() }
      }
    }
  } catch { /* offline: keep the last answer */ }
  return live.build
}

const stripBuild = (href) => {
  const u = new URL(href)
  u.searchParams.delete('_b')
  return u.toString()
}

// A navigate-mode Request can't be re-issued with new options; fetch by URL.
const fetchPage = (url, build) => {
  const u = new URL(url)
  if (build) u.searchParams.set('_b', build)
  return fetch(u.toString(), { cache: 'no-store', credentials: 'same-origin' })
}
// Navigations must not receive a followed redirect; hand the browser the hop.
const finish = (res) => (res.redirected ? Response.redirect(stripBuild(res.url), 302) : res)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.mode !== 'navigate' || req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  url.searchParams.delete('_b')
  event.respondWith((async () => {
    try {
      if (live.build && Date.now() - live.at < VERSION_TTL_MS) return finish(await fetchPage(url, live.build))
      // Ask which build is live and, at the same time, start loading the page
      // as the build seen last time (almost always still the live one).
      const guess = await rememberedBuild()
      const asked = liveBuild()
      if (!guess) return finish(await fetchPage(url, await asked))
      const early = fetchPage(url, guess)
      early.catch(() => {})
      const build = await asked
      if (!build || build === guess) return finish(await early)
      early.then((r) => r.body && r.body.cancel()).catch(() => {})
      return finish(await fetchPage(url, build)) // a deploy happened since: the new build
    } catch {
      return fetch(req) // offline: whatever the browser has saved
    }
  })())
})
