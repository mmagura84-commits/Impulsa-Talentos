/**
 * Flatten the TanStack Start build into a static `dist/` that Blink hosting serves.
 *
 * TanStack Start's `vite build` (configured with `build.outDir: '.vite-out'`)
 * emits:
 *   .vite-out/client/   ← prerendered HTML + assets (what we want, STATIC)
 *   .vite-out/server/   ← SSR Nitro server (NOT used by Blink's static S3 hosting)
 *
 * Blink uploads `dist/` and serves `dist/index.html` (see src/constants/publish.ts
 * BUILD_PATHS['vite-react'] = 'dist'). So we copy `.vite-out/client/*` up into a
 * flat `dist/` and drop the server.
 *
 * Why build into `.vite-out` instead of `dist/` directly: the platform pre-injects
 * `dist/.../​_redirects` (the SPA fallback) owned by another user, and Start's client
 * build tries to EMPTY its out dir first → `EACCES: unlink _redirects`. Building into
 * a clean temp dir avoids that entirely; here we only COPY into `dist/` (never delete),
 * so a pre-existing read-only `_redirects` is tolerated.
 *
 * ── IMPORTANT ──
 * The platform's pre-injected `_redirects` uses a catch-all `/* /index.html 200` that
 * overrides ALL prerendered static pages (e.g. `/jobs/<id>/index.html`). This causes
 * job detail URLs to serve the root `index.html` instead of their prerendered content.
 * To fix this, we generate our OWN `_redirects` after the copy that lists ONLY the
 * SPA-only routes (auth-protected dashboards) — all prerendered paths are served as
 * static files because NO redirect rule matches them.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const SRC = '.vite-out/client'
const DEST = 'dist'

if (!existsSync(SRC)) {
  console.error(`[finalize] build output missing: ${SRC} — did "vite build" run?`)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

for (const entry of readdirSync(SRC)) {
  const source = join(SRC, entry)
  const target = join(DEST, entry)
  let copied = false
  let lastError
  // Build output can still be flushed by the prerenderer on slower filesystems;
  // retry transient ENOENT rather than publishing a partial tree.
  for (let attempt = 1; attempt <= 3 && !copied; attempt++) {
    try {
      if (!existsSync(source)) throw Object.assign(new Error(`missing source ${source}`), { code: 'ENOENT' })
      cpSync(source, target, { recursive: true, force: true })
      copied = true
    } catch (e) {
      lastError = e
      if (e.code === 'ENOENT' && attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
  if (!copied) {
    const e = lastError

    // ONLY the platform-pre-injected `_redirects` may be skipped: it's read-only,
    // already in dist/, and byte-identical to ours. ANY other failed entry (assets/,
    // index.html, route html) would leave dist/index.html pointing at missing or
    // stale hashed assets — a silently broken deployment. Fail the build instead.
    if (entry === '_redirects') {
      console.warn(`[finalize] skip ${entry}: ${e.code || e.message} (pre-injected, identical content)`)
    } else {
      console.error(`[finalize] FAILED copying ${entry} into dist/: ${e.code || e.message} — aborting (a partial dist/ deploys broken)`)
      process.exit(1)
    }
  }
}

rmSync('.vite-out', { recursive: true, force: true })

// ── Generate explicit _redirects (overrides platform's catch-all) ──
// Only SPA-only paths get rewritten to index.html. Prerendered paths
// (/jobs/*, /companies/*, /, /contact, /pricing, etc.) are NOT listed
// here → the hosting platform serves their static index.html directly.
const REDIRECTS = `\
# Impulsa Talentos — explicit SPA fallback rules
# Prerendered pages (/jobs/*, /companies/*, /, /contact, /pricing, /privacy,
# /terms, /for-employers) are served as static files — no redirect rule needed.
# Only auth-protected SPA routes fall back to the neutral spa-fallback.html shell
# (NOT index.html — the fully prerendered HOME page; hydrating the home DOM against
# e.g. /employer throws Minified React error #418 on every text-node divergence).

# ── Auth-protected workspace routes ──
/candidate          /spa-fallback.html   200
/candidate/*        /spa-fallback.html   200
/employer           /spa-fallback.html   200
/employer/*         /spa-fallback.html   200
/md                 /spa-fallback.html   200
/md/*               /spa-fallback.html   200
/managingdirector   /spa-fallback.html   200
/managingdirector/* /spa-fallback.html   200
/hq                 /spa-fallback.html   200
/hq/*               /spa-fallback.html   200

# ── Profile & dashboard ──
/profile            /spa-fallback.html   200
/dashboard          /spa-fallback.html   200
/apply/*            /spa-fallback.html   200

# ── Mobile SPA routes ──
/m                  /spa-fallback.html   200
/m/*                /spa-fallback.html   200

# ── Reset password (no prerender) ──
/reset-password     /spa-fallback.html   200
`

try {
  writeFileSync(join(DEST, '_redirects'), REDIRECTS, { mode: 0o644 })
  console.log('[finalize] ✓ _redirects generated (explicit SPA routes only — static pages preserved)')
} catch (e) {
  if (e.code === 'EACCES') {
    console.warn(`[finalize] ⚠ cannot write _redirects: ${e.message} (platform pre-injected file may be read-only)`)
    console.warn('[finalize] ⚠ if catch-all is active, prerendered pages may be overridden')
  } else {
    throw e
  }
}

// ── Strip stale prerendered SPA-only route dirs ──
// `prerender.crawlLinks: true` statically renders EVERY reachable route,
// including auth-gated workspaces (/employer, /candidate, /md, /hq, ...).
// Those prerendered shells are static LOGIN pages; an AUTHENTICATED client
// hydrates them against the DASHBOARD tree → Minified React error #418
// (text vs ''). These routes are SPA-only: the neutral spa-fallback.html
// shell is served instead (see _redirects + serve.ts), so the client renders
// whatever its auth state actually is. Remove their prerendered dirs so both
// serve paths hit the shell for them.
const SPA_ONLY_ROUTES = [
  'employer', 'candidate', 'md', 'managingdirector', 'hq', 'profile', 'dashboard',
  'applications', 'apply', 'm', 'reset-password',
  'candidate-preview', 'md-preview',
]
for (const route of SPA_ONLY_ROUTES) {
  rmSync(join(DEST, route), { recursive: true, force: true })
}
console.log('[finalize] ✓ stale SPA-only route dirs stripped (neutral shell serves them)')

// ── Generate spa-fallback.html (neutral shell for SPA-only routes) ──
// index.html is the fully prerendered HOME page. Serving it for SPA-only
// routes (auth workspaces, /apply/*, /m/*, etc.) makes the client hydrate the
// HOME DOM against e.g. /employer's tree — the first text-node divergence
// throws Minified React error #418 (args text vs ''). A neutral shell with an
// EMPTY <body> (same head + module script) is a valid hydration target for ANY
// route: hydrateRoot(document) fills the empty body with the route's own tree,
// so no mismatch is possible. Serve this for every non-prerendered route.
const spaIndexHtml = readFileSync(join(DEST, 'index.html'), 'utf8')
const headEnd = spaIndexHtml.indexOf('</head>')
const bodyStart = spaIndexHtml.indexOf('<body')
const bodyEnd = spaIndexHtml.indexOf('</body>')
if (headEnd === -1 || bodyStart === -1 || bodyEnd === -1) {
  console.error('[finalize] FAILED deriving spa-fallback.html from index.html (missing </head>/<body> markers)')
  process.exit(1)
}
// Keep ONLY the <body> script tags (the TanStack bootstrap chain —
// sessionStorage scroll-restore helper, the $tsr-stream-barrier script
// carrying the full router manifest + $_TSR.e(), and the entry module
// script) and drop ALL other body content (SSR'd React markup, comments,
// the footer — the home page's SSR body also contains a <!--/$--> marker
// and a <footer> BEFORE the first <script>, so slicing from the first
// <script> is not enough; the body must contain the scripts ONLY, otherwise
// hasSsrContent() sees the footer and hydrateRoot(document) mismatches it
// against the route tree → React #418). WITHOUT the barrier the client
// entry cannot boot (blank page + "Invariant failed"); with an EMPTY body
// (scripts self-remove at parse) there is nothing to hydrate against, so
// no React #418 mismatch can occur.
const bodyScripts = (spaIndexHtml.slice(bodyStart, bodyEnd).match(/<script[\s\S]*?<\/script>/g) || []).join('')
writeFileSync(
  join(DEST, 'spa-fallback.html'),
  spaIndexHtml.slice(0, headEnd + '</head>'.length) +
    `<body>${bodyScripts}</body></html>`,
)
console.log('[finalize] ✓ spa-fallback.html generated (neutral shell + TanStack bootstrap — no hydration mismatch)')

// ── Self-updating pages (Hostinger caches every file for a year) ──
// The host sends `Cache-Control: max-age=31536000` on HTML too and ignores
// .htaccess headers, so a browser (or the CDN, until flushed) can keep an old
// page that names scripts from an earlier build. Every page gets a tiny inline
// script that runs before the app:
//   · compares its build id with /version.json (fetched past every cache);
//     if the site has moved on, it re-downloads this page (cache: 'reload',
//     which also replaces the browser's saved copy) and reloads once;
//   · if one of its own /assets/ files fails to load (deleted old build), or
//     Vite reports a failed lazy chunk, it does the same;
//   · registers /sw.js?v=<build> (the worker file is cached for a year too,
//     so each build asks for a URL the CDN has never seen), which loads every page as /path?_b=<live build>, so
//     neither the browser's year-long saved copy nor the CDN's copy can serve
//     an old build (no cache flush needed); a stale page waits for the worker
//     to take control, then reloads through it.
// A session flag stops it from ever looping.
const assetNames = existsSync(join(DEST, 'assets')) ? readdirSync(join(DEST, 'assets')).sort() : []
const htmlFiles = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'assets') walk(f) } else if (e.name.endsWith('.html')) htmlFiles.push(f)
  }
}
walk(DEST)
htmlFiles.sort()

// Critical CSS: each page gets the rules it actually uses inlined in <head>, so
// the first paint doesn't wait for the full stylesheet; the full file still
// loads (media="print" → "all" once fetched) for anything added after load
// (menus, dialogs). Dark-theme and animation rules are always kept, because
// the theme class and some animations are only set in the browser.
{
  const { default: Beasties } = await import('beasties')
  const beasties = new Beasties({
    path: DEST,
    publicPath: '/',
    preload: 'media',
    pruneSource: false,
    inlineFonts: false,
    reduceInlineStyles: false,
    compress: true,
    keyframes: 'all',
    logLevel: 'warn',
    allowRules: [/\.dark\b/, /:root/, /^html/, /^body/, /prefers-color-scheme/, /prefers-reduced-motion/],
  })
  let inlined = 0
  for (const f of htmlFiles) {
    const html = readFileSync(f, 'utf8')
    if (!/<link rel="stylesheet" href="\/assets\//.test(html)) continue
    writeFileSync(f, (await beasties.process(html)).replace(' data-beasties-container', ''))
    inlined++
  }
  console.log(`[finalize] ✓ critical CSS inlined in ${inlined} pages`)
}
// Build id covers every script name AND every page's content, so a deploy that
// only changes pages (new prerendered jobs, copy edits) still gets a new id.
const idHash = createHash('sha1').update(assetNames.join('\n'))
for (const f of htmlFiles) idHash.update(f).update(readFileSync(f))
const BUILD_ID = idHash.digest('hex').slice(0, 12)
writeFileSync(join(DEST, 'version.json'), JSON.stringify({ build: BUILD_ID }) + '\n')
// Self-update script, first thing in every page's <head>:
//  - strips the ?_b= cache-buster from the address bar;
//  - registers the service worker AFTER the page has loaded, so installing it
//    never competes with the first paint;
//  - asks /version.json which build is live; if this page is older (a CDN copy),
//    it switches at once: through the worker when one controls the page,
//    otherwise straight to /path?_b=<build> (a URL no cache has) — no waiting
//    for the worker to install first, which used to double the first visit;
//  - same when a script/style of an old build is gone (404 after cleanup).
const FRESH_SCRIPT = `<script data-build="${BUILD_ID}">(function(){var B="${BUILD_ID}",K="it-refresh",S=navigator.serviceWorker,R;try{if(/[?&]_b=/.test(location.search)){var c=new URL(location.href);c.searchParams.delete("_b");history.replaceState(history.state,"",c.pathname+c.search+c.hash)}}catch(e){}function reg(){if(R)return R;try{R=S?S.register("/sw.js?v="+B):Promise.reject()}catch(e){R=Promise.reject(e)}if(R.catch)R.catch(function(){});return R}if(document.readyState==="complete")reg();else addEventListener("load",function(){setTimeout(reg,0)});function hard(nb){var u=new URL(location.href);u.searchParams.set("_b",nb||Date.now().toString(16));location.replace(u.toString())}function go(nb){try{var k=K+":"+location.pathname,o=(sessionStorage.getItem(k)||"").split("|");if(o[0]===(nb||"err")&&Date.now()-(+o[1]||0)<60000)return;sessionStorage.setItem(k,(nb||"err")+"|"+Date.now())}catch(e){return}if(S&&S.controller){location.reload();return}hard(nb)}addEventListener("error",function(e){var t=e.target,u=t&&(t.src||t.href);if(u&&/\\/assets\\//.test(u)&&(t.tagName==="SCRIPT"||t.tagName==="LINK"))go()},true);addEventListener("vite:preloadError",function(e){e.preventDefault();go()});if(navigator.onLine===false)return;fetch("/version.json?b="+Date.now(),{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(v){if(v&&v.build&&v.build!==B)go(v.build)}).catch(function(){})})();</script>`

// Taps before the app's scripts have run (they load after the first paint):
// the phone menu opens/closes at once, a language pick is saved (the app
// applies it as it starts), and employer sign-up links remember the intent.
// Once React is running it sets window.__itHydrated and handles taps itself.
const EARLY_TAPS = `<script>(function(){document.addEventListener("click",function(e){if(window.__itHydrated)return;var t=e.target;if(!t||!t.closest)return;var m=t.closest("[data-early-menu]");if(m){var p=document.getElementById(m.getAttribute("aria-controls"));if(p){var o=p.hidden;p.hidden=!o;m.setAttribute("aria-expanded",o?"true":"false")}return}var l=t.closest("[data-early-locale]");if(l){try{localStorage.setItem("it_locale",l.getAttribute("data-early-locale"))}catch(x){}l.setAttribute("aria-busy","true");return}var i=t.closest("[data-early-intent]");if(i){try{sessionStorage.setItem("impulsa_onboarding_intent",i.getAttribute("data-early-intent"))}catch(x){}}},true)})()</script>`

// Size-matched stand-in fonts (src/font-fallback.css), inlined in every page:
// the critical-CSS step drops @font-face rules, and they must be there for the
// first paint, before the full stylesheet and DM Sans arrive.
const FONT_FALLBACK = `<style data-font-fallback>${readFileSync('src/font-fallback.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()}</style>`

// Loading order: the HTML, stylesheet and hero photo get the connection to
// themselves until the page is on screen. The app's JavaScript (the entry and
// the chunks it needs, which Vite lists as modulepreload links) is requested
// once the browser reports that the hero photo (the high-priority image) has
// been painted — or the first paint, on pages without one. Fallbacks: 1.5 s
// after the HTML is parsed, and 3 s in all (e.g. a background tab, where
// nothing paints). Pages are prerendered, so everything is readable before the
// scripts arrive; they then hydrate the page as before.
const START_AFTER_PAINT = (src, preloads) => `<script>(function(){var d=0;function go(){if(d)return;d=1;${JSON.stringify(preloads)}.forEach(function(h){var l=document.createElement("link");l.rel="modulepreload";l.href=h;document.head.appendChild(l)});var s=document.createElement("script");s.type="module";s.src=${JSON.stringify(src)};document.body.appendChild(s)}function next(){setTimeout(go,0)}function watch(type,ok){try{new PerformanceObserver(function(l,o){if(l.getEntries().some(ok)){o.disconnect();next()}}).observe({type:type,buffered:true});return 1}catch(e){return 0}}function start(){setTimeout(go,1500);var hero=[].slice.call(document.querySelectorAll('img[fetchpriority="high"]'));if(hero.length&&watch("largest-contentful-paint",function(e){return hero.indexOf(e.element)>-1}))return;if(watch("paint",function(){return 1}))return;requestAnimationFrame(next)}setTimeout(go,3000);document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start):start()})()</script>`
const ENTRY = /<script type="module"[^>]*\ssrc="(\/assets\/[^"]+\.js)"[^>]*><\/script>/
const PRELOAD = /<link rel="modulepreload"[^>]*\shref="(\/assets\/[^"]+\.js)"[^>]*\/?>/g
const lowPriorityScripts = (html) => {
  const entry = html.match(ENTRY)
  if (!entry) return html
  const preloads = [...html.matchAll(PRELOAD)].map((m) => m[1]).filter((h) => h !== entry[1])
  return html.replace(PRELOAD, '').replace(ENTRY, START_AFTER_PAINT(entry[1], preloads))
}


let injected = 0
for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8')
  if (html.includes('data-build=')) continue
  const head = html.indexOf('<head>')
  if (head === -1) continue
  // Right after <meta charset> (which must stay within the first 1024 bytes),
  // otherwise right after <head>.
  const cs = html.slice(head, head + 400).match(/<meta charset="[^"]*"\s*\/?>/i)
  const at = cs ? head + cs.index + cs[0].length : head + 6
  writeFileSync(f, lowPriorityScripts(html.slice(0, at) + FRESH_SCRIPT + EARLY_TAPS + FONT_FALLBACK + html.slice(at)))
  injected++
}
console.log(`[finalize] ✓ build ${BUILD_ID}: version.json + self-update script in ${injected} pages`)

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')
