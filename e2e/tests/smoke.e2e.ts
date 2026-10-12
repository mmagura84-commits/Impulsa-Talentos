/**
 * Read-only smoke checks for the public site: safe to run against production.
 * Nothing here signs up, submits a form or writes data.
 */
import { expect, test, type Page } from '@playwright/test'

/** Collect page errors and failed same-site requests while a test runs. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => {
    if (m.type() === 'error' && !/fonts\.g|favicon|ERR_TUNNEL|ERR_PROXY/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`)
  })
  return errors
}

test('home page renders with a heading and no script errors', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page).toHaveTitle(/Impulsa Talentos/)
  expect(errors).toEqual([])
})

test('home page has no horizontal scroll', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('pulling down at the top of the page can refresh it (overscroll not blocked)', async ({ page }) => {
  await page.goto('/')
  const blocked = await page.evaluate(() => [document.documentElement, document.body].map(el => getComputedStyle(el).overscrollBehaviorY))
  expect(blocked).toEqual(['auto', 'auto'])
})

test('job board lists open jobs', async ({ page }) => {
  await page.goto('/jobs')
  await expect(page.locator('a[href^="/jobs/"]').first()).toBeVisible({ timeout: 15_000 })
})

test('privacy policy names automated matching and a reachable contact address', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByText(/6\. (Automated Matching and AI|Emparejamiento Automatizado e IA)/)).toBeVisible()
  const text = await page.locator('body').innerText()
  expect(text).toContain('info@impulsatalentos.expert')
  expect(text).not.toMatch(/impulsatalentos\.co\b/)
})

test('sign-up form asks for name, email, password and data consent', async ({ page }) => {
  await page.goto('/candidate')
  await page.getByRole('tab', { name: 'Create account' }).click()
  await expect(page.locator('#signup-name')).toBeVisible()
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
  await expect(page.getByPlaceholder('Password')).toBeVisible()
  await expect(page.locator('#signup-data-consent')).not.toBeChecked()
  // Google: offered, but only after the data authorization is accepted
  const google = page.getByRole('button', { name: /Continue with Google/ })
  await expect(google).toBeDisabled()
  await page.locator('#signup-data-consent').check()
  await expect(google).toBeEnabled()
})

test('pages are the current build and carry the self-update script', async ({ page, request }) => {
  const res = await request.get(`/version.json?b=${Date.now()}`)
  expect(res.ok()).toBeTruthy()
  const { build } = await res.json() as { build: string }
  for (const path of ['/', '/privacy/', '/jobs/']) {
    // An outdated CDN copy switches to the fresh page at once, which can cancel
    // this navigation mid-way (net::ERR_ABORTED); the poll below checks the result.
    await page.goto(path).catch((e: Error) => { if (!/ERR_ABORTED|frame was detached/.test(e.message)) throw e })
    // An old copy (browser or CDN) refreshes itself to the live build within a few seconds.
    await expect.poll(async () => page.locator('script[data-build]').first().getAttribute('data-build'), { timeout: 15_000, message: `${path} should become build ${build}` }).toBe(build)
    expect(new URL(page.url()).searchParams.has('_b'), 'address bar stays clean').toBe(false)
  }
})

test('service worker takes over page loads (keeps pages fresh despite the host caching them)', async ({ page }) => {
  await page.goto('/privacy/')
  // An old copy may reload itself once; evaluate calls retry across that navigation.
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.ready.then(() => true)).catch(() => false), { timeout: 20_000 }).toBe(true)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller).catch(() => false), { timeout: 20_000 }).toBe(true)
  const script = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '')
  expect(script).toMatch(/\/sw\.js\?v=[0-9a-f]{12}$/)
  await expect(page.locator('h1').first()).toBeVisible()
})

test('favicons are real brand images, not HTML', async ({ page, request }) => {
  const { build } = await (await request.get(`/version.json?b=${Date.now()}`)).json() as { build: string }
  await page.goto('/')
  // Wait out a possible one-time self-refresh of an old CDN copy before reading the head.
  await expect.poll(async () => page.locator('script[data-build]').first().getAttribute('data-build').catch(() => ''), { timeout: 15_000 }).toBe(build)
  const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll(ls => ls.map(l => l.getAttribute('href')!))
  expect(hrefs).toEqual(expect.arrayContaining(['/favicon.ico?v=2', '/favicon.svg?v=2']))
  for (const href of [...hrefs, '/favicon.ico']) {
    const res = await request.get(href)
    expect(res.status(), href).toBe(200)
    expect(res.headers()['content-type'] ?? '', href).toMatch(/^image\//)
  }
  const svg = await (await request.get('/favicon.svg?v=2')).text()
  expect(svg).toContain('#1f3a8a')   // brand blue (header)
  expect(svg).toContain('#f2b705')   // brand gold (spark)
})

test('before the app scripts run, the phone menu opens and a language tap is kept', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the menu button is phone-only')
  // Hold the app's scripts back so the page is in its pre-hydration state.
  await page.route(/\/assets\/.*\.js$/, (route) => route.abort())
  await page.goto('/')
  const menu = page.locator('[data-early-menu]')
  await expect(page.locator('#mobile-nav-panel')).toBeHidden()
  await menu.click()
  await expect(page.locator('#mobile-nav-panel')).toBeVisible()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await menu.click()
  await expect(page.locator('#mobile-nav-panel')).toBeHidden()
  await page.locator('[data-early-locale]').first().click()
  expect(await page.evaluate(() => localStorage.getItem('it_locale'))).toBe('es')
})

test('once the app runs, the menu is handled by the app (opens and closes once per tap)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the menu button is phone-only')
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as { __itHydrated?: boolean }).__itHydrated === true).catch(() => false), { timeout: 20_000 }).toBe(true)
  await page.locator('[data-early-menu]').click()
  await expect(page.locator('#mobile-nav-panel')).toBeVisible()
  await page.locator('[data-early-menu]').click()
  await expect(page.locator('#mobile-nav-panel')).toBeHidden()
})

test('the home page starts without supabase-js or the animation library', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (r) => { if (r.resourceType() === 'script') scripts.push(r.url()) })
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as { __itHydrated?: boolean }).__itHydrated === true).catch(() => false), { timeout: 20_000 }).toBe(true)
  await page.waitForTimeout(1500)
  expect(scripts.filter((u) => /\/assets\/(supabase|proxy)-/.test(u))).toEqual([])
})

test('real-visitor load times are reported (anonymously)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('it_vitals_debug', '1'))
  let body: Record<string, unknown> | null = null
  // Captured here and answered locally: test visits are not stored.
  await page.route('**/rest/v1/rpc/record_web_vitals', async (route) => { body = route.request().postDataJSON(); await route.fulfill({ status: 204, body: '' }) })
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => (window as { __itHydrated?: boolean }).__itHydrated === true).catch(() => false), { timeout: 20_000 }).toBe(true)
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
  await expect.poll(() => body, { timeout: 10_000 }).not.toBeNull()
  expect(body!.p_page).toBe('/')
  expect(typeof body!.p_fcp_ms).toBe('number')
  expect(Object.keys(body!).sort()).toEqual(['p_build', 'p_cls', 'p_connection', 'p_device', 'p_fcp_ms', 'p_inp_ms', 'p_lcp_ms', 'p_nav_type', 'p_page', 'p_ttfb_ms'])
})
