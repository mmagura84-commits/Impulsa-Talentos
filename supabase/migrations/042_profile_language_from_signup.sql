-- 042: emails in the language the person chose on the site.
--
-- Emails go out in profiles.preferred_language, which defaulted to 'es' for
-- everyone because the site only kept the language in the browser.
--
-- The app now (a) sends the language shown at sign-up as auth user metadata
-- `locale`, and (b) saves an explicit language switch to both the metadata and
-- the profile. The profile row itself is created later by the app (profile /
-- onboarding pages), so this trigger copies the metadata language onto it when
-- it is created — on any device, whichever page creates it.
--
-- Idempotent: safe to run more than once.

create or replace function public.profile_language_from_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_locale text;
begin
  if new.user_id is null or new.user_id = '' then return new; end if;
  begin
    select u.raw_user_meta_data ->> 'locale' into v_locale
      from auth.users u where u.id::text = new.user_id;
  exception when others then
    v_locale := null;  -- no rights on auth.users: keep the column default
  end;
  if v_locale in ('es', 'en', 'pt') then
    new.preferred_language := v_locale;
  end if;
  return new;
end $$;
revoke all on function public.profile_language_from_signup() from public, anon, authenticated;

drop trigger if exists trg_profile_language_from_signup on public.profiles;
create trigger trg_profile_language_from_signup
  before insert on public.profiles
  for each row execute function public.profile_language_from_signup();
