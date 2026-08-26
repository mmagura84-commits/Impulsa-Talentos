-- ─────────────────────────────────────────────────────────────────────────────
-- 038_wompi_payment_link.sql — Wompi payment-link URL on business_banking
--
-- Owner-confirmed payments build (a3ead7ce) — credential-independent groundwork.
-- The manual-first checkout flow presents the Wompi payment link for credibility
-- and a manual transfer + proof path; the link must be owned (frozen) by the MD
-- via the Banking lane, exactly like the other Wompi credentials.
--
-- This migration adds `wompi_payment_link_url` to the frozen `business_banking`
-- record and threads it through the existing SECURITY DEFINER RPCs, mirroring
-- the colony of `wompi_public_key`:
--   * submit_banking(...)       — new p_wompi_payment_link_url param (stored)
--   * list_my_banking()         — new field in the read output
--   * approve_credential_change() — applies 'wompi_payment_link_url' from the
--                                  requested_fields jsonb on approval (parity
--                                  with bank_name/wompi_public_key).
-- No RLS change needed: this is a column on an already-RLS'd table with the
-- existing bbank_select (any-auth, masked) / bbank_update_admin (admin) policies.
-- PTL: apply via Management API; post-apply probe below.
--   select column_name from information_schema.columns
--   where table_name='business_banking' and column_name='wompi_payment_link_url';
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- Backward-compatible idempotent column add (mirrors the rest of 032).
alter table public.business_banking
  add column if not exists wompi_payment_link_url text not null default '';

-- Re-create submit_banking with the new param (function body otherwise identical).
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
  p_wompi_webhook_last4 text default null,
  p_wompi_payment_link_url text default ''
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
     wompi_webhook_last4, wompi_webhook_secret_id, wompi_payment_link_url,
     submitter_id, status, locked, frozen_at)
  values
    (p_bank_name, p_account_type, coalesce(p_account_number_last4, ''), v_acc,
     p_titular_name, p_nit_rust, p_swift_code,
     p_wompi_public_key, coalesce(p_wompi_private_key_last4, ''), v_pk,
     coalesce(p_wompi_webhook_last4, ''), v_wh, p_wompi_payment_link_url,
     v_uid, 'frozen', true, now())
  returning id into v_id;
  return v_id;
end $$;

-- list_my_banking: include the URL field in the read output.
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
      'wompi_payment_link_url', bb.wompi_payment_link_url,
      'status', bb.status,
      'locked', bb.locked
    ) as j
    from public.business_banking bb
    where (v_role = 'admin' or bb.submitter_id = v_uid)
  ) x;
  return v_out;
end $$;

-- approve_credential_change: apply the URL from requested_fields on approval,
-- parity with bank_name / wompi_public_key (lines 503-554 of 032). Body mirrors
-- the original exactly, adding ONLY the wompi_payment_link_url line.
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
      bank_name            = coalesce(v_fld->>'bank_name',   bank_name),
      account_type         = coalesce(v_fld->>'account_type',account_type),
      titular_name         = coalesce(v_fld->>'titular_name',titular_name),
      nit_rust             = coalesce(v_fld->>'nit_rust',    nit_rust),
      swift_code           = coalesce(v_fld->>'swift_code',  swift_code),
      wompi_public_key     = coalesce(v_fld->>'wompi_public_key', wompi_public_key),
      wompi_payment_link_url = coalesce(v_fld->>'wompi_payment_link_url', wompi_payment_link_url),
      wompi_private_key_last4 = case when r.new_secret_id is not null then r.new_secret_last4 else wompi_private_key_last4 end,
      wompi_private_key_secret_id = coalesce(r.new_secret_id, wompi_private_key_secret_id),
      status               = 'frozen',
      updated_at           = now()
    where id = r.target_id;
  end if;
  update public.credential_change_requests set
    status = 'approved', decision_by = auth.uid()::text, decided_at = now()
  where id = p_request_id;
end $$;

grant execute on function public.submit_banking(text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.list_my_banking() to authenticated;
grant execute on function public.approve_credential_change(uuid) to authenticated;
COMMIT;
