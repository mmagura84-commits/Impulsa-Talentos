# 9. Deploy and rollback

## Live path (GitHub Pages)
1. Merge to `main` (CI `security.yml` should be green).
2. GitHub → Actions → **Pages** workflow → *Run workflow* on `main`. The workflow runs the security gates (types, tests, secret scan), builds, deploys.
3. Verify: view-source of `/` contains `Content-Security-Policy`; sign-in page loads; browser console shows **no CSP violations** on `/`, `/jobs/`, `/dashboard`, the Google button renders.

## Database (Supabase) — done by hand, in this order
1. Apply `supabase/migrations/052_abuse_limits.sql` (SQL editor or CLI). It is additive; rollback notes are in its header.
2. Deploy `supabase/functions/parse-cv` (keep its existing JWT-verification setting). It works with or without step 1.
3. Run the checks at the bottom of `supabase/tests/10_role_permissions.sql` logic against staging if available.

## Legacy Hostinger path
`deploy.sh` / `deploy.yml` require pinned host keys: run `scripts/pin-deploy-hostkeys.sh`, compare printed fingerprints with hPanel, then save the file's content as secret `HOSTINGER_KNOWN_HOSTS`. Emergency override for `deploy.sh` only: `DEPLOY_INSECURE_HOSTKEY=1` (logs a warning).

## Rollback
- **Site:** revert the offending commit on `main` and re-run the Pages workflow (about 5–10 min), or re-run the workflow on an older commit. Earlier designs are kept on branches `design-v1-tesla-backup` and `design-v2-industries-backup`.
- **CSP only:** revert the `finalize-static-build.mjs` CSP block; everything else is independent.
- **Google sign-in button:** if it misbehaves, the password flow and the redirect button remain; reverting `GoogleSignInButton` usage in `AuthGate.tsx` restores the previous behaviour.
- **Migration 052:** see rollback list in its header (drop two triggers, one constraint, restore `record_web_vitals` from 051, drop `claim_cv_parse` and `cv_parse_log`).
- **parse-cv:** redeploy the previous version from git history.
