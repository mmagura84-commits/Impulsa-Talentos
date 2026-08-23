-- ═══════════════════════════════════════════════════════════════════════════
-- Impulsa Talentos — Frozen-credentials change-request: support a second
-- (Wompi webhook) secret on banking change approvals [PTL]
--   migration 033
-- ═══════════════════════════════════════════════════════════════════════════
-- Gap fixed (SPE/lead flag 2026-08-23): submit_banking collects BOTH the Wompi
-- private key AND the webhook secret, but approve_credential_change only
-- carried/ applied ONE secret (new_secret_id -> wompi_private_key). A banking
-- change request that rotated the webhook secret was silently dropped.
--
-- This adds a second secret channel (webhook) to credential_change_requests and
-- extends request_credential_change + approve_credential_change accordingly:
--   * request_credential_change gains optional p_new_webhook_secret / last4
--   * approve_credential_change banking branch now also applies the webhook
--     secret (+ masked last4) when present.
-- Backward compatible: existing single-secret + non-secret field requests still
-- work unchanged; prior probe cases unaffected.
-- Idempotent. Requires supabase_vault. Applied via Management API.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

alter table public.credential_change_requests
  add column if not exists new_webhook_secret_id uuid,
  add column if not exists new_webhook_last4     text not null default '';

-- Extend the MD request RPC with an optional Wompi webhook secret.
create or replace function public.request_credential_change(
  p_target_type text,
  p_target_id   uuid,
  p_requested_fields jsonb default '{}'::jsonb,
  p_new_secret  text default null,
  p_new_secret_last4 text default null,
  p_reason      text default '',
  p_new_webhook_secret text default null,
  p_new_webhook_secret_last4 text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid  text := auth.uid()::text;
        v_sec  uuid;
        v_wh   uuid;
        v_id   uuid;
        v_owner text;
begin
  if coalesce(public.current_user_role(),'') <> 'md' then
    raise exception 'forbidden: only the MD may request a change';
  end if;
  -- only the MD who owns the record may request changes on it
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
  v_wh  := public.fc_encrypt_secret(p_new_webhook_secret, p_target_type || ':change:' || p_target_id || ':webhook');
  insert into public.credential_change_requests
    (target_type, target_id, requested_by, requested_fields,
     new_secret_id, new_secret_last4,
     new_webhook_secret_id, new_webhook_last4,
     reason, status)
  values
    (p_target_type, p_target_id, v_uid, p_requested_fields,
     v_sec, coalesce(p_new_secret_last4, ''),
     v_wh,  coalesce(p_new_webhook_secret_last4, ''),
     p_reason, 'pending')
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

-- Extend the admin approve RPC to also apply the webhook secret for banking.
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
      -- private key
      wompi_private_key_last4 = case when r.new_secret_id is not null then r.new_secret_last4 else wompi_private_key_last4 end,
      wompi_private_key_secret_id = coalesce(r.new_secret_id, wompi_private_key_secret_id),
      -- webhook secret (NEW: can be rotated independently)
      wompi_webhook_last4        = case when r.new_webhook_secret_id is not null then r.new_webhook_last4 else wompi_webhook_last4 end,
      wompi_webhook_secret_id    = coalesce(r.new_webhook_secret_id, wompi_webhook_secret_id),
      status            = 'frozen',
      updated_at        = now()
    where id = r.target_id;
  end if;
  update public.credential_change_requests set
    status = 'approved', decision_by = auth.uid()::text, decided_at = now()
  where id = p_request_id;
end $$;

-- Grant execute for the extended request RPC (new arity).
grant execute on function public.request_credential_change(text,uuid,jsonb,text,text,text,text,text) to authenticated;

-- VERIFICATION (post-apply, run separately):
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='credential_change_requests'
--    and column_name in ('new_webhook_secret_id','new_webhook_last4');
COMMIT;
