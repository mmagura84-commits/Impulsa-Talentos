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
//   · registers /sw.js, which loads every page as /path?_b=<live build>, so
//     neither the browser's year-long saved copy nor the CDN's copy can serve
//     an old build (no cache flush needed); a stale page waits for the worker
//     to take control, then reloads through it.
// A session flag stops it from ever looping.
const assetNames = existsSync(join(DEST, 'assets')) ? readdirSync(join(DEST, 'assets')).sort() : []
const BUILD_ID = createHash('sha1').update(assetNames.join('\n')).digest('hex').slice(0, 12)
writeFileSync(join(DEST, 'version.json'), JSON.stringify({ build: BUILD_ID }) + '\n')
const FRESH_SCRIPT = `<script data-build="${BUILD_ID}">(function(){var B="${BUILD_ID}",K="it-refresh",S=navigator.serviceWorker;try{if(/[?&]_b=/.test(location.search)){var c=new URL(location.href);c.searchParams.delete("_b");history.replaceState(history.state,"",c.pathname+c.search+c.hash)}}catch(e){}function reg(){try{return S?S.register("/sw.js"):Promise.reject()}catch(e){return Promise.reject(e)}}var R=reg();if(R.catch)R.catch(function(){});function hard(nb){var u=new URL(location.href);u.searchParams.set("_b",nb||Date.now().toString(16));location.replace(u.toString())}function go(nb){try{var k=K+":"+location.pathname,o=(sessionStorage.getItem(k)||"").split("|");if(o[0]===(nb||"err")&&Date.now()-(+o[1]||0)<60000)return;sessionStorage.setItem(k,(nb||"err")+"|"+Date.now())}catch(e){return}if(!S){hard(nb);return}if(S.controller){location.reload();return}var fin=0;function end(){if(fin)return;fin=1;S.controller?location.reload():hard(nb)}R.then(function(){return S.ready}).then(function(){return new Promise(function(r){if(S.controller)return r();S.addEventListener("controllerchange",r)})}).then(end,end);setTimeout(end,4000)}addEventListener("error",function(e){var t=e.target,u=t&&(t.src||t.href);if(u&&/\\/assets\\//.test(u)&&(t.tagName==="SCRIPT"||t.tagName==="LINK"))go()},true);addEventListener("vite:preloadError",function(e){e.preventDefault();go()});if(navigator.onLine===false)return;fetch("/version.json?b="+Date.now(),{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(v){if(v&&v.build&&v.build!==B)go(v.build)}).catch(function(){})})();</script>`


const htmlFiles = []
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'assets') walk(f) } else if (e.name.endsWith('.html')) htmlFiles.push(f)
  }
}
walk(DEST)
let injected = 0
for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8')
  if (html.includes('data-build=')) continue
  const at = html.indexOf('<head>')
  if (at === -1) continue
  writeFileSync(f, html.slice(0, at + 6) + FRESH_SCRIPT + html.slice(at + 6))
  injected++
}
console.log(`[finalize] ✓ build ${BUILD_ID}: version.json + self-update script in ${injected} pages`)

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')
