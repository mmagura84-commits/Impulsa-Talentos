-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Profile enrichment (migration 005)
-- Adds structured career fields for better AI and deterministic matching.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists skills            text[],
  add column if not exists desired_role      text,
  add column if not exists experience_years  integer,
  add column if not exists desired_salary_min numeric,
  add column if not exists desired_salary_max numeric,
  add column if not exists parsed_cv_text    text;
