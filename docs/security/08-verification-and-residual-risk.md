# 8. Verification results and residual risk

Run on 2026-10-17 in a sandbox with a local Postgres 16. "Live" means the production site/database.

## Checks run
| Check | Result |
|---|---|
| `bun run lint:types` (tsc) | clean |
| `bun test tests` | 64 pass, 0 fail (includes XSS payloads, zip-bomb, CV quota, secret-scan and audit-gate tests) |
| New XSS tests against the OLD implementation | 4 payload tests fail (proves they detect F-01) |
| `node scripts/secret-scan.mjs` | 405 tracked files, nothing found |
| `supabase/tests/run_tests.sh` (local DB, migrations 001–052) | 228 pass, 0 fail |
| RLS escalation probe (role, verified, credits, moderation changes as a normal user) | all blocked by guard triggers |
| `npm audit` | 5 high, all dev-time stylelint chain, no patched version; allow-listed to 2027-01-17 |
| Live response headers (read from a browser) | none of CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy set (GitHub Pages) |
| Built site with CSP, Playwright on 10 routes | **0 CSP violations**; hydration works. One React #418 on `/jobs/` also occurs with the CSP removed (mocked data), so it is not caused by the CSP |
| CSP bug found and fixed during this test | a TanStack script containing NUL characters hashed differently from what browsers hash; fixed in `finalize-static-build.mjs` |

## Not done / not verified
- **Live database:** migration 052 and the new `parse-cv` were **not applied** to production from this session (the automation guard refused production SQL). See `09-…` for the steps. Until applied, F-03/F-04/F-06 server-side protections are not live.
- Real-browser run of the F-01 payloads on the deployed site (unit tests only).
- Google Identity Services button in a real signed-in flow (needs a human Google account); the fallback redirect button remains.
- No load or destructive tests. Supabase dashboard settings, third-party accounts and GitHub repo settings: unverified (checklist in `04-…`).

## Residual risks
1. **No real HTTP security headers** while hosted on GitHub Pages: no HSTS, no `frame-ancestors`, no `nosniff`. Recommend Cloudflare (or similar) in front.
2. CSP allows `'unsafe-inline'` styles (needed by the UI libraries) and `https:` images.
3. Broad `anon` table grants rely on RLS being right on every future table: keep the DB tests in CI.
4. Dev-time dependency advisories remain until upstream patches.
5. Legacy SSH path still accepts any host key until the `HOSTINGER_KNOWN_HOSTS` secret is set.
6. Rate limits are site-wide (not per IP) because the database cannot see client IPs behind the API; a determined attacker can fill the hourly cap and block legitimate submissions (availability trade-off, chosen over unbounded writes).
7. Owners and alert routes are unassigned; backups were never restore-tested.

This project is not claimed to be free of vulnerabilities.
