-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — team_members.company_id move must not strand cross-company
-- job assignments (migration 026)
--
-- Gap (QA finding on PR #122): migration 025's BEFORE trigger on jobs only
-- fires on jobs INSERT / UPDATE OF assignee_id, company_id. A raw
--
--   UPDATE team_members SET company_id = <other>
--
-- moves a member to another company WITHOUT re-validating existing
-- jobs.assignee_id rows: a job in company A could end up assigned to a member
-- whose team_members.company_id is now B — a cross-company assignment that
-- violates the same-company invariant, silently. The UI mitigates (assignee
-- select is same-company scoped), but the data layer was not airtight.
--
-- Chosen behavior (option b — auto-clear, matching 024's ON DELETE SET NULL):
-- when a team member's company_id actually changes, clear assignee_id on all
-- jobs they were assigned to. A member who leaves company A — whether deleted
-- (024 FK) or moved (this trigger) — releases their assignments; no dangling
-- cross-company reference can survive.
--
-- Why SET NULL rather than block (options a/c): the product already treats
-- member departure as "releases assignments" (024's FK is ON DELETE SET NULL);
-- blocking the move would invent a new error class and require manual
-- unassignment for a legitimate admin transfer between companies. Clearing
-- keeps every path consistent with existing semantics.
--
-- Invariant guarantee (both halves, from 025 + 026):
--   025 blocks cross-company assignment on jobs writes (same-company check);
--   026 clears assignments when the member's company changes (this trigger).
--   ⇒ at no point can jobs.assignee_id reference a member whose company_id
--     differs from jobs.company_id.
--
-- Implementation notes:
--   • SECURITY DEFINER + SET search_path = public (025 / 019-helper pattern)
--     so the internal jobs UPDATE runs deterministically regardless of the
--     invoking user's RLS view; it only ever writes NULL to rows that
--     referenced the moved member (no data exposure).
--   • The internal jobs UPDATE fires 025's trg_jobs_assignee_same_company
--     (UPDATE OF assignee_id) — NULL assignee passes its NULL branch. ✓
--   • The existing jobs.updated_at trigger stamps on the cleared rows (same
--     side effect as 024's ON DELETE SET NULL path). Consistent.
--   • Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS.
--
-- RLS: NO new policies required — data-integrity guard, orthogonal to RLS.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;
-- 0. Pre-flight: refuse to apply if existing rows already violate the invariant
--    (025 blocks new ones; this is defense-in-depth for any older data).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.team_members tm ON tm.id = j.assignee_id
    WHERE j.assignee_id IS NOT NULL
      AND tm.company_id IS DISTINCT FROM j.company_id
  ) THEN
    RAISE EXCEPTION 'migration 026 aborted: existing cross-company jobs.assignee_id rows found';
  END IF;
END
$$;
-- 1. Enforcer function: clear job assignments on the member being moved.
CREATE OR REPLACE FUNCTION public.clear_jobs_assignee_on_member_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    UPDATE public.jobs
    SET assignee_id = NULL
    WHERE assignee_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;
-- 2. Trigger: fire only when company_id appears in the UPDATE statement.
DROP TRIGGER IF EXISTS trg_team_members_company_move_clear_assignee ON public.team_members;
CREATE TRIGGER trg_team_members_company_move_clear_assignee
  BEFORE UPDATE OF company_id ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_jobs_assignee_on_member_move();
COMMIT;
