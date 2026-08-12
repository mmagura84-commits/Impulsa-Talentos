-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Job management: pause/archive/dates/assignment (migration 024)
--
-- Enables the job-management controls that shipped honest-disabled in PR #101
-- (JobManagementPanel). Columns on the existing `jobs` table:
--
--   paused_at    — timestamptz; when set, the job is paused (toggle off clears).
--   archived_at  — timestamptz; when set, the job is archived.
--   published_at — timestamptz; when the job went live (editable date).
--   expires_at   — timestamptz; when the listing expires.
--   assignee_id  — uuid → team_members.id; the hiring-team member assigned.
--
-- RLS: NO new policies required — the existing `jobs_update_owner` /
-- `jobs_update_admin` policies (004_rls_policies) already gate UPDATE on jobs
-- via company ownership. The new columns inherit the table-level RLS.
--
-- updated_at: the existing trigger stamps on UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_assignee_id_idx ON public.jobs (assignee_id);
CREATE INDEX IF NOT EXISTS jobs_archived_at_idx ON public.jobs (archived_at)
  WHERE archived_at IS NOT NULL;

COMMIT;
