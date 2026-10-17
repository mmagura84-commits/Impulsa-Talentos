# 1. Scope and architecture

## In scope (reviewed)
- Application code: `src/`, `supabase/functions/*`, `scripts/`, build and deploy files, `.github/workflows/*`.
- Database: all migrations in `supabase/migrations/` (RLS, grants, triggers, SECURITY DEFINER functions), plus the SQL test suite in `supabase/tests/`.
- Dependencies: `npm audit` on the lockfile.
- Secrets in the repository (pattern scan of tracked files, JWT role decoding).
- Public response headers of the live site (read from a browser, same-origin).

## Architecture
- **Frontend:** TanStack Start (React 19, Vite), prerendered to static files in `dist/`. Served by **GitHub Pages** (`pages.yml`, manual dispatch). `deploy.yml` / `deploy.sh` (Hostinger) is the legacy path.
- **Backend:** Supabase project `cmdqlybsgkegolqydmbh` — Postgres with RLS, GoTrue auth, Storage, Edge Functions (Deno): `parse-cv`, `notification-email`, the Wompi payment webhook, others.
- **Third parties:** Google (sign-in), Wompi (payments), Resend (email), Anthropic API (CV extraction).

## Trust boundaries
1. Browser → Supabase REST/Auth/Storage using the **public anon key** (public by design). Only RLS and guard triggers stop abuse; table grants to `anon` are broad (Supabase default).
2. Browser → Edge Functions with the user's JWT (`parse-cv`) or no user (webhooks).
3. Third-party webhooks → Edge Functions (Wompi): authenticated by signature, not by login.
4. User-authored content → other users' browsers (job descriptions rendered as markdown).
5. CI → hosting (GitHub Pages token; Hostinger SSH key for the legacy path).
6. User-uploaded files (CV PDF/DOCX) → parser in an Edge Function.

## Not tested / out of scope
- No destructive tests and no load tests. No exploitation of the production database.
- Live Supabase dashboard settings (auth rate limits, SMTP, MFA, backups/PITR, network restrictions) were **not verifiable from the repo**; see `04-…` for the checklist.
- Wompi, Resend, Anthropic and Google account-level security (key scopes, 2FA on those accounts).
- GitHub repository settings other than what is in workflow files (branch protection, secret scanning) — see `04-…`.
- Physical, social-engineering and device-level security of the team.
- The frozen legacy Supabase project (`wpnkeryyhsdsislqaegb`) and staging were not touched.
