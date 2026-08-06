-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Messages & Offers (migration 015)
--
-- Adds P1 employer-only workflows:
--   1. messages — employer ↔ candidate messaging scoped to applications
--   2. offers   — employer offer workflow (send/revise/withdraw)
--
-- RLS: employers can read/write messages/offers for their company's applications.
--      Candidates can read messages/offers for their own applications.
--      Admins have read-only access.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── messages ─────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  sender_id uuid not null, -- profiles.id of sender (employer or candidate)
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_application_id_idx on public.messages (application_id);
create index if not exists messages_created_at_idx on public.messages (created_at);

alter table public.messages enable row level security;

-- Employer: can read messages for applications on their company's jobs
drop policy if exists "messages_select_employer" on public.messages;
create policy "messages_select_employer" on public.messages
  for select using (
    application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  );

-- Employer: can insert messages on their company's applications
drop policy if exists "messages_insert_employer" on public.messages;
create policy "messages_insert_employer" on public.messages
  for insert with check (
    application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
    and
    sender_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

-- Candidate: can read messages on their own applications
drop policy if exists "messages_select_candidate" on public.messages;
create policy "messages_select_candidate" on public.messages
  for select using (
    application_id in (
      select id from public.applications
      where candidate_id = (
        select id from public.profiles where user_id = auth.uid()::text limit 1
      )
    )
  );

-- Candidate: can insert messages on their own applications
drop policy if exists "messages_insert_candidate" on public.messages;
create policy "messages_insert_candidate" on public.messages
  for insert with check (
    application_id in (
      select id from public.applications
      where candidate_id = (
        select id from public.profiles where user_id = auth.uid()::text limit 1
      )
    )
    and
    sender_id = (
      select id from public.profiles where user_id = auth.uid()::text limit 1
    )
  );

-- Admin: read-only on all messages
drop policy if exists "messages_select_admin" on public.messages;
create policy "messages_select_admin" on public.messages
  for select using (public.current_user_role() = 'admin');

-- ── offers ───────────────────────────────────────────────────────────────────
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  salary numeric not null,
  currency text not null default 'COP',
  start_date text, -- ISO date string
  notes text,
  status text not null default 'pending' check (status in ('pending','revised','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_application_id_idx on public.offers (application_id);

alter table public.offers enable row level security;

-- Employer: can read offers for applications on their company's jobs
drop policy if exists "offers_select_employer" on public.offers;
create policy "offers_select_employer" on public.offers
  for select using (
    application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  );

-- Employer: can insert offers on their company's applications
drop policy if exists "offers_insert_employer" on public.offers;
create policy "offers_insert_employer" on public.offers
  for insert with check (
    application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  );

-- Employer: can update offers on their company's applications
drop policy if exists "offers_update_employer" on public.offers;
create policy "offers_update_employer" on public.offers
  for update using (
    application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  ) with check (
    application_id in (
      select a.id from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where c.employer_id = auth.uid()::text
    )
  );

-- Candidate: can read offers on their own applications
drop policy if exists "offers_select_candidate" on public.offers;
create policy "offers_select_candidate" on public.offers
  for select using (
    application_id in (
      select id from public.applications
      where candidate_id = (
        select id from public.profiles where user_id = auth.uid()::text limit 1
      )
    )
  );

-- Admin: read-only on all offers
drop policy if exists "offers_select_admin" on public.offers;
create policy "offers_select_admin" on public.offers
  for select using (public.current_user_role() = 'admin');
