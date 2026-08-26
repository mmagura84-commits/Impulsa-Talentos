-- ─────────────────────────────────────────────────────────────────────────────
-- 039_manual_payments_grant.sql — Manual-first payment verification + credit grant
--
-- Owner-confirmed payments build (a3ead7ce) — credential-independent groundwork
-- (item 3: grant-path RPC design; owner leans manual-first at launch).
--
-- Provides the manual bank-transfer path end to end on the backend:
--   * manual_payments ledger: records an employer's payment order (package,
--     amount, requested_credits) plus the proof/reference they provide. Status
--     lifecycle moves ONLY through SD RPCs (pending_verification -> granted |
--     rejected) — there are NO raw UPDATE/DELETE policies, so the ledger cannot
--     be tampered with.
--   * submit_manual_payment  (SD): employer-of-company or admin creates a pending row.
--   * grant_company_credits  (SD, admin): MANUAL-VERIFY — admin confirms the bank
--     deposit/proof, grants the requested credits atomically to companies.job_credits,
--     marks the row granted. Idempotent-guarded (only pending rows can be granted).
--   * reject_manual_payment  (SD, admin): marks a pending row rejected.
--   * list_manual_payments   (SD): admin sees all; employer sees their own orders.
--
-- RLS-recursion rule: policy predicates that cross into companies use the SD
-- helper can_manage_payment() (not a raw cross-table reference), matching the
-- established current_user_role()/md_audit pattern.
--
-- NOTE: requested_credits is derived client-side from the catalog (pricing.ts:
-- single=1, five=5, featured=0). The featured $29 add-on grants 0 posting credits
-- (it is a placement feature, not a credit) — a separate featured-marking
-- mechanism is out of scope here and will ride the Gate-2 wiring.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ── SD helper: can the current user manage a payment for this company? ───────
-- SECURITY DEFINER to avoid RLS recursion (cross-table reference is inside SD).
create or replace function public.can_manage_payment(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role(),'') = 'admin'
      or exists (
           select 1 from public.companies c
           where c.id = p_company_id and c.employer_id = auth.uid()::text
         )
$$;

-- ── Ledger ───────────────────────────────────────────────────────────────────
create table if not exists public.manual_payments (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  package_id           text not null default '',          -- single|five|featured
  amount_usd           numeric not null default 0,
  requested_credits    integer not null default 0,
  status               text not null default 'pending_verification', -- pending_verification|granted|rejected
  transaction_reference text not null default '',         -- proof / confirmation number
  proof_note           text not null default '',
  submitter_id         text not null default '',          -- auth.uid()::text (employer)
  verified_by          text not null default '',          -- admin who granted
  created_at           timestamptz not null default now(),
  verified_at          timestamptz,
  decided_at           timestamptz
);
alter table public.manual_payments enable row level security;

-- Insert: own company (or admin). Uses the SD helper -> no RLS recursion.
drop policy if exists mp_insert_own on public.manual_payments;
create policy mp_insert_own on public.manual_payments
  for insert to authenticated
  with check (
    submitter_id = auth.uid()::text
    and public.can_manage_payment(company_id)
  );

-- Select: own company orders (or admin). SD helper again.
drop policy if exists mp_select_own on public.manual_payments;
create policy mp_select_own on public.manual_payments
  for select to authenticated
  using (public.can_manage_payment(company_id));

-- NO UPDATE / NO DELETE policies: status changes flow through SD RPCs only.

-- ── submit_manual_payment ────────────────────────────────────────────────────
-- SD: employer-of-company (or admin) creates a pending payment order.
create or replace function public.submit_manual_payment(
  p_company_id            uuid,
  p_package_id            text default '',
  p_amount_usd            numeric default 0,
  p_requested_credits     integer default 0,
  p_transaction_reference text default '',
  p_proof_note            text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid text := auth.uid()::text;
        v_id  uuid;
begin
  if not public.can_manage_payment(p_company_id) then
    raise exception 'forbidden: not your company';
  end if;
  if v_uid is null or v_uid = '' then
    raise exception 'forbidden: no session';
  end if;
  insert into public.manual_payments
    (company_id, package_id, amount_usd, requested_credits,
     transaction_reference, proof_note, submitter_id, status)
  values
    (p_company_id, coalesce(p_package_id,''), coalesce(p_amount_usd,0),
     coalesce(p_requested_credits,0), coalesce(p_transaction_reference,''),
     coalesce(p_proof_note,''), v_uid, 'pending_verification')
  returning id into v_id;
  return v_id;
end $$;

-- ── grant_company_credits ────────────────────────────────────────────────────
-- SD, admin-only: MANUAL-VERIFY grant. Adds the recorded requested_credits to
-- the company and marks the order granted. Idempotent (only pending can grant).
create or replace function public.grant_company_credits(p_payment_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_role  text := public.current_user_role();
        r       record;
        v_cred  integer;
begin
  if coalesce(v_role,'') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  select * into r from public.manual_payments where id = p_payment_id;
  if r is null then
    raise exception 'payment order not found';
  end if;
  if r.status <> 'pending_verification' then
    raise exception 'payment order is not pending verification';
  end if;
  v_cred := coalesce(r.requested_credits, 0);
  update public.companies
     set job_credits = job_credits + v_cred
   where id = r.company_id;
  update public.manual_payments
     set status = 'granted', verified_by = auth.uid()::text,
         verified_at = now(), decided_at = now()
   where id = p_payment_id;
  return v_cred;
end $$;

-- ── reject_manual_payment ────────────────────────────────────────────────────
-- SD, admin-only: reject a pending order (no credit change).
create or replace function public.reject_manual_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_role text := public.current_user_role();
begin
  if coalesce(v_role,'') <> 'admin' then
    raise exception 'forbidden: admin only';
  end if;
  update public.manual_payments
     set status = 'rejected', verified_by = auth.uid()::text, decided_at = now()
   where id = p_payment_id
     and status = 'pending_verification';
end $$;

-- ── list_manual_payments ─────────────────────────────────────────────────────
-- SD: admin sees all, newest first; employer sees own company orders, newest first.
create or replace function public.list_manual_payments()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_role text := public.current_user_role();
        v_rows jsonb;
begin
  if coalesce(v_role,'') = 'admin' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'company_id', company_id, 'package_id', package_id,
             'amount_usd', amount_usd, 'requested_credits', requested_credits,
             'status', status, 'transaction_reference', transaction_reference,
             'proof_note', proof_note, 'submitter_id', submitter_id,
             'verified_by', verified_by, 'created_at', created_at,
             'verified_at', verified_at, 'decided_at', decided_at
           ) order by created_at desc), '[]'::jsonb) into v_rows
    from public.manual_payments;
  elsif coalesce(v_role,'') = 'employer' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'company_id', company_id, 'package_id', package_id,
             'amount_usd', amount_usd, 'requested_credits', requested_credits,
             'status', status, 'transaction_reference', transaction_reference,
             'proof_note', proof_note, 'submitter_id', submitter_id,
             'verified_by', verified_by, 'created_at', created_at,
             'verified_at', verified_at, 'decided_at', decided_at
           ) order by created_at desc), '[]'::jsonb) into v_rows
    from public.manual_payments
    where public.can_manage_payment(company_id);
  else
    raise exception 'forbidden';
  end if;
  return v_rows;
end $$;

grant execute on function public.submit_manual_payment(uuid,text,numeric,integer,text,text) to authenticated;
grant execute on function public.grant_company_credits(uuid) to authenticated;
grant execute on function public.reject_manual_payment(uuid) to authenticated;
grant execute on function public.list_manual_payments() to authenticated;
COMMIT;
