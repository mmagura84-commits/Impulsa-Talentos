-- ══════════════════════════════════════════════════════════════════════════════
-- 028 — MD lane: company-scoped SELECT on hiring data
-- Owner decision 2026-08-13 (explicit YES): the MD lane SHALL see company hiring
-- data. Previously role 'md' had no SELECT grants on the hiring tables (RLS
-- granted SELECT only to role 'admin' and employer-scoped owners), so MD/HQ
-- pipelines rendered empty — least-privilege held, now lifted for reads only.
--
-- WHAT THIS CHANGES
--   Adds 5 SELECT-only policies for role 'md' (profiles.role = 'md'):
--     jobs, applications, offers, messages, profiles.
--   Scope is STRICTLY company-scoped via public.is_team_member(company_id)
--   (migration 019 recursion-safe helper): an MD sees only rows belonging to
--   companies where they are an ACTIVE team_members member. Cross-company
--   isolation is preserved — no global visibility, no new write paths.
--
-- WHY THESE TABLES
--   Audit of the MD/HQ routes (src/routes/_app/md/*, hq.tsx):
--     - useAllJobs       → jobs
--     - useAllCompanies  → companies (already public-read: companies_select_public)
--     - useAllApplications → applications
--     - useAllProfiles   → profiles
--     - md/messages.tsx  → messages
--   offers is included per the task minimum set (applications/offers/messages)
--   and mirrors the employer lane. team_members is already readable by MD via
--   team_members_select_company (is_team_member). application_status_history,
--   application_feedback, interviews, interview_scorecards, notifications are
--   NOT rendered by any MD route today → deliberately left employer/admin-only;
--   extend when the MD product adds pipeline detail views.
--
-- SELECT ONLY (default per task): no INSERT/UPDATE/DELETE for 'md'.
--   NOTE: md/messages.tsx has a compose UI (createRow on messages) but
--   messages.application_id is NOT NULL + no md INSERT policy → compose remains
--   blocked for MD by design (read-only lane). Owner to decide if MD may send.
--
-- DESIGN NOTES (replicating existing employer-scoped patterns)
--   - current_user_role() is SECURITY DEFINER (migration 004) → no RLS recursion
--   - is_team_member(company_id) is SECURITY DEFINER reading team_members
--     (migration 019) → no 42P17 recursion from the profiles policy
--   - Subqueries inside policies are subject to RLS on referenced tables; the
--     md policy chain (jobs → applications → offers/messages/profiles) is
--     additive, so the chain resolves for role 'md'.
--   - applications.candidate_id references profiles(id) (migration 012 FK),
--     so the profiles policy joins on profiles.id.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. jobs: MD sees all jobs (incl. drafts/closed) of their companies ────────
drop policy if exists "jobs_select_md" on public.jobs;
create policy "jobs_select_md" on public.jobs
  for select using (
    public.current_user_role() = 'md'
    and public.is_team_member(company_id)
  );

-- ── 2. applications: MD sees applications on their companies' jobs ────────────
drop policy if exists "applications_select_md" on public.applications;
create policy "applications_select_md" on public.applications
  for select using (
    public.current_user_role() = 'md'
    and job_id in (
      select j.id from public.jobs j
      where public.is_team_member(j.company_id)
    )
  );

-- ── 3. offers: MD sees offers on their companies' applications ────────────────
drop policy if exists "offers_select_md" on public.offers;
create policy "offers_select_md" on public.offers
  for select using (
    public.current_user_role() = 'md'
    and application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      where public.is_team_member(j.company_id)
    )
  );

-- ── 4. messages: MD sees messenger threads on their companies' applications ───
drop policy if exists "messages_select_md" on public.messages;
create policy "messages_select_md" on public.messages
  for select using (
    public.current_user_role() = 'md'
    and application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      where public.is_team_member(j.company_id)
    )
  );

-- ── 5. profiles: MD sees candidates who applied to their companies ────────────
--      plus profiles of team members of their companies (incl. employers).
--      Row-level only: full rows are visible, matching the employer lane's
--      candidate visibility. Scope never exceeds MD's companies.
drop policy if exists "profiles_select_md" on public.profiles;
create policy "profiles_select_md" on public.profiles
  for select using (
    public.current_user_role() = 'md'
    and (
      exists (
        select 1 from public.applications a
        join public.jobs j on j.id = a.job_id
        where a.candidate_id = profiles.id
          and public.is_team_member(j.company_id)
      )
      or exists (
        select 1 from public.team_members tm
        where tm.user_id = profiles.user_id
          and public.is_team_member(tm.company_id)
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — expect 5 rows (policyname *_md, cmd = SELECT)
-- ══════════════════════════════════════════════════════════════════════════════
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and policyname like '%\_md'
order by tablename, policyname;
