-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Structured Feedback (migration 021)
--
-- Adds application_feedback: structured employer feedback on an application.
--   internal            — visible only to company team members
--   candidate_visible   — visible to the candidate as well (future candidate view)
--
-- RLS: company team members select; company owners/admins insert/update/delete;
--      candidates may select only candidate_visible rows on their own applications;
--      admins have read-only access. Cascade deletes with application.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.application_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stage text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  strengths text,
  concerns text,
  next_steps text,
  visibility text NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'candidate_visible')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_feedback_application_id_idx ON public.application_feedback (application_id);
CREATE INDEX IF NOT EXISTS application_feedback_author_id_idx ON public.application_feedback (author_id);
CREATE INDEX IF NOT EXISTS application_feedback_company_id_idx ON public.application_feedback (company_id);

ALTER TABLE public.application_feedback ENABLE ROW LEVEL SECURITY;

-- Company members can view feedback for their own company's applications
DROP POLICY IF EXISTS "feedback_select_company_member" ON public.application_feedback;
CREATE POLICY "feedback_select_company_member" ON public.application_feedback
  FOR SELECT USING (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
    )
  );

-- Candidates can view candidate_visible feedback on their own applications
DROP POLICY IF EXISTS "feedback_select_candidate_visible" ON public.application_feedback;
CREATE POLICY "feedback_select_candidate_visible" ON public.application_feedback
  FOR SELECT USING (
    visibility = 'candidate_visible'
    AND application_id IN (
      SELECT a.id FROM public.applications a
      WHERE a.candidate_id = auth.uid()::text
    )
  );

-- HQ admins can view all feedback
DROP POLICY IF EXISTS "feedback_select_admin" ON public.application_feedback;
CREATE POLICY "feedback_select_admin" ON public.application_feedback
  FOR SELECT USING (public.current_user_role() = 'admin');

-- Company owners/admins can add feedback
DROP POLICY IF EXISTS "feedback_insert_owner" ON public.application_feedback;
CREATE POLICY "feedback_insert_owner" ON public.application_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can update feedback
DROP POLICY IF EXISTS "feedback_update_owner" ON public.application_feedback;
CREATE POLICY "feedback_update_owner" ON public.application_feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = application_feedback.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = application_feedback.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can delete feedback
DROP POLICY IF EXISTS "feedback_delete_owner" ON public.application_feedback;
CREATE POLICY "feedback_delete_owner" ON public.application_feedback
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = application_feedback.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

COMMIT;
