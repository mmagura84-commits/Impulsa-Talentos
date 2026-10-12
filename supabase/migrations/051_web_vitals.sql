-- 051: Real-visitor load times (Core Web Vitals).
--
-- Each page view in a browser reports how fast it was for that visitor (the
-- `web-vitals` measurements: LCP, FCP, TTFB, INP, CLS) through
-- record_web_vitals(). Anonymous technical data only: page path (ids
-- removed), phone/desktop, connection type, site build. No user id, IP or
-- other personal data. HQ reads 75th-percentile summaries with
-- hq_web_vitals_summary(); nobody reads or writes the table directly.

create table if not exists public.web_vitals (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  page        text not null check (char_length(page) between 1 and 200),
  device      text not null check (device in ('mobile', 'desktop')),
  connection  text check (char_length(connection) <= 20),
  build       text check (char_length(build) <= 40),
  nav_type    text check (char_length(nav_type) <= 20),
  lcp_ms      integer check (lcp_ms between 0 and 120000),
  fcp_ms      integer check (fcp_ms between 0 and 120000),
  ttfb_ms     integer check (ttfb_ms between 0 and 120000),
  inp_ms      integer check (inp_ms between 0 and 60000),
  cls         numeric(6, 4) check (cls between 0 and 10)
);
create index if not exists web_vitals_created_at_idx on public.web_vitals (created_at desc);

alter table public.web_vitals enable row level security;
-- No policies: the table is only reached through the two functions below.
revoke all on table public.web_vitals from public, anon, authenticated;

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
  -- Out-of-range values are dropped rather than failing the report.
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

-- 75th percentile per page and device over the last p_days days (Google's
-- "good" thresholds: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1). Page '(all)'
-- is every page together.
create or replace function public.hq_web_vitals_summary(p_days integer default 7)
returns table (
  page text,
  device text,
  samples bigint,
  lcp_p75_ms integer,
  fcp_p75_ms integer,
  ttfb_p75_ms integer,
  inp_p75_ms integer,
  cls_p75 numeric,
  lcp_good_pct integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: HQ only' using errcode = '42501';
  end if;
  return query
  select
    coalesce(w.page, '(all)')::text,
    w.device::text,
    count(*)::bigint,
    (percentile_cont(0.75) within group (order by w.lcp_ms))::integer,
    (percentile_cont(0.75) within group (order by w.fcp_ms))::integer,
    (percentile_cont(0.75) within group (order by w.ttfb_ms))::integer,
    (percentile_cont(0.75) within group (order by w.inp_ms))::integer,
    round((percentile_cont(0.75) within group (order by w.cls))::numeric, 3),
    (100 * avg(case when w.lcp_ms is null then null when w.lcp_ms <= 2500 then 1 else 0 end))::integer
  from public.web_vitals w
  where w.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
  group by grouping sets ((w.device), (w.page, w.device))
  order by (w.page is not null), count(*) desc
  limit 60;
end $$;
revoke all on function public.hq_web_vitals_summary(integer) from public, anon;
grant execute on function public.hq_web_vitals_summary(integer) to authenticated;
