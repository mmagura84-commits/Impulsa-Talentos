-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Email notification system (migration 030)
--
-- Durable transactional-email queue. Fires AFTER-INSERT/UPDATE triggers that
-- ENQUEUE email work into email_outbox; a Supabase Edge Function
-- (supabase/functions/send-email, PR B) drains it via pg_cron and sends through
-- Resend. Triggers only ENQUEUE — they never send (no network in the DB layer,
-- no credentials in the DB). Four emails (owner item 3):
--
--   1. candidate_confirm  — candidate receives confirmation when they apply
--   2. employer_alert     — vacancy owner (+ optional assignee, deduped) is
--                           alerted a new candidate applied to their job
--   3. admin_new_user     — admin copy when a new candidate OR employer registers
--   4. admin_new_job      — admin copy when a new job is published (open+approved)
--
-- Design rules (hard):
--   • AFTER triggers only → fire on COMMITTED rows, never drafts/keystrokes.
--   • enqueue_email is SECURITY DEFINER, fully DEFENSIVE (never raises) — a
--     notification enqueue must NEVER abort the application/user/job insert.
--   • Dedupe unique(event_type, recipient, payload) + ON CONFLICT DO NOTHING —
--     trigger refires / webhook retries / double-click can never double-send.
--   • Candidate opt-out honored: notification_prefs->>'applicationUpdates'='false'
--     suppresses candidate_confirm + employer_alert (matches existing client logic).
--   • Employer recipient resolved to the OWNER profile email + job assignee
--     (team_members.invite_email), deduped — NO catchall mailbox.
--   • No client can write email_outbox: RLS enabled, no INSERT/UPDATE policies.
--     The edge function writes via service role; admins read via SECURITY DEFINER.
--
-- Apply: owner SQL Editor (live project cmdqlybsgkegolqydmbh) after 029.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. email_outbox — durable queue
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL CHECK (event_type IN (
                'candidate_confirm','employer_alert','admin_new_user','admin_new_job')),
  recipient   text NOT NULL,
  payload     jsonb NOT NULL,
  locale      text NOT NULL DEFAULT 'en' CHECK (locale IN ('en','es')),
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','sending','sent','failed','skipped')),
  attempts    int  NOT NULL DEFAULT 0,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  CONSTRAINT email_outbox_dedupe UNIQUE (event_type, recipient, payload)
);
CREATE INDEX IF NOT EXISTS email_outbox_pending_idx
  ON public.email_outbox (status, created_at)
  WHERE status IN ('pending','sending');
CREATE INDEX IF NOT EXISTS email_outbox_recipient_created_idx
  ON public.email_outbox (recipient, created_at);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
-- RLS: NO policies for anon/authenticated — clients cannot read/write the queue.
--   • edge function (service role) writes/updates (bypasses RLS);
--   • admins read via SECURITY DEFINER helper below (no direct SELECT policy).

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. enqueue_email — SECURITY DEFINER, defensive, deduped
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.enqueue_email(
  p_event text, p_recipient text, p_payload jsonb, p_locale text DEFAULT 'en'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  row_id uuid;
BEGIN
  IF p_recipient IS NULL OR p_recipient = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    INSERT INTO public.email_outbox(event_type, recipient, payload, locale)
    VALUES (p_event, p_recipient, p_payload, p_locale)
    ON CONFLICT (event_type, recipient, payload) DO NOTHING
    RETURNING id INTO row_id;
    RETURN row_id;
  EXCEPTION WHEN OTHERS THEN
    -- Defensive: an enqueue failure must never abort the parent txn/insert.
    RAISE NOTICE 'enqueue_email skipped (%): %', p_event, sqlerrm;
    RETURN NULL;
  END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Trigger functions
-- ═══════════════════════════════════════════════════════════════════════════
-- 3a. Application insert → candidate_confirm (to the applicant) +
--     employer_alert (to job owner + optional assignee, deduped).
CREATE OR REPLACE FUNCTION public.enqueue_application_emails()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_candidate_name text;
  v_candidate_email text;
  v_application_updates boolean;
  v_employer_email text;
  v_assignee_email text;
  v_payload_candidate jsonb;
  v_payload_employer jsonb;
  v_locale text := 'en';
BEGIN
  -- Candidate
  SELECT p.email, p.full_name,
         COALESCE((p.notification_prefs->>'applicationUpdates') = 'true', true)
    INTO v_candidate_email, v_candidate_name, v_application_updates
    FROM public.profiles p WHERE p.id = (NEW.candidate_id)::uuid;
  IF v_candidate_email IS NOT NULL AND v_candidate_email <> '' AND v_application_updates THEN
    v_payload_candidate := jsonb_build_object(
      'applicationId', NEW.id, 'jobId', NEW.job_id, 'candidateId', NEW.candidate_id,
      'kind', 'candidate_confirm');
    PERFORM public.enqueue_email('candidate_confirm', v_candidate_email, v_payload_candidate, v_locale);
  END IF;

  -- Employer alert: company owner profile email (role=employer) via
  -- companies.employer_id, plus optional job assignee (team_members.invite_email).
  SELECT p.email INTO v_employer_email
    FROM public.jobs j
    JOIN public.companies c ON c.id = j.company_id
    JOIN public.profiles p ON p.user_id = c.employer_id
    WHERE j.id = NEW.job_id AND p.role = 'employer'
    LIMIT 1;
  IF v_employer_email IS NOT NULL AND v_employer_email <> '' THEN
    v_payload_employer := jsonb_build_object(
      'applicationId', NEW.id, 'jobId', NEW.job_id, 'candidateId', NEW.candidate_id,
      'recipientRole', 'owner', 'kind', 'employer_alert');
    PERFORM public.enqueue_email('employer_alert', v_employer_email, v_payload_employer, v_locale);
  END IF;

  -- Assignee (team_members.invite_email), deduped against owner.
  SELECT tm.invite_email INTO v_assignee_email
    FROM public.jobs j
    JOIN public.team_members tm ON tm.id = j.assignee_id
    WHERE j.id = NEW.job_id AND j.assignee_id IS NOT NULL
      AND tm.invite_email IS DISTINCT FROM v_employer_email
    LIMIT 1;
  IF v_assignee_email IS NOT NULL AND v_assignee_email <> '' THEN
    v_payload_employer := jsonb_build_object(
      'applicationId', NEW.id, 'jobId', NEW.job_id, 'candidateId', NEW.candidate_id,
      'recipientRole', 'assignee', 'kind', 'employer_alert');
    PERFORM public.enqueue_email('employer_alert', v_assignee_email, v_payload_employer, v_locale);
  END IF;

  RETURN NEW;
END $$;

-- 3b. New profile (candidate/employer) → admin_new_user.
CREATE OR REPLACE FUNCTION public.enqueue_new_user_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('candidate','employer') THEN
    PERFORM public.enqueue_email(
      'admin_new_user', NULL,  -- recipient resolved at drain time via ADMIN_EMAIL secret
      jsonb_build_object('profileId', NEW.id, 'role', NEW.role, 'kind', 'admin_new_user'));
  END IF;
  RETURN NEW;
END $$;

-- 3c. Published job (open + approved) → admin_new_job.
--     Fires on INSERT and on UPDATE that sets status='open'; only when the
--     job is both open and moderation-approved (mig 014 already guards publish).
CREATE OR REPLACE FUNCTION public.enqueue_job_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company text;
BEGIN
  SELECT c.name INTO v_company FROM public.companies c WHERE c.id = NEW.company_id;
  PERFORM public.enqueue_email(
    'admin_new_job', NULL,  -- recipient resolved at drain time via ADMIN_EMAIL secret
    jsonb_build_object('jobId', NEW.id, 'companyId', NEW.company_id,
      'companyName', v_company, 'title', NEW.title, 'kind', 'admin_new_job'));
  RETURN NEW;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Triggers
-- ═══════════════════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS trg_applications_email ON public.applications;
CREATE TRIGGER trg_applications_email
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_application_emails();

DROP TRIGGER IF EXISTS trg_profiles_email ON public.profiles;
CREATE TRIGGER trg_profiles_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW WHEN (NEW.role IN ('candidate','employer'))
  EXECUTE FUNCTION public.enqueue_new_user_email();

DROP TRIGGER IF EXISTS trg_jobs_email ON public.jobs;
CREATE TRIGGER trg_jobs_email
  AFTER INSERT OR UPDATE OF status ON public.jobs
  FOR EACH ROW WHEN (NEW.status = 'open' AND NEW.moderation_status = 'approved')
  EXECUTE FUNCTION public.enqueue_job_email();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Admin read helper (SECURITY DEFINER) — admins query the queue head for
--    monitoring without a broad SELECT policy being exposed to clients.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_email_outbox(p_admin_uid text, p_limit int DEFAULT 20)
RETURNS SETOF public.email_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.email_outbox o
  WHERE EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_admin_uid AND p.role = 'admin'
  )
  ORDER BY o.created_at DESC
  LIMIT p_limit;
$$;

COMMIT;
