-- 052: abuse limits for the public write paths and CV parsing (security review
-- findings F-03 and F-04). Additive and reversible; nothing is deleted except
-- old rows of the two diagnostic tables noted below.
--
--  1. leads / reports: field-length bounds (leads) and a site-wide hourly cap on
--     submissions from non-staff callers, so the anonymous endpoints cannot be
--     used to fill the database or flood HQ with notification emails.
--  2. web_vitals: a per-minute cap (extra reports are dropped silently, they are
--     diagnostics) and 90-day retention.
--  3. claim_cv_parse(): a per-user limit on CV parsing (each parse can call the
--     Claude API, which costs money): 10 per hour, 30 per day.
--
-- Rollback: drop trigger trg_leads_rate/trg_reports_rate; drop constraint
-- leads_field_lengths; restore record_web_vitals from 051; drop function
-- claim_cv_parse() and table cv_parse_log.

-- ── 1. leads / reports ───────────────────────────────────────────────────────
alter table public.leads drop constraint if exists leads_field_lengths;
alter table public.leads add constraint leads_field_lengths check (
  char_length(coalesce(email, ''))   <= 254
  and char_length(coalesce(name, ''))    <= 200
  and char_length(coalesce(phone, ''))   <= 40
  and char_length(coalesce(company, '')) <= 200
  and char_length(coalesce(source, ''))  <= 100
  and char_length(coalesce(notes, ''))   <= 5000
) not valid;  -- NOT VALID: new and updated rows are checked, old rows are not rescanned

create index if not exists leads_created_at_idx   on public.leads   (created_at desc);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

create or replace function public.guard_public_insert_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_limit int := coalesce(nullif(tg_argv[0], '')::int, 300); v_n int;
begin
  if public.is_privileged_session() then return new; end if;
  execute format('select count(*) from public.%I where created_at > now() - interval ''1 hour''', tg_table_name) into v_n;
  if v_n >= v_limit then
    raise exception 'Too many submissions right now, please try again later' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.guard_public_insert_rate() from public, anon, authenticated;

drop trigger if exists trg_leads_rate on public.leads;
create trigger trg_leads_rate before insert on public.leads
  for each row execute function public.guard_public_insert_rate('300');
drop trigger if exists trg_reports_rate on public.reports;
create trigger trg_reports_rate before insert on public.reports
  for each row execute function public.guard_public_insert_rate('300');

-- ── 2. web_vitals: cap + retention ───────────────────────────────────────────
create or replace function public.record_web_vitals(
  p_page text,
  p_device text,
  p_connection text default null,
  p_build text default null,
  p_nav_type text default null,
  p_lcp_ms integer default null,
  p_fcp_ms integer default null,
  p_ttfb_ms integer default null,
  p_inp_ms integer default null,
  p_cls numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Site-wide ceiling: beyond ~25 reports a second the extras are dropped.
  if (select count(*) from public.web_vitals where created_at > now() - interval '1 minute') >= 1500 then
    return;
  end if;
  -- Retention: about 1 call in 100 trims reports older than 90 days.
  if random() < 0.01 then
    delete from public.web_vitals where created_at < now() - interval '90 days';
  end if;
  insert into public.web_vitals (page, device, connection, build, nav_type, lcp_ms, fcp_ms, ttfb_ms, inp_ms, cls)
  values (
    left(coalesce(nullif(p_page, ''), '/'), 200),
    case when p_device = 'desktop' then 'desktop' else 'mobile' end,
    left(p_connection, 20),
    left(p_build, 40),
    left(p_nav_type, 20),
    case when p_lcp_ms between 0 and 120000 then p_lcp_ms end,
    case when p_fcp_ms between 0 and 120000 then p_fcp_ms end,
    case when p_ttfb_ms between 0 and 120000 then p_ttfb_ms end,
    case when p_inp_ms between 0 and 60000 then p_inp_ms end,
    case when p_cls between 0 and 10 then round(p_cls, 4) end
  );
end $$;
revoke all on function public.record_web_vitals(text, text, text, text, text, integer, integer, integer, integer, numeric) from public;
grant execute on function public.record_web_vitals(text, text, text, text, text, integer, integer, integer, integer, numeric) to anon, authenticated;

-- ── 3. CV parsing quota ──────────────────────────────────────────────────────
create table if not exists public.cv_parse_log (
  id         bigint generated always as identity primary key,
  user_id    text not null,
  created_at timestamptz not null default now()
);
create index if not exists cv_parse_log_user_idx on public.cv_parse_log (user_id, created_at desc);
alter table public.cv_parse_log enable row level security;
revoke all on table public.cv_parse_log from public, anon, authenticated;

-- True when the signed-in user may parse another CV now (and records the use).
create or replace function public.claim_cv_parse()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid text := auth.uid()::text; v_hour int; v_day int;
begin
  if v_uid is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext('cv_parse:' || v_uid));
  delete from public.cv_parse_log where user_id = v_uid and created_at < now() - interval '2 days';
  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into v_hour, v_day
    from public.cv_parse_log where user_id = v_uid and created_at > now() - interval '1 day';
  if v_hour >= 10 or v_day >= 30 then return false; end if;
  insert into public.cv_parse_log (user_id) values (v_uid);
  return true;
end $$;
revoke all on function public.claim_cv_parse() from public, anon;
grant execute on function public.claim_cv_parse() to authenticated;
