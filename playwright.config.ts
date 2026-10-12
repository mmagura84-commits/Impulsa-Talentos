/**
 * Playwright end-to-end tests (e2e/tests/*.e2e.ts).
 *
 *   bun run test:e2e                                   # against the local stack on :3100 (see e2e/README.md)
 *   E2E_BASE_URL=https://impulsatalentos.expert bun run test:e2e   # read-only smoke checks on the live site
 *
 * Files end in .e2e.ts (not .spec.ts) so `bun test` does not pick them up.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e/tests',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--no-proxy-server'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
})
