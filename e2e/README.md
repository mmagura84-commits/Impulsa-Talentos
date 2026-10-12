# End-to-end stack (local, never touches the live project)

Runs the real app against a throwaway copy of the database built from the repo
migrations, with real Supabase Auth (GoTrue) and PostgREST, so every role can
be driven through the actual UI.

```bash
# Postgres 16 on /tmp:55432 (see supabase/tests/run_tests.sh for setup)
e2e/stack.sh up                      # GoTrue :54332, PostgREST :54331, proxy :54321
source e2e/.env.e2e                  # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (local keys)
SITE_URL=http://localhost:3100 npm run build && git checkout public/sitemap.xml public/robots.txt
bun e2e/static.ts                    # serves dist/ like the production .htaccess, on :3100
# HQ bootstrap (as the owner would in the SQL editor):
#   $E2E_PSQL -c "update profiles set role='admin' where email='you@example.com'"
e2e/stack.sh down
```

Sign-ups are auto-confirmed. Storage and Edge Functions are not part of the
stack (CV upload uses a link instead; email is tested by
`bun test supabase/functions/notification-email`).

Flow verified on 2026-10-11: candidate + employer sign-up with consent → company
registration (trial: 2 credits, 14-day listings, 20 applicants) → draft while
unverified → verification request → HQ verifies + assigns MD → publish
(1 credit charged) → candidate applies → pipeline status, private notes,
interview, offer → candidate accepts (hired) → messages both ways → manual
payment → HQ approves (Pro: +3 credits, 45 days, 100 applicants) → second job,
withdraw with confirmation → report → HQ removes job → team invite accepted on
sign-up → lead from pricing → data export, deletion request, HQ erase (login
blocked) → notification bells on desktop and phone.
