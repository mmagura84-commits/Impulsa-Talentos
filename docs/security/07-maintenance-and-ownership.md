# 7. Maintenance and ownership

Owners are **unassigned** unless a name is written in; assign them. Suggested default: the repository owner for everything until delegated.

| Task | Frequency | Owner | Notes |
|---|---|---|---|
| Review/merge Dependabot PRs | weekly | _unassigned_ | Run full tests before merge |
| Review `security.yml` failures | on failure + weekly run | _unassigned_ | |
| Expire/renew `audit-allowlist.json` entries | monthly (first expiry 2027-01-17) | _unassigned_ | Remove entries once a fix exists |
| Access review (GitHub, Supabase, Google, Wompi, Resend, Hostinger) | quarterly | _unassigned_ | Remove leavers, confirm MFA |
| Rotate edge-function secrets and SSH deploy key | yearly or on staff change | _unassigned_ | See runbook 2 |
| Restore test from backup | twice a year | _unassigned_ | Never done yet |
| Re-run RLS probes / DB tests after any migration | every migration | developer | CI does it |
| Check CSP in a browser after each release (no violations on /, /jobs, sign-in) | every release | developer | |
| Re-review this folder | after any auth, payments or storage change, and yearly | _unassigned_ | |
