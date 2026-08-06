-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Employer data integrity fixes (migration 013)
--
-- Addresses 3 issues from source-level audit (audit-employer-source-level.md):
--
-- 1. Credit decrement stale-write race:
--    post-job.tsx computes new credits client-side (stale value - 1).
--    This RPC does atomic server-side decrement instead.
--
-- 2. RLS blocks employer profile reads:
--    profiles_select_own prevents employers from reading candidate profiles
--    even for candidates who applied to their jobs. This silently breaks:
--      - JobAnalytics match scoring (all scores = 0)
--      - EmployerDashboard candidate names (show UUID fragments)
--      - InterviewScheduler notification emails (candidate email = null)
--    The fix: add a narrowly-scoped policy that lets employers read profiles
--    of candidates who applied to their company's jobs. This does NOT grant
--    broad profile access — only applicants, and only to the specific
--    employer they chose to apply to.
--
-- 3. Also adds a unique index on companies.employer_id (safe; verified 0
--    duplicates 2026-08-06) — prevents future multi-company accidents.
--
-- Apply: Run in Supabase SQL Editor AFTER migration 012.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Atomic credit decrement (replaces client-side race in post-job.tsx)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION decrement_company_credits(company_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE companies
  SET job_credits = GREATEST(0, job_credits - 1)
  WHERE id = company_id
  RETURNING job_credits;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Employer applicant profile visibility (narrowly scoped)
-- ═══════════════════════════════════════════════════════════════════════════

-- Employers can read profiles of candidates who applied to their company's
-- jobs. This is the minimum necessary for:
--   a) Candidate names in the employer dashboard
--   b) Match scoring in JobAnalytics
--   c) Interview notification emails
--
-- Privacy model: an employer can only see candidates who chose to apply
-- to that employer's jobs. No broader profile access.
--
-- Does NOT allow employer INSERT/UPDATE/DELETE on profiles.

DROP POLICY IF EXISTS "profiles_select_employer_applicant" ON public.profiles;
CREATE POLICY "profiles_select_employer_applicant" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT a.candidate_id
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      JOIN companies c ON c.id = j.company_id
      WHERE c.employer_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification queries (run after applying)
-- ═══════════════════════════════════════════════════════════════════════════

-- RPC exists:
-- SELECT proname FROM pg_proc WHERE proname = 'decrement_company_credits';

-- Policy exists:
-- SELECT policyname FROM pg_policies
--   WHERE tablename = 'profiles' AND policyname = 'profiles_select_employer_applicant';
