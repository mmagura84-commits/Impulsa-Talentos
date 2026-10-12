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
})

test('pages are the current build and carry the self-update script', async ({ page, request }) => {
  const res = await request.get(`/version.json?b=${Date.now()}`)
  expect(res.ok()).toBeTruthy()
  const { build } = await res.json() as { build: string }
  for (const path of ['/', '/privacy/', '/jobs/']) {
    await page.goto(path)
    const pageBuild = await page.locator('script[data-build]').first().getAttribute('data-build')
    expect(pageBuild, `${path} should be build ${build}`).toBe(build)
  }
})

test('service worker takes over page loads (keeps pages fresh despite the host caching them)', async ({ page }) => {
  await page.goto('/privacy/')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await page.reload()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect(page.locator('h1').first()).toBeVisible()
})
