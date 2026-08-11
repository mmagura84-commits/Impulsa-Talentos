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
  'employer', 'candidate', 'md', 'hq', 'profile', 'dashboard',
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
// Keep EVERYTHING from the first <body> script onward (the TanStack
// bootstrap chain — sessionStorage scroll-restore helper, the
// $tsr-stream-barrier script carrying the full router manifest + $_TSR.e(),
// and the entry module script) but drop the SSR'd React markup that
// precedes it. WITHOUT the barrier the client entry cannot boot (blank
// page + "Invariant failed"); without the markup there is nothing to
// hydrate against, so no React #418 mismatch can occur.
const bodyBootstrap = spaIndexHtml.slice(spaIndexHtml.indexOf('<script', bodyStart), bodyEnd)
writeFileSync(
  join(DEST, 'spa-fallback.html'),
  spaIndexHtml.slice(0, headEnd + '</head>'.length) +
    `<body>${bodyBootstrap}</body></html>`,
)
console.log('[finalize] ✓ spa-fallback.html generated (neutral shell + TanStack bootstrap — no hydration mismatch)')

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')
