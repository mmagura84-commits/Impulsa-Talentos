-- ══════════════════════════════════════════════════════════════════════════════
-- 029 — MD lane company-scoped SELECT (FIXED for 42P17 recursion)   [P0]
-- ──────────────────────────────────────────────────────────────────────────────
-- WHY THIS FILE EXISTS
--   Migration 028 (PR #128) introduced 5 *_md SELECT policies whose predicates
--   contain RAW table subqueries on other RLS-governed tables. Postgres plans
--   ALL policies for a relation regardless of role, and the md policies closed
--   a cycle that pre-existing policies never had:
--     • applications_select_candidate (004:139 / 012) → subquery `profiles`
--     • NEW profiles_select_md (028)                  → subquery `applications`
--   ⇒ applications → profiles → applications → … = 42P17 infinite recursion on
--   applications / offers / messages / profiles for EVERY role (md-admin,
--   employer-A, candidate2). Live probe evidence:
--   /home/team/shared/qa-rls-evidence/md-lane/post-apply-FAIL-42P17.md
--
-- FIX PATTERN (canonical Supabase)
--   Replace every cross-table read inside the md policies with SECURITY DEFINER
--   wrapper functions. A policy predicate may only call:
--     (a) columns of the relation itself, and
--     (b) SECURITY DEFINER functions (internal reads run as the function owner,
--         which has BYPASSRLS → no RLS re-entry → acyclic).
--   This file therefore introduces 4 SD wrappers (can_read_application /
--   can_read_offer / can_read_message / can_read_profile) and rebuilds the 5 md
--   policies on top of them. jobs_select_md was already SD-helper-only (probe:
--   jobs worked) — recreated here unchanged so the file is self-contained after
--   the owner's 028 rollback.
--
-- NO-RAW-SUBQUERY RULE (new QA gate criterion)
--   No policy in this file contains a subquery on another RLS-governed table.
--   All cross-table joins live inside SECURITY DEFINER functions.
--
-- APPLY ORDER
--   Owner runs the 028 rollback first (5 `drop policy ... *_md` statements —
--   already delivered; restores service), then runs this file in full. This
--   file is idempotent (drop-if-exists / create-or-replace) and also safe if
--   applied before the rollback. DO NOT apply until QA pre-merge gate PASS.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 0. SECURITY DEFINER wrapper functions (internal reads bypass RLS) ─────────

-- MD can read an application iff it belongs to a job of one of the MD's
-- companies (team member, active). Same semantics as 028's applications policy.
create or replace function public.can_read_application(p_app_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = p_app_id
      and public.is_team_member(j.company_id)
  )
$$;

-- MD can read an offer iff it belongs to an application on one of the MD's
-- companies' jobs.
create or replace function public.can_read_offer(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.offers o
    join public.applications a on a.id = o.application_id
    join public.jobs j on j.id = a.job_id
    where o.id = p_offer_id
      and public.is_team_member(j.company_id)
  )
$$;

-- MD can read a message iff it belongs to an application on one of the MD's
-- companies' jobs.
create or replace function public.can_read_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    join public.applications a on a.id = m.application_id
    join public.jobs j on j.id = a.job_id
    where m.id = p_message_id
      and public.is_team_member(j.company_id)
  )
$$;

-- MD can read a profile iff the profile is (a) a candidate who applied to one
-- of the MD's companies' jobs, or (b) a team member of one of the MD's
-- companies. Row-level only; scope never exceeds the MD's companies.
create or replace function public.can_read_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and (
        exists (
          select 1 from public.applications a
          join public.jobs j on j.id = a.job_id
          where a.candidate_id = p.id
            and public.is_team_member(j.company_id)
        )
        or exists (
          select 1 from public.team_members tm
          where tm.user_id = p.user_id
            and public.is_team_member(tm.company_id)
        )
      )
  )
$$;

-- ── 1. jobs: MD sees all jobs (incl. drafts/closed) of their companies ────────
--   (unchanged from 028 — already SD-helper-only; recreated for self-containment)
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
    and public.can_read_application(id)
  );

-- ── 3. offers: MD sees offers on their companies' applications ────────────────
drop policy if exists "offers_select_md" on public.offers;
create policy "offers_select_md" on public.offers
  for select using (
    public.current_user_role() = 'md'
    and public.can_read_offer(id)
  );

-- ── 4. messages: MD sees messenger threads on their companies' applications ───
drop policy if exists "messages_select_md" on public.messages;
create policy "messages_select_md" on public.messages
  for select using (
    public.current_user_role() = 'md'
    and public.can_read_message(id)
  );

-- ── 5. profiles: MD sees candidates who applied + team members (of their cos) ─
drop policy if exists "profiles_select_md" on public.profiles;
create policy "profiles_select_md" on public.profiles
  for select using (
    public.current_user_role() = 'md'
    and public.can_read_profile(id)
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — expect exactly 5 rows (policyname *_md, cmd = SELECT)
-- ══════════════════════════════════════════════════════════════════════════════
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and policyname like '%\_md'
order by tablename, policyname;
