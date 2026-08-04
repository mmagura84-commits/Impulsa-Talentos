-- Impulsa Talentos — migration 003: jobs.industry
-- =================================================
-- Adds an `industry` column to the jobs table so jobs can be tagged with a
-- single industry from the canonical list (see /home/team/shared/industries.md
-- and src/hooks/useIndustries.ts) and the landing page can show live counts
-- per industry instead of keyword-matching job titles.
--
-- Run this in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- For FRESH installs, 001_schema.sql already includes `industry text` and the
-- index, so this file only backfills the seed rows (a no-op ALTER + index).

alter table public.jobs add column if not exists industry text;
create index if not exists jobs_industry_idx on public.jobs (industry);

-- ── Backfill the 26 seed jobs (idempotent) ──────────────────────────────────
-- Each job is matched by exact title. Only rows with a NULL/empty industry are
-- touched so employer-edited values are never overwritten.
update public.jobs set industry = 'Technology' where title = 'Bilingual Full Stack Developer (React + Node)' and (industry is null or industry = '');
update public.jobs set industry = 'Finance & Insurance' where title = 'Data Analyst — Financial Services' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Senior Software Engineer — Delivery Platform' and (industry is null or industry = '');
update public.jobs set industry = 'Finance & Insurance' where title = 'Product Manager — Fintech' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'QA Automation Engineer' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'DevOps / Cloud Engineer' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Java Backend Developer' and (industry is null or industry = '');
update public.jobs set industry = 'Customer Service' where title = 'Bilingual Customer Service Representative (EN/ES)' and (industry is null or industry = '');
update public.jobs set industry = 'Customer Service' where title = 'Bilingual Technical Support Analyst' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = '.NET Developer' and (industry is null or industry = '');
update public.jobs set industry = 'Business Administration & Operations' where title = 'Project Manager — Digital Delivery' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Frontend Engineer (React)' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Solutions Engineer' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Full Stack Developer (PHP + React)' and (industry is null or industry = '');
update public.jobs set industry = 'Sales & Marketing' where title = 'Bilingual Sales Agent (EN/ES)' and (industry is null or industry = '');
update public.jobs set industry = 'Customer Service' where title = 'Team Lead — Customer Experience' and (industry is null or industry = '');
update public.jobs set industry = 'Sales & Marketing' where title = 'Bilingual Sales Development Representative' and (industry is null or industry = '');
update public.jobs set industry = 'Sales & Marketing' where title = 'Marketing Operations Specialist' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Senior React Native Engineer' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Node.js Backend Engineer' and (industry is null or industry = '');
update public.jobs set industry = 'Accounting & Finance' where title = 'Bilingual Accounting Analyst' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Frontend Developer (Angular)' and (industry is null or industry = '');
update public.jobs set industry = 'Human Resources & Legal' where title = 'Recruiter (Bilingual)' and (industry is null or industry = '');
update public.jobs set industry = 'Business Administration & Operations' where title = 'Business Analyst (Bilingual)' and (industry is null or industry = '');
update public.jobs set industry = 'Customer Service' where title = 'IT Support Specialist (Bilingual)' and (industry is null or industry = '');
update public.jobs set industry = 'Technology' where title = 'Data Scientist — Logistics Optimization' and (industry is null or industry = '');
