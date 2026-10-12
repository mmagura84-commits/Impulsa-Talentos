// Serves dist/ the way the production .htaccess does: real files and
// prerendered dirs first, /api/* 404, everything else -> spa-fallback.html.
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
const DIST = process.env.DIST ?? join(import.meta.dir, '..', 'dist')
Bun.serve({
  port: Number(process.env.PORT ?? 3100),
  fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname)
    if (path.startsWith('/api/')) return new Response('not found', { status: 404 })
    let f = join(DIST, path)
    if (!f.startsWith(DIST)) return new Response('bad path', { status: 400 })
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html')
    if (!existsSync(f) || !statSync(f).isFile()) f = join(DIST, 'spa-fallback.html')
    return new Response(Bun.file(f))
  },
})
console.log('static dist on :' + (process.env.PORT ?? 3100))
