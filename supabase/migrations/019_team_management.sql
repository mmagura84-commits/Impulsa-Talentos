-- Migration 019: Team Management
-- Adds team_members table for employer-side team collaboration.
-- An employer company can have multiple team members with role-based access:
--   owner  — full control (create/manage jobs, invite/remove members)
--   admin  — manage jobs and view applicants
--   member — view jobs and applicants (read-only)

BEGIN;

-- 1. Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  invited_by text,
  invite_email text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One membership per user per company
  UNIQUE (company_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS team_members_company_id_idx ON public.team_members (company_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS team_members_status_idx ON public.team_members (status);

-- 2. Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Company members can view their own company's team
DROP POLICY IF EXISTS "team_members_select_company" ON public.team_members;
CREATE POLICY "team_members_select_company" ON public.team_members
  FOR SELECT USING (
    company_id IN (
      SELECT tm.company_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()::text AND tm.status = 'active'
    )
  );

-- User can always see their own memberships
DROP POLICY IF EXISTS "team_members_select_own" ON public.team_members;
CREATE POLICY "team_members_select_own" ON public.team_members
  FOR SELECT USING (user_id = auth.uid()::text);

-- HQ admins can view all team members
DROP POLICY IF EXISTS "team_members_select_admin" ON public.team_members;
CREATE POLICY "team_members_select_admin" ON public.team_members
  FOR SELECT USING (public.current_user_role() = 'admin');

-- Company owners/admins can insert new members
DROP POLICY IF EXISTS "team_members_insert_owner" ON public.team_members;
CREATE POLICY "team_members_insert_owner" ON public.team_members
  FOR INSERT WITH CHECK (
    -- Must be owner or admin of the target company
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can update members
DROP POLICY IF EXISTS "team_members_update_owner" ON public.team_members;
CREATE POLICY "team_members_update_owner" ON public.team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = team_members.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = team_members.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Company owners/admins can remove members
DROP POLICY IF EXISTS "team_members_delete_owner" ON public.team_members;
CREATE POLICY "team_members_delete_owner" ON public.team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.company_id = team_members.company_id
        AND tm.user_id = auth.uid()::text
        AND tm.status = 'active'
        AND tm.role IN ('owner', 'admin')
    )
  );

-- 4. Auto-create team_member when company is created (employer is owner)
-- Function: creates an owner team_member row for the company creator
CREATE OR REPLACE FUNCTION public.create_team_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (company_id, user_id, role, status)
  VALUES (NEW.id, NEW.employer_id, 'owner', 'active')
  ON CONFLICT (company_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: fires after company insert
DROP TRIGGER IF EXISTS trg_create_team_owner ON public.companies;
CREATE TRIGGER trg_create_team_owner
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.create_team_owner();

-- 5. Backfill existing companies: create owner team_member for existing employer_id
INSERT INTO public.team_members (company_id, user_id, role, status)
SELECT c.id, c.employer_id, 'owner', 'active'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm
  WHERE tm.company_id = c.id AND tm.user_id = c.employer_id
)
ON CONFLICT (company_id, user_id) DO NOTHING;

COMMIT;
