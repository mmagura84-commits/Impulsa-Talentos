-- Migration 020: Interview Scheduling + Scorecards
-- Adds employer interview scheduling with structured evaluation:
--   interviews            — scheduled meetings between a candidate and an employer
--   interview_scorecards  — internal employer evaluation of an interview
--   interview_scorecard_questions — per-question ratings on a scorecard
-- RLS follows the house pattern: company members can select;
-- company owners/admins can insert/update/delete.

BEGIN;

-- ── 1. interviews table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  type text NOT NULL DEFAULT 'phone'
    CHECK (type IN ('phone', 'screening', 'technical', 'cultural', 'final')),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  location_or_link text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS interviews_job_id_idx ON public.interviews (job_id);
CREATE INDEX IF NOT EXISTS interviews_candidate_id_idx ON public.interviews (candidate_id);
CREATE INDEX IF NOT EXISTS interviews_company_id_idx ON public.interviews (company_id);
CREATE INDEX IF NOT EXISTS interviews_scheduled_at_idx ON public.interviews (scheduled_at);
CREATE INDEX IF NOT EXISTS interviews_status_idx ON public.interviews (status);

-- ── 2. interview_scorecards table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id),
  overall_rating int NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  strengths text,
  concerns text,
  recommendation text NOT NULL
    CHECK (recommendation IN ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scorecards_interview_id_idx ON public.interview_scorecards (interview_id);
CREATE INDEX IF NOT EXISTS scorecards_reviewer_id_idx ON public.interview_scorecards (reviewer_id);

-- ── 3. interview_scorecard_questions table (structured feedback) ──
CREATE TABLE IF NOT EXISTS public.interview_scorecard_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id uuid NOT NULL REFERENCES public.interview_scorecards(id) ON DELETE CASCADE,
  question text NOT NULL,
  rating int CHECK (rating BETWEEN 1 AND 5),
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scorecard_questions_scorecard_id_idx
  ON public.interview_scorecard_questions (scorecard_id);

-- ── 4. Enable RLS ────────────────────────────────────────────
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_scorecard_questions ENABLE ROW LEVEL SECURITY;

-- ── 5. interviews RLS policies ───────────────────────────────

-- Company members can view interviews for their company
DROP POLICY IF EXISTS "interviews_select_company" ON public.interviews;
CREATE POLICY "interviews_select_company" ON public.interviews
  FOR SELECT USING (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
    )
  );

-- The candidate can always view their own interviews
DROP POLICY IF EXISTS "interviews_select_candidate" ON public.interviews;
CREATE POLICY "interviews_select_candidate" ON public.interviews
  FOR SELECT USING (
    candidate_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()::text
    )
  );

-- HQ admins can view all interviews
DROP POLICY IF EXISTS "interviews_select_admin" ON public.interviews;
CREATE POLICY "interviews_select_admin" ON public.interviews
  FOR SELECT USING (public.current_user_role() = 'admin');

-- Company owners/admins can schedule interviews
DROP POLICY IF EXISTS "interviews_insert_owner" ON public.interviews;
CREATE POLICY "interviews_insert_owner" ON public.interviews
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can update interviews (reschedule, complete, cancel)
DROP POLICY IF EXISTS "interviews_update_owner" ON public.interviews;
CREATE POLICY "interviews_update_owner" ON public.interviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = interviews.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = interviews.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can delete interviews
DROP POLICY IF EXISTS "interviews_delete_owner" ON public.interviews;
CREATE POLICY "interviews_delete_owner" ON public.interviews
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = interviews.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- ── 6. interview_scorecards RLS policies ─────────────────────
-- Scorecards are internal employer evaluation — candidates cannot see them.

-- Company members can view scorecards for interviews in their company
DROP POLICY IF EXISTS "scorecards_select_company" ON public.interview_scorecards;
CREATE POLICY "scorecards_select_company" ON public.interview_scorecards
  FOR SELECT USING (
    interview_id IN (
      SELECT i.id FROM public.interviews i
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
      )
    )
  );

-- HQ admins can view all scorecards
DROP POLICY IF EXISTS "scorecards_select_admin" ON public.interview_scorecards;
CREATE POLICY "scorecards_select_admin" ON public.interview_scorecards
  FOR SELECT USING (public.current_user_role() = 'admin');

-- Company owners/admins can submit scorecards
DROP POLICY IF EXISTS "scorecards_insert_owner" ON public.interview_scorecards;
CREATE POLICY "scorecards_insert_owner" ON public.interview_scorecards
  FOR INSERT WITH CHECK (
    interview_id IN (
      SELECT i.id FROM public.interviews i
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

-- Company owners/admins can update scorecards
DROP POLICY IF EXISTS "scorecards_update_owner" ON public.interview_scorecards;
CREATE POLICY "scorecards_update_owner" ON public.interview_scorecards
  FOR UPDATE USING (
    interview_id IN (
      SELECT i.id FROM public.interviews i
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  ) WITH CHECK (
    interview_id IN (
      SELECT i.id FROM public.interviews i
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

-- Company owners/admins can delete scorecards
DROP POLICY IF EXISTS "scorecards_delete_owner" ON public.interview_scorecards;
CREATE POLICY "scorecards_delete_owner" ON public.interview_scorecards
  FOR DELETE USING (
    interview_id IN (
      SELECT i.id FROM public.interviews i
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

-- ── 7. interview_scorecard_questions RLS policies ────────────
-- Same access model as scorecards (company members select; owners/admins write).

DROP POLICY IF EXISTS "questions_select_company" ON public.interview_scorecard_questions;
CREATE POLICY "questions_select_company" ON public.interview_scorecard_questions
  FOR SELECT USING (
    scorecard_id IN (
      SELECT s.id FROM public.interview_scorecards s
      JOIN public.interviews i ON i.id = s.interview_id
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "questions_select_admin" ON public.interview_scorecard_questions;
CREATE POLICY "questions_select_admin" ON public.interview_scorecard_questions
  FOR SELECT USING (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "questions_insert_owner" ON public.interview_scorecard_questions;
CREATE POLICY "questions_insert_owner" ON public.interview_scorecard_questions
  FOR INSERT WITH CHECK (
    scorecard_id IN (
      SELECT s.id FROM public.interview_scorecards s
      JOIN public.interviews i ON i.id = s.interview_id
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "questions_update_owner" ON public.interview_scorecard_questions;
CREATE POLICY "questions_update_owner" ON public.interview_scorecard_questions
  FOR UPDATE USING (
    scorecard_id IN (
      SELECT s.id FROM public.interview_scorecards s
      JOIN public.interviews i ON i.id = s.interview_id
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  ) WITH CHECK (
    scorecard_id IN (
      SELECT s.id FROM public.interview_scorecards s
      JOIN public.interviews i ON i.id = s.interview_id
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "questions_delete_owner" ON public.interview_scorecard_questions;
CREATE POLICY "questions_delete_owner" ON public.interview_scorecard_questions
  FOR DELETE USING (
    scorecard_id IN (
      SELECT s.id FROM public.interview_scorecards s
      JOIN public.interviews i ON i.id = s.interview_id
      WHERE i.company_id IN (
        SELECT tm.company_id FROM public.team_members tm
        WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

COMMIT;
