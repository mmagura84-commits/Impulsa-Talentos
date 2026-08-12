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
-- Chosen behavior (per lead direction — BLOCK with SQLSTATE 23503, matching
-- migration 025's error class): when a team member's company_id actually
-- changes (IS DISTINCT FROM guard) and the member is still referenced by any
-- jobs.assignee_id row, RAISE EXCEPTION ... USING ERRCODE = '23503'. The move
-- is rejected atomically with a clear message; the caller must unassign the
-- member first (or delete the member, whose 024 FK ON DELETE SET NULL clears
-- assignments). A member with NO active assignments moves freely.
--
-- Why block rather than auto-clear: the invariant "assignee belongs to the
-- job's company" is a hard constraint — silently clearing assignments on a
-- move would hide the fact that a job lost its responsible hiring-team member.
-- Blocking makes the transfer explicit: the admin decides whether to unassign
-- (SET NULL) before moving. Same error class (23503) the 025 trigger uses, so
-- clients handle both uniformly. (Note: RLS WITH CHECK on team_members already
-- blocks cross-company moves for employer-role REST users — 403/42501 — so
-- this trigger closes the DB layer for privileged paths: service_role key,
-- SQL Editor, future admin tooling, where RLS is bypassed.)
--
-- Invariant guarantee (both halves, from 025 + 026):
--   025 blocks cross-company assignment on jobs writes (same-company check);
--   026 blocks the member-side move while any assignment exists (this trigger).
--   ⇒ at no point can jobs.assignee_id reference a member whose company_id
--     differs from jobs.company_id.
--
-- Implementation notes:
--   • SECURITY DEFINER + SET search_path = public (025 / 019-helper pattern)
--     so the jobs existence check runs deterministically regardless of the
--     invoking user's RLS view; it only reads counts (no data exposure).
--   • Pure SELECT inside the trigger → no interaction with 025's jobs trigger
--     and no jobs.updated_at side effect.
--   • NULL company_id is handled by IS DISTINCT FROM (NULL ↔ value counts as
--     a change and is blocked if assignments exist).
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
-- 1. Enforcer function: block the move while the member has active assignments.
CREATE OR REPLACE FUNCTION public.enforce_team_members_move_no_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned bigint;
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    SELECT count(*) INTO v_assigned
    FROM public.jobs
    WHERE assignee_id = OLD.id;
    IF v_assigned > 0 THEN
      RAISE EXCEPTION 'team_members.company_id cannot be changed: member % is assigned to % job(s); unassign first',
        OLD.id, v_assigned
        USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- 2. Trigger: fire only when company_id appears in the UPDATE statement.
DROP TRIGGER IF EXISTS trg_team_members_company_move_no_assignments ON public.team_members;
CREATE TRIGGER trg_team_members_company_move_no_assignments
  BEFORE UPDATE OF company_id ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_team_members_move_no_assignments();
COMMIT;
