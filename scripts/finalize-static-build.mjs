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
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
# Only auth-protected SPA routes fall back to index.html for client-side routing.

# ── Auth-protected workspace routes ──
/candidate          /index.html   200
/candidate/*        /index.html   200
/employer           /index.html   200
/employer/*         /index.html   200
/md                 /index.html   200
/md/*               /index.html   200
/hq                 /index.html   200
/hq/*               /index.html   200

# ── Profile & dashboard ──
/profile            /index.html   200
/dashboard          /index.html   200
/apply/*            /index.html   200

# ── Mobile SPA routes ──
/m                  /index.html   200
/m/*                /index.html   200

# ── Reset password (no prerender) ──
/reset-password     /index.html   200
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

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')
