# 5. Monitoring and alerting

**Honest status:** one check is wired and has been run (`.github/workflows/uptime.yml`: every 30 minutes pages answer with their CSP, TLS certificate has ≥ 14 days left, Supabase auth health is 200; failure emails the repo owner via GitHub's Actions notifications). Everything else below is a proposal; mark each "wired" only after a test alert has fired.

| Signal | Source | Alert when | Action | Status |
|---|---|---|---|---|
| CI security workflow failing | GitHub Actions (`security.yml`) | any failure; weekly run | Fix before next deploy; see runbook 5 | Wired (GitHub emails workflow failures to the committer/owner — confirm notification settings) |
| Dependency advisories | Dependabot alerts + weekly audit gate | new high/critical, or allow-list entry within 30 days of expiry | Runbook 5 | Config in repo; alerts enabled? ☐ |
| Auth anomalies | Supabase Auth logs | > 50 failed sign-ins/10 min, or burst of sign-ups from one IP range | Runbook 1/4 | Proposed |
| Public-endpoint flooding | Postgres: `leads`/`reports` rows per hour | ≥ 240 in an hour (cap is 300; trigger rejects beyond) | Runbook 4 | Proposed (cap itself is in migration 052) |
| CV quota refusals | Edge function logs (`rate_limited`) | > 20 per hour | Check for abuse; Runbook 4 | Proposed |
| Edge function errors | Supabase function logs | 5xx rate > 2% for 10 min | Runbook 6 | Proposed |
| Payment webhook failures | Wompi dashboard + function logs | any signature failure or non-2xx | Runbook 2/3 | Proposed |
| Claude API spend | Anthropic console usage limits | set a monthly hard limit; alert at 70% | Runbook 4 | ☐ set limit |
| Email spend/bounces | Resend dashboard | bounce > 5%, volume spike | Runbook 4 | ☐ |
| CSP violations | Browser console during QA (no report-uri possible with meta CSP) | any violation on key flows after a release | Fix or adjust CSP | Manual check per release |
| Uptime, CSP still served, certificate expiry, Supabase auth health | `uptime.yml` (GitHub Actions, every 30 min) | any failure | Runbook 6 | Wired. Manual run #1 (2026-10-17) failed because it wrongly probed `/dashboard/`, which GitHub Pages answers with HTTP 404 by design (fallback page); fixed, run #2 passed. Scheduled every 30 minutes. |
| Database size / growth | Supabase usage page | > 80% of plan | Review retention | Proposed |

Retention note: `web_vitals` is trimmed to 90 days by migration 052; `cv_parse_log` rows older than 2 days are removed on use.
