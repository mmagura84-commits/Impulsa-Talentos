-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Home & Care vertical Phase 0 (migration 031)   [PTL]
-- ─────────────────────────────────────────────────────────────────────────────
-- Owner direction 2026-08-20 (all 9 design decisions ACCEPTED); PTL feasibility
-- verdict FEASIBLE; front-end contract: /home/team/shared/home-care-vertical-phase0-signatures.md
--
-- Build content (matches upstream PR #144 schema contract exactly):
--   1. polymorphic household: companies.entity_type + households extension (household = role='employer',
--      NO new role — never touch profiles.role CHECK)
--   2. caregiver_profiles (caregiver = role='candidate') + verifications ledger
--   3. care-vacancy 'care' jsonb on jobs (matches Job.care? CareVacancyFields)
--   4. SECURITY DEFINER RPCs (NO-RAW-SUBQUERY rule, PR #130/029):
--        search_vetted_caregivers       (verified-only, safe fields, PUBLIC directory)
--        admin_list_caregivers          (admin role, HQ screening tab)
--        set_caregiver_verification_status (admin/PTL-only, monotonic, rejected terminal)
--        save_caregiver_profile         (self-write whitelist wrapper)
--   5. RLS: caregiver_profiles/households — NO broad public/authenticated SELECT (Law 1581).
--      Hide-unscreened is ENFORCED at the data layer (non-bypassable).
--   6. storage: reuse private cvs bucket for care/** documents (owner adds object policy).
--
-- Apply: owner SQL Editor (live cmdqlybsgkegolqydmbh) AFTER 030 (apply order independent).
-- This migration is idempotent (create-or-replace / if-not-exists).
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Polymorphic household (Option A — subtype on companies)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.companies
  add column if not exists entity_type text not null default 'company'
    check (entity_type in ('company','household'));

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  contact_name text not null default '',
  barrio text,
  care_competency text,
  num_children int not null default 0,
  num_elderly int not null default 0,
  live_in_available boolean not null default false,
  pets boolean not null default false,
  languages text[],
  schedule_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists households_company_id_idx on public.households (company_id);
-- household/health PII is Law-1581 high-sensitivity — only owning employer + admin.
alter table public.households enable row level security;
drop policy if exists "households_owner" on public.households;
create policy "households_owner" on public.households
  for select using (company_id in (
    select c.id from public.companies c where c.employer_id = auth.uid()::text
  ));
-- NO public/anon policy on households. None.

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Care-vacancy 'care' jsonb on jobs (matches Job.care?: CareVacancyFields)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.jobs
  add column if not exists care jsonb;
create index if not exists jobs_household_care_idx on public.jobs ((care)) where care is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. caregiver_profiles + verifications ledger
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.caregiver_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,                      -- profiles.user_id (auth.uid()::text)
  competencies text[] not null default '{}',
  availability text not null default '',
  live_in_live_out text not null default '',
  age_bands text[] not null default '{}',            -- nanny only
  barrio text,
  city text not null default 'Medellín',
  languages text[] not null default '{}',
  years_experience int not null default 0,
  certifications text[] not null default '{}',
  about text not null default '',
  photo_pointer text,                                -- cvs public avatar pointer
  identity_pointer text,                             -- PRIVATE doc pointer (admin only)
  background_check_pointer text,                     -- PRIVATE
  certificate_pointer text,                          -- PRIVATE
  "references" text,                            -- PRIVATE screening detail (admin only)
  verification_status text not null default 'unverified'
      check (verification_status in (
        'unverified','identity_pending','background_pending','references_pending','verified','rejected')),
  verification_updated_at timestamptz,
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists caregiver_profiles_status_idx on public.caregiver_profiles (verification_status);
create index if not exists caregiver_profiles_barrio_idx on public.caregiver_profiles (barrio);

-- verifications ledger — monotonic, who/when/how, never self-attested.
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  caregiver_profile_id uuid not null references public.caregiver_profiles(id) on delete cascade,
  kind text not null check (kind in ('identity','background','references','certificate','status')),
  status text not null,
  performed_by text not null,                        -- profiles.user_id of admin/PTL
  note text,
  created_at timestamptz not null default now()
);
create index if not exists verifications_caregiver_idx on public.verifications (caregiver_profile_id);
alter table public.verifications enable row level security;
-- NO public/authenticated policy. Admin/PTL write via SD RPCs only. None.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS on caregiver_profiles — self-only + admin; NO broad public/anon SELECT
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.caregiver_profiles enable row level security;
drop policy if exists "caregiver_profiles_self_select" on public.caregiver_profiles;
create policy "caregiver_profiles_self_select" on public.caregiver_profiles
  for select using (user_id = auth.uid()::text);
drop policy if exists "caregiver_profiles_self_update" on public.caregiver_profiles;
create policy "caregiver_profiles_self_update" on public.caregiver_profiles
  for update using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
drop policy if exists "caregiver_profiles_self_insert" on public.caregiver_profiles;
create policy "caregiver_profiles_self_insert" on public.caregiver_profiles
  for insert with check (user_id = auth.uid()::text);
-- admin read (perf net; enforcement is the SD RPC)
drop policy if exists "caregiver_profiles_admin_select" on public.caregiver_profiles;
create policy "caregiver_profiles_admin_select" on public.caregiver_profiles
  for select using (public.current_user_role() = 'admin');
-- ⛔ NO public/anon/authenticated list policy. None.

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SECURITY DEFINER RPCs
-- ═══════════════════════════════════════════════════════════════════════════
-- 5a. PUBLIC directory — verified-only, safe fields ONLY. Non-bypassable.
create or replace function public.search_vetted_caregivers(
  p_competency text default null,
  p_barrio text default null,
  p_live_in_live_out text default null,
  p_certification text default null
) returns table (
  id uuid,
  user_id text,
  competencies text[],
  availability text,
  live_in_live_out text,
  age_bands text[],
  barrio text,
  city text,
  languages text[],
  years_experience int,
  certifications text[],
  about text,
  photo_pointer text,
  verification_status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    cp.id, cp.user_id, cp.competencies, cp.availability, cp.live_in_live_out,
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

-- 5b. Admin HQ read — admin role only (returns full rows incl. pointers for signed URLs).
create or replace function public.admin_list_caregivers(
  p_admin_uid text,
  p_limit int default 100
) returns setof public.caregiver_profiles
language sql
security definer
set search_path = public
as $$
  select cp.*
  from public.caregiver_profiles cp
  where exists (
    select 1 from public.profiles pr
    where pr.user_id = p_admin_uid and pr.role = 'admin'
  )
  order by cp.updated_at desc
  limit p_limit;
$$;

-- 5c. Status transition — admin/PTL-only, monotonic forward, rejected terminal.
create or replace function public.set_caregiver_verification_status(
  target_profile_id uuid,
  new_status text,
  admin_note text default null
) returns public.caregiver_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_admin boolean;
  cur public.caregiver_profiles;
  ord text[] := array['unverified','identity_pending','background_pending','references_pending','verified'];
  cur_idx int; new_idx int;
begin
  select exists(
    select 1 from public.profiles pr where pr.user_id = v_caller and pr.role = 'admin'
  ) into v_admin;
  if not v_admin then
    raise exception 'only admins may change caregiver verification status';
  end if;

  select * into cur from public.caregiver_profiles where id = target_profile_id;
  if not found then
    raise exception 'caregiver_profile not found: %', target_profile_id;
  end if;

  if cur.verification_status = 'rejected' then
    raise exception 'cannot transition from terminal rejected state';
  end if;
  if new_status = 'rejected' then
    update public.caregiver_profiles
       set verification_status = 'rejected',
           verification_updated_at = now(),
           verification_note = coalesce(admin_note, verification_note),
           updated_at = now()
     where id = target_profile_id
     returning * into cur;
    insert into public.verifications(caregiver_profile_id, kind, status, performed_by, note)
      values (target_profile_id, 'status', 'rejected', v_caller, admin_note);
    return cur;
  end if;

  cur_idx := array_position(ord, cur.verification_status);
  new_idx := array_position(ord, new_status);
  if new_idx is null then
    raise exception 'invalid new_status: %', new_status;
  end if;
  if new_idx < cur_idx then
    raise exception 'verification status cannot regress: % -> %', cur.verification_status, new_status;
  end if;

  update public.caregiver_profiles
     set verification_status = new_status,
         verification_updated_at = now(),
         verification_note = coalesce(admin_note, verification_note),
         updated_at = now()
   where id = target_profile_id
   returning * into cur;
  insert into public.verifications(caregiver_profile_id, kind, status, performed_by, note)
    values (target_profile_id, 'status', new_status, v_caller, admin_note);
  return cur;
end $$;

-- 5d. Caregiver self-write — whitelists writable self-attested columns ONLY.
--     Denies verification_status, pointers, and gated columns from direct updates.
create or replace function public.save_caregiver_profile(
  p_user_id text,
  p_competencies text[] default null,
  p_availability text default null,
  p_live_in_live_out text default null,
  p_age_bands text[] default null,
  p_barrio text default null,
  p_city text default null,
  p_languages text[] default null,
  p_years_experience int default null,
  p_certifications text[] default null,
  p_about text default null,
  p_photo_pointer text default null
) returns public.caregiver_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  cur public.caregiver_profiles;
begin
  if p_user_id <> auth.uid()::text then
    raise exception 'can only edit your own caregiver profile';
  end if;

  select * into cur from public.caregiver_profiles where user_id = p_user_id;
  if not found then
    insert into public.caregiver_profiles(user_id, competencies, availability, live_in_live_out,
        age_bands, barrio, city, languages, years_experience, certifications, about, photo_pointer)
    values (p_user_id,
        coalesce(p_competencies, '{}'), coalesce(p_availability, ''),
        coalesce(p_live_in_live_out, ''), coalesce(p_age_bands, '{}'),
        p_barrio, coalesce(p_city, 'Medellín'), coalesce(p_languages, '{}'),
        coalesce(p_years_experience, 0), coalesce(p_certifications, '{}'),
        coalesce(p_about, ''), p_photo_pointer)
    returning * into cur;
    return cur;
  end if;

  -- whitelist-update: never touch verification_status / *_pointer / references here
  update public.caregiver_profiles
     set competencies      = coalesce(p_competencies, competencies),
         availability      = coalesce(p_availability, availability),
         live_in_live_out  = coalesce(p_live_in_live_out, live_in_live_out),
         age_bands         = coalesce(p_age_bands, age_bands),
         barrio            = coalesce(p_barrio, barrio),
         city              = coalesce(p_city, city),
         languages         = coalesce(p_languages, languages),
         years_experience  = coalesce(p_years_experience, years_experience),
         certifications    = coalesce(p_certifications, certifications),
         about             = coalesce(p_about, about),
         photo_pointer     = coalesce(p_photo_pointer, photo_pointer),
         updated_at        = now()
   where user_id = p_user_id
   returning * into cur;
  return cur;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. OWNER APPLIES SEPARATELY (storage object policy for care/** documents)
--    (supabase_storage_admin is reserved on this platform — team/`postgres` cannot
--     execute it; owner SQL Editor one-liner, exactly like 016/027 cvs patterns.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Verification probes (owner runs after apply; expect the counts below)
-- ═══════════════════════════════════════════════════════════════════════════
-- select attname from pg_attribute where attrelid='public.caregiver_profiles'::regclass and not attisdropped; -- 18 cols
-- select proname from pg_proc where proname in ('search_vetted_caregivers','admin_list_caregivers','set_caregiver_verification_status','save_caregiver_profile'); -- 4 rows
-- select count(*) from pg_policies where tablename='caregiver_profiles'; -- 4 policies (self x3 + admin)
-- RLS probe (expect anon/authenticated read of caregiver_profiles → 0 rows): 
--   select set_config('role','anon',true); select * from caregiver_profiles; -- 0 rows (no policy)

COMMIT;
