-- 046 — Clear the Supabase database advisor warnings (security + performance).
--
-- 1. Fixed search_path on the three functions that lacked one, so a caller
--    can't shadow the tables they read by creating objects earlier on the path.
-- 2. Row-level policies that called auth.uid()/auth.jwt()/auth.role() directly
--    re-ran that call for every row. Wrapping it as (select auth.uid()) lets
--    Postgres run it once per query. Same result, rewritten in place for every
--    public policy that still has a bare call (idempotent: a second run finds
--    nothing to change).
-- 3. Indexes for the 14 foreign keys that had none (joins and cascading
--    deletes would otherwise scan the whole child table).
-- 4. The public caregiver directory stops returning each caregiver's internal
--    account id (user_id). Nothing on the page needs it, and anonymous
--    visitors can call this function.

-- ── 1. search_path ─────────────────────────────────────────────────────────
alter function public.guard_notification_update() set search_path = public, pg_temp;
alter function public.job_is_public(public.jobs) set search_path = public, pg_temp;
alter function public.request_jwt_role() set search_path = public, pg_temp;

-- ── 2. auth.*() once per query in row-level policies ───────────────────────
do $$
declare
  r record;
  bare constant text := '(?<!SELECT )auth\.(uid|jwt|role)\(\)';
  new_qual text;
  new_check text;
  stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ bare or coalesce(with_check, '') ~ bare)
  loop
    new_qual  := regexp_replace(r.qual,       bare, '(select auth.\1())', 'g');
    new_check := regexp_replace(r.with_check, bare, '(select auth.\1())', 'g');
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then stmt := stmt || format(' using (%s)', new_qual); end if;
    if r.with_check is not null then stmt := stmt || format(' with check (%s)', new_check); end if;
    execute stmt;
  end loop;
end $$;

-- ── 3. Foreign-key indexes ─────────────────────────────────────────────────
create index if not exists application_status_history_application_id_idx on public.application_status_history (application_id);
create index if not exists application_status_history_changed_by_idx     on public.application_status_history (changed_by);
create index if not exists applications_recruiter_id_idx                 on public.applications (recruiter_id);
create index if not exists candidate_documents_profile_id_idx            on public.candidate_documents (profile_id);
create index if not exists candidate_education_profile_id_idx            on public.candidate_education (profile_id);
create index if not exists candidate_languages_profile_id_idx            on public.candidate_languages (profile_id);
create index if not exists candidate_skills_profile_id_idx               on public.candidate_skills (profile_id);
create index if not exists candidate_work_experience_profile_id_idx      on public.candidate_work_experience (profile_id);
create index if not exists card_payments_company_id_idx                  on public.card_payments (company_id);
create index if not exists card_payments_package_id_idx                  on public.card_payments (package_id);
create index if not exists interviews_created_by_idx                     on public.interviews (created_by);
create index if not exists manual_payments_company_id_idx                on public.manual_payments (company_id);
create index if not exists meetings_company_id_idx                       on public.meetings (company_id);
create index if not exists saved_jobs_job_id_idx                         on public.saved_jobs (job_id);

-- ── 4. Caregiver directory: no account ids ─────────────────────────────────
drop function if exists public.search_vetted_caregivers(text, text, text, text);
create function public.search_vetted_caregivers(
  p_competency text default null,
  p_barrio text default null,
  p_live_in_live_out text default null,
  p_certification text default null
)
returns table (
  id uuid, competencies text[], availability text, live_in_live_out text,
  age_bands text[], barrio text, city text, languages text[], years_experience integer,
  certifications text[], about text, photo_pointer text, verification_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cp.id, cp.competencies, cp.availability, cp.live_in_live_out,
    cp.age_bands, cp.barrio, cp.city, cp.languages, cp.years_experience,
    cp.certifications, cp.about, cp.photo_pointer, cp.verification_status, cp.created_at
  from public.caregiver_profiles cp
  where cp.verification_status = 'verified'
    and (p_competency        is null or p_competency        = any(cp.competencies))
    and (p_barrio            is null or cp.barrio           = p_barrio)
    and (p_live_in_live_out  is null or cp.live_in_live_out = p_live_in_live_out)
    and (p_certification     is null or p_certification     = any(cp.certifications))
  order by cp.created_at desc;
$$;
revoke all on function public.search_vetted_caregivers(text, text, text, text) from public;
grant execute on function public.search_vetted_caregivers(text, text, text, text) to anon, authenticated, service_role;
