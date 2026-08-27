-- 040_blocked_signup_emails.sql
-- Permanent signup ban mechanism (owner security/compliance request, 2026-08-26).
-- The live project has NO email signup allow-list (the shared "auth allow-list" is
-- site_url/uri_allow_list, which only constrains redirects, not who can register).
-- This adds a durable blocklist + BEFORE INSERT/UPDATE trigger on auth.users so a
-- banned email can never create (or re-point to) an account.
--
-- DESIGN NOTES (final, applied LIVE 2026-08-27):
--   * The blocklist lives in the `public` schema (the `auth` schema is not writable
--     through the Management-API role — `permission denied for schema auth`).
--   * To make it TAMPER-PROOF (cannot be read or removed via the public REST API),
--     RLS is enabled with no policies AND all DML/SELECT grants are revoked from
--     `anon`, `authenticated` and `service_role`. Only `postgres` holds privileges.
--     Real GoTrue signups are still blocked because the SECURITY DEFINER trigger
--     function runs as the table owner (postgres) and reads the blocklist directly,
--     bypassing RLS/grants. PostgREST (anon key) cannot read or write it: 401.
--   * Table is maintainable/auditable: future bans are just an INSERT, not a DDL change.
--
-- VERIFIED LIVE 2026-08-27:
--   - anon GET  /signup_blocklist -> 401 permission denied
--   - anon POST /signup_blocklist -> 401 permission denied (cannot un-ban / add rows)
--   - control  anon GET /companies -> 200 (public reads unaffected)
--   - INSERT banned email -> P0001 "This email is not permitted to sign up." (blocked)
--   - non-banned email insert/delete succeeds (normal signups unaffected)

-- 1) Durable blocklist table, locked down (RLS on + no anon/authenticated/service_role grants)
create table if not exists public.signup_blocklist (
  email      text primary key,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.signup_blocklist enable row level security;
revoke all on table public.signup_blocklist from anon, authenticated, service_role;

-- 2) Guard: SECURITY DEFINER (runs as owner, bypasses RLS) — raise on a matching email.
create or replace function public.prevent_blocked_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.signup_blocklist b
    where lower(b.email) = lower(trim(new.email))
  ) then
    raise exception 'This email is not permitted to sign up.';
  end if;
  return new;
end;
$$;

-- 3) BEFORE INSERT / UPDATE OF email ON auth.users — GoTrue can never create/re-point the account.
drop trigger if exists trg_prevent_blocked_signup on auth.users;
create trigger trg_prevent_blocked_signup
  before insert or update of email on auth.users
  for each row execute function public.prevent_blocked_signup();

-- 4) Record the owner-banned individual (single necessary/proportionate retention — just the email).
insert into public.signup_blocklist (email, reason)
values ('lauryospino1205@gmail.com', 'Owner request: permanent signup ban (2026-08-26)')
on conflict (email) do nothing;
