/**
 * Speed check: Lighthouse's mobile test (emulated mid-range phone on slow 4G,
 * the same settings PageSpeed Insights uses) on key pages of a site, failing
 * when the main content (Largest Contentful Paint) takes longer than the budget.
 *
 *   node scripts/speed-check.mjs https://impulsatalentos.expert <build>
 *
 * Each page is measured RUNS times and judged on the median, because single
 * Lighthouse runs vary. With a build id, pages are requested as /path?_b=<build>
 * (the URL visitors get through the service worker), so a CDN copy of an older
 * build can't skew the result. Uses the Chromium that Playwright installed.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [base = 'https://impulsatalentos.expert', build = ''] = process.argv.slice(2)
const PATHS = (process.env.SPEED_PATHS ?? '/,/jobs/').split(',')
const RUNS = Number(process.env.SPEED_RUNS ?? 3)
const BUDGET_LCP_MS = Number(process.env.SPEED_BUDGET_LCP_MS ?? 2000)
const LIGHTHOUSE = 'lighthouse@12.6.1'

const urlFor = (path) => {
  const u = new URL(path, base)
  if (build) u.searchParams.set('_b', build)
  return u.toString()
}

// Warm the CDN: the page and what it loads first (new asset names are cache
// misses on their first request after a deploy).
async function warm(url) {
  for (let i = 0; i < 2; i++) {
    const html = await fetch(url).then((res) => res.text()).catch(() => '')
    const refs = [...new Set(html.match(/\/(?:assets|images)\/[\w./-]+\.(?:css|js|webp)/g) ?? [])].slice(0, 40)
    await Promise.all(refs.map((r) => fetch(new URL(r, base)).then((res) => res.arrayBuffer()).catch(() => {})))
  }
}

function lighthouse(url) {
  const out = execFileSync('npx', ['-y', LIGHTHOUSE, url,
    '--only-categories=performance', '--form-factor=mobile',
    '--chrome-flags=--headless=new --no-sandbox', '--output=json', '--output-path=stdout', '--quiet'],
  { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, maxBuffer: 256 * 1024 * 1024 })
  const r = JSON.parse(out.toString())
  const a = r.audits
  return {
    score: Math.round((r.categories.performance.score ?? 0) * 100),
    fcp: a['first-contentful-paint'].numericValue,
    lcp: a['largest-contentful-paint'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
  }
}

const median = (xs) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]
const s = (ms) => `${(ms / 1000).toFixed(1)} s`

const rows = []
let failed = false
for (const path of PATHS) {
  const url = urlFor(path)
  await warm(url)
  const runs = []
  for (let i = 0; i < RUNS; i++) runs.push(lighthouse(url))
  const m = { score: median(runs.map((x) => x.score)), fcp: median(runs.map((x) => x.fcp)), lcp: median(runs.map((x) => x.lcp)), cls: median(runs.map((x) => x.cls)) }
  const ok = m.lcp <= BUDGET_LCP_MS
  if (!ok) failed = true
  rows.push(`| ${path} | ${m.score} | ${s(m.fcp)} | ${s(m.lcp)} | ${m.cls.toFixed(3)} | ${ok ? 'ok' : `over ${s(BUDGET_LCP_MS)}`} |`)
  console.log(`${path}: score ${m.score}, first content ${s(m.fcp)}, main content ${s(m.lcp)}, layout shift ${m.cls.toFixed(3)} (runs: ${runs.map((x) => s(x.lcp)).join(', ')})`)
  if (!ok) console.log(`::error::${path} shows its main content in ${s(m.lcp)} on a phone (budget ${s(BUDGET_LCP_MS)})`)
}

const table = [`### Phone speed (Lighthouse mobile, median of ${RUNS})`, '',
  '| Page | Score | First content | Main content | Layout shift | Budget |', '|---|---|---|---|---|---|', ...rows, ''].join('\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + '\n')
process.exit(failed ? 1 : 0)
