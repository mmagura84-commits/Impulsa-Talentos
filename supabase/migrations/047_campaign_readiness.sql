-- 047 — Campaign readiness: CV storage limits, sign-up attribution, funnel.
--
-- 1. The private `cvs` bucket enforces size and file type on the server (the
--    10 MB / PDF-Word check used to live only in the browser). Avatars and
--    caregiver documents share the bucket, so their image types stay allowed.
-- 2. profiles.signup_attribution: the first-touch campaign tags (utm_*, ref,
--    landing page, referrer host) the visitor arrived with. The app sends them
--    as auth metadata `attribution` at sign-up; a BEFORE INSERT trigger copies
--    them onto the profile when it is created (like 042's language).
-- 3. admin_campaign_funnel(): per source/campaign, how many candidates signed
--    up, completed a profile, uploaded a CV, had it read, and applied. HQ only.
--
-- Idempotent: safe to run more than once.

-- ── 1. Bucket limits ───────────────────────────────────────────────────────
update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array[
         'application/pdf',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'text/plain',
         'image/jpeg', 'image/png', 'image/webp', 'image/gif'
       ]
 where id = 'cvs';

-- ── 2. Sign-up attribution ─────────────────────────────────────────────────
alter table public.profiles add column if not exists signup_attribution jsonb;

create or replace function public.profile_attribution_from_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_raw text; v jsonb;
begin
  if new.signup_attribution is not null or new.user_id is null or new.user_id = '' then return new; end if;
  begin
    select u.raw_user_meta_data ->> 'attribution' into v_raw from auth.users u where u.id::text = new.user_id;
    v := v_raw::jsonb;
  exception when others then
    v := null;  -- missing, malformed, or no rights on auth.users
  end;
  if jsonb_typeof(v) = 'object' and v <> '{}'::jsonb then
    -- keep only known keys, short strings
    select jsonb_object_agg(key, left(value #>> '{}', 120)) into v
      from jsonb_each(v)
     where key in ('utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','landing','referrer','at')
       and jsonb_typeof(value) = 'string';
    new.signup_attribution := v;
  end if;
  return new;
end $$;
revoke all on function public.profile_attribution_from_signup() from public, anon, authenticated;

create or replace trigger trg_profile_attribution_from_signup
  before insert on public.profiles
  for each row execute function public.profile_attribution_from_signup();

-- ── 3. Campaign funnel for HQ ──────────────────────────────────────────────
create or replace function public.admin_campaign_funnel(p_since timestamptz default now() - interval '90 days')
returns table (
  source text, campaign text, signups bigint, profiles_completed bigint,
  cv_uploaded bigint, cv_read bigint, applied bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'HQ only' using errcode = '42501';
  end if;
  return query
    select
      coalesce(nullif(p.signup_attribution ->> 'utm_source', ''),
               case when p.signup_attribution ? 'ref' then 'referral' end,
               '(direct)') as source,
      coalesce(nullif(p.signup_attribution ->> 'utm_campaign', ''), '—') as campaign,
      count(*) as signups,
      count(*) filter (where coalesce(p.full_name, '') <> '' and coalesce(p.location, '') <> ''
                         and (coalesce(array_length(p.skills, 1), 0) > 0 or coalesce(p.bio, '') <> '')) as profiles_completed,
      count(*) filter (where coalesce(p.cv_url, '') <> '') as cv_uploaded,
      count(*) filter (where coalesce(p.parsed_cv_text, '') <> '') as cv_read,
      count(*) filter (where exists (select 1 from public.applications a where a.candidate_id = p.id)) as applied
    from public.profiles p
    where p.role = 'candidate' and p.created_at >= p_since
    group by 1, 2
    order by 3 desc;
end $$;
revoke all on function public.admin_campaign_funnel(timestamptz) from public, anon;
grant execute on function public.admin_campaign_funnel(timestamptz) to authenticated, service_role;
