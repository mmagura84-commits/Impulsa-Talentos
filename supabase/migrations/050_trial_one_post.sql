-- 050 — Free trial: 1 job post (14 days, 20 applicants), like the reference
-- pricing (remotelatinos.com/pricing). Was 2 credits. Existing companies keep
-- their balance; only new companies get 1. Same function body as 041 otherwise.
create or replace function public.guard_company_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_privileged_session() then
    if tg_op = 'UPDATE' and (new.verified is distinct from old.verified
                             or new.job_credits is distinct from old.job_credits
                             or new.plan is distinct from old.plan) then
      if new.verified and not coalesce(old.verified, false) then new.verified_at := now(); end if;
      perform public.write_admin_audit('company.privileged_update', 'company', new.id::text,
        jsonb_build_object('verified', old.verified, 'job_credits', old.job_credits, 'plan', old.plan),
        jsonb_build_object('verified', new.verified, 'job_credits', new.job_credits, 'plan', new.plan));
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verified := false;
    new.verified_at := null;
    new.job_credits := 1;            -- trial: 1 job post (NEW_COMPANY_TRIAL_CREDITS)
    new.plan := 'trial';
    new.listing_days := 14;
    new.max_applicants_per_job := 20;
    new.employer_id := auth.uid()::text;
    return new;
  end if;

  -- Credits may only move inside the server-side publish trigger (nested).
  if new.job_credits is distinct from old.job_credits and pg_trigger_depth() < 2 then
    raise exception 'Job credits can only change through a purchase approved by HQ' using errcode = '42501';
  end if;
  if new.verified is distinct from old.verified or new.verified_at is distinct from old.verified_at then
    raise exception 'Company verification is done by HQ' using errcode = '42501';
  end if;
  if new.plan is distinct from old.plan or new.listing_days is distinct from old.listing_days
     or new.max_applicants_per_job is distinct from old.max_applicants_per_job then
    raise exception 'Plan limits are set by HQ' using errcode = '42501';
  end if;
  if new.employer_id is distinct from old.employer_id then
    raise exception 'Company ownership can only be transferred by HQ' using errcode = '42501';
  end if;
  return new;
end $$;
