-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Schema integrity fix (migration 012)
--
-- 1. Fix candidate_id type mismatch:
--    Code passes profiles.id (UUID) to applications.candidate_id and
--    saved_jobs.candidate_id. The columns were declared as `text` but
--    should be `uuid`. Verified by tracing the apply flow:
--      apply.$id.tsx:446  → candidateId: profile.id
--      m/jobs.$id.tsx:95  → candidateId: profile.id
--      hq.tsx:535 → profiles.find(p => p.id === app.candidateId)
--    All three consumers treat candidate_id as profiles.id (UUID).
--    Tables are empty (0 rows), so ALTER is safe — no backfill needed.
--
-- 2. Add FK constraints for referential integrity.
--
-- 3. Add UNIQUE constraint on companies.employer_id — verified 0 duplicates
--    in live DB (2026-08-06), so CREATE UNIQUE INDEX is safe.
--
-- 4. Rebuild indexes affected by the type change.
--
-- Apply: Run in Supabase SQL Editor (postgres role) or via supabase db push.
-- Verify: Run SELECTs at the bottom to confirm column types and indexes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── applications.candidate_id: text → uuid ──────────────────────────────────
-- Drop dependent RLS policies temporarily so ALTER succeeds.
drop policy if exists "applications_select_candidate" on public.applications;
drop policy if exists "applications_insert_candidate" on public.applications;
drop policy if exists "applications_select_admin"     on public.applications;
drop policy if exists "applications_update_admin"     on public.applications;

-- The UNIQUE index on (job_id, candidate_id) must be dropped before the type
-- change because it references candidate_id. Re-created below.
drop index if exists applications_job_candidate_uniq;
drop index if exists applications_candidate_id_idx;

alter table public.applications
  alter column candidate_id type uuid using candidate_id::uuid;

-- Rebuild indexes with correct type.
create index if not exists applications_candidate_id_idx
  on public.applications (candidate_id);
create unique index if not exists applications_job_candidate_uniq
  on public.applications (job_id, candidate_id);

-- FK: applications.candidate_id → profiles.id
alter table public.applications
  add constraint applications_candidate_id_fk
  foreign key (candidate_id) references public.profiles(id)
  on delete restrict;

-- ── Re-create RLS policies (unchanged logic; dropped only for ALTER) ────────
create policy "applications_select_candidate" on public.applications
  for select using (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

create policy "applications_insert_candidate" on public.applications
  for insert with check (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

create policy "applications_select_admin" on public.applications
  for select using (public.current_user_role() = 'admin');

create policy "applications_update_admin" on public.applications
  for update using (public.current_user_role() = 'admin');

-- ── saved_jobs.candidate_id: text → uuid ────────────────────────────────────
drop policy if exists "saved_jobs_select_own"  on public.saved_jobs;
drop policy if exists "saved_jobs_insert_own"  on public.saved_jobs;
drop policy if exists "saved_jobs_delete_own"  on public.saved_jobs;
drop index if exists saved_jobs_candidate_id_idx;

alter table public.saved_jobs
  alter column candidate_id type uuid using candidate_id::uuid;

create index if not exists saved_jobs_candidate_id_idx
  on public.saved_jobs (candidate_id);

-- FK: saved_jobs.candidate_id → profiles.id
alter table public.saved_jobs
  add constraint saved_jobs_candidate_id_fk
  foreign key (candidate_id) references public.profiles(id)
  on delete restrict;

-- ── Re-create saved_jobs RLS policies ───────────────────────────────────────
create policy "saved_jobs_select_own" on public.saved_jobs
  for select using (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

create policy "saved_jobs_insert_own" on public.saved_jobs
  for insert with check (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

create policy "saved_jobs_delete_own" on public.saved_jobs
  for delete using (
    candidate_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

-- ── companies.employer_id UNIQUE ─────────────────────────────────────────────
-- Verified 0 duplicates in live DB (12 rows, all unique). Safe to add.
create unique index if not exists companies_employer_id_uniq
  on public.companies (employer_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- Verification queries (run after applying)
-- ═════════════════════════════════════════════════════════════════════════════

-- Column types:
-- select column_name, data_type from information_schema.columns
--   where table_name in ('applications','saved_jobs') and column_name = 'candidate_id';
-- Expected: uuid

-- FK constraints:
-- select conname, conrelid::regclass, confrelid::regclass from pg_constraint
--   where conname in ('applications_candidate_id_fk','saved_jobs_candidate_id_fk');
-- Expected: 2 rows referencing public.profiles(id)

-- Unique index:
-- select indexname from pg_indexes where indexname = 'companies_employer_id_uniq';
-- Expected: 1 row
