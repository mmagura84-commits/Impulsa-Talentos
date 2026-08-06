-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Supabase schema (migration 001)
-- Run in the Supabase SQL editor or via `supabase db push`.
--
-- NOTE on RLS: tables are created WITHOUT row-level security so the anon key
-- behaves like the previous permissive Blink DB. Add RLS policies later once
-- auth → user_id ownership rules are decided (see TODO at the bottom).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  role text not null default 'candidate' check (role in ('candidate','employer','admin')),
  full_name text not null default '',
  email text,
  phone text,
  location text,
  bio text,
  languages text,
  avatar_url text,
  cv_url text,
  notification_prefs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_user_id_idx on public.profiles (user_id);

-- ── companies ────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  employer_id text not null,
  name text not null,
  industry text,
  size text,
  location text,
  website text,
  description text,
  logo_url text,
  contact_email text,
  verified boolean not null default false,
  verification_requested boolean not null default false,
  -- NOTE: Must match NEW_COMPANY_TRIAL_CREDITS in src/lib/pricing.ts (currently 2).
  job_credits integer not null default 2,
  created_at timestamptz not null default now()
);
create index if not exists companies_employer_id_idx on public.companies (employer_id);

-- ── jobs ─────────────────────────────────────────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  description text not null default '',
  level text,
  location_type text,
  salary_min numeric,
  salary_max numeric,
  currency text default 'USD',
  skills_required text,
  languages_required text,
  status text not null default 'open' check (status in ('open','closed','draft')),
  moderation_status text not null default 'approved' check (moderation_status in ('pending','approved','rejected')),
  moderation_reason text,
  industry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_company_id_idx on public.jobs (company_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_industry_idx on public.jobs (industry);
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);

-- ── applications ─────────────────────────────────────────────────────────────
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  -- NOTE: Migration 012 fixes candidate_id to uuid + FK. Code passes profiles.id.
  candidate_id text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','interview','offered','hired','rejected')),
  cover_letter text,
  interview_link text,
  interview_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_job_id_idx on public.applications (job_id);
create index if not exists applications_candidate_id_idx on public.applications (candidate_id);
create unique index if not exists applications_job_candidate_uniq on public.applications (job_id, candidate_id);

-- ── saved_jobs ───────────────────────────────────────────────────────────────
create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  -- NOTE: Migration 012 fixes candidate_id to uuid + FK. Code passes profiles.id.
  candidate_id text not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (candidate_id, job_id)
);
create index if not exists saved_jobs_candidate_id_idx on public.saved_jobs (candidate_id);

-- ── company_reviews ──────────────────────────────────────────────────────────
create table if not exists public.company_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reviewer_id text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists company_reviews_company_id_idx on public.company_reviews (company_id);

-- ── reports ──────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  reporter_id text not null default 'anonymous',
  reason text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists reports_job_id_idx on public.reports (job_id);

-- ── storage bucket for CVs / avatars ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', true)
on conflict (id) do nothing;

-- TODO(follow-up): replace the permissive defaults with RLS policies once the
-- ownership model is ratified, e.g.:
--   alter table public.profiles enable row level security;
--   create policy "profiles_select" on public.profiles for select using (true);
--   create policy "profiles_own" on public.profiles for all using (auth.uid() = user_id);
