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

## Live verification after deploy (Pages run #11, 2026-10-17)
- `/`, `/jobs/`, `/dashboard/` serve the CSP; an injected inline script was blocked by the browser (policy enforced); sign-in page works; Google's button renders on the site domain; no CSP errors in the console.
- CI run #10 failed on the new secret-scan gate (a test fixture contained a private-key header); fixed in the next commit and run #11 passed. This shows the gate works.

## Live database and function (applied 2026-10-17, with the owner's explicit approval)
- Pre-check (read-only): tables/columns/helper functions present; 3 leads, none over the new length limits.
- Migration 052 applied in the Supabase SQL editor; no errors. Verified from the catalog: triggers `trg_leads_rate` and `trg_reports_rate` exist; `leads_field_lengths` present (NOT VALID by design); `cv_parse_log` has RLS on; `anon` cannot execute `claim_cv_parse()` or `guard_public_insert_rate()`; `anon` cannot read or write `cv_parse_log`; `authenticated` can execute `claim_cv_parse()`; `record_web_vitals` is capped.
- Live `parse-cv` index.ts/extract.ts compared with the repo before the change (index.ts identical; extract.ts differed only by a character-class space that had lost its `\u00a0`); after editing, both buffers hash identically to the repo files; deployed. Smoke tests: no-header call → 401 from the platform JWT gate; anon-key call → 401 `sign in required` from the new code; anon call of `claim_cv_parse` over REST → 42501 permission denied.
- Not exercised live: a real signed-in CV upload (needs a user session), so the 429 path on production was only tested with mocks.

## Settings checked on 2026-10-17
- GitHub Pages "Enforce HTTPS": **on**. Secret scanning and push protection: **on**. Dependency graph, Dependabot alerts, private vulnerability reporting: **enabled today**.
- Branch protection: **none exists**. Creating a ruleset was declined by the automation guard (access-control change); it is a pending one-click item for the owner.
- Supabase Auth: TOTP MFA enabled for users; rate limits at defaults (per IP: 360 sign-up/sign-in per hour, 1800 refreshes per hour); email confirmation on; CAPTCHA **off**; leaked-password check **off** (needs Pro).
- Supabase backups: **Free plan has no project backups at all**. This is the largest operational risk found in the settings review.
- A billing banner ("Outstanding invoices in other organizations") shows in the Supabase dashboard; it concerns another organization but could interrupt service if unpaid.

## Not done / not verified
- Real-browser run of the F-01 payloads on the deployed site (unit tests only).
- Google Identity Services button in a real signed-in flow (needs a human Google account); the fallback redirect button remains.
- No load or destructive tests on production (caps are exercised by the local database tests; flooding production would add junk data). MFA on the owner's own Google/GitHub/Supabase/Wompi/Resend accounts cannot be seen from here.

## Residual risks
1. **No real HTTP security headers** while hosted on GitHub Pages: no HSTS, no `frame-ancestors`, no `nosniff`. Recommend Cloudflare (or similar) in front.
2. CSP allows `'unsafe-inline'` styles (needed by the UI libraries) and `https:` images.
3. Broad `anon` table grants rely on RLS being right on every future table: keep the DB tests in CI.
4. Dev-time dependency advisories remain until upstream patches.
5. Legacy SSH path still accepts any host key until the `HOSTINGER_KNOWN_HOSTS` secret is set.
6. Rate limits are site-wide (not per IP) because the database cannot see client IPs behind the API; a determined attacker can fill the hourly cap and block legitimate submissions (availability trade-off, chosen over unbounded writes).
7. Owners and alert routes are unassigned; backups were never restore-tested.

This project is not claimed to be free of vulnerabilities.
