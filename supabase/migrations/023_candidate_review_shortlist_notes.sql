-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Candidate Review: shortlist + notes (migration 023)
--
-- Enables the candidate-review controls that shipped honest-disabled in PR #100
-- (candidate review panel: shortlist toggle + private notes). The data layer is
-- two columns on the existing `applications` table:
--
--   shortlisted  — boolean; employer marks a candidate for the shortlist.
--   notes        — private employer-only notes on the application.
--
-- RLS: NO new policies required — the existing `applications_update_employer`
-- policy (004_rls_policies) already lets an employer UPDATE applications on
-- their own company's jobs (WITH CHECK on job_id ∈ owned companies), and
-- `applications_select_employer` covers SELECT. The columns inherit the
-- table-level RLS. Candidates keep their existing row-scoped policies and
-- cannot read/write these employer fields beyond their own application row.
--
-- updated_at: the existing trigger already stamps on UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS shortlisted boolean NOT NULL DEFAULT false;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS notes text;

-- Pipeline/shortlist filtering on the employer side.
CREATE INDEX IF NOT EXISTS applications_job_shortlisted_idx
  ON public.applications (job_id, shortlisted);

COMMIT;
