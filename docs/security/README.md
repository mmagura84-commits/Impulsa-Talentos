# Security documentation — Impulsa Talentos

Review date: 2026-10-17. Scope, method and limits are in `01-scope-and-architecture.md`.
This is a point-in-time review. **It does not show the project is free of vulnerabilities.**

| File | Contents |
|---|---|
| `01-scope-and-architecture.md` | What was reviewed, trust boundaries, what was not tested |
| `02-threat-model.md` | Assets, actors, abuse cases and the control for each |
| `03-findings-register.md` | Every finding: evidence, status, fix, regression test |
| `04-controls-and-configuration.md` | Controls in place, CI gates, settings that live outside the repo |
| `05-monitoring-and-alerting.md` | What to watch, thresholds, what is wired up vs. still to wire |
| `06-incident-runbooks.md` | Step-by-step response for the likely incidents |
| `07-maintenance-and-ownership.md` | Recurring tasks, owners, schedule |
| `08-verification-and-residual-risk.md` | Checks run with results, open items, residual risk |
| `09-deploy-and-rollback.md` | How to ship and how to undo |
| `audit-allowlist.json` | Time-boxed exceptions for `npm audit` (reason + expiry each) |

Run locally: `bun test tests`, `node scripts/secret-scan.mjs`, `node scripts/audit-gate.mjs`,
`supabase/tests/run_tests.sh` (database, needs Postgres).
