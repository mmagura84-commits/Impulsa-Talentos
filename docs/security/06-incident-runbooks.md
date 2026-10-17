# 6. Incident runbooks

General: note time and who is acting; preserve logs before changing anything; contain first, investigate second; record the outcome in a dated file under `docs/security/incidents/`. If personal data may have been exposed, involve whoever is responsible for data-protection obligations (Colombia: Ley 1581 / SIC reporting duties — confirm with counsel) — **owner unassigned**.

## 1. Account compromise (user, staff, admin)
1. Supabase → Auth → Users: ban or sign out the user; reset password. 2. For staff/admin: also revoke sessions on GitHub, Supabase, Google, Wompi, Resend; rotate any keys they held. 3. Review `profiles` for role/credit changes by that user and Auth logs for their IPs. 4. Revert unauthorized changes; notify the user.

## 2. Exposed credential (key, token, service-role key)
1. Treat as compromised immediately; do not wait to confirm misuse. 2. Rotate at the source: Supabase (JWT/service keys, edge secrets), Wompi, Resend, Anthropic, Hostinger SSH key, GitHub tokens. 3. Update secrets in GitHub/Supabase; redeploy functions. 4. Remove from git history only after rotation (history rewriting does not un-leak). 5. Check provider logs for use during the exposure window. The anon key is public by design; rotating it is only needed if policies were wrong.

## 3. Data exposure (RLS gap, public bucket, bad export)
1. Close the hole first (tighten policy / make bucket private) via a migration. 2. Determine which rows/files were reachable and for how long (API logs). 3. Run `supabase/tests/run_tests.sh`; add a test reproducing the gap. 4. Notify affected people and authorities as required.

## 4. Abuse / DoS / cost spike
1. Identify the endpoint (leads, reports, vitals, CV parse, sign-up). 2. Caps in migration 052 contain the database side; for the Claude API, set the Anthropic spend limit lower and, if needed, temporarily disable `parse-cv`. 3. Put a CDN/WAF (Cloudflare) in front for IP blocking and rate rules if sustained. 4. Clean junk rows with a targeted, reviewed delete.

## 5. Vulnerable dependency or failing security gate
1. Read the advisory; is the package shipped or dev-only? 2. Upgrade if a fix exists (Dependabot PR). 3. If none: add an entry to `docs/security/audit-allowlist.json` with reason and an expiry ≤ 90 days, via PR. 4. Never disable the gate to ship.

## 6. Failed deploy / site down — rollback
1. GitHub → Actions → Pages workflow: re-run the last good commit (see `09-…`). 2. Or revert the commit on `main` and run the workflow. 3. Backup branches `design-v1-tesla-backup`, `design-v2-industries-backup` hold earlier designs. 4. If the CSP breaks a page: revert the CSP commit only; the rest is independent.

## 7. Backup recovery
Supabase → Database → Backups: restore to a **new** project first, verify, then switch the app's URL/keys (build-time variables in the workflows). Restore tests: **never performed — schedule one** (see `07-…`).
