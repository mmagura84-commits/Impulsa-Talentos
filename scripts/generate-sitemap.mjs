#!/usr/bin/env node
/**
 * Build-time sitemap generator for Impulsa Talentos.
 *
 * Emits public/sitemap.xml (copied into dist by Vite at build time) listing
 * every indexable public URL with ABSOLUTE locations:
 *   - homepage            /
 *   - static public pages /jobs, /companies, /pricing, /terms, /privacy
 *   - all public job detail pages     /jobs/<id>       (status=open + approved)
 *   - all public company detail pages /companies/<id>
 *
 * Dynamic IDs are fetched from the live data source (Supabase REST) using the
 * SAME public filters the app + RLS enforce, so the sitemap always matches
 * what anonymous visitors can actually see (SEO-safe: no auth-gated URLs).
 *
 * Also rewrites robots.txt `Sitemap:` to the absolute URL (sitemaps in
 * robots.txt must be absolute).
 *
 * Deliberately NOT listed (documented in qc/sitemap-2026-08-04/):
 *   - /m/* mobile app pages (duplicate content of canonical desktop routes)
 *   - /reset-password, /apply/*, /dashboard, /candidate/*, /employer/*, /hq
 *     (auth-gated / non-indexable)
 *
 * Env overrides (same names the app uses):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SITE_URL
 * Dynamic lookups are best-effort: a build must still emit the static sitemap
 * when Supabase is unavailable, unauthorized, or slow. Warnings preserve the
 * failure evidence without making public/auth-independent pages unbuildable.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
// Published domain — the ONLY address the owner/crawlers can open.
const SITE_URL = (process.env.SITE_URL || 'https://fd0b55b61392401b29d1842ca353f8b6.ctonew.app').replace(/\/+$/, '')

const STATIC_ROUTES = ['/', '/jobs', '/companies', '/pricing', '/terms', '/privacy']

const SUPABASE_TIMEOUT_MS = 8_000
async function fetchJson(pathname) {
  const signal = AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal,
  })
  if (!res.ok) {
    throw new Error(`GET ${pathname} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  return res.json()
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function main() {
  // Dynamic URLs are optional at build time. Never fall back to credentials;
  // static routes remain safe when staging data is unavailable.
  let jobs = []
  let companies = []
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      jobs = await fetchJson('/rest/v1/jobs?select=id&status=eq.open&moderation_status=eq.approved')
      companies = await fetchJson('/rest/v1/companies?select=id')
    } catch (err) {
      console.warn(`[generate-sitemap] dynamic routes unavailable; using static routes: ${err.message}`)
    }
  } else {
    console.warn('[generate-sitemap] Supabase env unavailable; using static routes only')
  }

  // 2. Build the URL list.
  const locs = [
    ...STATIC_ROUTES.map((p) => `${SITE_URL}${p === '/' ? '/' : p}`),
    ...jobs.map((j) => `${SITE_URL}/jobs/${j.id}`),
    ...companies.map((c) => `${SITE_URL}/companies/${c.id}`),
  ]

  const urls = locs
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

  // 3. Write public/sitemap.xml (Vite copies public/ -> dist at build time).
  const sitemapPath = path.join(root, 'public', 'sitemap.xml')
  writeFileSync(sitemapPath, xml)

  // 4. robots.txt — absolute Sitemap line.
  const robotsPath = path.join(root, 'public', 'robots.txt')
  let robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : ''
  const sitemapLine = `Sitemap: ${SITE_URL}/sitemap.xml`
  if (/^Sitemap:/m.test(robots)) {
    robots = robots.replace(/^Sitemap:.*$/m, sitemapLine)
  } else {
    robots = `${robots.replace(/\s*$/, '')}\n${sitemapLine}\n`
  }
  writeFileSync(robotsPath, robots)

  console.log(
    `sitemap: ${locs.length} URLs (${STATIC_ROUTES.length} static + ${jobs.length} jobs + ${companies.length} companies) -> public/sitemap.xml`,
  )
  console.log(`robots: Sitemap line -> ${sitemapLine}`)
}

main().catch((err) => {
  console.error(`[generate-sitemap] FAILED: ${err.message}`)
  process.exit(1)
})
