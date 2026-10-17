# 3. Findings register

Status key: **Confirmed** = reproduced or measured here. **Suspected** = reasoned from code/config, not exploited. "In repo" = fixed in code, not yet live. Severity is my estimate of impact × exploitability.

| ID | Severity | Title | Evidence level | Status |
|---|---|---|---|---|
| F-01 | High | Stored XSS in markdown preview (job descriptions) | Confirmed | Fixed in repo, regression tests; live after deploy |
| F-02 | Medium | Legacy SSH deploy disables host-key checking | Confirmed (config read) | Fixed in repo; needs `HOSTINGER_KNOWN_HOSTS` secret to take effect |
| F-03 | Medium | CV parsing has no per-user quota (Claude API cost abuse) | Confirmed (no limit in code) | Fixed in repo (function + migration 052); live pending |
| F-04 | Medium | Anonymous write paths unbounded (leads, reports, web vitals) | Confirmed (no cap/length checks) | Fixed in repo (migration 052); live pending |
| F-05 | Medium | No security response headers / CSP on the live site | Confirmed (live header read) | Mitigated in repo with a CSP meta tag; GitHub Pages cannot set headers |
| F-06 | Medium | DOCX zip-bomb in CV parser | Confirmed (1024:1 ratio measured) | Fixed in repo, regression tests |
| D-1 | Low | Broad table grants to `anon` (Supabase default); RLS is the only barrier | Confirmed | Accepted; RLS + guard triggers verified by tests; keep tests in CI |
| D-2 | Low | Dev-time dependency advisories (stylelint → braces/micromatch/fast-glob/globby), no patched version | Confirmed (`npm audit`) | Allow-listed with expiry 2027-01-17; not shipped to users |
| D-3 | Info | No automated secret scanning / audit / DB tests in CI | Confirmed | Fixed: `security.yml`, Dependabot |

## F-01 Stored XSS — details
- **Where:** `src/components/MarkdownPreview.tsx` built HTML strings and used `dangerouslySetInnerHTML`; link URLs and text were interpolated into attributes.
- **Evidence:** payloads with a quote-breaking link target injected an event-handler attribute (4 payload tests fail against the old code).
- **Fix:** `src/lib/markdownInline.tsx` renders React elements; `safeHref` allow-lists schemes; nesting depth capped.
- **Regression test:** `tests/markdownInline.test.ts` (20 tests).
- **Not done:** a real-browser exploit/verification run against the deployed fix (see `08-…`).

## F-02 Host key
- `deploy.sh` and `deploy.yml` now verify against a pinned known_hosts. Hostinger fronts several nodes with different keys, so collect all with `scripts/pin-deploy-hostkeys.sh`, **compare fingerprints with hPanel**, then store as secret `HOSTINGER_KNOWN_HOSTS`. Until set, CI prints a warning and keeps the old behaviour.

## F-03 / F-04 database changes
- `supabase/migrations/052_abuse_limits.sql` (additive, rollback notes in header). Tests: `supabase/tests/10_role_permissions.sql` (228 pass, 0 fail locally). Function tests: `tests/parseCvHandler.test.ts`.
- `parse-cv` tolerates the migration being absent (404 from the RPC → continues), so function and migration can be deployed in either order.

## F-05 CSP — limits
Meta CSP with SHA-256 hashes of each page's inline scripts. Cannot express `frame-ancestors`, `report-uri`, `sandbox`, and HSTS/`X-Content-Type-Options` cannot be set at all on GitHub Pages. Real headers need a CDN/proxy in front (e.g. Cloudflare) — recommended, not done.

## F-06 Zip bomb
`supabase/functions/parse-cv/extract.ts` rejects DOCX parts > 5 MiB or total > 10 MiB declared size; fflate truncates output at the declared size, so a lying header cannot exceed it. Tests: `tests/parseCvZipBomb.test.ts`.
