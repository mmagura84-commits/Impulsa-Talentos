# Durable branch and runtime reconciliation — 2026-08-10

## Main/runtime baseline

- `origin/main` is `2e3e90f` (`fix: prevent sitemap credential fallback`).
- The public runtime is `https://fd0b55b61392401b29d1842ca353f8b6.ctonew.app`.
- Legacy `/profiles` and `/applications` aliases are redirect-only and perform no unauthenticated database query. Clean-browser published smoke observed the AuthGate at both entries (HTTP 200; no 500/error shell).

## PR status checked directly

`gh pr view` confirms all four durable PRs remain **OPEN** with no merge commit or `mergedAt`; none are in `origin/main`:

| PR | Branch | Head | Scope |
|---|---|---|---|
| #79 | `qa/nullable-number-formatting` | `d47c4c1` | nullable-safe number formatting |
| #80 | `fix/candidate-two-option-funnel` | `7fdb5da` | candidate two-option auth funnel |
| #81 | `fix/public-null-format` | `260d8f4` | null-safe public salary renderer |
| #82 | `fix/candidate-auth-gate` | `e652e68` | recovery/auth hardening |

These branches are durable implementation candidates, not merged or production-delivered changes. The authenticated Supabase release gate, formal QA review for #80, and owner acceptance remain pending.
