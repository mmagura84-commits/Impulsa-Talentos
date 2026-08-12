-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Hardening: same-company jobs.assignee_id (migration 025)
--
-- Closes the FK gap noted in the business plan: migration 024 added
-- `jobs.assignee_id uuid REFERENCES team_members(id) ON DELETE SET NULL`, which
-- guarantees the assignee EXISTS but does NOT guarantee the assignee belongs to
-- the SAME company as the job. A raw REST write could assign a job to a
-- team_member of a different company.
--
-- Why a trigger and not a composite FK (jobs(company_id, assignee_id) →
-- team_members(company_id, id)):
--   • jobs.company_id is NOT NULL. A composite FK with ON DELETE SET NULL
--     would NULL BOTH columns on team_member delete → NOT NULL violation →
--     team_member deletions would start FAILING instead of clearing the
--     assignment (migration 024 intended SET NULL semantics).
--   • A CHECK constraint cannot reference another table in PostgreSQL.
--   A BEFORE trigger therefore enforces the invariant while the existing FK
--   keeps referential integrity + ON DELETE SET NULL. The UI already mitigates
--   this gap (JobManagementPanel assigns only via useTeamMembers(job.companyId));
--   this closes it at the database layer for raw REST / any future client.
--
-- Behavior:
--   INSERT, or UPDATE that changes assignee_id / company_id, with a non-null
--   assignee whose team_members.company_id differs from jobs.company_id
--   → RAISE EXCEPTION with SQLSTATE 23503 (foreign_key_violation) so clients
--   see the same error class as an FK violation. NULL assignee is always valid
--   (unassigned); the FK's ON DELETE SET NULL internal update fires the
--   trigger with NEW.assignee_id = NULL and passes.
--
-- RLS: NO new policies required — this is a data-integrity guard, orthogonal
-- to RLS. The function is SECURITY DEFINER (same pattern as the 019 helpers)
-- so the check reads team_members deterministically regardless of the invoking
-- user's RLS view; it exposes no data (boolean only).
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- 0. Pre-flight: refuse to apply if existing rows already violate the invariant
--    (the UI mitigated this, but fail loudly rather than ship with bad data).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.team_members tm ON tm.id = j.assignee_id
    WHERE j.assignee_id IS NOT NULL
      AND tm.company_id IS DISTINCT FROM j.company_id
  ) THEN
    RAISE EXCEPTION 'migration 025 aborted: existing cross-company jobs.assignee_id rows found';
  END IF;
END
$$;

-- 1. Enforcer function.
CREATE OR REPLACE FUNCTION public.enforce_jobs_assignee_same_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = NEW.assignee_id
      AND tm.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'jobs.assignee_id % does not belong to job company %',
      NEW.assignee_id, NEW.company_id
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Trigger: fire on insert and on any change of assignee_id / company_id.
DROP TRIGGER IF EXISTS trg_jobs_assignee_same_company ON public.jobs;
CREATE TRIGGER trg_jobs_assignee_same_company
  BEFORE INSERT OR UPDATE OF assignee_id, company_id ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_jobs_assignee_same_company();

COMMIT;
