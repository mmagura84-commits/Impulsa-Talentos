-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Company-verified publish enforcement (migration 014)
--
-- Enforces that jobs can only be published (status = 'open') when the
-- company they belong to is verified (verified = true). This is the
-- server-side enforcement layer — the client-side UI already blocks the
-- publish button for unverified companies, but RLS guarantees data
-- integrity even if the client is bypassed.
--
-- Rules:
--   INSERT: status = 'open' requires company.verified = true
--   INSERT: status = 'draft' or 'closed' allowed without verification
--   UPDATE: setting status to 'open' requires company.verified = true
--   UPDATE: changing from 'open' to other status → allowed (closing)
--   UPDATE: status = 'draft' never requires verification
--   ADMIN: admins bypass verification checks (use admin policies)
--
-- Apply: Run in Supabase SQL Editor AFTER migration 013.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: is the company for a given company_id verified? ─────────────────
CREATE OR REPLACE FUNCTION company_is_verified(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT verified FROM public.companies WHERE id = p_company_id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. jobs_insert_owner — add verified check for publishing
-- ═══════════════════════════════════════════════════════════════════════════
-- Original: only checks employer owns company
-- Modified: also checks verified when status = 'open'
DROP POLICY IF EXISTS "jobs_insert_owner" ON public.jobs;
CREATE POLICY "jobs_insert_owner" ON public.jobs
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE employer_id = auth.uid()::text
    )
    AND (
      -- Drafts and closed jobs are always allowed
      status IS DISTINCT FROM 'open'
      -- Publishing requires verified company
      OR public.company_is_verified(company_id) = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. jobs_update_owner — add verified check for status change to 'open'
-- ═══════════════════════════════════════════════════════════════════════════
-- Original: only checks employer owns company
-- Modified: verified check when NEW status = 'open'
DROP POLICY IF EXISTS "jobs_update_owner" ON public.jobs;
CREATE POLICY "jobs_update_owner" ON public.jobs
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE employer_id = auth.uid()::text
    )
  ) WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE employer_id = auth.uid()::text
    )
    AND (
      -- Non-open status change allowed without verification
      status IS DISTINCT FROM 'open'
      -- Publishing (or keeping open) requires verified company
      OR public.company_is_verified(company_id) = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification queries (run after applying)
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper function exists:
-- SELECT proname FROM pg_proc WHERE proname = 'company_is_verified';

-- Policies exist with verified check:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
--   WHERE tablename = 'jobs' AND policyname IN ('jobs_insert_owner', 'jobs_update_owner');

-- Test: unverified company tries to insert 'open' job (should fail):
-- SET ROLE authenticated;
-- SET request.jwt.claims = '{"sub": "<employer_user_id>"}';
-- INSERT INTO jobs (company_id, title, status) VALUES ('<unverified_company_id>', 'Test', 'open');
-- Expected: ERROR (policy violation)
