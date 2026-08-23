-- ═══════════════════════════════════════════════════════════════════════════
-- Impulsa Talentos — Owner Campaign-launch data model + RLS
--   migration 035 [SPE]
-- ═══════════════════════════════════════════════════════════════════════════
-- Owner-directive build (task e87abbbf, PART B). Follows team conventions:
--   * SD wrappers for any auth/cross-table logic (NO-RAW-SUBQUERY rule, 029/#130)
--   * current_user_role() SD helper for role gating (defined in 004)
--   * owner/founder lane == role 'admin' (the platform's top role; the MD is
--     role 'md' and has NO access to campaigns)
--   * launching RECORDS the campaign in the platform; it does NOT auto-publish
--     to external social networks (that requires each platform's API/ads
--     credentials, which are owner-owned). The UI states this honestly.
--   * campaigns is OWNER-ONLY: no select/insert/update/delete for MD or any
--     other role. RLS + SD RPCs enforce "only an owner/admin launches".
--
-- Apply: Management API (live cmdqlybsgkegolqydmbh) via IMPULSA_TALENTOS_TEAM.
-- This migration is idempotent (if-not-exists / create-or-replace).
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- campaigns — marketing campaign record, launched by the owner/admin.
--   * channels: array of marketing_channels.code (reference table, admin-managed)
--   * status: 'draft' (planned, editable) | 'launched' | 'cancelled'
--   * append-only history: no DELETE policy.
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default '',
  objective       text not null default '',
  target_audience text not null default '',
  -- marketing_channels.code values (target channels for this campaign)
  channels        text[] not null default '{}'::text[],
  message_copy    text not null default '',
  launch_date     date,
  status          text not null default 'draft'
                    check (status in ('draft','launched','cancelled')),
  launched_by     text,              -- profiles.user_id (owner/admin who launched)
  launched_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.campaigns enable row level security;

-- OWNER/ADMIN ONLY: read + write. No other role (MD/candidate/employer) can see
-- or touch campaigns. Uses current_user_role() (SD helper) — no RLS recursion.
drop policy if exists "camp_select_admin" on public.campaigns;
drop policy if exists "camp_insert_admin" on public.campaigns;
drop policy if exists "camp_update_admin" on public.campaigns;
create policy "camp_select_admin" on public.campaigns
  for select using (public.current_user_role() = 'admin');
create policy "camp_insert_admin" on public.campaigns
  for insert with check (public.current_user_role() = 'admin');
create policy "camp_update_admin" on public.campaigns
  for update using (public.current_user_role() = 'admin')
            with check (public.current_user_role() = 'admin');
-- NO DELETE policy at all: campaigns are retainable history.

-- ═══════════════════════════════════════════════════════════════════════════
-- SD RPCs. Owner/admin-only (role 'admin'). The MD cannot call these.
-- ═══════════════════════════════════════════════════════════════════════════
-- Create + launch in one step (compose form → Launch). Records the campaign
-- as 'launched'. Does NOT publish to external networks.
create or replace function public.launch_campaign(
  p_name            text,
  p_objective       text default '',
  p_target_audience text default '',
  p_channels        text[] default '{}'::text[],
  p_message_copy    text default '',
  p_launch_date     date default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid text := auth.uid()::text;
        v_id  uuid;
begin
  if coalesce(public.current_user_role(),'') <> 'admin' then
    raise exception 'forbidden: only an owner/admin may launch campaigns';
  end if;
  insert into public.campaigns
    (name, objective, target_audience, channels, message_copy, launch_date,
     status, launched_by, launched_at)
  values
    (p_name, p_objective, p_target_audience,
     coalesce(p_channels, '{}'::text[]), p_message_copy, p_launch_date,
     'launched', v_uid, now())
  returning id into v_id;
  return v_id;
end $$;

-- Update a campaign (owner/admin only). Primarily for 'draft' planning edits;
-- also allows annotating an existing record (e.g. cancelling).
create or replace function public.update_campaign(
  p_campaign_id     uuid,
  p_name            text default null,
  p_objective       text default null,
  p_target_audience text default null,
  p_channels        text[] default null,
  p_message_copy    text default null,
  p_launch_date     date default null,
  p_status          text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(public.current_user_role(),'') <> 'admin' then
    raise exception 'forbidden: only an owner/admin may edit campaigns';
  end if;
  if p_status is not null and p_status not in ('draft','launched','cancelled') then
    raise exception 'invalid campaign status';
  end if;
  update public.campaigns set
    name            = coalesce(p_name,            name),
    objective       = coalesce(p_objective,       objective),
    target_audience = coalesce(p_target_audience, target_audience),
    channels        = coalesce(p_channels,        channels),
    message_copy    = coalesce(p_message_copy,    message_copy),
    launch_date     = coalesce(p_launch_date,     launch_date),
    status          = coalesce(p_status,          status),
    updated_at      = now()
  where id = p_campaign_id;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Grants (client RPCs callable via PostgREST). Role guards inside enforce
-- owner/admin-only. Table owner-only via RLS policies.
-- ═══════════════════════════════════════════════════════════════════════════
grant execute on function public.launch_campaign(text,text,text,text[],text,date) to authenticated;
grant execute on function public.update_campaign(uuid,text,text,text,text[],text,date,text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run separately in the post-apply probe):
--   1) campaigns table exists + RLS enabled, 3 admin policies present
--   2) launch_campaign / update_campaign exist and are SECURITY DEFINER
--   3) postgres-role insert/select works; non-admin role blocked by RLS
--   4) launch_campaign called as MD raises 'forbidden'
-- ═══════════════════════════════════════════════════════════════════════════
COMMIT;
