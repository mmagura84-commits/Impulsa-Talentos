-- ─────────────────────────────────────────────────────────────────────────────
-- Impulsa Talentos — Notification System (migration 022)
--
-- Adds `notifications`: per-user in-app notifications powering the
-- employer/candidate action center (application_received, status_changed,
-- message_received, interview_scheduled, feedback_added, team_invite, …).
--
--   user_id  — the auth user id (text, FK → profiles.user_id which is the
--              unique auth-id column; matches the team_members.user_id and
--              profiles.user_id semantics used by every other RLS policy).
--   data     — opaque JSON routing params (job_id / application_id / …).
--   read_at  — NULL while unread; set when the user opens/acknowledges it.
--
-- RLS: each user can SELECT / UPDATE (mark read) / DELETE only their own
--      notifications (user_id = auth.uid()::text).
-- INSERT: deliberately NOT exposed to clients. Notifications are created by
--      server-side code (service role, which bypasses RLS) or via the
--      SECURITY DEFINER helper `notify_user(...)` (guarded so authenticated
--      users can only create notifications for themselves).
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  -- Known types: application_received, status_changed, message_received,
  -- interview_scheduled, feedback_added, team_invite (free text so new
  -- notification types don't require a migration).
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes: unread sweep + list queries for the action center.
CREATE INDEX IF NOT EXISTS notifications_user_id_read_at_idx
  ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ────────────────────────────────────────────

-- Users can read their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid()::text);

-- Users can mark their own notifications as read (update read_at)
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- Users can delete their own notifications
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (user_id = auth.uid()::text);

-- NOTE: no INSERT policy — clients cannot create notification rows directly.
-- Server-side code inserts with the service role (bypasses RLS); or uses
-- notify_user() below.

-- ── System-insert helper (SECURITY DEFINER) ─────────────────
-- Creates a notification and returns its id. Guarded so an authenticated
-- caller can only create notifications for themselves; the service role
-- (auth.uid() is NULL) may notify any user.
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id text,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id <> auth.uid()::text THEN
    RAISE EXCEPTION 'not allowed to create a notification for another user';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMIT;
