# 2. Threat model

## Assets
Candidate PII and CVs (national IDs, contact details), employer data, credits and payments, admin/HQ capabilities, the brand's domain and reputation, API budgets (Claude, Resend).

## Actors
Anonymous visitor · signed-in candidate · signed-in employer · malicious employer/candidate · automated abuser · compromised dependency or CI action · leaked credential holder.

## Abuse cases and controls

| # | Abuse case | Control | Status |
|---|---|---|---|
| T1 | Stored XSS through a job description/markdown field steals sessions | Markdown is rendered as React elements; links pass `safeHref` (http(s), mailto, same-site only). CSP meta with hashed scripts as a second layer | Fixed (F-01); CSP built, deploy pending verification |
| T2 | Self-promotion to admin/employer, free credits, verifying one's own company | Guard triggers on privileged columns; `is_privileged_session()`; probes run | Verified |
| T3 | Reading other users' profiles/CVs | RLS on every table; anon sees 0 profiles; storage paths checked against caller id in `parse-cv` | Verified (DB tests) |
| T4 | Forged payment webhook grants credits | Signature check, constant-time compare, idempotent `apply_card_payment`, amount check | Reviewed |
| T5 | Zip-bomb DOCX exhausts the CV parser | Per-part 5 MiB and total 10 MiB unpacked limits, checked before inflating | Fixed (F-06) |
| T6 | Anonymous flooding of leads/reports/web vitals; email flood to HQ | Hourly caps (trigger), field-length constraint, vitals cap + retention | Fixed in repo (migration 052); **live DB pending** |
| T7 | Cost abuse of the Claude API through CV parsing | `claim_cv_parse()` 10/h, 30/day per user | Fixed in repo; **live DB + function deploy pending** |
| T8 | Malicious dependency / workflow tampering | Frozen lockfile, actions pinned to SHAs, `permissions: contents: read`, Dependabot, audit gate, secret scan | In place |
| T9 | Deploy over a hijacked SSH connection (legacy Hostinger path) | Pinned `known_hosts` (`deploy.sh`, `deploy.yml`) | Fixed in repo; **secret/fingerprints pending** |
| T10 | Clickjacking | Best-effort frame guard script (meta tags cannot set `frame-ancestors`) | Partial — see residual risk |
| T11 | Phishing via Google consent screen showing a Supabase host | Google Identity Services button tied to the site origin | Implemented, pending deploy |
