-- 053_md_operations.sql — least-privilege operations tools for the Managing Director.
--
-- The MD runs the day-to-day business, so the MD can:
--   * approve / reject employer job postings   (md_moderate_job)
--   * verify / un-verify employer businesses   (md_set_company_verified)
--   * see every payment, READ-ONLY             (md_list_payments)
--   * see all jobs (to review pending ones)    (jobs_select_md policy)
--   * work every lead                          (already allowed since 041)
-- The MD still CANNOT: confirm/refund payments, grant credits, change plans,
-- change user roles, approve other MDs, delete data, or edit anything else.
-- Each action is a narrow SECURITY DEFINER function; the hardening triggers
-- from 041 recognise it through a transaction-local flag that only these
-- functions set, so the existing audit log records every MD action.

create or replace function public.md_staff_action()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role(), '') = 'md'
     and coalesce(current_setting('app.md_action', true), '') = '1'
$$;
revoke all on function public.md_staff_action() from public, anon, authenticated;

create or replace function public.is_privileged_session()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role(), '') = 'admin'
      or coalesce(public.request_jwt_role(), 'none') = 'service_role'
      or public.request_jwt_role() is null
      or public.md_staff_action()
$$;

-- MD may read submitted jobs (the pending queue) but never employers' drafts.
-- Read-only: no insert/update policy.
drop policy if exists jobs_select_md on public.jobs;
create policy jobs_select_md on public.jobs for select
  using (coalesce(public.current_user_role(), '') = 'md' and status <> 'draft');

create or replace function public.md_moderate_job(p_job_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'md' then
    raise exception 'forbidden: managing director only' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid moderation status' using errcode = '22023';
  end if;
  perform set_config('app.md_action', '1', true);
  update public.jobs
     set moderation_status = p_status,
         moderation_reason = case when p_status = 'rejected' then nullif(btrim(coalesce(p_reason, '')), '') else null end
   where id = p_job_id;
  perform set_config('app.md_action', '', true);
  if not found then raise exception 'job not found'; end if;
end $$;
revoke all on function public.md_moderate_job(uuid, text, text) from public, anon;
grant execute on function public.md_moderate_job(uuid, text, text) to authenticated;

create or replace function public.md_set_company_verified(p_company_id uuid, p_verified boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'md' then
    raise exception 'forbidden: managing director only' using errcode = '42501';
  end if;
  perform set_config('app.md_action', '1', true);
  update public.companies
     set verified = p_verified, verification_requested = false
   where id = p_company_id;
  perform set_config('app.md_action', '', true);
  if not found then raise exception 'company not found'; end if;
end $$;
revoke all on function public.md_set_company_verified(uuid, boolean) from public, anon;
grant execute on function public.md_set_company_verified(uuid, boolean) to authenticated;

-- Read-only payments view for the MD (same columns as admin_list_payments).
create or replace function public.md_list_payments()
returns table (id uuid, company_id uuid, company_name text, package_id text, amount_usd numeric,
               requested_credits integer, status text, transaction_reference text, proof_note text,
               submitter_email text, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') not in ('md', 'admin') then
    raise exception 'forbidden: managing director or admin only' using errcode = '42501';
  end if;
  return query
    select m.id, m.company_id, c.name, m.package_id, m.amount_usd, m.requested_credits, m.status,
           m.transaction_reference, m.proof_note, p.email, m.created_at, m.decided_at
      from public.manual_payments m
      left join public.companies c on c.id = m.company_id
      left join public.profiles p on p.user_id = m.submitter_id
     order by (m.status = 'pending_verification') desc, m.created_at desc;
end $$;
revoke all on function public.md_list_payments() from public, anon;
grant execute on function public.md_list_payments() to authenticated;
