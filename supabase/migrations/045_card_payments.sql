-- 045: instant card payments through Wompi (dormant until configured).
--
-- Before: buying credits meant a bank transfer, uploading proof, and waiting
-- for HQ to confirm it by hand.
--
-- Now an employer can pay by card on Wompi's hosted checkout:
--   1. start_card_payment() records a pending order with a unique reference and
--      the plan's price in Colombian pesos (Wompi charges COP only).
--   2. The wompi-payments Edge Function signs the checkout (integrity secret)
--      and sends the employer to Wompi.
--   3. Wompi calls the same function with a signed event; once the signature
--      checks out, apply_card_payment() adds the credits straight away (no HQ
--      step), notifies the company and audit-logs it. Queued jobs then go live
--      by themselves (migration 044).
-- The bank transfer stays available as the fallback.
--
-- Card checkout only appears for plans that have a peso price
-- (billing_packages.amount_cop_cents) and once the Wompi keys are set as
-- Edge Function secrets. Idempotent: safe to run more than once.

alter table public.billing_packages add column if not exists amount_cop_cents bigint;

create table if not exists public.card_payments (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  company_id            uuid not null references public.companies(id) on delete cascade,
  package_id            text not null references public.billing_packages(id),
  amount_in_cents       bigint not null,
  currency              text not null default 'COP',
  credits               integer not null,
  status                text not null default 'pending'
                          check (status in ('pending', 'approved', 'declined', 'voided', 'error')),
  wompi_transaction_id  text,
  submitter_id          text not null default '',
  created_at            timestamptz not null default now(),
  decided_at            timestamptz
);
alter table public.card_payments enable row level security;
drop policy if exists card_payments_select on public.card_payments;
create policy card_payments_select on public.card_payments for select
  using (public.is_company_viewer(company_id) or public.current_user_role() = 'admin');
-- No insert/update/delete policies: rows change only through the functions below.

create or replace function public.start_card_payment(p_company_id uuid, p_package_id text)
returns table (reference text, amount_in_cents bigint, currency text)
language plpgsql security definer set search_path = public as $$
declare v_uid text := auth.uid()::text; v_pkg public.billing_packages; v_ref text;
begin
  if v_uid is null or v_uid = '' then raise exception 'forbidden: no session'; end if;
  if not (public.can_manage_payment(p_company_id) or public.is_company_editor(p_company_id)) then
    raise exception 'forbidden: not your company';
  end if;
  select * into v_pkg from public.billing_packages where id = p_package_id and active;
  if v_pkg.id is null then raise exception 'unknown package %', p_package_id; end if;
  if v_pkg.amount_cop_cents is null or v_pkg.amount_cop_cents <= 0 then
    raise exception 'CARD_NOT_AVAILABLE: this plan has no peso price yet';
  end if;
  v_ref := 'IT-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.card_payments (reference, company_id, package_id, amount_in_cents, currency, credits, submitter_id)
  values (v_ref, p_company_id, v_pkg.id, v_pkg.amount_cop_cents, 'COP', v_pkg.credits, v_uid);
  return query select v_ref, v_pkg.amount_cop_cents, 'COP'::text;
end $$;
revoke all on function public.start_card_payment(uuid, text) from public, anon;
grant execute on function public.start_card_payment(uuid, text) to authenticated;

-- Called only by the wompi-payments Edge Function (service role) after it has
-- verified Wompi's event signature. Safe to call twice for the same reference.
create or replace function public.apply_card_payment(
  p_reference text, p_status text, p_transaction_id text, p_amount_in_cents bigint, p_currency text)
returns text language plpgsql security definer set search_path = public as $$
declare r public.card_payments; v_pkg public.billing_packages; v_uid text; v_status text;
begin
  if coalesce(public.request_jwt_role(), '') <> 'service_role' and public.request_jwt_role() is not null then
    raise exception 'forbidden: payment events come from Wompi only' using errcode = '42501';
  end if;
  select * into r from public.card_payments where reference = p_reference for update;
  if r.id is null then return 'unknown reference'; end if;
  if r.status <> 'pending' then return 'already ' || r.status; end if;

  v_status := case upper(coalesce(p_status, ''))
                when 'APPROVED' then 'approved' when 'DECLINED' then 'declined'
                when 'VOIDED' then 'voided' when 'ERROR' then 'error' else null end;
  if v_status is null then return 'still pending'; end if;
  if v_status = 'approved' and (p_amount_in_cents is distinct from r.amount_in_cents
                                or upper(coalesce(p_currency, '')) <> r.currency) then
    v_status := 'error';  -- paid amount does not match the order: never grant
  end if;

  update public.card_payments
     set status = v_status, wompi_transaction_id = left(coalesce(p_transaction_id, ''), 120), decided_at = now()
   where id = r.id;

  if v_status = 'approved' then
    select * into v_pkg from public.billing_packages where id = r.package_id;
    update public.companies
       set job_credits = job_credits + r.credits,
           plan = coalesce(v_pkg.plan, plan),
           listing_days = coalesce(v_pkg.listing_days, listing_days),
           max_applicants_per_job = case when v_pkg.id is null then max_applicants_per_job
                                         else v_pkg.max_applicants_per_job end
     where id = r.company_id;
    for v_uid in select * from public.company_staff_user_ids(r.company_id) loop
      perform public.push_notification(v_uid, 'payment_granted', coalesce(v_pkg.plan, r.package_id),
        'card', jsonb_build_object('card_payment_id', r.id));
    end loop;
  end if;
  perform public.write_admin_audit('payment.card', 'card_payment', r.id::text, null,
    jsonb_build_object('company_id', r.company_id, 'package', r.package_id, 'status', v_status,
                       'transaction', p_transaction_id));
  return v_status;
end $$;
revoke all on function public.apply_card_payment(text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.apply_card_payment(text, text, text, bigint, text) to service_role;
