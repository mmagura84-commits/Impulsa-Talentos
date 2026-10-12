-- Remove the QA test data from the LIVE project (cmdqlybsgkegolqydmbh).
-- Paste into Supabase → SQL Editor → Run. It is all-or-nothing: if any step
-- fails, nothing is deleted.
--
-- What it removes (found 2026-10-11):
--   companies  QA Company A (8b6fd61a…), QA Company B (d2f9b85f…)
--   jobs       QA Job A, QA Job B, QA Continuation Draft Job
--   + their 2 applications and anything hanging off them (offers, messages,
--     interviews, notes, saved/reported entries, team seats, payment orders)
-- It does NOT delete the QA login accounts (m.manu1212+employer-a/-b/
-- +candidate2@proton.me); remove those in Authentication → Users if wanted.
do $$
declare
  v_cos uuid[] := array['8b6fd61a-8098-43d9-9cca-35c7eeaf8bb1','d2f9b85f-dbe7-4774-9a5a-4fefbe854b85']::uuid[];
  v_jobs uuid[];
  v_apps uuid[];
  t text;
begin
  select coalesce(array_agg(id), '{}') into v_jobs from public.jobs where company_id = any(v_cos);
  select coalesce(array_agg(id), '{}') into v_apps from public.applications where job_id = any(v_jobs);
  foreach t in array array['offers','messages','application_feedback','application_status_history','application_private'] loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I where application_id = any($1)', t) using v_apps;
    end if;
  end loop;
  if to_regclass('public.interviews') is not null then
    delete from public.interviews where job_id = any(v_jobs) or company_id = any(v_cos);
  end if;
  delete from public.applications where id = any(v_apps);
  foreach t in array array['saved_jobs','reports'] loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I where job_id = any($1)', t) using v_jobs;
    end if;
  end loop;
  delete from public.jobs where id = any(v_jobs);
  foreach t in array array['team_members','manual_payments','households'] loop
    if to_regclass('public.'||t) is not null then
      execute format('delete from public.%I where company_id = any($1)', t) using v_cos;
    end if;
  end loop;
  delete from public.companies where id = any(v_cos);
end $$;

-- Both numbers should be 0.
select (select count(*) from public.companies where id in ('8b6fd61a-8098-43d9-9cca-35c7eeaf8bb1','d2f9b85f-dbe7-4774-9a5a-4fefbe854b85')) as qa_companies_left,
       (select count(*) from public.jobs where id in ('44872b97-60f0-459a-8578-2476edeb61ee','f2e1e061-7267-4ec9-837f-769e55474cc2','59978559-dce6-4036-8303-3b7eebd3b244')) as qa_jobs_left;
