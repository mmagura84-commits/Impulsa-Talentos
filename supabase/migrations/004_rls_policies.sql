-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — RLS lockdown (migration 004)
-- P0 security: enable Row Level Security with least-privilege policies so the
-- public anon key can no longer read private PII (profiles, applications,
-- saved_jobs) or user activity (reports), while preserving the public
-- marketplace data (companies, open+approved jobs, company reviews).
--
-- Apply in the Supabase SQL editor (postgres role) or via `supabase db push`.
-- After applying, re-run qc/rls-anon-probe.cjs and qc/rls-profiles-detail.cjs:
--   profiles / applications / saved_jobs / reports must return 0 rows to anon
--   jobs / companies / company_reviews must remain readable (public)
--
-- Ownership model (verified against src/hooks + routes 2026-08-04):
--   profiles.user_id        = Supabase auth user id (text)      [user?.id]
--   companies.employer_id   = Supabase auth user id (text)      [user?.id]
--   applications.candidate_id    = profiles.id (uuid)           [profile?.id]
--   saved_jobs.candidate_id      = profiles.id (uuid)           [profile?.id]
--   company_reviews.reviewer_id  = Supabase auth user id (text) [user?.id]
--   reports.reporter_id          = auth uid text or 'anonymous'
--
-- NOTE: this migration does NOT make the storage bucket 'cvs' private. CV files
-- in a public bucket remain fetchable by URL (not enumerable: URLs live only in
-- profiles.cv_url, which RLS now hides). A private bucket + signed URLs is a
-- frontend change (see qc/rls-lockdown-report.md).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: current user's profile role (SECURITY DEFINER avoids RLS recursion
--    in admin policies; returns NULL for anon / unknown) ──────────────────────
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()::text limit 1
$$;

-- ── Enable RLS on every user/private/public table ────────────────────────────
alter table public.profiles         enable row level security;
alter table public.companies        enable row level security;
alter table public.jobs             enable row level security;
alter table public.applications     enable row level security;
alter table public.saved_jobs       enable row level security;
alter table public.company_reviews  enable row level security;
alter table public.reports          enable row level security;

-- ── profiles: owner-only + admin (HQ user management) ────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (user_id = auth.uid()::text);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (user_id = auth.uid()::text);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.current_user_role() = 'admin');

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.current_user_role() = 'admin');

-- ── companies: public directory + employer ownership ─────────────────────────
drop policy if exists "companies_select_public" on public.companies;
create policy "companies_select_public" on public.companies
  for select using (true);

drop policy if exists "companies_insert_owner" on public.companies;
create policy "companies_insert_owner" on public.companies
  for insert with check (employer_id = auth.uid()::text);

drop policy if exists "companies_update_owner" on public.companies;
create policy "companies_update_owner" on public.companies
  for update using (employer_id = auth.uid()::text)
  with check (employer_id = auth.uid()::text);

drop policy if exists "companies_delete_owner" on public.companies;
create policy "companies_delete_owner" on public.companies
  for delete using (employer_id = auth.uid()::text);

-- ── jobs: public open+approved, employer owns company jobs, admin moderates ──
drop policy if exists "jobs_select_public" on public.jobs;
create policy "jobs_select_public" on public.jobs
  for select using (status = 'open' and moderation_status = 'approved');

drop policy if exists "jobs_select_owner" on public.jobs;
create policy "jobs_select_owner" on public.jobs
  for select using (
    company_id in (
      select id from public.companies where employer_id = auth.uid()::text
    )
  );

drop policy if exists "jobs_select_admin" on public.jobs;
create policy "jobs_select_admin" on public.jobs
  for select using (public.current_user_role() = 'admin');

drop policy if exists "jobs_insert_owner" on public.jobs;
create policy "jobs_insert_owner" on public.jobs
  for insert with check (
    company_id in (
      select id from public.companies where employer_id = auth.uid()::text
    )
  );

drop policy if exists "jobs_update_owner" on public.jobs;
create policy "jobs_update_owner" on public.jobs
  for update using (
    company_id in (
      select id from public.companies where employer_id = auth.uid()::text
    )
  ) with check (
    company_id in (
      select id from public.companies where employer_id = auth.uid()::text
    )
  );

drop policy if exists "jobs_update_admin" on public.jobs;
create policy "jobs_update_admin" on public.jobs
  for update using (public.current_user_role() = 'admin');

drop policy if exists "jobs_delete_owner" on public.jobs;
create policy "jobs_delete_owner" on public.jobs
  for delete using (
    company_id in (
      select id from public.companies where employer_id = auth.uid()::text
    )
  );

-- ── applications: candidate owns own, employer owns applications on own jobs ──
drop policy if exists "applications_select_candidate" on public.applications;
create policy "applications_select_candidate" on public.applications
  for select using (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

drop policy if exists "applications_insert_candidate" on public.applications;
create policy "applications_insert_candidate" on public.applications
  for insert with check (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

drop policy if exists "applications_select_employer" on public.applications;
create policy "applications_select_employer" on public.applications
  for select using (
    job_id in (
      select j.id from public.jobs j
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  );

drop policy if exists "applications_update_employer" on public.applications;
create policy "applications_update_employer" on public.applications
  for update using (
    job_id in (
      select j.id from public.jobs j
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  ) with check (
    job_id in (
      select j.id from public.jobs j
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  );

drop policy if exists "applications_select_admin" on public.applications;
create policy "applications_select_admin" on public.applications
  for select using (public.current_user_role() = 'admin');

drop policy if exists "applications_update_admin" on public.applications;
create policy "applications_update_admin" on public.applications
  for update using (public.current_user_role() = 'admin');

-- ── saved_jobs: owner only (candidate_id = profiles.id) ──────────────────────
drop policy if exists "saved_jobs_select_own" on public.saved_jobs;
create policy "saved_jobs_select_own" on public.saved_jobs
  for select using (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

drop policy if exists "saved_jobs_insert_own" on public.saved_jobs;
create policy "saved_jobs_insert_own" on public.saved_jobs
  for insert with check (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

drop policy if exists "saved_jobs_delete_own" on public.saved_jobs;
create policy "saved_jobs_delete_own" on public.saved_jobs
  for delete using (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

-- ── company_reviews: public read (company pages), reviewer owns write ────────
drop policy if exists "company_reviews_select_public" on public.company_reviews;
create policy "company_reviews_select_public" on public.company_reviews
  for select using (true);

drop policy if exists "company_reviews_insert_own" on public.company_reviews;
create policy "company_reviews_insert_own" on public.company_reviews
  for insert with check (reviewer_id = auth.uid()::text);

drop policy if exists "company_reviews_update_own" on public.company_reviews;
create policy "company_reviews_update_own" on public.company_reviews
  for update using (reviewer_id = auth.uid()::text)
  with check (reviewer_id = auth.uid()::text);

drop policy if exists "company_reviews_delete_own" on public.company_reviews;
create policy "company_reviews_delete_own" on public.company_reviews
  for delete using (reviewer_id = auth.uid()::text);

drop policy if exists "company_reviews_delete_admin" on public.company_reviews;
create policy "company_reviews_delete_admin" on public.company_reviews
  for delete using (public.current_user_role() = 'admin');

-- ── reports: public insert (report a job), admin-only read (HQ) ──────────────
drop policy if exists "reports_insert_public" on public.reports;
create policy "reports_insert_public" on public.reports
  for insert with check (true);

drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin" on public.reports
  for select using (public.current_user_role() = 'admin');

-- ── storage hardening (defense in depth; read remains public by design) ──────
-- Only authenticated users may UPLOAD into the cvs bucket (CVs/avatars).
drop policy if exists "cvs_upload_authenticated" on storage.objects;
create policy "cvs_upload_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cvs');
