-- Role & permission tests for the Impulsa Talentos database.
-- Run with supabase/tests/run_tests.sh (rebuilds a throwaway local database).
-- Each check prints PASS/FAIL; the runner fails if any FAIL appears.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

-- ── Test helpers (run as the role currently set, i.e. SECURITY INVOKER) ──────
create schema if not exists t;
grant usage on schema t to anon, authenticated, service_role;

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
-- Signed up while the site was in English (the app sends it as metadata).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f2', 'english@test.co', '{"locale":"en"}');

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
select t.expect_ok('new user can sign up as employer (insert … returning, like the app)',
  $$insert into public.profiles (user_id, role, full_name, profile_status) values ('00000000-0000-0000-0000-0000000000f1', 'employer', 'New', 'rejected') returning *$$);
select t.reset();
select t.check('signup status forced to active', (select profile_status = 'active' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f1'));

\echo '── Email language'
select t.check('no sign-up language keeps the Spanish default',
  (select preferred_language = 'es' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f1'));
select t.act_as('00000000-0000-0000-0000-0000000000f2');
select t.expect_ok('English sign-up creates its profile',
  $$insert into public.profiles (user_id, role, full_name) values ('00000000-0000-0000-0000-0000000000f2', 'candidate', 'English') returning *$$);
select t.reset();
select t.check('profile takes the sign-up language',
  (select preferred_language = 'en' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f2'));
select t.act_as('00000000-0000-0000-0000-0000000000f2');
select t.expect_ok('user saves a language switch on their own profile',
  $$update public.profiles set preferred_language = 'pt' where user_id = '00000000-0000-0000-0000-0000000000f2'$$);
select t.expect_no_effect('user cannot change someone else''s language',
  $$update public.profiles set preferred_language = 'pt' where user_id = '00000000-0000-0000-0000-0000000000c2'$$);
select t.expect_error('only es/en/pt are accepted',
  $$update public.profiles set preferred_language = 'fr' where user_id = '00000000-0000-0000-0000-0000000000f2'$$);
select t.reset();
select t.check('language switch saved',
  (select preferred_language = 'pt' from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f2'));

\echo '── One front door (profile created at sign-up)'
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f3', 'hire@test.co', '{"role":"employer","full_name":"Ana Hiring","data_consent":true,"marketing_consent":true,"locale":"en"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'work@test.co', '{"role":"candidate","full_name":"Luis Work","data_consent":true}'),
  ('00000000-0000-0000-0000-0000000000f5', 'noconsent@test.co', '{"role":"candidate","full_name":"No Consent","data_consent":false}'),
  ('00000000-0000-0000-0000-0000000000f6', 'sneaky@test.co', '{"role":"admin","full_name":"Sneaky","data_consent":true}'),
  ('00000000-0000-0000-0000-0000000000f7', 'old@test.co', '{}');
select t.check('employer sign-up creates an active employer profile with consent and language',
  (select role = 'employer' and full_name = 'Ana Hiring' and profile_status = 'active'
          and data_processing_consent_at is not null and marketing_consent and preferred_language = 'en'
     from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f3'));
select t.check('candidate sign-up creates a candidate profile, Spanish by default, no marketing',
  (select role = 'candidate' and not marketing_consent and preferred_language = 'es'
     from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f4'));
select t.check('no consent, no profile',
  not exists (select 1 from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f5'));
select t.check('sign-up can never create an admin',
  not exists (select 1 from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f6'));
select t.check('old-style sign-up (no details) still works without a profile',
  exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000f7')
  and not exists (select 1 from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f7'));

\echo '── Publish before verification'
select t.act_as('00000000-0000-0000-0000-0000000000f3');
select t.expect_ok('new employer registers a company',
  $$insert into public.companies (id, employer_id, name, contact_email) values ('20000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f3', 'Queue Co', 'hr@queue.co')$$);
select t.expect_error('unverified company still cannot publish directly',
  $$insert into public.jobs (company_id, title, status) values ('20000000-0000-0000-0000-0000000000f3', 'Direct', 'open')$$);
select t.expect_ok('unverified company queues three jobs to go live when verified',
  $$insert into public.jobs (id, company_id, title, status, publish_when_verified, created_at) values
    ('30000000-0000-0000-0000-0000000000f1', '20000000-0000-0000-0000-0000000000f3', 'Queued one', 'draft', true, now() - interval '3 min'),
    ('30000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f3', 'Queued two', 'draft', true, now() - interval '2 min'),
    ('30000000-0000-0000-0000-0000000000f3', '20000000-0000-0000-0000-0000000000f3', 'Queued three', 'draft', true, now() - interval '1 min')$$);
select t.expect_error('employer cannot run the publisher themselves',
  $$select public.publish_queued_jobs('20000000-0000-0000-0000-0000000000f3')$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ verifies the company', $$select public.admin_verify_company('20000000-0000-0000-0000-0000000000f3', true)$$);
select t.reset();
select t.check('verification publishes the oldest queued job with the one trial credit',
  (select count(*) = 1 from public.jobs where company_id = '20000000-0000-0000-0000-0000000000f3' and status = 'open'
      and published_at is not null and expires_at is not null and not publish_when_verified)
  and (select job_credits = 0 from public.companies where id = '20000000-0000-0000-0000-0000000000f3')
  and (select status = 'draft' and publish_when_verified from public.jobs where id = '30000000-0000-0000-0000-0000000000f3'));
select t.check('employer is told which jobs went live and that one waits for credits',
  (select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'job_published')
  and exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'job_needs_credits'));
update public.companies set job_credits = job_credits + 3 where id = '20000000-0000-0000-0000-0000000000f3';
select t.check('a confirmed payment publishes the waiting jobs and charges one credit each',
  (select status = 'open' from public.jobs where id = '30000000-0000-0000-0000-0000000000f3')
  and (select job_credits = 1 from public.companies where id = '20000000-0000-0000-0000-0000000000f3'));
-- Keep later public-listing counts independent of this block.
update public.jobs set status = 'closed' where company_id = '20000000-0000-0000-0000-0000000000f3';

\echo '── Card payments (Wompi)'
select t.act_as('00000000-0000-0000-0000-0000000000f3');
select t.expect_error('no peso price, no card checkout',
  $$select * from public.start_card_payment('20000000-0000-0000-0000-0000000000f3', 'pro')$$);
select t.reset();
update public.billing_packages set amount_cop_cents = 39000000 where id = 'pro';
select t.act_as('00000000-0000-0000-0000-0000000000f3');
select t.expect_rows('employer starts a card payment for their company',
  $$select * from public.start_card_payment('20000000-0000-0000-0000-0000000000f3', 'pro')$$, 1);
select t.expect_error('employer cannot pay for another company',
  $$select * from public.start_card_payment('20000000-0000-0000-0000-0000000000e1', 'pro')$$);
select t.expect_error('employer cannot mark their own payment approved',
  $$select public.apply_card_payment((select reference from public.card_payments limit 1), 'APPROVED', 'tx', 39000000, 'COP')$$);
select t.expect_rows('employer sees their own order', $$select * from public.card_payments$$, 1);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000c1');
select t.expect_rows('others cannot see it', $$select * from public.card_payments$$, 0);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000f3');
select t.expect_rows('second order', $$select * from public.start_card_payment('20000000-0000-0000-0000-0000000000f3', 'pro')$$, 1);
select t.reset();
select t.act_as(null, 'service_role');
select t.check('a wrong amount is never granted',
  (select public.apply_card_payment((select reference from public.card_payments order by created_at limit 1), 'APPROVED', 'tx1', 100, 'COP') = 'error'));
select t.check('a verified approval adds the plan credits',
  (select public.apply_card_payment((select reference from public.card_payments where status = 'pending' limit 1), 'APPROVED', 'tx2', 39000000, 'COP') = 'approved'));
select t.check('a replayed event changes nothing',
  (select public.apply_card_payment((select reference from public.card_payments where status = 'approved' limit 1), 'APPROVED', 'tx2', 39000000, 'COP') = 'already approved'));
select t.reset();
select t.check('credits, plan and notice applied once',
  (select job_credits = 4 and plan = 'pro' and listing_days = 45 and max_applicants_per_job = 100
     from public.companies where id = '20000000-0000-0000-0000-0000000000f3')
  and (select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'payment_granted'));
update public.billing_packages set amount_cop_cents = null where id = 'pro';

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
select t.check('new company forced to trial: unverified, 1 credit, 14 days, 20 applicants',
  (select not verified and job_credits = 1 and listing_days = 14 and max_applicants_per_job = 20 from public.companies where name = 'Newco'));
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
select t.expect_ok('candidate applies to an open job (tries status hired; insert … returning)',
  $$insert into public.applications (id, job_id, candidate_id, status) values ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c2', 'hired') returning *$$);
select t.expect_error('candidate cannot apply to a draft job',
  $$insert into public.applications (job_id, candidate_id) values ((select id from public.jobs where title = 'Free draft'), '10000000-0000-0000-0000-0000000000c2')$$);
select t.expect_ok('candidate applies to the newly published job',
  $$insert into public.applications (job_id, candidate_id) values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000c2')$$);
select t.expect_error('candidate cannot withdraw someone else''s application',
  $$select public.withdraw_application('40000000-0000-0000-0000-000000000001')$$);
select t.reset();
select t.check('status forced to applied', (select status = 'applied' from public.applications where id = '40000000-0000-0000-0000-000000000002'));
select t.check('employer and team notified of new applicant',
  (select count(*) = 4 from public.notifications where type = 'application_received' and title like '%Cand Two'
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

\echo '── Closing a job'
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer closes a job with an open applicant', $$update public.jobs set status = 'closed' where id = '30000000-0000-0000-0000-000000000002'$$);
select t.reset();
select t.check('open applicants moved to position_closed', not exists (select 1 from public.applications where job_id = '30000000-0000-0000-0000-000000000002' and status = 'applied'));
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_no_effect('a job with applicants cannot be deleted', $$delete from public.jobs where id = '30000000-0000-0000-0000-000000000001'$$);
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

\echo '── Job moderation notice'
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ takes a job down', $$update public.jobs set moderation_status = 'rejected' where id = '30000000-0000-0000-0000-000000000001'$$);
select t.expect_ok('HQ restores it', $$update public.jobs set moderation_status = 'approved' where id = '30000000-0000-0000-0000-000000000001'$$);
select t.reset();
select t.check('employer told the job was removed', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and type = 'job_removed'));
select t.check('employer told the job is back', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and type = 'job_approved'));

\echo '── Payments'
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('employer submits payment (claims $1 for 999 credits)',
  $$select public.submit_manual_payment('20000000-0000-0000-0000-0000000000e1', 'pro', 1, 999, 'TRX-12345', 'paid')$$);
select t.expect_error('employer cannot approve own payment', $$select public.grant_company_credits((select id from public.manual_payments limit 1))$$);
select t.expect_error('unknown package refused', $$select public.submit_manual_payment('20000000-0000-0000-0000-0000000000e1', 'free-money', 0, 1000, 'TRX-1', '')$$);
select t.reset();
select t.check('HQ notified of the payment', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'hq_payment_submitted'));
select t.check('HQ notified of new leads', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'hq_new_lead'));
select t.check('HQ notified of verification request', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'hq_verification_requested'));
select t.check('HQ notified of job report', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and type = 'hq_job_reported'));
select t.check('amount and credits come from the catalog', (select amount_usd = 97 and requested_credits = 3 from public.manual_payments limit 1));
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_rows('HQ sees the payment queue', $$select * from public.admin_list_payments()$$, 1);
select t.expect_ok('HQ approves the payment', $$select public.grant_company_credits((select id from public.manual_payments limit 1))$$);
select t.reset();
select t.check('credits and plan applied', (select job_credits = 3 and plan = 'pro' and max_applicants_per_job = 100 from public.companies where id = '20000000-0000-0000-0000-0000000000e1'));
select t.check('employer notified of payment', exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000e1' and type = 'payment_granted'));
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_ok('payment without a reference is accepted',
  $$select public.submit_manual_payment('20000000-0000-0000-0000-0000000000e1', 'premium', 0, 0, null, '')$$);
select t.reset();
select t.check('HQ notified without a dangling ref', exists (select 1 from public.notifications where type = 'hq_payment_submitted' and body like 'premium%' and body not like '%ref%'));

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
select t.expect_rows('invitee now sees company applicants', $$select * from public.applications$$, 3);
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
select t.expect_error('HQ cannot erase a company owner before the company is handled', $$select public.admin_anonymize_profile('10000000-0000-0000-0000-0000000000e1')$$);
select t.expect_ok('HQ erases a team member', $$select public.admin_anonymize_profile('10000000-0000-0000-0000-0000000000b2')$$);
select t.reset();
select t.check('erased team member lost the seat and employer role',
  not exists (select 1 from public.team_members where user_id = '00000000-0000-0000-0000-0000000000b2')
  and (select role = 'candidate' from public.profiles where id = '10000000-0000-0000-0000-0000000000b2'));
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_rows('employers cannot read the admin audit log', $$select * from public.admin_audit_log$$, 0);
select t.reset();

\echo '── Database hardening (046)'
select t.check('no row-level policy calls auth.*() once per row',
  not exists (select 1 from pg_policies where schemaname = 'public'
    and (coalesce(qual, '') ~ '(?<!SELECT )auth\.(uid|jwt|role)\(\)' or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|jwt|role)\(\)')));
select t.check('flagged functions pin their search_path',
  not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('guard_notification_update', 'job_is_public', 'request_jwt_role')
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')));
insert into public.caregiver_profiles (user_id, verification_status, barrio, city)
  values ('00000000-0000-0000-0000-00000000ca01', 'verified', 'Laureles', 'Medellín');
select t.act_as(null, 'anon');
select t.check('public caregiver directory lists verified caregivers without account ids',
  (select count(*) = 1 and bool_and(user_id is null) from public.search_vetted_caregivers()));
select t.reset();
select t.act_as(null, 'anon');
select t.expect_ok('visitors can still browse the caregiver directory', $$select * from public.search_vetted_caregivers()$$);
select t.reset();

\echo '── Campaign readiness (047)'
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a7', 'tiktok@test.co', '{"role":"candidate","full_name":"Tik Tok","data_consent":true,"attribution":"{\"utm_source\":\"tiktok\",\"utm_campaign\":\"launch\",\"landing\":\"/jobs\",\"evil\":\"x\",\"at\":\"2026-10-12T00:00:00Z\"}"}'),
  ('00000000-0000-0000-0000-0000000000a8', 'broken@test.co', '{"role":"candidate","full_name":"Broken Tags","data_consent":true,"attribution":"not json"}');
select t.check('sign-up attribution lands on the profile, unknown keys dropped',
  (select signup_attribution ->> 'utm_source' = 'tiktok' and signup_attribution ->> 'utm_campaign' = 'launch'
          and not (signup_attribution ? 'evil')
     from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a7'));
select t.check('malformed attribution never blocks a sign-up',
  (select signup_attribution is null from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a8'));
update public.profiles set cv_url = 'storage:cvs:cvs/00000000-0000-0000-0000-0000000000a7/cv.pdf', parsed_cv_text = 'SQL Python'
 where user_id = '00000000-0000-0000-0000-0000000000a7';
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.check('HQ funnel counts the TikTok sign-up, its CV and the read text',
  (select signups = 1 and cv_uploaded = 1 and cv_read = 1 from public.admin_campaign_funnel() where source = 'tiktok' and campaign = 'launch'));
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a7');
select t.expect_error('candidates cannot read the campaign funnel', $$select * from public.admin_campaign_funnel()$$);
select t.reset();
select t.check('CV bucket enforces 10 MB and document/image types',
  (select file_size_limit = 10485760 and 'application/pdf' = any(allowed_mime_types) and not ('application/zip' = any(allowed_mime_types))
     from storage.buckets where id = 'cvs'));

\echo '── Matching and scoring (048)'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a5', 'match1@test.co'), ('00000000-0000-0000-0000-0000000000a6', 'match2@test.co');
insert into public.profiles (id, user_id, role, full_name, languages, location, experience_years, parsed_cv_text) values
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a5', 'candidate', 'Match Uno', 'Inglés C1', 'Medellín',
   4, 'Analista con experiencia en análisis de datos, SQL y Power BI.'),
  ('10000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a6', 'candidate', 'Match Dos', 'English A2', 'Bogotá',
   1, null);
update public.profiles set skills = '{SQL}' where id = '10000000-0000-0000-0000-0000000000a6';
insert into public.jobs (id, company_id, title, status, moderation_status, published_at, level, location_type,
                         skills_required, languages_required, salary_min, salary_max, currency) values
  ('30000000-0000-0000-0000-0000000000a5', '20000000-0000-0000-0000-0000000000e1', 'Bilingual Data Analyst', 'open', 'approved', now(),
   'Mid-level', 'Hybrid · Medellín', 'SQL, Power BI, Data Analysis, Python', 'English B2+, Spanish Native', 6000000, 9000000, 'COP');
insert into public.applications (id, job_id, candidate_id, status, cover_letter) values
  ('40000000-0000-0000-0000-0000000000a5', '30000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a5', 'applied', 'hola');
select t.check('a new job is scored against ready candidates',
  (select count(*) = 2 from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5'
     and profile_id in ('10000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a6')));
select t.check('Spanish CV text matches English job skills, and the missing one is named',
  (select score >= 80 and eligible and detail -> 'skills' -> 'missing' = '["python"]'::jsonb
          and detail -> 'skills' -> 'from_cv' ? 'data analysis'
     from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5' and profile_id = '10000000-0000-0000-0000-0000000000a5'));
select t.check('English two levels under the bar is flagged, not hidden',
  (select not eligible and score < 50 from public.job_matches
    where job_id = '30000000-0000-0000-0000-0000000000a5' and profile_id = '10000000-0000-0000-0000-0000000000a6'));
update public.profiles set languages = 'English B2' where id = '10000000-0000-0000-0000-0000000000a6';
select t.check('a profile change rescores at once',
  (select eligible from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5' and profile_id = '10000000-0000-0000-0000-0000000000a6'));
select t.act_as('00000000-0000-0000-0000-0000000000a5');
select t.expect_rows('a candidate sees only their own scores', $$select * from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5'$$, 1);
select t.expect_error('a candidate cannot write scores', $$insert into public.job_matches (job_id, profile_id, score, eligible, detail) values ('30000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a5', 100, true, '{}')$$);
select t.expect_error('only HQ can rebuild all scores', $$select public.admin_rebuild_matches()$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e1');
select t.expect_rows('an employer sees scores only for candidates who applied', $$select * from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5'$$, 1);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000e2');
select t.expect_rows('another company sees none', $$select * from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5'$$, 0);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ rebuilds all scores', $$select public.admin_rebuild_matches()$$);
select t.reset();
update public.jobs set status = 'closed' where id = '30000000-0000-0000-0000-0000000000a5';
select t.check('closing a job removes its scores',
  not exists (select 1 from public.job_matches where job_id = '30000000-0000-0000-0000-0000000000a5'));
update public.profiles set cv_extracted = '{"skills":["SQL"]}', cv_extracted_at = now(), cv_url = 'cvs/x/cv.pdf', parsed_cv_text = 'SQL'
 where id = '10000000-0000-0000-0000-0000000000a6';
update public.profiles set cv_url = '', parsed_cv_text = '' where id = '10000000-0000-0000-0000-0000000000a6';
select t.check('removing the CV also removes what was extracted from it',
  (select cv_extracted is null and cv_extracted_at is null from public.profiles where id = '10000000-0000-0000-0000-0000000000a6'));

-- ── Social accounts (049) ──
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_ok('HQ saves a social account with an encrypted password',
  $$select public.hq_save_social_account('instagram', 'Impulsa Talentos', '@impulsatalentos', 'https://www.instagram.com/impulsatalentos', 'social@impulsatalentos.expert', 'not-a-real-password')$$);
select t.expect_ok('HQ updates it without retyping the password',
  $$select public.hq_save_social_account('instagram', 'Impulsa Talentos', '@impulsa.talentos', 'https://www.instagram.com/impulsa.talentos', 'social@impulsatalentos.expert', null)$$);
select t.expect_error('a profile link must be https', $$select public.hq_save_social_account('tiktok', '', '@x', 'javascript:alert(1)', '', null)$$);
select t.reset();
select t.check('one row per channel, handle updated, password kept encrypted only',
  (select count(*) = 1 and bool_and(account_handle = '@impulsa.talentos' and secret_id is not null and secret_last4 = '')
     from public.marketing_credentials where channel_code = 'instagram'));
select t.check('the password is not stored in the table', not exists (
  select 1 from public.marketing_credentials where row_to_json(marketing_credentials)::text like '%not-a-real-password%'));
select t.check('campaign channels are switched on',
  (select count(*) = 5 from public.marketing_channels where active and code in ('meta_ads','youtube','telegram_jobs','whatsapp_channel','tiktok_ads')));
select t.act_as('00000000-0000-0000-0000-0000000000d1');
select t.expect_error('the MD cannot use the HQ save', $$select public.hq_save_social_account('facebook', '', '', '', '', null)$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a5');
select t.expect_error('a candidate cannot either', $$select public.hq_save_social_account('facebook', '', '', '', '', null)$$);
select t.reset();

-- ── Real-visitor load times (051) ──
select t.act_as_anon();
select t.expect_ok('a visitor reports load times', $$select public.record_web_vitals('/', 'mobile', '4g', 'abc123', 'navigate', 1400, 900, 120, 80, 0.02)$$);
select t.expect_ok('impossible values are dropped, not failed', $$select public.record_web_vitals('/jobs/', 'tablet', null, null, null, -5, 999999, null, null, 50)$$);
select t.expect_error('a visitor cannot read the table', $$select * from public.web_vitals$$);
select t.expect_error('a visitor cannot read the summary', $$select * from public.hq_web_vitals_summary(7)$$);
select t.reset();
select t.check('values were stored with bad ones nulled and the device normalized',
  (select count(*) = 1 from public.web_vitals where page = '/jobs/' and device = 'mobile' and lcp_ms is null and fcp_ms is null and cls is null));
select t.act_as('00000000-0000-0000-0000-0000000000a5');
select t.expect_error('a candidate cannot read the summary', $$select * from public.hq_web_vitals_summary(7)$$);
select t.expect_error('nor the table', $$select * from public.web_vitals$$);
select t.reset();
select t.act_as('00000000-0000-0000-0000-0000000000a1');
select t.expect_rows('HQ gets an all-pages row and one row per page', $$select * from public.hq_web_vitals_summary(7) where device = 'mobile'$$, 3);
select t.reset();
