# 4. Controls and configuration

## In the repository (enforced by code/CI)
- **Authorization:** RLS on all tables; guard triggers on privileged columns (`guard_profile_privileged_columns`, `guard_company_privileged_columns`, `guard_and_charge_job`); `is_privileged_session()`.
- **Payments:** Wompi webhook signature + constant-time compare + idempotency + amount check.
- **Output encoding:** markdown rendered via React elements, `safeHref`.
- **CSP:** `scripts/finalize-static-build.mjs` writes a meta CSP per page (hash-based `script-src`; allows only the Supabase origin and Google Identity Services for connect/frame/script). Build fails if the Supabase URL is unset.
- **CI gates** (`.github/workflows/security.yml`, also in `pages.yml`/`deploy.yml` before build): type check, lint, unit tests, `scripts/secret-scan.mjs` (private keys, cloud/API tokens, JWTs with a role other than `anon`), `scripts/audit-gate.mjs` (high/critical fail unless allow-listed and unexpired), database tests on Postgres 16. Weekly schedule + manual dispatch.
- **Supply chain:** Dependabot weekly (npm, actions); actions pinned to commit SHAs; frozen lockfile.
- **Deploy:** pinned host keys for the SSH path.
- **Abuse limits:** migration 052 (leads/reports caps, web-vitals cap and retention, CV quota).

## Outside the repository — verify these (not verifiable from code)
Mark each when checked, with date and who checked.

| Setting | Where | Recommended | Checked |
|---|---|---|---|
| Branch protection on `main` (PR + passing `security` checks) | GitHub → Settings → Branches | on | ☐ |
| Secret scanning + push protection | GitHub → Settings → Code security | on | ☐ |
| Dependabot alerts | same | on | ☐ |
| Pages → Enforce HTTPS | GitHub → Settings → Pages | on | ☐ |
| Auth rate limits, CAPTCHA, leaked-password protection, email confirmation (confirmed on) | Supabase → Auth | on/tuned | ☐ |
| MFA for all dashboard members; org SSO if available | Supabase / GitHub / Google / Wompi / Resend | on | ☐ |
| Database backups / PITR | Supabase → Database → Backups | enabled, restore tested | ☐ |
| Google OAuth client: authorized JS origin `https://impulsatalentos.expert` | Google Cloud → Auth Platform → Clients | present (**seen present 2026-10-17**) | ☑ |
| Service-role key never in client or repo | Supabase / secret scan | confirmed by scan | ☑ (scan) |
| Edge function secrets rotated on staff change | Supabase → Functions → Secrets | per runbook | ☐ |
