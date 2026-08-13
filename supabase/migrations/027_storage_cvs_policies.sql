-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — storage.cvs canonical policy set (migration 027)
--
-- Purpose: repo ↔ live parity for the private `cvs` bucket on the LIVE project
-- (cmdqlybsgkegolqydmbh). Repo migration 016 declared the policy intent; this
-- migration converges to the VERIFIED live end state (QA storage suite 8/8
-- PASS on 2026-08-13) and is idempotent: bucket private + 10 MB file limit +
-- MIME allowlist, RLS enabled on storage.objects/buckets, 6 object policies +
-- 1 bucket SELECT policy, and a clean-slate drop of every `cvs%` policy
-- (including the harmless " 24bk_0/1"-suffixed duplicates and stray
-- storage.objects policies the dashboard "New policy" UI left behind).
--
-- ═══ PLATFORM CONSTRAINTS (hardened-storage finding, 2026-08-13) ═══
--   • supabase_storage_admin role memberships are RESERVED on this platform:
--     only the platform superuser can grant them; the `postgres` role (SQL
--     Editor) CANNOT `SET ROLE supabase_storage_admin` and cannot GRANT it.
--     ⇒ the TEAM cannot execute storage-policy SQL with its own credentials.
--   • The OWNER's dashboard SQL Editor CAN run plain `create policy ... on
--     storage.objects/buckets` (verified 2026-08-13: the bucket-visibility
--     policy cvs_bucket_select_authenticated was created exactly that way).
--     One-line CREATE POLICY is the canonical owner path; SET ROLE / GRANT
--     of the reserved role stays blocked.
--   • The dashboard "New policy" UI works for storage.objects but has NO
--     reliable storage.buckets table selector in this build → bucket policies
--     are SQL-Editor-only (owner).
--   • storage.buckets.id is UUID on live: every expression below matches on
--     name = 'cvs', NOT id = 'cvs' (id comparison raises 22P02).
--
-- How to apply: owner pastes this ENTIRE file into the project SQL Editor
-- (https://supabase.com/dashboard/project/cmdqlybsgkegolqydmbh/sql/new) and
-- runs it. Expected: "Success", then the §VERIFICATION rows: bucket row
-- (public=false), 6 storage.objects policies + 1 storage.buckets policy.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ── 1. Bucket exists + private (match on name — id is UUID on live) ──────────
insert into storage.buckets (name, public, file_size_limit, allowed_mime_types)
values (
  'cvs',
  false,
  10485760,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp']
)
on conflict (name) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. RLS on ─────────────────────────────────────────────────────────────────
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

-- ── 3. Clean slate: drop EVERY cvs* policy on storage tables (canonical names,
--    " 24bk_0/1"-suffixed UI duplicates, and stray objects-table policies) ─────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename IN ('objects', 'buckets')
      AND policyname ILIKE 'cvs%'
  LOOP
    EXECUTE format('drop policy if exists %I on storage.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── 4a. INSERT: resumes/<profile-id>/... — own profile only ───────────────────
create policy "cvs_insert_candidate" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = 'resumes'
    and exists (
      select 1 from public.profiles p
      where p.id::text = (storage.foldername(name))[2]
        and p.user_id = auth.uid()::text
    )
  );

-- ── 4b. INSERT: avatars/<uid>/ and cvs/<uid>/ — own uid only ─────────────────
create policy "cvs_insert_profile_owned" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] in ('avatars', 'cvs')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ── 4c. SELECT: resumes/... — owner | employer-with-application | admin ───────
create policy "cvs_select_candidate_or_employer" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = 'resumes'
    and (
      exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[2]
          and p.user_id = auth.uid()::text
      )
      or exists (
        select 1
        from public.applications a
        join public.jobs j on j.id = a.job_id
        where a.candidate_id::text = (storage.foldername(name))[2]
          and j.company_id in (
            select tm.company_id from public.team_members tm
            where tm.user_id = auth.uid()::text
          )
      )
      or public.current_user_role() = 'admin'
    )
  );

-- ── 4d. SELECT: avatars/<uid>/ and cvs/<uid>/ — owner | employer (cv) | admin ─
create policy "cvs_select_profile_authorized" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] in ('avatars', 'cvs')
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.current_user_role() = 'admin'
      or ((storage.foldername(name))[1] = 'cvs' and exists (
        select 1 from public.profiles p
        join public.applications a on a.candidate_id = p.id
        join public.jobs j on j.id = a.job_id
        where p.user_id = (storage.foldername(name))[2]
          and j.company_id in (
            select tm.company_id from public.team_members tm
            where tm.user_id = auth.uid()::text
          )
      ))
    )
  );

-- ── 4e. UPDATE/DELETE: owner only (both path conventions) ─────────────────────
create policy "cvs_update_owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cvs'
    and (
      exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[2]
          and p.user_id = auth.uid()::text
      )
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

create policy "cvs_delete_owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cvs'
    and (
      exists (
        select 1 from public.profiles p
        where p.id::text = (storage.foldername(name))[2]
          and p.user_id = auth.uid()::text
      )
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- ── 4f. Bucket visibility: authenticated may see cvs (anon denied) ────────────
-- NOTE: match on name — storage.buckets.id is UUID on live (id = 'cvs' → 22P02).
create policy "cvs_bucket_select_authenticated" on storage.buckets
  for select to authenticated
  using (name = 'cvs');

-- ── 5. VERIFICATION (read results aloud) ──────────────────────────────────────
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where name = 'cvs';

select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'buckets'
order by policyname;

COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
-- END — expected after apply: bucket row (public=false), 6 storage.objects
-- policies (cvs_insert_candidate, cvs_insert_profile_owned,
-- cvs_select_candidate_or_employer, cvs_select_profile_authorized,
-- cvs_update_owner, cvs_delete_owner) + 1 storage.buckets policy
-- (cvs_bucket_select_authenticated, name='cvs'), zero strays.
-- ─────────────────────────────────────────────────────────────────────────────
