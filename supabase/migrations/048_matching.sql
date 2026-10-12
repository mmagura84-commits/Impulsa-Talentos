-- 048 — Matching and scoring v1 (candidate ⇄ job), computed in the database.
--
-- One transparent score per (open job, candidate), 0–100, the same number for
-- both sides, stored with its parts and a structured "why you match":
--
--   hard check   every required language at most one level below the bar
--                (eligible = false otherwise; never an automatic rejection)
--   score        100 × (0.40 skills + 0.20 language + 0.15 experience
--                       + 0.10 salary + 0.10 location + 0.05 role)
--
-- Skills count when they are in the profile, in the fields Claude extracted
-- from the CV (profiles.cv_extracted, filled by the parse-cv function), or
-- named in the CV text. Spanish and English names of the same skill are linked
-- through skill_aliases. Scores refresh by trigger whenever a candidate's
-- matching fields or a job change; admin_rebuild_matches() redoes everything.
--
-- Privacy: a candidate reads only their own rows; an employer reads rows only
-- for candidates who applied to their company's jobs; HQ reads all.
-- Idempotent.

-- ── Columns filled by CV extraction ────────────────────────────────────────
alter table public.profiles
  add column if not exists cv_extracted jsonb,
  add column if not exists cv_extracted_at timestamptz;

-- ── Text helpers ───────────────────────────────────────────────────────────
-- lower case, accents off, punctuation to spaces (keeps + # and inner dots:
-- c++, c#, node.js), single spaces.
create or replace function public.match_norm(t text)
returns text language sql immutable set search_path = public as $$
  select trim(regexp_replace(regexp_replace(regexp_replace(
           translate(lower(coalesce(t, '')), 'áéíóúüñàèìòùâêîôûãõç', 'aeiouunaeiouaeiouaoc'),
           '[^a-z0-9+#.]+', ' ', 'g'),
         '\.(\s|$)', ' \1', 'g'),
       '\s+', ' ', 'g'))
$$;

create table if not exists public.skill_aliases (
  alias     text primary key,   -- match_norm() form
  canonical text not null
);
alter table public.skill_aliases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'skill_aliases' and policyname = 'skill_aliases_read') then
    create policy skill_aliases_read on public.skill_aliases for select using (true);
  end if;
end $$;

insert into public.skill_aliases (alias, canonical) values
  ('atencion al cliente', 'customer service'), ('servicio al cliente', 'customer service'),
  ('customer service', 'customer service'), ('customer support', 'customer service'),
  ('soporte al cliente', 'customer service'), ('atencion de clientes', 'customer service'),
  ('customer success', 'customer success'), ('exito del cliente', 'customer success'),
  ('soporte tecnico', 'technical support'), ('technical support', 'technical support'),
  ('tech support', 'technical support'), ('help desk', 'technical support'), ('mesa de ayuda', 'technical support'),
  ('ventas', 'sales'), ('sales', 'sales'), ('comercial', 'sales'),
  ('analisis de datos', 'data analysis'), ('data analysis', 'data analysis'),
  ('analitica de datos', 'data analysis'), ('data analytics', 'data analysis'),
  ('gestion de proyectos', 'project management'), ('administracion de proyectos', 'project management'),
  ('project management', 'project management'),
  ('contabilidad', 'accounting'), ('accounting', 'accounting'),
  ('finanzas', 'finance'), ('finance', 'finance'),
  ('excel', 'excel'), ('microsoft excel', 'excel'), ('excel avanzado', 'excel'), ('advanced excel', 'excel'),
  ('power bi', 'power bi'), ('powerbi', 'power bi'),
  ('mercadeo', 'marketing'), ('marketing', 'marketing'),
  ('marketing digital', 'digital marketing'), ('mercadeo digital', 'digital marketing'), ('digital marketing', 'digital marketing'),
  ('recursos humanos', 'human resources'), ('talento humano', 'human resources'), ('human resources', 'human resources'),
  ('reclutamiento', 'recruitment'), ('seleccion de personal', 'recruitment'), ('recruitment', 'recruitment'),
  ('recruiting', 'recruitment'), ('talent acquisition', 'recruitment'),
  ('logistica', 'logistics'), ('logistics', 'logistics'),
  ('desarrollo de software', 'software development'), ('software development', 'software development'),
  ('aseguramiento de calidad', 'quality assurance'), ('quality assurance', 'quality assurance'), ('qa', 'quality assurance'),
  ('pruebas de software', 'quality assurance'), ('software testing', 'quality assurance'),
  ('negociacion', 'negotiation'), ('negotiation', 'negotiation'),
  ('liderazgo', 'leadership'), ('leadership', 'leadership'),
  ('trabajo en equipo', 'teamwork'), ('teamwork', 'teamwork'),
  ('comunicacion', 'communication'), ('communication', 'communication'),
  ('call center', 'contact center'), ('centro de contacto', 'contact center'), ('contact center', 'contact center'),
  ('js', 'javascript'), ('javascript', 'javascript'), ('reactjs', 'react'), ('react.js', 'react'), ('react', 'react'),
  ('node', 'node.js'), ('nodejs', 'node.js'), ('node.js', 'node.js'),
  ('postgres', 'postgresql'), ('postgresql', 'postgresql')
on conflict (alias) do nothing;

create or replace function public.match_canon(t text)
returns text language sql stable set search_path = public as $$
  select coalesce((select a.canonical from public.skill_aliases a where a.alias = public.match_norm(t)),
                  public.match_norm(t))
$$;

-- Language → best level, 1 (A1) … 6 (C2 / native). Reads free text such as
-- "English B2+, Spanish Native", "Inglés avanzado y francés básico".
create or replace function public.match_lang_levels(t text)
returns table (lang text, lvl int) language plpgsql immutable set search_path = public as $$
declare item text; l text; v int;
begin
  for item in
    select x from regexp_split_to_table(
      translate(lower(coalesce(t, '')), 'áéíóúüñàèìòùâêîôûãõç', 'aeiouunaeiouaeiouaoc'),
      '\s*[,;|/\n]\s*|\s+(y|and)\s+') as x
  loop
    l := case
      when item ~ '(english|ingles)' then 'english'
      when item ~ '(spanish|espanol|castellano)' then 'spanish'
      when item ~ '(portuguese|portugues)' then 'portuguese'
      when item ~ '(french|frances)' then 'french'
      when item ~ '(german|aleman)' then 'german'
      when item ~ '(italian|italiano)' then 'italian'
    end;
    continue when l is null;
    v := case
      when item ~ 'c2' then 6 when item ~ 'c1' then 5 when item ~ 'b2' then 4
      when item ~ 'b1' then 3 when item ~ 'a2' then 2 when item ~ 'a1' then 1
      when item ~ '(native|nativ|materna|mother tongue|bilingu)' then 6
      when item ~ '(fluent|fluid|advanced|avanzad)' then 5
      when item ~ '(upper.intermediate|intermedio.alto|intermedia.alta)' then 4
      when item ~ '(intermediate|intermedi)' then 3
      when item ~ '(basic|basico|basica|beginner|principiante|elementary)' then 1
      else 3
    end;
    lang := l; lvl := v; return next;
  end loop;
end $$;

-- ── Features: each profile and job normalized ONCE, then paired cheaply ──
-- (Scoring 5,000 candidates against a new job by re-reading every CV took
-- ~30 s; with stored features it is a set of array and string lookups.)
create table if not exists public.match_profile_features (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  ready        boolean not null,
  skills       text[] not null default '{}',   -- canonical: typed + extracted from the CV
  text_norm    text not null default ' ',      -- ' ' || CV text + bio + headline, normalized || ' '
  langs        jsonb not null default '{}',    -- {"english":5,"spanish":6}
  years        numeric,
  loc_norm     text not null default '',
  relocate     boolean not null default false,
  wants_remote boolean not null default false,
  salary_min   numeric,
  currency     text,
  role_tokens  text[] not null default '{}',
  updated_at   timestamptz not null default now()
);
create table if not exists public.match_job_features (
  job_id       uuid primary key references public.jobs(id) on delete cascade,
  public       boolean not null,
  skills       text[] not null default '{}',   -- canonical
  terms        jsonb not null default '{}',    -- canonical -> [words that name it]
  langs        jsonb not null default '{}',    -- required {"english":4}
  band         text, lo numeric, hi numeric,
  remote       boolean not null default false,
  city         text not null default '',
  salary_max   numeric,
  currency     text,
  title_tokens text[] not null default '{}',
  updated_at   timestamptz not null default now()
);
alter table public.match_profile_features enable row level security;   -- no client access
alter table public.match_job_features enable row level security;
revoke all on public.match_profile_features, public.match_job_features from anon, authenticated;

create or replace function public.match_lang_map(t text)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(lang, lvl), '{}'::jsonb)
    from (select lang, max(lvl) lvl from public.match_lang_levels(t) group by lang) x
$$;

create or replace function public.build_profile_features(p public.profiles)
returns public.match_profile_features language plpgsql stable set search_path = public as $$
declare f public.match_profile_features;
begin
  f.profile_id := p.id;
  f.ready := p.role = 'candidate' and (coalesce(cardinality(p.skills), 0) > 0 or coalesce(p.parsed_cv_text, '') <> ''
             or p.cv_extracted is not null or coalesce(p.languages, '') <> '');
  select coalesce(array_agg(distinct public.match_canon(x)), '{}') into f.skills
    from (select unnest(coalesce(p.skills, '{}')) x
          union all select jsonb_array_elements_text(coalesce(p.cv_extracted -> 'skills', '[]'))) z
   where public.match_norm(x) <> '';
  f.text_norm := ' ' || public.match_norm(concat_ws(' ', left(p.parsed_cv_text, 20000), p.bio, p.headline)) || ' ';
  f.langs := public.match_lang_map(concat_ws(', ', p.languages,
    (select string_agg(concat_ws(' ', e ->> 'name', e ->> 'level'), ', ') from jsonb_array_elements(coalesce(p.cv_extracted -> 'languages', '[]')) e)));
  f.years := coalesce(p.experience_years::numeric, case when (p.cv_extracted ->> 'years_experience') ~ '^\d+(\.\d+)?$' then (p.cv_extracted ->> 'years_experience')::numeric end);
  f.loc_norm := public.match_norm(p.location);
  f.relocate := coalesce(p.willing_to_relocate, false);
  f.wants_remote := public.match_norm(p.preferred_location_type) ~ '(remote|remoto)';
  f.salary_min := p.desired_salary_min;
  f.currency := nullif(p.currency_preference, '');
  f.role_tokens := array(select x from regexp_split_to_table(public.match_norm(coalesce(nullif(p.desired_role, ''), nullif(p.headline, ''), p.cv_extracted ->> 'desired_role', '')), ' ') x
                         where length(x) > 2 and x not in ('senior','junior','mid','lead','bilingual','bilingue','the','and','con','for','para','del','las','los'));
  f.updated_at := now();
  return f;
end $$;

create or replace function public.build_job_features(j public.jobs)
returns public.match_job_features language plpgsql stable set search_path = public as $$
declare f public.match_job_features; jl text;
begin
  f.job_id := j.id;
  f.public := public.job_is_public(j);
  select coalesce(array_agg(distinct public.match_canon(x)) filter (where public.match_norm(x) <> ''), '{}')
    into f.skills from regexp_split_to_table(coalesce(j.skills_required, ''), '\s*[,;|]\s*') x;
  select coalesce(jsonb_object_agg(c, (select coalesce(jsonb_agg(distinct t), '[]') from (
            select c as t union select a.alias from public.skill_aliases a where a.canonical = c) tt)), '{}')
    into f.terms from unnest(f.skills) c;
  f.langs := public.match_lang_map(j.languages_required);
  jl := public.match_norm(j.level);
  if jl ~ '(lead|manager|director|head|principal|gerente|jefe)' then f.band := 'lead'; f.lo := 7; f.hi := 99;
  elsif jl ~ '(senior|sr)' then f.band := 'senior'; f.lo := 5; f.hi := 99;
  elsif jl ~ '(mid|semi|intermedi)' then f.band := 'mid'; f.lo := 2; f.hi := 5;
  elsif jl ~ '(junior|jr|entry|trainee|practicante|aprendiz)' then f.band := 'junior'; f.lo := 0; f.hi := 2;
  end if;
  jl := public.match_norm(j.location_type);
  f.remote := jl ~ '(remote|remoto)';
  f.city := public.match_norm(split_part(j.location_type, '·', 2));
  if f.city = '' then f.city := trim(regexp_replace(jl, '^(on site|onsite|presencial|hybrid|hibrido)\s*', '')); end if;
  f.salary_max := j.salary_max;
  f.currency := j.currency;
  f.title_tokens := array(select x from regexp_split_to_table(public.match_norm(j.title), ' ') x);
  f.updated_at := now();
  return f;
end $$;

-- ── The score for one (candidate, job) pair ────────────────────────────────
create or replace function public.score_pair(pf public.match_profile_features, jf public.match_job_features)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  matched text[] := '{}'; missing text[] := '{}'; from_cv text[] := '{}'; c text; t text; hit boolean;
  s_skills numeric; s_lang numeric; s_exp numeric := 0.5; s_sal numeric := 0.5; s_loc numeric := 0.5; s_role numeric := 0;
  langs jsonb := '[]'; eligible boolean := true; n int := 0; tot numeric := 0; req record; has int;
  exp_state text := 'unknown'; sal_state text := 'unknown'; loc_state text := 'unknown'; overlap int; score int;
begin
  foreach c in array jf.skills loop
    if c = any(pf.skills) then matched := matched || c;
    else
      hit := false;
      for t in select jsonb_array_elements_text(jf.terms -> c) loop
        if strpos(pf.text_norm, ' ' || t || ' ') > 0 then hit := true; exit; end if;
      end loop;
      if hit then matched := matched || c; from_cv := from_cv || c; else missing := missing || c; end if;
    end if;
  end loop;
  s_skills := case when cardinality(jf.skills) = 0 then 0.6 else cardinality(matched)::numeric / cardinality(jf.skills) end;

  for req in select key as lang, value::int as lvl from jsonb_each_text(jf.langs) loop
    has := (pf.langs ->> req.lang)::int;
    if has is null and req.lang = 'spanish' then has := 6; end if;   -- Colombian market: Spanish assumed native when unstated
    has := coalesce(has, 0);
    n := n + 1;
    tot := tot + case when has >= req.lvl then 1 when has = req.lvl - 1 then 0.5 else 0 end;
    if has <= req.lvl - 2 then eligible := false; end if;
    langs := langs || jsonb_build_object('lang', req.lang, 'req', req.lvl, 'has', has, 'ok', has >= req.lvl);
  end loop;
  s_lang := case when n = 0 then 1 else tot / n end;

  if jf.band is not null and pf.years is not null then
    if pf.years >= jf.lo and pf.years <= jf.hi then s_exp := 1; exp_state := 'fits';
    elsif pf.years < jf.lo and pf.years >= jf.lo - 1 then s_exp := 0.6; exp_state := 'close';
    elsif pf.years > jf.hi then s_exp := 0.7; exp_state := 'more';
    else s_exp := 0.2; exp_state := 'less'; end if;
  end if;

  if jf.salary_max is not null and pf.salary_min is not null then   -- same currency only; no invented exchange rate
    if coalesce(pf.currency, jf.currency) <> jf.currency then s_sal := 0.5; sal_state := 'other_currency';
    elsif jf.salary_max >= pf.salary_min then s_sal := 1; sal_state := 'fits';
    elsif jf.salary_max >= 0.85 * pf.salary_min then s_sal := 0.5; sal_state := 'close';
    else s_sal := 0; sal_state := 'below'; end if;
  end if;

  if jf.remote then s_loc := 1; loc_state := 'remote';
  elsif jf.city <> '' then
    if pf.loc_norm <> '' and position(jf.city in pf.loc_norm) > 0 then s_loc := 1; loc_state := 'same_city';
    elsif pf.relocate then s_loc := 0.6; loc_state := 'relocate';
    elsif pf.wants_remote then s_loc := 0.2; loc_state := 'wants_remote';
    elsif pf.loc_norm <> '' then s_loc := 0.3; loc_state := 'other_city';
    end if;
  end if;

  if cardinality(pf.role_tokens) > 0 then
    select count(*) into overlap from unnest(pf.role_tokens) r where r = any(jf.title_tokens);
    s_role := least(1, overlap::numeric / least(cardinality(pf.role_tokens), 3));
  end if;

  score := round(100 * (0.40 * s_skills + 0.20 * s_lang + 0.15 * s_exp + 0.10 * s_sal + 0.10 * s_loc + 0.05 * s_role));
  return jsonb_build_object(
    'score', score, 'eligible', eligible, 'version', 'v1',
    'components', jsonb_build_object('skills', round(s_skills, 2), 'language', round(s_lang, 2), 'experience', round(s_exp, 2),
                                     'salary', round(s_sal, 2), 'location', round(s_loc, 2), 'role', round(s_role, 2)),
    'skills', jsonb_build_object('matched', to_jsonb(matched), 'missing', to_jsonb(missing), 'from_cv', to_jsonb(from_cv), 'total', cardinality(jf.skills)),
    'languages', langs,
    'experience', jsonb_build_object('years', pf.years, 'band', jf.band, 'state', exp_state),
    'salary', sal_state, 'location', loc_state);
end $$;

-- ── Stored scores ──────────────────────────────────────────────────────────
create table if not exists public.job_matches (
  job_id      uuid not null references public.jobs(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  score       smallint not null,
  eligible    boolean not null,
  detail      jsonb not null,
  version     text not null default 'v1',
  computed_at timestamptz not null default now(),
  primary key (job_id, profile_id)
);
create index if not exists job_matches_profile_score_idx on public.job_matches (profile_id, score desc);
create index if not exists job_matches_job_score_idx on public.job_matches (job_id, score desc);
alter table public.job_matches enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'job_matches' and policyname = 'job_matches_select') then
    create policy job_matches_select on public.job_matches for select using (
      profile_id = (select public.current_profile_id())
      or coalesce((select public.current_user_role()), '') = 'admin'
      or exists (select 1 from public.applications a
                  where a.job_id = job_matches.job_id and a.candidate_id = job_matches.profile_id
                    and public.is_company_viewer(public.job_company(job_matches.job_id)))
    );
  end if;
end $$;
revoke all on public.job_matches from anon;
revoke insert, update, delete on public.job_matches from authenticated;
grant select on public.job_matches to authenticated;

create or replace function public.refresh_matches_for_profile(p_profile_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare p public.profiles; pf public.match_profile_features; n int := 0;
begin
  select * into p from public.profiles where id = p_profile_id;
  if not found then return 0; end if;
  pf := public.build_profile_features(p);
  insert into public.match_profile_features select pf.*
    on conflict (profile_id) do update set ready = excluded.ready, skills = excluded.skills, text_norm = excluded.text_norm,
      langs = excluded.langs, years = excluded.years, loc_norm = excluded.loc_norm, relocate = excluded.relocate,
      wants_remote = excluded.wants_remote, salary_min = excluded.salary_min, currency = excluded.currency,
      role_tokens = excluded.role_tokens, updated_at = excluded.updated_at;
  if not pf.ready then
    delete from public.job_matches where profile_id = p_profile_id;
    return 0;
  end if;
  with scored as (
    select jf.job_id, public.score_pair(pf, jf) d from public.match_job_features jf where jf.public
  ), up as (
    insert into public.job_matches (job_id, profile_id, score, eligible, detail, version, computed_at)
    select job_id, p_profile_id, (d ->> 'score')::smallint, (d ->> 'eligible')::boolean, d, 'v1', now() from scored
    on conflict (job_id, profile_id) do update
      set score = excluded.score, eligible = excluded.eligible, detail = excluded.detail,
          version = excluded.version, computed_at = excluded.computed_at
    returning 1
  ) select count(*) into n from up;
  delete from public.job_matches m where m.profile_id = p_profile_id
     and not exists (select 1 from public.match_job_features jf where jf.job_id = m.job_id and jf.public);
  return n;
end $$;

create or replace function public.refresh_matches_for_job(p_job_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare j public.jobs; jf public.match_job_features; n int := 0;
begin
  select * into j from public.jobs where id = p_job_id;
  if not found then return 0; end if;
  jf := public.build_job_features(j);
  insert into public.match_job_features select jf.*
    on conflict (job_id) do update set public = excluded.public, skills = excluded.skills, terms = excluded.terms,
      langs = excluded.langs, band = excluded.band, lo = excluded.lo, hi = excluded.hi, remote = excluded.remote,
      city = excluded.city, salary_max = excluded.salary_max, currency = excluded.currency,
      title_tokens = excluded.title_tokens, updated_at = excluded.updated_at;
  if not jf.public then
    delete from public.job_matches where job_id = p_job_id;
    return 0;
  end if;
  with scored as (
    select pf.profile_id, public.score_pair(pf, jf) d from public.match_profile_features pf where pf.ready
  ), up as (
    insert into public.job_matches (job_id, profile_id, score, eligible, detail, version, computed_at)
    select p_job_id, profile_id, (d ->> 'score')::smallint, (d ->> 'eligible')::boolean, d, 'v1', now() from scored
    on conflict (job_id, profile_id) do update
      set score = excluded.score, eligible = excluded.eligible, detail = excluded.detail,
          version = excluded.version, computed_at = excluded.computed_at
    returning 1
  ) select count(*) into n from up;
  return n;
end $$;
revoke all on function public.refresh_matches_for_profile(uuid) from public, anon, authenticated;
revoke all on function public.refresh_matches_for_job(uuid) from public, anon, authenticated;

-- Removing the CV (or erasure) also removes what Claude extracted from it.
create or replace function public.trg_profile_cv_cleared()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(new.parsed_cv_text, '') = '' and coalesce(new.cv_url, '') = '' then
    new.cv_extracted := null;
    new.cv_extracted_at := null;
  end if;
  return new;
end $$;
create or replace trigger trg_profile_cv_cleared
  before update of parsed_cv_text, cv_url on public.profiles
  for each row execute function public.trg_profile_cv_cleared();

create or replace function public.trg_profile_matches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_matches_for_profile(new.id);
  return null;
end $$;
create or replace trigger trg_profile_matches
  after insert or update of role, skills, languages, experience_years, desired_role, headline, bio,
    desired_salary_min, desired_salary_max, currency_preference, location, preferred_location_type,
    willing_to_relocate, parsed_cv_text, cv_extracted
  on public.profiles for each row execute function public.trg_profile_matches();

create or replace function public.trg_job_matches()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_matches_for_job(new.id);
  return null;
end $$;
create or replace trigger trg_job_matches
  after insert or update of title, skills_required, languages_required, level, location_type,
    salary_min, salary_max, currency, status, moderation_status, expires_at, archived_at, paused_at
  on public.jobs for each row execute function public.trg_job_matches();

-- HQ: recompute everything (after changing weights, aliases or many rows).
create or replace function public.rebuild_all_matches()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  -- features for everyone first, then one pass per open job
  insert into public.match_profile_features select (public.build_profile_features(p)).* from public.profiles p
    on conflict (profile_id) do update set ready = excluded.ready, skills = excluded.skills, text_norm = excluded.text_norm,
      langs = excluded.langs, years = excluded.years, loc_norm = excluded.loc_norm, relocate = excluded.relocate,
      wants_remote = excluded.wants_remote, salary_min = excluded.salary_min, currency = excluded.currency,
      role_tokens = excluded.role_tokens, updated_at = excluded.updated_at;
  delete from public.job_matches m where not exists (select 1 from public.match_profile_features pf where pf.profile_id = m.profile_id and pf.ready);
  for r in select id from public.jobs loop
    n := n + public.refresh_matches_for_job(r.id);
  end loop;
  return n;
end $$;
revoke all on function public.rebuild_all_matches() from public, anon, authenticated;

create or replace function public.admin_rebuild_matches()
returns int language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'HQ only' using errcode = '42501';
  end if;
  return public.rebuild_all_matches();
end $$;
revoke all on function public.admin_rebuild_matches() from public, anon;
grant execute on function public.admin_rebuild_matches() to authenticated;

select public.rebuild_all_matches();
