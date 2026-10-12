-- 043: one front door — the profile is created at sign-up.
--
-- Before: people created a login, confirmed their email, then had to find the
-- Profile page to pick candidate/employer, type their name and tick the
-- Ley 1581 consent box before anything worked.
--
-- Now the sign-up form asks for those three things and sends them as auth
-- metadata (role, full_name, data_consent, marketing_consent, locale). This
-- trigger turns them into the profile row the moment the login is created, so
-- the person lands in their own workspace after confirming their email.
--
-- Safety:
--   * Only 'candidate' or 'employer' — never admin or md (HQ assigns those).
--   * No consent, no name, or no role → no profile; the old Profile page flow
--     still works for those accounts.
--   * Never blocks a sign-up: any error is logged as a warning and skipped.
--   * Idempotent: safe to run more than once.

create or replace function public.create_profile_from_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m         jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role    text  := m ->> 'role';
  v_name    text  := btrim(coalesce(m ->> 'full_name', ''));
  v_consent boolean := coalesce((m ->> 'data_consent') = 'true', false);
  v_mkt     boolean := coalesce((m ->> 'marketing_consent') = 'true', false);
begin
  if v_role is null or v_role not in ('candidate', 'employer') or v_name = '' or not v_consent then
    return new;
  end if;
  if exists (select 1 from public.profiles where user_id = new.id::text) then
    return new;
  end if;
  insert into public.profiles (user_id, email, full_name, role, profile_status,
                               data_processing_consent_at, marketing_consent, email_consent)
  values (new.id::text, new.email, left(v_name, 120), v_role, 'active',
          now(), v_mkt, v_mkt);
  -- preferred_language is filled from metadata `locale` by migration 042's trigger.
  return new;
exception when others then
  raise warning 'create_profile_from_signup skipped: %', sqlerrm;
  return new;
end $$;
revoke all on function public.create_profile_from_signup() from public, anon, authenticated;

drop trigger if exists trg_create_profile_from_signup on auth.users;
create trigger trg_create_profile_from_signup
  after insert on auth.users
  for each row execute function public.create_profile_from_signup();
