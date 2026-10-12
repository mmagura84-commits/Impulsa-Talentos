-- 044: employers can press Publish before HQ has verified their company.
--
-- Before: an unverified company could only save drafts; the employer had to
-- come back after verification and publish each job by hand.
--
-- Now the app saves such a job as a draft marked publish_when_verified (and
-- requests verification if it hadn't been). The moment the company is both
-- verified and has credits, the queued jobs go live in the order they were
-- written, one credit each, and the company's staff are notified:
--   * job_published      — "Your job is live: {title}"
--   * job_needs_credits  — verified, but queued jobs are waiting for credits
-- It runs when HQ verifies the company and again whenever HQ adds credits
-- (a confirmed payment), so nothing waits on the employer coming back.
--
-- Only HQ-privileged changes (verification, credit grants) trigger it, and the
-- publish itself still goes through guard_and_charge_job (published_at,
-- listing length). Idempotent: safe to run more than once.

alter table public.jobs add column if not exists publish_when_verified boolean not null default false;

create or replace function public.publish_queued_jobs(p_company_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_company public.companies;
  v_job     record;
  v_uid     text;
  v_n       integer := 0;
begin
  select * into v_company from public.companies where id = p_company_id for update;
  if not found or not coalesce(v_company.verified, false) then return 0; end if;

  for v_job in
    select id, title from public.jobs
     where company_id = p_company_id and publish_when_verified and status = 'draft'
     order by created_at
  loop
    exit when coalesce(v_company.job_credits, 0) < 1;
    update public.companies set job_credits = job_credits - 1
     where id = p_company_id returning * into v_company;
    update public.jobs set status = 'open', publish_when_verified = false where id = v_job.id;
    v_n := v_n + 1;
    for v_uid in select * from public.company_staff_user_ids(p_company_id) loop
      perform public.push_notification(v_uid, 'job_published', coalesce(v_job.title, ''), '',
        jsonb_build_object('job_id', v_job.id));
    end loop;
  end loop;

  if exists (select 1 from public.jobs
              where company_id = p_company_id and publish_when_verified and status = 'draft') then
    for v_uid in select * from public.company_staff_user_ids(p_company_id) loop
      perform public.push_notification(v_uid, 'job_needs_credits', coalesce(v_company.name, ''), '',
        jsonb_build_object('company_id', p_company_id));
    end loop;
  end if;
  return v_n;
end $$;
revoke all on function public.publish_queued_jobs(uuid) from public, anon, authenticated;

create or replace function public.publish_queued_jobs_on_company_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.verified, false)
     and (not coalesce(old.verified, false) or coalesce(new.job_credits, 0) > coalesce(old.job_credits, 0)) then
    perform public.publish_queued_jobs(new.id);
  end if;
  return null;
end $$;
revoke all on function public.publish_queued_jobs_on_company_change() from public, anon, authenticated;

drop trigger if exists trg_publish_queued_jobs on public.companies;
create trigger trg_publish_queued_jobs
  after update of verified, job_credits on public.companies
  for each row execute function public.publish_queued_jobs_on_company_change();
