-- ═══════════════════════════════════════════════════════════════════════════
-- Impulsa Talentos — Frozen-credentials data model + RLS (MD Marketing/Banking)
--   migration 032 [PTL]
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner-directive build (task bbab2ea2). Follows team conventions:
--   * SD wrappers for any auth/cross-table logic (NO-RAW-SUBQUERY rule, 029/#130)
--   * current_user_role() SD helper for role gating
--   * snake_case DB columns; camelCase handled by app mappers
--   * secrets encrypted AT REST in supabase_vault (never plaintext),
--     masked last-4 in the public table for display; full secret only ever
--     returned by an admin-gated SD RPC (never to MD/UI to read)
--   * freeze NON-BYPASSABLE at the data layer: MD has NO UPDATE/DELETE policy
--     on frozen rows; only admin (direct-edit) or an SD approval wrapper can
--     change a frozen credential.
--
-- Apply: Management API (live cmdqlybsgkegolqydmbh) via IMPULSA_TALENTOS_TEAM.
-- This migration is idempotent (if-not-exists / create-or-replace).
-- Requires supabase_vault (present on live, verified) for at-rest encryption.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. marketing_channels — CONFIGURABLE catalog of outreach platforms,
--    split into two groups: 'candidate' and 'employer'. Admin-managed.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.marketing_channels (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  audience   text not null default 'candidate'
               check (audience in ('candidate','employer')),
  name_en    text not null default '',
  name_es    text not null default '',
  active     boolean not null default true,
  sort       int  not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketing_channels enable row level security;
-- catalog is low-sensitivity reference: any authenticated user may read it;
-- only admin manages it.
drop policy if exists "mk_ch_select_auth"  on public.marketing_channels;
drop policy if exists "mk_ch_insert_admin" on public.marketing_channels;
drop policy if exists "mk_ch_update_admin" on public.marketing_channels;
drop policy if exists "mk_ch_delete_admin" on public.marketing_channels;
create policy "mk_ch_select_auth"  on public.marketing_channels
  for select using (true);
create policy "mk_ch_insert_admin" on public.marketing_channels
  for insert with check (public.current_user_role() = 'admin');
create policy "mk_ch_update_admin" on public.marketing_channels
  for update using (public.current_user_role() = 'admin')
            with check (public.current_user_role() = 'admin');
create policy "mk_ch_delete_admin" on public.marketing_channels
  for delete using (public.current_user_role() = 'admin');

-- Seed a sensible default catalog (owner-provided email-marketing accounts →
-- MD creates accounts; this list is the starting configurable set).
insert into public.marketing_channels (code, audience, name_en, name_es, sort) values
  ('linkedin_company',   'employer',  'LinkedIn (company)',   'LinkedIn (empresa)',  1),
  ('linkedin_jobs',      'candidate', 'LinkedIn (job board)', 'LinkedIn (bolsa de empleo)', 2),
  ('instagram',          'candidate', 'Instagram',            'Instagram',           3),
  ('facebook',           'candidate', 'Facebook',             'Facebook',            4),
  ('tiktok',             'candidate', 'TikTok',               'TikTok',              5),
  ('whatsapp_business',  'candidate', 'WhatsApp Business',    'WhatsApp Business',   6),
  ('twitter_company',    'employer',  'Twitter/X (company)',  'Twitter/X (empresa)', 7),
  ('youtube',            'employer',  'YouTube',              'YouTube',             8),
  ('google_business',    'employer',  'Google Business Profile','Google Business Profile',9),
  ('email_marketing',    'employer',  'Email Marketing Platform','Plataforma de Email Marketing',10),
  ('google_ads',         'candidate', 'Google Ads',           'Google Ads',          11),
  ('meta_ads',           'candidate', 'Meta Ads',             'Meta Ads',            12),
  ('facebook_employer_groups', 'employer','Facebook (employer groups)','Facebook (grupos de empleadores)',13),
  ('twitter_employer',   'employer',  'Twitter/X (employer outreach)','Twitter/X (alcance a empleadores)',14),
  ('computrabajo',       'candidate', 'Computrabajo Colombia','Computrabajo Colombia',15),
  ('elempleo',           'candidate', 'elempleo.com',         'elempleo.com',        16),
  ('magneto365',         'candidate', 'Magneto365',           'Magneto365',          17),
  ('torre',              'candidate', 'Torre.co',             'Torre.co',            18),
  ('konzerta',           'candidate', 'Konzerta',             'Konzerta',            19),
  ('bumeran',            'candidate', 'Bumeran',              'Bumeran',             20),
  ('indeed_colombia',    'candidate', 'Indeed Colombia',      'Indeed Colombia',     21),
  ('facebook_regional',  'employer',  'Facebook Groups (regional)','Facebook Groups (regional)',22),
  ('telegram_jobs',      'candidate', 'Telegram (job channels)','Telegram (canales de empleo)',23),
  ('glassdoor',          'candidate', 'Glassdoor',            'Glassdoor',           24)
on conflict (code) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. marketing_credentials — MD fills in one credential per platform.
--    Once submitted the row FROZENS (locked=true, status='frozen') and becomes
--    business property. Unique per channel ⇒ MD can submit each channel once.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.marketing_credentials (
  id             uuid primary key default gen_random_uuid(),
  channel_code   text not null references public.marketing_channels(code) on delete restrict,
  business_name  text not null default '',
  account_handle text not null default '',
  profile_url    text not null default '',
  -- full secret (password / API key) encrypted at rest in vault; NULL if none.
  secret_id      uuid,
  secret_last4   text not null default '',
  submitter_id   text not null default '',          -- profiles.user_id (auth.uid()::text)
  status         text not null default 'frozen' check (status in ('frozen','change_requested')),
  locked         boolean not null default true,
  frozen_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists mc_channel_unique
  on public.marketing_credentials (channel_code);
alter table public.marketing_credentials enable row level security;
-- MD can INSERT once per channel (unique), and read own rows; NO update/delete
-- ⇒ a submitted/frozen credential is immutable by the MD (non-bypassable).
drop policy if exists "mk_cred_select" on public.marketing_credentials;
drop policy if exists "mk_cred_insert"  on public.marketing_credentials;
drop policy if exists "mk_cred_update_admin" on public.marketing_credentials;
create policy "mk_cred_select" on public.marketing_credentials
  for select using (
    public.current_user_role() = 'admin'
    or submitter_id = auth.uid()::text
  );
create policy "mk_cred_insert" on public.marketing_credentials
  for insert with check (
    public.current_user_role() = 'md'
    and submitter_id = auth.uid()::text
  );
-- admin direct-edit path (owner/admin). This is the ONLY in-place UPDATE policy.
create policy "mk_cred_update_admin" on public.marketing_credentials
  for update using (public.current_user_role() = 'admin')
            with check (public.current_user_role() = 'admin');
-- NO DELETE policy at all: credentials are append-only business property.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. business_banking — banking details + Wompi. Freezes on submit.
--    Full account number, Wompi private API key, and webhook secret are
--    encrypted at rest in vault (masked last-4 shown in the plaintext row).
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.business_banking (
  id              uuid primary key default gen_random_uuid(),
  bank_name       text not null default '',
  account_type    text not null default '',
  account_number_last4  text not null default '',
  account_number_secret_id uuid,
  titular_name    text not null default '',
  nit_rust        text not null default '',
  swift_code      text not null default '',
  -- Wompi credentials
  wompi_public_key     text not null default '',   -- public by design
  wompi_private_key_last4    text not null default '',
  wompi_private_key_secret_id uuid,
  wompi_webhook_last4        text not null default '',
  wompi_webhook_secret_id    uuid,
  submitter_id    text not null default '',        -- profiles.user_id
  status          text not null default 'frozen' check (status in ('frozen','change_requested')),
  locked          boolean not null default true,
  frozen_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.business_banking enable row level security;
-- at most one FROZEN banking record (the single business account)
create unique index if not exists business_banking_single_active
  on public.business_banking ((true)) where locked;
drop policy if exists "bbank_select" on public.business_banking;
drop policy if exists "bbank_insert"  on public.business_banking;
drop policy if exists "bbank_update_admin" on public.business_banking;
create policy "bbank_select" on public.business_banking
  for select using (
    public.current_user_role() = 'admin'
    or submitter_id = auth.uid()::text
  );
create policy "bbank_insert" on public.business_banking
  for insert with check (
    public.current_user_role() = 'md'
    and submitter_id = auth.uid()::text
  );
create policy "bbank_update_admin" on public.business_banking
  for update using (public.current_user_role() = 'admin')
            with check (public.current_user_role() = 'admin');
-- NO DELETE policy.

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. credential_change_requests — MD may request a change; live credential
--    STAYS FROZEN until an admin/owner approves. A pending request is a
--    separate row/status; nothing auto-unlocks.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.credential_change_requests (
  id               uuid primary key default gen_random_uuid(),
  target_type      text not null check (target_type in ('marketing','banking')),
  target_id        uuid not null,
  requested_by     text not null default '',       -- profiles.user_id (MD)
  -- non-secret field changes (json map of column -> value)
  requested_fields jsonb not null default '{}'::jsonb,
  -- a pre-encrypted new secret (created at request time) + its masked last4
  new_secret_id    uuid,
  new_secret_last4 text not null default '',
  reason           text not null default '',
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision_by      text,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.credential_change_requests enable row level security;
-- only ONE pending request per frozen record
create unique index if not exists ccr_single_pending
  on public.credential_change_requests (target_type, target_id) where status = 'pending';
drop policy if exists "ccr_select" on public.credential_change_requests;
drop policy if exists "ccr_insert"  on public.credential_change_requests;
drop policy if exists "ccr_update_admin" on public.credential_change_requests;
create policy "ccr_select" on public.credential_change_requests
  for select using (
    public.current_user_role() = 'admin'
    or requested_by = auth.uid()::text
  );
create policy "ccr_insert" on public.credential_change_requests
  for insert with check (
    public.current_user_role() = 'md'
    and requested_by = auth.uid()::text
  );
create policy "ccr_update_admin" on public.credential_change_requests
  for update using (public.current_user_role() = 'admin')
            with check (public.current_user_role() = 'admin');
-- NO DELETE policy (audit trail).

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SECURITY DEFINER helpers (SECRET encryption/decryption via vault)
-- ═══════════════════════════════════════════════════════════════════════════
-- Encrypt a secret at rest: returns the vault secret id. No plaintext is ever
-- stored in a public table — only this id + a masked last-4.
create or replace function public.fc_encrypt_secret(p_plain text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_plain is null or p_plain = '' then
    return null;
  end if;
  select vault.create_secret(p_plain, coalesce(p_name, 'impulsa-credential'),
        'Impulsa Talentos frozen credential (encrypted at rest)', null) into v_id;
  return v_id;
end $$;

-- Decrypt a vault secret id → plaintext. ONLY to be called from admin-gated SD
-- wrappers; never exposed to MD/UI reads.
create or replace function public.fc_decrypt_secret(p_secret_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_secret_id
$$;
revoke all on function public.fc_decrypt_secret(uuid) from public;
revoke all on function public.fc_decrypt_secret(uuid) from anon;
revoke all on function public.fc_decrypt_secret(uuid) from authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Submit RPCs (MD-only, freeze on submit)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.submit_marketing_credential(
  p_channel_code text,
  p_business_name text default '',
  p_account_handle text default '',
  p_profile_url text default '',
  p_secret text default null,
  p_secret_last4 text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid  text := auth.uid()::text;
        v_sec  uuid;
        v_id   uuid;
begin
  if coalesce(public.current_user_role(),'') <> 'md' then
    raise exception 'forbidden: only the MD may submit marketing credentials';
  end if;
  if not exists (select 1 from public.marketing_channels
                 where code = p_channel_code and active) then
    raise exception 'unknown or disabled channel %', p_channel_code;
  end if;
  if exists (select 1 from public.marketing_credentials
             where channel_code = p_channel_code) then
    raise exception 'credential for % already frozen', p_channel_code;
  end if;
  v_sec := public.fc_encrypt_secret(p_secret, 'mc:' || p_channel_code);
  insert into public.marketing_credentials
    (channel_code, business_name, account_handle, profile_url,
     secret_id, secret_last4, submitter_id, status, locked, frozen_at)
  values
    (p_channel_code, p_business_name, p_account_handle, p_profile_url,
     v_sec, coalesce(p_secret_last4, ''), v_uid, 'frozen', true, now())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.submit_banking(
  p_bank_name text default '',
  p_account_type text default '',
  p_account_number text default null,
  p_account_number_last4 text default null,
  p_titular_name text default '',
  p_nit_rust text default '',
  p_swift_code text default '',
  p_wompi_public_key text default '',
  p_wompi_private_key text default null,
  p_wompi_private_key_last4 text default null,
  p_wompi_webhook_secret text default null,
  p_wompi_webhook_last4 text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid text := auth.uid()::text;
        v_acc uuid;
        v_pk  uuid;
        v_wh  uuid;
        v_id  uuid;
begin
  if coalesce(public.current_user_role(),'') <> 'md' then
    raise exception 'forbidden: only the MD may submit banking details';
  end if;
  if exists (select 1 from public.business_banking where locked) then
    raise exception 'banking record already frozen';
  end if;
  v_acc := public.fc_encrypt_secret(p_account_number, 'bb:account_number');
  v_pk  := public.fc_encrypt_secret(p_wompi_private_key, 'bb:wompi_private_key');
  v_wh  := public.fc_encrypt_secret(p_wompi_webhook_secret, 'bb:wompi_webhook');
  insert into public.business_banking
    (bank_name, account_type, account_number_last4, account_number_secret_id,
     titular_name, nit_rust, swift_code,
     wompi_public_key, wompi_private_key_last4, wompi_private_key_secret_id,
     wompi_webhook_last4, wompi_webhook_secret_id,
     submitter_id, status, locked, frozen_at)
  values
    (p_bank_name, p_account_type, coalesce(p_account_number_last4, ''), v_acc,
     p_titular_name, p_nit_rust, p_swift_code,
     p_wompi_public_key, coalesce(p_wompi_private_key_last4, ''), v_pk,
     coalesce(p_wompi_webhook_last4, ''), v_wh,
     v_uid, 'frozen', true, now())
  returning id into v_id;
  return v_id;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Read RPCs: current MD sees their own masked (never the full secret);
--    admin sees all + can decrypt via an admin-gated RPC.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.list_my_credentials()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid text := auth.uid()::text;
        v_role text := public.current_user_role();
        v_out  jsonb;
begin
  if coalesce(v_role,'') not in ('md','admin') then
    raise exception 'forbidden';
  end if;
  select coalesce(jsonb_agg(j order by j->>'channel_code'), '[]'::jsonb)
    into v_out
  from (
    select jsonb_build_object(
      'channel_code', mc.channel_code,
      'business_name', mc.business_name,
      'account_handle', mc.account_handle,
      'profile_url', mc.profile_url,
      'secret_last4', mc.secret_last4,
      'status', mc.status,
      'locked', mc.locked
    ) as j
    from public.marketing_credentials mc
    where (v_role = 'admin' or mc.submitter_id = v_uid)
  ) x;
  return v_out;
end $$;

create or replace function public.list_my_banking()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid text := auth.uid()::text;
        v_role text := public.current_user_role();
        v_out  jsonb;
begin
  if coalesce(v_role,'') not in ('md','admin') then
    raise exception 'forbidden';
  end if;
  select coalesce(jsonb_agg(j), '[]'::jsonb)
    into v_out
  from (
    select jsonb_build_object(
      'bank_name', bb.bank_name,
      'account_type', bb.account_type,
      'account_number_last4', bb.account_number_last4,
      'titular_name', bb.titular_name,
      'nit_rust', bb.nit_rust,
      'swift_code', bb.swift_code,
      'wompi_public_key', bb.wompi_public_key,
      'wompi_private_key_last4', bb.wompi_private_key_last4,
      'wompi_webhook_last4', bb.wompi_webhook_last4,
      'status', bb.status,
      'locked', bb.locked
    ) as j
    from public.business_banking bb
    where (v_role = 'admin' or bb.submitter_id = v_uid)
  ) x;
  return v_out;
end $$;

-- Admin-gated: expose a decrypted secret ONLY to an admin/owner context,
-- and never to the MD/UI read path.
create or replace function public.admin_read_credential_secret(
  p_target_type text,
  p_target_id   uuid,
  p_field       text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_sec uuid; v_role text := public.current_user_role();
begin
  if coalesce(v_role,'') <> 'admin' then
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
  if v_sec is null then
    return null;
  end if;
  return public.fc_decrypt_secret(v_sec);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Change-request RPCs (MD requests; admin approves/rejects; NO auto-unlock)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.request_credential_change(
  p_target_type text,
  p_target_id   uuid,
  p_requested_fields jsonb default '{}'::jsonb,
  p_new_secret  text default null,
  p_new_secret_last4 text default null,
  p_reason      text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid  text := auth.uid()::text;
        v_sec  uuid;
        v_id   uuid;
        v_owner text;
begin
  if coalesce(public.current_user_role(),'') <> 'md' then
    raise exception 'forbidden: only the MD may request a change';
  end if;
  -- only the MD who owns the record (or an admin flow) may request changes on it
  if p_target_type = 'marketing' then
    select submitter_id into v_owner from public.marketing_credentials where id = p_target_id;
  elsif p_target_type = 'banking' then
    select submitter_id into v_owner from public.business_banking where id = p_target_id;
  else
    raise exception 'invalid target type';
  end if;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'forbidden: not your record';
  end if;
  v_sec := public.fc_encrypt_secret(p_new_secret, p_target_type || ':change:' || p_target_id);
  insert into public.credential_change_requests
    (target_type, target_id, requested_by, requested_fields,
     new_secret_id, new_secret_last4, reason, status)
  values
    (p_target_type, p_target_id, v_uid, p_requested_fields,
     v_sec, coalesce(p_new_secret_last4, ''), p_reason, 'pending')
  returning id into v_id;
  -- flag the live record as having a pending change (stays FROZEN/locked)
  if p_target_type = 'marketing' then
    update public.marketing_credentials set status = 'change_requested'
      where id = p_target_id and locked = true;
  else
    update public.business_banking set status = 'change_requested'
      where id = p_target_id and locked = true;
  end if;
  return v_id;
end $$;

create or replace function public.approve_credential_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_role text := public.current_user_role(); v_fld jsonb;
begin
  if coalesce(v_role,'') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  select * into r from public.credential_change_requests where id = p_request_id;
  if r is null then
    raise exception 'request not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'request is not pending';
  end if;
  v_fld := coalesce(r.requested_fields, '{}'::jsonb);
  if r.target_type = 'marketing' then
    update public.marketing_credentials set
      business_name  = coalesce(v_fld->>'business_name',  business_name),
      account_handle = coalesce(v_fld->>'account_handle', account_handle),
      profile_url    = coalesce(v_fld->>'profile_url',    profile_url),
      secret_id      = coalesce(r.new_secret_id, secret_id),
      secret_last4   = case when r.new_secret_id is not null then r.new_secret_last4 else secret_last4 end,
      status         = 'frozen',
      updated_at     = now()
    where id = r.target_id;
  else
    update public.business_banking set
      bank_name         = coalesce(v_fld->>'bank_name',   bank_name),
      account_type      = coalesce(v_fld->>'account_type',account_type),
      titular_name      = coalesce(v_fld->>'titular_name',titular_name),
      nit_rust          = coalesce(v_fld->>'nit_rust',    nit_rust),
      swift_code        = coalesce(v_fld->>'swift_code',  swift_code),
      wompi_public_key  = coalesce(v_fld->>'wompi_public_key', wompi_public_key),
      wompi_private_key_last4 = case when r.new_secret_id is not null then r.new_secret_last4 else wompi_private_key_last4 end,
      wompi_private_key_secret_id = coalesce(r.new_secret_id, wompi_private_key_secret_id),
      status            = 'frozen',
      updated_at        = now()
    where id = r.target_id;
  end if;
  update public.credential_change_requests set
    status = 'approved', decision_by = auth.uid()::text, decided_at = now()
  where id = p_request_id;
end $$;

create or replace function public.reject_credential_change(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_role text := public.current_user_role();
begin
  if coalesce(v_role,'') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  select * into r from public.credential_change_requests where id = p_request_id;
  if r is null then
    raise exception 'request not found';
  end if;
  update public.credential_change_requests set
    status = 'rejected', decision_by = auth.uid()::text, decided_at = now()
  where id = p_request_id;
  -- restore live status to frozen (always stays locked)
  if r.target_type = 'marketing' then
    update public.marketing_credentials set status = 'frozen' where id = r.target_id;
  else
    update public.business_banking set status = 'frozen' where id = r.target_id;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Grant EXECUTE (client RPCs callable via PostgREST). Admin/decrypt fns
--    remain callable by authenticated so the admin UI can invoke them; the
--    role guards inside enforce permission.
-- ═══════════════════════════════════════════════════════════════════════════
grant execute on function public.fc_encrypt_secret(text,text) to postgres;
grant execute on function public.submit_marketing_credential(text,text,text,text,text,text) to authenticated;
grant execute on function public.submit_banking(text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.list_my_credentials() to authenticated;
grant execute on function public.list_my_banking() to authenticated;
grant execute on function public.admin_read_credential_secret(text,uuid,text) to authenticated;
grant execute on function public.request_credential_change(text,uuid,jsonb,text,text,text) to authenticated;
grant execute on function public.approve_credential_change(uuid) to authenticated;
grant execute on function public.reject_credential_change(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION — expect 4 tables, 3 *_md policies as described,...
-- (run separately in the post-apply probe)
-- ═══════════════════════════════════════════════════════════════════════════
COMMIT;
