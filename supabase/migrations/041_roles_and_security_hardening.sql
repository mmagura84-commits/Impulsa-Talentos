-- ─────────────────────────────────────────────────────────────────────────────
-- 041 — Role model + security hardening (platform audit, 2026-10-11)
--
-- Closes the critical/high findings of the platform audit. Everything here is
-- enforced IN THE DATABASE, so it holds no matter which client (web, /m phone
-- app, REST) talks to Supabase.
--
-- Role model after this migration
--   anon       browse public jobs/companies, submit a lead, report a job
--   candidate  own profile/CV/enrichment, apply to OPEN jobs, withdraw,
--              answer offers, message employers on own applications
--   employer   own company (cannot self-verify or mint credits), post jobs
--              (1 credit charged server-side on first publish), manage own
--              applicants; active team members (owner/admin/member) share it
--   md         operator lane: credentials/banking, leads, read-only view of
--              companies HQ assigns to them; must be profile_status='active'
--   admin      HQ: everything, every privileged change is audit-logged
--   Only an admin (or the service role / SQL editor) can assign md/admin, set
--   profile_status, verify a company, change credits or moderation.
--
-- Idempotent: safe to re-run. Tested against all prior migrations with
-- supabase/tests/run_tests.sh.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Identity helpers
-- ═════════════════════════════════════════════════════════════════════════════

-- Pending/rejected staff (md/admin) lose their privileges until HQ activates them.
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select case
           when p.role in ('candidate', 'employer') then p.role
           when p.profile_status = 'active' then p.role
         end
  from public.profiles p
  where p.user_id = auth.uid()::text
  limit 1
$$;

create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid()::text limit 1
$$;

-- True for HQ admins and for trusted back-office sessions (service role key,
-- SQL editor). Used by the column guards below.
create or replace function public.request_jwt_role()
returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

-- True for HQ admins and for trusted back-office sessions: the service-role
-- key, or a direct database session with no API token at all (SQL editor,
-- migrations). Every API request carries a token role (anon/authenticated).
create or replace function public.is_privileged_session()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role(), '') = 'admin'
      or coalesce(public.request_jwt_role(), 'none') = 'service_role'
      or public.request_jwt_role() is null
$$;

-- Active team member who can act for the company (MD advisors are read-only).
create or replace function public.is_company_editor(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c
                 where c.id = p_company_id and c.employer_id = auth.uid()::text)
      or exists (select 1 from public.team_members tm
                 where tm.company_id = p_company_id
                   and tm.user_id = auth.uid()::text
                   and tm.status = 'active'
                   and tm.role in ('owner', 'admin', 'member'))
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Admin audit log (who changed what, for every privileged action)
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id text,
  actor_role    text,
  action        text not null,
  target_type   text not null,
  target_id     text,
  before_json   jsonb,
  after_json    jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
drop policy if exists admin_audit_select_admin on public.admin_audit_log;
create policy admin_audit_select_admin on public.admin_audit_log
  for select using (public.current_user_role() = 'admin');
-- No insert/update/delete policies: rows are written only by SECURITY DEFINER
-- functions below, and can never be edited from the API.

create or replace function public.write_admin_audit(
  p_action text, p_target_type text, p_target_id text,
  p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (actor_user_id, actor_role, action, target_type, target_id, before_json, after_json)
  values (auth.uid()::text, coalesce(public.current_user_role(), auth.role()), p_action, p_target_type, p_target_id, p_before, p_after)
$$;
revoke all on function public.write_admin_audit(text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Profiles: nobody can grant themselves a role or approve themselves
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_session() then
    if tg_op = 'UPDATE' and (new.role is distinct from old.role
                             or new.profile_status is distinct from old.profile_status) then
      perform public.write_admin_audit('profile.role_or_status', 'profile', new.id::text,
        jsonb_build_object('role', old.role, 'profile_status', old.profile_status),
        jsonb_build_object('role', new.role, 'profile_status', new.profile_status));
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.role, 'candidate') not in ('candidate', 'employer') then
      raise exception 'Only HQ can assign the % role', new.role using errcode = '42501';
    end if;
    new.profile_status := 'active';
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Your account type can only be changed by HQ' using errcode = '42501';
  end if;
  if new.profile_status is distinct from old.profile_status then
    raise exception 'Account approval can only be changed by HQ' using errcode = '42501';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_profile_privileged_columns on public.profiles;
create trigger trg_guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- HQ: assign a role (candidate/employer/md/admin) and approval status.
create or replace function public.admin_set_user_role(
  p_profile_id uuid, p_role text, p_status text default 'active')
returns void language plpgsql security definer set search_path = public as $$
declare v_old public.profiles;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if p_role not in ('candidate', 'employer', 'md', 'admin') then
    raise exception 'unknown role %', p_role;
  end if;
  if p_status not in ('active', 'pending', 'rejected') then
    raise exception 'unknown status %', p_status;
  end if;
  select * into v_old from public.profiles where id = p_profile_id;
  if v_old.id is null then raise exception 'profile not found'; end if;
  -- Never leave the platform without an active admin.
  if v_old.role = 'admin' and (p_role <> 'admin' or p_status <> 'active')
     and (select count(*) from public.profiles where role = 'admin' and profile_status = 'active') <= 1 then
    raise exception 'cannot remove the last active admin';
  end if;
  update public.profiles
     set role = p_role, profile_status = p_status, updated_at = now()
   where id = p_profile_id;
end $$;
revoke all on function public.admin_set_user_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text, text) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Companies: verification, credits and plan limits are HQ-only
-- ═════════════════════════════════════════════════════════════════════════════
-- Existing companies keep today's behaviour (45-day listings, no applicant cap);
-- the guard below gives NEW self-serve companies the advertised trial limits.
alter table public.companies add column if not exists listing_days integer not null default 45;
alter table public.companies add column if not exists max_applicants_per_job integer;
alter table public.companies add column if not exists plan text not null default 'trial';
alter table public.companies add column if not exists verified_at timestamptz;

create or replace function public.guard_company_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_session() then
    if tg_op = 'UPDATE' and (new.verified is distinct from old.verified
                             or new.job_credits is distinct from old.job_credits
                             or new.plan is distinct from old.plan) then
      if new.verified and not coalesce(old.verified, false) then new.verified_at := now(); end if;
      perform public.write_admin_audit('company.privileged_update', 'company', new.id::text,
        jsonb_build_object('verified', old.verified, 'job_credits', old.job_credits, 'plan', old.plan),
        jsonb_build_object('verified', new.verified, 'job_credits', new.job_credits, 'plan', new.plan));
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.verified_at := null;
    new.job_credits := 2;            -- trial credits (NEW_COMPANY_TRIAL_CREDITS)
    new.plan := 'trial';
    new.listing_days := 14;
    new.max_applicants_per_job := 20;
    new.employer_id := auth.uid()::text;
    return new;
  end if;

  -- Credits may only move inside the server-side publish trigger (nested).
  if new.job_credits is distinct from old.job_credits and pg_trigger_depth() < 2 then
    raise exception 'Job credits can only change through a purchase approved by HQ' using errcode = '42501';
  end if;
  if new.verified is distinct from old.verified or new.verified_at is distinct from old.verified_at then
    raise exception 'Company verification is done by HQ' using errcode = '42501';
  end if;
  if new.plan is distinct from old.plan or new.listing_days is distinct from old.listing_days
     or new.max_applicants_per_job is distinct from old.max_applicants_per_job then
    raise exception 'Plan limits are set by HQ' using errcode = '42501';
  end if;
  if new.employer_id is distinct from old.employer_id then
    raise exception 'Company ownership can only be transferred by HQ' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_company_privileged_columns on public.companies;
create trigger trg_guard_company_privileged_columns
  before insert or update on public.companies
  for each row execute function public.guard_company_privileged_columns();

-- HQ can edit/verify any company (previously no admin UPDATE policy existed,
-- so the HQ "Verify" button silently changed nothing).
drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');
-- Deleting a company cascades to every job and application: HQ only.
drop policy if exists companies_delete_owner on public.companies;
drop policy if exists companies_delete_admin on public.companies;
create policy companies_delete_admin on public.companies
  for delete using (public.current_user_role() = 'admin');
-- Team editors (not only the original owner) can update company details.
drop policy if exists companies_update_team on public.companies;
create policy companies_update_team on public.companies
  for update using (public.is_company_editor(id))
  with check (public.is_company_editor(id));

-- Anonymous visitors see only the public columns of a company.
revoke select on public.companies from anon;
grant select (id, name, industry, size, location, website, description, logo_url,
              verified, created_at, entity_type, employer_id)
  on public.companies to anon;

-- HQ helper with an explicit audit trail.
create or replace function public.admin_verify_company(p_company_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  update public.companies
     set verified = p_verified, verification_requested = false
   where id = p_company_id;
  if not found then raise exception 'company not found'; end if;
end $$;
revoke all on function public.admin_verify_company(uuid, boolean) from public, anon;
grant execute on function public.admin_verify_company(uuid, boolean) to authenticated;

-- The old client-callable decrement let anyone zero any company's credits.
revoke all on function public.decrement_company_credits(uuid) from public, anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Jobs: moderation is HQ-only; credits charged server-side on first publish
-- ═════════════════════════════════════════════════════════════════════════════
-- Jobs that already went live are considered paid for.
update public.jobs set published_at = coalesce(published_at, created_at)
 where status <> 'draft' and published_at is null;

create or replace function public.guard_and_charge_job()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_company public.companies;
begin
  if not public.is_privileged_session() then
    if tg_op = 'INSERT' then
      new.moderation_status := 'approved';
      new.moderation_reason := null;
    elsif new.moderation_status is distinct from old.moderation_status
       or new.moderation_reason is distinct from old.moderation_reason then
      raise exception 'Job moderation is done by HQ' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
      raise exception 'A job cannot be moved to another company' using errcode = '42501';
    end if;
  end if;

  -- First publish of a job costs one credit (drafts are free; re-opening a job
  -- that was already published is free).
  if new.status = 'open' and new.published_at is null then
    select * into v_company from public.companies where id = new.company_id for update;
    if not public.is_privileged_session() then
      if not coalesce(v_company.verified, false) then
        raise exception 'Your company must be verified by HQ before publishing' using errcode = '42501';
      end if;
      if coalesce(v_company.job_credits, 0) < 1 then
        raise exception 'NO_JOB_CREDITS: buy a plan to publish this job' using errcode = 'P0001';
      end if;
      update public.companies set job_credits = job_credits - 1 where id = new.company_id;
    end if;
    new.published_at := now();
    if new.expires_at is null then
      new.expires_at := now() + make_interval(days => coalesce(v_company.listing_days, 45));
    end if;
  end if;

  if tg_op = 'UPDATE' and public.is_privileged_session()
     and new.moderation_status is distinct from old.moderation_status then
    perform public.write_admin_audit('job.moderation', 'job', new.id::text,
      jsonb_build_object('moderation_status', old.moderation_status),
      jsonb_build_object('moderation_status', new.moderation_status, 'reason', new.moderation_reason));
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_guard_and_charge_job on public.jobs;
create trigger trg_guard_and_charge_job
  before insert or update on public.jobs
  for each row execute function public.guard_and_charge_job();

-- Public listing: open, approved, not paused/archived/expired.
create or replace function public.job_is_public(j public.jobs)
returns boolean language sql stable as $$
  select j.status = 'open' and j.moderation_status = 'approved'
     and j.paused_at is null and j.archived_at is null
     and (j.expires_at is null or j.expires_at > now())
$$;

drop policy if exists jobs_select_public on public.jobs;
create policy jobs_select_public on public.jobs
  for select using (
    status = 'open' and moderation_status = 'approved'
    and paused_at is null and archived_at is null
    and (expires_at is null or expires_at > now())
  );

-- Applicants keep seeing the jobs they applied to after they close.
-- (SECURITY DEFINER helper: a policy subquery on applications would recurse
-- through the applications policies, which look at jobs.)
create or replace function public.has_applied_to_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications a
                 where a.job_id = p_job_id and a.candidate_id = public.current_profile_id())
$$;
drop policy if exists jobs_select_applicant on public.jobs;
create policy jobs_select_applicant on public.jobs
  for select using (public.has_applied_to_job(id));

-- Team editors manage the company's jobs (previously only the original owner).
drop policy if exists jobs_select_team on public.jobs;
create policy jobs_select_team on public.jobs
  for select using (public.is_company_editor(company_id));
drop policy if exists jobs_update_team on public.jobs;
create policy jobs_update_team on public.jobs
  for update using (public.is_company_editor(company_id))
  with check (public.is_company_editor(company_id) and (status <> 'open' or public.company_is_verified(company_id)));
drop policy if exists jobs_insert_team on public.jobs;
create policy jobs_insert_team on public.jobs
  for insert with check (public.is_company_editor(company_id) and (status <> 'open' or public.company_is_verified(company_id)));

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Applications
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.applications alter column status set default 'applied';

-- Employer-private review data moves out of the row the candidate can read.
create table if not exists public.application_private (
  application_id uuid primary key references public.applications(id) on delete cascade,
  shortlisted    boolean not null default false,
  notes          text,
  feedback       text,
  updated_by     text,
  updated_at     timestamptz not null default now()
);
alter table public.application_private enable row level security;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'applications' and column_name = 'notes') then
    insert into public.application_private (application_id, shortlisted, notes, feedback)
    select id, coalesce(shortlisted, false), notes, feedback from public.applications
     where coalesce(shortlisted, false) or notes is not null or feedback is not null
    on conflict (application_id) do nothing;
    alter table public.applications drop column if exists notes;
    alter table public.applications drop column if exists shortlisted;
    alter table public.applications drop column if exists feedback;
  end if;
end $$;

create or replace function public.can_manage_application(p_application_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
                 where a.id = p_application_id and public.is_company_editor(j.company_id))
$$;

drop policy if exists application_private_rw on public.application_private;
create policy application_private_rw on public.application_private
  for all using (public.can_manage_application(application_id) or public.current_user_role() = 'admin')
  with check (public.can_manage_application(application_id) or public.current_user_role() = 'admin');

-- Candidates can only apply to a live job, and only as 'applied'.
drop policy if exists applications_insert_candidate on public.applications;
create policy applications_insert_candidate on public.applications
  for insert with check (
    candidate_id = public.current_profile_id()
    and exists (select 1 from public.jobs j where j.id = job_id and public.job_is_public(j))
  );

create or replace function public.guard_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap integer; v_count integer;
begin
  if tg_op = 'INSERT' then
    if not public.is_privileged_session() then
      new.status := 'applied';
      new.recruiter_id := null;
      new.next_action := null;
      new.next_action_due := null;
      new.interview_link := null;
      new.interview_date := null;
    end if;
    select c.max_applicants_per_job into v_cap
      from public.jobs j join public.companies c on c.id = j.company_id where j.id = new.job_id;
    if v_cap is not null then
      select count(*) into v_count from public.applications where job_id = new.job_id;
      if v_count >= v_cap then
        raise exception 'APPLICANT_LIMIT: this job is no longer accepting applications' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;
  if new.candidate_id is distinct from old.candidate_id or new.job_id is distinct from old.job_id then
    if not public.is_privileged_session() then
      raise exception 'An application cannot be moved to another candidate or job' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_guard_application on public.applications;
create trigger trg_guard_application
  before insert or update on public.applications
  for each row execute function public.guard_application();

-- Team editors see and manage applicants (previously only the original owner).
drop policy if exists applications_select_team on public.applications;
create policy applications_select_team on public.applications
  for select using (public.can_manage_application(id));
drop policy if exists applications_update_team on public.applications;
create policy applications_update_team on public.applications
  for update using (public.can_manage_application(id))
  with check (public.can_manage_application(id));

-- Candidate withdraws (no direct UPDATE rights on the row).
create or replace function public.withdraw_application(p_application_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.applications
     set status = 'withdrawn', withdrawn_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = p_application_id
     and candidate_id = public.current_profile_id()
     and status not in ('hired', 'withdrawn');
  if not found then
    raise exception 'This application cannot be withdrawn' using errcode = '42501';
  end if;
end $$;
revoke all on function public.withdraw_application(uuid, text) from public, anon;
grant execute on function public.withdraw_application(uuid, text) to authenticated;

-- Status history is written by the database on every status change.
alter table public.application_status_history enable row level security;
drop policy if exists ash_select on public.application_status_history;
create policy ash_select on public.application_status_history
  for select using (
    public.current_user_role() = 'admin'
    or public.can_manage_application(application_id)
    or application_id in (select id from public.applications where candidate_id = public.current_profile_id())
  );

create or replace function public.log_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_status_history (application_id, status, changed_by)
    values (new.id, new.status, public.current_profile_id());
  end if;
  return null;
end $$;
drop trigger if exists trg_log_application_status on public.applications;
create trigger trg_log_application_status
  after insert or update of status on public.applications
  for each row execute function public.log_application_status();

-- Closing or archiving a job closes its open applications, which notifies each
-- candidate (instead of leaving them waiting on a dead posting).
create or replace function public.close_applications_for_job()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.status = 'closed' and old.status is distinct from 'closed')
     or (new.archived_at is not null and old.archived_at is null) then
    update public.applications
       set status = 'position_closed'
     where job_id = new.id
       and status not in ('hired', 'not_selected', 'position_closed', 'withdrawn', 'offer');
  end if;
  return null;
end $$;
drop trigger if exists trg_close_applications_for_job on public.jobs;
create trigger trg_close_applications_for_job
  after update of status, archived_at on public.jobs
  for each row execute function public.close_applications_for_job();

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Offers: candidates answer; acceptance marks the application hired
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists offers_select_team on public.offers;
create policy offers_select_team on public.offers
  for select using (public.can_manage_application(application_id));
drop policy if exists offers_insert_team on public.offers;
create policy offers_insert_team on public.offers
  for insert with check (public.can_manage_application(application_id));
drop policy if exists offers_update_team on public.offers;
create policy offers_update_team on public.offers
  for update using (public.can_manage_application(application_id))
  with check (public.can_manage_application(application_id));

create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_app uuid;
begin
  select o.application_id into v_app
    from public.offers o join public.applications a on a.id = o.application_id
   where o.id = p_offer_id and a.candidate_id = public.current_profile_id()
     and o.status in ('pending', 'revised');
  if v_app is null then
    raise exception 'This offer cannot be answered' using errcode = '42501';
  end if;
  update public.offers set status = case when p_accept then 'accepted' else 'declined' end,
                           updated_at = now()
   where id = p_offer_id;
  if p_accept then
    update public.applications set status = 'hired' where id = v_app;
  end if;
end $$;
revoke all on function public.respond_to_offer(uuid, boolean) from public, anon;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. Messages: team editors can read/write on their applications
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists messages_select_team on public.messages;
create policy messages_select_team on public.messages
  for select using (public.can_manage_application(application_id));
drop policy if exists messages_insert_team on public.messages;
create policy messages_insert_team on public.messages
  for insert with check (public.can_manage_application(application_id)
                         and sender_id = public.current_profile_id());

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. Interviews + feedback: fix the always-true insert checks
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists interviews_insert_owner on public.interviews;
create policy interviews_insert_owner on public.interviews
  for insert with check (
    public.is_company_editor(interviews.company_id)
    and exists (select 1 from public.jobs j
                where j.id = interviews.job_id and j.company_id = interviews.company_id)
    and exists (select 1 from public.applications a
                where a.job_id = interviews.job_id and a.candidate_id = interviews.candidate_id)
  );

drop policy if exists feedback_insert_owner on public.application_feedback;
create policy feedback_insert_owner on public.application_feedback
  for insert with check (
    public.is_company_editor(application_feedback.company_id)
    and exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
                where a.id = application_feedback.application_id
                  and j.company_id = application_feedback.company_id)
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Candidate enrichment tables (018) had no row security at all
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.can_view_candidate(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_profile_id = public.current_profile_id()
      or coalesce(public.current_user_role(), '') = 'admin'
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
                 where a.candidate_id = p_profile_id and public.is_company_editor(j.company_id))
$$;

do $$
declare t text;
begin
  foreach t in array array['candidate_work_experience', 'candidate_education',
                           'candidate_skills', 'candidate_languages', 'candidate_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_view_candidate(profile_id))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write_own', t);
    execute format('create policy %I on public.%I for all using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id())', t || '_write_own', t);
  end loop;
end $$;
revoke all on public.candidate_documents from anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. Leads: HQ and the MD only (were readable/editable by every signed-in user)
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists "Authenticated users can view leads" on public.leads;
drop policy if exists "Authenticated users can update leads" on public.leads;
drop policy if exists leads_select_staff on public.leads;
create policy leads_select_staff on public.leads
  for select using (public.current_user_role() in ('admin', 'md'));
drop policy if exists leads_update_staff on public.leads;
create policy leads_update_staff on public.leads
  for update using (public.current_user_role() in ('admin', 'md'))
  with check (public.current_user_role() in ('admin', 'md'));
drop policy if exists leads_delete_admin on public.leads;
create policy leads_delete_admin on public.leads
  for delete using (public.current_user_role() = 'admin');
-- Visitors may submit a lead but never read one back.
drop policy if exists "Anyone can insert leads" on public.leads;
drop policy if exists leads_insert_public on public.leads;
create policy leads_insert_public on public.leads
  for insert to anon, authenticated with check (status = 'new' and notes is null);

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. Caregivers: verification is HQ-only; admin list checks the real caller
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.guard_caregiver_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_session() then return new; end if;
  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
    new.verification_updated_at := null;
    new.verification_note := null;
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verification_note is distinct from old.verification_note
     or new.verification_updated_at is distinct from old.verification_updated_at then
    raise exception 'Caregiver verification is done by HQ' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_caregiver_verification on public.caregiver_profiles;
create trigger trg_guard_caregiver_verification
  before insert or update on public.caregiver_profiles
  for each row execute function public.guard_caregiver_verification();

create or replace function public.admin_list_caregivers(p_admin_uid text default null, p_limit integer default 100)
returns setof public.caregiver_profiles language sql stable security definer set search_path = public as $$
  -- p_admin_uid is ignored (kept for API compatibility); the caller's own
  -- session decides access.
  select cp.* from public.caregiver_profiles cp
  where coalesce(public.current_user_role(), '') = 'admin'
  order by cp.updated_at desc
  limit p_limit
$$;
revoke all on function public.admin_list_caregivers(text, integer) from public, anon;
grant execute on function public.admin_list_caregivers(text, integer) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 13. Privileged functions that anonymous callers could run
-- ═════════════════════════════════════════════════════════════════════════════
revoke all on function public.notify_user(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.notify_user(text, text, text, text, jsonb) to service_role;
revoke all on function public.fc_encrypt_secret(text, text) from public, anon, authenticated;

-- Users may mark their notifications read, not rewrite them.
create or replace function public.guard_notification_update()
returns trigger language plpgsql as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body
     or new.type is distinct from old.type or new.data is distinct from old.data
     or new.user_id is distinct from old.user_id then
    raise exception 'Only read status can be changed' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_notification_update on public.notifications;
create trigger trg_guard_notification_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ═════════════════════════════════════════════════════════════════════════════
-- 14. Reports: submitted through one function, reviewed by HQ
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.reports add column if not exists status text not null default 'open';
alter table public.reports add column if not exists reviewed_by text;
alter table public.reports add column if not exists reviewed_at timestamptz;
do $$ begin
  alter table public.reports add constraint reports_status_check
    check (status in ('open', 'dismissed', 'actioned'));
exception when duplicate_object then null; end $$;

drop policy if exists reports_insert_public on public.reports;
drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create or replace function public.report_job(p_job_id uuid, p_reason text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_reporter text := coalesce(auth.uid()::text, 'anonymous');
begin
  if not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'job not found';
  end if;
  -- Light abuse limit: 5 reports per reporter per job per day.
  if (select count(*) from public.reports
       where job_id = p_job_id and reporter_id = v_reporter
         and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Report already received' using errcode = 'P0001';
  end if;
  insert into public.reports (job_id, reporter_id, reason, note)
  values (p_job_id, v_reporter, left(coalesce(p_reason, ''), 100), left(coalesce(p_note, ''), 2000))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.report_job(uuid, text, text) from public;
grant execute on function public.report_job(uuid, text, text) to anon, authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 15. MD lane: meetings table (used by the app, never created), honest audit,
--     HQ assigns MDs to companies (read-only team seat)
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  md_user_id    text not null default auth.uid()::text,
  company_id    uuid references public.companies(id) on delete set null,
  employer_name text not null default '',
  meeting_date  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.meetings enable row level security;
drop policy if exists meetings_md_own on public.meetings;
create policy meetings_md_own on public.meetings
  for all using (md_user_id = auth.uid()::text and public.current_user_role() = 'md')
  with check (md_user_id = auth.uid()::text and public.current_user_role() = 'md');
drop policy if exists meetings_admin on public.meetings;
create policy meetings_admin on public.meetings
  for all using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- MD audit rows come only from md_write_audit (no forged direct inserts).
drop policy if exists md_audit_insert_own on public.md_audit_log;

create or replace function public.md_list_audit()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text := public.current_user_role(); v_rows jsonb;
begin
  if coalesce(v_role, '') not in ('admin', 'md') then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'submitter_id', l.submitter_id,
           'submitter_name', coalesce(p.full_name, ''), 'action', l.action,
           'entity_type', l.entity_type, 'entity_ref', l.entity_ref,
           'metadata', l.metadata, 'created_at', l.created_at
         ) order by l.created_at desc), '[]'::jsonb) into v_rows
  from public.md_audit_log l
  left join public.profiles p on p.user_id = l.submitter_id
  where v_role = 'admin' or l.submitter_id = auth.uid()::text;
  return v_rows;
end $$;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.team_members'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%role%' loop
    execute format('alter table public.team_members drop constraint %I', c.conname);
  end loop;
  alter table public.team_members add constraint team_members_role_check
    check (role in ('owner', 'admin', 'member', 'md'));
end $$;

-- Team admins manage members, but cannot create/remove owners or MD seats.
create or replace function public.guard_team_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_session() or pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.role in ('owner', 'md') then
      raise exception 'The company owner and MD seats are managed by HQ' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.role in ('owner', 'md') and (tg_op = 'INSERT' or new.role is distinct from old.role) then
    raise exception 'Only HQ can assign owner or MD seats' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.role in ('owner', 'md') then
    raise exception 'The company owner and MD seats are managed by HQ' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    -- Invites start pending until the invitee signs in (accept_team_invites).
    new.status := 'pending';
    new.invited_by := auth.uid()::text;
    if coalesce(new.invite_email, '') = '' then
      raise exception 'invite_email is required' using errcode = '22023';
    end if;
    new.user_id := 'pending_' || lower(new.invite_email);
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_team_members on public.team_members;
create trigger trg_guard_team_members
  before insert or update or delete on public.team_members
  for each row execute function public.guard_team_members();

create or replace function public.admin_assign_md(p_company_id uuid, p_md_profile_id uuid, p_assign boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  select user_id into v_uid from public.profiles where id = p_md_profile_id and role = 'md';
  if v_uid is null then raise exception 'profile is not a Managing Director'; end if;
  if p_assign then
    update public.team_members set status = 'active', role = 'md', updated_at = now()
     where company_id = p_company_id and user_id = v_uid;
    if not found then
      insert into public.team_members (company_id, user_id, role, status, invited_by)
      values (p_company_id, v_uid, 'md', 'active', auth.uid()::text);
    end if;
  else
    delete from public.team_members where company_id = p_company_id and user_id = v_uid and role = 'md';
  end if;
  perform public.write_admin_audit(case when p_assign then 'md.assign' else 'md.unassign' end,
    'company', p_company_id::text, null, jsonb_build_object('md_profile_id', p_md_profile_id));
end $$;
revoke all on function public.admin_assign_md(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_assign_md(uuid, uuid, boolean) to authenticated;

-- Secret reveals are logged.
create or replace function public.admin_read_credential_secret(p_target_type text, p_target_id uuid, p_field text)
returns text language plpgsql security definer set search_path = public as $$
declare v_sec uuid;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  if p_target_type = 'marketing' then
    select secret_id into v_sec from public.marketing_credentials where id = p_target_id;
  elsif p_target_type = 'banking' then
    if p_field = 'account_number' then
      select account_number_secret_id into v_sec from public.business_banking where id = p_target_id;
    elsif p_field = 'wompi_private_key' then
      select wompi_private_key_secret_id into v_sec from public.business_banking where id = p_target_id;
    elsif p_field = 'wompi_webhook_secret' then
      select wompi_webhook_secret_id into v_sec from public.business_banking where id = p_target_id;
    end if;
  end if;
  if v_sec is null then return null; end if;
  perform public.write_admin_audit('secret.reveal', p_target_type, p_target_id::text, null,
                                   jsonb_build_object('field', p_field));
  return public.fc_decrypt_secret(v_sec);
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 16. Payments: price and credits come from a server-side catalog
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.billing_packages (
  id                     text primary key,
  plan                   text not null,
  billing                text not null check (billing in ('monthly', 'yearly')),
  amount_usd             numeric not null,
  credits                integer not null,
  listing_days           integer not null,
  max_applicants_per_job integer,
  active                 boolean not null default true
);
alter table public.billing_packages enable row level security;
drop policy if exists billing_packages_read on public.billing_packages;
create policy billing_packages_read on public.billing_packages for select using (true);
insert into public.billing_packages (id, plan, billing, amount_usd, credits, listing_days, max_applicants_per_job) values
  ('pro',             'pro',     'monthly',   97,   3, 45, 100),
  ('pro_yearly',      'pro',     'yearly',   970,  36, 45, 100),
  ('premium',         'premium', 'monthly',  297,  10, 45, null),
  ('premium_yearly',  'premium', 'yearly',  2970, 120, 45, null)
on conflict (id) do update set amount_usd = excluded.amount_usd, credits = excluded.credits,
  listing_days = excluded.listing_days, max_applicants_per_job = excluded.max_applicants_per_job;

create or replace function public.submit_manual_payment(
  p_company_id uuid, p_package_id text default '', p_amount_usd numeric default 0,
  p_requested_credits integer default 0, p_transaction_reference text default '',
  p_proof_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid text := auth.uid()::text; v_pkg public.billing_packages; v_id uuid;
begin
  if v_uid is null or v_uid = '' then raise exception 'forbidden: no session'; end if;
  if not (public.can_manage_payment(p_company_id) or public.is_company_editor(p_company_id)) then
    raise exception 'forbidden: not your company';
  end if;
  select * into v_pkg from public.billing_packages where id = p_package_id and active;
  if v_pkg.id is null then raise exception 'unknown package %', p_package_id; end if;
  -- The reference is optional: an order may be placed first (HQ then sends the
  -- bank details) and the transfer reference added in the note or by HQ.
  insert into public.manual_payments
    (company_id, package_id, amount_usd, requested_credits, transaction_reference, proof_note, submitter_id, status)
  values (p_company_id, v_pkg.id, v_pkg.amount_usd, v_pkg.credits,
          left(trim(coalesce(p_transaction_reference, '')), 120), left(coalesce(p_proof_note, ''), 1000), v_uid, 'pending_verification')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.grant_company_credits(p_payment_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare r public.manual_payments; v_pkg public.billing_packages;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  select * into r from public.manual_payments where id = p_payment_id for update;
  if r.id is null then raise exception 'payment order not found'; end if;
  if r.status <> 'pending_verification' then
    raise exception 'payment order is not pending verification';
  end if;
  select * into v_pkg from public.billing_packages where id = r.package_id;
  update public.companies
     set job_credits = job_credits + coalesce(v_pkg.credits, r.requested_credits, 0),
         plan = coalesce(v_pkg.plan, plan),
         listing_days = coalesce(v_pkg.listing_days, listing_days),
         max_applicants_per_job = case when v_pkg.id is null then max_applicants_per_job
                                       else v_pkg.max_applicants_per_job end
   where id = r.company_id;
  update public.manual_payments
     set status = 'granted', verified_by = auth.uid()::text, verified_at = now(), decided_at = now()
   where id = p_payment_id;
  perform public.write_admin_audit('payment.grant', 'manual_payment', p_payment_id::text, null,
    jsonb_build_object('company_id', r.company_id, 'package', r.package_id, 'credits', coalesce(v_pkg.credits, r.requested_credits)));
  return coalesce(v_pkg.credits, r.requested_credits, 0);
end $$;

create or replace function public.reject_manual_payment(p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  update public.manual_payments
     set status = 'rejected', verified_by = auth.uid()::text, decided_at = now()
   where id = p_payment_id and status = 'pending_verification';
  if not found then raise exception 'payment order is not pending verification'; end if;
  perform public.write_admin_audit('payment.reject', 'manual_payment', p_payment_id::text);
end $$;

-- HQ payment queue with company names.
create or replace function public.admin_list_payments()
returns table (id uuid, company_id uuid, company_name text, package_id text, amount_usd numeric,
               requested_credits integer, status text, transaction_reference text, proof_note text,
               submitter_email text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  return query
    select m.id, m.company_id, c.name, m.package_id, m.amount_usd, m.requested_credits, m.status,
           m.transaction_reference, m.proof_note, p.email, m.created_at, m.decided_at
      from public.manual_payments m
      left join public.companies c on c.id = m.company_id
      left join public.profiles p on p.user_id = m.submitter_id
     order by (m.status = 'pending_verification') desc, m.created_at desc;
end $$;
revoke all on function public.admin_list_payments() from public, anon;
grant execute on function public.admin_list_payments() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 17. Notifications: the database tells each side what happened
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.push_notification(p_user_id text, p_type text, p_title text,
                                                    p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null or p_user_id = '' then return; end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id) then return; end if;
  insert into public.notifications (user_id, type, title, body, data)
  -- title/body are NOT NULL: a null piece (e.g. an interview without a time
  -- yet) must not make the triggering write fail.
  values (p_user_id, p_type, coalesce(nullif(p_title, ''), p_type), coalesce(p_body, ''),
          coalesce(p_data, '{}'::jsonb));
end $$;
revoke all on function public.push_notification(text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.company_staff_user_ids(p_company_id uuid)
returns setof text language sql stable security definer set search_path = public as $$
  select employer_id from public.companies where id = p_company_id
  union
  select user_id from public.team_members
   where company_id = p_company_id and status = 'active' and role in ('owner', 'admin', 'member')
$$;
revoke all on function public.company_staff_user_ids(uuid) from public, anon, authenticated;

create or replace function public.notify_on_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_job public.jobs; v_cand public.profiles; v_uid text;
begin
  select * into v_job from public.jobs where id = new.job_id;
  select * into v_cand from public.profiles where id = new.candidate_id;
  if tg_op = 'INSERT' then
    for v_uid in select * from public.company_staff_user_ids(v_job.company_id) loop
      perform public.push_notification(v_uid, 'application_received',
        'New applicant: ' || coalesce(nullif(v_cand.full_name, ''), 'a candidate'),
        coalesce(v_job.title, ''),
        jsonb_build_object('application_id', new.id, 'job_id', new.job_id));
    end loop;
  elsif new.status is distinct from old.status then
    if new.status = 'withdrawn' then
      for v_uid in select * from public.company_staff_user_ids(v_job.company_id) loop
        perform public.push_notification(v_uid, 'application_withdrawn',
          coalesce(nullif(v_cand.full_name, ''), 'A candidate') || ' withdrew',
          coalesce(v_job.title, ''), jsonb_build_object('application_id', new.id));
      end loop;
    else
      perform public.push_notification(v_cand.user_id, 'application_status',
        coalesce(v_job.title, 'Your application'), new.status,
        jsonb_build_object('application_id', new.id, 'status', new.status));
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_on_application on public.applications;
create trigger trg_notify_on_application
  after insert or update of status on public.applications
  for each row execute function public.notify_on_application();

create or replace function public.notify_on_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_app public.applications; v_job public.jobs; v_cand public.profiles; v_uid text;
begin
  select * into v_app from public.applications where id = new.application_id;
  select * into v_job from public.jobs where id = v_app.job_id;
  select * into v_cand from public.profiles where id = v_app.candidate_id;
  if tg_op = 'INSERT' or (new.status = 'revised' and old.status is distinct from 'revised') then
    perform public.push_notification(v_cand.user_id, 'offer_received',
      'Offer: ' || coalesce(v_job.title, ''), 'You have a new offer to review',
      jsonb_build_object('offer_id', new.id, 'application_id', new.application_id));
  elsif new.status in ('accepted', 'declined') and old.status is distinct from new.status then
    for v_uid in select * from public.company_staff_user_ids(v_job.company_id) loop
      perform public.push_notification(v_uid, 'offer_' || new.status,
        coalesce(nullif(v_cand.full_name, ''), 'The candidate') || ' ' || new.status || ' your offer',
        coalesce(v_job.title, ''), jsonb_build_object('offer_id', new.id));
    end loop;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_on_offer on public.offers;
create trigger trg_notify_on_offer
  after insert or update of status on public.offers
  for each row execute function public.notify_on_offer();

create or replace function public.notify_on_interview()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cand public.profiles; v_job public.jobs;
begin
  select * into v_cand from public.profiles where id = new.candidate_id;
  select * into v_job from public.jobs where id = new.job_id;
  if tg_op = 'INSERT' or new.scheduled_at is distinct from old.scheduled_at or new.status is distinct from old.status then
    perform public.push_notification(v_cand.user_id, 'interview_' || new.status,
      'Interview: ' || coalesce(v_job.title, ''), to_char(new.scheduled_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') || ' (Bogotá)',
      jsonb_build_object('interview_id', new.id, 'job_id', new.job_id));
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_on_interview on public.interviews;
create trigger trg_notify_on_interview
  after insert or update on public.interviews
  for each row execute function public.notify_on_interview();

create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_app public.applications; v_job public.jobs; v_cand public.profiles; v_uid text;
begin
  select * into v_app from public.applications where id = new.application_id;
  select * into v_job from public.jobs where id = v_app.job_id;
  select * into v_cand from public.profiles where id = v_app.candidate_id;
  if new.sender_id = v_app.candidate_id then
    for v_uid in select * from public.company_staff_user_ids(v_job.company_id) loop
      perform public.push_notification(v_uid, 'message_received',
        'Message from ' || coalesce(nullif(v_cand.full_name, ''), 'a candidate'),
        left(coalesce(new.body, ''), 140), jsonb_build_object('application_id', new.application_id));
    end loop;
  else
    perform public.push_notification(v_cand.user_id, 'message_received',
      'New message: ' || coalesce(v_job.title, ''), left(coalesce(new.body, ''), 140),
      jsonb_build_object('application_id', new.application_id));
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_on_message on public.messages;
create trigger trg_notify_on_message
  after insert on public.messages
  for each row execute function public.notify_on_message();

create or replace function public.notify_on_company_or_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid text;
begin
  if tg_table_name = 'companies' then
    if new.verified and not coalesce(old.verified, false) then
      perform public.push_notification(new.employer_id, 'company_verified',
        'Your company is verified', 'You can now publish jobs', jsonb_build_object('company_id', new.id));
    end if;
  elsif tg_table_name = 'manual_payments' then
    if new.status is distinct from old.status and new.status in ('granted', 'rejected') then
      perform public.push_notification(new.submitter_id, 'payment_' || new.status,
        case when new.status = 'granted' then 'Payment confirmed' else 'Payment not confirmed' end,
        case when new.status = 'granted' then 'Your job credits were added' else 'Contact us about your transfer' end,
        jsonb_build_object('payment_id', new.id));
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_notify_company_verified on public.companies;
create trigger trg_notify_company_verified
  after update of verified on public.companies
  for each row execute function public.notify_on_company_or_payment();
drop trigger if exists trg_notify_payment_decided on public.manual_payments;
create trigger trg_notify_payment_decided
  after update of status on public.manual_payments
  for each row execute function public.notify_on_company_or_payment();

-- HQ is told about everything waiting on it.
create or replace function public.notify_hq()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_uid text; v_title text; v_body text; v_type text; v_data jsonb;
begin
  if tg_table_name = 'manual_payments' and tg_op = 'INSERT' then
    v_type := 'hq_payment_submitted';
    v_title := 'Payment to verify: ' || coalesce((select name from public.companies where id = new.company_id), '');
    v_body := new.package_id || ' · $' || new.amount_usd
              || coalesce(' · ref ' || nullif(new.transaction_reference, ''), '');
    v_data := jsonb_build_object('payment_id', new.id);
  elsif tg_table_name = 'leads' and tg_op = 'INSERT' then
    v_type := 'hq_new_lead';
    v_title := 'New lead: ' || coalesce(nullif(new.company, ''), nullif(new.name, ''), new.email, '');
    v_body := coalesce(new.email, '') || ' · ' || coalesce(new.source, '');
    v_data := jsonb_build_object('lead_id', new.id);
  elsif tg_table_name = 'companies' then
    if tg_op <> 'UPDATE' then return null; end if;
    if not (new.verification_requested and not coalesce(old.verification_requested, false) and not new.verified) then
      return null;
    end if;
    v_type := 'hq_verification_requested';
    v_title := 'Verify company: ' || new.name;
    v_body := 'The employer asked to be verified so they can publish';
    v_data := jsonb_build_object('company_id', new.id);
  elsif tg_table_name = 'reports' and tg_op = 'INSERT' then
    v_type := 'hq_job_reported';
    v_title := 'Job reported: ' || coalesce((select title from public.jobs where id = new.job_id), '');
    v_body := coalesce(new.reason, '');
    v_data := jsonb_build_object('report_id', new.id, 'job_id', new.job_id);
  else
    return null;
  end if;
  for v_uid in select user_id from public.profiles where role = 'admin' and profile_status = 'active' loop
    perform public.push_notification(v_uid, v_type, v_title, v_body, v_data);
  end loop;
  return null;
end $$;
drop trigger if exists trg_notify_hq_payment on public.manual_payments;
create trigger trg_notify_hq_payment after insert on public.manual_payments
  for each row execute function public.notify_hq();
drop trigger if exists trg_notify_hq_lead on public.leads;
create trigger trg_notify_hq_lead after insert on public.leads
  for each row execute function public.notify_hq();
drop trigger if exists trg_notify_hq_verification on public.companies;
create trigger trg_notify_hq_verification after update of verification_requested on public.companies
  for each row execute function public.notify_hq();
drop trigger if exists trg_notify_hq_report on public.reports;
create trigger trg_notify_hq_report after insert on public.reports
  for each row execute function public.notify_hq();

-- The card payment link the MD submitted is public by nature (it is a hosted
-- checkout page), so employers can see it at checkout. Nothing else from the
-- banking record is exposed.
create or replace function public.public_payment_link()
returns text language sql stable security definer set search_path = public as $$
  select nullif(wompi_payment_link_url, '') from public.business_banking
   order by updated_at desc nulls last limit 1
$$;
revoke all on function public.public_payment_link() from public, anon;
grant execute on function public.public_payment_link() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 18. Team invites that actually grant access
-- ═════════════════════════════════════════════════════════════════════════════
-- An invite is a team_members row with status 'pending' and invite_email set.
-- When the invited person signs in, accept_team_invites() binds it to them.
create or replace function public.accept_team_invites()
returns integer language plpgsql security definer set search_path = public, auth as $$
declare v_email text; v_n integer;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  update public.team_members
     set user_id = auth.uid()::text, status = 'active', updated_at = now()
   where status = 'pending' and lower(invite_email) = v_email
     and role in ('admin', 'member');
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.accept_team_invites() from public, anon;
grant execute on function public.accept_team_invites() to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 19. Privacy (Ley 1581): consent records, data export, deletion request
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists data_processing_consent_at timestamptz;
alter table public.profiles add column if not exists marketing_consent boolean not null default false;
alter table public.profiles add column if not exists deletion_requested_at timestamptz;

create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = auth.uid()::text),
    'applications', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.applications a where a.candidate_id = public.current_profile_id()),
    'messages', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.messages m where m.sender_id = public.current_profile_id()),
    'saved_jobs', (select coalesce(jsonb_agg(to_jsonb(s)), '[]') from public.saved_jobs s where s.candidate_id = public.current_profile_id()),
    'work_experience', (select coalesce(jsonb_agg(to_jsonb(w)), '[]') from public.candidate_work_experience w where w.profile_id = public.current_profile_id()),
    'education', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.candidate_education e where e.profile_id = public.current_profile_id()),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notifications n where n.user_id = auth.uid()::text),
    'exported_at', now()
  )
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

create or replace function public.request_account_deletion()
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text;
begin
  update public.profiles set deletion_requested_at = now() where user_id = auth.uid()::text;
  if not found then raise exception 'profile not found'; end if;
  for v_uid in select user_id from public.profiles where role = 'admin' and profile_status = 'active' loop
    perform public.push_notification(v_uid, 'deletion_requested', 'Account deletion requested',
      'A user asked to delete their data (Ley 1581: answer within 15 business days)',
      jsonb_build_object('user_id', auth.uid()::text));
  end loop;
end $$;
revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- HQ: erase a person's personal data while keeping anonymous counts.
create or replace function public.admin_anonymize_profile(p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid text;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  select user_id into v_uid from public.profiles where id = p_profile_id;
  delete from public.candidate_documents where profile_id = p_profile_id;
  delete from public.candidate_work_experience where profile_id = p_profile_id;
  delete from public.candidate_education where profile_id = p_profile_id;
  delete from public.candidate_skills where profile_id = p_profile_id;
  delete from public.candidate_languages where profile_id = p_profile_id;
  delete from public.saved_jobs where candidate_id = p_profile_id;
  delete from public.notifications where user_id = v_uid;
  update public.messages set body = '[deleted]' where sender_id = p_profile_id;
  update public.applications set cover_letter = null where candidate_id = p_profile_id;
  update public.profiles
     set full_name = 'Deleted user', email = null, phone = null, location = null, bio = null,
         languages = null, avatar_url = null, cv_url = null, parsed_cv_text = null,
         linkedin_url = null, twitter_url = null, instagram_url = null, whatsapp_number = null,
         tiktok_url = null, youtube_url = null, marketing_consent = false, updated_at = now()
   where id = p_profile_id;
  perform public.write_admin_audit('profile.anonymize', 'profile', p_profile_id::text);
end $$;
revoke all on function public.admin_anonymize_profile(uuid) from public, anon;
grant execute on function public.admin_anonymize_profile(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 20. Function search paths + grants for new tables
-- ═════════════════════════════════════════════════════════════════════════════
grant select, insert, update, delete on public.application_private to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
grant select on public.admin_audit_log to authenticated;
grant select on public.billing_packages to anon, authenticated;
revoke all on public.application_private, public.meetings, public.admin_audit_log from anon;

-- ═════════════════════════════════════════════════════════════════════════════
-- 21. Canonical row-level security for the marketplace tables
--
-- The repo's earlier policies reference each other in a cycle (applications →
-- profiles → applications), which Postgres rejects, and the live database was
-- hand-patched over time. To end the drift, this section DROPS EVERY EXISTING
-- POLICY on these tables and recreates one complete set. Cross-table checks go
-- through SECURITY DEFINER helpers, so no policy ever re-enters another.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies c
                 where c.id = p_company_id and c.employer_id = auth.uid()::text)
      or exists (select 1 from public.team_members tm
                 where tm.company_id = p_company_id and tm.user_id = auth.uid()::text
                   and tm.status = 'active' and tm.role in ('owner', 'admin'))
$$;

-- Editors plus an assigned, active Managing Director (read-only seat).
create or replace function public.is_company_viewer(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_company_editor(p_company_id)
      or (coalesce(public.current_user_role(), '') = 'md'
          and exists (select 1 from public.team_members tm
                      where tm.company_id = p_company_id and tm.user_id = auth.uid()::text
                        and tm.status = 'active' and tm.role = 'md'))
$$;

create or replace function public.is_application_candidate(p_application_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications a
                 where a.id = p_application_id and a.candidate_id = public.current_profile_id())
$$;

create or replace function public.can_view_application(p_application_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_application_candidate(p_application_id)
      or coalesce(public.current_user_role(), '') = 'admin'
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
                 where a.id = p_application_id and public.is_company_viewer(j.company_id))
$$;

create or replace function public.job_company(p_job_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.jobs where id = p_job_id
$$;

create or replace function public.job_has_applications(p_job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.applications where job_id = p_job_id)
$$;

-- Who may read a profile row.
create or replace function public.can_see_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with target as (select id, user_id from public.profiles where id = p_profile_id)
  select exists (
    select 1 from target t where
      t.user_id = auth.uid()::text
      or coalesce(public.current_user_role(), '') = 'admin'
      -- employers (and assigned MDs) see their applicants
      or exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
                 where a.candidate_id = t.id and public.is_company_viewer(j.company_id))
      -- colleagues on the same company team
      or exists (select 1 from public.team_members tm
                 where tm.user_id = t.user_id and tm.status = 'active'
                   and public.is_company_viewer(tm.company_id))
      or exists (select 1 from public.companies c
                 where c.employer_id = t.user_id and public.is_company_viewer(c.id))
      -- candidates see the recruiter assigned to them and staff who messaged them
      or exists (select 1 from public.applications a
                 where a.candidate_id = public.current_profile_id() and a.recruiter_id = t.id)
      or exists (select 1 from public.messages m
                 where m.sender_id = t.id and public.is_application_candidate(m.application_id))
  )
$$;

do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename in (
              'profiles', 'companies', 'jobs', 'applications', 'application_private',
              'application_status_history', 'offers', 'messages', 'interviews',
              'application_feedback', 'interview_scorecards', 'interview_scorecard_questions',
              'saved_jobs', 'reports', 'leads', 'notifications', 'team_members',
              'candidate_work_experience', 'candidate_education', 'candidate_skills',
              'candidate_languages', 'candidate_documents', 'meetings')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- every table below has RLS on
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.offers enable row level security;
alter table public.messages enable row level security;
alter table public.interviews enable row level security;
alter table public.application_feedback enable row level security;
alter table public.interview_scorecards enable row level security;
alter table public.interview_scorecard_questions enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.reports enable row level security;
alter table public.leads enable row level security;
alter table public.notifications enable row level security;
alter table public.team_members enable row level security;

-- profiles
create policy profiles_select on public.profiles for select using (public.can_see_profile(id));
create policy profiles_insert_own on public.profiles for insert with check (user_id = auth.uid()::text);
create policy profiles_update_own on public.profiles for update
  using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy profiles_update_admin on public.profiles for update
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- companies (anonymous visitors are additionally limited to public columns)
create policy companies_select_public on public.companies for select using (true);
create policy companies_insert_own on public.companies for insert
  with check (employer_id = auth.uid()::text and public.current_user_role() = 'employer');
create policy companies_update_team on public.companies for update
  using (public.is_company_editor(id)) with check (public.is_company_editor(id));
create policy companies_update_admin on public.companies for update
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy companies_delete_admin on public.companies for delete
  using (public.current_user_role() = 'admin');

-- jobs
create policy jobs_select_public on public.jobs for select using (
  status = 'open' and moderation_status = 'approved' and paused_at is null
  and archived_at is null and (expires_at is null or expires_at > now()));
create policy jobs_select_company on public.jobs for select using (public.is_company_viewer(company_id));
create policy jobs_select_applicant on public.jobs for select using (public.has_applied_to_job(id));
create policy jobs_select_admin on public.jobs for select using (public.current_user_role() = 'admin');
create policy jobs_insert_team on public.jobs for insert with check (
  public.is_company_editor(company_id) and (status <> 'open' or public.company_is_verified(company_id)));
create policy jobs_update_team on public.jobs for update using (public.is_company_editor(company_id))
  with check (public.is_company_editor(company_id) and (status <> 'open' or public.company_is_verified(company_id)));
create policy jobs_admin_all on public.jobs for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
-- A job with applicants is closed/archived, never deleted (keeps candidate history).
create policy jobs_delete_team on public.jobs for delete
  using (public.is_company_editor(company_id) and not public.job_has_applications(id));

-- applications
create policy applications_select on public.applications for select using (public.can_view_application(id));
create policy applications_insert_candidate on public.applications for insert with check (
  candidate_id = public.current_profile_id()
  and exists (select 1 from public.jobs j where j.id = job_id and public.job_is_public(j)));
create policy applications_update_team on public.applications for update
  using (public.can_manage_application(id)) with check (public.can_manage_application(id));
create policy applications_admin_all on public.applications for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy application_private_rw on public.application_private for all
  using (public.can_manage_application(application_id) or public.current_user_role() = 'admin')
  with check (public.can_manage_application(application_id) or public.current_user_role() = 'admin');

create policy ash_select on public.application_status_history for select
  using (public.can_view_application(application_id));

-- offers
create policy offers_select on public.offers for select using (public.can_view_application(application_id));
create policy offers_insert_team on public.offers for insert with check (public.can_manage_application(application_id));
create policy offers_update_team on public.offers for update
  using (public.can_manage_application(application_id)) with check (public.can_manage_application(application_id));
create policy offers_admin_all on public.offers for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- messages
create policy messages_select on public.messages for select using (public.can_view_application(application_id));
create policy messages_insert_candidate on public.messages for insert with check (
  public.is_application_candidate(application_id) and sender_id = public.current_profile_id());
create policy messages_insert_team on public.messages for insert with check (
  public.can_manage_application(application_id) and sender_id = public.current_profile_id());

-- interviews (+ scorecards)
create policy interviews_select on public.interviews for select using (
  candidate_id = public.current_profile_id() or public.is_company_viewer(company_id)
  or public.current_user_role() = 'admin');
create policy interviews_insert_team on public.interviews for insert with check (
  public.is_company_editor(company_id)
  and public.job_company(job_id) = company_id
  and exists (select 1 from public.applications a
              where a.job_id = interviews.job_id and a.candidate_id = interviews.candidate_id));
create policy interviews_update_team on public.interviews for update
  using (public.is_company_editor(company_id)) with check (public.is_company_editor(company_id));
create policy interviews_delete_admin on public.interviews for delete using (public.is_company_admin(company_id));

create policy scorecards_select on public.interview_scorecards for select using (
  exists (select 1 from public.interviews i where i.id = interview_id and public.is_company_viewer(i.company_id))
  or public.current_user_role() = 'admin');
create policy scorecards_write on public.interview_scorecards for all using (
  exists (select 1 from public.interviews i where i.id = interview_id and public.is_company_editor(i.company_id)))
  with check (exists (select 1 from public.interviews i where i.id = interview_id and public.is_company_editor(i.company_id)));
create policy questions_select on public.interview_scorecard_questions for select using (
  exists (select 1 from public.interview_scorecards s join public.interviews i on i.id = s.interview_id
          where s.id = scorecard_id and public.is_company_viewer(i.company_id))
  or public.current_user_role() = 'admin');
create policy questions_write on public.interview_scorecard_questions for all using (
  exists (select 1 from public.interview_scorecards s join public.interviews i on i.id = s.interview_id
          where s.id = scorecard_id and public.is_company_editor(i.company_id)))
  with check (exists (select 1 from public.interview_scorecards s join public.interviews i on i.id = s.interview_id
          where s.id = scorecard_id and public.is_company_editor(i.company_id)));

-- structured feedback
create policy feedback_select on public.application_feedback for select using (
  public.is_company_viewer(company_id) or public.current_user_role() = 'admin'
  or (visibility = 'candidate_visible' and public.is_application_candidate(application_id)));
create policy feedback_insert_team on public.application_feedback for insert with check (
  public.is_company_editor(company_id)
  and exists (select 1 from public.applications a join public.jobs j on j.id = a.job_id
              where a.id = application_feedback.application_id and j.company_id = application_feedback.company_id));
create policy feedback_update_team on public.application_feedback for update
  using (public.is_company_editor(company_id)) with check (public.is_company_editor(company_id));
create policy feedback_delete_admin on public.application_feedback for delete using (public.is_company_admin(company_id));

-- saved jobs
create policy saved_jobs_own on public.saved_jobs for all
  using (candidate_id = public.current_profile_id()) with check (candidate_id = public.current_profile_id());

-- reports (inserted only through report_job)
create policy reports_select_admin on public.reports for select using (public.current_user_role() = 'admin');
create policy reports_update_admin on public.reports for update
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- leads
create policy leads_insert_public on public.leads for insert to anon, authenticated
  with check (status = 'new' and notes is null);
create policy leads_select_staff on public.leads for select using (public.current_user_role() in ('admin', 'md'));
create policy leads_update_staff on public.leads for update
  using (public.current_user_role() in ('admin', 'md')) with check (public.current_user_role() in ('admin', 'md'));
create policy leads_delete_admin on public.leads for delete using (public.current_user_role() = 'admin');

-- notifications (rows are created by the database; users read/mark/delete theirs)
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid()::text);
create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy notifications_delete_own on public.notifications for delete using (user_id = auth.uid()::text);

-- team members (owner/MD seats guarded by trg_guard_team_members)
create policy team_members_select on public.team_members for select using (
  user_id = auth.uid()::text or public.is_company_viewer(company_id) or public.current_user_role() = 'admin');
create policy team_members_insert on public.team_members for insert with check (public.is_company_admin(company_id));
create policy team_members_update on public.team_members for update
  using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
create policy team_members_delete on public.team_members for delete using (public.is_company_admin(company_id));
create policy team_members_admin_all on public.team_members for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- candidate enrichment
do $$
declare t text;
begin
  foreach t in array array['candidate_work_experience', 'candidate_education',
                           'candidate_skills', 'candidate_languages', 'candidate_documents'] loop
    execute format('create policy %I on public.%I for select using (public.can_view_candidate(profile_id))', t || '_select', t);
    execute format('create policy %I on public.%I for all using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id())', t || '_write_own', t);
  end loop;
end $$;

-- MD meetings
create policy meetings_md_own on public.meetings for all
  using (md_user_id = auth.uid()::text and public.current_user_role() = 'md')
  with check (md_user_id = auth.uid()::text and public.current_user_role() = 'md');
create policy meetings_admin on public.meetings for all
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Helper functions are internal: callers use them through policies only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.current_profile_id()', 'public.is_company_editor(uuid)', 'public.is_company_admin(uuid)',
    'public.is_company_viewer(uuid)', 'public.is_application_candidate(uuid)', 'public.can_view_application(uuid)',
    'public.can_manage_application(uuid)', 'public.job_company(uuid)', 'public.job_has_applications(uuid)',
    'public.can_see_profile(uuid)', 'public.can_view_candidate(uuid)', 'public.has_applied_to_job(uuid)',
    'public.is_privileged_session()', 'public.request_jwt_role()'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated, service_role', f);
  end loop;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 22. Anonymous visitors may only run the functions they actually need
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare r record;
  allow text[] := array[
    -- visitor features
    'report_job', 'search_vetted_caregivers',
    -- helpers evaluated inside row-level policies for every caller
    'current_user_role', 'current_profile_id', 'has_applied_to_job', 'company_is_verified',
    'is_company_viewer', 'is_company_editor', 'is_company_admin', 'can_view_application',
    'is_application_candidate', 'can_manage_application', 'can_see_profile', 'can_view_candidate',
    'job_company', 'job_has_applications', 'is_privileged_session', 'is_team_member', 'is_team_admin'];
begin
  for r in select p.oid::regprocedure as sig, p.proname
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prosecdef
              and has_function_privilege('anon', p.oid, 'execute')
              and not (p.proname = any (allow))
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
