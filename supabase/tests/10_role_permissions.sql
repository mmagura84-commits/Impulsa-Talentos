-- Role & permission tests for the Impulsa Talentos database.
-- Run with supabase/tests/run_tests.sh (rebuilds a throwaway local database).
-- Each check prints PASS/FAIL; the runner fails if any FAIL appears.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ── Test helpers (run as the role currently set, i.e. SECURITY INVOKER) ──────
create schema if not exists t;
grant usage on schema t to anon, authenticated;

create or replace function t.act_as(p_uid text, p_role text default 'authenticated') returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_role)::text, false);
  perform set_config('role', p_role, false);
end $$;
create or replace function t.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  perform set_config('role', 'anon', false);
end $$;
create or replace function t.reset() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claims', '', false);
end $$;

-- Expect the statement to raise an error.
create or replace function t.expect_error(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'PASS  % (blocked: %)', p_label, left(sqlerrm, 80);
    return;
  end;
  raise notice 'FAIL  % (statement succeeded)', p_label;
end $$;
-- Expect success; optional exact row count for DML/queries.
create or replace function t.expect_rows(p_label text, p_sql text, p_rows integer) returns void language plpgsql as $$
declare n integer;
begin
  begin
    execute 'select count(*) from (' || p_sql || ') q' into n;
  exception when others then
    raise notice 'FAIL  % (error: %)', p_label, left(sqlerrm, 120);
    return;
  end;
  if n = p_rows then raise notice 'PASS  % (% rows)', p_label, n;
  else raise notice 'FAIL  % (expected % rows, got %)', p_label, p_rows, n; end if;
end $$;
create or replace function t.expect_ok(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'FAIL  % (error: %)', p_label, left(sqlerrm, 120);
    return;
  end;
  raise notice 'PASS  %', p_label;
end $$;
-- DML that RLS should silently filter: expect 0 affected rows (or an error).
create or replace function t.expect_no_effect(p_label text, p_sql text) returns void language plpgsql as $$
declare n integer;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    raise notice 'PASS  % (blocked: %)', p_label, left(sqlerrm, 80);
    return;
  end;
  if n = 0 then raise notice 'PASS  % (0 rows affected)', p_label;
  else raise notice 'FAIL  % (% rows affected)', p_label, n; end if;
end $$;
create or replace function t.check(p_label text, p_ok boolean) returns void language plpgsql as $$
begin
  if coalesce(p_ok, false) then raise notice 'PASS  %', p_label;
  else raise notice 'FAIL  %', p_label; end if;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── Fixtures (as the database owner: no API token = privileged) ─────────────
select t.reset();
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.co'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@test.co'),
  ('00000000-0000-0000-0000-0000000000d1', 'md@test.co'),
  ('00000000-0000-0000-0000-0000000000d2', 'mdpending@test.co'),
  ('00000000-0000-0000-0000-0000000000e1', 'emp1@test.co'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@test.co'),
  ('00000000-0000-0000-0000-0000000000e3', 'emp3@test.co'),
  ('00000000-0000-0000-0000-0000000000c1', 'cand1@test.co'),
  ('00000000-0000-0000-0000-0000000000c2', 'cand2@test.co'),
  ('00000000-0000-0000-0000-0000000000b1', 'member@test.co'),
  ('00000000-0000-0000-0000-0000000000b2', 'invitee@test.co'),
  ('00000000-0000-0000-0000-0000000000f1', 'newuser@test.co');

insert into public.profiles (id, user_id, role, full_name, email, profile_status) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'admin', 'Admin', 'admin@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1', 'md', 'MD Active', 'md@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d2', 'md', 'MD Pending', 'mdpending@test.co', 'pending'),
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 'employer', 'Emp One', 'emp1@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e2', 'employer', 'Emp Two', 'emp2@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e3', 'employer', 'Emp Three', 'emp3@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1', 'candidate', 'Cand One', 'cand1@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c2', 'candidate', 'Cand Two', 'cand2@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'employer', 'Member', 'member@test.co', 'active'),
  ('10000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b2', 'employer', 'Invitee', 'invitee@test.co', 'active');

insert into public.companies (id, employer_id, name, verified, job_credits, contact_email) values
  ('20000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 'Company One', true, 1, 'hr@one.co'),
  ('20000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e2', 'Company Two', false, 2, 'hr@two.co'),
  ('20000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e3', 'Company Three', false, 5, 'hr@three.co');
insert into public.team_members (company_id, user_id, role, status, invite_email) values
  ('20000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'member', 'active', 'member@test.co');

insert into public.jobs (id, company_id, title, status, published_at) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000e1', 'Open job', 'open', now()),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000e1', 'Draft job', 'draft', null),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000e1', 'Closed job', 'closed', now() - interval '10 days');
insert into public.applications (id, job_id, candidate_id, status, cover_letter) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c1', 'applied', 'hello');
insert into public.leads (email, name, company, status) values ('lead@prospect.co', 'Lead', 'Prospect SAS', 'new');

\echo '── Profiles & roles'
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_error('candidate cannot make themselves admin',
  $$update public.profiles set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000c1'$$);
select t.expect_error('candidate cannot approve themselves',
  $$update public.profiles set profile_status = 'rejected' where user_id = '00000000-0000-0000-0000-0000000000c1'$$);
select t.expect_ok('candidate can edit own name',
  $$update public.profiles set full_name = 'Cand Uno' where user_id = '00000000-0000-0000-0000-0000000000c1'$$);
select t.expect_no_effect('candidate cannot edit another profile',
  $$update public.profiles set full_name = 'x' where user_id = '00000000-0000-0000-0000-0000000000c2'$$);
select t.expect_error('candidate cannot call admin_set_user_role',
  $$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000c1', 'admin')$$);
select t.reset();

select t.act_as('00000000-0000-0000-0000-0000000000f1');
select t.expect_error('new user cannot sign up as admin',
  $$insert into public.profiles (user_id, role, full_name) values ('00000000-0000-0000-0000-0000000000f1', 'admin', 'x')$$);
select t.expect_error('new user cannot sign up as md',
  $$insert into public.profiles (user_id, role, full_name) values ('00000000-0000-0000-0000-0000000000f1', 'md', 'x')$$);
select t.expect_ok('new user can sign up as employer',
  $$insert into public.profiles (user_id, role, full_name, profile_status) values ('00000000-0000-0000-0000-0000000000f1', 'employer', 'New', 'rejected')$$);
select t.reset();
select t.check('signup status forced to active', (select profile_status = 'active' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f1'));

select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('admin assigns md role', $$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000b2', 'md', 'pending')$$);
select t.expect_ok('admin restores employer role', $$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000b2', 'employer', 'active')$$);
select t.expect_error('admin cannot remove the last admin', $$select public.admin_set_user_role('10000000-0000-0000-0000-0000000000a1', 'candidate')$$);
select t.reset();
select t.check('role changes are audit-logged', (select count(*) >= 2 from public.admin_audit_log where action = 'profile.role_or_status'));

\echo '── Leads'
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_rows('candidate cannot read leads', $$select * from public.leads$$, 0);
select t.expect_no_effect('candidate cannot edit leads', $$update public.leads set status = 'closed'$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000d2');
select t.check('pending MD has no role privileges', public.current_user_role() is null);
select t.expect_rows('pending MD cannot read leads', $$select * from public.leads$$, 0);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000d1');
select t.expect_rows('active MD reads leads', $$select * from public.leads$$, 1);
select t.reset();
select t.act_as_anon();
select t.expect_ok('visitor submits a lead', $$insert into public.leads (email, name, status) values ('v@x.co', 'V', 'new')$$);
select t.expect_rows('visitor cannot read leads', $$select * from public.leads$$, 0);
select t.reset();

\echo '── Companies'
select t.act_as('00000000-0000-0000-0000-0000000000e2');
select t.expect_error('employer cannot self-verify', $$update public.companies set verified = true where id = '20000000-0000-0000-0000-0000000000e2'$$);
select t.expect_error('employer cannot mint credits', $$update public.companies set job_credits = 999 where id = '20000000-0000-0000-0000-0000000000e2'$$);
select t.expect_ok('employer edits own description', $$update public.companies set description = 'We hire' where id = '20000000-0000-0000-0000-0000000000e2'$$);
select t.expect_ok('employer requests verification', $$update public.companies set verification_requested = true where id = '20000000-0000-0000-0000-0000000000e2'$$);
select t.expect_no_effect('employer cannot edit another company', $$update public.companies set description = 'x' where id = '20000000-0000-0000-0000-0000000000e1'$$);
select t.expect_no_effect('employer cannot delete company', $$delete from public.companies where id = '20000000-0000-0000-0000-0000000000e2'$$);
select t.expect_error('employer cannot verify via admin function', $$select public.admin_verify_company('20000000-0000-0000-0000-0000000000e2', true)$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ verifies a company', $$select public.admin_verify_company('20000000-0000-0000-0000-0000000000e2', true)$$);
select t.reset();
select t.check('verification saved', (select verified and verified_at is not null from public.companies where id = '20000000-0000-0000-0000-0000000000e2'));
select t.check('employer notified of verification', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e2' and type = 'company_verified'));
select t.act_as_anon();
select t.expect_ok('visitor reads public company columns', $$select id, name, verified from public.companies$$);
select t.expect_error('visitor cannot read company contact email', $$select contact_email from public.companies$$);
select t.expect_error('visitor cannot zero credits', $$select public.decrement_company_credits('20000000-0000-0000-0000-0000000000e1')$$);
select t.reset();

\echo '── New company signup'
select t.act_as('00000000-0000-0000-0000-0000000000f1');
select t.expect_ok('new employer creates company (tries verified + 999 credits)',
  $$insert into public.companies (employer_id, name, verified, job_credits) values ('00000000-0000-0000-0000-0000000000f1', 'Newco', true, 999)$$);
select t.reset();
select t.check('new company forced to trial: unverified, 2 credits, 14 days, 20 applicants',
  (select not verified and job_credits = 2 and listing_days = 14 and max_applicants_per_job = 20 from public.companies where name = 'Newco'));
select t.check('owner seat created for new company',
  exists (select 1 from public.team_members tm join public.companies c on c.id = tm.company_id where c.name = 'Newco' and tm.role = 'owner'));

\echo '── Jobs & credits'
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer publishes a draft (1 credit)', $$update public.jobs set status = 'open' where id = '30000000-0000-0000-0000-000000000002'$$);
select t.reset();
select t.check('credit charged, publish date and expiry set',
  (select c.job_credits = 0 and j.published_at is not null and j.expires_at is not null
     from public.jobs j join public.companies c on c.id = j.company_id where j.id = '30000000-0000-0000-0000-000000000002'));
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_error('publishing with 0 credits is refused',
  $$insert into public.jobs (company_id, title, status) values ('20000000-0000-0000-0000-0000000000e1', 'No credit', 'open')$$);
select t.expect_ok('drafts are free at 0 credits',
  $$insert into public.jobs (company_id, title, status) values ('20000000-0000-0000-0000-0000000000e1', 'Free draft', 'draft')$$);
select t.expect_ok('re-opening a published job is free', $$update public.jobs set status = 'open' where id = '30000000-0000-0000-0000-000000000003'$$);
select t.expect_error('employer cannot change moderation', $$update public.jobs set moderation_status = 'pending' where id = '30000000-0000-0000-0000-000000000001'$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e3');
select t.expect_error('unverified company cannot publish',
  $$insert into public.jobs (company_id, title, status) values ('20000000-0000-0000-0000-0000000000e3', 'Unverified', 'open')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ rejects a job', $$update public.jobs set moderation_status = 'rejected', moderation_reason = 'spam' where id = '30000000-0000-0000-0000-000000000003'$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_error('employer cannot undo HQ rejection', $$update public.jobs set moderation_status = 'approved' where id = '30000000-0000-0000-0000-000000000003'$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000b1');
select t.expect_rows('team member sees company jobs', $$select * from public.jobs where company_id = '20000000-0000-0000-0000-0000000000e1'$$, 4);
select t.expect_ok('team member edits a job', $$update public.jobs set title = 'Open job (edited)' where id = '30000000-0000-0000-0000-000000000001'$$);
select t.reset();
select t.act_as_anon();
select t.expect_rows('public sees only live approved jobs', $$select * from public.jobs$$, 2);
select t.reset();

\echo '── Applications'
select t.act_as('00000000-0000-0000-0000-0000000000c2');
select t.expect_ok('candidate applies to an open job (tries status hired)',
  $$insert into public.applications (id, job_id, candidate_id, status) values ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c2', 'hired')$$);
select t.expect_error('candidate cannot apply to a draft job',
  $$insert into public.applications (job_id, candidate_id) values ((select id from public.jobs where title = 'Free draft'), '10000000-0000-0000-0000-0000000000c2')$$);
select t.expect_error('candidate cannot withdraw someone else''s application',
  $$select public.withdraw_application('40000000-0000-0000-0000-000000000001')$$);
select t.reset();
select t.check('status forced to applied', (select status = 'applied' from public.applications where id = '40000000-0000-0000-0000-000000000002'));
select t.check('employer and team notified of new applicant',
  (select count(*) = 2 from public.notifications where type = 'application_received' and title like '%Cand Two'
     and user_id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1')));
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_no_effect('candidate cannot set own status', $$update public.applications set status = 'hired' where id = '40000000-0000-0000-0000-000000000001'$$);
select t.expect_ok('candidate withdraws own application', $$select public.withdraw_application('40000000-0000-0000-0000-000000000001', 'took another job')$$);
select t.expect_rows('candidate sees own status history', $$select * from public.application_status_history where application_id = '40000000-0000-0000-0000-000000000001'$$, 2);
select t.expect_rows('candidate still sees the job after it changes', $$select * from public.jobs where id = '30000000-0000-0000-0000-000000000001'$$, 1);
select t.expect_rows('candidate cannot read employer notes', $$select * from public.application_private$$, 0);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer writes private notes', $$insert into public.application_private (application_id, shortlisted, notes) values ('40000000-0000-0000-0000-000000000002', true, 'strong')$$);
select t.expect_ok('employer moves applicant forward', $$update public.applications set status = 'under_review' where id = '40000000-0000-0000-0000-000000000002'$$);
select t.expect_error('employer cannot reassign an application', $$update public.applications set candidate_id = '10000000-0000-0000-0000-0000000000c1' where id = '40000000-0000-0000-0000-000000000002'$$);
select t.reset();
select t.check('candidate notified of status change', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and type = 'application_status'));
select t.check('employer notified of withdrawal', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and type = 'application_withdrawn'));
select t.act_as('00000000-0000-0000-0000-0000000000e2');
select t.expect_rows('other employer cannot see applicants', $$select * from public.applications$$, 0);
select t.expect_rows('other employer cannot read notes', $$select * from public.application_private$$, 0);
select t.reset();

\echo '── Offers'
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer makes an offer', $$insert into public.offers (id, application_id, salary, status) values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 5000000, 'pending')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_error('another candidate cannot answer the offer', $$select public.respond_to_offer('50000000-0000-0000-0000-000000000001', true)$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000c2');
select t.expect_rows('candidate sees own offer', $$select * from public.offers$$, 1);
select t.expect_ok('candidate accepts the offer', $$select public.respond_to_offer('50000000-0000-0000-0000-000000000001', true)$$);
select t.reset();
select t.check('acceptance marks the application hired', (select status = 'hired' from public.applications where id = '40000000-0000-0000-0000-000000000002'));
select t.check('candidate was notified of the offer', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and type = 'offer_received'));
select t.check('employer notified of acceptance', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and type = 'offer_accepted'));

\echo '── Messages & interviews'
select t.act_as('00000000-0000-0000-0000-0000000000b1');
select t.expect_ok('team member messages a candidate', $$insert into public.messages (application_id, sender_id, body) values ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000b1', 'Welcome!')$$);
select t.reset();
select t.check('candidate notified of message', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and type = 'message_received'));
select t.act_as('00000000-0000-0000-0000-0000000000e2');
select t.expect_error('employer cannot create interviews for another company',
  $$insert into public.interviews (job_id, candidate_id, company_id, scheduled_at) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000e1', now())$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer schedules an interview for an applicant',
  $$insert into public.interviews (job_id, candidate_id, company_id, scheduled_at) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000e1', now() + interval '2 days')$$);
select t.expect_error('employer cannot interview a non-applicant',
  $$insert into public.interviews (job_id, candidate_id, company_id, scheduled_at) values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000e3', '20000000-0000-0000-0000-0000000000e1', now())$$);
select t.reset();
select t.check('candidate notified of interview', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and type like 'interview_%'));

\echo '── Candidate data (018 tables)'
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_ok('candidate adds work experience', $$insert into public.candidate_work_experience (profile_id, company_name, job_title, start_date) values ('10000000-0000-0000-0000-0000000000c1', 'Acme', 'Analyst', '2020-01-01')$$);
select t.expect_ok('candidate adds a document', $$insert into public.candidate_documents (profile_id, document_type, filename, file_url) values ('10000000-0000-0000-0000-0000000000c1', 'id_document', 'cedula.pdf', 'storage:cvs:x/cedula.pdf')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000c2');
select t.expect_rows('other candidate cannot read it', $$select * from public.candidate_work_experience$$, 0);
select t.expect_error('other candidate cannot add rows for someone else', $$insert into public.candidate_work_experience (profile_id, company_name, start_date) values ('10000000-0000-0000-0000-0000000000c1', 'x', '2020-01-01')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_rows('employer reads applicant work history', $$select * from public.candidate_work_experience$$, 1);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e2');
select t.expect_rows('unrelated employer cannot read it', $$select * from public.candidate_work_experience$$, 0);
select t.reset();
select t.act_as_anon();
select t.expect_error('visitor cannot read candidate documents', $$select * from public.candidate_documents$$);
select t.expect_rows('visitor cannot read status history', $$select * from public.application_status_history$$, 0);
select t.reset();

\echo '── Caregivers'
select t.act_as('00000000-0000-0000-0000-0000000000c2');
select t.expect_ok('caregiver creates profile (tries verified)', $$insert into public.caregiver_profiles (user_id, verification_status) values ('00000000-0000-0000-0000-0000000000c2', 'verified')$$);
select t.expect_error('caregiver cannot mark self verified', $$update public.caregiver_profiles set verification_status = 'verified' where user_id = '00000000-0000-0000-0000-0000000000c2'$$);
select t.expect_rows('non-admin caregiver list is empty', $$select * from public.admin_list_caregivers('00000000-0000-0000-0000-0000000000a1')$$, 0);
select t.reset();
select t.check('caregiver forced to unverified', (select verification_status = 'unverified' from public.caregiver_profiles where user_id = '00000000-0000-0000-0000-0000000000c2'));
select t.act_as_anon();
select t.expect_error('visitor cannot list caregivers', $$select * from public.admin_list_caregivers('00000000-0000-0000-0000-0000000000a1')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_rows('admin lists caregivers', $$select * from public.admin_list_caregivers()$$, 1);
select t.reset();

\echo '── Notifications'
select t.act_as_anon();
select t.expect_error('visitor cannot push notifications', $$select public.notify_user('00000000-0000-0000-0000-0000000000c1', 'x', 'spam', 'spam', '{}')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000c2');
select t.expect_error('user cannot push notifications', $$select public.notify_user('00000000-0000-0000-0000-0000000000c1', 'x', 'spam', 'spam', '{}')$$);
select t.expect_error('user cannot rewrite a notification', $$update public.notifications set title = 'fake' where user_id = '00000000-0000-0000-0000-0000000000c2'$$);
select t.expect_ok('user marks notifications read', $$update public.notifications set read_at = now() where user_id = '00000000-0000-0000-0000-0000000000c2'$$);
select t.reset();

\echo '── Reports'
select t.act_as_anon();
select t.expect_ok('visitor reports a job', $$select public.report_job('30000000-0000-0000-0000-000000000001', 'scam', 'asks for money')$$);
select t.expect_error('direct report inserts are closed', $$insert into public.reports (job_id, reason) values ('30000000-0000-0000-0000-000000000001', 'x')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ resolves a report', $$update public.reports set status = 'dismissed', reviewed_at = now()$$);
select t.reset();

\echo '── Payments'
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer submits payment (claims $1 for 999 credits)',
  $$select public.submit_manual_payment('20000000-0000-0000-0000-0000000000e1', 'pro', 1, 999, 'TRX-12345', 'paid')$$);
select t.expect_error('employer cannot approve own payment', $$select public.grant_company_credits((select id from public.manual_payments limit 1))$$);
select t.expect_error('unknown package refused', $$select public.submit_manual_payment('20000000-0000-0000-0000-0000000000e1', 'free-money', 0, 1000, 'TRX-1', '')$$);
select t.reset();
select t.check('amount and credits come from the catalog', (select amount_usd = 97 and requested_credits = 3 from public.manual_payments limit 1));
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_rows('HQ sees the payment queue', $$select * from public.admin_list_payments()$$, 1);
select t.expect_ok('HQ approves the payment', $$select public.grant_company_credits((select id from public.manual_payments limit 1))$$);
select t.reset();
select t.check('credits and plan applied', (select job_credits = 3 and plan = 'pro' and max_applicants_per_job = 100 from public.companies where id = '20000000-0000-0000-0000-0000000000e1'));
select t.check('employer notified of payment', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and type = 'payment_granted'));

\echo '── Team'
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('owner invites a member by email', $$insert into public.team_members (company_id, user_id, role, invite_email) values ('20000000-0000-0000-0000-0000000000e1', 'x', 'member', 'Invitee@test.co')$$);
select t.expect_error('owner cannot create a second owner seat', $$insert into public.team_members (company_id, user_id, role, invite_email) values ('20000000-0000-0000-0000-0000000000e1', 'x', 'owner', 'z@test.co')$$);
select t.expect_error('owner seat cannot be deleted from the app', $$delete from public.team_members where role = 'owner' and company_id = '20000000-0000-0000-0000-0000000000e1'$$);
select t.reset();
select t.check('invite starts pending', exists (select 1 from public.team_members where invite_email = 'Invitee@test.co' and status = 'pending'));
select t.act_as('00000000-0000-0000-0000-0000000000b2');
select t.expect_rows('invitee sees no applicants before accepting', $$select * from public.applications$$, 0);
select t.expect_ok('invitee accepts on sign-in', $$select public.accept_team_invites()$$);
select t.expect_rows('invitee now sees company applicants', $$select * from public.applications$$, 2);
select t.reset();

\echo '── Managing Director'
select t.act_as('00000000-0000-0000-0000-0000000000d1');
select t.expect_rows('unassigned MD sees no company drafts', $$select * from public.jobs where status = 'draft'$$, 0);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ assigns MD to Company One', $$select public.admin_assign_md('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000d1')$$);
select t.expect_error('HQ cannot assign a non-MD', $$select public.admin_assign_md('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000c1')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000d1');
select t.expect_rows('assigned MD sees company drafts', $$select * from public.jobs where status = 'draft'$$, 1);
select t.expect_no_effect('MD cannot edit company jobs', $$update public.jobs set title = 'x' where company_id = '20000000-0000-0000-0000-0000000000e1'$$);
select t.expect_ok('MD logs a meeting', $$insert into public.meetings (employer_name, meeting_date) values ('Company One', now())$$);
select t.expect_error('MD cannot forge audit rows', $$insert into public.md_audit_log (submitter_id, action) values ('00000000-0000-0000-0000-0000000000d1', 'fake')$$);
select t.expect_ok('MD writes audit through the function', $$select public.md_write_audit('test', 'meeting', 'x', '{}')$$);
select t.expect_error('MD cannot reveal secrets', $$select public.admin_read_credential_secret('banking', gen_random_uuid(), 'account_number')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_rows('candidate cannot see meetings', $$select * from public.meetings$$, 0);
select t.expect_error('candidate cannot read the audit log list', $$select public.md_list_audit()$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.check('HQ audit list names the MD', (select (public.md_list_audit() -> 0 ->> 'submitter_name') = 'MD Active'));
select t.reset();

\echo '── Privacy'
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.check('candidate exports own data', (select (public.export_my_data() -> 'profile' ->> 'full_name') = 'Cand Uno'));
select t.expect_ok('candidate requests deletion', $$select public.request_account_deletion()$$);
select t.expect_error('candidate cannot anonymize others', $$select public.admin_anonymize_profile('10000000-0000-0000-0000-0000000000c2')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ anonymizes on request', $$select public.admin_anonymize_profile('10000000-0000-0000-0000-0000000000c1')$$);
select t.expect_rows('HQ reads the admin audit log', $$select * from public.admin_audit_log where action = 'profile.anonymize'$$, 1);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_rows('employers cannot read the admin audit log', $$select * from public.admin_audit_log$$, 0);
select t.reset();
